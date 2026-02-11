"""Gunicorn production server configuration"""
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '5000')}"

# Worker processes
# Use WEB_CONCURRENCY env var if set, otherwise default to 2
# (avoid cpu_count() — shared hosts report all CPUs, causing OOM)
workers = int(os.getenv("WEB_CONCURRENCY", 2))
worker_class = "sync"
worker_connections = 1000
timeout = 120
keepalive = 5

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "portfolio-backend"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (handled by reverse proxy)
keyfile = None
certfile = None
