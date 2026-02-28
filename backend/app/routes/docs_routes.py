"""
Docs routes - GitHub webhook receiver and static asset serving for project docs
"""
import hashlib
import hmac
import os
import subprocess
import sys
from flask import Blueprint, request, jsonify, send_file, abort
from werkzeug.utils import safe_join

docs_bp = Blueprint('docs', __name__)

DOCS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'docs')


def _docsPath(slug: str, *parts) -> str:
    """Resolve a safe path inside docs/<slug>/"""
    base = os.path.realpath(os.path.join(DOCS_DIR, slug))
    target = os.path.realpath(os.path.join(base, *parts))
    # Prevent path traversal
    if not target.startswith(base + os.sep) and target != base:
        abort(400, description='Invalid path')
    return target


@docs_bp.route('/docs/webhook', methods=['POST'])
def githubWebhook():
    """
    Receive GitHub push webhook and git-pull the updated docs.

    Expects GitHub to send X-Hub-Signature-256 header signed with DOCS_WEBHOOK_SECRET.
    The slug is read from the repository name in the payload (e.g. "CGEO-docs" → "cgeo").

    Returns:
        200: Pull succeeded
        400: Signature missing / payload invalid
        403: Signature mismatch
        500: git pull failed
    """
    secret = os.getenv('DOCS_WEBHOOK_SECRET', '')

    # Verify signature when a secret is configured
    if secret:
        sigHeader = request.headers.get('X-Hub-Signature-256', '')
        if not sigHeader:
            return jsonify({'error': 'Missing signature'}), 400

        expected = 'sha256=' + hmac.new(
            secret.encode(), request.data, hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(sigHeader, expected):
            return jsonify({'error': 'Signature mismatch'}), 403

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({'error': 'Invalid payload'}), 400

    # Derive slug from repo name: "CGEO-docs" → "cgeo"
    repoName = payload.get('repository', {}).get('name', '')
    slug = repoName.replace('-docs', '').replace('_docs', '').lower()

    repoDir = os.path.join(DOCS_DIR, slug)
    if not os.path.isdir(os.path.join(repoDir, '.git')):
        print(f"[docs webhook] No git repo at {repoDir}", file=sys.stderr)
        return jsonify({'error': f'No docs repo for slug "{slug}"'}), 404

    try:
        result = subprocess.run(
            ['git', 'pull', '--ff-only'],
            cwd=repoDir,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            print(f"[docs webhook] git pull failed: {result.stderr}", file=sys.stderr)
            return jsonify({'error': 'git pull failed', 'detail': result.stderr}), 500

        print(f"[docs webhook] Pulled docs for slug '{slug}': {result.stdout.strip()}", file=sys.stderr)
        return jsonify({'success': True, 'output': result.stdout.strip()}), 200
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'git pull timed out'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@docs_bp.route('/docs/<slug>/assets/<path:filename>', methods=['GET'])
def serveDocAsset(slug, filename):
    """
    Serve a static asset (image, etc.) from docs/<slug>/assets/<filename>.

    Args:
        slug (str): Project docs slug (e.g. "cgeo")
        filename (str): Relative path inside the assets directory

    Returns:
        200: File content
        404: File not found
    """
    assetPath = _docsPath(slug, 'assets', filename)

    if not os.path.isfile(assetPath):
        abort(404)

    return send_file(assetPath)
