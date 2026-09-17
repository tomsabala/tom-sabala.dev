"""The sweep: walk every tracked company's board, then decide what to surface.

This is the RQ job. It is written so that one broken company can never abort a
run, and so that every claim it makes is backed by a stored fact:
  * "already applied"  → a join (posting_matcher), not a model answer
  * "new"              → firstSeenAt vs this run's start, not a model answer
"""
import os
import sys
import time
import traceback
from datetime import datetime

from app import db
from app.dao import AgentRunDAO, CompanyDAO, JobPostingDAO
from app.queue import cancelKey, getRedis
from app.services.agent.posting_matcher import buildApplicationIndex
from app.services.agent.posting_sync import syncCompany
from app.services.agent.ranking_service import rankPostings
from app.services.ats.base import AtsError
from app.services.ats.registry import getAdapter
from app.services.board_discovery_service import resolveBoard, validateAgentPostings


def _intEnv(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _isCancelled(runId):
    try:
        return bool(getRedis().exists(cancelKey(runId)))
    except Exception:
        # Redis being unreachable must not kill an otherwise healthy run.
        return False


def runSweepJob(runId):
    """RQ entry point. Runs inside the worker's long-lived app context."""
    session = db.session
    runDao = AgentRunDAO(session)
    companyDao = CompanyDAO(session)
    postingDao = JobPostingDAO(session)

    try:
        run = runDao.getById(runId)
        if not run:
            print(f'runSweepJob: run {runId} not found', file=sys.stderr)
            return
        if run.status in ('cancelled', 'succeeded', 'failed'):
            return

        maxCompanies = _intEnv('AGENT_MAX_COMPANIES_PER_RUN', 100)
        maxTokens = _intEnv('AGENT_MAX_TOKENS_PER_RUN', 400000)
        rankingModel = os.getenv('AGENT_RANKING_MODEL', 'claude-haiku-4-5-20251001')

        companies = companyDao.getAll(limit=maxCompanies)
        runDao.markRunning(runId, rankingModel, len(companies))
        run = runDao.getById(runId)
        startedAt = run.startedAt or datetime.utcnow()

        sweptCompanyIds = []
        companyById = {}

        for company in companies:
            companyById[company.id] = company
            if _isCancelled(runId):
                runDao.finish(runId, 'cancelled')
                return

            began = time.monotonic()
            try:
                resolution = resolveBoard(company, session=session)
                runDao.bumpCounters(
                    runId,
                    inputTokens=resolution.get('inputTokens') or 0,
                    outputTokens=resolution.get('outputTokens') or 0,
                )

                provider = resolution.get('provider')
                adapter = getAdapter(provider)
                postings = []
                listingUrl = None

                if adapter is not None:
                    postings = adapter.fetchPostings(resolution['token'])
                    listingUrl = adapter.boardUrl(resolution['token'])
                elif provider == 'custom':
                    kept, rejected = validateAgentPostings(
                        company, resolution.get('postings'), resolution.get('fetchedTexts')
                    )
                    postings = kept
                    if rejected:
                        runDao.bumpCounters(runId, postingsRejected=rejected)
                else:
                    message = resolution.get('error') or 'No job board found'
                    runDao.addCompanyResult(
                        runId, company.id, 'error', source=provider, error=message,
                        durationMs=int((time.monotonic() - began) * 1000),
                    )
                    runDao.bumpCounters(runId, companiesProcessed=1, companiesFailed=1)
                    continue

                source = provider or 'custom'
                # Where a human reaches this board, for postings the API gave
                # no URL of their own: the provider's board index, else
                # whatever careers page discovery actually landed on.
                listingUrl = (
                    listingUrl
                    or resolution.get('careersUrl')
                    or company.careersUrl
                    or company.url
                )
                seen, created, _closed = syncCompany(
                    postingDao, company.id, source, postings, listingUrl=listingUrl
                )
                company.lastSyncedAt = datetime.utcnow()
                company.syncError = None
                session.commit()

                sweptCompanyIds.append(company.id)
                runDao.addCompanyResult(
                    runId, company.id, 'ok', source=source, postingsFound=seen,
                    durationMs=int((time.monotonic() - began) * 1000),
                )
                runDao.bumpCounters(
                    runId, companiesProcessed=1, postingsSeen=seen, postingsNew=created
                )

            except AtsError as e:
                session.rollback()
                company.syncError = str(e)
                try:
                    session.commit()
                except Exception:
                    session.rollback()
                runDao.addCompanyResult(
                    runId, company.id, 'error', error=str(e),
                    durationMs=int((time.monotonic() - began) * 1000),
                )
                runDao.bumpCounters(runId, companiesProcessed=1, companiesFailed=1)
            except Exception as e:
                session.rollback()
                print(traceback.format_exc(), file=sys.stderr)
                runDao.addCompanyResult(
                    runId, company.id, 'error', error=f'{type(e).__name__}: {e}',
                    durationMs=int((time.monotonic() - began) * 1000),
                )
                runDao.bumpCounters(runId, companiesProcessed=1, companiesFailed=1)

            run = runDao.getById(runId)
            if (run.inputTokens + run.outputTokens) > maxTokens:
                runDao.appendError(
                    runId,
                    f'Token budget exhausted after {run.companiesProcessed} companies',
                )
                break

        if _isCancelled(runId):
            runDao.finish(runId, 'cancelled')
            return

        # ── What is open right now, across the companies we actually swept ────
        candidates = postingDao.getOpenForCompanies(sweptCompanyIds)

        # ── Applied pass: a join, and matches never reach the model ──────────
        applications = buildApplicationIndex(session)
        remaining = []
        appliedSkipped = 0
        for posting in candidates:
            if applications.find(posting, companyById.get(posting.companyId)):
                appliedSkipped += 1
            else:
                remaining.append(posting)
        # One write for every fallback match, after the scan: committing inside
        # it would expire `remaining` and reload each row again for ranking.
        applications.commitLinks(session)
        if appliedSkipped:
            runDao.bumpCounters(runId, postingsAppliedSkipped=appliedSkipped)

        # ── Relevance ────────────────────────────────────────────────────────
        run = runDao.getById(runId)
        companyNameById = {cid: c.name for cid, c in companyById.items()}
        scores, inputTokens, outputTokens, errors = rankPostings(
            remaining, run.interestsSnapshot, companyNameById, postingDao=postingDao
        )
        runDao.bumpCounters(runId, inputTokens=inputTokens, outputTokens=outputTokens)
        for error in errors:
            runDao.appendError(runId, error)

        # ── Findings ─────────────────────────────────────────────────────────
        findings = 0
        for posting in remaining:
            scored = scores.get(posting.id) or {}
            score = scored.get('score')
            if score is None or score < run.minScore:
                continue
            runDao.addFinding(
                runId, posting.id,
                score=score,
                verdict=scored.get('verdict'),
                reason=scored.get('reason'),
                isNew=bool(posting.firstSeenAt and posting.firstSeenAt >= startedAt),
            )
            findings += 1

        runDao.setFields(runId, findingsCount=findings)
        runDao.finish(runId, 'succeeded')

    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        try:
            db.session.rollback()
            AgentRunDAO(db.session).finish(runId, 'failed', error=f'{type(e).__name__}: {e}')
        except Exception:
            print(traceback.format_exc(), file=sys.stderr)
    finally:
        # The worker holds one long-lived app context; don't leak a session
        # between jobs.
        db.session.remove()
