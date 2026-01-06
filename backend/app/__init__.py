from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from datetime import timedelta
from dotenv import load_dotenv
import os

load_dotenv()

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()


def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', app.config['SECRET_KEY'])
    app.config['JWT_TOKEN_LOCATION'] = ['cookies']
    app.config['JWT_COOKIE_SECURE'] = os.getenv('JWT_COOKIE_SECURE', 'False') == 'True'
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    app.config['JWT_COOKIE_SAMESITE'] = 'Lax'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
    app.config['JWT_COOKIE_HTTP_ONLY'] = True
    app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token'
    app.config['JWT_REFRESH_COOKIE_NAME'] = 'refresh_token'

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # CORS configuration
    corsOrigins = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
    CORS(app,
         origins=corsOrigins,
         supports_credentials=True,  # CRITICAL for cookies
         allow_headers=['Content-Type', 'Authorization'],
         expose_headers=['Content-Type', 'Content-Disposition'])  # Content-Disposition for file downloads

    # Import models (required for Flask-Migrate to detect them)
    with app.app_context():
        from app import models

    # Register blueprints
    from app.routes.portfolio_routes import portfolio_bp
    from app.routes.resume_routes import resume_bp
    from app.routes.auth_routes import auth_bp
    from app.routes.contact_routes import contact_bp
    from app.routes.health_routes import health_bp
    from app.routes.dashboard_routes import dashboard_bp

    app.register_blueprint(portfolio_bp, url_prefix='/api')
    app.register_blueprint(resume_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(contact_bp, url_prefix='/api')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api')

    # JWT error handlers
    @jwt.unauthorized_loader
    def unauthorizedCallback(callback):
        return jsonify({'success': False, 'error': 'Missing or invalid token', 'code': 'UNAUTHORIZED'}), 401

    @jwt.invalid_token_loader
    def invalidTokenCallback(callback):
        return jsonify({'success': False, 'error': 'Invalid token', 'code': 'INVALID_TOKEN'}), 401

    @jwt.expired_token_loader
    def expiredTokenCallback(jwt_header, jwt_payload):
        return jsonify({'success': False, 'error': 'Token expired', 'code': 'TOKEN_EXPIRED'}), 401

    return app
