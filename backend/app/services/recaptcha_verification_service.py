"""
reCAPTCHA v3 verification service.
Handles token verification with Google's reCAPTCHA API.
Follows EmailService pattern with static methods and tuple return values.
"""
import os
import requests
from typing import Optional


class RecaptchaVerificationService:
    """Service for verifying reCAPTCHA v3 tokens with Google API."""

    GOOGLE_RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'
    DEFAULT_MINIMUM_SCORE = 0.5
    REQUEST_TIMEOUT_SECONDS = 5

    @staticmethod
    def verifyRecaptchaToken(
        recaptchaToken: str,
        userIpAddress: Optional[str] = None,
        minimumAcceptableScore: Optional[float] = None
    ) -> tuple[bool, Optional[str], Optional[float]]:
        """
        Verify reCAPTCHA v3 token with Google API.

        Args:
            recaptchaToken: Token from frontend reCAPTCHA execution
            userIpAddress: User's IP address (optional, improves accuracy)
            minimumAcceptableScore: Score threshold 0.0-1.0 (default from env)

        Returns:
            Tuple of (success, error_message, score)
            - (True, None, 0.9) if verification succeeds
            - (False, "error details", 0.3) if verification fails
            - (False, "error", None) if API call fails
        """
        # Get configuration from environment
        recaptchaSecretKey = os.getenv('RECAPTCHA_V3_SECRET_KEY')

        if not recaptchaSecretKey or recaptchaSecretKey == 'your-recaptcha-secret-key-here':
            return (False, 'reCAPTCHA not configured on server', None)

        # Use environment-configured minimum score or provided override
        if minimumAcceptableScore is None:
            minimumAcceptableScore = float(os.getenv(
                'RECAPTCHA_MINIMUM_SCORE',
                str(RecaptchaVerificationService.DEFAULT_MINIMUM_SCORE)
            ))

        # Validate token is provided
        if not recaptchaToken or not recaptchaToken.strip():
            return (False, 'reCAPTCHA token missing', None)

        try:
            # Prepare request payload
            verificationPayload = {
                'secret': recaptchaSecretKey,
                'response': recaptchaToken
            }

            # Add IP address if provided (improves Google's accuracy)
            if userIpAddress:
                verificationPayload['remoteip'] = userIpAddress

            # Send verification request to Google
            googleResponse = requests.post(
                RecaptchaVerificationService.GOOGLE_RECAPTCHA_VERIFY_URL,
                data=verificationPayload,
                timeout=RecaptchaVerificationService.REQUEST_TIMEOUT_SECONDS
            )

            googleResponse.raise_for_status()
            responseData = googleResponse.json()

            # Check if verification succeeded
            verificationSucceeded = responseData.get('success', False)
            if not verificationSucceeded:
                errorCodes = responseData.get('error-codes', [])
                return (False, f'reCAPTCHA verification failed: {errorCodes}', None)

            # Verify action matches (prevents token reuse from other forms)
            expectedAction = 'contact_form'
            actualAction = responseData.get('action', '')
            if actualAction != expectedAction:
                return (False, f'Invalid action: expected {expectedAction}, got {actualAction}', None)

            # Check score meets minimum threshold
            userScore = responseData.get('score', 0.0)
            if userScore < minimumAcceptableScore:
                return (False, f'Score too low: {userScore} < {minimumAcceptableScore}', userScore)

            # Verification successful
            return (True, None, userScore)

        except requests.exceptions.Timeout:
            return (False, 'reCAPTCHA verification timeout', None)
        except requests.exceptions.RequestException as requestError:
            return (False, f'reCAPTCHA API request failed: {str(requestError)}', None)
        except Exception as unexpectedError:
            return (False, f'Unexpected error during verification: {str(unexpectedError)}', None)
