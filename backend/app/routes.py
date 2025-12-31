from flask import Blueprint, jsonify, request

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
    """Get portfolio items"""
    # TODO: Replace with database/file-based storage
    portfolioItems = [
        {
            'id': 1,
            'title': 'Sample Project 1',
            'description': 'A full-stack web application built with React and Flask',
            'technologies': ['React', 'Flask', 'PostgreSQL'],
            'github_url': 'https://github.com/yourusername/project1',
            'live_url': 'https://project1.example.com',
            'image_url': '/images/project1.png'
        },
        {
            'id': 2,
            'title': 'Sample Project 2',
            'description': 'Mobile application for task management',
            'technologies': ['Flutter', 'Firebase'],
            'github_url': 'https://github.com/yourusername/project2',
            'live_url': None,
            'image_url': '/images/project2.png'
        }
    ]

    return jsonify({
        'success': True,
        'data': portfolioItems
    }), 200


@api_bp.route('/cv', methods=['GET'])
def getCv():
    """Get CV/Resume data"""
    # TODO: Replace with database/file-based storage
    cvData = {
        'personal_info': {
            'name': 'Tom Sabala',
            'title': 'Software Engineer',
            'email': 'tom@sabala.dev',
            'location': 'Your Location',
            'summary': 'Passionate software engineer with expertise in full-stack development'
        },
        'experience': [
            {
                'company': 'Company Name',
                'position': 'Software Engineer',
                'start_date': '2022-01',
                'end_date': 'Present',
                'description': 'Building scalable web applications',
                'technologies': ['React', 'Python', 'Flask', 'PostgreSQL']
            }
        ],
        'education': [
            {
                'institution': 'University Name',
                'degree': 'Bachelor of Science in Computer Science',
                'start_date': '2018',
                'end_date': '2022'
            }
        ],
        'skills': {
            'languages': ['Python', 'JavaScript', 'TypeScript', 'Dart'],
            'frameworks': ['React', 'Flask', 'Flutter'],
            'tools': ['Git', 'Docker', 'PostgreSQL']
        }
    }

    return jsonify({
        'success': True,
        'data': cvData
    }), 200


@api_bp.route('/contact', methods=['POST'])
def contact():
    """Handle contact form submissions"""
    data = request.get_json()

    # Validate required fields
    requiredFields = ['name', 'email', 'message']
    if not all(field in data for field in requiredFields):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    # TODO: Implement email sending or database storage
    # For now, just log and return success
    print(f"Contact form submission from {data['name']} ({data['email']}): {data['message']}")

    return jsonify({
        'success': True,
        'message': 'Thank you for your message! I will get back to you soon.'
    }), 200
