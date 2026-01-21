"""
Storage Factory - Automatically select storage backend based on environment
"""
import os
from app.services.file_storage_service import FileStorageService
from app.services.s3_storage_service import S3StorageService

# Cache storage backend at module load to avoid repeated env lookups
_cachedStorageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()
_cachedStorageService = None


def getStorageService():
    """
    Get the appropriate storage service based on environment configuration.
    Uses caching to avoid repeated environment variable lookups.

    Returns:
        FileStorageService or S3StorageService: Storage service class

    Usage:
        StorageService = getStorageService()
        StorageService.saveFile(file)
    """
    global _cachedStorageService

    if _cachedStorageService is not None:
        return _cachedStorageService

    if _cachedStorageBackend == 's3':
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
        _cachedStorageService = S3StorageService
    else:
        # Default to local storage
        _cachedStorageService = FileStorageService

    return _cachedStorageService
