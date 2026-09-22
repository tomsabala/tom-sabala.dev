# Production Deployment Checklist

This document outlines all tasks required to deploy the portfolio website to production.

---

## 🔐 1. SendGrid Configuration

### Domain Authentication (DNS Setup)
**Why:** Professional sender reputation, better deliverability, no "via sendgrid.net" warning

**Steps:**
1. SendGrid Dashboard → Settings → Sender Authentication → Domain Authentication
2. Choose your domain: `tom-sabala.dev`
3. SendGrid provides DNS records (CNAME records)
4. Add these DNS records to your domain registrar:
   - Typically 3 CNAME records for authentication
   - May include DKIM, SPF records
5. Wait for DNS propagation (5-60 minutes)
6. Verify in SendGrid

**DNS Records Example:**
```
Type: CNAME
Host: em1234.tom-sabala.dev
Value: u1234567.wl123.sendgrid.net

Type: CNAME
Host: s1._domainkey.tom-sabala.dev
Value: s1.domainkey.u1234567.wl123.sendgrid.net

Type: CNAME
Host: s2._domainkey.tom-sabala.dev
Value: s2.domainkey.u1234567.wl123.sendgrid.net
```

**After completion:**
```bash
SENDGRID_FROM_EMAIL=noreply@tom-sabala.dev
```

---

## 🌐 2. Domain & DNS Configuration

### Domain Purchase
- [ ] Purchase domain: `tom-sabala.dev` (or already owned)
- [ ] Choose registrar: Namecheap, GoDaddy, Cloudflare, Google Domains

### DNS Records Setup
```
# Frontend (Vercel/Netlify)
Type: A or CNAME
Host: @
Value: [hosting provider IP/CNAME]

Type: CNAME
Host: www
Value: tom-sabala.dev

# Backend API (if separate subdomain)
Type: A or CNAME
Host: api
Value: [backend server IP/CNAME]
```

### SSL/HTTPS
- [ ] SSL certificate (usually auto-provisioned by hosting provider)
- [ ] Force HTTPS redirect
- [ ] If using custom setup: Let's Encrypt (free SSL)

---

## 🗄️ 3. Database (PostgreSQL Production)

### Railway PostgreSQL (Current)
Railway provides managed PostgreSQL via a single-click plugin. It auto-injects `DATABASE_URL` into the connected service's environment — no manual entry needed.

**Setup:**
1. In Railway project, click "New" → "Database" → "PostgreSQL"
2. `DATABASE_URL` is automatically available to the backend service
3. Migrations run automatically on every deploy — the start command in both
   `Procfile` and `nixpacks.toml` runs `flask db upgrade` before gunicorn, which
   applies any pending migration and is a no-op once at head. Run it by hand only
   for an ad-hoc upgrade.
4. Seed data via admin UI or restore from backup

**Database Migration from Render (if needed):**
```bash
# Dump from Render Postgres
pg_dump $RENDER_DATABASE_URL > backup.sql

# Restore to Railway Postgres
psql $RAILWAY_DATABASE_URL < backup.sql
```

### Backup Strategy
- [ ] Enable automated backups (daily recommended)
- [ ] Test backup restoration process
- [ ] Set up backup retention policy (7-30 days)

---

## 🔑 4. Environment Variables (Production)

### Backend Production `.env`
```bash
# Flask Configuration
FLASK_APP=run.py
FLASK_ENV=production  # CRITICAL: Change from development
FLASK_DEBUG=False      # CRITICAL: Must be False
SECRET_KEY=generate-a-strong-random-secret-key-here  # CHANGE THIS!

# Server
PORT=5000

# CORS - Update to production domain
CORS_ORIGINS=https://tom-sabala.dev,https://www.tom-sabala.dev

# Database - Production PostgreSQL
DATABASE_URL=postgresql://prod_user:prod_password@db-host:5432/prod_db

# SendGrid - Production
SENDGRID_API_KEY=SG.production-api-key-here
SENDGRID_FROM_EMAIL=noreply@tom-sabala.dev  # Verified domain
CONTACT_EMAIL=sabala144@gmail.com

# Job-search agent (set on BOTH the web and worker services)
REDIS_URL=redis://default:password@redis-host:6379/0  # Railway Redis plugin
ANTHROPIC_API_KEY=sk-ant-production-key-here
# Worker service only:
SERVICE_ROLE=worker
BROWSER_FALLBACK_ENABLED=true  # false if chromium is missing from the image
```

