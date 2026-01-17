"""
Shared storage validation utilities
Used by both FileStorageService and S3StorageService
"""
import os

MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', '10')) * 1024 * 1024
ALLOWED_EXTENSIONS = os.getenv('ALLOWED_EXTENSIONS', 'pdf').split(',')
IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


def validateFile(file, allowedExtensions=None, maxSize=None):
    """
    Validate uploaded file

    Args:
        file: Werkzeug FileStorage object
        allowedExtensions: List of allowed extensions (defaults to ALLOWED_EXTENSIONS)
        maxSize: Maximum file size in bytes (defaults to MAX_FILE_SIZE)

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    if allowedExtensions is None:
        allowedExtensions = ALLOWED_EXTENSIONS
    if maxSize is None:
        maxSize = MAX_FILE_SIZE

    if not file or file.filename == '':
        return False, 'No file provided'

    if '.' not in file.filename:
        return False, 'File must have an extension'

    ext = file.filename.rsplit('.', 1)[1].lower()
    if ext not in allowedExtensions:
        return False, f'Only {", ".join(allowedExtensions).upper()} files allowed'

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)

    if size > maxSize:
        maxMb = maxSize / (1024 * 1024)
        return False, f'File too large. Maximum size: {maxMb:.0f}MB'

    if size == 0:
        return False, 'File is empty'

    return True, None


def validateImage(file):
    """
    Validate uploaded image file

    Args:
        file: Werkzeug FileStorage object

    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    return validateFile(file, allowedExtensions=IMAGE_EXTENSIONS, maxSize=MAX_IMAGE_SIZE)


def getContentType(filename):
    """
    Get MIME content type from filename extension

    Args:
        filename: File name with extension

    Returns:
        str: MIME content type
    """
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpeg'
    contentTypeMap = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif',
        'pdf': 'application/pdf'
    }
    return contentTypeMap.get(ext, 'application/octet-stream')
