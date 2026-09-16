"""RQ worker entry point (SERVICE_ROLE=worker).

One long-lived app context is pushed so `db.session` works inside jobs; each
job removes the session in its own `finally` so state never leaks between runs.
"""
from rq import Queue, Worker

from app import create_app
from app.queue import QUEUE_NAME, getRedis

app = create_app()
app.app_context().push()

if __name__ == '__main__':
    conn = getRedis()
    Worker([Queue(QUEUE_NAME, connection=conn)], connection=conn).work(with_scheduler=False)
