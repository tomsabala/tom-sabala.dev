"""User-Agent classification and bot detection.

Hand-rolled rather than pulled from a dependency on purpose: the only thing
this has to be good at is separating a human browser from everything else, and
that list needs editing the week a new crawler shows up — not a version bump.
Browser/OS labels are deliberately coarse (no versions): a portfolio's traffic
report is read for "mostly desktop Chrome from LinkedIn", never for
"Chrome 141.0.7390".

Nothing here is stored verbatim. The caller writes the returned labels; the
raw User-Agent string goes into the daily visitor hash and is then dropped.
"""
import re

# Substrings that make a request non-human. Ordered loosely by how often they
# show up on a personal site: search/AI crawlers, then preview fetchers, then
# scripted clients, then headless browsers.
BOT_TOKENS = (
    'googlebot', 'bingbot', 'bingpreview', 'duckduckbot', 'applebot', 'yandex',
    'baiduspider', 'sogou', 'exabot', 'seznambot', 'qwantify',
    'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web', 'anthropic-ai',
    'perplexitybot', 'ccbot', 'bytespider', 'amazonbot', 'meta-externalagent',
    'google-extended', 'diffbot', 'timpibot', 'omgili', 'img2dataset',
    'ahrefsbot', 'semrushbot', 'mj12bot', 'dotbot', 'petalbot', 'barkrowler',
    'dataforseo', 'blexbot', 'serpstatbot', 'zoominfobot', 'megaindex',
    'facebookexternalhit', 'facebookcatalog', 'whatsapp', 'telegrambot', 'slackbot',
    'slack-imgproxy', 'discordbot', 'twitterbot', 'linkedinbot', 'redditbot',
    # `pinterestbot`, not `pinterest`: the Pinterest app's in-app browser carries
    # `Pinterest/` in an otherwise ordinary UA, and that is a person.
    'pinterestbot', 'embedly', 'quora link preview', 'skypeuripreview', 'vkshare',
    'ia_archiver', 'archive.org_bot', 'wayback', 'heritrix',
    'pingdom', 'uptimerobot', 'statuscake', 'site24x7', 'newrelicpinger',
    'lighthouse', 'pagespeed', 'gtmetrix', 'chrome-lighthouse', 'webpagetest',
    'curl/', 'wget/', 'libwww-perl', 'python-requests', 'python-urllib', 'aiohttp',
    'httpx', 'go-http-client', 'okhttp', 'java/', 'apache-httpclient', 'node-fetch',
    'axios/', 'got (', 'guzzlehttp', 'restsharp', 'postmanruntime', 'insomnia',
    'scrapy', 'colly', 'zgrab', 'masscan', 'nmap', 'nuclei', 'censys', 'expanse',
    'headlesschrome', 'phantomjs', 'electron/', 'puppeteer', 'playwright', 'selenium',
    # Catch-alls last: anything still unmatched that self-identifies as automation.
    'bot/', 'bot)', '+bot', 'bot ', 'crawler', 'spider', 'crawling', 'slurp',
    'scraper', 'fetcher', 'monitor', 'validator', 'feedburner', 'feedfetcher',
)

# Checked before BOT_TOKENS so an honest browser is never caught by a catch-all
# token that happens to appear inside a product string.
_HUMAN_HINT = re.compile(r'\bmozilla/5\.0\b', re.I)

_BROWSERS = (
    ('edge', re.compile(r'\bedg(?:e|a|ios)?/', re.I)),
    ('opera', re.compile(r'\b(?:opr|opera|opios)/', re.I)),
    ('samsung', re.compile(r'\bsamsungbrowser/', re.I)),
    ('brave', re.compile(r'\bbrave/', re.I)),
    ('vivaldi', re.compile(r'\bvivaldi/', re.I)),
    ('firefox', re.compile(r'\b(?:firefox|fxios)/', re.I)),
    ('chrome', re.compile(r'\b(?:chrome|crios|chromium)/', re.I)),
    ('safari', re.compile(r'\bsafari/', re.I)),
)

_OSES = (
    ('ios', re.compile(r'\b(?:iphone|ipad|ipod)\b', re.I)),
    ('android', re.compile(r'\bandroid\b', re.I)),
    ('windows', re.compile(r'\bwindows nt\b', re.I)),
    ('macos', re.compile(r'\b(?:macintosh|mac os x)\b', re.I)),
    ('chromeos', re.compile(r'\bcros\b', re.I)),
    ('linux', re.compile(r'\blinux\b', re.I)),
)

_TABLET = re.compile(r'\b(?:ipad|tablet|playbook|silk)\b|android(?!.*\bmobi)', re.I)
# `mobi\w*` on purpose: Android phones say "Mobile Safari", and `\bmobi\b`
# would never match that — every Android would be classified as a tablet.
_MOBILE = re.compile(r'\b(?:mobi\w*|iphone|ipod|windows phone|iemobile)\b', re.I)


def detectBot(userAgent):
    """Return *why* this is not a human browser, or None if it looks like one.

    Order matters, because the answer is stored and read later. A named token
    wins over any heuristic, so `curl/8.5.0` is recorded as `curl`, not as some
    generic verdict about its length — "which crawler" is the question the bot
    panel exists to answer, and a reason you cannot act on is noise.
    """
    ua = (userAgent or '').strip().lower()
    if not ua:
        return 'no-user-agent'
    for token in BOT_TOKENS:
        if token in ua:
            return token.strip(' /()+')
    # Nothing claiming to be a browser engine and nothing recognisable: a
    # scripted client we have no name for. Every real browser sends Mozilla/5.0.
    if not _HUMAN_HINT.search(ua):
        return 'non-browser'
    return None


def classify(userAgent):
    """Coarse {browser, os, device, isBot, botReason} for one UA string."""
    ua = userAgent or ''
    botReason = detectBot(ua)
    if botReason:
        return {'browser': None, 'os': None, 'device': 'bot',
                'isBot': True, 'botReason': botReason[:60]}

    browser = next((name for name, pattern in _BROWSERS if pattern.search(ua)), 'other')
    os = next((name for name, pattern in _OSES if pattern.search(ua)), 'other')
    if _MOBILE.search(ua):
        device = 'mobile'
    elif _TABLET.search(ua):
        device = 'tablet'
    else:
        device = 'desktop'

    return {'browser': browser, 'os': os, 'device': device,
            'isBot': False, 'botReason': None}
