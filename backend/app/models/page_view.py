from app import db
from datetime import datetime


class PageView(db.Model):
    """One page of one visit.

    `source` records how it was observed, which is the whole point of the
    design: `server` views are inferred from API calls the page cannot render
    without, so a content blocker cannot remove them; `beacon` views come from
    the engagement-gated client and are the only ones that can carry
    `durationMs`/`scrollPct`. A path seen by both is one row, upgraded in place.
    """
    __tablename__ = 'page_views'

    id = db.Column(db.Integer, primary_key=True)
    sessionId = db.Column('session_id', db.Integer,
                          db.ForeignKey('visit_sessions.id', ondelete='CASCADE'), nullable=False)
    path = db.Column(db.String(500), nullable=False)
    source = db.Column(db.String(10), nullable=False, default='server')
    durationMs = db.Column('duration_ms', db.Integer, nullable=True)
    scrollPct = db.Column('scroll_pct', db.Integer, nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        # Serves both the dedupe lookup on write and every per-path aggregate.
        # There is deliberately no index on `created_at` alone: nothing filters
        # or orders by it, and the retention purge cascades through the FK,
        # whose leading column this already is.
        db.Index('ix_page_views_session_path', 'session_id', 'path'),
    )

    def __repr__(self):
        return f'<PageView {self.path} ({self.source})>'
