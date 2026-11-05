"""
Tab visibility guard decorator.

Routes decorated with @require_tab_visible('cv') will return 404 to any
non-admin request when that tab has been hidden via the Settings page.

Admin detection lives in `app/utils/admin_identity.py` — the analytics service
needs the same answer for a different reason, and two copies of a JWT probe is
one copy too many.

Note: direct browser resource loads (PDF file embeds, <img> tags) do not
send HttpOnly cookies in Firefox for cross-origin requests. Endpoints
serving binary files must NOT use this decorator — guard the JSON metadata
endpoint instead. If the public cannot get the metadata, they cannot
discover the file URL through normal API usage.
"""
from functools import wraps
from flask import jsonify

from app.utils.admin_identity import isAdminRequest


def require_tab_visible(tabKey: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if isAdminRequest():
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
