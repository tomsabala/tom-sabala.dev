from app import db
from datetime import datetime


class Company(db.Model):
    __tablename__ = 'companies'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    url = db.Column(db.String(500), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    categories = db.Column(db.JSON, nullable=True, default=list)
    # Board configuration: stored once by discovery so later runs skip browsing.
    careersUrl = db.Column('careers_url', db.String(500), nullable=True)
    atsProvider = db.Column('ats_provider', db.String(50), nullable=True)
    atsToken = db.Column('ats_token', db.String(200), nullable=True)
    boardDetectedAt = db.Column('board_detected_at', db.DateTime, nullable=True)
    lastSyncedAt = db.Column('last_synced_at', db.DateTime, nullable=True)
    syncError = db.Column('sync_error', db.Text, nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    jobApplications = db.relationship('JobApplication', backref='company', lazy=True)

    def toDict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'notes': self.notes,
            'categories': self.categories or [],
            'careers_url': self.careersUrl,
            'ats_provider': self.atsProvider,
            'ats_token': self.atsToken,
            'board_detected_at': self.boardDetectedAt.isoformat() if self.boardDetectedAt else None,
            'last_synced_at': self.lastSyncedAt.isoformat() if self.lastSyncedAt else None,
            'sync_error': self.syncError,
            'created_at': self.createdAt.isoformat() if self.createdAt else None,
            'updated_at': self.updatedAt.isoformat() if self.updatedAt else None,
        }

    def __repr__(self):
        return f'<Company {self.name}>'
