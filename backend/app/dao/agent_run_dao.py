from datetime import datetime

from sqlalchemy import func

from app.models import AgentRun, AgentRunCompanyResult, AgentRunFinding
from app.models.agent_run import TERMINAL_STATUSES


class AgentRunDAO:

    def __init__(self, session):
        self.session = session

    def create(self, interests, minScore, createdBy=None):
        """Insert a queued run holding the active lock.

        The caller must handle IntegrityError from `uq_agent_runs_active`:
        that is the single-active-run guard, not an unexpected failure.
        """
        run = AgentRun(
            status='queued',
            activeLock=True,
            createdBy=createdBy,
            interestsSnapshot=interests,
            minScore=minScore,
        )
        self.session.add(run)
        self.session.commit()
        return run

    def getById(self, runId):
        try:
            return self.session.get(AgentRun, runId)
        except Exception as e:
            raise Exception(f"Failed to fetch agent run: {str(e)}")

    def listRecent(self, limit=20):
        try:
            return (
                self.session.query(AgentRun)
                .order_by(AgentRun.createdAt.desc(), AgentRun.id.desc())
                .limit(limit)
                .all()
            )
        except Exception as e:
            raise Exception(f"Failed to fetch agent runs: {str(e)}")

    def setQueueJobId(self, runId, queueJobId):
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            run.queueJobId = queueJobId
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to store queue job id: {str(e)}")

    def markRunning(self, runId, model, companiesTotal):
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            run.status = 'running'
            run.model = model
            run.companiesTotal = companiesTotal
            run.startedAt = datetime.utcnow()
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to mark agent run running: {str(e)}")

    def bumpCounters(self, runId, **deltas):
        """Increment integer counters on a run (e.g. postingsNew=3)."""
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            for key, delta in deltas.items():
                if not delta:
                    continue
                current = getattr(run, key, None)
                if isinstance(current, int):
                    setattr(run, key, current + delta)
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update agent run counters: {str(e)}")

    def setFields(self, runId, **fields):
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            for key, value in fields.items():
                if hasattr(run, key):
                    setattr(run, key, value)
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to update agent run: {str(e)}")

    def appendError(self, runId, message):
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            run.error = f"{run.error}\n{message}" if run.error else message
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to append agent run error: {str(e)}")

    def finish(self, runId, status, error=None):
        """Terminal transition: releases the active lock so a new run can start."""
        try:
            run = self.session.get(AgentRun, runId)
            if not run:
                return None
            run.status = status
            run.activeLock = None
            run.finishedAt = datetime.utcnow()
            if error:
                run.error = f"{run.error}\n{error}" if run.error else error
            self.session.commit()
            return run
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to finish agent run: {str(e)}")

    def findStale(self, cutoff):
        """Runs still holding the lock whose worker went away.

        Keyed on started_at when the worker picked the run up, else created_at,
        so a run that was never dequeued at all is also released.
        """
        try:
            return (
                self.session.query(AgentRun)
                .filter(AgentRun.activeLock.is_(True))
                .filter(~AgentRun.status.in_(TERMINAL_STATUSES))
                .filter(func.coalesce(AgentRun.startedAt, AgentRun.createdAt) < cutoff)
                .all()
            )
        except Exception as e:
            raise Exception(f"Failed to fetch stale agent runs: {str(e)}")

    def addCompanyResult(self, runId, companyId, status, source=None, postingsFound=0, error=None, durationMs=None):
        try:
            row = (
                self.session.query(AgentRunCompanyResult)
                .filter(AgentRunCompanyResult.runId == runId)
                .filter(AgentRunCompanyResult.companyId == companyId)
                .one_or_none()
            )
            if row is None:
                row = AgentRunCompanyResult(runId=runId, companyId=companyId)
                self.session.add(row)
            row.status = status
            row.source = source
            row.postingsFound = postingsFound
            row.error = error
            row.durationMs = durationMs
            self.session.commit()
            return row
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to record company result: {str(e)}")

    def addFinding(self, runId, postingId, score=None, verdict=None, reason=None, isNew=False):
        try:
            row = (
                self.session.query(AgentRunFinding)
                .filter(AgentRunFinding.runId == runId)
                .filter(AgentRunFinding.postingId == postingId)
                .one_or_none()
            )
            if row is None:
                row = AgentRunFinding(runId=runId, postingId=postingId)
                self.session.add(row)
            row.score = score
            row.verdict = verdict
            row.reason = reason
            row.isNew = isNew
            self.session.commit()
            return row
        except Exception as e:
            self.session.rollback()
            raise Exception(f"Failed to record finding: {str(e)}")

    def getFindings(self, runId):
        try:
            return (
                self.session.query(AgentRunFinding)
                .filter(AgentRunFinding.runId == runId)
                .all()
            )
        except Exception as e:
            raise Exception(f"Failed to fetch findings: {str(e)}")

    def getCompanyResults(self, runId):
        try:
            return (
                self.session.query(AgentRunCompanyResult)
                .filter(AgentRunCompanyResult.runId == runId)
                .order_by(AgentRunCompanyResult.id.asc())
                .all()
            )
        except Exception as e:
            raise Exception(f"Failed to fetch company results: {str(e)}")
