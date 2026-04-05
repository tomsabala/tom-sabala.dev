"""
Tab visibility guard decorator.

Routes decorated with @require_tab_visible('cv') will return 404 to any
non-admin request when that tab has been hidden via the Settings page.

Admin detection: a valid JWT access token in the request cookies.
If the token is present (even if expired), the request is always allowed
through — so the admin can still access hidden pages even when the
access token has expired (e.g. for direct browser resource loads like PDFs
that bypass the axios refresh interceptor).
"""
import sys
from functools import wraps
from flask import jsonify, request, current_app
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, decode_token


def require_tab_visible(tabKey: str):
    """
    Decorator factory. Usage:

        @resume_bp.route('/cv', methods=['GET'])
        @require_tab_visible('cv')
        def getCv():
            ...

    Logic:
        1. Try standard optional JWT verification (valid, non-expired token).
        2. If valid identity found → admin; allow through unconditionally.
        3. If token exists but is expired, decode without expiry check to
           still identify admin (covers direct browser resource loads).
        4. Otherwise → query DB for visible tabs; return 404 if tabKey absent.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            identity = None

            # Step 1: standard JWT check (valid, non-expired token)
            try:
                verify_jwt_in_request(optional=True)
                identity = get_jwt_identity()
                print(f'[tab_guard:{tabKey}] step1 identity={identity!r}', file=sys.stderr)
            except Exception as e:
                print(f'[tab_guard:{tabKey}] step1 exception: {e!r}', file=sys.stderr)
                # Token present but expired or invalid — fall through to step 2
                pass

            # Step 2: if token was rejected, try decoding ignoring expiry
            # This handles direct browser requests (PDF embeds, etc.) where
            # the axios refresh interceptor doesn't run
            if not identity:
                try:
                    cookieName = current_app.config.get('JWT_ACCESS_COOKIE_NAME', 'access_token')
                    token = request.cookies.get(cookieName)
                    print(f'[tab_guard:{tabKey}] step2 cookieName={cookieName!r} token_present={bool(token)}', file=sys.stderr)
                    if token:
                        decoded = decode_token(token, allow_expired=True)
                        identity = decoded.get('sub')
                        print(f'[tab_guard:{tabKey}] step2 decoded identity={identity!r}', file=sys.stderr)
                except Exception as e:
                    print(f'[tab_guard:{tabKey}] step2 exception: {e!r}', file=sys.stderr)
                    pass

            if identity:
                print(f'[tab_guard:{tabKey}] admin pass (identity={identity!r})', file=sys.stderr)
                return f(*args, **kwargs)  # admin: always allow

            # Step 3: not admin — check tab visibility
            from app import db
            from app.dao.tab_config_dao import TabConfigDAO
            visible = TabConfigDAO(db.session).getVisible()
            print(f'[tab_guard:{tabKey}] public check — visible={visible}, tabKey={tabKey!r}, result={"allow" if tabKey in visible else "404"}', file=sys.stderr)
            if tabKey not in visible:
                return jsonify({'success': False, 'error': 'Not found'}), 404

            return f(*args, **kwargs)
        return wrapper
    return decorator
