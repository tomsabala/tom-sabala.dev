from app import db
from datetime import datetime


class VisitSession(db.Model):
    """One visit: a rotating visitor hash plus a 30-minute inactivity window.

    There is no cookie and no device storage. `visitorHash` is
    sha256(daily_salt + domain + ip + user_agent) with the salt rotated and
    discarded every 24h, so the row cannot be joined to the same person
    tomorrow, on another device, or on another site. Raw IP and User-Agent are
    never written — only the derived hash and the coarse browser/os/device
    labels below.

    `isBot` is stored rather than enforced by deleting rows: a classifier that
    silently drops traffic can never be re-evaluated, and the bot share is
    itself a number worth watching. Every aggregate filters it out by default.
    """
    __tablename__ = 'visit_sessions'

    id = db.Column(db.Integer, primary_key=True)
    visitorHash = db.Column('visitor_hash', db.String(64), nullable=False)
    # Which front door the visit came through. The three origins are separate
    # products with separate audiences — apps.tom-sabala.dev is not even served
    # by Vercel — and an aggregate that mixes them answers no useful question.
    site = db.Column(db.String(16), nullable=False, default='portfolio')
    # 'anon' | 'admin'. Admin is a dimension, not an exclusion: on the apps
    # origin it is the difference between a tmpfs instance the reaper deletes
    # and a volume-backed one, which is the single most important thing a visit
    # there can tell you. Resolved server-side only — see analytics_service.
    identity = db.Column(db.String(10), nullable=False, default='anon')
    startedAt = db.Column('started_at', db.DateTime, nullable=False, default=datetime.utcnow)
    lastSeenAt = db.Column('last_seen_at', db.DateTime, nullable=False, default=datetime.utcnow)
    pageCount = db.Column('page_count', db.Integer, nullable=False, default=0)
    eventCount = db.Column('event_count', db.Integer, nullable=False, default=0)
    entryPath = db.Column('entry_path', db.String(500), nullable=True)
    referrerHost = db.Column('referrer_host', db.String(255), nullable=True)
    referrerPath = db.Column('referrer_path', db.String(500), nullable=True)
    # No utm_* columns. They would have to come from the query string of an
    # *API* request, and neither apiClient (which appends only `_p`) nor the
    # beacon (JSON body, no query string) can carry them — three columns that
    # could never be non-NULL.
    # Only ever set from a CDN geo header (x-vercel-ip-country / cf-ipcountry).
    # Railway is the origin for direct API traffic and provides none, so this is
    # NULL for most rows and the console renders a dash rather than a guess.
    country = db.Column(db.String(2), nullable=True)
    timezone = db.Column(db.String(64), nullable=True)
    device = db.Column(db.String(20), nullable=True)
    browser = db.Column(db.String(40), nullable=True)
    os = db.Column(db.String(40), nullable=True)
    isBot = db.Column('is_bot', db.Boolean, nullable=False, default=False)
    botReason = db.Column('bot_reason', db.String(60), nullable=True)
    #: How `identity` was established: 'jwt' (portfolio cookie probe), 'gateway'
    #: (oauth2-proxy verdict relayed by the broker over a shared token), or
    #: 'none'. Stored so an admin row can never be mistaken for a client claim.
    identitySource = db.Column('identity_source', db.String(10), nullable=False, default='none')

    __table_args__ = (
        db.Index('ix_visit_sessions_visitor_seen', 'visitor_hash', 'last_seen_at'),
        # `identity` leads because the console's default query pins it to one
        # value and leaves `site` as `all`; a range column first would make the
        # other two in-scan filters.
        db.Index('ix_visit_sessions_window', 'identity', 'started_at', 'site'),
    )

    # No toDict(): the only consumer is the console's RECENT VISITS panel, and
    # AnalyticsDAO.recentVisits shapes that row so the whole endpoint speaks
    # one naming convention instead of two.

    def __repr__(self):
        return f'<VisitSession {self.site}/{self.identity} {self.visitorHash[:8]}>'
