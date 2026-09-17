from app import db

RESULT_STATUSES = ['ok', 'skipped', 'error']


class AgentRunCompanyResult(db.Model):
    """Per-company outcome of one sweep, so a broken board stays visible."""
    __tablename__ = 'agent_run_company_results'

    id = db.Column(db.Integer, primary_key=True)
    runId = db.Column('run_id', db.Integer, db.ForeignKey('agent_runs.id', ondelete='CASCADE'), nullable=False)
    companyId = db.Column('company_id', db.Integer, db.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(20), nullable=False)
    source = db.Column(db.String(50), nullable=True)
    postingsFound = db.Column('postings_found', db.Integer, nullable=False, default=0)
    error = db.Column(db.Text, nullable=True)
    durationMs = db.Column('duration_ms', db.Integer, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('run_id', 'company_id', name='uq_agent_run_company'),
    )

    def toDict(self):
        return {
            'id': self.id,
            'run_id': self.runId,
            'company_id': self.companyId,
            'status': self.status,
            'source': self.source,
            'postings_found': self.postingsFound,
            'error': self.error,
            'duration_ms': self.durationMs,
        }

    def __repr__(self):
        return f'<AgentRunCompanyResult run={self.runId} company={self.companyId} {self.status}>'
