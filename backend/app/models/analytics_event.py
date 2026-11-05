from sqlalchemy.dialects.postgresql import JSONB

from app import db
from datetime import datetime


class AnalyticsEvent(db.Model):
    """A named thing that happened during a visit.

    Server-observed names (`resume.open`, `deep_dive.read`, `contact.sent`) are
    facts the backend served and are unblockable; client names (`field.algo`,
    `apps.open`, `terminal.command`) describe interaction the server cannot see.
    `props` is deliberately a free-form JSON blob — the questions worth asking
    about the field or the terminal are not known in advance, and a column per
    question would need a migration each time.
    """
    __tablename__ = 'analytics_events'

    id = db.Column(db.Integer, primary_key=True)
    sessionId = db.Column('session_id', db.Integer,
                          db.ForeignKey('visit_sessions.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(60), nullable=False)
    path = db.Column(db.String(500), nullable=True)
    # JSONB, not JSON: Postgres has no equality operator for `json`, so the
    # console's `GROUP BY props->>'slug'` would be a runtime error.
    props = db.Column(JSONB, nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_analytics_events_name_created', 'name', 'created_at'),
        db.Index('ix_analytics_events_session', 'session_id'),
    )

    def __repr__(self):
        return f'<AnalyticsEvent {self.name}>'
