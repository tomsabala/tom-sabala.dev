from app import db
from datetime import datetime


class ContactSubmission(db.Model):
    __tablename__ = 'contact_submissions'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    submittedAt = db.Column('submitted_at', db.DateTime, nullable=False, default=datetime.utcnow)
    ipAddress = db.Column('ip_address', db.String(50), nullable=True)
    read = db.Column(db.Boolean, default=False, nullable=False)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'message': self.message,
            'submittedAt': self.submittedAt.isoformat() if self.submittedAt else None,
            'ipAddress': self.ipAddress,
            'read': self.read
        }

    def __repr__(self):
        return f'<ContactSubmission from {self.name}>'
