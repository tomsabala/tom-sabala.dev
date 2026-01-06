"""
Resume PDF Version Model - Stores PDF resume files with version history
"""
from app import db
from datetime import datetime


class ResumePdfVersion(db.Model):
    """Model for resume PDF versions with soft delete and version control"""
    __tablename__ = 'resume_pdf_versions'

    id = db.Column(db.Integer, primary_key=True)
    fileName = db.Column('file_name', db.String(255), nullable=False)
    filePath = db.Column('file_path', db.String(500), nullable=False)
    fileSize = db.Column('file_size', db.Integer, nullable=False)
    mimeType = db.Column('mime_type', db.String(50), nullable=False, default='application/pdf')
    isActive = db.Column('is_active', db.Boolean, nullable=False, default=False)
    uploadedByUserId = db.Column('uploaded_by_user_id', db.Integer, db.ForeignKey('admin_users.id'), nullable=True)
    createdAt = db.Column('created_at', db.DateTime, nullable=False, default=datetime.utcnow)
    deletedAt = db.Column('deleted_at', db.DateTime, nullable=True)

    # Relationship to User model
    uploadedBy = db.relationship('User', backref='uploadedResumes', lazy=True)

    def toDict(self):
        """Convert model to dictionary for JSON response"""
        return {
            'id': self.id,
            'fileName': self.fileName,
            'filePath': self.filePath,
            'fileSize': self.fileSize,
            'mimeType': self.mimeType,
            'isActive': self.isActive,
            'uploadedBy': {
                'id': self.uploadedBy.id,
                'username': self.uploadedBy.username,
                'email': self.uploadedBy.email
            } if self.uploadedBy else None,
            'createdAt': self.createdAt.isoformat() if self.createdAt else None,
            'deletedAt': self.deletedAt.isoformat() if self.deletedAt else None
        }

    def __repr__(self):
        return f'<ResumePdfVersion {self.id} - {self.fileName}>'
