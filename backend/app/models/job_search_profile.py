from app import db
from datetime import datetime

PROFILE_ID = 1


class JobSearchProfile(db.Model):
    """Singleton (id=1): the interests entered in the Run-agent modal, kept as
    the default for the next run. Each run snapshots its own copy."""
    __tablename__ = 'job_search_profiles'

    id = db.Column(db.Integer, primary_key=True)
    interests = db.Column(db.Text, nullable=False, default='')
    minScore = db.Column('min_score', db.Integer, nullable=False, default=60)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        return {
            'interests': self.interests or '',
            'min_score': self.minScore,
            'updated_at': self.updatedAt.isoformat() if self.updatedAt else None,
        }

    def __repr__(self):
        return f'<JobSearchProfile minScore={self.minScore}>'
