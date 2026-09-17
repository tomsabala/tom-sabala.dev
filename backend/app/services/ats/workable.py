"""Workable board widget API.

GET https://apply.workable.com/api/v1/widget/accounts/{token}?details=true
Verified live against token `world-central-kitchen`: envelope
{description, jobs, name}; per-job fields shortcode / title / url /
department / telecommuting / city / state / country / locations /
published_on / created_at / description (HTML).
"""
from app.services.agent.html_text import htmlToText
from app.services.ats.base import AtsAdapter, httpGetJson, parseIso


def _location(job):
    parts = [job.get('city'), job.get('state'), job.get('country')]
    seen = []
    for part in parts:
        if part and part not in seen:
            seen.append(part)
    if seen:
        return ', '.join(seen)
    locations = job.get('locations')
    if isinstance(locations, list) and locations and isinstance(locations[0], dict):
        first = locations[0]
        return ', '.join(x for x in [first.get('city'), first.get('region'), first.get('country')] if x) or None
    return None


class WorkableAdapter(AtsAdapter):
    provider = 'workable'

    def fetchPostings(self, token):
        body = httpGetJson(
            self.provider,
            f'https://apply.workable.com/api/v1/widget/accounts/{token}?details=true',
        )
        jobs = body.get('jobs') if isinstance(body, dict) else None
        if not isinstance(jobs, list):
            return []

        postings = []
        for job in jobs:
            if not isinstance(job, dict) or not job.get('shortcode') or not job.get('title'):
                continue
            postings.append({
                'externalId': str(job['shortcode']),
                'title': job['title'],
                'url': job.get('url') or job.get('shortlink') or '',
                'location': _location(job),
                'department': job.get('department'),
                'isRemote': job.get('telecommuting'),
                'postedAt': parseIso(job.get('published_on')) or parseIso(job.get('created_at')),
                'description': htmlToText(job.get('description') or '') or None,
            })
        return postings

    def boardUrl(self, token):
        return f'https://apply.workable.com/{token}/'
