"""First-party visitor measurement: identity, origin, classification, and the
unblockable server-side tier.

Four deliberate choices live here.

**No cookie, no device storage.** A visitor is
`sha256(daily_salt + site + ip + user_agent)` — Plausible's scheme. The salt is
32 random bytes held in Redis under a 48h TTL, so yesterday's hashes cannot be
recomputed once it expires, and a visitor cannot be followed across days,
devices or sites. Because nothing is stored on or read from the device, the
ePrivacy consent rule is not triggered and the site needs no cookie banner;
GDPR still applies to the transient IP processing, which is why the raw IP
never reaches the database. (It does reach the gateway's Caddy access log on
the apps origin, as it would for any web server — the claim is "not stored by
this application", not "never observed".)

**The page path rides on content requests.** `apiClient` appends `_p=<path>`
to every API call. A content blocker can hide a tracker script, but it cannot
block `GET /api/portfolio` without breaking the page it is protecting — so the
server-observed tier sees every real visit, including the share of an
engineering audience that blocks `/_vercel/insights`.

**Admin is a dimension, never a client claim.** Three origins, two ways to
prove it, and no third:

  * `tom-sabala.dev` / `terminal.tom-sabala.dev` talk to this backend directly,
    so the portfolio's own HttpOnly JWT cookie is probed (`identitySource =
    'jwt'`).
  * `apps.tom-sabala.dev` cannot: it is a different origin, deliberately absent
    from CORS_ORIGINS, and its admin session is oauth2-proxy's SameSite=Lax
    `__Host-apps_admin` cookie, which never leaves that origin. Its beacon goes
    to the gateway broker instead, which already resolves that session for
    every request it serves, and relays the verdict server-to-server behind
    `X-Analytics-Token` (`identitySource = 'gateway'`).

  A beacon that merely *says* it is an admin is ignored. Without a matching
  token the request is anonymous, whatever headers it carries.

**The client's own IP is never trusted.** `request.remote_addr` is read after
ProxyFix has peeled exactly `TRUSTED_PROXY_HOPS` entries off X-Forwarded-For,
so a forged header can only impersonate an address further left than the hop
count, which the proxy itself overwrites.

What is *not* trustworthy, and does not need to be: `site`. It is read from
`Origin`/`Referer`, which page JavaScript cannot set but `curl` can. Forging it
files an anonymous row under the wrong origin and nothing else — the admin
label is gated on the token, not on this.
"""
import hashlib
import hmac
import logging
import os
import secrets
from datetime import datetime
from functools import lru_cache
from urllib.parse import urlsplit

from flask import current_app, request

from app.utils.admin_identity import isAdminRequest
from app.utils.user_agent import classify

logger = logging.getLogger(__name__)

#: Collapses a page's parallel boot fetches into one server-observed view.
SERVER_VIEW_DEDUPE_SECONDS = 10
SALT_TTL_SECONDS = 60 * 60 * 48
MIN_INGEST_TOKEN_LENGTH = 32

SITE_PORTFOLIO = 'portfolio'
SITE_APPS = 'apps'
SITE_TERMINAL = 'terminal'
SITES = (SITE_PORTFOLIO, SITE_APPS, SITE_TERMINAL)

IDENTITY_ANON = 'anon'
IDENTITY_ADMIN = 'admin'
IDENTITIES = (IDENTITY_ANON, IDENTITY_ADMIN)

#: GETs that a page cannot render without. A hit on one of these is evidence a
#: human loaded a page; anything else is not, and must never inflate the
#: numbers. This is an allow-list — an endpoint absent from it is already
#: ignored, which is why IGNORED_PREFIXES below is so short.
SERVER_VIEW_PATHS = (
    '/api/portfolio',
    '/api/about',
    '/api/cv',
    '/api/dashboard/tabs',
    '/api/github-stats',
)

#: Admin-only sub-paths of the prefixes above. Without these two the console's
#: own reads would be counted as public page views.
IGNORED_PREFIXES = (
    '/api/dashboard/tabs/admin',
    '/api/cv/pdf/history',
)

#: Server-observed facts worth their own event, and the binary sub-paths that
#: must not become views. Matched before SERVER_VIEW_PATHS.
SERVER_EVENT_RULES = (
    ('/api/cv/pdf/file', 'resume.open'),
    ('/api/about/profile-photo/', None),
    ('/api/portfolio/images/', None),
)


