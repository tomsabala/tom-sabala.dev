"""Lever postings API.

GET https://api.lever.co/v0/postings/{token}?mode=json
Verified live against token `spotify`: top-level array, fields id / text /
hostedUrl / categories.{location,department} / workplaceType /
createdAt (epoch MILLISECONDS) / descriptionPlain.
"""
from datetime import datetime, timezone

from app.services.ats.base import AtsAdapter, httpGetJson


class LeverAdapter(AtsAdapter):
    provider = 'lever'

    def fetchPostings(self, token):
        body = httpGetJson(self.provider, f'https://api.lever.co/v0/postings/{token}?mode=json')
        if not isinstance(body, list):
            return []

        postings = []
        for job in body:
            if not isinstance(job, dict) or not job.get('id') or not job.get('text'):
                continue
            categories = job.get('categories') if isinstance(job.get('categories'), dict) else {}
            postedAt = None
            createdAt = job.get('createdAt')
            if isinstance(createdAt, (int, float)):
                # Milliseconds since the epoch; seconds would land in 1970.
                postedAt = datetime.fromtimestamp(createdAt / 1000, tz=timezone.utc).replace(tzinfo=None)
            postings.append({
                'externalId': str(job['id']),
                'title': job['text'],
                'url': job.get('hostedUrl') or '',
                'location': categories.get('location'),
                'department': categories.get('department'),
                'isRemote': job.get('workplaceType') == 'remote',
                'postedAt': postedAt,
                'description': job.get('descriptionPlain') or None,
            })
        return postings

    def boardUrl(self, token):
        return f'https://jobs.lever.co/{token}'
