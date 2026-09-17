"""The only egress the discovery agent gets.

Two jobs:
  1. Enforce the never-fetch list in ONE place, so a model cannot talk the
     agent into hitting LinkedIn/Indeed/an aggregator (request item 11).
  2. Fetch a page as text, with an optional Playwright pass for career pages
     that render client-side.
"""
import os
import re
from urllib.parse import urljoin, urlparse

import requests

from app.services.agent.html_text import htmlToText

USER_AGENT = 'tom-sabala.dev-job-agent/1.0'
HTTP_TIMEOUT = 15
BROWSER_TIMEOUT_MS = 30000
# Redirects are followed by hand so the allow-list is re-checked on every hop.
MAX_REDIRECTS = 5
# Below this much static text a page is almost certainly client-rendered.
MIN_STATIC_TEXT = 400

# Never fetched, at any depth, for any reason.
DENIED_HOSTS = (
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
    'ziprecruiter.com',
    'monster.com',
    'simplyhired.com',
    'dice.com',
)

# Known board hosts: allowed even though they are not the company's own domain.
ATS_HOSTS = (
    'greenhouse.io',
    'job-boards.greenhouse.io',
    'lever.co',
    'ashbyhq.com',
    'workable.com',
    'smartrecruiters.com',
    'myworkdayjobs.com',
)

_ANCHOR = re.compile(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
_TAGS = re.compile(r'<[^>]*>')


def hostOf(url):
    try:
        host = (urlparse(url).hostname or '').lower()
    except ValueError:
        return ''
    return host[4:] if host.startswith('www.') else host


def _hostMatches(host, suffix):
    return host == suffix or host.endswith('.' + suffix)


def isDeniedHost(url):
    host = hostOf(url)
    if not host:
        return True
    return any(_hostMatches(host, denied) for denied in DENIED_HOSTS)


def isFetchAllowed(url, companyDomain=None):
    """Allow only the company's own domain (or a subdomain) and known ATS hosts.

    Everything else — including every aggregator — is refused, which is what
    keeps the agent from wandering the open web.
    """
    if not url or not isinstance(url, str):
        return False
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        return False
    host = hostOf(url)
    if not host:
        return False
    if any(_hostMatches(host, denied) for denied in DENIED_HOSTS):
        return False
    if any(_hostMatches(host, ats) for ats in ATS_HOSTS):
        return True
    domain = (companyDomain or '').lower()
    if domain.startswith('www.'):
        domain = domain[4:]
    if domain and _hostMatches(host, domain):
        return True
    return False


def browserFallbackEnabled():
    return os.getenv('BROWSER_FALLBACK_ENABLED', 'true').strip().lower() in ('1', 'true', 'yes')


def _fetchWithBrowser(url):
    """Render the page in headless chromium. Returns HTML or None."""
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                page = browser.new_page(user_agent=USER_AGENT)
                page.goto(url, wait_until='networkidle', timeout=BROWSER_TIMEOUT_MS)
                return page.content()
            finally:
                browser.close()
    except Exception:
        # A browser-less or blocked image must degrade to the static fetch.
        return None


def _get(url, companyDomain):
    """One allow-listed GET, following redirects hop by hop.

    `requests` would follow them for us, but only the first URL would ever be
    checked: an allowed host answering `302 -> http://169.254.169.254/` would
    walk straight past the allow-list this module exists to enforce.
    """
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        if not isFetchAllowed(current, companyDomain):
            return None
        try:
            response = requests.get(
                current,
                timeout=HTTP_TIMEOUT,
                headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml'},
                allow_redirects=False,
            )
        except requests.RequestException:
            return None
        if response.status_code // 100 != 3:
            return response
        location = response.headers.get('Location')
        if not location:
            return response
        current = urljoin(current, location)
    return None


def fetchPage(url, companyDomain=None):
    """Fetch one page. Returns {'url', 'html', 'text', 'rendered'} or None.

    Callers must have already checked `isFetchAllowed`; this re-checks anyway
    because it is the last line before the socket — and re-checks again after
    every redirect.
    """
    response = _get(url, companyDomain)
    if response is None or response.status_code // 100 != 2:
        return None

    finalUrl = response.url or url
    html = response.text or ''
    text = htmlToText(html)
    rendered = False
    if len(text) < MIN_STATIC_TEXT and browserFallbackEnabled():
        renderedHtml = _fetchWithBrowser(finalUrl)
        if renderedHtml:
            html = renderedHtml
            text = htmlToText(renderedHtml)
            rendered = True
    return {'url': finalUrl, 'html': html, 'text': text, 'rendered': rendered}


def extractLinks(html, baseUrl, limit=40):
    """Absolute hrefs plus their anchor text, deduplicated, denied hosts dropped."""
    links = []
    seen = set()
    for match in _ANCHOR.finditer(html or ''):
        href = match.group(1).strip()
        if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:')):
            continue
        absolute = urljoin(baseUrl, href)
        if absolute in seen or isDeniedHost(absolute):
            continue
        seen.add(absolute)
        label = _TAGS.sub(' ', match.group(2) or '')
        label = ' '.join(label.split())[:120]
        links.append({'url': absolute, 'text': label})
        if len(links) >= limit:
            break
    return links
