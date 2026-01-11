"""
Storage Factory - Automatically select storage backend based on environment
"""
import os
from app.services.file_storage_service import FileStorageService
from app.services.s3_storage_service import S3StorageService


def getStorageService():
    """
    Get the appropriate storage service based on environment configuration

    Returns:
        FileStorageService or S3StorageService: Storage service class

    Usage:
        StorageService = getStorageService()
        StorageService.saveFile(file)
    """
    storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()

    if storageBackend == 's3':
        # Verify S3 configuration is present
        if not all([
            os.getenv('AWS_ACCESS_KEY_ID'),
            os.getenv('AWS_SECRET_ACCESS_KEY'),
            os.getenv('AWS_S3_BUCKET')
        ]):
            raise Exception(
                "S3 storage backend selected but missing configuration. "
                "Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET environment variables."
            )
        return S3StorageService

    # Default to local storage
    return FileStorageService
