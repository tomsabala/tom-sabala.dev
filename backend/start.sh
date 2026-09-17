#!/bin/sh
# One build, two roles. The worker must never run `flask db upgrade`:
# two concurrent upgrades race on the alembic version table.
set -e
if [ "${SERVICE_ROLE:-web}" = "worker" ]; then
  exec python worker.py
fi
# Docs are a non-critical feature and setup_docs.py exits 1 on a download
# failure (expired token, GitHub outage). `set -e` must not turn that into a
# dead container — see commit e499b9b.
python scripts/setup_docs.py || echo 'setup_docs failed; continuing without docs' >&2
flask db upgrade
exec gunicorn -c gunicorn_config.py "app:create_app()"
