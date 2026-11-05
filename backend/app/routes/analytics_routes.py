"""First-party traffic measurement: one public ingest endpoint and one admin read.

`POST /api/_e` is deliberately named nothing. Filter lists match on words like
`analytics`, `collect`, `track` and `insights`; `/_e` on the same host that
already serves the site's content looks like application traffic because it is.
The endpoint is unauthenticated and writes to the database, so it is bounded
four ways: a body-size cap, a per-visitor rate limit, a hard cap on batch size,
and a strict shape for every field that reaches a column.

It serves all three origins. `tom-sabala.dev` and `terminal.tom-sabala.dev`
post here directly. `apps.tom-sabala.dev` cannot — it is a separate origin with
a separate session that this backend has no way to verify — so its beacon posts
to the gateway broker's own `/_e`, which resolves the oauth2-proxy identity it
already holds and relays the batch here behind `X-Analytics-Token`. That relay
is the only way a row is ever labelled `admin` from the apps origin; a client
that simply claims it is ignored.

Forging anonymous beacons is possible and uninteresting — the only thing it
achieves is polluting the owner's own numbers. Nothing here is
authorisation-sensitive and nothing here is returned to another visitor.
"""
import logging
import math
import os
import re
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app import db, limiter
from app.dao.analytics_dao import ALL, AnalyticsDAO, Window
from app.services import analytics_service as analytics

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)

#: A real beacon is a few hundred bytes; the broker caps its own leg at 16 KB.
MAX_BODY_BYTES = 16 * 1024
#: `track.ts` caps its own queue at this value, so a full flush fits exactly.
#: Anything beyond it is dropped silently, which is why the two must agree.
MAX_BATCH = 20
MAX_PROP_KEYS = 10
MAX_PROP_LENGTH = 120
#: An engagement timer the page could not plausibly have produced.
MAX_DURATION_MS = 6 * 60 * 60 * 1000
NAME = re.compile(r'^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$')
#: An IANA zone name, not an arbitrary string: `tz` is the one client field
#: that reaches a GROUP BY dimension, and the TIME ZONE panel keeps 10 rows.
TIMEZONE = re.compile(r'^[A-Za-z][A-Za-z0-9+\-_/]{0,63}$')

DEFAULT_WINDOW_DAYS = 30
MAX_WINDOW_DAYS = 365
DEFAULT_RETENTION_DAYS = 400
#: Visits deleted per purge pass. Also the signal that a backlog remains: a
#: full chunk releases the day key so the next console load continues.
PURGE_CHUNK = 5000


def _payload():
    """`force=True` because sendBeacon posts a `text/plain` Blob to dodge a
    CORS preflight, so the Content-Type says nothing useful."""
    body = request.get_json(silent=True, force=True)
    return body if isinstance(body, dict) else {}


def _cleanProps(raw):
    """Flatten client props to finite scalars, dropping anything else.

    A visitor controls this blob, so it is never stored as handed over:
    unbounded nesting in a JSON column is how a 2 KB beacon becomes a 2 MB row,
    and `json.loads` accepts `Infinity`/`NaN`, which Postgres' JSON input then
    rejects — losing the whole batch to one malformed number.
    """
    if not isinstance(raw, dict):
        return None
    out = {}
    for key, value in list(raw.items())[:MAX_PROP_KEYS]:
        if not isinstance(key, str) or not NAME.match(key):
            continue
        if value is None or isinstance(value, bool) or isinstance(value, int):
            out[key] = value
        elif isinstance(value, float) and math.isfinite(value):
            out[key] = value
        elif isinstance(value, str):
            out[key] = value[:MAX_PROP_LENGTH]
    return out or None


def _clampInt(value, high, low=0):
    """OverflowError is in the net on purpose: `int(float('inf'))` raises it,
    and an uncaught one here would discard the entire batch."""
    try:
        return max(low, min(int(value), high))
    except (TypeError, ValueError, OverflowError):
        return None


def _beaconKey():
    """Rate-limit bucket: the visitor, not the peer.

    Keying on `remote_addr` would put every relayed apps-origin beacon into the
    broker's single bucket, so 600 requests from anyone would silence the one
    path that can produce an `admin` row for that origin.
    """
    return analytics.clientIp(analytics.trustedRelay())


@analytics_bp.route('/_e', methods=['POST'])
@limiter.limit('600 per hour', key_func=_beaconKey)
def ingest():
    """
    Client beacon (public). Always answers 204 — the browser discards the body
    and a visitor must never be shown a measurement error.

    Body: {
      path, referrer, tz,
      events: [ {type: 'view', path, durationMs, scrollPct}
              | {type: 'event', name, path, props} ]
    }
    """
    if not analytics.isEnabled():
        return '', 204
    # Before any parse: `get_json` buffers the whole body, and this endpoint is
    # unauthenticated. Flask has no global MAX_CONTENT_LENGTH here because the
    # upload routes need their own, larger, limits. A missing Content-Length is
    # refused outright — a chunked request has none, and reading it as zero
    # left an unbounded body buffered on a public endpoint.
    if request.content_length is None or request.content_length > MAX_BODY_BYTES:
        return '', 204
    try:
        body = _payload()
        batch = body.get('events')
        if not isinstance(batch, list) or not batch:
            return '', 204

        tz = body.get('tz')
        context = analytics.requestContext(
            pagePath=body.get('path'),
            referrer=body.get('referrer'),
            timezone=(tz if isinstance(tz, str) and TIMEZONE.match(tz) else None),
        )
        dao = AnalyticsDAO(db.session)
        # One lock, one transaction, one commit for the whole batch — not one
        # per event.
        visit = dao.resolveSession(context)
        fallbackPath = context['entryPath']

        for item in batch[:MAX_BATCH]:
            if not isinstance(item, dict):
                continue
            try:
                path = analytics.normalizePath(item.get('path'), fallback=fallbackPath)
                if item.get('type') == 'view':
                    dao.recordPageView(
                        visit, path, source='beacon',
                        durationMs=_clampInt(item.get('durationMs'), MAX_DURATION_MS),
                        scrollPct=_clampInt(item.get('scrollPct'), 100),
                        # A tab coming back to the same page is the same view
                        # with a cumulative duration, not a second one.
                        resume=item.get('resume') is True,
                    )
                elif item.get('type') == 'event':
                    name = item.get('name')
                    if isinstance(name, str) and len(name) <= 60 and NAME.match(name):
                        dao.recordEvent(visit, name, path, _cleanProps(item.get('props')))
            except Exception as e:
                # One malformed item costs one item. The writers do not roll
                # back, so the visit and every good item before it survive.
                logger.warning('analytics: beacon item skipped (%s)', e)
                continue
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning('analytics: beacon rejected (%s)', e)
    return '', 204


