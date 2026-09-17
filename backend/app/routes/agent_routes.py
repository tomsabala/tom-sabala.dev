import os
import sys
import traceback
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError

from app import db, limiter
from app.dao import AgentRunDAO, CompanyDAO, JobApplicationDAO, JobPostingDAO, JobSearchProfileDAO
from app.models import AgentRunFinding, Company, JobApplication, JobPosting
from app.models.agent_run import TERMINAL_STATUSES
from app.queue import DEFAULT_JOB_TIMEOUT, cancelKey, getQueue, getRedis
from app.services.auth_service import AuthService

agent_bp = Blueprint('agent', __name__)

SWEEP_JOB = 'app.services.agent.sweep_service.runSweepJob'
CANCEL_KEY_TTL = 3600
RESULT_TTL = 86400


def _agentAvailable():
    """Only the key is a hard prerequisite.

    REDIS_URL is optional — `app.queue` falls back to localhost, which is what
    docker-compose serves in development, so demanding the variable reported
    the feature as unavailable against a perfectly working Redis. A Redis that
    is genuinely unreachable surfaces as the 502 from the enqueue below, which
    names the real failure instead of a blanket 503.
    """
    return bool(os.getenv('ANTHROPIC_API_KEY'))


def _releaseStaleRuns(runDao):
    """A dead worker must not block the feature forever."""
    minutes = int(os.getenv('AGENT_RUN_STALE_MINUTES', '90'))
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    for stale in runDao.findStale(cutoff):
        runDao.finish(stale.id, 'failed', error='Run timed out or worker died')


# ── Profile ───────────────────────────────────────────────────────────────────

@agent_bp.route('/jobs/agent/profile', methods=['GET'])
@jwt_required()
def getProfile():
    try:
        profile = JobSearchProfileDAO(db.session).get()
        return jsonify({'success': True, 'data': profile.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Runs ──────────────────────────────────────────────────────────────────────

@agent_bp.route('/jobs/agent/runs', methods=['POST'])
@jwt_required()
@limiter.limit("10 per hour")
def startRun():
    if not _agentAvailable():
        return jsonify({'success': False, 'error': 'Agent unavailable'}), 503

    data = request.get_json() or {}
    interests = (data.get('interests') or '').strip()
    if not interests:
        return jsonify({'success': False, 'error': 'interests is required'}), 400

    rawScore = data.get('min_score', 60)
    try:
        minScore = int(rawScore)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'error': 'min_score must be an integer 0-100'}), 400
    if minScore < 0 or minScore > 100:
        return jsonify({'success': False, 'error': 'min_score must be an integer 0-100'}), 400

    runDao = AgentRunDAO(db.session)
    try:
        _releaseStaleRuns(runDao)
        JobSearchProfileDAO(db.session).save(interests, minScore)
        # JWT identity is the user id; store the email so history reads as "who".
        user, _error = AuthService.getCurrentUser()
        run = runDao.create(interests, minScore, createdBy=(user.email if user else get_jwt_identity()))
    except IntegrityError:
        db.session.rollback()
        return jsonify({'success': False, 'error': 'A run is already in progress'}), 409
    except Exception as e:
        db.session.rollback()
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500

    try:
        job = getQueue().enqueue(
            SWEEP_JOB, run.id, job_timeout=DEFAULT_JOB_TIMEOUT, result_ttl=RESULT_TTL
        )
        runDao.setQueueJobId(run.id, job.id)
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        runDao.finish(run.id, 'failed', error=f'Could not enqueue the run: {e}')
        return jsonify({'success': False, 'error': f'Could not enqueue the run: {e}'}), 502

    return jsonify({'success': True, 'data': runDao.getById(run.id).toDict()}), 202


