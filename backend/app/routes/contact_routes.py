"""
Contact form routes - public contact form submission
"""
from flask import Blueprint, request, jsonify
from app.services import EmailService

contact_bp = Blueprint('contact', __name__)


@contact_bp.route('/contact', methods=['POST'])
def contact():
    """
    Handle contact form submissions - send email via SendGrid (public endpoint)

    Request body:
        {
            "name": "John Doe",
            "email": "john@example.com",
            "message": "Your message here"
        }

    Returns:
        200: Email sent successfully
        400: Missing required fields
        500: Email sending failed
    """
    data = request.get_json()

    # Validate required fields
    requiredFields = ['name', 'email', 'message']
    if not all(field in data for field in requiredFields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    # Send email using EmailService
    success, error = EmailService.sendEmail(
        fromEmail=data['email'],
        name=data['name'],
        email=data['email'],
        message=data['message']
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
