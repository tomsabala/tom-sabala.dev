"""
Portfolio routes - public viewing and admin CRUD operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.dao import ProjectDAO

portfolio_bp = Blueprint('portfolio', __name__)


@portfolio_bp.route('/portfolio', methods=['GET'])
def getPortfolio():
    """
    Get all portfolio projects (public endpoint)

    Returns:
        200: List of all projects
        500: Server error
    """
    try:
        projects = ProjectDAO.getAllProjects()
        portfolioItems = [project.toDict() for project in projects]

        return jsonify({
            'success': True,
            'data': portfolioItems
        }), 200
    except Exception as e:
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