@agent_bp.route('/jobs/agent/runs', methods=['GET'])
@jwt_required()
# The app-wide default is 50/hour, which a 3-second progress poll blows through
# in under three minutes. These reads are admin-only and cheap, so they get
# their own ceilings instead.
@limiter.limit("300 per hour")
def getRuns():
    try:
        limit = min(max(int(request.args.get('limit', 20)), 1), 100)
    except (TypeError, ValueError):
        limit = 20
    try:
        runs = AgentRunDAO(db.session).listRecent(limit=limit)
        return jsonify({'success': True, 'data': [r.toDict() for r in runs]}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@agent_bp.route('/jobs/agent/runs/<int:runId>', methods=['GET'])
@jwt_required()
@limiter.limit("1200 per hour")
def getRun(runId):
    try:
        runDao = AgentRunDAO(db.session)
        run = runDao.getById(runId)
        if not run:
            return jsonify({'success': False, 'error': 'Run not found'}), 404

        names = dict(db.session.query(Company.id, Company.name).all())
        results = []
        for row in runDao.getCompanyResults(runId):
            item = row.toDict()
            item['company_name'] = names.get(row.companyId) or f'#{row.companyId}'
            results.append(item)

        payload = run.toDict()
        payload['company_results'] = results
        return jsonify({'success': True, 'data': payload}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@agent_bp.route('/jobs/agent/runs/<int:runId>/findings', methods=['GET'])
@jwt_required()
@limiter.limit("300 per hour")
def getFindings(runId):
    try:
        run = AgentRunDAO(db.session).getById(runId)
        if not run:
            return jsonify({'success': False, 'error': 'Run not found'}), 404

        rows = (
            db.session.query(AgentRunFinding, JobPosting, Company)
            .join(JobPosting, AgentRunFinding.postingId == JobPosting.id)
            .join(Company, JobPosting.companyId == Company.id)
            .filter(AgentRunFinding.runId == runId)
            .order_by(
                AgentRunFinding.score.desc().nullslast(),
                Company.name.asc(),
                JobPosting.title.asc(),
            )
            .all()
        )

        data = [{
            'id': finding.id,
            'score': finding.score,
            'verdict': finding.verdict,
            'reason': finding.reason,
            'is_new': finding.isNew,
            'posting': posting.toDict(),
            'company': {'id': company.id, 'name': company.name},
        } for finding, posting, company in rows]

        return jsonify({'success': True, 'data': data}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@agent_bp.route('/jobs/agent/runs/<int:runId>/cancel', methods=['POST'])
@jwt_required()
# Like the reads above, these admin-only writes would otherwise inherit the
# app-wide 50/hour, which triaging one sweep's findings blows straight through.
@limiter.limit("120 per hour")
def cancelRun(runId):
    try:
        runDao = AgentRunDAO(db.session)
        run = runDao.getById(runId)
        if not run:
            return jsonify({'success': False, 'error': 'Run not found'}), 404
        if run.status in TERMINAL_STATUSES:
            return jsonify({'success': False, 'error': f'Run already {run.status}'}), 409

        # The worker polls this key between companies.
        try:
            getRedis().set(cancelKey(runId), '1', ex=CANCEL_KEY_TTL)
        except Exception as e:
            print(traceback.format_exc(), file=sys.stderr)
            return jsonify({'success': False, 'error': f'Could not signal cancellation: {e}'}), 502

        if run.status == 'queued':
            # Never dequeued: kill the job and finish it here, otherwise the
            # lock would sit until the stale sweep releases it.
            if run.queueJobId:
                try:
                    from rq.job import Job
                    Job.fetch(run.queueJobId, connection=getRedis()).cancel()
                except Exception:
                    print(traceback.format_exc(), file=sys.stderr)
            runDao.finish(runId, 'cancelled')

        return jsonify({'success': True, 'data': runDao.getById(runId).toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


# ── Postings ──────────────────────────────────────────────────────────────────

@agent_bp.route('/jobs/agent/postings/<int:postingId>/dismiss', methods=['POST'])
@jwt_required()
@limiter.limit("300 per hour")
def dismissPosting(postingId):
    try:
        posting = JobPostingDAO(db.session).dismiss(postingId)
        if not posting:
            return jsonify({'success': False, 'error': 'Posting not found'}), 404
        return jsonify({'success': True, 'data': posting.toDict()}), 200
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500


@agent_bp.route('/jobs/agent/postings/<int:postingId>/bookmark', methods=['POST'])
@jwt_required()
@limiter.limit("300 per hour")
def bookmarkPosting(postingId):
    try:
        postingDao = JobPostingDAO(db.session)
        posting = postingDao.getById(postingId)
        if not posting:
            return jsonify({'success': False, 'error': 'Posting not found'}), 404

        existing = (
            db.session.query(JobApplication)
            .filter(JobApplication.jobPostingId == posting.id)
            .first()
        )
        if existing:
            return jsonify({'success': False, 'error': 'Already linked to an application'}), 409

        company = CompanyDAO(db.session).getById(posting.companyId)
        applicationDao = JobApplicationDAO(db.session)
        application = applicationDao.create(
            companyName=company.name if company else 'Unknown',
            # job_applications.position is String(200) and job_url String(500),
            # both narrower than the posting columns.
            position=posting.title[:200],
            status='bookmarked',
            companyId=posting.companyId,
            jobUrl=posting.url[:500],
        )
        applicationDao.update(application.id, jobPostingId=posting.id)
        return jsonify({'success': True, 'data': applicationDao.getById(application.id).toDict()}), 201
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        return jsonify({'success': False, 'error': str(e)}), 500
