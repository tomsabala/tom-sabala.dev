# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website with Flask backend API and React frontend. Features include portfolio project management, resume/CV with PDF version control, contact form with email notifications, Google OAuth admin authentication, job tracking (companies + applications with AI-generated category tags), and admin-controlled tab visibility.

**Tech Stack:**
- Backend: Python 3 + Flask + SQLAlchemy + PostgreSQL + SendGrid + Anthropic API
- Frontend: React 18 + TypeScript + Vite + React Router + Tailwind CSS
- Auth: Google OAuth + JWT with HttpOnly cookies
- Storage: Local filesystem or AWS S3 (configurable via factory pattern)
- Deployment: Vercel (frontend) + Railway (backend)

## Development Commands

### Backend (from `backend/` directory)

```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Start PostgreSQL and run server
docker-compose up -d
python run.py

# Database migrations
flask db upgrade              # Apply migrations
flask db migrate -m "msg"     # Create new migration
flask db downgrade            # Rollback one migration
```

### Frontend (from `frontend/` directory)

```bash
npm install && cp .env.example .env
npm run dev      # Development server (port 5173)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

### Backend Structure

```
backend/app/
├── __init__.py          # App factory, CORS, security middleware, blueprints
├── models/              # SQLAlchemy models
│   ├── project.py       # Portfolio projects (isVisible, displayOrder)
│   ├── user.py          # Admin users (Google OAuth)
│   ├── resume.py        # CV data (JSON storage)
│   ├── resume_pdf.py    # PDF versions (soft delete, activation history)
│   ├── contact.py       # Contact submissions
│   ├── about.py         # About content
│   ├── company.py       # Job tracker companies (name, url, notes, categories JSON)
│   ├── job_application.py  # Job applications (8 statuses)
│   ├── idea.py          # Ideas list
│   └── tab_config.py    # Nav tab visibility config (tab_key, is_visible)
├── dao/                 # Data Access Objects (all DB queries)
│   ├── project_dao.py
│   ├── user_dao.py
│   ├── resume_dao.py
│   ├── resume_pdf_dao.py
│   ├── contact_submission_dao.py
│   ├── company_dao.py   # includes _normalizeCategories() helper
│   ├── job_application_dao.py
│   ├── idea_dao.py
│   └── tab_config_dao.py  # getAll(), getVisible(), bulkUpsert()
├── services/            # Business logic
│   ├── auth_service.py           # JWT token management
│   ├── google_oauth_service.py   # Google OAuth verification
│   ├── email_service.py          # SendGrid integration
│   ├── file_storage_service.py   # Local file storage
│   ├── s3_storage_service.py     # AWS S3 storage
│   └── storage_factory.py        # Storage provider selection
├── routes/              # API endpoints (blueprints)
│   ├── portfolio_routes.py   # /api/portfolio/*
│   ├── resume_routes.py      # /api/cv/*
│   ├── contact_routes.py     # /api/contact
│   ├── auth_routes.py        # /api/auth/*
│   ├── dashboard_routes.py   # /api/dashboard/* (stats + tab visibility)
│   ├── health_routes.py      # /api/health
│   ├── jobs_routes.py        # /api/jobs/* (companies + applications + AI categories)
│   └── ideas_routes.py       # /api/ideas/*
└── utils/
    ├── csrf_protection.py    # CSRF token handling
    └── tab_guard.py          # require_tab_visible() decorator
