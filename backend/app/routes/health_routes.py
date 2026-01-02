"""
Health check routes - API status monitoring
"""
from flask import Blueprint, jsonify

health_bp = Blueprint('health', __name__)


@health_bp.route('/health', methods=['GET'])
def healthCheck():
    """
    Health check endpoint (public)

    Returns:
        200: API is running and healthy
    """
    return jsonify({
        'status': 'healthy',
        'message': 'API is running'
    }), 200
