"""SmartRecruiters postings API.

GET https://api.smartrecruiters.com/v1/companies/{token}/postings?limit=100&offset={n}
Verified live against token `SmartRecruiters`: envelope
{offset, limit, totalFound, content}; per-item fields id / name /
location.{city,region,country,remote,fullLocation} / department.label /
releasedDate. The list endpoint carries no description and no public URL, so
`description` stays None and the URL is built from the documented public
pattern (verified to return HTTP 200).
"""
from app.services.ats.base import AtsAdapter, httpGetJson, parseIso

PAGE_SIZE = 100
MAX_PAGES = 20


def _location(job):
    location = job.get('location') if isinstance(job.get('location'), dict) else {}
    full = location.get('fullLocation')
    if full:
        return full
    parts = [location.get('city'), location.get('region'), location.get('country')]
    return ', '.join(x for x in parts if x) or None


class SmartRecruitersAdapter(AtsAdapter):
    provider = 'smartrecruiters'

    def fetchPostings(self, token):
        postings = []
        offset = 0
        for _ in range(MAX_PAGES):
            body = httpGetJson(
                self.provider,
                f'https://api.smartrecruiters.com/v1/companies/{token}/postings'
                f'?limit={PAGE_SIZE}&offset={offset}',
            )
            if not isinstance(body, dict):
                break
            items = body.get('content')
            if not isinstance(items, list) or not items:
                break

            for job in items:
                if not isinstance(job, dict) or not job.get('id') or not job.get('name'):
                    continue
                location = job.get('location') if isinstance(job.get('location'), dict) else {}
                department = job.get('department') if isinstance(job.get('department'), dict) else {}
                postings.append({
                    'externalId': str(job['id']),
                    'title': job['name'].strip(),
                    'url': f"https://jobs.smartrecruiters.com/{token}/{job['id']}",
                    'location': _location(job),
                    'department': department.get('label'),
                    'isRemote': location.get('remote'),
                    'postedAt': parseIso(job.get('releasedDate')),
                    'description': None,
                })

            offset += len(items)
            if offset >= int(body.get('totalFound') or 0):
                break
        return postings
