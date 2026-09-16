"""Greenhouse job board API.

GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
Verified live against token `anthropic`: 600 jobs, fields id / title /
absolute_url / location.name / first_published / updated_at / content.
"""
import html

from app.services.agent.html_text import htmlToText
from app.services.ats.base import AtsAdapter, httpGetJson, parseIso


class GreenhouseAdapter(AtsAdapter):
    provider = 'greenhouse'

    def fetchPostings(self, token):
        body = httpGetJson(
            self.provider,
            f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true',
        )
        jobs = body.get('jobs') if isinstance(body, dict) else None
        if not isinstance(jobs, list):
            return []

        postings = []
        for job in jobs:
            if not isinstance(job, dict) or not job.get('id') or not job.get('title'):
                continue
            location = (job.get('location') or {}).get('name') if isinstance(job.get('location'), dict) else None
            content = job.get('content') or ''
            postings.append({
                'externalId': str(job['id']),
                'title': job['title'],
                'url': job.get('absolute_url') or '',
                'location': location,
                'department': None,
                'isRemote': 'remote' in (location or '').lower(),
                'postedAt': parseIso(job.get('first_published')) or parseIso(job.get('updated_at')),
                # `content` is HTML, escaped once by the API.
                'description': htmlToText(html.unescape(content)) or None,
            })
        return postings
