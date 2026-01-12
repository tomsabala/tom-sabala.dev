"""
Contact form routes - public contact form submission
"""
from flask import Blueprint, request, jsonify, make_response
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
            return jsonify({
                'success': False,
                'error': 'Message too long (max 5000 characters)'
            }), 400

        # ===================================================================
        # SAVE TO DATABASE (keep existing logic)
        # ===================================================================
        try:
            contactSubmission = ContactSubmissionDAO.createSubmission(
                name=name,
                email=email,
                message=message,
                ipAddress=userIpAddress
            )
        except Exception as databaseError:
            # Log but don't fail - email still sends
            print(
                f"ERROR: Failed to save contact submission to database: {str(databaseError)}",
                file=sys.stderr
            )

        # ===================================================================
        # LAYER 5: SEND EMAIL (keep existing email logic)
        # ===================================================================
        emailSendSucceeded, emailError = EmailService.sendEmail(
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

    except Exception as unexpectedError:
        print(f"ERROR: Unexpected error in contact form: {str(unexpectedError)}", file=sys.stderr)
        return jsonify({
            'success': False,
            'error': 'Failed to submit form. Please try again.'
        }), 500
