"""Find where a company's jobs actually live.

Order of preference, deliberately cheapest-and-most-deterministic first:

  1. Already stored on the company  → no network, no model.
  2. Regex the careers page HTML for a known ATS token → one HTTP fetch.
  3. A bounded Anthropic tool-use loop → only when 1 and 2 miss.

The agent may report a known ATS (preferred) or, for a hand-rolled board with
no API, a list of postings it saw on a page it actually fetched. Those postings
are then filtered by `validateAgentPostings`, so a hallucinated title or an
off-limits URL never reaches the database.
"""
import json
import os
import re
import sys
import traceback
from datetime import datetime, timedelta

from app.services.agent.net import extractLinks, fetchPage, hostOf, isFetchAllowed
from app.services.ats.registry import ADAPTERS, SUPPORTED_PROVIDERS

MAX_AGENT_TURNS = 10
MAX_TOOL_TEXT = 6000
MAX_FOLLOW_LINKS = 3
PAGE_TEXT_BUDGET = 40000

# Tokens that show up in board URLs but are never a board slug.
_BAD_TOKENS = ('embed', 'www', 'api', 'jobs', 'job-boards', 'apply', 'boards', 'careers')

BOARD_PATTERNS = [
    ('greenhouse', re.compile(r'boards\.greenhouse\.io/(?:embed/job_board\?for=)?([A-Za-z0-9_-]+)')),
    ('greenhouse', re.compile(r'job-boards\.greenhouse\.io/([A-Za-z0-9_-]+)')),
    ('greenhouse', re.compile(r'boards-api\.greenhouse\.io/v1/boards/([A-Za-z0-9_-]+)')),
    ('lever', re.compile(r'jobs\.lever\.co/([A-Za-z0-9_-]+)')),
    ('lever', re.compile(r'api\.lever\.co/v0/postings/([A-Za-z0-9_-]+)')),
    ('ashby', re.compile(r'jobs\.ashbyhq\.com/([A-Za-z0-9_-]+)')),
    ('ashby', re.compile(r'api\.ashbyhq\.com/posting-api/job-board/([A-Za-z0-9_-]+)')),
    ('workable', re.compile(r'apply\.workable\.com/([A-Za-z0-9_-]+)')),
    ('workable', re.compile(r'([A-Za-z0-9-]+)\.workable\.com')),
    ('smartrecruiters', re.compile(r'jobs\.smartrecruiters\.com/([A-Za-z0-9_-]+)')),
    ('smartrecruiters', re.compile(r'api\.smartrecruiters\.com/v1/companies/([A-Za-z0-9_-]+)')),
]

CAREERS_LINK = re.compile(r'(?i)careers?|jobs|join[-\s]us|work[-\s]with[-\s]us|open[-\s]positions')

_WS = re.compile(r'\s+')


def _normalize(text):
    return _WS.sub(' ', (text or '').strip().lower())


def _matchBoard(html):
    for provider, pattern in BOARD_PATTERNS:
        for match in pattern.finditer(html or ''):
            token = match.group(1)
            if token and token.lower() not in _BAD_TOKENS:
                return provider, token
    return None


def companyDomain(company):
    return hostOf(company.careersUrl or company.url or '')


def detectDeterministic(company):
    """Regex the careers page (and up to 3 careers-looking links) for a token.

    Returns (provider, token, careersUrl, fetchedTexts) on a hit,
    (None, None, None, fetchedTexts) when pages were read but nothing matched,
    or None when nothing could be fetched at all. The texts are handed on so
    the agent's hallucination guard can use pages already paid for.
    """
    domain = companyDomain(company)
    startUrl = company.careersUrl or company.url
    if not startUrl or not isFetchAllowed(startUrl, domain):
        return None

    fetchedTexts = []
    page = fetchPage(startUrl, domain)
    if not page:
        return None
    fetchedTexts.append(page['text'])

    hit = _matchBoard(page['html'])
    if hit:
        return hit[0], hit[1], startUrl, fetchedTexts

    followed = 0
    for link in extractLinks(page['html'], page['url']):
        if followed >= MAX_FOLLOW_LINKS:
            break
        if not CAREERS_LINK.search(link['url']) and not CAREERS_LINK.search(link['text']):
            continue
        if not isFetchAllowed(link['url'], domain):
            continue
        followed += 1
        sub = fetchPage(link['url'], domain)
        if not sub:
            continue
        fetchedTexts.append(sub['text'])
        hit = _matchBoard(sub['html'])
        if hit:
            return hit[0], hit[1], link['url'], fetchedTexts

    return None, None, None, fetchedTexts


