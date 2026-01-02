"""
Dashboard routes - admin dashboard statistics and overview
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.dao import ProjectDAO, ResumeDAO
from app.services import AuthService

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/dashboard/stats', methods=['GET'])
@jwt_required()
def getAdminStats():
    """
    Get admin dashboard statistics (admin only)

    Requires: Valid JWT access token

    Returns:
        200: Dashboard stats including project count, resume status, last login, admin user info
        500: Server error
    """
    try:
        projects = ProjectDAO.getAllProjects()
        resume = ResumeDAO.getResume()
        user, _ = AuthService.getCurrentUser()

        stats = {
            'projectCount': len(projects),
            'resumeExists': resume is not None,
            'lastLogin': user.lastLogin.isoformat() if user and user.lastLogin else None,
            'adminUser': user.toDict() if user else None
        }
        return jsonify({'success': True, 'data': stats}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