def _window():
    """The console's scope, from `?days=&site=&identity=&bots=`.

    `days=N` is N calendar days *including today*, which is what the chip says.

    `identity` defaults to `anon`: the owner reloading his own site is not
    traffic, and a headline number that quietly includes him is the exact
    failure this whole feature exists to avoid. `all` and `admin` are one
    query-string away.
    """
    try:
        days = int(request.args.get('days', DEFAULT_WINDOW_DAYS))
    except (TypeError, ValueError):
        days = DEFAULT_WINDOW_DAYS
    days = max(1, min(days, MAX_WINDOW_DAYS))

    site = (request.args.get('site') or ALL).lower()
    if site not in analytics.SITES and site != ALL:
        site = ALL
    identity = (request.args.get('identity') or analytics.IDENTITY_ANON).lower()
    if identity not in analytics.IDENTITIES and identity != ALL:
        identity = analytics.IDENTITY_ANON

    # No fudge factor on `end`: `utcnow()` carries microseconds, so no row can
    # be written at exactly this instant, and `+1s` used to push the window's
    # date into tomorrow for the last second of every UTC day.
    end = datetime.utcnow()
    start = (end - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return Window(start=start, end=end, days=days, site=site, identity=identity,
                  includeBots=request.args.get('bots') == '1')


def _purgeOnce(dao):
    """Enforce retention at most once a day, on an admin read.

    There is no scheduler on the web service and the worker only consumes the
    agent queue, so the console's own page load is the one reliable tick. The
    Redis day-key makes it idempotent across web processes; without Redis the
    purge simply runs on each overview load, which is correct, just wasteful.

    A failed purge must not blank the console, so it is swallowed here rather
    than in the caller's catch-all.
    """
    try:
        days = int(os.getenv('ANALYTICS_RETENTION_DAYS', DEFAULT_RETENTION_DAYS))
    except (TypeError, ValueError):
        days = DEFAULT_RETENTION_DAYS
    if days <= 0:
        return
    from app.queue import getAnalyticsRedis

    key = None
    try:
        key = f"analytics:purged:{datetime.utcnow().strftime('%Y-%m-%d')}"
        if not getAnalyticsRedis().set(key, '1', nx=True, ex=60 * 60 * 48):
            return
    except Exception:
        key = None
    try:
        deleted = dao.purgeBefore(datetime.utcnow() - timedelta(days=days), limit=PURGE_CHUNK)
        # A full chunk means there is more to delete. Releasing the day key
        # lets the next console load continue, instead of capping a backlog at
        # one chunk per day forever.
        if deleted >= PURGE_CHUNK and key:
            getAnalyticsRedis().delete(key)
    except Exception as e:
        logger.warning('analytics: retention purge failed (%s)', e)


@analytics_bp.route('/analytics/overview', methods=['GET'])
@jwt_required()
def overview():
    """
    Everything the traffic console renders, in one round trip (admin only).

    Query: ?days=1..365 (30) &site=all|portfolio|apps|terminal (all)
           &identity=anon|admin|all (anon) &bots=1
    """
    try:
        window = _window()
        dao = AnalyticsDAO(db.session)
        _purgeOnce(dao)

        summary = dao.summary(window)
        paths = dao.pathStats(window)

        return jsonify({
            'success': True,
            'data': {
                'from': window.start.isoformat(),
                'to': window.end.isoformat(),
                'site': window.site,
                'summary': summary,
                'series': dao.series(window),
                # Both splits ignore their own axis of the current filter, so
                # the comparison stays a comparison.
                'sites': dao.siteSplit(window),
                'identities': dao.identitySplit(window),
                'pages': [
                    {'path': row['path'], 'views': row['views'],
                     'avgDurationMs': row['avgDurationMs'], 'avgScrollPct': row['avgScrollPct']}
                    for row in paths
                ],
                # Its own bounded scan: sharing the 25-row PAGES truncation let
                # junk paths push a real project off the list, and the panel
                # then claimed nobody had opened it.
                'work': dao.workViews(dao.pathStats(window, pathLike='/work/%')),
                'referrers': dao.referrers(window),
                'devices': dao.splitBy(window, 'device'),
                'browsers': dao.splitBy(window, 'browser'),
                'timezones': dao.splitBy(window, 'timezone'),
                'events': dao.topEvents(window),
                'apps': dao.appLaunches(window),
                'funnel': dao.funnel(window, summary['sessions']),
                'bots': dao.botBreakdown(window),
                'recent': dao.recentVisits(window),
            },
        }), 200
    except Exception:
        logger.exception('analytics: overview failed')
        return jsonify({'success': False, 'error': 'Failed to load traffic'}), 500