DISCOVERY_TOOLS = [
    {
        'name': 'fetch_page',
        'description': (
            'Fetch one page from the company website or a known job-board host and '
            'return its text and links. Aggregators (LinkedIn, Indeed, Glassdoor and '
            'similar) are blocked and will return an error.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {'url': {'type': 'string', 'description': 'Absolute http(s) URL'}},
            'required': ['url'],
        },
    },
    {
        'name': 'report_board',
        'description': (
            'Report that the company uses a known applicant tracking system, with the '
            'board token (the slug in the board URL). Strongly preferred over listing '
            'postings by hand.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'provider': {'type': 'string', 'enum': SUPPORTED_PROVIDERS},
                'token': {'type': 'string'},
                'careers_url': {'type': 'string'},
            },
            'required': ['provider', 'token'],
        },
    },
    {
        'name': 'report_postings',
        'description': (
            'Only for a hand-rolled board with no known ATS behind it: report the open '
            'postings visible on a page you actually fetched. Never invent a posting.'
        ),
        'input_schema': {
            'type': 'object',
            'properties': {
                'careers_url': {'type': 'string'},
                'postings': {
                    'type': 'array',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'external_id': {'type': 'string'},
                            'title': {'type': 'string'},
                            'url': {'type': 'string'},
                            'location': {'type': 'string'},
                        },
                        'required': ['external_id', 'title', 'url'],
                    },
                },
            },
            'required': ['careers_url', 'postings'],
        },
    },
    {
        'name': 'give_up',
        'description': 'No job board could be found for this company.',
        'input_schema': {
            'type': 'object',
            'properties': {'reason': {'type': 'string'}},
            'required': ['reason'],
        },
    },
]

DISCOVERY_SYSTEM = (
    "You locate a single company's job board. Work only from pages you fetch with "
    "fetch_page; you have no other knowledge of this company's board.\n"
    "Prefer identifying a known applicant tracking system and returning its board "
    "token with report_board — that gives a queryable API and is always better than "
    "listing jobs by hand. Look for links or embedded URLs containing "
    "boards.greenhouse.io, job-boards.greenhouse.io, jobs.lever.co, jobs.ashbyhq.com, "
    "apply.workable.com or jobs.smartrecruiters.com; the token is the path segment "
    "after the host.\n"
    "Only if the company clearly runs its own board with no such system, call "
    "report_postings with the postings you actually saw in fetched page text. Never "
    "invent a posting, a title or a URL; only report postings whose URL appeared in "
    "text you fetched.\n"
    "If nothing can be found in a few fetches, call give_up. Be brief; do not explain "
    "your reasoning in prose."
)


def _emptyResult():
    return {
        'provider': None,
        'token': None,
        'careersUrl': None,
        'postings': None,
        'inputTokens': 0,
        'outputTokens': 0,
        'fetchedTexts': [],
        'error': None,
        'via': None,
    }


