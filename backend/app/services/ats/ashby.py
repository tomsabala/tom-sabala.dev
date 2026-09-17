"""Ashby job board API.

GET https://api.ashbyhq.com/posting-api/job-board/{token}
Verified live against token `ashby`: 70 jobs, fields id / title / jobUrl /
location / department / isRemote / publishedAt / isListed / descriptionPlain.
"""
from app.services.ats.base import AtsAdapter, httpGetJson, parseIso


class AshbyAdapter(AtsAdapter):
    provider = 'ashby'

    def fetchPostings(self, token):
        body = httpGetJson(self.provider, f'https://api.ashbyhq.com/posting-api/job-board/{token}')
        jobs = body.get('jobs') if isinstance(body, dict) else None
        if not isinstance(jobs, list):
            return []

        postings = []
        for job in jobs:
            if not isinstance(job, dict) or not job.get('id') or not job.get('title'):
                continue
            if job.get('isListed') is False:
                continue
            postings.append({
                'externalId': str(job['id']),
                'title': job['title'],
                'url': job.get('jobUrl') or '',
                'location': job.get('location'),
                'department': job.get('department'),
                'isRemote': job.get('isRemote'),
                'postedAt': parseIso(job.get('publishedAt')),
                'description': job.get('descriptionPlain') or None,
            })
        return postings

    def boardUrl(self, token):
        return f'https://jobs.ashbyhq.com/{token}'
