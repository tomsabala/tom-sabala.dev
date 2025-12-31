# Database Management Guide

## Quick Start

### Start Database
```bash
# From project root
docker-compose up -d

# Or if already running the manual container, it will continue to work
docker start portfolio-postgres
```

### Stop Database
```bash
docker-compose down  # Stops but keeps data
docker-compose down -v  # ⚠️ Stops AND deletes all data!
```

## Data Persistence

✅ **Your data is automatically saved!**
- Docker stores data in a named volume: `postgres_data`
- Data persists even when you stop/restart the container
- Data survives computer restarts

## Database Credentials

- **Host**: localhost
- **Port**: 5432
- **Database**: portfolio_dev
- **User**: portfolio_user
- **Password**: dev123

## Admin Login (Seeded Data)

- **Username**: admin
- **Email**: sabala144@gmail.com
- **Password**: admin123
- ⚠️ **Change this password in production!**

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
docker exec -it portfolio-postgres psql -U portfolio_user -d portfolio_dev

# Common psql commands:
\dt              # List all tables
\d projects      # Describe projects table
SELECT * FROM projects;  # Query projects
\q               # Quit psql
```

### Reset Database (Clear All Data)
```bash
cd backend
source venv/bin/activate
python seed.py
```

This will:
1. Delete all existing data
2. Create fresh admin user
3. Add sample projects
4. Add sample resume data
5. Add about me content

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
2. **resume** - Resume data (single row, admin can update)
3. **about_me** - About section (single row, admin can update)
4. **contact_submissions** - Contact form submissions
5. **admin_users** - Admin authentication
6. **alembic_version** - Migration tracking (auto-managed)

## Troubleshooting

### Database connection error
```bash
# Check if database is running
docker ps | grep portfolio-postgres

# If not running, start it
docker-compose up -d
```

### Port 5432 already in use
```bash
# Another PostgreSQL instance is running
# Either stop it, or change the port in docker-compose.yml
ports:
  - "5433:5432"  # Use port 5433 instead

# Then update .env DATABASE_URL to:
DATABASE_URL=postgresql://portfolio_user:dev123@localhost:5433/portfolio_dev
```

### Lost admin password
Run the seed script again - it will reset everything including the admin user.

## Backup & Restore

### Backup
```bash
docker exec portfolio-postgres pg_dump -U portfolio_user portfolio_dev > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i portfolio-postgres psql -U portfolio_user -d portfolio_dev
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
