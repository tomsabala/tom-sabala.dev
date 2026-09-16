#!/bin/sh
# One build, two roles. The worker must never run `flask db upgrade`:
# two concurrent upgrades race on the alembic version table.
set -e
if [ "${SERVICE_ROLE:-web}" = "worker" ]; then
  exec python worker.py
fi
python scripts/setup_docs.py
flask db upgrade
exec gunicorn -c gunicorn_config.py "app:create_app()"
