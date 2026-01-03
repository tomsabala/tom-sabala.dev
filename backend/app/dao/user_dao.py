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
    def getUserByGoogleId(googleId):
        """
        Get user by Google ID

        Args:
            googleId (str): Google OAuth user ID

        Returns:
            User: User object if found, None otherwise

        Raises:
            Exception: If database operation fails
        """
        try:
            return User.query.filter_by(googleId=googleId).first()
        except Exception as e:
            raise Exception(f"Failed to fetch user by Google ID: {str(e)}")

    @staticmethod
    def createOrUpdateGoogleUser(googleId, email, name, profilePicture):
        """
        Create new user or update existing user from Google OAuth

        Args:
            googleId (str): Google OAuth user ID
            email (str): User's email
            name (str): User's name
            profilePicture (str): URL to profile picture

        Returns:
            User: Created or updated user object

        Raises:
            Exception: If database operation fails
        """
        from app import db
        try:
            # Try to find by Google ID first
            user = User.query.filter_by(googleId=googleId).first()

            # If not found by Google ID, try email
            if not user:
                user = User.query.filter_by(email=email).first()

            # Create new user if doesn't exist
            if not user:
                user = User(
                    username=email.split('@')[0],  # Use email prefix as username
                    email=email,
                    googleId=googleId,
                    profilePicture=profilePicture,
                    createdAt=datetime.utcnow()
                )
                db.session.add(user)
            else:
                # Update existing user with Google info
                user.googleId = googleId
                user.profilePicture = profilePicture

            db.session.commit()
            return user
        except Exception as e:
            db.session.rollback()
            raise Exception(f"Failed to create/update Google user: {str(e)}")

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
