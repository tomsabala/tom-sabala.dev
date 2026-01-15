"""
CSRF protection utilities for double-submit cookie pattern.
Provides token generation, cookie management, and validation.
"""
from __future__ import annotations
import os
import secrets
from flask import Response


def generateCsrfToken() -> str:
    """
    Generate cryptographically secure random token using secrets module.
    Returns 32-byte URL-safe token (43 characters after base64 encoding).
    """
    return secrets.token_urlsafe(32)


def attachCsrfCookieToResponse(response: Response, csrfToken: str) -> Response:
    """
    Attach CSRF token as cookie to Flask response object.

    Cookie properties:
    - HttpOnly=False: JavaScript must read it for header
    - SameSite=None: Allow cross-site requests in production (Vercel frontend)
    - Secure=True: HTTPS only (required when SameSite=None)
    - Partitioned=True: Chrome CHIPS for cross-site cookies
    - Max-Age=3600: 1-hour expiry

    Args:
        response: Flask response object
        csrfToken: Generated CSRF token string

    Returns:
        Modified Flask response with cookie attached
    """
    isProductionEnvironment = os.getenv('FLASK_ENV') == 'production'

    response.set_cookie(
        key='csrf_token',
        value=csrfToken,
        max_age=3600,  # 1 hour
        secure=True,  # Required for SameSite=None
        httponly=False,  # Must be False so JavaScript can read it
        samesite='None' if isProductionEnvironment else 'Lax',  # None for cross-site, Lax for dev
        partitioned=isProductionEnvironment,  # CHIPS for cross-site cookies in production
        path='/'
    )
    return response


def validateCsrfToken(csrfTokenFromCookie: str | None, csrfTokenFromHeader: str | None) -> tuple[bool, str | None]:
    """
    Validate CSRF token using double-submit cookie pattern.
    Uses secrets.compare_digest() to prevent timing attacks.

    Args:
        csrfTokenFromCookie: Token from request cookie
        csrfTokenFromHeader: Token from X-CSRF-Token header

    Returns:
        Tuple of (is_valid, error_message)
        - (True, None) if validation succeeds
        - (False, error_message) if validation fails
    """
    # Check both tokens are present
    if not csrfTokenFromCookie:
        return (False, 'CSRF token cookie missing')

    if not csrfTokenFromHeader:
        return (False, 'CSRF token header missing')

    # Use secrets.compare_digest to prevent timing attacks
    tokensMatch = secrets.compare_digest(csrfTokenFromCookie, csrfTokenFromHeader)

    if not tokensMatch:
        return (False, 'CSRF token mismatch')

    return (True, None)
