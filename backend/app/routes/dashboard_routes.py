"""
Dashboard routes - admin dashboard statistics and overview
"""
import sys
import traceback
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app import db
from app.dao import ProjectDAO, ResumeDAO, TabConfigDAO
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
        projects = ProjectDAO(db.session).getAllProjects()
        resume = ResumeDAO(db.session).getResume()
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


# ── Tab Visibility ────────────────────────────────────────────────────────────

@dashboard_bp.route('/dashboard/tabs', methods=['GET'])
def getTabConfigs():
    """
    Get visible navigation tabs (public — no auth required).
    Returns ONLY the list of tab keys that are visible to the public.
    Hidden tabs are omitted entirely — no signal that they exist.
    """
    try:
        visible = TabConfigDAO(db.session).getVisible()
        return jsonify({'success': True, 'data': visible}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@dashboard_bp.route('/dashboard/tabs/admin', methods=['GET'])
@jwt_required()
def getAdminTabConfigs():
    """
    Get full tab config including hidden tabs (admin only).
    Returns the complete {tab_key: bool} map so the Settings page can render
    the current state of all tabs regardless of visibility.
    """
    try:
        configs = TabConfigDAO(db.session).getAll()
        return jsonify({'success': True, 'data': configs}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@dashboard_bp.route('/dashboard/tabs', methods=['PUT'])
@jwt_required()
def updateTabConfigs():
    """
    Bulk update tab visibility (admin only).
    Accepts partial updates: only keys provided are updated.
    Body: {"home": true, "cv": false, ...}
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({'success': False, 'error': 'JSON object required'}), 400
    try:
        TabConfigDAO(db.session).bulkUpsert(data)
        configs = TabConfigDAO(db.session).getAll()
        return jsonify({'success': True, 'data': configs}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500
