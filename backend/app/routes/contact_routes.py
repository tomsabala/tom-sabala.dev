"""
Contact form routes - public contact form submission
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.services import EmailService
from app.dao import ContactSubmissionDAO
from app import limiter
import sys

contact_bp = Blueprint('contact', __name__)


@contact_bp.route('/contact', methods=['POST'])
@limiter.limit("5 per minute")  # Strict limit for contact form
@limiter.limit("20 per hour")
def contact():
    """
    Handle contact form submissions with validation and rate limiting (public endpoint)

    Request body:
        {
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Your message here"
        }

    Returns:
        200: Email sent successfully
        400: Validation error
        429: Rate limit exceeded
        500: Email sending failed
    """
    try:
        data = request.get_json()

        # Validate required fields
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        message = data.get('message', '').strip()

        # Name validation (2-100 characters)
        if not name or len(name) < 2:
            return jsonify({'success': False, 'error': 'Name must be at least 2 characters'}), 400
        if len(name) > 100:
            return jsonify({'success': False, 'error': 'Name too long (max 100 characters)'}), 400

        # Email validation (basic)
        if not email or '@' not in email or '.' not in email:
            return jsonify({'success': False, 'error': 'Invalid email address'}), 400
        if len(email) > 255:
            return jsonify({'success': False, 'error': 'Email too long'}), 400

        # Message validation (10-5000 characters)
        if not message or len(message) < 10:
            return jsonify({'success': False, 'error': 'Message must be at least 10 characters'}), 400
        if len(message) > 5000:
            return jsonify({'success': False, 'error': 'Message too long (max 5000 characters)'}), 400

        # Get client IP address
        ipAddress = request.remote_addr

        # Save submission to database
        try:
            submission = ContactSubmissionDAO.createSubmission(
                name=name,
                email=email,
                message=message,
                ipAddress=ipAddress
            )
        except Exception as e:
            # Log error but don't fail - email still sends
            print(f"ERROR: Failed to save contact submission to DB: {str(e)}", file=sys.stderr)

        # Send email using EmailService
        success, error = EmailService.sendEmail(
            fromEmail=email,
            name=name,
            email=email,
            message=message
        )

        if success:
            return jsonify({
                'success': True,
                'message': 'Thank you for your message! I will get back to you soon.'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': error
            }), 500

    except Exception as e:
        return jsonify({'success': False, 'error': 'Failed to submit form'}), 500


@contact_bp.route('/contact/submissions', methods=['GET'])
@jwt_required()
def getSubmissions():
    """
    Get all contact submissions with pagination and filters (admin only)

    Query params:
        limit (int): Results per page (default 50, max 100)
        offset (int): Pagination offset (default 0)
        read (str): Filter by read status - 'all'|'read'|'unread' (default 'all')
        includeArchived (bool): Include archived submissions (default false)

    Returns:
        200: { success: true, data: { submissions: [...], total: 123, limit: 50, offset: 0 } }
        500: Server error
    """
    try:
        # Parse query parameters
        limit = min(int(request.args.get('limit', 50)), 100)
        offset = int(request.args.get('offset', 0))
        readFilter = request.args.get('read', 'all')
        includeArchived = request.args.get('includeArchived', 'false').lower() == 'true'

        # Fetch submissions from database
        submissions, total = ContactSubmissionDAO.getAllSubmissions(
            limit=limit,
            offset=offset,
            readFilter=readFilter,
            includeArchived=includeArchived
        )

        return jsonify({
            'success': True,
            'data': {
                'submissions': [s.toDict() for s in submissions],
                'total': total,
                'limit': limit,
                'offset': offset
            }
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@contact_bp.route('/contact/submissions/<int:submissionId>', methods=['GET'])
@jwt_required()
def getSubmission(submissionId):
    """
    Get single submission by ID (admin only)

    Args:
        submissionId (int): Submission ID

    Returns:
        200: { success: true, data: {...} }
        404: Submission not found
        500: Server error
    """
    try:
        submission = ContactSubmissionDAO.getSubmissionById(submissionId)
        if not submission:
            return jsonify({'success': False, 'error': 'Submission not found'}), 404

        return jsonify({'success': True, 'data': submission.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@contact_bp.route('/contact/submissions/<int:submissionId>/read', methods=['PATCH'])
@jwt_required()
def toggleSubmissionRead(submissionId):
    """
    Toggle read/unread status (admin only)

    Args:
        submissionId (int): Submission ID

    Returns:
        200: { success: true, data: {...} }
        404: Submission not found
        500: Server error
    """
    try:
        submission = ContactSubmissionDAO.toggleReadStatus(submissionId)
        if not submission:
            return jsonify({'success': False, 'error': 'Submission not found'}), 404

        return jsonify({'success': True, 'data': submission.toDict()}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@contact_bp.route('/contact/submissions/<int:submissionId>', methods=['DELETE'])
@jwt_required()
def deleteSubmission(submissionId):
    """
    Soft delete (archive) submission (admin only)

    Args:
        submissionId (int): Submission ID

    Returns:
        200: { success: true, message: 'Submission archived' }
        404: Submission not found
        500: Server error
    """
    try:
        success = ContactSubmissionDAO.softDelete(submissionId)
        if not success:
            return jsonify({'success': False, 'error': 'Submission not found'}), 404

        return jsonify({'success': True, 'message': 'Submission archived'}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
