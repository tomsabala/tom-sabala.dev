"""
Portfolio routes - public viewing and admin CRUD operations
"""
import os
import traceback
import sys
from flask import Blueprint, request, jsonify, send_file, Response
from flask_jwt_extended import jwt_required, verify_jwt_in_request
from werkzeug.utils import secure_filename
from app.dao import ProjectDAO
from app.services.storage_factory import getStorageService

portfolio_bp = Blueprint('portfolio', __name__)


@portfolio_bp.route('/portfolio', methods=['GET'])
def getPortfolio():
    """
    Get portfolio projects

    Query params:
        includeHidden (bool): If true, returns all projects (requires JWT)

    Returns:
        200: List of projects (visible only or all if authenticated)
        500: Server error
    """
    try:
        includeHidden = request.args.get('includeHidden', 'false').lower() == 'true'

        if includeHidden:
            # Try to verify JWT - if valid, return all; if not, return only visible
            try:
                verify_jwt_in_request()
                projects = ProjectDAO.getAllProjects(includeHidden=True)
            except:
                # No valid JWT - return only visible
                projects = ProjectDAO.getVisibleProjects()
        else:
            # Public view - only visible projects
            projects = ProjectDAO.getVisibleProjects()

        portfolioItems = [project.toDict() for project in projects]

        return jsonify({
            'success': True,
            'data': portfolioItems
        }), 200
    except Exception as e:
        # Print full traceback to stderr for Render logs
        print("ERROR in /portfolio GET:", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@portfolio_bp.route('/portfolio', methods=['POST'])
@jwt_required()
def createProject():
    """
    Create a new portfolio project (admin only)

    Requires: Valid JWT access token

    Request body:
        {
            "title": "Project Title",
            "description": "Project description",
            "technologies": ["Tech1", "Tech2"],
            "githubUrl": "https://github.com/...",  # optional
            "liveUrl": "https://...",  # optional
            "imageUrl": "https://..."  # optional
        }

    Returns:
        201: Project created successfully
        400: Missing required fields
        500: Server error
    """
    data = request.get_json()
    required = ['title', 'description', 'technologies']
    if not all(f in data for f in required):
        return jsonify({'success': False, 'error': 'Missing required fields'}), 400

    try:
        project = ProjectDAO.createProject(
            title=data['title'],
            description=data['description'],
            technologies=data['technologies'],
            githubUrl=data.get('githubUrl'),
            liveUrl=data.get('liveUrl'),
            imageUrl=data.get('imageUrl')
        )
        return jsonify({'success': True, 'data': project.toDict()}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/<int:projectId>', methods=['PUT'])
@jwt_required()
def updateProject(projectId):
    """
    Update an existing portfolio project (admin only)
    Deletes old image when image is replaced

    Requires: Valid JWT access token

    Args:
        projectId (int): ID of the project to update

    Request body: Partial or complete project data (same fields as POST)

    Returns:
        200: Project updated successfully
        400: No data provided
        404: Project not found
        500: Server error
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    try:
        # Get current project to check if image is being replaced
        currentProject = ProjectDAO.getProjectById(projectId)
        if not currentProject:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        oldImageUrl = currentProject.imageUrl
        newImageUrl = data.get('imageUrl')

        # Update the project
        project = ProjectDAO.updateProject(projectId, **data)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        # Delete old image if it was replaced with a different one
        if oldImageUrl and newImageUrl != oldImageUrl:
            _deleteImageFromStorage(oldImageUrl)

        return jsonify({'success': True, 'data': project.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/<int:projectId>', methods=['DELETE'])
@jwt_required()
def deleteProject(projectId):
    """
    Delete a portfolio project (admin only)
    Also deletes the associated image from storage

    Requires: Valid JWT access token

    Args:
        projectId (int): ID of the project to delete

    Returns:
        200: Project deleted successfully
        404: Project not found
        500: Server error
    """
    try:
        # Get project first to retrieve image URL for deletion
        project = ProjectDAO.getProjectById(projectId)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        imageUrl = project.imageUrl

        # Delete from database
        success = ProjectDAO.deleteProject(projectId)
        if not success:
            return jsonify({'success': False, 'error': 'Project not found'}), 404

        # Delete image from storage if exists
        if imageUrl:
            _deleteImageFromStorage(imageUrl)

        return jsonify({'success': True, 'message': 'Project deleted'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/<int:projectId>/visibility', methods=['PATCH'])
@jwt_required()
def toggleProjectVisibility(projectId):
    """
    Toggle project visibility (show/hide) (admin only)

    Requires: Valid JWT access token

    Args:
        projectId (int): ID of the project to toggle

    Returns:
        200: Visibility toggled successfully
        404: Project not found
        500: Server error
    """
    try:
        project = ProjectDAO.toggleVisibility(projectId)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404
        return jsonify({'success': True, 'data': project.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/reorder', methods=['PATCH'])
@jwt_required()
def reorderProjects():
    """
    Update display order for multiple projects (admin only)

    Requires: Valid JWT access token

    Request body:
        {
            "orderUpdates": [
                {"id": 1, "displayOrder": 0},
                {"id": 2, "displayOrder": 1},
                ...
            ]
        }

    Returns:
        200: Order updated successfully
        400: Missing or invalid data
        500: Server error
    """
    try:
        data = request.get_json()
        orderUpdates = data.get('orderUpdates', [])

        if not orderUpdates:
            return jsonify({'success': False, 'error': 'No order updates provided'}), 400

        ProjectDAO.updateDisplayOrder(orderUpdates)
        return jsonify({'success': True, 'message': 'Order updated'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/upload-image', methods=['POST'])
@jwt_required()
def uploadProjectImage():
    """
    Upload project image (admin only)
    Uses storage factory (local or S3 based on environment)

    Requires: Valid JWT access token

    Request: multipart/form-data with 'file' field

    Returns:
        200: Image uploaded successfully
        400: No file provided or validation failed
        500: Server error
    """
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400

        file = request.files['file']

        # Validate image
        StorageService = getStorageService()
        isValid, error = StorageService.validateImage(file)
        if not isValid:
            return jsonify({'success': False, 'error': error}), 400

        # Save image using storage factory
        originalFilename, storagePath, fileSize = StorageService.saveProjectImage(file)

        # Return image URL (API path to serve the image)
        filename = os.path.basename(storagePath)
        imageUrl = f'/api/portfolio/images/{filename}'

        return jsonify({
            'success': True,
            'data': {
                'imageUrl': imageUrl,
                'fileName': originalFilename,
                'fileSize': fileSize
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/images/<filename>', methods=['GET'])
def serveProjectImage(filename):
    """
    Serve project image file (public endpoint)
    Handles both local storage and S3 backend

    Args:
        filename (str): Name of the image file

    Returns:
        200: Image file
        404: Image not found
        500: Server error
    """
    try:
        filename = secure_filename(filename)
        storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()

        StorageService = getStorageService()
        if storageBackend == 's3':
            import requests

            s3Key = f"projects/{filename}"
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
            relativePath = f"uploads/projects/{filename}"
            filePath = StorageService.getFilePath(relativePath)

            if not os.path.exists(filePath):
                return jsonify({'success': False, 'error': 'Image not found'}), 404

            return send_file(filePath)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _deleteImageFromStorage(imageUrl):
    """
    Helper to delete an image from storage
    Handles both local and S3 backends
    """
    try:
        if not imageUrl:
            return

        filename = imageUrl.split('/')[-1]
        storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()

        StorageService = getStorageService()
        if storageBackend == 's3':
            s3Key = f"projects/{filename}"
            StorageService.deleteFile(s3Key)
        else:
            relativePath = f"uploads/projects/{filename}"
            StorageService.deleteFile(relativePath)
    except Exception as e:
        print(f"Warning: Failed to delete image {imageUrl}: {str(e)}", file=sys.stderr)
