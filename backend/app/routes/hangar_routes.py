"""
Hangar routes - admin-only proxy to the apps gateway broker's status endpoint.

The browser cannot call the broker directly: it is a different origin, it is
deliberately absent from CORS_ORIGINS, and the __Host-apps_admin cookie that
authorises the broker's admin surface is SameSite=Lax. A server-to-server hop
carrying the shared X-Hangar-Token is therefore the only workable path.
"""
import os
import sys
import traceback

import requests
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

hangar_bp = Blueprint('hangar', __name__)

BROKER_TIMEOUT_SECONDS = 5


@hangar_bp.route('/hangar/instances', methods=['GET'])
@jwt_required()
def getHangarInstances():
    """
    Live instance status from the apps gateway broker (admin only).

    Returns:
        200: { success: true, data: { instances: [...], caps: {...} } }
        503: { success: false, error: 'Hangar status unavailable' }
    """
    brokerUrl = (os.environ.get('HANGAR_BROKER_URL') or '').rstrip('/')
    brokerToken = os.environ.get('HANGAR_BROKER_TOKEN') or ''
    if not brokerUrl or not brokerToken:
        return jsonify({'success': False, 'error': 'Hangar status unavailable'}), 503

    try:
        response = requests.get(
            f'{brokerUrl}/instances',
            headers={'X-Hangar-Token': brokerToken},
            timeout=BROKER_TIMEOUT_SECONDS
        )
        if response.status_code != 200:
            return jsonify({'success': False, 'error': 'Hangar status unavailable'}), 503
        return jsonify({'success': True, 'data': response.json()}), 200
    except Exception:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': 'Hangar status unavailable'}), 503
