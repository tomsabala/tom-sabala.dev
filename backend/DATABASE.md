# Database Management Guide

## Quick Start

### Start Database
```bash
# From backend directory
cd backend
docker compose up -d

# Or if already running the manual container, it will continue to work
docker start portfolio-postgres
```

### Stop Database
```bash
# From backend directory
cd backend
docker compose down  # Stops but keeps data
docker compose down -v  # ⚠️ Stops AND deletes all data!
```

## Data Persistence

✅ **Your data is automatically saved!**
- Docker stores data in a named volume: `backend_postgres_data`
- That name is pinned in `docker-compose.yml`, so it stays the same even though
  the compose project is named `tom-sabala-dev` — do not remove the pin, or
  compose will look for a new empty volume and the existing data will appear lost
- Data persists even when you stop/restart the container
- Data survives computer restarts

## Database Credentials

- **Host**: localhost
- **Port**: 5432 — published on `127.0.0.1` only, so the database is not
  reachable from other machines on the LAN or over Tailscale
- **Database**: dev_db
- **User**: admin_dev
- **Password**: admin

## Admin Access

There is no password login. `app/routes/auth_routes.py` exposes only `/google`,
`/logout`, `/refresh`, `/me` and `/check` — admin access is granted by email
whitelist, not by a seeded password.

- Set `GOOGLE_OAUTH_WHITELIST` in `.env` to a comma-separated list of Google
  account emails, e.g. `GOOGLE_OAUTH_WHITELIST=sabala144@gmail.com`
- To sign in, click the site header 7 times within 2 seconds to reveal the hidden
  login modal, then use Sign in with Google
- The `admin_users` row is created automatically on first successful login, so
  nothing needs to be seeded

The `password_hash` column still exists on `admin_users` for legacy rows, but no
route checks it.

## Common Tasks

### Run the Backend Server
```bash
cd backend
source venv/bin/activate
python run.py
```

The backend will automatically connect to the database if it's running.

### Access Database Directly
```bash
# Using psql in the Docker container
docker exec -it portfolio-postgres psql -U admin_dev -d dev_db

# Common psql commands:
\dt              # List all tables
\d projects      # Describe projects table
SELECT * FROM projects;  # Query projects
\q               # Quit psql
```

### Reset Database (Clear All Data)

There is no seed script. To start from an empty schema, destroy the volume and
re-run the migrations:

```bash
cd backend
docker compose down -v  # ⚠️ destroys backend_postgres_data and all data in it
docker compose up -d
source venv/bin/activate
flask db upgrade        # recreates every table at the current migration head
```

This leaves you with empty tables:
1. No admin user — one is recreated on your next Google login
2. No projects, resume, about content or ideas — re-enter them through the admin UI

To wipe the data but keep the schema, truncate instead:
```bash
docker exec -it portfolio-postgres psql -U admin_dev -d dev_db \
  -c 'TRUNCATE projects, ideas, companies, job_applications, contact_submissions RESTART IDENTITY CASCADE;'
```

## Making Schema Changes

When you need to add/modify/delete database tables or columns:

### 1. Edit the Model
Edit the model file in `app/models/`

Example - Add a new field to Project:
```python
# app/models/project.py
class Project(db.Model):
    # ... existing fields ...
    featured = db.Column(db.Boolean, default=False)  # NEW FIELD
```

### 2. Create Migration
```bash
source venv/bin/activate
flask db migrate -m "Add featured field to projects"
```

### 3. Apply Migration
```bash
flask db upgrade
```

### 4. Data Persists!
Your existing data is preserved. New fields get default values.

## Database Tables

1. **projects** - Portfolio projects (CRUD for admin)
2. **ideas** - Ideas list (shown on the Portfolio page)
3. **resume** - Resume data (single row, admin can update)
4. **resume_pdf_versions** - Uploaded CV PDFs (soft delete, activation history)
5. **about_me** - About section (single row, admin can update)
6. **contact_submissions** - Contact form submissions
7. **companies** - Job tracker companies (incl. AI-generated `categories`)
8. **job_applications** - Job tracker applications (8 statuses)
9. **tab_configs** - Nav tab visibility config
10. **admin_users** - Admin authentication (Google OAuth)
11. **alembic_version** - Migration tracking (auto-managed)

## Troubleshooting

### Database connection error
```bash
# Check if database is running
docker ps | grep portfolio-postgres

# If not running, start it
docker compose up -d
```

### Port 5432 already in use
```bash
# Another PostgreSQL instance is running
# Either stop it, or change the port in docker-compose.yml
ports:
  - "127.0.0.1:5433:5432"  # Use port 5433 instead

# Then update .env DATABASE_URL to:
DATABASE_URL=postgresql://admin_dev:admin@localhost:5433/dev_db
```

### Locked out of admin
There is no password to reset. Check that the Google account you are signing in
with is listed in `GOOGLE_OAUTH_WHITELIST` in `.env`, and that the backend was
restarted after you changed it. A non-whitelisted email gets a 403 from
`POST /api/auth/google`.

## Backup & Restore

### Backup
```bash
docker exec portfolio-postgres pg_dump -U admin_dev dev_db > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i portfolio-postgres psql -U admin_dev -d dev_db
```

## Production Notes

When deploying to production:

1. **Change credentials** - Use strong passwords
2. **Use managed database** - Render, Railway, AWS RDS, etc.
3. **Backup regularly** - Set up automated backups
4. **Environment variables** - Never commit DATABASE_URL with real credentials
5. **SSL/TLS** - Enable secure connections

Example production DATABASE_URL:
```
DATABASE_URL=postgresql://user:pass@your-db-host.com:5432/portfolio_prod
```
