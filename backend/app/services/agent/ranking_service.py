"""Score open postings against the admin's stated interests.

Cost control is the point of the caching here: a posting whose content AND
interests are unchanged is returned from its stored verdict with zero API
calls, so `Seen` rows are free on every re-run with the same search.
"""
import hashlib
import json
import os
import sys
import traceback

BATCH_SIZE = 15
MAX_DESCRIPTION = 1500
MAX_TOKENS = 1500

RANKING_SYSTEM = (
    "You score job postings for one candidate against their stated interests.\n"
    "Score 0-100 how well each posting matches those interests: 0 is irrelevant, "
    "100 is an obvious fit. Judge role, seniority, stack, location/remote and any "
    "dealbreakers the candidate stated.\n"
    "Output ONLY a JSON array of objects, one per input id, each exactly "
    '{"id":<posting id>,"score":<0-100>,"verdict":"apply"|"maybe"|"skip",'
    '"reason":"<max 200 chars>"}. No markdown, no code fences, no commentary.'
)


def _postingLine(posting, companyName):
    parts = [
        f"id: {posting.id}",
        f"company: {companyName or 'unknown'}",
        f"title: {posting.title}",
    ]
    if posting.location:
        parts.append(f"location: {posting.location}")
    if posting.department:
        parts.append(f"department: {posting.department}")
    if posting.isRemote is not None:
        parts.append(f"remote: {posting.isRemote}")
    if posting.description:
        parts.append(f"description: {posting.description[:MAX_DESCRIPTION]}")
    return '\n'.join(parts)


def _coerceScore(value):
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(0, min(100, score))


def _scoreBatch(client, model, batch, interests, companyNameById):
    """One model call. Returns (scores, inputTokens, outputTokens, error)."""
    listing = '\n\n'.join(_postingLine(p, companyNameById.get(p.companyId)) for p in batch)
    userMsg = (
        f"Candidate interests:\n{interests}\n\n"
        f"Score these {len(batch)} postings:\n\n{listing}"
    )

    inputTokens = 0
    outputTokens = 0
    lastError = None

    for attempt in (1, 2):
        try:
            message = client.messages.create(
                model=model,
                max_tokens=MAX_TOKENS,
                system=RANKING_SYSTEM,
                messages=[
                    {'role': 'user', 'content': userMsg},
                    # Prefilled '[' so the reply continues inside a JSON array.
                    {'role': 'assistant', 'content': '['},
                ],
            )
        except Exception as e:
            print(traceback.format_exc(), file=sys.stderr)
            return {}, inputTokens, outputTokens, f'ranking call failed: {e}'

        inputTokens += getattr(message.usage, 'input_tokens', 0) or 0
        outputTokens += getattr(message.usage, 'output_tokens', 0) or 0

        raw = '[' + message.content[0].text.strip()
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            lastError = f'unparseable ranking output: {e}'
            print(f'rankPostings: {lastError}: {raw[:400]!r}', file=sys.stderr)
            if attempt == 1:
                continue
            return {}, inputTokens, outputTokens, lastError

        if not isinstance(parsed, list):
            lastError = f'expected a JSON array, got {type(parsed).__name__}'
            if attempt == 1:
                continue
            return {}, inputTokens, outputTokens, lastError

        allowedIds = {p.id for p in batch}
        scores = {}
        for item in parsed:
            if not isinstance(item, dict):
                continue
            try:
                postingId = int(item.get('id'))
            except (TypeError, ValueError):
                continue
            if postingId not in allowedIds:
                continue  # ids outside the batch are dropped
            verdict = item.get('verdict')
            if verdict not in ('apply', 'maybe', 'skip'):
                verdict = None
            reason = item.get('reason')
            scores[postingId] = {
                'score': _coerceScore(item.get('score')),
                'verdict': verdict,
                'reason': (str(reason)[:500] if reason else None),
            }
        return scores, inputTokens, outputTokens, None

    return {}, inputTokens, outputTokens, lastError


def scoredHash(contentHash, interests):
    """Cache key for a stored verdict.

    A score is only reusable when BOTH the posting content and the interests it
    was judged against are unchanged — keying on content alone would replay
    scores computed for a different search.
    """
    payload = f"{contentHash}\n{(interests or '').strip()}"
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def rankPostings(postings, interests, companyNameById, postingDao=None):
    """Score postings, reusing cached verdicts for unchanged content+interests.

    Returns (results, inputTokens, outputTokens, errors) where results maps
    postingId -> {'score', 'verdict', 'reason', 'cached'}.
    """
    results = {}
    errors = []
    toScore = []
    hashes = {p.id: scoredHash(p.contentHash, interests) for p in postings}

    for posting in postings:
        if posting.lastScoredHash and posting.lastScoredHash == hashes[posting.id]:
            results[posting.id] = {
                'score': posting.lastScore,
                'verdict': posting.lastVerdict,
                'reason': posting.lastReason,
                'cached': True,
            }
        else:
            toScore.append(posting)

    if not toScore:
        return results, 0, 0, errors

    apiKey = os.getenv('ANTHROPIC_API_KEY')
    if not apiKey:
        for posting in toScore:
            results[posting.id] = {'score': None, 'verdict': None, 'reason': 'not scored', 'cached': False}
        errors.append('ANTHROPIC_API_KEY is not set; postings were not scored')
        return results, 0, 0, errors

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=apiKey)
    except Exception as e:
        for posting in toScore:
            results[posting.id] = {'score': None, 'verdict': None, 'reason': 'not scored', 'cached': False}
        errors.append(f'Anthropic client unavailable: {e}')
        return results, 0, 0, errors

    model = os.getenv('AGENT_RANKING_MODEL', 'claude-haiku-4-5-20251001')
    totalInput = 0
    totalOutput = 0

    for start in range(0, len(toScore), BATCH_SIZE):
        batch = toScore[start:start + BATCH_SIZE]
        scores, inputTokens, outputTokens, error = _scoreBatch(
            client, model, batch, interests, companyNameById
        )
        totalInput += inputTokens
        totalOutput += outputTokens
        if error:
            # The batch is lost, the run still completes.
            errors.append(error)

        for posting in batch:
            scored = scores.get(posting.id)
            if scored is None:
                results[posting.id] = {'score': None, 'verdict': None, 'reason': 'not scored', 'cached': False}
                continue
            scored['cached'] = False
            results[posting.id] = scored
            if postingDao is not None and scored['score'] is not None:
                postingDao.setScore(
                    posting.id, hashes[posting.id],
                    scored['score'], scored['verdict'], scored['reason'],
                )

    return results, totalInput, totalOutput, errors