### Frontend Production `.env`
```bash
VITE_API_URL=https://api.tom-sabala.dev/api  # Production API URL
# or if same domain: https://tom-sabala.dev/api
```

### Generate Strong Secret Key
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 🚀 5. Backend Deployment (Railway)

### Platform: Railway (Current)
Railway auto-detects Python via `requirements.txt` and uses `Procfile` for the start command. Builds use Nixpacks.

**Key files:**
- `backend/start.sh` — the single start command for both roles. It branches on
  `SERVICE_ROLE`: `worker` execs `python worker.py`, anything else (default
  `web`) runs `flask db upgrade` then gunicorn. The worker must never migrate —
  two concurrent upgrades race on the alembic version table.
- `backend/Procfile` — `web: ./start.sh`
- `backend/nixpacks.toml` — holds the identical start command plus the
  `playwright install --with-deps chromium` step; Railway may use either file,
  so the two must be kept in sync or a deploy could skip migrations
- `backend/runtime.txt` — pins Python version: `python-3.12.x`
- `backend/gunicorn_config.py` — gunicorn config (reads `PORT` from env)

### Production Server Setup

Gunicorn is already in `requirements.txt` and configured via `gunicorn_config.py`:
- Binds to `0.0.0.0:$PORT` (Railway sets `PORT` automatically)
- Workers: `WEB_CONCURRENCY` if set, otherwise 2 — deliberately not
  `cpu_count()`, which over-provisions on shared hosts and causes OOM
- Timeout: 120s
- Logs to stdout/stderr

