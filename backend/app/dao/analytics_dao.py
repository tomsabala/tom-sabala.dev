"""All reads and writes for first-party traffic measurement.

Postgres only. The deployment runs Postgres everywhere including local
`docker compose`, and pretending otherwise bought a half-working SQLite path
that nothing exercised.

Two filters run through every aggregate.

`site` separates the three front doors — `portfolio`, `apps`, `terminal`. They
are not even served by the same infrastructure (the apps launcher comes off the
VPS gateway, Vercel is not in its request path), and mixing them produces a
"top pages" list where `/` means two different pages.

`identity` separates `anon` from `admin`. Admin rows are kept and queryable,
never dropped: on the apps origin the admin/anonymous split *is* the interesting
number, because it decides whether a visitor gets a volume-backed instance or a
tmpfs one the reaper deletes. The console defaults to `anon` so the owner's own
reloads never inflate the headline, and offers the other two views.

Bot rows are likewise stored, not deleted — a classifier you cannot re-run
against history is a classifier you can never fix.

**Write transactions.** The writers here never commit and never roll back.
`recordServerHit` and `ingest` own the transaction and commit once, so one
request is one transaction; the advisory lock taken in `resolveSession` is
held until that commit. A writer that rolled back on its own error would
destroy the caller's whole batch over one malformed item.
"""
import hashlib
from dataclasses import dataclass, replace
from datetime import datetime, timedelta

from sqlalchemy import Date, and_, case, cast, distinct, func, text

from app.models import AnalyticsEvent, PageView, Project, VisitSession

SESSION_IDLE_MINUTES = 30
#: One page and nothing else measured — no second page, no interaction.
BOUNCE_PAGE_LIMIT = 1
#: `identity=` / `site=` value that applies no filter at all.
ALL = 'all'
#: Paths come from the client, so the distinct set is attacker-influenced.
#: Every panel that groups by path is bounded.
MAX_PATH_ROWS = 25


@dataclass(frozen=True)
class Window:
    """What every console panel is scoped to.

    Passed around as one object rather than four parameters because the whole
    correctness story is that no panel quietly uses a different scope than the
    one the header says it is showing.
    """
    start: datetime
    end: datetime
    days: int
    site: str = ALL
    identity: str = 'anon'
    includeBots: bool = False

    def withSite(self, site):
        return replace(self, site=site)

    def withIdentity(self, identity):
        return replace(self, identity=identity)


