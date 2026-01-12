"""
Contact form routes - public contact form submission
"""
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import jwt_required
from app.services import EmailService, RecaptchaVerificationService
from app.dao import ContactSubmissionDAO
from app import limiter
from app.utils.csrf_protection import generateCsrfToken, attachCsrfCookieToResponse, validateCsrfToken
import sys

contact_bp = Blueprint('contact', __name__)


@contact_bp.route('/contact/csrf-token', methods=['GET'])
@limiter.limit("20 per minute")
def getCsrfTokenForContactForm():
    """
    Generate and return CSRF token for contact form protection.
    Public endpoint - no authentication required.

    Returns token in both cookie and response body for double-submit pattern:
    - Cookie: csrf_token (HttpOnly=False)
    - Body: { "success": true, "csrfToken": "..." }

    Rate limit: 20 per minute (prevents token generation spam)
    """
    csrfToken = generateCsrfToken()

    responseData = {
        'success': True,
        'csrfToken': csrfToken
    }

    response = make_response(jsonify(responseData), 200)
    response = attachCsrfCookieToResponse(response, csrfToken)

    return response


@contact_bp.route('/contact', methods=['POST'])
@limiter.limit("5 per minute")  # Keep existing rate limits
@limiter.limit("20 per hour")
def submitContactForm():
    """
    Handle contact form submissions with multi-layer security.

    Security layers (in order):
    1. Honeypot field check (instant, ~0ms)
    2. CSRF token validation (instant, ~1ms)
    3. reCAPTCHA verification (external API, ~100-300ms)
    4. Input validation (instant, ~1ms)
    5. Email sending (external API, ~200-500ms)

    Request body:
        {
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Your message here",
            "recaptchaToken": "token-from-frontend",
            "email2": "",  # Honeypot (must be empty)
            "phoneNumber": ""  # Honeypot (must be empty)
        }

    Headers:
        X-CSRF-Token: <token-from-cookie>

    Cookies:
        csrf_token: <token-from-endpoint>

    Returns:
        200: Email sent successfully
        400: Validation or security check failed
        429: Rate limit exceeded
        500: Server error
    """
    try:
        requestData = request.get_json()
        userIpAddress = request.remote_addr

        # ===================================================================
        # SECURITY LAYER 1: HONEYPOT FIELD CHECK
        # ===================================================================
        # These fields should always be empty (hidden from legitimate users).
        # If filled, indicates bot auto-fill behavior.
        honeypotEmail2 = requestData.get('email2', '').strip()
        honeypotPhoneNumber = requestData.get('phoneNumber', '').strip()

        if honeypotEmail2 or honeypotPhoneNumber:
            # Log security event with IP for monitoring
            print(
                f"SECURITY ALERT: Honeypot triggered from {userIpAddress} "
                f"(email2={bool(honeypotEmail2)}, phoneNumber={bool(honeypotPhoneNumber)})",
                file=sys.stderr
            )

            # Return generic error (don't reveal honeypot existence)
            return jsonify({
                'success': False,
                'error': 'Unable to process your request. Please try again.'
            }), 400

        # ===================================================================
        # SECURITY LAYER 2: CSRF TOKEN VALIDATION
        # ===================================================================
        csrfTokenFromCookie = request.cookies.get('csrf_token')
        csrfTokenFromHeader = request.headers.get('X-CSRF-Token')

        csrfIsValid, csrfErrorMessage = validateCsrfToken(
            csrfTokenFromCookie,
            csrfTokenFromHeader
        )

        if not csrfIsValid:
            # Log security event with details
            print(
                f"SECURITY ALERT: CSRF validation failed from {userIpAddress} "
                f"(reason: {csrfErrorMessage})",
                file=sys.stderr
            )

            # Return generic error (don't reveal CSRF details)
            return jsonify({
                'success': False,
                'error': 'Invalid request. Please refresh the page and try again.'
            }), 400

        # ===================================================================
        # SECURITY LAYER 3: reCAPTCHA VERIFICATION
        # ===================================================================
        recaptchaToken = requestData.get('recaptchaToken')

        if not recaptchaToken:
            return jsonify({
                'success': False,
                'error': 'Security verification required. Please try again.'
            }), 400

        verificationSucceeded, verificationError, userScore = \
            RecaptchaVerificationService.verifyRecaptchaToken(
                recaptchaToken=recaptchaToken,
                userIpAddress=userIpAddress
            )

        if not verificationSucceeded:
            # Log security event with score
            print(
                f"SECURITY ALERT: reCAPTCHA verification failed from {userIpAddress} "
                f"(reason: {verificationError}, score: {userScore})",
                file=sys.stderr
            )

            # Return generic error (don't reveal reCAPTCHA details)
            return jsonify({
                'success': False,
                'error': 'Unable to verify your request. Please try again.'
            }), 400

        # Log successful verification with score for monitoring
        print(
            f"INFO: reCAPTCHA verification succeeded from {userIpAddress} "
            f"(score: {userScore})"
        )

        # ===================================================================
        # LAYER 4: INPUT VALIDATION (keep existing validation logic)
        # ===================================================================
        name = requestData.get('name', '').strip()
        email = requestData.get('email', '').strip()
        message = requestData.get('message', '').strip()

        # Name validation (2-100 characters)
        if not name or len(name) < 2:
            return jsonify({
                'success': False,
                'error': 'Name must be at least 2 characters'
            }), 400

        if len(name) > 100:
            return jsonify({
                'success': False,
                'error': 'Name too long (max 100 characters)'
            }), 400

        # Email validation (basic format check)
        if not email or '@' not in email or '.' not in email:
            return jsonify({
                'success': False,
                'error': 'Invalid email address'
            }), 400

        if len(email) > 255:
            return jsonify({
                'success': False,
                'error': 'Email too long'
            }), 400

        # Message validation (10-5000 characters)
        if not message or len(message) < 10:
            return jsonify({
                'success': False,
                'error': 'Message must be at least 10 characters'
            }), 400

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

        if emailSendSucceeded:
            return jsonify({
                'success': True,
                'message': 'Thank you for your message! I will get back to you soon.'
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': emailError or 'Failed to send email'
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
