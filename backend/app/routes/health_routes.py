"""
Health check routes - API status monitoring
"""
from flask import Blueprint, jsonify
import os
import sys

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


@health_bp.route('/health/ready', methods=['GET'])
def readinessCheck():
    """
    Readiness check endpoint with warm-up (public).
    Initializes expensive resources proactively to reduce first-request latency.

    Use with external ping services (UptimeRobot, cron-job.org) every 5-10 minutes
    to prevent Render free tier cold starts.

    Warms up:
    - Database connection pool (verifies connectivity)
    - S3 client (if using S3 storage backend)
    - Storage service factory cache

    Returns:
        200: All resources initialized and ready
        503: One or more resources failed to initialize
    """
    status = {
        'database': False,
        'storage': False
    }
    errors = []

    # Warm up database connection pool
    try:
        from app import db
        db.session.execute(db.text('SELECT 1'))
        db.session.commit()
        status['database'] = True
    except Exception as e:
        errors.append(f"Database: {str(e)}")
        print(f"ERROR: Readiness check - database failed: {str(e)}", file=sys.stderr)

    # Warm up storage service (initializes S3 client if using S3)
    try:
        from app.services.storage_factory import getStorageService
        StorageService = getStorageService()

        # If S3 backend, ensure the client is initialized
        storageBackend = os.getenv('STORAGE_BACKEND', 'local').lower()
        if storageBackend == 's3':
            from app.services.s3_storage_service import S3StorageService
            S3StorageService._getS3Client()

        status['storage'] = True
    except Exception as e:
        errors.append(f"Storage: {str(e)}")
        print(f"ERROR: Readiness check - storage failed: {str(e)}", file=sys.stderr)

    allReady = all(status.values())

    response = {
        'status': 'ready' if allReady else 'degraded',
        'checks': status
    }

    if errors:
        response['errors'] = errors

    return jsonify(response), 200 if allReady else 503