### Deployment Steps
1. [ ] Push code to GitHub
2. [ ] Create Railway project at railway.app
3. [ ] Add PostgreSQL plugin (auto-injects `DATABASE_URL`)
4. [ ] Connect GitHub repo, set root directory to `backend/`
5. [ ] Set environment variables in Railway dashboard:
   - `FLASK_ENV=production`
   - `SECRET_KEY`, `JWT_SECRET_KEY`
   - `CORS_ORIGINS=https://tom-sabala.dev,https://www.tom-sabala.dev`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_WHITELIST` (comma-separated admin emails)
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `CONTACT_EMAIL`
   - `STORAGE_TYPE`, `AWS_*` (if using S3)
   - `SENTRY_DSN`
   - `JWT_COOKIE_SECURE=True`, `JWT_COOKIE_SAMESITE=None`
   - `ANTHROPIC_API_KEY` (company category "Suggest with AI"; endpoint returns 503 without it)
   - `GITHUB_USERNAME` (GitHub stats page)
   - (`PORT` and `DATABASE_URL` are auto-set by Railway)
6. [ ] Deploy (auto-builds from `requirements.txt`, runs `Procfile`)
7. [ ] Confirm migrations ran (the start command applies them on every deploy)
8. [ ] Test all API endpoints

### Agent Worker Service (job-search agent)

The sweep runs off the web service. Add a **second Railway service from the same
repo**, root directory `backend/`, so both roles ship from one build:

1. [ ] Add the Redis plugin to the project and reference its URL as `REDIS_URL`
       from **both** services
2. [ ] New service → same GitHub repo → root directory `backend/`
3. [ ] Set `SERVICE_ROLE=worker` on it, plus `DATABASE_URL`, `REDIS_URL`,
       `ANTHROPIC_API_KEY` (and `SENTRY_DSN` if used). No `PORT` — it serves
       no HTTP.
4. [ ] Leave `SERVICE_ROLE` unset (or `web`) on the API service
5. [ ] If the build's `playwright install --with-deps chromium` step fails
       (the `|| echo` keeps the build green), set `BROWSER_FALLBACK_ENABLED=false`
       on the worker: discovery then uses static fetches only, which already
       covers ATS-embedded and server-rendered career pages
6. [ ] Confirm the worker log shows `*** Listening on agent...`
7. [ ] `POST /api/jobs/agent/runs` returns 503 unless both `ANTHROPIC_API_KEY`
       and `REDIS_URL` are set on the web service

---

## 💻 6. Frontend Deployment

### Choose Hosting Provider
- **Vercel** (Recommended - best for React/Vite)
- **Netlify** (great alternative)
- **Cloudflare Pages** (fast CDN)

### Deployment Steps
1. [ ] Update `VITE_API_URL` in `.env.production`
2. [ ] Push code to GitHub
3. [ ] Connect repository to hosting platform
4. [ ] Configure build settings:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. [ ] Set environment variables in platform
6. [ ] Deploy
7. [ ] Configure custom domain
8. [ ] Test all pages and features

### Subdomain Entry Points
`frontend/vercel.json` routes `terminal.tom-sabala.dev` to its own Vite entry, so it rides
along with the normal frontend deploy — no second project, no extra cost:

| Subdomain | Entry | Content | Served by |
|-----------|-------|---------|-----------|
| `terminal.tom-sabala.dev` | `terminal.html` | Interactive terminal portfolio | Vercel |
| `apps.tom-sabala.dev` | `apps.html` | App launcher: static bundles **and** per-visitor app instances | the gateway VPS, from the frontend build on its own disk — Vercel is not in the path |

Every domain on the project serves the whole build, so the remaining host rules redirect
`/hosted/**` and `/apps.html` **off** `tom-sabala.dev`/`www` to the apps subdomain, so app
bundles never execute on the origin listed in the API's `CORS_ORIGINS`.

`apps.tom-sabala.dev` is not a Vercel domain: its DNS points at the gateway VPS (`gateway/`),
which terminates TLS, runs admin sign-in, the instance broker, **and** serves the launcher and
`/hosted/**` from a volume it builds itself. So a change under `frontend/` reaches the apps
subdomain only after `git pull` + `docker compose -f gateway/docker-compose.yml run --rm
launcher-build` on the VPS — a Vercel deploy alone does not update it. Full runbook in
**`gateway/README.md`**.

**Action Required (terminal subdomain, once):**
- [ ] Add the domain to the existing Vercel project (Settings → Domains)
- [ ] Point DNS at Vercel (CNAME `terminal` → `cname.vercel-dns.com`)

**Action Required (apps subdomain, once):**
- [ ] Provision the VPS, run `launcher-build`, then `gateway/docker-compose.yml up -d`
      (see `gateway/README.md`)
- [ ] Add `https://apps.tom-sabala.dev/oauth2/callback` to the Google OAuth client
- [ ] Repoint DNS: remove the `apps` CNAME to Vercel, add an A/AAAA record to the VPS.
      On Cloudflare set it to **DNS only** (grey cloud) — proxying breaks Caddy's HTTP-01
      challenge, so no certificate is ever issued
- [ ] Leave `apps.tom-sabala.dev` off the Vercel project's domains
- [ ] Verify `https://apps.tom-sabala.dev` lands on the launcher, a bundle opens in-frame, and
      a service app starts its own instance
- [ ] Verify any `/hosted/**` URL on the apex redirects to the apps subdomain (the rule is
      path-prefix based; `https://tom-sabala.dev/hosted/` is enough, no bundle need exist)
- [ ] Do **not** add `apps.tom-sabala.dev` to `CORS_ORIGINS` — that would hand any hosted bundle
      or app instance credentialed API access
- [ ] Hide the sidebar link any time via Settings → Tabs → Apps (tab key `apps`); this hides the
      link only — the apps subdomain stays publicly reachable

### PDF Download Feature Configuration
**Important:** The CV/Resume PDF download feature uses query parameters to control download behavior:

- The backend endpoint `/cv/pdf/file` supports a `?download=true` parameter
- Frontend uses two URL functions in `repositories/resumeRepository.ts`:
  - `getPdfFileUrl()` - Returns URL without query param (for inline PDF viewing)
  - `getPdfDownloadUrl()` - Returns URL with `?download=true` (forces browser download)
- When `download=true`, backend serves file with `Content-Disposition: attachment`
- When `download=false` or omitted, backend serves inline for PDF viewer

**Action Required:**
- [ ] Ensure `VITE_API_URL` environment variable is correctly set to production API
- [ ] Test both inline viewing (in PDF viewer) and download button functionality
- [ ] Verify downloads work correctly in Firefox, Chrome, and Safari

### Build Optimization
```bash
# Run production build locally to test
npm run build
npm run preview
```

Check build output size - optimize if needed:
- Code splitting
- Image optimization
- Remove unused dependencies

---

## 🔒 7. Security Hardening

### Backend Security
- [ ] `FLASK_DEBUG=False` in production
- [ ] Strong `SECRET_KEY` (32+ random characters)
- [ ] CORS limited to production domains only
- [ ] HTTPS enforced (redirect HTTP → HTTPS)
- [ ] Security headers (see below)
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (using ORM = ✅ already safe)

### Add Security Headers
```python
# In app/__init__.py, add after CORS:
@app.after_request
def setSecurityHeaders(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response
```

### Rate Limiting
```bash
# Add to requirements.txt
Flask-Limiter==3.5.0
```

```python
# In app/__init__.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# In routes.py
@limiter.limit("5 per minute")  # Limit contact form
@api_bp.route('/contact', methods=['POST'])
def contact():
    ...
```

### Environment Variables Security
- [ ] Never commit `.env` to git (already in `.gitignore` ✅)
- [ ] Use platform's secret management (Render, Vercel secrets)
- [ ] Rotate API keys periodically
- [ ] Use different keys for dev/staging/prod

---

## 📊 8. Monitoring & Logging

### Error Tracking
**Recommended: Sentry** (free tier: 5K errors/month)

```bash
# Add to requirements.txt
sentry-sdk[flask]==1.40.0
```

```python
# In app/__init__.py
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

if os.getenv('FLASK_ENV') == 'production':
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN'),
        integrations=[FlaskIntegration()],
        traces_sample_rate=1.0
    )
```

Steps:
1. [ ] Sign up for Sentry: https://sentry.io
2. [ ] Create new project (Flask)
3. [ ] Copy DSN
4. [ ] Add `SENTRY_DSN` to production env vars
5. [ ] Test error reporting

### Application Monitoring
- [ ] **Uptime monitoring:** UptimeRobot, Pingdom (free tiers available)
- [ ] **Performance monitoring:** New Relic, Datadog (or Sentry Performance)
- [ ] **Log aggregation:** Papertrail, Logtail (if not using platform logs)

### Health Check Endpoint
Already implemented ✅ (`/api/health`)
- Set up uptime monitor to ping this endpoint every 5 minutes

---

## 📈 9. Analytics & SEO

### Analytics Setup
**Option A: Google Analytics**
1. [ ] Create GA4 property
2. [ ] Add tracking code to frontend `index.html`
3. [ ] Set up goals/conversions

**Option B: Privacy-focused alternatives**
- Plausible Analytics (paid, privacy-friendly)
- Simple Analytics (paid)
- Umami (free, self-hosted)

### SEO Optimization

#### Meta Tags (Frontend)
Update `index.html` and individual pages:
```html
<meta name="description" content="Tom Sabala - Software Engineer Portfolio">
<meta name="keywords" content="software engineer, full-stack developer, portfolio">
<meta name="author" content="Tom Sabala">

<!-- Open Graph (social sharing) -->
<meta property="og:title" content="Tom Sabala - Software Engineer">
<meta property="og:description" content="Full-stack developer specializing in...">
<meta property="og:image" content="https://tom-sabala.dev/og-image.jpg">
<meta property="og:url" content="https://tom-sabala.dev">
<meta property="og:type" content="website">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Tom Sabala - Software Engineer">
<meta name="twitter:description" content="Full-stack developer...">
<meta name="twitter:image" content="https://tom-sabala.dev/twitter-card.jpg">
```

#### Additional Files
1. [ ] Create `robots.txt` in `public/`
   ```
   User-agent: *
   Allow: /
   Sitemap: https://tom-sabala.dev/sitemap.xml
   ```

2. [ ] Create `sitemap.xml` in `public/`
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://tom-sabala.dev/</loc>
       <changefreq>monthly</changefreq>
       <priority>1.0</priority>
     </url>
     <url>
       <loc>https://tom-sabala.dev/portfolio</loc>
       <changefreq>weekly</changefreq>
       <priority>0.8</priority>
     </url>
     <url>
       <loc>https://tom-sabala.dev/cv</loc>
       <changefreq>monthly</changefreq>
       <priority>0.8</priority>
     </url>
     <url>
       <loc>https://tom-sabala.dev/contact</loc>
       <changefreq>yearly</changefreq>
       <priority>0.6</priority>
     </url>
   </urlset>
   ```

3. [ ] Create `favicon.ico` and icons
4. [ ] Submit sitemap to Google Search Console

---

## ⚡ 10. Performance Optimization

### Frontend
- [ ] Image optimization (WebP format, lazy loading)
- [ ] Code splitting (React.lazy for routes)
- [ ] Minification (Vite does this automatically ✅)
- [ ] CDN for static assets
- [ ] Cache headers for static files
- [ ] Remove console.logs from production build

### Backend
- [ ] Database query optimization (add indexes if needed)
- [ ] Enable gzip compression
- [ ] Cache static responses (if applicable)
- [ ] Database connection pooling (SQLAlchemy does this ✅)

### CDN Setup (Optional)
- Cloudflare (free tier, easy setup)
- AWS CloudFront
- Improves global load times

---

## ✅ 11. Testing & Verification

### Pre-Deployment Testing
- [ ] Test all API endpoints in staging
- [ ] Test contact form email delivery
- [ ] Test database operations (CRUD)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness testing
- [ ] Load testing (optional: artillery, k6)

### Post-Deployment Verification
- [ ] Verify all pages load correctly
- [ ] Test portfolio data displays from database
- [ ] Test CV data displays from database
- [ ] Test contact form sends emails
- [ ] Verify HTTPS works (no mixed content warnings)
- [ ] Check console for errors
- [ ] Test on mobile devices
- [ ] Verify analytics tracking
- [ ] Check error monitoring (trigger test error)

### SSL/HTTPS Verification
- [ ] Test site at: https://www.ssllabs.com/ssltest/
- [ ] Should get A or A+ rating

---

## 📝 12. Documentation

- [ ] Update README.md with:
  - Production URL
  - Tech stack
  - Setup instructions
  - Environment variables needed
- [ ] Document API endpoints (optional: Swagger/OpenAPI)
- [ ] Create runbook for common issues
- [ ] Document backup restoration process

---

## 🔄 13. CI/CD Pipeline (Optional but Recommended)

### GitHub Actions Example
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend
          pip install -r requirements.txt
          # Add test commands here

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      # Deployment steps (handled by hosting platform usually)
      - name: Trigger deployment
        run: echo "Backend deployed via webhook"

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      # Deployment steps (handled by hosting platform usually)
      - name: Trigger deployment
        run: echo "Frontend deployed automatically"
```

---

## 📋 14. Final Checklist

### Before Going Live
- [ ] All environment variables set correctly
- [ ] Database migrations applied
- [ ] Real data populated (or seed data)
- [ ] Contact form tested and working
- [ ] Custom domain configured
- [ ] HTTPS enabled and working
- [ ] Error monitoring active
- [ ] Backups configured
- [ ] Analytics installed
- [ ] SEO meta tags added
- [ ] All pages tested
- [ ] Mobile responsive verified
- [ ] No console errors
- [ ] Security headers configured
- [ ] Rate limiting enabled

### Post-Launch
- [ ] Submit sitemap to Google Search Console
- [ ] Monitor error logs for first 24-48 hours
- [ ] Check email delivery works
- [ ] Monitor performance metrics
- [ ] Set up uptime monitoring alerts
- [ ] Share portfolio link (LinkedIn, resume, etc.)

---

## 🎯 Recommended Deployment Order

1. **Set up production database** (Railway PostgreSQL plugin)
2. **Deploy backend** (Railway)
3. **Configure SendGrid domain authentication** (DNS)
4. **Deploy frontend** (Vercel)
5. **Configure custom domain** (DNS records)
6. **Set up monitoring** (Sentry, uptime monitoring)
7. **Final testing and verification**
8. **Go live!** 🚀

---

## 📞 Support Resources

- **SendGrid Docs:** https://docs.sendgrid.com/
- **Railway Docs:** https://docs.railway.app/
- **Vercel Docs:** https://vercel.com/docs
- **Flask Production:** https://flask.palletsprojects.com/en/3.0.x/deploying/
- **Sentry Setup:** https://docs.sentry.io/platforms/python/guides/flask/

---

## 🔄 Maintenance Tasks

### Regular (Monthly)
- [ ] Check error logs
- [ ] Review analytics
- [ ] Update dependencies (`pip list --outdated`, `npm outdated`)
- [ ] Verify backups are working
- [ ] Check SSL certificate expiry

### Quarterly
- [ ] Security audit
- [ ] Performance review
- [ ] Database cleanup (if needed)
- [ ] Rotate API keys

### Yearly
- [ ] Renew domain
- [ ] Review hosting costs
- [ ] Major dependency updates

---

**Last Updated:** 2026-01-02
**Status:** Pre-production - Ready for deployment setup
