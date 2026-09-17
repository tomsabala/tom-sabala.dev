from app import db
from datetime import datetime


class JobPosting(db.Model):
    """One position seen on a company's job board.

    Rows are never deleted: `closedAt` records that the board stopped listing
    it, and `firstSeenAt` is what makes "is this new?" a fact rather than a
    model opinion.
    """
    __tablename__ = 'job_postings'

    id = db.Column(db.Integer, primary_key=True)
    companyId = db.Column('company_id', db.Integer, db.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False)
    source = db.Column(db.String(50), nullable=False)
    externalId = db.Column('external_id', db.String(200), nullable=False)
    title = db.Column(db.String(300), nullable=False)
    url = db.Column(db.String(1000), nullable=False)
    location = db.Column(db.String(300), nullable=True)
    department = db.Column(db.String(200), nullable=True)
    isRemote = db.Column('is_remote', db.Boolean, nullable=True)
    description = db.Column(db.Text, nullable=True)
    contentHash = db.Column('content_hash', db.String(64), nullable=False)
    postedAt = db.Column('posted_at', db.DateTime, nullable=True)
    firstSeenAt = db.Column('first_seen_at', db.DateTime, nullable=False, default=datetime.utcnow)
    lastSeenAt = db.Column('last_seen_at', db.DateTime, nullable=False, default=datetime.utcnow)
    closedAt = db.Column('closed_at', db.DateTime, nullable=True)
    dismissedAt = db.Column('dismissed_at', db.DateTime, nullable=True)
    lastScoredHash = db.Column('last_scored_hash', db.String(64), nullable=True)
    lastScore = db.Column('last_score', db.Integer, nullable=True)
    lastVerdict = db.Column('last_verdict', db.String(20), nullable=True)
    lastReason = db.Column('last_reason', db.Text, nullable=True)

    __table_args__ = (
        db.UniqueConstraint('company_id', 'external_id', name='uq_job_postings_company_external'),
        db.Index('ix_job_postings_company_open', 'company_id', 'closed_at'),
    )

    def toDict(self):
        return {
            'id': self.id,
            'company_id': self.companyId,
            'source': self.source,
            'external_id': self.externalId,
            'title': self.title,
            'url': self.url,
            'location': self.location,
            'department': self.department,
            'is_remote': self.isRemote,
            'posted_at': self.postedAt.isoformat() if self.postedAt else None,
            'first_seen_at': self.firstSeenAt.isoformat() if self.firstSeenAt else None,
            'last_seen_at': self.lastSeenAt.isoformat() if self.lastSeenAt else None,
            'closed_at': self.closedAt.isoformat() if self.closedAt else None,
            'dismissed_at': self.dismissedAt.isoformat() if self.dismissedAt else None,
            'last_score': self.lastScore,
            'last_verdict': self.lastVerdict,
            'last_reason': self.lastReason,
        }

    def __repr__(self):
        return f'<JobPosting {self.title} ({self.source}:{self.externalId})>'
