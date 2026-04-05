"""
Tab visibility guard decorator.

Routes decorated with @require_tab_visible('cv') will return 404 to any
non-admin request when that tab has been hidden via the Settings page.

Admin detection: a valid JWT access token in the request cookies.
If the token is present and valid, the request is always allowed through —
regardless of tab visibility — so the admin can still manage hidden pages.
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity


def require_tab_visible(tabKey: str):
    """
    Decorator factory. Usage:

        @resume_bp.route('/cv', methods=['GET'])
        @require_tab_visible('cv')
        def getCv():
            ...

    Logic:
        1. Try optional JWT verification.
        2. If a valid identity is found → admin; allow through unconditionally.
        3. Otherwise → query DB for visible tabs; return 404 if tabKey absent.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Step 1: optional JWT check — does not raise on missing/invalid token
            try:
                verify_jwt_in_request(optional=True)
                if get_jwt_identity():
                    return f(*args, **kwargs)   # admin: always allow
            except Exception:
                pass  # no token, expired, or invalid — treat as public

            # Step 2: not admin — check tab visibility
            from app import db
            from app.dao.tab_config_dao import TabConfigDAO
            visible = TabConfigDAO(db.session).getVisible()
            if tabKey not in visible:
                return jsonify({'success': False, 'error': 'Not found'}), 404

            return f(*args, **kwargs)
        return wrapper
    return decorator
