"""Is this request the site owner?

One implementation, two callers with different reasons for asking:
`require_tab_visible` lets the owner see a hidden tab, and the analytics
service must not record his own reloads as anonymous traffic. They had drifted
into two copies of the same two-cookie probe.

**Expired tokens count.** The access token lives 30 minutes; the refresh token
7 days. `decode_token(allow_expired=True)` still verifies the signature, so an
expired access token is proof of who the caller is even though it is no longer
proof that they may *do* anything. That distinction is the whole point: this is
recognition, not authorisation. Nothing here grants access — every protected
route still carries `@jwt_required()`.
"""
from flask import current_app, request
from flask_jwt_extended import decode_token

#: (config key, default cookie name), in the order they are tried.
_COOKIES = (
    ('JWT_ACCESS_COOKIE_NAME', 'access_token'),
    ('JWT_REFRESH_COOKIE_NAME', 'refresh_token'),
)


def adminIdentity():
    """The owner's JWT subject, or None. Signature-verified; expiry ignored."""
    for configKey, default in _COOKIES:
        try:
            token = request.cookies.get(current_app.config.get(configKey, default))
            if not token:
                continue
            identity = decode_token(token, allow_expired=True).get('sub')
            if identity:
                return identity
        except Exception:
            # A malformed or foreign-signed cookie is simply not an admin.
            continue
    return None


def isAdminRequest():
    return adminIdentity() is not None
