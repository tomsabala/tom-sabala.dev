from app import db
from datetime import datetime

VALID_STATUSES = [
    'bookmarked', 'applied', 'in_review', 'interview',
    'offer', 'rejected', 'withdrawn', 'closed'
]


class JobApplication(db.Model):
    __tablename__ = 'job_applications'

    id = db.Column(db.Integer, primary_key=True)
    companyId = db.Column('company_id', db.Integer, db.ForeignKey('companies.id'), nullable=True)
    companyName = db.Column('company_name', db.String(200), nullable=False)
    position = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(50), nullable=False, default='bookmarked')
    jobUrl = db.Column('job_url', db.String(500), nullable=True)
    dateApplied = db.Column('date_applied', db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        return {
            'id': self.id,
            'company_id': self.companyId,
            'company_name': self.companyName,
            'position': self.position,
            'status': self.status,
            'job_url': self.jobUrl,
            'date_applied': self.dateApplied.isoformat() if self.dateApplied else None,
            'notes': self.notes,
            'created_at': self.createdAt.isoformat() if self.createdAt else None,
            'updated_at': self.updatedAt.isoformat() if self.updatedAt else None,
        }

    def __repr__(self):
        return f'<JobApplication {self.position} @ {self.companyName}>'
