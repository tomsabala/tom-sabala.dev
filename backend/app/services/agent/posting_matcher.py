"""'Have I already applied?' — a join on durable keys, never a model opinion.

Tiers, in order:
  1. job_applications.job_posting_id == posting.id      (the durable FK)
  2. normalised job_url == normalised posting.url
  3. same company AND exactly equal normalised title

A tier-2 or tier-3 hit records a link-back so the same pair resolves at tier 1
on every later run. The applications are normalised into lookup tables ONCE per
sweep: a linear rescan per posting turned a 600-posting board against a
100-application history into ~180k regex passes, and committing each link-back
inside that loop expired the session, forcing every posting row to be reloaded
one at a time for ranking.
"""
import re
import sys
import traceback
from urllib.parse import urlparse

from app.models import JobApplication

_WS = re.compile(r'\s+')
_TRAILING_BRACKETS = re.compile(r'[\(\[][^\(\)\[\]]*[\)\]]\s*$')
_NON_ALNUM = re.compile(r'[^a-z0-9 ]+')


def normalizeText(value):
    """Lowercase, drop a trailing parenthetical, strip punctuation, collapse space."""
    text = (value or '').strip().lower()
    while True:
        stripped = _TRAILING_BRACKETS.sub('', text).strip()
        if stripped == text:
            break
        text = stripped
    text = _NON_ALNUM.sub(' ', text)
    return _WS.sub(' ', text).strip()


def normalizeUrl(value):
    """Scheme+host lowercased, `www.` and query/fragment/trailing slash dropped."""
    if not value:
        return ''
    raw = value.strip()
    if not raw:
        return ''
    try:
        parsed = urlparse(raw if '//' in raw else f'https://{raw}')
    except ValueError:
        return raw.lower()
    host = (parsed.hostname or '').lower()
    if host.startswith('www.'):
        host = host[4:]
    path = (parsed.path or '').rstrip('/')
    if not host:
        return raw.lower()
    return f'{host}{path}'


class ApplicationIndex:
    """Every application, normalised once into the three lookup tiers.

    First application wins a contested key, ordered by id, so a run's matches
    are stable rather than dependent on row order.
    """

    def __init__(self, applications):
        self._byPostingId = {}
        self._byUrl = {}
        self._byCompanyId = {}
        self._byCompanyName = {}
        self._pendingLinks = {}

        for application in applications:
            if application.jobPostingId is not None:
                self._byPostingId.setdefault(application.jobPostingId, application)

            url = normalizeUrl(application.jobUrl)
            if url:
                self._byUrl.setdefault(url, application)

            title = normalizeText(application.position)
            if not title:
                # An empty normalised title would match every equally empty
                # posting title, so it never becomes a tier-3 key.
                continue
            if application.companyId is not None:
                self._byCompanyId.setdefault((application.companyId, title), application)
            companyName = normalizeText(application.companyName)
            if companyName:
                self._byCompanyName.setdefault((companyName, title), application)

    def find(self, posting, company=None):
        """Return the JobApplication already covering this posting, or None."""
        hit = self._byPostingId.get(posting.id)
        if hit is not None:
            return hit

        url = normalizeUrl(posting.url)
        if url:
            hit = self._byUrl.get(url)
            if hit is not None:
                return self._link(hit, posting)

        # Equality only — substring matching would collapse "Software Engineer"
        # into "Senior Software Engineer II".
        title = normalizeText(posting.title)
        if not title:
            return None
        hit = self._byCompanyId.get((posting.companyId, title))
        if hit is None and company is not None:
            companyName = normalizeText(company.name)
            if companyName:
                hit = self._byCompanyName.get((companyName, title))
        if hit is not None:
            return self._link(hit, posting)
        return None

    def _link(self, application, posting):
        """Queue the fallback match for a single write, and satisfy tier 1 now."""
        self._byPostingId.setdefault(posting.id, application)
        if application.jobPostingId != posting.id:
            self._pendingLinks.setdefault(application, posting.id)
        return application

    def commitLinks(self, session):
        """Persist every queued link-back in one transaction. Returns the count."""
        if not self._pendingLinks:
            return 0
        for application, postingId in self._pendingLinks.items():
            application.jobPostingId = postingId
        written = len(self._pendingLinks)
        self._pendingLinks = {}
        try:
            session.commit()
            return written
        except Exception:
            session.rollback()
            print(traceback.format_exc(), file=sys.stderr)
            return 0


def buildApplicationIndex(session):
    """Load every application once and index it for a whole sweep."""
    applications = session.query(JobApplication).order_by(JobApplication.id.asc()).all()
    return ApplicationIndex(applications)
