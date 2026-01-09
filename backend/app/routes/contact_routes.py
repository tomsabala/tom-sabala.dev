"""
Contact form routes - public contact form submission
"""
from flask import Blueprint, request, jsonify
from app.services import EmailService
from app import limiter

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
