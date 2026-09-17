"""Write what a board currently lists into posting history.

`firstSeenAt` is only ever set on insert and `closedAt` marks disappearance, so
"is this new?" is answered by stored history rather than by a model.
"""
import hashlib


def contentHash(posting):
    """Identity of the *content* we scored, not of the row.

    Only fields that would change a relevance judgement participate, so a board
    re-ordering its JSON never invalidates a cached score.
    """
    title = posting.get('title') or ''
    location = posting.get('location') or ''
    description = (posting.get('description') or '')[:4000]
    payload = f"{title}\n{location}\n{description}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def syncCompany(postingDao, companyId, source, postings, listingUrl=None):
    """Upsert every posting, close the ones that vanished.

    `listingUrl` is where a human would go to reach this board — the
    provider's public board index, else the company's careers page. A posting
    whose API record carries no URL of its own inherits it, because a finding
    you cannot click through to is not usable.

    Returns (seen, created, closed). Callers read the resulting rows back from
    `getOpenForCompanies`, so the rows themselves are not returned here.
    """
    seenIds = []
    created = 0

    for posting in postings or []:
        payload = dict(posting)
        if not (payload.get('url') or '').strip():
            payload['url'] = listingUrl or ''
        payload['contentHash'] = contentHash(payload)
        row, wasCreated = postingDao.upsert(companyId, source, payload)
        seenIds.append(row.externalId)
        if wasCreated:
            created += 1

    closed = postingDao.closeMissing(companyId, source, seenIds)
    return len(seenIds), created, closed