def discoverWithAgent(company):
    """Bounded Anthropic tool-use loop. Returns the same dict shape as resolveBoard."""
    result = _emptyResult()
    result['via'] = 'agent'

    apiKey = os.getenv('ANTHROPIC_API_KEY')
    if not apiKey:
        result['error'] = 'ANTHROPIC_API_KEY is not set'
        return result

    domain = companyDomain(company)
    startUrl = company.careersUrl or company.url
    if not startUrl:
        result['error'] = 'Company has no URL to start from'
        return result

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=apiKey)
    except Exception as e:
        result['error'] = f'Anthropic client unavailable: {e}'
        return result

    model = os.getenv('AGENT_DISCOVERY_MODEL', 'claude-sonnet-4-5-20250929')
    messages = [{
        'role': 'user',
        'content': (
            f"Company: {company.name}\n"
            f"Website: {company.url or 'unknown'}\n"
            f"Careers page (may be wrong or missing): {company.careersUrl or 'unknown'}\n"
            f"Start by fetching {startUrl}"
        ),
    }]
    textBudget = 0

    for _ in range(MAX_AGENT_TURNS):
        try:
            response = client.messages.create(
                model=model,
                max_tokens=2000,
                system=DISCOVERY_SYSTEM,
                tools=DISCOVERY_TOOLS,
                messages=messages,
            )
        except Exception as e:
            print(traceback.format_exc(), file=sys.stderr)
            result['error'] = f'Discovery model call failed: {e}'
            return result

        result['inputTokens'] += getattr(response.usage, 'input_tokens', 0) or 0
        result['outputTokens'] += getattr(response.usage, 'output_tokens', 0) or 0

        toolUses = [block for block in response.content if getattr(block, 'type', None) == 'tool_use']
        if not toolUses:
            result['error'] = 'Discovery agent stopped without reporting a board'
            return result

        messages.append({'role': 'assistant', 'content': response.content})
        toolResults = []
        for block in toolUses:
            name = block.name
            args = block.input if isinstance(block.input, dict) else {}

            if name == 'report_board':
                provider = args.get('provider')
                token = (args.get('token') or '').strip()
                if provider in ADAPTERS and token:
                    result['provider'] = provider
                    result['token'] = token
                    result['careersUrl'] = args.get('careers_url') or startUrl
                    return result
                result['error'] = f'Agent reported an unusable board: {provider!r}/{token!r}'
                return result

            if name == 'report_postings':
                result['provider'] = 'custom'
                result['careersUrl'] = args.get('careers_url') or startUrl
                result['postings'] = args.get('postings') or []
                return result

            if name == 'give_up':
                result['error'] = f"Agent gave up: {args.get('reason') or 'no reason given'}"
                return result

            if name == 'fetch_page':
                url = args.get('url') or ''
                if not isFetchAllowed(url, domain):
                    toolResults.append({
                        'type': 'tool_result',
                        'tool_use_id': block.id,
                        'content': json.dumps({'error': 'host not allowed'}),
                    })
                    continue
                page = fetchPage(url, domain)
                if not page:
                    toolResults.append({
                        'type': 'tool_result',
                        'tool_use_id': block.id,
                        'content': json.dumps({'error': 'fetch failed'}),
                    })
                    continue
                if textBudget < PAGE_TEXT_BUDGET:
                    result['fetchedTexts'].append(page['text'])
                    textBudget += len(page['text'])
                toolResults.append({
                    'type': 'tool_result',
                    'tool_use_id': block.id,
                    'content': json.dumps({
                        'text': page['text'][:MAX_TOOL_TEXT],
                        'links': extractLinks(page['html'], page['url'], limit=40),
                    }),
                })
                continue

            toolResults.append({
                'type': 'tool_result',
                'tool_use_id': block.id,
                'content': json.dumps({'error': f'unknown tool {name}'}),
                'is_error': True,
            })

        messages.append({'role': 'user', 'content': toolResults})

    result['error'] = f'Discovery agent exceeded {MAX_AGENT_TURNS} turns'
    return result


