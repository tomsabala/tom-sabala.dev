from app import db
from datetime import datetime


class Company(db.Model):
    __tablename__ = 'companies'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    url = db.Column(db.String(500), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    categories = db.Column(db.JSON, nullable=True, default=list)
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
            'created_at': self.createdAt.isoformat() if self.createdAt else None,
            'updated_at': self.updatedAt.isoformat() if self.updatedAt else None,
        }

    def __repr__(self):
        return f'<Company {self.name}>'
