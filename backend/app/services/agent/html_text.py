"""HTML → plain text on the stdlib only (no new dependency).

Used by the Greenhouse adapter (its `content` field is escaped HTML) and by
the discovery fetcher, which feeds page text to the model.
"""
import html
import re
from html.parser import HTMLParser

_SKIP_TAGS = {'script', 'style', 'noscript', 'svg', 'head'}
_BLOCK_TAGS = {
    'p', 'div', 'br', 'li', 'ul', 'ol', 'tr', 'table', 'section', 'article',
    'header', 'footer', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'pre', 'form', 'label', 'option',
}
_WS = re.compile(r'[ \t\r\f\v]+')
_BLANKS = re.compile(r'\n{3,}')


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self._skipDepth = 0

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skipDepth += 1
            return
        if tag in _BLOCK_TAGS:
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS:
            self._skipDepth = max(0, self._skipDepth - 1)
            return
        if tag in _BLOCK_TAGS:
            self.parts.append('\n')

    def handle_data(self, data):
        if self._skipDepth:
            return
        self.parts.append(data)

    def error(self, message):  # pragma: no cover - HTMLParser hook, py<3.10 only
        pass


def htmlToText(raw):
    """Collapse an HTML document (or fragment) to readable plain text."""
    if not raw:
        return ''
    parser = _TextExtractor()
    try:
        parser.feed(raw)
        parser.close()
        text = ''.join(parser.parts)
    except Exception:
        # Malformed markup must degrade to something usable, never explode.
        text = re.sub(r'<[^>]*>', ' ', raw)
        text = html.unescape(text)

    lines = [_WS.sub(' ', line).strip() for line in text.split('\n')]
    text = '\n'.join(line for line in lines if line)
    return _BLANKS.sub('\n\n', text).strip()
