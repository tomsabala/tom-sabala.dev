"""Redis connection + RQ queue used by the job-search agent.

Kept deliberately thin: the web process only enqueues and sets cancel keys,
the worker process consumes. Both read the same REDIS_URL.
"""
import os

import redis
from rq import Queue

QUEUE_NAME = 'agent'
DEFAULT_JOB_TIMEOUT = 3600


def getRedisUrl():
    return os.getenv('REDIS_URL', 'redis://localhost:6379/0')


def getRedis():
    return redis.Redis.from_url(getRedisUrl())


def getQueue():
    return Queue(QUEUE_NAME, connection=getRedis(), default_timeout=DEFAULT_JOB_TIMEOUT)


def cancelKey(runId):
    """Redis key the worker polls between companies to honour a cancel request."""
    return f'agent:run:{runId}:cancel'
