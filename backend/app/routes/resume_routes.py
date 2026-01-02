"""
Resume/CV routes - public viewing and admin update operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.dao import ResumeDAO

resume_bp = Blueprint('resume', __name__)


@resume_bp.route('/cv', methods=['GET'])
def getCv():
    """
    Get CV/Resume data (public endpoint)

    Returns:
        200: Resume data
        404: Resume not found
        500: Server error
    """
    try:
        resume = ResumeDAO.getResume()

        if not resume:
            return jsonify({
                'success': False,
                'error': 'No resume data found. Please run the seed script.'
            }), 404

        cvData = resume.toDict()

        return jsonify({
            'success': True,
            'data': cvData
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@resume_bp.route('/cv', methods=['PUT'])
@jwt_required()
def updateCv():
    """
    Update CV/resume data (admin only)

    Requires: Valid JWT access token

    Request body: Partial or complete resume data
        {
            "personalInfo": {...},
            "experience": [...],
            "education": [...],
            "skills": [...]
        }

    Returns:
        200: Resume updated successfully
        400: No data provided
        404: Resume not found
        500: Server error
    """
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400

    try:
        resume = ResumeDAO.getResume()
        if not resume:
            return jsonify({'success': False, 'error': 'Resume not found'}), 404

        updated = ResumeDAO.updateResume(
            resume.id,
            personalInfo=data.get('personalInfo'),
            experience=data.get('experience'),
            education=data.get('education'),
            skills=data.get('skills')
        )
        return jsonify({'success': True, 'data': updated.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
