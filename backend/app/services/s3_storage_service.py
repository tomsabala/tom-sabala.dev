"""
S3 Cloud Storage Service - AWS S3 file storage implementation
"""
import os
import uuid
import boto3
from botocore.exceptions import ClientError
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage
from app.services.storage_utils import validateFile as _validateFile, validateImage as _validateImage, getContentType


class S3StorageService:
    """S3 cloud storage service - compatible interface with FileStorageService"""

    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET')
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

    RESUMES_PREFIX = 'resumes/'
    PROJECTS_PREFIX = 'projects/'
    PROFILE_PREFIX = 'profile/'

    # Singleton S3 client - avoids ~50-200ms overhead of creating new client per operation
    _s3Client = None

    @classmethod
    def _getS3Client(cls):
        """Get configured S3 client (singleton pattern for performance)"""
        if cls._s3Client is None:
            if not all([cls.AWS_ACCESS_KEY_ID, cls.AWS_SECRET_ACCESS_KEY, cls.AWS_S3_BUCKET]):
                raise Exception("S3 configuration missing. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET.")
            cls._s3Client = boto3.client(
                's3',
                aws_access_key_id=cls.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=cls.AWS_SECRET_ACCESS_KEY,
                region_name=cls.AWS_REGION
            )
        return cls._s3Client

    @classmethod
    def _uploadToS3(cls, file, prefix, contentType=None, cacheControl=None, errorMsg="Failed to upload"):
        """
        Upload file to S3

        Args:
            file: Werkzeug FileStorage object
            prefix: S3 key prefix (directory)
            contentType: MIME type
            cacheControl: Cache-Control header value
            errorMsg: Error message prefix

        Returns:
            tuple: (original_filename, s3_key, file_size)
        """
        try:
            s3 = cls._getS3Client()

            originalFilename = secure_filename(file.filename)
            uniqueId = uuid.uuid4().hex[:12]
            filename = f"{uniqueId}_{originalFilename}"
            s3Key = prefix + filename

            file.seek(0, os.SEEK_END)
            fileSize = file.tell()
            file.seek(0)

            extraArgs = {'ContentType': contentType or getContentType(originalFilename)}
            if cacheControl:
                extraArgs['CacheControl'] = cacheControl

            # Add content disposition for PDFs
            if contentType == 'application/pdf':
                extraArgs['ContentDisposition'] = f'inline; filename="{originalFilename}"'

            s3.upload_fileobj(file, cls.AWS_S3_BUCKET, s3Key, ExtraArgs=extraArgs)

            return originalFilename, s3Key, fileSize
        except ClientError as e:
            raise Exception(f"{errorMsg}: {str(e)}")
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
        """Upload file (PDF) to S3"""
        return cls._uploadToS3(file, cls.RESUMES_PREFIX, contentType='application/pdf', errorMsg="Failed to upload to S3")

    @classmethod
    def saveProjectImage(cls, file: FileStorage):
        """Upload project image to S3"""
        return cls._uploadToS3(
            file, cls.PROJECTS_PREFIX,
            cacheControl='max-age=31536000',
            errorMsg="Failed to upload image to S3"
        )

    @classmethod
    def saveProfilePhoto(cls, file: FileStorage):
        """Upload profile photo to S3"""
        return cls._uploadToS3(
            file, cls.PROFILE_PREFIX,
            cacheControl='max-age=31536000',
            errorMsg="Failed to upload profile photo to S3"
        )

    @classmethod
    def getFilePath(cls, s3Key):
        """Get pre-signed URL for S3 object (expires in 1 hour)"""
        try:
            s3 = cls._getS3Client()
            return s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': cls.AWS_S3_BUCKET, 'Key': s3Key},
                ExpiresIn=3600
            )
        except Exception as e:
            raise Exception(f"Failed to generate presigned URL: {str(e)}")

    @classmethod
    def deleteFile(cls, s3Key):
        """Delete file from S3. Returns True if deleted, False on error."""
        try:
            s3 = cls._getS3Client()
            s3.delete_object(Bucket=cls.AWS_S3_BUCKET, Key=s3Key)
            return True
        except Exception as e:
            print(f"Warning: Failed to delete file {s3Key}: {str(e)}")
            return False

    @classmethod
    def fileExists(cls, s3Key):
        """Check if file exists in S3"""
        try:
            s3 = cls._getS3Client()
            s3.head_object(Bucket=cls.AWS_S3_BUCKET, Key=s3Key)
            return True
        except ClientError:
            return False
