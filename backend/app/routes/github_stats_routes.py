"""
GitHub Stats routes — fetches and caches public GitHub contribution data.

Requires GITHUB_STATS_TOKEN env var for contribution calendar (GraphQL).
Without it, stars, repos, PRs, and language breakdown still work.
"""
import os
import logging
import traceback
import requests
from flask import Blueprint, jsonify
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

github_stats_bp = Blueprint('github_stats', __name__)

GITHUB_USERNAME = os.getenv('GITHUB_USERNAME')  # Required — feature disabled if unset
CACHE_TTL = 3600  # 1 hour

LANG_COLORS = {
    'TypeScript': '#3178c6',
    'Python': '#3572A5',
    'JavaScript': '#f1e05a',
    'CSS': '#563d7c',
    'HTML': '#e34c26',
    'Go': '#00ADD8',
    'Rust': '#dea584',
    'Java': '#b07219',
    'C': '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    'Ruby': '#701516',
    'Shell': '#89e051',
    'Swift': '#ffac45',
    'Kotlin': '#A97BFF',
    'PHP': '#4F5D95',
    'SCSS': '#c6538c',
    'Vue': '#41b883',
    'Svelte': '#ff3e00',
    'Dart': '#00B4AB',
    'Jupyter Notebook': '#DA5B0B',
}

_cache = {'data': None, 'updated': None}


def _buildHeaders():
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'tom-sabala-portfolio',
    }
    token = os.getenv('GITHUB_STATS_TOKEN')
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return headers


