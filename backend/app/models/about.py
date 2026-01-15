from app import db
from datetime import datetime


class About(db.Model):
    __tablename__ = 'about_me'

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    profilePhotoUrl = db.Column('profile_photo_url', db.String(500), nullable=True)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'content': self.content,
            'profilePhotoUrl': self.profilePhotoUrl,
            'updatedAt': self.updatedAt.isoformat() if self.updatedAt else None
        }

    def __repr__(self):
        return f'<About {self.id}>'
