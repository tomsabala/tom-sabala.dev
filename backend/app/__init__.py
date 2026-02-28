from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from datetime import timedelta
from dotenv import load_dotenv
import os
import sys
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

load_dotenv()

# Initialize Sentry (production only)
if os.getenv('FLASK_ENV') == 'production' and os.getenv('SENTRY_DSN'):
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[FlaskIntegration()],
        traces_sample_rate=0.1,  # 10% performance monitoring
        profiles_sample_rate=0.1,
        environment='production',
        release=os.getenv('GIT_COMMIT_SHA', 'unknown'),
    )

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"  # Use Redis in production for distributed rate limiting
)


def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Database connection pooling for better performance
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 5,           # Base pool size
        'pool_timeout': 10,       # Seconds to wait for connection
        'pool_recycle': 300,      # Recycle connections after 5 minutes
        'pool_pre_ping': True,    # Verify connections before use (handles stale connections after cold starts)
        'max_overflow': 10,       # Additional connections beyond pool_size
    }

    # JWT Configuration
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', app.config['SECRET_KEY'])
    app.config['JWT_TOKEN_LOCATION'] = ['cookies']
    app.config['JWT_COOKIE_SECURE'] = os.getenv('JWT_COOKIE_SECURE', 'False') == 'True'
    app.config['JWT_COOKIE_CSRF_PROTECT'] = False
    app.config['JWT_COOKIE_SAMESITE'] = os.getenv('JWT_COOKIE_SAMESITE', 'Lax')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=30)
    app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
    app.config['JWT_COOKIE_HTTP_ONLY'] = True
    app.config['JWT_ACCESS_COOKIE_NAME'] = 'access_token'
    app.config['JWT_REFRESH_COOKIE_NAME'] = 'refresh_token'

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)

    # CORS configuration
    corsOrigins = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
    CORS(app,
         origins=corsOrigins,
         supports_credentials=True,  # CRITICAL for cookies
         allow_headers=['Content-Type', 'Authorization', 'X-CSRF-Token'],
         expose_headers=['Content-Type', 'Content-Disposition'])  # Content-Disposition for file downloads

    # Security headers middleware (production-ready)
    @app.after_request
    def setSecurityHeaders(response):
        """Add security headers to all responses"""
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'

        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'

        # Enable XSS protection
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # HSTS - Force HTTPS (only in production)
        if os.getenv('FLASK_ENV') == 'production':
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

        # Content Security Policy (basic)
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"

        # Referrer policy
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

        return response

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
    from app.routes.about_routes import about_bp
    from app.routes.docs_routes import docs_bp

    app.register_blueprint(portfolio_bp, url_prefix='/api')
    app.register_blueprint(resume_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(contact_bp, url_prefix='/api')
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(dashboard_bp, url_prefix='/api')
    app.register_blueprint(about_bp, url_prefix='/api')
    app.register_blueprint(docs_bp, url_prefix='/api')

    # JWT error handlers
    @jwt.unauthorized_loader
    def unauthorizedCallback(callback):
        print(f"JWT ERROR: unauthorized_loader triggered - {callback}", file=sys.stderr)
        return jsonify({'success': False, 'error': 'Missing or invalid token', 'code': 'UNAUTHORIZED'}), 401

    @jwt.invalid_token_loader
    def invalidTokenCallback(callback):
        print(f"JWT ERROR: invalid_token_loader triggered - {callback}", file=sys.stderr)
        return jsonify({'success': False, 'error': 'Invalid token', 'code': 'INVALID_TOKEN'}), 401

    @jwt.expired_token_loader
    def expiredTokenCallback(jwt_header, jwt_payload):
        print(f"JWT ERROR: expired_token_loader triggered - {jwt_payload}", file=sys.stderr)
        return jsonify({'success': False, 'error': 'Token expired', 'code': 'TOKEN_EXPIRED'}), 401

    return app
