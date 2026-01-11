"""
S3 Cloud Storage Service - AWS S3 file storage implementation
Drop-in replacement for FileStorageService with same interface
"""
import os
import uuid
import boto3
from botocore.exceptions import ClientError
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage


class S3StorageService:
    """
    S3 cloud storage service for production
    Compatible interface with FileStorageService for easy switching
    """

    # S3 Configuration from environment variables
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET')
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

    # File settings
    RESUMES_PREFIX = 'resumes/'
    PROJECTS_PREFIX = 'projects/'
    MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', '10')) * 1024 * 1024
    ALLOWED_EXTENSIONS = os.getenv('ALLOWED_EXTENSIONS', 'pdf').split(',')
    IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
    MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB

    @classmethod
    def _getS3Client(cls):
        """Get configured S3 client"""
        if not all([cls.AWS_ACCESS_KEY_ID, cls.AWS_SECRET_ACCESS_KEY, cls.AWS_S3_BUCKET]):
            raise Exception("S3 configuration missing. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET environment variables.")

        return boto3.client(
            's3',
            aws_access_key_id=cls.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=cls.AWS_SECRET_ACCESS_KEY,
            region_name=cls.AWS_REGION
        )

    @classmethod
    def validateFile(cls, file: FileStorage):
        """
        Validate uploaded file (same interface as FileStorageService)

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (is_valid: bool, error_message: str or None)
        """
        if not file or file.filename == '':
            return False, 'No file provided'

        if '.' not in file.filename:
            return False, 'File must have an extension'

        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            return False, f'Only {", ".join(cls.ALLOWED_EXTENSIONS).upper()} files allowed'

        # Check file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)

        if size > cls.MAX_FILE_SIZE:
            maxMb = cls.MAX_FILE_SIZE / (1024 * 1024)
            return False, f'File too large. Maximum size: {maxMb:.0f}MB'

        if size == 0:
            return False, 'File is empty'

        return True, None

    @classmethod
    def saveFile(cls, file: FileStorage):
        """
        Upload file to S3

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (original_filename: str, s3_key: str, file_size: int)

        Raises:
            Exception: If upload fails
        """
        try:
            s3 = cls._getS3Client()

            # Generate unique filename
            originalFilename = secure_filename(file.filename)
            uniqueId = uuid.uuid4().hex[:12]
            filename = f"{uniqueId}_{originalFilename}"

            # S3 key (path in bucket)
            s3Key = cls.RESUMES_PREFIX + filename

            # Get file size
            file.seek(0, os.SEEK_END)
            fileSize = file.tell()
            file.seek(0)

            # Upload to S3
            s3.upload_fileobj(
                file,
                cls.AWS_S3_BUCKET,
                s3Key,
                ExtraArgs={
                    'ContentType': 'application/pdf',
                    'ContentDisposition': f'inline; filename="{originalFilename}"'
                }
            )

            return originalFilename, s3Key, fileSize
        except ClientError as e:
            raise Exception(f"Failed to upload to S3: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to save file: {str(e)}")

    @classmethod
    def getFilePath(cls, s3Key):
        """
        Get pre-signed URL for S3 object (expires in 1 hour)
        More secure than public bucket - URLs are temporary and read-only

        Args:
            s3Key (str): S3 key (path in bucket)

        Returns:
            str: Pre-signed URL to file (valid for 1 hour)
        """
        try:
            s3 = cls._getS3Client()
            url = s3.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': cls.AWS_S3_BUCKET,
                    'Key': s3Key
                },
                ExpiresIn=3600  # 1 hour (adjust as needed)
            )
            return url
        except Exception as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

    @classmethod
    def deleteFile(cls, s3Key):
        """
        Delete file from S3

        Args:
            s3Key (str): S3 key (path in bucket)

        Returns:
            bool: True if deleted, False if not found
        """
        try:
            s3 = cls._getS3Client()
            s3.delete_object(Bucket=cls.AWS_S3_BUCKET, Key=s3Key)
            return True
        except ClientError as e:
            print(f"Warning: Failed to delete file {s3Key}: {str(e)}")
            return False
        except Exception as e:
            print(f"Warning: Failed to delete file {s3Key}: {str(e)}")
            return False

    @classmethod
    def fileExists(cls, s3Key):
        """
        Check if file exists in S3

        Args:
            s3Key (str): S3 key (path in bucket)

        Returns:
            bool: True if file exists
        """
        try:
            s3 = cls._getS3Client()
            s3.head_object(Bucket=cls.AWS_S3_BUCKET, Key=s3Key)
            return True
        except ClientError:
            return False

    # ========================================
    # PROJECT IMAGE METHODS
    # ========================================

    @classmethod
    def validateImage(cls, file: FileStorage):
        """
        Validate uploaded image file

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (is_valid: bool, error_message: str or None)
        """
        if not file or file.filename == '':
            return False, 'No file provided'

        if '.' not in file.filename:
            return False, 'File must have an extension'

        ext = file.filename.rsplit('.', 1)[1].lower()
        if ext not in cls.IMAGE_EXTENSIONS:
            return False, f'Only {", ".join(cls.IMAGE_EXTENSIONS).upper()} files allowed'

        # Check file size
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)

        if size > cls.MAX_IMAGE_SIZE:
            maxMb = cls.MAX_IMAGE_SIZE / (1024 * 1024)
            return False, f'Image too large. Maximum size: {maxMb:.0f}MB'

        if size == 0:
            return False, 'Image file is empty'

        return True, None

    @classmethod
    def saveProjectImage(cls, file: FileStorage):
        """
        Upload project image to S3

        Args:
            file: Werkzeug FileStorage object

        Returns:
            tuple: (original_filename: str, s3_key: str, file_size: int)

        Raises:
            Exception: If upload fails
        """
        try:
            s3 = cls._getS3Client()

            # Generate unique filename
            originalFilename = secure_filename(file.filename)
            uniqueId = uuid.uuid4().hex[:12]
            filename = f"{uniqueId}_{originalFilename}"

            # S3 key (path in bucket)
            s3Key = cls.PROJECTS_PREFIX + filename

            # Get file size
            file.seek(0, os.SEEK_END)
            fileSize = file.tell()
            file.seek(0)

            # Determine content type from extension
            ext = file.filename.rsplit('.', 1)[1].lower()
            contentTypeMap = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'webp': 'image/webp',
                'gif': 'image/gif'
            }
            contentType = contentTypeMap.get(ext, 'image/jpeg')

            # Upload to S3
            s3.upload_fileobj(
                file,
                cls.AWS_S3_BUCKET,
                s3Key,
                ExtraArgs={
                    'ContentType': contentType,
                    'CacheControl': 'max-age=31536000'  # Cache images for 1 year
                }
            )

            return originalFilename, s3Key, fileSize
        except ClientError as e:
            raise Exception(f"Failed to upload image to S3: {str(e)}")
        except Exception as e:
            raise Exception(f"Failed to save image: {str(e)}")
