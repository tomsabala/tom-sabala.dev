"""
Tab visibility guard decorator.

Routes decorated with @require_tab_visible('cv') will return 404 to any
non-admin request when that tab has been hidden via the Settings page.

Admin detection: checks the access_token cookie (valid or expired), then
falls back to the refresh_token cookie (7-day persistent). decode_token
with allow_expired=True validates the JWT signature while ignoring expiry,
so the admin is recognised even after token expiry or browser restart.

Note: direct browser resource loads (PDF file embeds, <img> tags) do not
send HttpOnly cookies in Firefox for cross-origin requests. Endpoints
serving binary files must NOT use this decorator — guard the JSON metadata
endpoint instead. If the public cannot get the metadata, they cannot
discover the file URL through normal API usage.
"""
from functools import wraps
from flask import jsonify, request, current_app
from flask_jwt_extended import decode_token


def require_tab_visible(tabKey: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            identity = None

            # Step 1: decode access_token cookie (valid or expired)
            try:
                cookieName = current_app.config.get('JWT_ACCESS_COOKIE_NAME', 'access_token')
                token = request.cookies.get(cookieName)
                if token:
                    decoded = decode_token(token, allow_expired=True)
                    identity = decoded.get('sub')
            except Exception:
                pass

            # Step 2: fallback — refresh_token (7-day persistent, survives browser restarts)
            if not identity:
                try:
                    refreshCookieName = current_app.config.get('JWT_REFRESH_COOKIE_NAME', 'refresh_token')
                    refreshToken = request.cookies.get(refreshCookieName)
                    if refreshToken:
                        decoded = decode_token(refreshToken, allow_expired=True)
                        identity = decoded.get('sub')
                except Exception:
                    pass

            if identity:
                return f(*args, **kwargs)  # admin — always allow

            # Not admin — check tab visibility
            from app import db
            from app.dao.tab_config_dao import TabConfigDAO
            visible = TabConfigDAO(db.session).getVisible()
            if tabKey not in visible:
                return jsonify({'success': False, 'error': 'Not found'}), 404

            return f(*args, **kwargs)
        return wrapper
    return decorator
