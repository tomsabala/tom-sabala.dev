"""
File Storage Service - Abstract file storage operations
Designed for easy migration from local disk to cloud storage (S3, Cloudinary, etc.)
"""
import os
import uuid
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage


class FileStorageService:
    """
    File storage service for local disk
    Abstracted for easy cloud migration in production
    """

    UPLOAD_DIR = os.getenv('UPLOAD_DIR', 'uploads')
    RESUMES_SUBDIR = 'resumes'
    MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', '10')) * 1024 * 1024  # Convert MB to bytes
    ALLOWED_EXTENSIONS = os.getenv('ALLOWED_EXTENSIONS', 'pdf').split(',')

    @classmethod
    def _getResumeDir(cls):
        """Get absolute path to resumes directory, create if doesn't exist"""
        # Get backend directory (parent of app directory)
        baseDir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        resumeDir = os.path.join(baseDir, cls.UPLOAD_DIR, cls.RESUMES_SUBDIR)

        # Create directory if it doesn't exist
        os.makedirs(resumeDir, exist_ok=True)

        return resumeDir

    @classmethod
    def validateFile(cls, file: FileStorage):
        """
        Validate uploaded file

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (is_valid: bool, error_message: str or None)
        """
        if not file or file.filename == '':
            return False, 'No file provided'

        # Check extension
        if '.' not in file.filename:
            return False, 'File must have an extension'

        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            return False, f'Only {", ".join(cls.ALLOWED_EXTENSIONS).upper()} files allowed'

        # Check file size (seek to end, get position, then reset)
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)  # Reset to beginning for later use

        if size > cls.MAX_FILE_SIZE:
            maxMb = cls.MAX_FILE_SIZE / (1024 * 1024)
            return False, f'File too large. Maximum size: {maxMb:.0f}MB'

        if size == 0:
            return False, 'File is empty'

        return True, None

    @classmethod
    def saveFile(cls, file: FileStorage):
        """
        Save uploaded file to local storage

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (original_filename: str, relative_path: str, file_size: int)

        Raises:
            Exception: If save fails
        """
        try:
            # Generate unique filename with UUID prefix
            originalFilename = secure_filename(file.filename)
            uniqueId = uuid.uuid4().hex[:12]
            filename = f"{uniqueId}_{originalFilename}"

            # Get absolute path
            resumeDir = cls._getResumeDir()
            absolutePath = os.path.join(resumeDir, filename)

            # Save file to disk
            file.save(absolutePath)

            # Get file size
            fileSize = os.path.getsize(absolutePath)

            # Return relative path for database storage (platform-independent)
            relativePath = os.path.join(cls.UPLOAD_DIR, cls.RESUMES_SUBDIR, filename)

            return originalFilename, relativePath, fileSize
        except Exception as e:
            raise Exception(f"Failed to save file: {str(e)}")

    @classmethod
    def getFilePath(cls, relativePath):
        """
        Convert relative path to absolute path for serving files

        Args:
            relativePath (str): Relative path from database

        Returns:
            str: Absolute file path
        """
        baseDir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
        return os.path.join(baseDir, relativePath)

    @classmethod
    def deleteFile(cls, relativePath):
        """
        Delete file from storage

        Args:
            relativePath (str): Relative path from database

        Returns:
            bool: True if deleted, False if not found
        """
        try:
            absolutePath = cls.getFilePath(relativePath)
            if os.path.exists(absolutePath):
                os.remove(absolutePath)
                return True
            return False
        except Exception as e:
            # Log error but don't fail (database record already deleted)
            print(f"Warning: Failed to delete file {relativePath}: {str(e)}")
            return False

    @classmethod
    def fileExists(cls, relativePath):
        """
        Check if file exists in storage

        Args:
            relativePath (str): Relative path from database

        Returns:
            bool: True if file exists
        """
        absolutePath = cls.getFilePath(relativePath)
        return os.path.exists(absolutePath)


# Future: CloudStorageService for production
# class CloudStorageService(FileStorageService):
#     """
#     Cloud storage service (AWS S3, Cloudinary, Google Cloud Storage, etc.)
#     Extends FileStorageService to maintain same interface
#     """
#
#     @classmethod
#     def saveFile(cls, file: FileStorage):
#         # Upload to cloud storage
#         # Return cloud URL instead of relative path
#         pass
#
#     @classmethod
#     def getFilePath(cls, relativePath):
#         # Return signed URL or public URL from cloud
#         pass
#
#     @classmethod
#     def deleteFile(cls, relativePath):
#         # Delete from cloud storage
#         pass
