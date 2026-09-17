from app import db


class AgentRunFinding(db.Model):
    """A posting this run decided is worth surfacing.

    `isNew` is computed from the posting's `firstSeenAt` against the run start,
    never from a model answer.
    """
    __tablename__ = 'agent_run_findings'

    id = db.Column(db.Integer, primary_key=True)
    runId = db.Column('run_id', db.Integer, db.ForeignKey('agent_runs.id', ondelete='CASCADE'), nullable=False)
    postingId = db.Column('posting_id', db.Integer, db.ForeignKey('job_postings.id', ondelete='CASCADE'), nullable=False)
    score = db.Column(db.Integer, nullable=True)
    verdict = db.Column(db.String(20), nullable=True)
    reason = db.Column(db.Text, nullable=True)
    isNew = db.Column('is_new', db.Boolean, nullable=False, default=False)

    __table_args__ = (
        db.UniqueConstraint('run_id', 'posting_id', name='uq_agent_run_finding'),
    )

    def toDict(self):
        return {
            'id': self.id,
            'run_id': self.runId,
            'posting_id': self.postingId,
            'score': self.score,
            'verdict': self.verdict,
            'reason': self.reason,
            'is_new': self.isNew,
        }

    def __repr__(self):
        return f'<AgentRunFinding run={self.runId} posting={self.postingId} score={self.score}>'
