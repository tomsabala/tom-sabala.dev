"""
Slug derivation shared by the 015 migration backfill and ProjectDAO.

One implementation, so a slug minted at runtime is byte-identical to one the
migration would have produced for the same title.
"""
import re

MAX_SLUG_LENGTH = 100


def slugify(value: str) -> str:
    """Lowercase, collapse every run of non-alphanumerics to '-', trim, truncate."""
    text = (value or '').lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')[:MAX_SLUG_LENGTH].strip('-')
    return text


def uniqueSlug(value: str, taken) -> str:
    """slugify(value), suffixed -2, -3, … until it is absent from `taken`."""
    base = slugify(value) or 'project'
    if base not in taken:
        return base
    n = 2
    while True:
        suffix = f'-{n}'
        candidate = base[:MAX_SLUG_LENGTH - len(suffix)].strip('-') + suffix
        if candidate not in taken:
            return candidate
        n += 1
