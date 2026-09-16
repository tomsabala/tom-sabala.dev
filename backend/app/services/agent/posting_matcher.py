"""'Have I already applied?' — a join on durable keys, never a model opinion.

Tiers, in order:
  1. job_applications.job_posting_id == posting.id      (the durable FK)
  2. normalised job_url == normalised posting.url
  3. same company AND exactly equal normalised title

A tier-2 or tier-3 hit writes the FK back, so the same pair resolves at tier 1
on every later run.
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


def loadApplications(session):
    """Every application, fetched once so a sweep does not rescan per posting."""
    return session.query(JobApplication).all()


def findApplication(session, posting, company, applications=None):
    """Return the JobApplication already covering this posting, or None.

    `applications` lets a sweep pass one prefetched list; omitted, the list is
    loaded here.
    """
    candidates = applications if applications is not None else loadApplications(session)

    # Tier 1: the durable link.
    for candidate in candidates:
        if candidate.jobPostingId is not None and candidate.jobPostingId == posting.id:
            return candidate

    postingUrl = normalizeUrl(posting.url)
    postingTitle = normalizeText(posting.title)
    companyName = normalizeText(company.name if company else '')

    # Tier 2: same posting URL.
    if postingUrl:
        for candidate in candidates:
            if candidate.jobUrl and normalizeUrl(candidate.jobUrl) == postingUrl:
                _linkBack(session, candidate, posting)
                return candidate

    # Tier 3: same company and exactly the same title. Equality only —
    # substring matching would collapse "Software Engineer" into
    # "Senior Software Engineer II".
    for candidate in candidates:
        if normalizeText(candidate.position) != postingTitle:
            continue
        sameCompany = (
            (candidate.companyId is not None and candidate.companyId == posting.companyId)
            or (companyName and normalizeText(candidate.companyName) == companyName)
        )
        if sameCompany:
            _linkBack(session, candidate, posting)
            return candidate

    return None


def _linkBack(session, application, posting):
    """Make the fallback match durable so later runs resolve at tier 1."""
    if application.jobPostingId == posting.id:
        return
    application.jobPostingId = posting.id
    try:
        session.commit()
    except Exception:
        session.rollback()
        print(traceback.format_exc(), file=sys.stderr)
