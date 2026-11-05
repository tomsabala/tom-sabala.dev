"""Redis connection + RQ queue used by the job-search agent.

Kept deliberately thin: the web process only enqueues and sets cancel keys,
the worker process consumes. Both read the same REDIS_URL.
"""
import os
from functools import lru_cache

import redis
from rq import Queue

QUEUE_NAME = 'agent'
DEFAULT_JOB_TIMEOUT = 3600


def getRedisUrl():
    return os.getenv('REDIS_URL', 'redis://localhost:6379/0')


def getRedis():
    return redis.Redis.from_url(getRedisUrl())


#: The measurement path runs inside `after_request`, so an unreachable Redis
#: must not hold a content response that is already generated.
ANALYTICS_TIMEOUT_SECONDS = 0.25


@lru_cache(maxsize=1)
def getAnalyticsRedis():
    """Short-timeout client for the analytics salt and retention key.

    Separate from `getRedis()`, which the RQ worker uses and which must keep
    blocking semantics. Cached because `from_url()` builds a new connection
    pool per call, and this one is called on every measured request.
    """
    return redis.Redis.from_url(
        getRedisUrl(),
        socket_connect_timeout=ANALYTICS_TIMEOUT_SECONDS,
        socket_timeout=ANALYTICS_TIMEOUT_SECONDS,
    )


def getQueue():
    return Queue(QUEUE_NAME, connection=getRedis(), default_timeout=DEFAULT_JOB_TIMEOUT)


def cancelKey(runId):
    """Redis key the worker polls between companies to honour a cancel request."""
    return f'agent:run:{runId}:cancel'
