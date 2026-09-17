from app import db
from datetime import datetime

RUN_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled']
TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled']


class AgentRun(db.Model):
    """One on-demand sweep across every tracked company."""
    __tablename__ = 'agent_runs'

    id = db.Column(db.Integer, primary_key=True)
    status = db.Column(db.String(20), nullable=False, default='queued')
    # True while queued/running, NULL when terminal. A unique index on this
    # column is the single-active-run guard (NULLs are distinct in Postgres).
    activeLock = db.Column('active_lock', db.Boolean, nullable=True)
    queueJobId = db.Column('queue_job_id', db.String(64), nullable=True)
    createdBy = db.Column('created_by', db.String(255), nullable=True)
    interestsSnapshot = db.Column('interests_snapshot', db.Text, nullable=False)
    minScore = db.Column('min_score', db.Integer, nullable=False, default=60)
    model = db.Column(db.String(100), nullable=True)
    companiesTotal = db.Column('companies_total', db.Integer, nullable=False, default=0)
    companiesProcessed = db.Column('companies_processed', db.Integer, nullable=False, default=0)
    companiesFailed = db.Column('companies_failed', db.Integer, nullable=False, default=0)
    postingsSeen = db.Column('postings_seen', db.Integer, nullable=False, default=0)
    postingsNew = db.Column('postings_new', db.Integer, nullable=False, default=0)
    postingsRejected = db.Column('postings_rejected', db.Integer, nullable=False, default=0)
    postingsAppliedSkipped = db.Column('postings_applied_skipped', db.Integer, nullable=False, default=0)
    findingsCount = db.Column('findings_count', db.Integer, nullable=False, default=0)
    inputTokens = db.Column('input_tokens', db.Integer, nullable=False, default=0)
    outputTokens = db.Column('output_tokens', db.Integer, nullable=False, default=0)
    error = db.Column(db.Text, nullable=True)
    startedAt = db.Column('started_at', db.DateTime, nullable=True)
    finishedAt = db.Column('finished_at', db.DateTime, nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        db.Index('uq_agent_runs_active', 'active_lock', unique=True),
    )

    @property
    def durationSeconds(self):
        if not self.startedAt:
            return None
        end = self.finishedAt or datetime.utcnow()
        return int((end - self.startedAt).total_seconds())

    def toDict(self):
        return {
            'id': self.id,
            'status': self.status,
            'queue_job_id': self.queueJobId,
            'created_by': self.createdBy,
            'interests_snapshot': self.interestsSnapshot,
            'min_score': self.minScore,
            'model': self.model,
            'companies_total': self.companiesTotal,
            'companies_processed': self.companiesProcessed,
            'companies_failed': self.companiesFailed,
            'postings_seen': self.postingsSeen,
            'postings_new': self.postingsNew,
            'postings_rejected': self.postingsRejected,
            'postings_applied_skipped': self.postingsAppliedSkipped,
            'findings_count': self.findingsCount,
            'input_tokens': self.inputTokens,
            'output_tokens': self.outputTokens,
            'error': self.error,
            'started_at': self.startedAt.isoformat() if self.startedAt else None,
            'finished_at': self.finishedAt.isoformat() if self.finishedAt else None,
            'created_at': self.createdAt.isoformat() if self.createdAt else None,
            'duration_seconds': self.durationSeconds,
        }

    def __repr__(self):
        return f'<AgentRun {self.id} {self.status}>'