def isEnabled():
    """Off for the RQ worker (no requests) and wherever an operator says so."""
    if os.getenv('SERVICE_ROLE', 'web') == 'worker':
        return False
    return os.getenv('ANALYTICS_ENABLED', 'True') == 'True'


# ── Identity ────────────────────────────────────────────────────────────────

#: {dayKey: salt}. One entry, replaced when the day rolls over. Without it
#: every measured request pays a Redis round trip to re-read a value that
#: changes once every 24 hours.
_saltCache = {}


def _fallbackSalt(dayKey):
    """Derived salt for when Redis is unreachable.

    Weaker than the random one — holding SECRET_KEY would let you recompute a
    day's hashes if you also still had the IPs — but we never store an IP, and
    a measurement outage is a worse failure than a theoretical one. It is also
    a *different* salt, so a blip mid-day splits one visitor in two; hence the
    warning rather than a debug line.
    """
    secret = (current_app.config.get('SECRET_KEY') or 'dev').encode()
    return hmac.new(secret, f'analytics-salt:{dayKey}'.encode(), hashlib.sha256).hexdigest()


def dailySalt(now=None):
    dayKey = (now or datetime.utcnow()).strftime('%Y-%m-%d')
    cached = _saltCache.get(dayKey)
    if cached:
        return cached

    salt = None
    try:
        from app.queue import getAnalyticsRedis
        client = getAnalyticsRedis()
        key = f'analytics:salt:{dayKey}'
        # Read first: after the first request of the day this is the only call,
        # whereas SET NX first would burn a write on every request forever.
        stored = client.get(key)
        if stored is None:
            minted = secrets.token_hex(32)
            # SET NX so a race between two workers still agrees on one value.
            if client.set(key, minted, nx=True, ex=SALT_TTL_SECONDS):
                stored = minted
            else:
                stored = client.get(key)
        if stored:
            salt = stored.decode() if isinstance(stored, bytes) else str(stored)
    except Exception as e:
        logger.warning('analytics: redis salt unavailable (%s); visitors seen under the '
                       'derived salt will not match those seen under the random one', e)

    # Only a Redis-sourced salt is cached. Caching the fallback pinned the
    # worker to it for the rest of the UTC day, so every visitor it hashed
    # disagreed with its sibling workers' hashes long after Redis recovered.
    if salt:
        _saltCache.clear()
        _saltCache[dayKey] = salt
        return salt
    return _fallbackSalt(dayKey)


@lru_cache(maxsize=1)
def _expectedToken():
    """The relay secret as bytes, or None. Read once: it is boot configuration,
    and re-validating it on every request only produced one log line per
    request when it was wrong."""
    token = (os.getenv('ANALYTICS_INGEST_TOKEN') or '').strip()
    if not token:
        return None
    if len(token) < MIN_INGEST_TOKEN_LENGTH:
        # Refusing is the safe failure: a short shared secret on a public
        # endpoint is a guessable way to mint admin-labelled rows.
        logger.error('analytics: ANALYTICS_INGEST_TOKEN is shorter than %d characters and has '
                     'been ignored — every relayed visit will be recorded as anonymous',
                     MIN_INGEST_TOKEN_LENGTH)
        return None
    return token.encode()


def checkConfiguration():
    """Boot-time report, so a misconfigured token is visible once at startup
    rather than only as permanently missing admin rows."""
    if not isEnabled():
        logger.info('analytics: disabled')
        return
    if _expectedToken() is None:
        logger.info('analytics: no ANALYTICS_INGEST_TOKEN — apps-origin visits relayed by the '
                    'gateway will all be recorded as anonymous')


def trustedRelay():
    """The gateway broker's verdict, or None when this is a direct request.

    Returns `{'identity', 'site', 'ip'}`. The token compare is constant-time
    over bytes with an explicit length guard: `hmac.compare_digest` on `str`
    raises TypeError for any non-ASCII character, and a header is attacker
    controlled — one `X-Analytics-Token: é` would otherwise abort measurement
    for that request on *both* tiers.
    """
    presented = request.headers.get('X-Analytics-Token')
    expected = _expectedToken()
    if not expected or not presented:
        return None
    presented = presented.strip().encode('utf-8', 'replace')
    if len(presented) != len(expected) or not hmac.compare_digest(presented, expected):
        # debug, not warning: any client can send this header on any request,
        # so a louder level is an unauthenticated way to fill the log.
        logger.debug('analytics: relay presented a bad token')
        return None

    identity = (request.headers.get('X-Analytics-Identity') or '').strip().lower()
    site = (request.headers.get('X-Analytics-Site') or '').strip().lower()
    return {
        'identity': identity if identity in IDENTITIES else IDENTITY_ANON,
        'site': site if site in SITES else SITE_APPS,
        'ip': (request.headers.get('X-Analytics-Ip') or '').strip() or None,
    }


