"""
File Storage Service - Local disk file storage operations
"""
import os
import uuid
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
from app.services.storage_utils import validateFile as _validateFile, validateImage as _validateImage


class FileStorageService:
    """File storage service for local disk"""

    UPLOAD_DIR = os.getenv('UPLOAD_DIR', 'uploads')
    RESUMES_SUBDIR = 'resumes'
    PROJECTS_SUBDIR = 'projects'
    PROFILE_SUBDIR = 'profile'

    @classmethod
    def _getUploadDir(cls, subdir):
        """Get absolute path to upload subdirectory, create if doesn't exist"""
        baseDir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        uploadDir = os.path.join(baseDir, cls.UPLOAD_DIR, subdir)
        os.makedirs(uploadDir, exist_ok=True)
        return uploadDir

    @classmethod
    def _saveToDir(cls, file, subdir, errorMsg="Failed to save file"):
        """
        Save file to specified subdirectory

        Args:
            file: Werkzeug FileStorage object
            subdir: Subdirectory name
            errorMsg: Error message prefix

        Returns:
            tuple: (original_filename, relative_path, file_size)
        """
        try:
            originalFilename = secure_filename(file.filename)
            uniqueId = uuid.uuid4().hex[:12]
            filename = f"{uniqueId}_{originalFilename}"

            uploadDir = cls._getUploadDir(subdir)
            absolutePath = os.path.join(uploadDir, filename)

            file.save(absolutePath)
            fileSize = os.path.getsize(absolutePath)
            relativePath = os.path.join(cls.UPLOAD_DIR, subdir, filename)

            return originalFilename, relativePath, fileSize
        except Exception as e:
            raise Exception(f"{errorMsg}: {str(e)}")

    @classmethod
    def validateFile(cls, file: FileStorage):
        """Validate uploaded file"""
        return _validateFile(file)

    @classmethod
    def validateImage(cls, file: FileStorage):
        """Validate uploaded image file"""
        return _validateImage(file)

    @classmethod
    def saveFile(cls, file: FileStorage):
        """Save uploaded file (PDF) to local storage"""
        return cls._saveToDir(file, cls.RESUMES_SUBDIR, "Failed to save file")

    @classmethod
    def saveProjectImage(cls, file: FileStorage):
        """Save uploaded project image to local storage"""
        return cls._saveToDir(file, cls.PROJECTS_SUBDIR, "Failed to save image")

    @classmethod
    def saveProfilePhoto(cls, file: FileStorage):
        """Save uploaded profile photo to local storage"""
        return cls._saveToDir(file, cls.PROFILE_SUBDIR, "Failed to save profile photo")

    @classmethod
    def getFilePath(cls, relativePath):
        """Convert relative path to absolute path for serving files"""
        baseDir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        return os.path.join(baseDir, relativePath)

    @classmethod
    def deleteFile(cls, relativePath):
        """Delete file from storage. Returns True if deleted, False if not found."""
        try:
            absolutePath = cls.getFilePath(relativePath)
            if os.path.exists(absolutePath):
                os.remove(absolutePath)
                return True
            return False
        except Exception as e:
            print(f"Warning: Failed to delete file {relativePath}: {str(e)}")
            return False

    @classmethod
    def fileExists(cls, relativePath):
        """Check if file exists in storage"""
        absolutePath = cls.getFilePath(relativePath)
        return os.path.exists(absolutePath)
