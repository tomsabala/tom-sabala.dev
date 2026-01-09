"""
Portfolio routes - public viewing and admin CRUD operations
"""
import os
import traceback
import sys
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, verify_jwt_in_request
from werkzeug.utils import secure_filename
from app.dao import ProjectDAO
from app.services.file_storage_service import FileStorageService

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
        project = ProjectDAO.updateProject(projectId, **data)
        if not project:
            return jsonify({'success': False, 'error': 'Project not found'}), 404
        return jsonify({'success': True, 'data': project.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@portfolio_bp.route('/portfolio/<int:projectId>', methods=['DELETE'])
@jwt_required()
def deleteProject(projectId):
    """
    Delete a portfolio project (admin only)

    Requires: Valid JWT access token

    Args:
        projectId (int): ID of the project to delete

    Returns:
        200: Project deleted successfully
        404: Project not found
        500: Server error
    """
    try:
        success = ProjectDAO.deleteProject(projectId)
        if not success:
            return jsonify({'success': False, 'error': 'Project not found'}), 404
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
        isValid, error = FileStorageService.validateImage(file)
        if not isValid:
            return jsonify({'success': False, 'error': error}), 400

        # Save image
        originalFilename, relativePath, fileSize = FileStorageService.saveProjectImage(file)

        # Return image URL (API path to serve the image)
        # Extract just the filename from the relative path
        filename = os.path.basename(relativePath)
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

    Args:
        filename (str): Name of the image file

    Returns:
        200: Image file
        404: Image not found
        500: Server error
    """
    try:
        # Secure the filename to prevent directory traversal attacks
        filename = secure_filename(filename)
        relativePath = f"uploads/projects/{filename}"
        filePath = FileStorageService.getFilePath(relativePath)

        if not os.path.exists(filePath):
            return jsonify({'success': False, 'error': 'Image not found'}), 404

        # Send file with appropriate mimetype (auto-detected)
        return send_file(filePath)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
