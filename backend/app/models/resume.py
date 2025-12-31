from app import db
from datetime import datetime


class Resume(db.Model):
    __tablename__ = 'resume'

    id = db.Column(db.Integer, primary_key=True)
    personalInfo = db.Column('personal_info', db.JSON, nullable=False)
    experience = db.Column(db.JSON, nullable=False, default=list)
    education = db.Column(db.JSON, nullable=False, default=list)
    skills = db.Column(db.JSON, nullable=False, default=dict)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'personalInfo': self.personalInfo,
            'experience': self.experience,
            'education': self.education,
            'skills': self.skills,
            'updatedAt': self.updatedAt.isoformat() if self.updatedAt else None
        }

    def __repr__(self):
        return f'<Resume {self.id}>'
