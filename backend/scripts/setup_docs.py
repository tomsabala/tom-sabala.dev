"""
Download project docs from GitHub as a tarball and extract to docs/<slug>/.
Run at startup to ensure docs are present.

Usage: python scripts/setup_docs.py
"""
import io
import os
import sys
import tarfile
import requests

DOCS = [
    {
        'slug': 'cgeo',
        'repo': 'tomsabala/CGEO-docs',
        'branch': 'main',
    }
]


def downloadAndExtract(slug, repo, branch):
    docsDir = os.path.join(os.path.dirname(__file__), '..', 'docs')
    destDir = os.path.realpath(os.path.join(docsDir, slug))

    url = f'https://api.github.com/repos/{repo}/tarball/{branch}'
    print(f'[setup_docs] Downloading {repo}@{branch} → docs/{slug}/', flush=True)

    try:
        headers = {'User-Agent': 'portfolio-setup'}
        token = os.getenv('GITHUB_TOKEN')
        if token:
            headers['Authorization'] = f'Bearer {token}'
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.content
    except Exception as e:
        print(f'[setup_docs] Download failed: {e}', file=sys.stderr)
        return False

    # Remove existing dir and re-extract cleanly
    import shutil
    if os.path.exists(destDir):
        shutil.rmtree(destDir)
    os.makedirs(destDir, exist_ok=True)

    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tar:
            for member in tar.getmembers():
                # GitHub tarballs have a top-level dir like "owner-repo-<sha>/"
                # Strip it so contents land directly in destDir
                parts = member.name.split('/', 1)
                if len(parts) < 2:
                    continue
                member.name = parts[1]
                if not member.name:
                    continue
                tar.extract(member, destDir, filter='data')
    except Exception as e:
        print(f'[setup_docs] Extraction failed: {e}', file=sys.stderr)
        return False

    print(f'[setup_docs] OK → {destDir}', flush=True)
    return True


if __name__ == '__main__':
    ok = True
    for entry in DOCS:
        ok = downloadAndExtract(**entry) and ok
    sys.exit(0 if ok else 1)
