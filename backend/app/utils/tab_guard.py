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
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            identity = None

            # Dump ALL cookies present in the request
            allCookies = dict(request.cookies)
            print(f'[tab_guard:{tabKey}] all cookies: {list(allCookies.keys())}', file=sys.stderr)

            # Step 1: standard JWT check (valid, non-expired token)
            try:
                verify_jwt_in_request(optional=True)
                identity = get_jwt_identity()
                print(f'[tab_guard:{tabKey}] step1 identity={identity!r}', file=sys.stderr)
            except Exception as e:
                print(f'[tab_guard:{tabKey}] step1 exception: {type(e).__name__}: {e}', file=sys.stderr)

            # Step 2: decode access_token ignoring expiry
            if not identity:
                try:
                    cookieName = current_app.config.get('JWT_ACCESS_COOKIE_NAME', 'access_token')
                    token = request.cookies.get(cookieName)
                    print(f'[tab_guard:{tabKey}] step2 cookieName={cookieName!r} present={bool(token)}', file=sys.stderr)
                    if token:
                        decoded = decode_token(token, allow_expired=True)
                        identity = decoded.get('sub')
                        print(f'[tab_guard:{tabKey}] step2 decoded sub={identity!r} type={decoded.get("type")}', file=sys.stderr)
                except Exception as e:
                    print(f'[tab_guard:{tabKey}] step2 exception: {type(e).__name__}: {e}', file=sys.stderr)

            # Step 3: fallback to refresh_token
            if not identity:
                try:
                    refreshCookieName = current_app.config.get('JWT_REFRESH_COOKIE_NAME', 'refresh_token')
                    refreshToken = request.cookies.get(refreshCookieName)
                    print(f'[tab_guard:{tabKey}] step3 refreshCookieName={refreshCookieName!r} present={bool(refreshToken)}', file=sys.stderr)
                    if refreshToken:
                        decoded = decode_token(refreshToken, allow_expired=True)
                        identity = decoded.get('sub')
                        print(f'[tab_guard:{tabKey}] step3 decoded sub={identity!r} type={decoded.get("type")}', file=sys.stderr)
                except Exception as e:
                    print(f'[tab_guard:{tabKey}] step3 exception: {type(e).__name__}: {e}', file=sys.stderr)

            if identity:
                print(f'[tab_guard:{tabKey}] ADMIN PASS identity={identity!r}', file=sys.stderr)
                return f(*args, **kwargs)

            # Not admin — check tab visibility
            from app import db
            from app.dao.tab_config_dao import TabConfigDAO
            visible = TabConfigDAO(db.session).getVisible()
            print(f'[tab_guard:{tabKey}] PUBLIC CHECK visible={visible} -> {"ALLOW" if tabKey in visible else "404"}', file=sys.stderr)
            if tabKey not in visible:
                return jsonify({'success': False, 'error': 'Not found'}), 404

            return f(*args, **kwargs)
        return wrapper
    return decorator