def _fetchContributionsGraphQL():
    """Fetch the contribution calendar via GitHub GraphQL API (requires GITHUB_STATS_TOKEN)."""
    token = os.getenv('GITHUB_STATS_TOKEN')
    if not token:
        return None

    now = datetime.utcnow()
    fromDate = (now - timedelta(weeks=53)).strftime('%Y-%m-%dT00:00:00Z')
    toDate = now.strftime('%Y-%m-%dT23:59:59Z')

    query = """
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
    """

    try:
        resp = requests.post(
            'https://api.github.com/graphql',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json={
                'query': query,
                'variables': {'login': GITHUB_USERNAME, 'from': fromDate, 'to': toDate},
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        return (
            payload.get('data', {})
            .get('user', {})
            .get('contributionsCollection', {})
            .get('contributionCalendar')
        )
    except Exception:
        return None


def _buildContributionGrid(calendar):
    """Convert GitHub calendar weeks to a 52×7 grid [week][day], Sun=0, Sat=6."""
    weeks = calendar.get('weeks', [])[-52:]
    grid = []
    for week in weeks:
        # Sort days by date (GitHub returns Sun→Sat per week)
        days = sorted(week.get('contributionDays', []), key=lambda d: d['date'])
        counts = [d.get('contributionCount', 0) for d in days]
        while len(counts) < 7:
            counts.append(0)
        grid.append(counts[:7])
    # Pad to exactly 52 weeks if calendar was shorter
    while len(grid) < 52:
        grid.insert(0, [0] * 7)
    return grid


def _calculateStreaks(grid):
    """Return (currentStreak, longestStreak) in days from a 52×7 grid."""
    flat = [day for week in grid for day in week]
    # Drop trailing zeros — today may not have contributions yet
    while flat and flat[-1] == 0:
        flat.pop()

    currentStreak = 0
    for count in reversed(flat):
        if count > 0:
            currentStreak += 1
        else:
            break

    longestStreak = 0
    running = 0
    for count in flat:
        if count > 0:
            running += 1
            longestStreak = max(longestStreak, running)
        else:
            running = 0

    return currentStreak, longestStreak


def _fetchStats():
    headers = _buildHeaders()
    hasToken = bool(os.getenv('GITHUB_STATS_TOKEN'))
    logger.info('Fetching GitHub stats for %s (token: %s)', GITHUB_USERNAME, hasToken)

    # ── User profile ──────────────────────────────────────────────────────────
    userResp = requests.get(
        f'https://api.github.com/users/{GITHUB_USERNAME}',
        headers=headers,
        timeout=10,
    )
    if userResp.status_code != 200:
        logger.error('GitHub user fetch failed: %s %s', userResp.status_code, userResp.text[:200])
        userResp.raise_for_status()
    user = userResp.json()

    # ── Repos ─────────────────────────────────────────────────────────────────
    # /user/repos returns private + public when authenticated; falls back to
    # /users/{login}/repos (public only) when no token is present.
    reposUrl = (
        'https://api.github.com/user/repos?per_page=100&affiliation=owner'
        if hasToken else
        f'https://api.github.com/users/{GITHUB_USERNAME}/repos?per_page=100&type=owner'
    )
    reposResp = requests.get(reposUrl, headers=headers, timeout=10)
    repos = reposResp.json() if reposResp.status_code == 200 else []
    if reposResp.status_code != 200:
        logger.warning('GitHub repos fetch returned %s', reposResp.status_code)

    stars = sum(r.get('stargazers_count', 0) for r in repos if isinstance(r, dict))

    # Log each repo for debugging language breakdown
    for repo in repos:
        if isinstance(repo, dict):
            logger.info(
                'repo: %s | lang: %s | fork: %s | private: %s',
                repo.get('name'),
                repo.get('language'),
                repo.get('fork'),
                repo.get('private'),
            )

    # Language breakdown by repo count (primary language per repo)
    langCounts: dict = {}
    for repo in repos:
        if isinstance(repo, dict) and not repo.get('fork', False):
            lang = repo.get('language')
            if lang:
                langCounts[lang] = langCounts.get(lang, 0) + 1

    topLangs = sorted(langCounts.items(), key=lambda x: -x[1])[:5]
    topTotal = sum(v for _, v in topLangs) or 1
    remaining = 100
    languages = []
    for i, (lang, count) in enumerate(topLangs):
        if i == len(topLangs) - 1:
            pct = remaining
        else:
            pct = round(count / topTotal * 100)
            remaining -= pct
        languages.append({
            'name': lang,
            'pct': max(1, pct),
            'color': LANG_COLORS.get(lang, '#8b949e'),
        })

    # ── Merged PRs ────────────────────────────────────────────────────────────
    prs = 0
    try:
        prResp = requests.get(
            f'https://api.github.com/search/issues'
            f'?q=type:pr+author:{GITHUB_USERNAME}+is:merged&per_page=1',
            headers=headers,
            timeout=10,
        )
        if prResp.status_code == 200:
            prs = prResp.json().get('total_count', 0)
        else:
            logger.warning('GitHub PR search returned %s', prResp.status_code)
    except Exception:
        logger.warning('GitHub PR search failed', exc_info=True)

    # ── Contribution calendar ─────────────────────────────────────────────────
    contributions = [[0] * 7 for _ in range(52)]
    totalContributions = 0
    currentStreak = 0
    longestStreak = 0
    hasContributionData = False

    calendar = _fetchContributionsGraphQL()
    if calendar:
        hasContributionData = True
        totalContributions = calendar.get('totalContributions', 0)
        contributions = _buildContributionGrid(calendar)
        currentStreak, longestStreak = _calculateStreaks(contributions)

    logger.info(
        'GitHub stats fetched: repos=%d stars=%d prs=%d contributions=%d',
        len(repos), stars, prs, totalContributions,
    )

    return {
        'username': GITHUB_USERNAME,
        'publicRepos': user.get('public_repos', 0),
        'stars': stars,
        'prs': prs,
        'totalContributions': totalContributions,
        'currentStreak': currentStreak,
        'longestStreak': longestStreak,
        'contributions': contributions,
        'languages': languages,
        'fetchedAt': datetime.utcnow().isoformat() + 'Z',
        'hasContributionData': hasContributionData,
    }


@github_stats_bp.route('/github-stats/status', methods=['GET'])
def getGithubStatsStatus():
    return jsonify({'enabled': bool(GITHUB_USERNAME)})


@github_stats_bp.route('/github-stats', methods=['GET'])
def getGithubStats():
    if not GITHUB_USERNAME:
        return jsonify({'success': False, 'disabled': True}), 503

    now = datetime.utcnow()
    cached = _cache.get('data')
    updatedAt = _cache.get('updated')

    if cached and updatedAt and (now - updatedAt).total_seconds() < CACHE_TTL:
        return jsonify({'success': True, 'data': cached, 'cached': True})

    try:
        data = _fetchStats()
        _cache['data'] = data
        _cache['updated'] = now
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        logger.error(
            'GitHub stats endpoint failed: %s\n%s',
            str(e),
            traceback.format_exc(),
        )
        if cached:
            logger.info('Returning stale cached stats after error')
            return jsonify({'success': True, 'data': cached, 'cached': True, 'stale': True})
        return jsonify({'success': False, 'error': 'Failed to fetch GitHub stats'}), 500
