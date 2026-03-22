from app.models import User
from datetime import datetime


class UserDAO:

    def __init__(self, session):
        self.session = session

    def getUserByEmail(self, email):
        try:
            return self.session.query(User).filter_by(email=email).first()
        except Exception as e:
            raise Exception(f"Failed to fetch user by email: {str(e)}")

    def getUserById(self, userId):
        try:
            return self.session.get(User, userId)
        except Exception as e:
            raise Exception(f"Failed to fetch user by ID: {str(e)}")

    def getUserByGoogleId(self, googleId):
        try:
            return self.session.query(User).filter_by(googleId=googleId).first()
        except Exception as e:
            raise Exception(f"Failed to fetch user by Google ID: {str(e)}")

    def createOrUpdateGoogleUser(self, googleId, email, name, profilePicture):
        try:
            user = self.session.query(User).filter_by(googleId=googleId).first()
            if not user:
                user = self.session.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    username=email.split('@')[0],
                    email=email,
                    googleId=googleId,
                    profilePicture=profilePicture,
                    createdAt=datetime.utcnow()
                )
                self.session.add(user)
            else:
                user.googleId = googleId
                user.profilePicture = profilePicture
            self.session.commit()
            return user
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to create/update Google user: {str(e)}")

    def updateLastLogin(self, userId):
        try:
            user = self.session.get(User, userId)
            if user:
                user.lastLogin = datetime.utcnow()
                self.session.commit()
            return user
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update last login: {str(e)}")