def validateAgentPostings(company, postings, fetchedTexts):
    """Keep only postings that could plausibly have come from a fetched page.

    Returns (kept, rejectedCount). Adapter-sourced postings never come through
    here — no model produced them.
    """
    haystack = _normalize('\n'.join(fetchedTexts or []))
    domain = companyDomain(company)
    kept = []
    rejected = 0
    seen = set()

    for raw in postings or []:
        if not isinstance(raw, dict):
            rejected += 1
            continue
        title = (raw.get('title') or raw.get('name') or '').strip()
        url = (raw.get('url') or '').strip()
        externalId = str(raw.get('external_id') or raw.get('externalId') or url or title).strip()

        if not title or not url or not externalId:
            rejected += 1
            continue
        if not url.startswith(('http://', 'https://')) or not isFetchAllowed(url, domain):
            rejected += 1
            continue
        if _normalize(title) not in haystack:
            rejected += 1
            continue
        if externalId in seen:
            rejected += 1
            continue

        seen.add(externalId)
        kept.append({
            'externalId': externalId,
            'title': title,
            'url': url,
            'location': (raw.get('location') or None),
            'department': None,
            'isRemote': None,
            'postedAt': None,
            'description': None,
        })

    return kept, rejected


def _rediscoverCutoff():
    days = int(os.getenv('AGENT_REDISCOVER_AFTER_DAYS', '14'))
    return datetime.utcnow() - timedelta(days=days)


def resolveBoard(company, session=None):
    """Decide how to read this company's jobs, persisting what was learned.

    Returns a dict with provider / token / careersUrl / postings (custom only) /
    inputTokens / outputTokens / fetchedTexts / error / via.
    """
    result = _emptyResult()
    provider = (company.atsProvider or '').strip() or None

    # 1. Known ATS already stored: no network, no model.
    if provider in ADAPTERS and company.atsToken:
        result.update({'provider': provider, 'token': company.atsToken,
                       'careersUrl': company.careersUrl, 'via': 'cached'})
        return result

    # 2. Nothing found recently: stay quiet until the negative cache expires.
    if provider == 'none' and company.boardDetectedAt and company.boardDetectedAt > _rediscoverCutoff():
        result['error'] = company.syncError or 'No job board found (cached)'
        result['via'] = 'cached-none'
        return result

    # 3. Deterministic detection: one fetch, a regex, no model.
    detected = detectDeterministic(company)
    fetchedTexts = []
    if detected:
        detectedProvider, token, careersUrl, fetchedTexts = detected
        if detectedProvider and token:
            result.update({'provider': detectedProvider, 'token': token,
                           'careersUrl': careersUrl or company.careersUrl,
                           'via': 'deterministic', 'fetchedTexts': fetchedTexts})
            _persist(company, detectedProvider, token, result['careersUrl'], session)
            return result

    # 4. The agent, only when there is a key for it.
    if not os.getenv('ANTHROPIC_API_KEY'):
        result['error'] = 'No board found and ANTHROPIC_API_KEY is not set'
        result['fetchedTexts'] = fetchedTexts
        _persist(company, 'none', None, company.careersUrl, session, error=result['error'])
        return result

    agentResult = discoverWithAgent(company)
    agentResult['fetchedTexts'] = (fetchedTexts or []) + (agentResult.get('fetchedTexts') or [])

    if agentResult['provider'] in ADAPTERS and agentResult['token']:
        _persist(company, agentResult['provider'], agentResult['token'], agentResult['careersUrl'], session)
    elif agentResult['provider'] == 'custom':
        _persist(company, 'custom', None, agentResult['careersUrl'], session)
    else:
        _persist(company, 'none', None, company.careersUrl, session,
                 error=agentResult.get('error') or 'No job board found')

    return agentResult


def _persist(company, provider, token, careersUrl, session, error=None):
    company.atsProvider = provider
    company.atsToken = token
    if careersUrl:
        company.careersUrl = careersUrl[:500]
    company.boardDetectedAt = datetime.utcnow()
    company.syncError = error
    if session is not None:
        try:
            session.commit()
        except Exception:
            session.rollback()
            print(traceback.format_exc(), file=sys.stderr)
