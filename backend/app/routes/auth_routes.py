"""
Authentication routes for login, logout, token refresh, and user info
"""
from flask import Blueprint, request, jsonify, make_response
from flask_jwt_extended import (
    jwt_required, get_jwt_identity, set_access_cookies,
    set_refresh_cookies, unset_jwt_cookies, create_access_token
)
from app.services import AuthService

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Login endpoint - authenticates user and sets JWT cookies

    Request body:
        {
            "email": "user@example.com",
            "password": "password123"
        }

    Returns:
        200: Login successful with user data and JWT cookies set
        400: Missing email or password
        401: Invalid credentials
    """
    data = request.get_json()
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'success': False, 'error': 'Email and password required'}), 400

    user, error = AuthService.authenticateUser(data['email'], data['password'])
    if error or not user:
        return jsonify({'success': False, 'error': error or 'Authentication failed'}), 401

    tokens = AuthService.generateTokens(user.id)
    AuthService.updateLoginTimestamp(user.id)

    response = make_response(jsonify({
        'success': True,
        'message': 'Login successful',
        'data': {'user': user.toDict()}
    }), 200)

    set_access_cookies(response, tokens['accessToken'])
    set_refresh_cookies(response, tokens['refreshToken'])
    return response


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """
    Logout endpoint - clears JWT cookies

    Requires: Valid JWT access token in cookies

    Returns:
        200: Logout successful with cookies cleared
    """
    response = make_response(jsonify({'success': True, 'message': 'Logout successful'}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Token refresh endpoint - generates new access token using refresh token

    Requires: Valid JWT refresh token in cookies

    Returns:
        200: New access token set in cookies
    """
    userId = get_jwt_identity()
    accessToken = create_access_token(identity=userId)
    response = make_response(jsonify({'success': True, 'message': 'Token refreshed'}), 200)
    set_access_cookies(response, accessToken)
    return response


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def getCurrentUser():
    """
    Get current user info endpoint

    Requires: Valid JWT access token in cookies

    Returns:
        200: User data
        404: User not found
    """
    user, error = AuthService.getCurrentUser()
    if error or not user:
        return jsonify({'success': False, 'error': error or 'User not found'}), 404
    return jsonify({'success': True, 'data': {'user': user.toDict()}}), 200


@auth_bp.route('/check', methods=['GET'])
@jwt_required()
def checkAuth():
    """
    Check authentication status endpoint

    Requires: Valid JWT access token in cookies

    Returns:
        200: Authentication confirmed with user ID
    """
    return jsonify({'success': True, 'authenticated': True, 'userId': get_jwt_identity()}), 200