```

### Frontend Structure

```
frontend/src/
├── pages/               # Route components
│   ├── Home.tsx
│   ├── Portfolio.tsx    # Admin: add/edit/delete/reorder/visibility; tabs: Projects/Ideas
│   ├── CV.tsx           # Admin: PDF upload, version management
│   ├── Contact.tsx
│   ├── Jobs.tsx         # Admin-only: companies (category filter) + applications (status filter)
│   ├── Settings.tsx     # Admin-only: tab visibility control (Option C: preview sidebar)
│   └── GitHubStatsPage.tsx
├── components/
│   ├── Layout.tsx            # Sidebar nav; reads visibleTabs from TabConfigContext
│   ├── LoginModal.tsx        # Hidden trigger: click header 7x in 2 sec
│   ├── ProjectFormModal.tsx  # Add/edit project with image upload
│   ├── ImageUploadField.tsx  # Drag-and-drop image upload
│   ├── PdfViewer.tsx         # PDF display with pagination
│   ├── PdfUploadForm.tsx     # Drag-and-drop PDF upload
│   ├── PdfHistoryList.tsx    # Version history management
│   ├── CompanyFormModal.tsx  # Add/edit company with AI category tags
│   ├── ProtectedRoute.tsx    # JWT auth guard (redirects to login)
│   └── VisibleTabRoute.tsx   # Tab visibility guard (renders 404 if tab hidden)
├── contexts/
│   ├── AuthContext.tsx        # Auth state, auto token refresh
│   ├── TabConfigContext.tsx   # Shared visible-tabs state (single fetch, consumed by Layout + VisibleTabRoute)
│   └── TocContext.tsx         # Table of contents for sidebar
├── repositories/             # API client layer
│   ├── apiClient.ts          # Axios instance with interceptors
│   ├── portfolioRepository.ts
│   ├── resumeRepository.ts
│   ├── contactRepository.ts
│   ├── authRepository.ts
│   ├── csrfTokenRepository.ts
│   ├── jobsRepository.ts     # Companies + applications + suggestCategories()
│   └── settingsRepository.ts # getVisibleTabs() (public), getAdminTabConfigs(), updateTabConfigs()
├── terminal/                 # Interactive terminal view (/terminal)
│   ├── TerminalApp.tsx       # Main component
│   ├── commands/             # 19 commands (registry pattern)
│   ├── components/           # Terminal UI components
│   ├── hooks/                # State management hooks
│   ├── themes/               # 7 color themes
│   └── __tests__/            # Vitest tests (69+ cases)
└── types/index.ts
```

### Key Patterns

**DAO Pattern**: All database queries go through DAOs (e.g., `ProjectDAO.getAll()`, `ResumeDAO.getResume()`). Routes call DAOs directly, services handle complex business logic.

**Storage Factory**: `StorageFactory.getStorage()` returns either `FileStorageService` (local) or `S3StorageService` based on `STORAGE_TYPE` env var.

**JWT Auth Flow**: Google OAuth token → backend verifies → issues access + refresh tokens as HttpOnly cookies → frontend interceptor auto-refreshes on 401.

**Admin Access**: Email whitelist in `ADMIN_EMAILS` env var. Hidden login: click site header 7 times within 2 seconds.

**Tab Visibility Guard**: `require_tab_visible(tabKey)` decorator on public backend routes. Checks JWT optionally — admin always passes through; non-admin gets 404 if tab is hidden. Frontend mirrors this with `VisibleTabRoute` component backed by `TabConfigContext`.

**Company Categories**: AI-generated tags via Anthropic API (`claude-haiku-4-5-20251001`). Stored as JSON array on `companies.categories`. Triggered explicitly by "Suggest with AI" button in `CompanyFormModal`. Normalized + deduplicated by `_normalizeCategories()` in `company_dao.py`.

## API Endpoints

**Public (may return 404 if tab hidden):**
- `GET /api/health` - Health check
- `GET /api/portfolio` - List visible projects
- `GET /api/portfolio/:id` - Single project
- `GET /api/cv` - Get resume data
- `GET /api/cv/pdf` - Active PDF metadata
- `GET /api/cv/pdf/file` - Download/view active PDF
- `GET /api/contact/csrf-token` - CSRF token for contact form
- `POST /api/contact` - Submit contact form (rate limited: 5/min)
- `GET /api/github-stats` - GitHub contribution stats
- `GET /api/github-stats/status` - Whether GitHub stats feature is enabled (always public)
- `GET /api/dashboard/tabs` - List of visible tab keys (array, no hidden tabs disclosed)

**Admin (JWT required):**
- `POST/PUT/DELETE /api/portfolio/:id` - CRUD projects
- `PATCH /api/portfolio/:id/visibility` - Toggle visibility
- `PATCH /api/portfolio/reorder` - Update display order
- `POST /api/portfolio/upload-image` - Upload project image
- `PUT /api/cv` - Update resume data
- `POST /api/cv/pdf/upload` - Upload new PDF version
- `GET /api/cv/pdf/history` - List all PDF versions
- `PUT /api/cv/pdf/:id/activate` - Activate specific version
- `DELETE /api/cv/pdf/:id` - Soft delete version
- `GET /api/dashboard/stats` - Admin dashboard statistics
- `GET /api/dashboard/tabs/admin` - Full tab config including hidden tabs
- `PUT /api/dashboard/tabs` - Update tab visibility
- `GET /api/jobs/companies` - List companies
- `POST /api/jobs/companies` - Create company (accepts `categories`)
- `PUT /api/jobs/companies/:id` - Update company (accepts `categories`)
- `DELETE /api/jobs/companies/:id` - Delete company
- `POST /api/jobs/companies/suggest-categories` - AI tag suggestions (Anthropic, 20/hr limit)
- `GET /api/jobs/applications` - List applications (optional ?status= filter)
- `POST/PUT/DELETE /api/jobs/applications/:id` - CRUD applications
- `PATCH /api/jobs/applications/:id/status` - Quick status update

**Auth:**
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Clear tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Current user info

## Coding Conventions

**Python**: Use **camelCase** for variables and methods (overrides PEP 8)
**Database**: Use **snake_case** for tables and columns
**TypeScript**: Use **camelCase** (standard)

## Planning & Documentation

- **Feature plans**: `.claude/features/` directory
- **Roadmap**: `ROADMAP.md` at project root
- **Deployment**: `.claude/PRODUCTION_DEPLOYMENT.md`

## Environment Variables

**Backend key variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - Flask secret (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
- `CORS_ORIGINS` - Comma-separated allowed origins
- `ADMIN_EMAILS` - Comma-separated admin email whitelist
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `CONTACT_EMAIL` - Email config
- `STORAGE_TYPE` - `local` or `s3`
- `AWS_*` - S3 credentials (if using S3)
- `SENTRY_DSN` - Error tracking (production)
- `ANTHROPIC_API_KEY` - For AI company category suggestions
- `GITHUB_USERNAME` - For GitHub stats feature

**Frontend:**
- `VITE_API_URL` - Backend API URL (default: `http://localhost:5000/api`)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID

## Security Features

- Rate limiting via Flask-Limiter (200/day, 50/hour default; 5/min on contact)
- Security headers (XSS, HSTS, CSP, X-Frame-Options)
- CSRF protection for state-changing operations
- JWT tokens in HttpOnly cookies with secure flag in production
- Input validation and file upload restrictions
- Sentry error tracking in production
- Tab visibility enforced at both backend (404 for hidden tabs) and frontend (VisibleTabRoute)
- Public tab config endpoint returns only visible tab keys — hidden tabs not disclosed
