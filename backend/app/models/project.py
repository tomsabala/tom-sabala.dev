from app import db
from datetime import datetime


class Project(db.Model):
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    technologies = db.Column(db.JSON, nullable=False, default=list)  # Store as JSON array
    githubUrl = db.Column('github_url', db.String(500), nullable=True)
    liveUrl = db.Column('live_url', db.String(500), nullable=True)
    imageUrl = db.Column('image_url', db.String(500), nullable=True)
    content = db.Column('content', db.Text, nullable=True)
    isVisible = db.Column('is_visible', db.Boolean, nullable=False, default=True)
    displayOrder = db.Column('display_order', db.Integer, nullable=False, default=0)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    updatedAt = db.Column('updated_at', db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'technologies': self.technologies,
            'github_url': self.githubUrl,
            'live_url': self.liveUrl,
            'image_url': self.imageUrl,
            'content': self.content,
            'isVisible': self.isVisible,
            'displayOrder': self.displayOrder,
            'createdAt': self.createdAt.isoformat() if self.createdAt else None,
            'updatedAt': self.updatedAt.isoformat() if self.updatedAt else None
        }

    def __repr__(self):
        return f'<Project {self.title}>'
