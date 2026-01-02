# Portfolio Website Development Roadmap

## Current Status (Updated: 2026-01-02)

### ✅ Completed
- Flask backend API structure
- React frontend with routing
- Basic UI/UX theme implemented (Wix-inspired design)
- Contact form UI (frontend only)
- **PostgreSQL database setup with Docker**
- **5 database models created (Project, User, Resume, About, ContactSubmission)**
- **Migration system configured with incremental IDs**
- **Initial migration created (001_initial_database_schema.py)**
- **Database seed script created (seed.py - untracked)**
- **Coding conventions established (camelCase Python, snake_case DB)**

### 🔴 Critical Gap
**API routes are still using hardcoded data instead of database!**
- `backend/app/routes.py` returns hardcoded arrays/objects
- Need to implement actual database CRUD operations

### 📍 Current Phase
**Phase 1.2: Backend API Implementation** (0% complete)
- Focus: Connect existing database models to API routes
- Priority: Replace hardcoded data with database queries

---

## Phase 1: Core Content & Database Setup

### 1.1 Database Setup ✅ **COMPLETE**
- [x] Choose database (PostgreSQL recommended for production, SQLite for dev)
  - ✅ PostgreSQL 16 via Docker
  - ✅ Database: `dev_db`, User: `admin_dev`
- [x] Set up database schema:
  - [x] Portfolio items (projects)
  - [x] CV/resume data
  - [x] Contact form submissions
  - [x] Admin users (for authentication)
  - [x] About me content
- [x] Install SQLAlchemy or similar ORM
  - ✅ Flask-SQLAlchemy installed
- [x] Create database models
  - ✅ `Project` - Portfolio projects with technologies, URLs, images
  - ✅ `User` - Admin users with password hashing
  - ✅ `Resume` - CV/resume with JSON storage for flexibility
  - ✅ `About` - About me content (single row table)
  - ✅ `ContactSubmission` - Contact form submissions with IP tracking
- [x] Set up database migrations (Alembic)
  - ✅ Flask-Migrate configured
  - ✅ Custom incremental revision IDs (001, 002, 003...)
  - ✅ Initial migration: `001_initial_database_schema.py`
- [x] Configure environment-specific database URLs
  - ✅ Using `.env` file with `DATABASE_URL`
  - ✅ Docker Compose for local PostgreSQL

### 1.2 Backend API Implementation 🎯 **NEXT PHASE - START HERE**

⚠️ **Current Issue:** Routes in `backend/app/routes.py` return hardcoded data. Need to implement database queries.

- [ ] **Portfolio/Projects API**
  - [ ] GET `/api/portfolio` - List all projects (replace hardcoded data with `Project.query.all()`)
  - [ ] POST `/api/portfolio` - Add new project (admin only - requires auth)
  - [ ] PUT `/api/portfolio/:id` - Update project (admin only - requires auth)
  - [ ] DELETE `/api/portfolio/:id` - Delete project (admin only - requires auth)

- [ ] **CV/Resume API**
  - [ ] GET `/api/cv` - Get CV data (replace hardcoded data with `Resume.query.first()`)
  - [ ] PUT `/api/cv` - Update CV data (admin only - requires auth)

- [ ] **Contact Form API**
  - [ ] POST `/api/contact` - Submit contact form (currently only logs, need to save to `ContactSubmission` table)
  - [ ] GET `/api/contact` - List all submissions (admin only - requires auth)
  - [ ] Implement email notifications (SendGrid, Mailgun, or SMTP)

### 1.3 Content Management ⏸️ **BLOCKED** (Requires 1.2 first)
- [ ] Run seed script to populate database (`python backend/seed.py`)
- [ ] Add real portfolio projects data (replace seed data)
- [ ] Add real CV/resume content (replace seed data)
- [ ] Upload and optimize project images
- [ ] Set up file/image storage (local or cloud: AWS S3, Cloudinary)

---

## Phase 2: Authentication & Admin Panel

### 2.1 Authentication System
- [ ] Choose auth method (JWT recommended)
- [ ] Implement user model (admin only for now)
- [ ] Create authentication endpoints:
  - POST `/api/auth/login` - Admin login
  - POST `/api/auth/logout` - Logout
  - GET `/api/auth/me` - Get current user
