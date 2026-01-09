"""
Authentication service for handling user authentication operations
"""
from app.dao import UserDAO
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity


class AuthService:
    """Service class for authentication operations"""

    @staticmethod
    def authenticateUser(email, password):
        """
        Authenticate user by email and password

        Args:
            email (str): User's email address
            password (str): User's password

        Returns:
            tuple: (user: User or None, error: str or None)
        """
        try:
            user = UserDAO.getUserByEmail(email)
            if not user or not user.checkPassword(password):
                return (None, "Invalid email or password")
            return (user, None)
        except Exception as e:
            return (None, str(e))

    @staticmethod
    def generateTokens(userId):
        """
        Generate access and refresh JWT tokens for a user

        Args:
            userId (int): User's ID

        Returns:
            dict: Dictionary with accessToken and refreshToken
        """
        return {
            'accessToken': create_access_token(identity=str(userId)),
            'refreshToken': create_refresh_token(identity=str(userId))
        }

    @staticmethod
    def getCurrentUser():
        """
        Get current authenticated user from JWT token

        Returns:
            tuple: (user: User or None, error: str or None)
        """
        try:
            userId = get_jwt_identity()
            if not userId:
                return (None, "User not authenticated")
            # Convert string identity back to int for database query
            user = UserDAO.getUserById(int(userId))
            return (user, None) if user else (None, "User not found")
        except Exception as e:
            return (None, str(e))

    @staticmethod
    def updateLoginTimestamp(userId):
        """
        Update user's last login timestamp

        Args:
            userId (int): User's ID

        Returns:
            tuple: (success: bool, error: str or None)
        """
        try:
            UserDAO.updateLastLogin(userId)
            return (True, None)
        except Exception as e:
            return (False, str(e))