class AnalyticsDAO:

    def __init__(self, session):
        self.session = session

    # ── Writes ──────────────────────────────────────────────────────────────

    def _lockVisitor(self, visitorHash, site):
        """Serialize this visitor's writes for the rest of the transaction.

        A page load fans out into several concurrent content requests, each
        handled by its own worker with its own DB session. Without this they
        interleave, and both failures were reproduced in a live browser run:
        four of them found no open visit and each created one, and the
        `page_count` counter lost updates (three `page_views` rows, counter 2).

        A transaction-scoped advisory lock is the cheapest fix that actually
        closes the window — there is no row to lock yet when the visit is being
        created, so row-level `FOR UPDATE` cannot help. It is taken once, here,
        and held until the caller commits; the counters are also incremented
        SQL-side below so they are correct even if a future caller forgets.

        `get_bind()`, not `.bind`: under Flask-SQLAlchemy the scoped session
        has no `bind` of its own (it resolves per mapper), so reading `.bind`
        silently skipped the lock entirely and left both races live.
        """
        key = int.from_bytes(
            hashlib.sha256(f'{site}|{visitorHash}'.encode()).digest()[:8], 'big', signed=True
        )
        self.session.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': key})

    def resolveSession(self, context, now=None):
        """The caller's open visit, or a new one.

        A visit is (visitor hash, 30 minutes of inactivity). Because the hash
        rotates at midnight UTC, a visit straddling midnight becomes two — the
        price of having no cookie, and the reason the console labels the metric
        "visitors" per day rather than "unique people".
        """
        now = now or datetime.utcnow()
        self._lockVisitor(context['visitorHash'], context['site'])
        # `site` is already inside the visitor hash, so this filter can
        # never change the result set. It is here so a future change to the
        # digest cannot silently merge two origins' visits.
        row = (
            self.session.query(VisitSession)
            .filter(VisitSession.visitorHash == context['visitorHash'])
            .filter(VisitSession.site == context['site'])
            .filter(VisitSession.lastSeenAt >= now - timedelta(minutes=SESSION_IDLE_MINUTES))
            .order_by(VisitSession.lastSeenAt.desc())
            .first()
        )
        if row is None:
            row = VisitSession(
                visitorHash=context['visitorHash'],
                site=context['site'],
                identity=context['identity'],
                identitySource=context['identitySource'],
                startedAt=now,
                entryPath=context.get('entryPath'),
                referrerHost=context.get('referrerHost'),
                referrerPath=context.get('referrerPath'),
                country=context.get('country'),
                timezone=_cap(context.get('timezone'), 64),
                device=context.get('device'),
                browser=context.get('browser'),
                os=context.get('os'),
                isBot=bool(context.get('isBot')),
                botReason=context.get('botReason'),
            )
            self.session.add(row)
        else:
            # Late-arriving detail the visit's first request could not
            # carry: the beacon knows the timezone, a CDN hop knows the
            # country, and neither is worth a second row.
            if row.timezone is None and context.get('timezone'):
                row.timezone = _cap(context['timezone'], 64)
            if row.country is None and context.get('country'):
                row.country = context['country']
            # Signing in mid-visit promotes the whole visit. A proven admin
            # only ever replaces an unproven anon — never the reverse, so a
            # later unauthenticated beacon cannot downgrade a visit that an
            # oauth2-proxy or JWT check already established.
            if context['identity'] == 'admin' and row.identity != 'admin':
                row.identity = 'admin'
                row.identitySource = context['identitySource']

        row.lastSeenAt = now
        # Flushed, not committed: the caller reads `row.id` on the writes that
        # follow, and owns the transaction this lock is scoped to.
        self.session.flush()
        return row

    def recordPageView(self, visit, path, source='server', durationMs=None,
                       scrollPct=None, dedupeSeconds=0, resume=False, now=None):
        """Record one view of `path`, or fold this observation into an existing
        row for the same view.

        Both tiers see the same page load, and it has to end up as one row or
        every measured page is counted twice and `beaconCoverage` becomes
        meaningless. They are matched differently because they observe at
        different moments:

        * The **server** sees a load as it happens, several times — one page
          fans out into several content requests. `dedupeSeconds` collapses
          that burst.
        * The **beacon** reports a view only when the visitor *leaves* it, with
          the duration and scroll depth the server never sees. So it attaches
          to the newest view of that path in this visit that is still open
          (`durationMs IS NULL`), rather than to whatever is most recent in
          time.

        `resume` is the single case where a *closed* row is reopened: the
        visitor hid the tab — which reports everything measured so far — and
        then came back to the same page. That is one view with a cumulative
        duration, and the client sends it as such. Recording it as a second
        view inflated page counts and flipped bounces into non-bounces. A real
        navigation back to a path carries no `resume` flag and inserts a new
        row, because that genuinely is a second view.

        A beacon view with no open row to attach to — a route the server never
        observed, which is every view on the apps origin — inserts one.
        """
        now = now or datetime.utcnow()
        query = (
            self.session.query(PageView)
            .filter(PageView.sessionId == visit.id)
            .filter(PageView.path == path)
        )
        if source == 'beacon':
            if not resume:
                query = query.filter(PageView.durationMs.is_(None))
            row = query.order_by(PageView.createdAt.desc(), PageView.id.desc()).first()
        elif dedupeSeconds:
            row = query.filter(
                PageView.createdAt >= now - timedelta(seconds=dedupeSeconds)
            ).order_by(PageView.createdAt.desc(), PageView.id.desc()).first()
        else:
            row = None

        if row is None:
            row = PageView(sessionId=visit.id, path=path, source=source, createdAt=now)
            self.session.add(row)
            # SQL-side: two concurrent writers must not both read N and
            # write N+1. The advisory lock already prevents that, this
            # makes it true without depending on the lock.
            visit.pageCount = VisitSession.pageCount + 1

        # Which tier *proved* the view: once the beacon has reported on a
        # row it is a beacon-covered view, even though the server saw it
        # first. That is exactly what beaconCoverage measures.
        if source == 'beacon':
            row.source = 'beacon'
        if durationMs is not None:
            row.durationMs = max(int(durationMs), row.durationMs or 0)
        if scrollPct is not None:
            row.scrollPct = max(min(int(scrollPct), 100), row.scrollPct or 0)

        visit.lastSeenAt = now
        self.session.flush()
        return row

    def recordEvent(self, visit, name, path=None, props=None, now=None):
        now = now or datetime.utcnow()
        row = AnalyticsEvent(sessionId=visit.id, name=name[:60], path=path,
                             props=props or None, createdAt=now)
        self.session.add(row)
        visit.eventCount = VisitSession.eventCount + 1
        visit.lastSeenAt = now
        self.session.flush()
        return row

    # ── Reads ───────────────────────────────────────────────────────────────

    def _visits(self, window):
        """Base visit query for a `Window`. Every read starts here, so the
        site/identity/bot rules cannot drift between panels."""
        query = (
            self.session.query(VisitSession)
            .filter(VisitSession.startedAt >= window.start)
            .filter(VisitSession.startedAt < window.end)
        )
        if window.site != ALL:
            query = query.filter(VisitSession.site == window.site)
        if window.identity != ALL:
            query = query.filter(VisitSession.identity == window.identity)
        if not window.includeBots:
            query = query.filter(VisitSession.isBot.is_(False))
        return query

    def _botVisits(self, window):
        """Bots in the window. Separate from `_visits`, which excludes them —
        and deliberately not identity-filtered, because a bot is never admin.
        Site-scoped only, so the BOT VISITS tile reads the same under every
        `identity` selection."""
        query = (
            self.session.query(VisitSession)
            .filter(VisitSession.startedAt >= window.start)
            .filter(VisitSession.startedAt < window.end)
            .filter(VisitSession.isBot.is_(True))
        )
        if window.site != ALL:
            query = query.filter(VisitSession.site == window.site)
        return query

    def _visitIds(self, window):
        """Uncorrelated id set for the view/event tables, so the filters above
        are written once instead of being re-joined in every aggregate.

        `correlate(None)` is required: one consumer (`appLaunches`) joins
        `visit_sessions` in its own FROM, and SQLAlchemy would auto-correlate
        the subquery to it, silently changing what is being filtered.
        """
        return (
            self._visits(window)
            .with_entities(VisitSession.id)
            .correlate(None)
            .scalar_subquery()
        )

    def summary(self, window):
        sessions, visitors, bounced = (
            self._visits(window)
            .with_entities(
                func.count(VisitSession.id),
                func.count(distinct(VisitSession.visitorHash)),
                func.coalesce(func.sum(case((and_(
                    VisitSession.pageCount <= BOUNCE_PAGE_LIMIT,
                    VisitSession.eventCount == 0), 1), else_=0)), 0),
            )
            .one()
        )

        # Views, beacon coverage and engagement all come from page_views in one
        # pass. Mixing a row count with the denormalised counter made
        # beaconCoverage able to exceed 100% whenever the counter drifted.
        views, beaconViews, engagement = (
            self.session.query(
                func.count(PageView.id),
                func.coalesce(func.sum(case((PageView.source == 'beacon', 1), else_=0)), 0),
                func.avg(PageView.durationMs),
            )
            .filter(PageView.sessionId.in_(self._visitIds(window)))
            .one()
        )

        return {
            'visitors': int(visitors or 0),
            'sessions': int(sessions or 0),
            'pageViews': int(views or 0),
            'bounceRate': round(100.0 * bounced / sessions, 1) if sessions else 0.0,
            'avgDurationMs': int(engagement) if engagement else None,
            # The share of measured views the client beacon reached. Low is not
            # a bug: it is the blocker rate, and the reason the server-observed
            # tier exists at all.
            'beaconCoverage': round(100.0 * beaconViews / views, 1) if views else 0.0,
            'botSessions': int(self._botVisits(window).count()),
        }

    def series(self, window):
        """Per-day visitors and views, zero-filled so a quiet day is a gap in
        the chart rather than a missing point.

        Views are counted from the `page_views` rows themselves, on the day the
        view happened — the same rows `summary` counts. Summing the
        denormalised `VisitSession.pageCount` bucketed by the *visit's* start
        day charted after-midnight views on the previous day and let the chart
        disagree with the headline in both directions.
        """
        day = cast(VisitSession.startedAt, Date).label('day')
        visitorsByDay = {
            str(d): int(v or 0)
            for d, v in self._visits(window)
            .with_entities(day, func.count(distinct(VisitSession.visitorHash)))
            .group_by(day)
            .all()
        }
        viewDay = cast(PageView.createdAt, Date).label('day')
        viewsByDay = {
            str(d): int(count or 0)
            for d, count in self.session.query(viewDay, func.count(PageView.id))
            .filter(PageView.sessionId.in_(self._visitIds(window)))
            .group_by(viewDay)
            .all()
        }
        out = []
        for offset in range(window.days):
            # `window.days` rather than walking to `window.end`: the window ends
            # at "now", so near midnight UTC its date is already tomorrow and a
            # 1-day window rendered two buckets.
            cursor = (window.start.date() + timedelta(days=offset)).isoformat()
            out.append({'day': cursor,
                        'visitors': visitorsByDay.get(cursor, 0),
                        'pageViews': viewsByDay.get(cursor, 0)})
        return out

    def splitBy(self, window, column, limit=10):
        """Session counts grouped by one visit column."""
        field = {
            'site': VisitSession.site,
            'identity': VisitSession.identity,
            'device': VisitSession.device,
            'browser': VisitSession.browser,
            'os': VisitSession.os,
            'timezone': VisitSession.timezone,
        }[column]
        rows = (
            self._visits(window)
            .with_entities(field, func.count(VisitSession.id),
                           func.count(distinct(VisitSession.visitorHash)))
            .group_by(field)
            .order_by(func.count(VisitSession.id).desc())
            .limit(limit)
            .all()
        )
        return [{'label': value or 'unknown', 'sessions': int(s or 0), 'visitors': int(v or 0)}
                for value, s, v in rows]

    def identitySplit(self, window):
        """anon vs admin for this site, ignoring the window's own identity
        filter — the point of the panel is the comparison, so filtering it by
        the selected identity would make it a tautology."""
        return self.splitBy(window.withIdentity(ALL), 'identity', limit=4)

    def siteSplit(self, window):
        """Traffic per front door, ignoring the window's own site filter for
        the same reason."""
        return self.splitBy(window.withSite(ALL), 'site', limit=8)

    def pathStats(self, window, limit=MAX_PATH_ROWS, pathLike=None):
        """Per-path views, visits and engagement, most-viewed first.

        `pathLike` narrows the scan to one family of paths (`/work/%`), which
        is what keeps the work panel honest: paths are client-controlled on
        both tiers, so sharing one 25-row truncation with `/`, `/terminal` and
        every `#/<slug>` let a quiet project drop off the list entirely and the
        panel then claimed nobody opened it.
        """
        query = (
            self.session.query(
                PageView.path,
                func.count(PageView.id),
                func.count(distinct(PageView.sessionId)),
                func.avg(PageView.durationMs),
                func.avg(PageView.scrollPct),
            )
            .filter(PageView.sessionId.in_(self._visitIds(window)))
        )
        if pathLike:
            query = query.filter(PageView.path.like(pathLike))
        rows = (
            query
            .group_by(PageView.path)
            .order_by(func.count(PageView.id).desc())
            .limit(limit)
            .all()
        )
        return [
            {
                'path': path,
                'views': int(views or 0),
                'visits': int(visits or 0),
                'avgDurationMs': int(duration) if duration else None,
                'avgScrollPct': int(scroll) if scroll else None,
            }
            for path, views, visits, duration, scroll in rows
        ]

    def workViews(self, paths):
        """The `/work/<slug>` rows of `pathStats`, joined to the projects so the
        console shows titles rather than slugs. A slug with no matching project
        — a deleted one still linked from somewhere — keeps its slug."""
        rows = [(row, row['path'].split('/work/', 1)[1])
                for row in paths if row['path'].startswith('/work/')]
        if not rows:
            return []
        titles = dict(
            self.session.query(Project.slug, Project.title)
            .filter(Project.slug.in_([slug for _, slug in rows])).all()
        )
        return [
            {
                'slug': slug,
                'title': titles.get(slug, slug),
                'visits': row['visits'],
                'avgDurationMs': row['avgDurationMs'],
            }
            for row, slug in rows
        ]

    def topEvents(self, window, limit=25):
        rows = (
            self.session.query(
                AnalyticsEvent.name,
                func.count(AnalyticsEvent.id),
                func.count(distinct(AnalyticsEvent.sessionId)),
            )
            .filter(AnalyticsEvent.sessionId.in_(self._visitIds(window)))
            .group_by(AnalyticsEvent.name)
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(limit)
            .all()
        )
        return [{'name': name, 'count': int(c or 0), 'visits': int(v or 0)} for name, c, v in rows]

    def funnel(self, window, landed):
        """The only question this site exists to answer: did someone who landed
        actually look at the work, read the resume, and get in touch?

        `landed` is `summary.sessions` rather than a sixth query. Note it spans
        whatever `site` the window selects, so with `site=all` the apps and
        terminal origins are in the denominator and cannot reach the later
        steps — the console says so.
        """
        visitIds = self._visitIds(window)
        exploredWork = (
            self.session.query(func.count(distinct(PageView.sessionId)))
            .filter(PageView.sessionId.in_(visitIds))
            .filter(PageView.path.like('/work/%'))
            .scalar()
        ) or 0

        steps = ('deep_dive.read', 'resume.open', 'contact.sent')
        byName = dict(
            self.session.query(AnalyticsEvent.name, func.count(distinct(AnalyticsEvent.sessionId)))
            .filter(AnalyticsEvent.sessionId.in_(visitIds))
            .filter(AnalyticsEvent.name.in_(steps))
            .group_by(AnalyticsEvent.name).all()
        )

        return [
            {'step': 'landed', 'visits': int(landed)},
            {'step': 'opened work', 'visits': int(exploredWork)},
            {'step': 'read deep dive', 'visits': int(byName.get('deep_dive.read', 0))},
            {'step': 'opened resume', 'visits': int(byName.get('resume.open', 0))},
            {'step': 'sent message', 'visits': int(byName.get('contact.sent', 0))},
        ]

    def appLaunches(self, window, limit=20):
        """Which hangar units visitors opened, split by the identity that
        opened them — which on that origin decides whether the instance was
        volume-backed or tmpfs the reaper deletes.

        Ignores the window's own identity filter, like `identitySplit` and
        `siteSplit` do with theirs: the panel *is* the anon/admin comparison,
        and under the default `identity=anon` the admin column was
        structurally zero.

        Grouped in SQL on `props->>'slug'`, which is why `props` is JSONB:
        plain `json` has no equality operator, so `GROUP BY props` is a runtime
        error rather than a slow query. Bounded in SQL too — the slug comes
        from a public beacon body, so the distinct set is attacker-influenced
        and must not be materialised in full before being truncated.
        """
        slug = AnalyticsEvent.props['slug'].astext.label('slug')
        rows = (
            self.session.query(slug, VisitSession.identity, func.count(AnalyticsEvent.id))
            .join(VisitSession, VisitSession.id == AnalyticsEvent.sessionId)
            .filter(AnalyticsEvent.sessionId.in_(self._visitIds(window.withIdentity(ALL))))
            .filter(AnalyticsEvent.name == 'apps.open')
            .filter(slug.isnot(None))
            .group_by(slug, VisitSession.identity)
            .order_by(func.count(AnalyticsEvent.id).desc())
            # Two identity rows per slug; the truncation falls on the tail.
            .limit(limit * 2)
            .all()
        )
        tally = {}
        for name, identity, count in rows:
            entry = tally.setdefault(name, {'slug': name, 'opens': 0, 'anon': 0, 'admin': 0})
            entry['opens'] += int(count or 0)
            entry['admin' if identity == 'admin' else 'anon'] += int(count or 0)
        return sorted(tally.values(), key=lambda r: r['opens'], reverse=True)[:limit]

    def referrers(self, window, limit=15):
        rows = (
            self._visits(window)
            .filter(VisitSession.referrerHost.isnot(None))
            .with_entities(
                VisitSession.referrerHost,
                func.count(VisitSession.id),
                func.count(distinct(VisitSession.visitorHash)),
            )
            .group_by(VisitSession.referrerHost)
            .order_by(func.count(VisitSession.id).desc())
            .limit(limit)
            .all()
        )
        out = [{'host': host, 'sessions': int(s or 0), 'visitors': int(v or 0)}
               for host, s, v in rows]

        directSessions, directVisitors = (
            self._visits(window)
            .filter(VisitSession.referrerHost.is_(None))
            .with_entities(func.count(VisitSession.id),
                           func.count(distinct(VisitSession.visitorHash)))
            .one()
        )
        if directSessions:
            out.append({'host': 'direct / none', 'sessions': int(directSessions),
                        'visitors': int(directVisitors)})
        return sorted(out, key=lambda r: r['sessions'], reverse=True)[:limit]

    def recentVisits(self, window, limit=25):
        """The RECENT VISITS rows, shaped here rather than by a model
        serializer so the whole endpoint speaks one naming convention."""
        rows = (
            self._visits(window)
            .order_by(VisitSession.lastSeenAt.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                'id': row.id,
                'site': row.site,
                'identity': row.identity,
                'entryPath': row.entryPath,
                'referrerHost': row.referrerHost,
                'device': row.device,
                'country': row.country,
                'timezone': row.timezone,
                'pageCount': row.pageCount,
                'lastSeenAt': row.lastSeenAt.isoformat() if row.lastSeenAt else None,
            }
            for row in rows
        ]

    def botBreakdown(self, window, limit=10):
        rows = (
            self._botVisits(window)
            .with_entities(VisitSession.botReason, func.count(VisitSession.id),
                           func.count(distinct(VisitSession.visitorHash)))
            .group_by(VisitSession.botReason)
            .order_by(func.count(VisitSession.id).desc())
            .limit(limit)
            .all()
        )
        return [{'label': reason or 'unknown', 'sessions': int(count or 0),
                 'visitors': int(visitors or 0)}
                for reason, count, visitors in rows]

    def purgeBefore(self, cutoff, limit=5000):
        """Delete visits older than `cutoff`; views and events cascade.

        Chunked, because this runs inside an admin page load: the first purge
        after a long gap would otherwise be one unbounded DELETE on the
        critical path. Retention is a GDPR obligation, not a storage concern —
        at this volume the rows would never need pruning for space.
        """
        try:
            stale = (
                self.session.query(VisitSession.id)
                .filter(VisitSession.startedAt < cutoff)
                .limit(limit)
                .subquery()
            )
            deleted = (
                self.session.query(VisitSession)
                .filter(VisitSession.id.in_(stale.select()))
                .delete(synchronize_session=False)
            )
            self.session.commit()
            return int(deleted or 0)
        except Exception:
            self.session.rollback()
            raise


def _cap(value, length):
    return value[:length] if isinstance(value, str) else value