def clientIp(relay=None):
    """The caller's address, post-ProxyFix.

    A trusted relay supplies the address it saw, because the broker — not the
    visitor — is this request's peer.

    There is deliberately no X-Forwarded-For fallback. ProxyFix counts from the
    right; reading the header by hand would read the left, which is the end the
    client controls, so the "fallback" would hand every visitor the power to
    choose their own identity and their own rate-limit bucket.
    """
    if relay and relay.get('ip'):
        # Capped at the longest INET6 text form: it becomes a rate-limit key.
        return relay['ip'][:45]
    return request.remote_addr or '0.0.0.0'


def resolveIdentity(relay=None):
    """`('anon'|'admin', 'jwt'|'gateway'|'none')` — how, and on what evidence.

    The gateway relay wins because it is the only proof available for the apps
    origin; this backend cannot see that origin's oauth2-proxy session at all.
    """
    if relay:
        return relay['identity'], 'gateway'
    if isAdminRequest():
        return IDENTITY_ADMIN, 'jwt'
    return IDENTITY_ANON, 'none'


# ── Origin ──────────────────────────────────────────────────────────────────

def _originHost():
    """The browsing origin's host, not this API's."""
    for header in ('Origin', 'Referer'):
        raw = request.headers.get(header)
        if raw:
            host = (urlsplit(raw).hostname or '').lower()
            if host:
                return host
    return (request.host or '').split(':')[0].lower()


def resolveSite(relay=None, path=None):
    """Which front door this visit came through.

    The apps origin proves itself through the broker relay; the other two are
    recognised by host, with the page path as the tiebreak for the terminal
    bundle, which is also reachable at `/terminal.html` on the main domain.
    """
    if relay:
        return relay['site']
    host = _originHost()
    if host.startswith('apps.'):
        return SITE_APPS
    if host.startswith('terminal.'):
        return SITE_TERMINAL
    if (path or '').startswith('/terminal'):
        return SITE_TERMINAL
    return SITE_PORTFOLIO


# ── Normalisation ───────────────────────────────────────────────────────────

def normalizePath(raw, fallback='/'):
    """Path only: query strings and fragments carry session noise (and the
    `_p` parameter itself) that would fragment every aggregate."""
    if not isinstance(raw, str) or not raw:
        return fallback
    raw = raw.strip()
    if '://' in raw:
        raw = urlsplit(raw).path or '/'
    raw = raw.split('?', 1)[0].split('#', 1)[0]
    if not raw.startswith('/'):
        raw = '/' + raw
    # `//evil.com` is a protocol-relative URL, not a path. Nothing renders
    # these as links today; collapsing them keeps it that way by construction.
    raw = '/' + raw.lstrip('/')
    if len(raw) > 1 and raw.endswith('/'):
        raw = raw.rstrip('/') or '/'
    return raw[:500]


@lru_cache(maxsize=1)
def _configuredHosts():
    """Our own origins, from the lists the deployment already maintains.
    Cached: this is boot configuration, read on every measured request."""
    hosts = set()
    for raw in (os.getenv('CORS_ORIGINS') or '', os.getenv('HANGAR_BROKER_URL') or ''):
        for origin in raw.split(','):
            host = urlsplit(origin.strip()).hostname
            if host:
                hosts.add(host.lower())
    return frozenset(hosts)


def parseReferrer(raw):
    """(host, path) for an external referrer; (None, None) for a self-referral,
    a missing header, or anything unparseable."""
    if not isinstance(raw, str) or not raw:
        return None, None
    try:
        parts = urlsplit(raw.strip())
    except ValueError:
        return None, None
    host = (parts.hostname or '').lower()
    if not host or host == _originHost() or host in _configuredHosts():
        return None, None
    if host.startswith('www.'):
        host = host[4:]
    return host[:255], normalizePath(parts.path, fallback='/')


