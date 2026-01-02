from app.models import User
from datetime import datetime


class UserDAO:
    """Data Access Object for User model"""

    @staticmethod
    def getUserByEmail(email):
        """
        Get user by email address

        Args:
            email (str): User's email address

        Returns:
            User: User object if found, None otherwise

        Raises:
            Exception: If database operation fails
        """
        try:
            return User.query.filter_by(email=email).first()
        except Exception as e:
            raise Exception(f"Failed to fetch user by email: {str(e)}")

    @staticmethod
    def getUserById(userId):
        """
        Get user by ID

        Args:
            userId (int): User's ID

        Returns:
            User: User object if found, None otherwise

        Raises:
            Exception: If database operation fails
        """
        try:
            return User.query.get(userId)
        except Exception as e:
            raise Exception(f"Failed to fetch user by ID: {str(e)}")

    @staticmethod
    def updateLastLogin(userId):
        """
        Update user's last login timestamp

        Args:
            userId (int): User's ID

        Returns:
            User: Updated user object

        Raises:
            Exception: If database operation fails
        """
        from app import db
        try:
            user = User.query.get(userId)
            if user:
                user.lastLogin = datetime.utcnow()
                db.session.commit()
            return user
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to update last login: {str(e)}")
