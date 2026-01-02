from flask import Blueprint, jsonify, request
from app.services import EmailService
from app.dao import ProjectDAO, ResumeDAO

api_bp = Blueprint('api', __name__)


@api_bp.route('/health', methods=['GET'])
def healthCheck():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'API is running'
    }), 200


@api_bp.route('/portfolio', methods=['GET'])
def getPortfolio():
    """Get portfolio items from database"""
    try:
        projects = ProjectDAO.getAllProjects()
        portfolioItems = [project.toDict() for project in projects]

        return jsonify({
            'success': True,
            'data': portfolioItems
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/cv', methods=['GET'])
def getCv():
    """Get CV/Resume data from database"""
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


@api_bp.route('/contact', methods=['POST'])
def contact():
    """Handle contact form submissions - send email via SendGrid"""
    data = request.get_json()

    # Validate required fields
    requiredFields = ['name', 'email', 'message']
    if not all(field in data for field in requiredFields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    # Construct email content
    subject = f"Portfolio Contact: Message from {data['name']}"
    body = f"""
    <html>
        <body>
            <h2>New Contact Form Submission</h2>
            <p><strong>From:</strong> {data['name']}</p>
            <p><strong>Email:</strong> {data['email']}</p>
            <p><strong>Message:</strong></p>
            <p>{data['message']}</p>
        </body>
    </html>
    """

    # Send email using EmailService
    success, error = EmailService.sendEmail(
        fromEmail=data['email'],
        subject=subject,
        body=body
    )

    if success:
        return jsonify({
            'success': True,
            'message': 'Thank you for your message! I will get back to you soon.'
        }), 200
    else:
        return jsonify({
            'success': False,
            'error': 'Failed to send message. Please try again later.'
        }), 500
