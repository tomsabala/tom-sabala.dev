"""
Docs routes - GitHub webhook receiver and static asset serving for project docs
"""
import hashlib
import hmac
import io
import os
import shutil
import sys
import tarfile
import threading
import requests as httpx
from flask import Blueprint, request, jsonify, send_file, abort

docs_bp = Blueprint('docs', __name__)

DOCS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'docs')

REPO_MAP = {
    'cgeo': 'tomsabala/CGEO-docs',
}


def _docsPath(slug: str, *parts) -> str:
    """Resolve a safe path inside docs/<slug>/"""
    base = os.path.realpath(os.path.join(DOCS_DIR, slug))
    target = os.path.realpath(os.path.join(base, *parts))
    if not target.startswith(base + os.sep) and target != base:
        abort(400, description='Invalid path')
    return target


def _downloadAndExtract(slug: str, repo: str, branch: str = 'main'):
    """Download repo tarball from GitHub and extract to docs/<slug>/"""
    destDir = os.path.realpath(os.path.join(DOCS_DIR, slug))
    url = f'https://api.github.com/repos/{repo}/tarball/{branch}'

    print(f'[docs webhook] Downloading {repo}@{branch} → docs/{slug}/', flush=True)

    try:
        headers = {'User-Agent': 'portfolio-docs'}
        token = os.getenv('GITHUB_TOKEN')
        if token:
            headers['Authorization'] = f'Bearer {token}'
        resp = httpx.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.content
    except Exception as e:
        print(f'[docs webhook] Download failed: {e}', file=sys.stderr)
        return

    if os.path.exists(destDir):
        shutil.rmtree(destDir)
    os.makedirs(destDir, exist_ok=True)

    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
            for member in tar.getmembers():
                parts = member.name.split('/', 1)
                if len(parts) < 2:
                    continue
                member.name = parts[1]
                if not member.name:
                    continue
                tar.extract(member, destDir, filter='data')
        print(f'[docs webhook] Updated docs/{slug}/', flush=True)
    except Exception as e:
        print(f'[docs webhook] Extraction failed: {e}', file=sys.stderr)


@docs_bp.route('/docs/webhook', methods=['POST'])
def githubWebhook():
    """
    Receive GitHub push webhook and re-download the updated docs tarball.

    Returns immediately with 202 and runs the update in a background thread
    to avoid GitHub's 10-second timeout.
    """
    secret = os.getenv('DOCS_WEBHOOK_SECRET', '')

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

    repoName = payload.get('repository', {}).get('name', '')
    branch = payload.get('ref', 'refs/heads/main').split('/')[-1]
    slug = repoName.replace('-docs', '').replace('_docs', '').lower()

    repo = REPO_MAP.get(slug)
    if not repo:
        return jsonify({'error': f'No docs configured for slug "{slug}"'}), 404

    threading.Thread(
        target=_downloadAndExtract,
        args=(slug, repo, branch),
        daemon=True
    ).start()

    return jsonify({'success': True, 'message': f'Updating docs/{slug}/ in background'}), 202


@docs_bp.route('/docs/<slug>/assets/<path:filename>', methods=['GET'])
def serveDocAsset(slug, filename):
    """Serve a static asset from docs/<slug>/assets/<filename>."""
    assetPath = _docsPath(slug, 'assets', filename)

    if not os.path.isfile(assetPath):
        abort(404)

    return send_file(assetPath)