def _cdnCountry():
    """Only a CDN can answer this honestly. Direct API traffic reaches Railway
    with no geo header at all, so most rows are NULL and the console says so
    rather than inventing a country from the IP."""
    for header in ('X-Vercel-IP-Country', 'CF-IPCountry', 'X-Country-Code'):
        value = (request.headers.get(header) or '').strip().upper()
        if len(value) == 2 and value.isalpha() and value != 'XX':
            return value
    return None


def visitorHash(site, ip, userAgent, now=None):
    """Daily-rotating visitor id, scoped to the origin.

    `site` is in the digest on purpose: the same person on the portfolio and on
    the apps launcher is two visitors, because those are two different products
    and joining them would be exactly the cross-site tracking this scheme
    exists to avoid.
    """
    raw = f'{dailySalt(now)}|{site}|{ip}|{userAgent or ""}'
    return hashlib.sha256(raw.encode('utf-8', 'replace')).hexdigest()


def requestContext(pagePath=None, referrer=None, timezone=None):
    """Everything a visit row needs, derived from the live request."""
    relay = trustedRelay()
    userAgent = request.headers.get('User-Agent', '')
    identity, identitySource = resolveIdentity(relay)
    path = normalizePath(pagePath or request.args.get('_p'))
    site = resolveSite(relay, path)
    referrerHost, referrerPath = parseReferrer(
        referrer if referrer is not None else request.headers.get('Referer')
    )
    return {
        'visitorHash': visitorHash(site, clientIp(relay), userAgent),
        'site': site,
        'identity': identity,
        'identitySource': identitySource,
        'entryPath': path,
        'referrerHost': referrerHost,
        'referrerPath': referrerPath,
        'country': _cdnCountry(),
        'timezone': (timezone or None),
        **classify(userAgent),
    }


# ── The server-observed tier ────────────────────────────────────────────────

def classifyServerHit(path, method, statusCode):
    """`('view', None)` | `('event', name)` | `None` for one served request.

    This is the unblockable tier: it reads traffic the site needs in order to
    work, so there is nothing for a blocker to remove.
    """
    if statusCode >= 400:
        return None

    # The one measured write: a contact form that actually reached the inbox.
    if method == 'POST':
        return ('event', 'contact.sent') if path.rstrip('/') == '/api/contact' else None
    if method != 'GET':
        return None

    for prefix, name in SERVER_EVENT_RULES:
        if path.startswith(prefix):
            return ('event', name) if name else None

    if path.endswith('/deep-dive'):
        return ('event', 'deep_dive.read')

    if path.startswith(IGNORED_PREFIXES):
        return None

    for prefix in SERVER_VIEW_PATHS:
        if path == prefix or path.startswith(prefix + '/'):
            return ('view', None)
    return None


def recordServerHit(response):
    """`after_request` hook. Never raises and never alters the response.

    One advisory lock, one transaction, one commit — this runs on the critical
    path of every content API call, and a page's four parallel boot fetches
    would otherwise serialize on the lock twice over.

    The commit is on the *request-scoped* session, which couples this hook to
    every content route: none may return 2xx with writes still pending, or
    this would commit them. A dedicated short-lived session would decouple it,
    at the cost of a second connection from the shared pool on every content
    request; no route leaves pending writes today, so the coupling is
    documented rather than engineered away.

    A measurement failure must not become a 500 on a content endpoint, so every
    path out of here is swallowed. Logged without a stack trace: a hostile
    header must not be a way to write tracebacks into the log sink.
    """
    if not isEnabled():
        return response
    try:
        from app import db

        verdict = classifyServerHit(request.path, request.method, response.status_code)
        if not verdict:
            return response

        from app.dao.analytics_dao import AnalyticsDAO

        dao = AnalyticsDAO(db.session)
        context = requestContext()
        # The admin console is the tool, not the site: `apiClient` tags its own
        # reads with `_p=/admin/...` like any other page, and counting those
        # would file the owner's tooling as traffic.
        if (context['entryPath'] or '').startswith('/admin'):
            return response
        visit = dao.resolveSession(context)
        kind, name = verdict
        if kind == 'view':
            dao.recordPageView(visit, context['entryPath'], source='server',
                               dedupeSeconds=SERVER_VIEW_DEDUPE_SECONDS)
        else:
            dao.recordEvent(visit, name, context['entryPath'])
        db.session.commit()
    except Exception as e:
        from app import db
        db.session.rollback()
        logger.warning('analytics: server hit not recorded (%s)', e)
    return response
