"""
About routes - public viewing and admin update operations
"""
import os
import sys
from flask import Blueprint, request, jsonify, send_file, Response
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from app.dao.about_dao import AboutDAO
from app.services.storage_factory import getStorageService

about_bp = Blueprint('about', __name__)

# Get storage service (local or S3 based on environment)
StorageService = getStorageService()


@about_bp.route('/about', methods=['GET'])
def getAbout():
    """
    Get about content (public endpoint)

    Returns:
        200: About data
        500: Server error
    """
    try:
        about = AboutDAO.getAbout()

        if not about:
            return jsonify({
                'success': True,
                'data': {
                    'id': None,
                    'content': '',
                    'profilePhotoUrl': None,
                    'updatedAt': None
                }
            }), 200

        return jsonify({
            'success': True,
            'data': about.toDict()
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@about_bp.route('/about', methods=['PUT'])
@jwt_required()
def updateAbout():
    """
    Update about content (admin only)

    Requires: Valid JWT access token

    Request body:
        {
            "content": "Plain text about content",
            "profilePhotoUrl": "/api/about/profile-photo/filename.jpg"
        }

    Returns:
        200: About updated successfully
        400: No data provided
        500: Server error
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    try:
        currentPhotoUrl = AboutDAO.getProfilePhotoUrl()
        newPhotoUrl = data.get('profilePhotoUrl')

        # If profile photo is being changed/removed, delete the old one
        if currentPhotoUrl and newPhotoUrl != currentPhotoUrl:
            _deleteProfilePhotoFromStorage(currentPhotoUrl)

        about = AboutDAO.updateAbout(
            content=data.get('content'),
            profilePhotoUrl=newPhotoUrl
        )

        return jsonify({
            'success': True,
            'data': about.toDict()
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@about_bp.route('/about/upload-profile-photo', methods=['POST'])
@jwt_required()
def uploadProfilePhoto():
    """
    Upload profile photo (admin only)

    Requires: Valid JWT access token

    Request: multipart/form-data with 'file' field

    Returns:
        200: Photo uploaded successfully
        400: No file provided or validation failed
        500: Server error
    """
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400

        file = request.files['file']

        isValid, error = StorageService.validateImage(file)
        if not isValid:
            return jsonify({'success': False, 'error': error}), 400

        originalFilename, storagePath, fileSize = StorageService.saveProfilePhoto(file)

        filename = os.path.basename(storagePath)
        profilePhotoUrl = f'/api/about/profile-photo/{filename}'

        return jsonify({
            'success': True,
            'data': {
                'profilePhotoUrl': profilePhotoUrl,
                'fileName': originalFilename,
                'fileSize': fileSize
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@about_bp.route('/about/profile-photo/<filename>', methods=['GET'])
def serveProfilePhoto(filename):
    """
    Serve profile photo (public endpoint)
    Handles both local storage and S3 backend
    """
    try:
        filename = secure_filename(filename)
        storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()

        if storageBackend == 's3':
            import requests

            s3Key = f"profile/{filename}"
            presignedUrl = StorageService.getFilePath(s3Key)

            s3Response = requests.get(presignedUrl, stream=True)

            if s3Response.status_code != 200:
                return jsonify({'success': False, 'error': 'Image not found'}), 404

            ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'jpeg'
            contentTypeMap = {
                'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif'
            }
            contentType = contentTypeMap.get(ext, 'image/jpeg')

            return Response(
                s3Response.iter_content(chunk_size=8192),
                content_type=contentType,
                headers={'Cache-Control': 'public, max-age=31536000'}
            )
        else:
            relativePath = f"uploads/profile/{filename}"
            filePath = StorageService.getFilePath(relativePath)

            if not os.path.exists(filePath):
                return jsonify({'success': False, 'error': 'Image not found'}), 404

            return send_file(filePath)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _deleteProfilePhotoFromStorage(photoUrl):
    """
    Helper to delete profile photo from storage
    Handles both local and S3 backends
    """
    try:
        if not photoUrl:
            return

        filename = photoUrl.split('/')[-1]
        storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()

        if storageBackend == 's3':
            s3Key = f"profile/{filename}"
            StorageService.deleteFile(s3Key)
        else:
            relativePath = f"uploads/profile/{filename}"
            StorageService.deleteFile(relativePath)
    except Exception as e:
        print(f"Warning: Failed to delete profile photo {photoUrl}: {str(e)}", file=sys.stderr)