- [ ] Add password hashing (bcrypt)
- [ ] Implement JWT token generation and validation
- [ ] Add protected route middleware

### 2.2 Admin Panel (Frontend)
- [ ] Create admin login page
- [ ] Admin dashboard layout
- [ ] Portfolio management interface:
  - Add/edit/delete projects
  - Upload project images
- [ ] CV management interface
- [ ] Contact form inbox
- [ ] Protected admin routes

---

## Phase 3: Security & Spam Prevention

### 3.1 Anti-Spam Measures
- [ ] **Contact Form Protection**
  - Add reCAPTCHA v3 or hCaptcha
  - Implement rate limiting (Flask-Limiter)
  - Add honeypot fields
  - Email validation

### 3.2 Security Hardening
- [ ] Implement CORS properly for production
- [ ] Add request rate limiting
- [ ] Input validation and sanitization
- [ ] SQL injection prevention (via ORM)
- [ ] XSS protection
- [ ] CSRF tokens for forms
- [ ] Environment variables security (never commit secrets)
- [ ] HTTPS enforcement
- [ ] Security headers (helmet.js equivalent for Flask)

---

## Phase 4: Enhanced Design & Features

### 4.1 Design Improvements
- [ ] **Homepage**
  - Replace placeholder profile photo with real photo
  - Write compelling "About Me" section
  - Add smooth animations/transitions
  - Responsive design testing (mobile, tablet, desktop)

- [ ] **Portfolio Page**
  - Project cards with hover effects
  - Project detail modal or dedicated page
  - Filter by technology/category
  - Search functionality

- [ ] **CV/Resume Page**
  - Timeline design for experience
  - Skills visualization
  - PDF download option
  - Print-friendly styling

- [ ] **Contact Page**
  - Form validation with clear error messages
  - Success/error feedback
  - Loading states

### 4.2 Additional Features
- [ ] **Blog Section** (Optional)
  - Blog post model
  - Blog listing page
  - Individual blog post page
  - Markdown support
  - Admin blog editor

- [ ] **Analytics**
  - Google Analytics or privacy-friendly alternative (Plausible)
  - Track page views, popular projects

- [ ] **SEO Optimization**
  - Meta tags for all pages
  - Open Graph tags for social sharing
  - Sitemap.xml
  - robots.txt
  - Structured data (JSON-LD)

- [ ] **Performance**
  - Image optimization and lazy loading
  - Code splitting
  - Caching strategies
  - CDN for static assets

---

## Phase 5: Testing

### 5.1 Backend Testing
- [ ] Unit tests for API endpoints
- [ ] Integration tests
- [ ] Test database operations
- [ ] Test authentication flows

### 5.2 Frontend Testing
- [ ] Component tests (React Testing Library)
- [ ] E2E tests (Playwright or Cypress)
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing

### 5.3 Security Testing
- [ ] Penetration testing basics
- [ ] OWASP top 10 vulnerabilities check
- [ ] Test rate limiting
- [ ] Test authentication security

---

## Phase 6: Pre-Deployment

