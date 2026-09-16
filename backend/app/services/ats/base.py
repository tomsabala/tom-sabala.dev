"""Shared plumbing for applicant-tracking-system board adapters.

Every adapter returns a list of dicts with exactly these keys:

    externalId  str            stable id on the board
    title       str
    url         str            public posting URL
    location    str | None
    department  str | None
    isRemote    bool | None
    postedAt    datetime | None   naive UTC
    description str | None        plain text

Anything the provider does not expose is None; nothing is invented.
"""
from datetime import datetime, timezone

import requests

USER_AGENT = 'tom-sabala.dev-job-agent/1.0'
HTTP_TIMEOUT = 20


class AtsError(Exception):
    """A board API refused or returned something unusable."""

    def __init__(self, provider, message, status=None):
        self.provider = provider
        self.status = status
        super().__init__(f"{provider}: {message}" + (f" (HTTP {status})" if status else ''))


def httpGetJson(provider, url):
    try:
        response = requests.get(
            url,
            timeout=HTTP_TIMEOUT,
            headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'},
        )
    except requests.RequestException as e:
        raise AtsError(provider, f"request failed: {e}")

    if response.status_code // 100 != 2:
        raise AtsError(provider, 'board API returned an error', status=response.status_code)

    try:
        return response.json()
    except ValueError:
        raise AtsError(provider, 'board API returned non-JSON', status=response.status_code)


def toNaiveUtc(value):
    """Normalise to naive UTC: the DB columns are `timestamp without time zone`."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def parseIso(value):
    """Parse an ISO-8601 date or datetime, tolerating a trailing 'Z'."""
    if not value or not isinstance(value, str):
        return None
    text = value.strip()
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    try:
        return toNaiveUtc(datetime.fromisoformat(text))
    except ValueError:
        return None


class AtsAdapter:
    provider = ''

    def fetchPostings(self, token):
        raise NotImplementedError
