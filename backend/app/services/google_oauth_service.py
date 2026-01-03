"""
Google OAuth service for verifying Google ID tokens
"""
from google.oauth2 import id_token
from google.auth.transport import requests
import os


class GoogleOAuthService:
    """Service class for handling Google OAuth authentication"""

    @staticmethod
    def verifyGoogleToken(token):
        """
        Verify Google ID token and extract user info

        Args:
            token (str): Google ID token from frontend

        Returns:
            tuple: (user_info: dict or None, error: str or None)
            user_info contains: email, name, picture, sub (Google user ID)
        """
        try:
            clientId = os.getenv('GOOGLE_CLIENT_ID')
            if not clientId:
                return (None, "Google OAuth not configured")

            # Verify the token with Google
            idInfo = id_token.verify_oauth2_token(
                token,
                requests.Request(),
                clientId
            )

            # Token is valid - extract user information
            userInfo = {
                'email': idInfo.get('email'),
                'name': idInfo.get('name'),
                'picture': idInfo.get('picture'),
                'googleId': idInfo.get('sub'),
                'emailVerified': idInfo.get('email_verified', False)
            }

            return (userInfo, None)

        except ValueError as e:
            # Invalid token
            return (None, f"Invalid Google token: {str(e)}")
        except Exception as e:
            return (None, f"Token verification failed: {str(e)}")

    @staticmethod
    def isEmailWhitelisted(email):
        """
        Check if email is in the whitelist

        Args:
            email (str): Email address to check

        Returns:
            bool: True if email is whitelisted
        """
        whitelist = os.getenv('GOOGLE_OAUTH_WHITELIST', '').split(',')
        whitelist = [e.strip().lower() for e in whitelist if e.strip()]
        return email.lower() in whitelist