### 6.1 Production Configuration
- [ ] Set up production environment variables
- [ ] Configure production database
- [ ] Set up production-ready WSGI server (Gunicorn)
- [ ] Configure reverse proxy (Nginx) if using VPS
- [ ] Set up SSL certificates (Let's Encrypt)

### 6.2 Build Optimization
- [ ] Frontend production build
- [ ] Minify and compress assets
- [ ] Optimize images
- [ ] Remove development dependencies

### 6.3 Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] README with setup instructions
- [ ] Environment variables documentation
- [ ] Deployment guide

---

## Phase 7: Deployment

### 7.1 Choose Hosting Platform
**Option 1: Separate Hosting (Recommended)**
- Frontend: Vercel, Netlify, or Cloudflare Pages
- Backend: Render, Railway, Fly.io, or DigitalOcean

**Option 2: Single Platform**
- DigitalOcean App Platform
- AWS (EC2 + S3 + RDS)
- Google Cloud Platform
- Heroku (paid)

**Option 3: Self-Hosted VPS**
- DigitalOcean Droplet
- Linode
- Vultr

### 7.2 Deploy Backend
- [ ] Set up production database
- [ ] Deploy Flask API
- [ ] Configure environment variables
- [ ] Set up database migrations
- [ ] Test API endpoints

### 7.3 Deploy Frontend
- [ ] Update API URL to production
- [ ] Build and deploy frontend
- [ ] Configure custom domain (if applicable)
- [ ] Set up SSL certificate

### 7.4 Post-Deployment
- [ ] Test all features in production
- [ ] Monitor error logs
- [ ] Set up error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Create backup strategy for database

---

## Phase 8: Custom Domain (Optional)

- [ ] Purchase domain name
- [ ] Configure DNS records
- [ ] Set up SSL certificate
- [ ] Redirect www to non-www (or vice versa)
- [ ] Configure email forwarding

---

## Phase 9: Maintenance & Growth

### 9.1 Monitoring
- [ ] Set up logging (backend and frontend)
- [ ] Error tracking and alerting
- [ ] Performance monitoring
- [ ] Database backups automation

### 9.2 Continuous Improvement
- [ ] Gather user feedback
- [ ] A/B testing for key pages
- [ ] Regular content updates
- [ ] Keep dependencies updated
- [ ] Security patches

### 9.3 Future Enhancements
- [ ] Multi-language support (i18n)
- [ ] Dark mode toggle
- [ ] Interactive portfolio demos
- [ ] Testimonials section
- [ ] Newsletter signup
- [ ] Integration with GitHub to show recent activity
- [ ] Code playground/snippets showcase

---

## Quick Wins (Start Here!)

1. **Replace placeholders** (1-2 hours)
   - Add your real photo
   - Write your "About Me" section

2. **Set up database locally** (2-3 hours)
   - Install PostgreSQL
   - Create basic models
   - Populate with sample data

3. **Implement contact form backend** (2-3 hours)
   - Save submissions to database
   - Send email notifications

4. **Add 2-3 real projects** (2-4 hours)
   - Add to database
   - Test portfolio page

5. **Basic authentication** (4-6 hours)
   - Simple JWT auth
   - Protect admin endpoints

---

## Estimated Timeline

- **Phase 1-2**: 2-3 weeks (Database + Backend APIs + Auth)
- **Phase 3**: 1 week (Security)
- **Phase 4**: 2-3 weeks (Design enhancements + Features)
- **Phase 5**: 1-2 weeks (Testing)
- **Phase 6-7**: 1 week (Deployment)
- **Phase 8**: 1-2 days (Custom domain)

**Total: ~8-12 weeks** (working part-time)

---

## Priority Recommendations

### Must Have (MVP)
1. Database with real content
2. Working contact form with email
3. Real portfolio projects
4. Basic admin authentication
5. Production deployment

### Should Have
1. Anti-spam protection
2. SEO optimization
3. Analytics
4. Error monitoring
5. Database backups

### Nice to Have
1. Blog section
2. Advanced admin panel
3. Project filtering/search
4. Dark mode
5. Animations

---

## Next Steps (Updated: 2026-01-02)

### Immediate Priority - Phase 1.2: Backend API Implementation

**Step 1: Connect Database to API Routes**
1. ✅ ~~Set up PostgreSQL database~~ (DONE)
2. ✅ ~~Create database models~~ (DONE)
3. **🎯 START HERE:** Implement database queries in `backend/app/routes.py`:
   - Replace hardcoded portfolio data with `Project.query.all()`
   - Replace hardcoded CV data with `Resume.query.first()`
   - Save contact submissions to `ContactSubmission` table
4. Run seed script to populate database: `cd backend && python seed.py`
5. Test API endpoints return database data

**Step 2: Add CRUD Operations** (Can be done in parallel or after authentication)
- Implement POST/PUT/DELETE for projects
- Implement PUT for CV
- Implement GET for contact submissions
- Add email notifications for contact form

**Step 3: Authentication** (Phase 2.1 - Optional for now, needed for admin endpoints)
- JWT authentication system
- Protect admin-only routes

**Alternative Quick Path (Skip auth for now):**
- Focus on read-only endpoints first (GET routes)
- Use seed data for content
- Implement admin features (POST/PUT/DELETE) later with authentication

**Start with connecting the database to existing GET routes - immediate progress!**
