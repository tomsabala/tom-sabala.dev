# Portfolio Website Development Roadmap

## Current Status (Updated: 2026-01-08)

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
- **✅ Phase 1.2: Backend API Implementation - COMPLETE**
  - All routes use database queries (no hardcoded data!)
  - DAO pattern implemented (ProjectDAO, ResumeDAO, UserDAO)
  - Service layer created (AuthService, EmailService, GoogleOAuthService)
  - Routes organized by domain (portfolio_routes, resume_routes, contact_routes, auth_routes)
- **✅ Phase 2.1: Authentication System - COMPLETE**
  - Google OAuth integration
  - JWT token management with cookies
  - Protected admin routes with @jwt_required()
  - Email whitelist for access control
- **✅ Phase 2.2: Admin Panel - Resume & Portfolio Management COMPLETE**
  - Frontend AuthContext and LoginModal implemented
  - Hidden login trigger (click header 7 times)
  - ✅ **Resume PDF Management System** (Complete)
    - PDF upload with drag-and-drop interface
    - Version history with soft delete
    - Activate/deactivate functionality (creates new history entries)
    - Two-tab admin interface (Web View + Admin Panel)
    - Download functionality with forced download in all browsers
    - Minimum 2-second loading time for better UX
    - Three-dots dropdown menu for version actions
  - ✅ **Portfolio Project Management System** (Complete)
    - Add/Edit/Delete projects with modal forms
    - Hide/Display toggle for visibility control
    - Drag-and-drop reordering with @dnd-kit
    - Image upload with drag-and-drop (jpg, png, webp, gif, max 5MB)
    - Image preview and serving
    - Three-dots dropdown menu for actions
    - Hidden badge for invisible projects
    - Success/error toast messages
    - Separate admin and public views

### 📍 Current Phase
**Phase 2.2: Admin Panel (Frontend)** (~85% complete)
- ✅ Resume PDF Management: Complete
- ✅ Portfolio Management: Complete
- 🎯 Next Focus: Content population and contact form inbox
- Priority: Run seed script and add real project data

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

### 1.2 Backend API Implementation ✅ **COMPLETE**

✅ **All routes now use database queries via DAO pattern!**

- [x] **Portfolio/Projects API**
  - [x] GET `/api/portfolio` - List all projects (with optional `?includeHidden=true` for admin)
  - [x] POST `/api/portfolio` - Add new project (admin only - JWT protected)
  - [x] PUT `/api/portfolio/:id` - Update project (admin only - JWT protected)
  - [x] DELETE `/api/portfolio/:id` - Delete project (admin only - JWT protected)
  - [x] PATCH `/api/portfolio/:id/visibility` - Toggle project visibility (admin only)
  - [x] PATCH `/api/portfolio/reorder` - Update display order for multiple projects (admin only)
  - [x] POST `/api/portfolio/upload-image` - Upload project image (admin only)
  - [x] GET `/api/portfolio/images/:filename` - Serve project images (public)

- [x] **CV/Resume API**
  - [x] GET `/api/cv` - Get CV data (using `ResumeDAO.getResume()`)
  - [x] PUT `/api/cv` - Update CV data (admin only - JWT protected)

- [x] **Contact Form API**
  - [x] POST `/api/contact` - Submit contact form (sends email via SendGrid)
  - [ ] GET `/api/contact` - List all submissions (admin only - not yet implemented)
  - [x] Email notifications (SendGrid integration complete)

### 1.3 Content Management 🎯 **READY TO START**
- [ ] Run seed script to populate database (`python backend/seed.py`)
- [ ] Add real portfolio projects data (replace seed data)
- [ ] Add real CV/resume content (replace seed data)
- [ ] Upload and optimize project images
- [ ] Set up file/image storage (local or cloud: AWS S3, Cloudinary)

---

## Phase 2: Authentication & Admin Panel

### 2.1 Authentication System ✅ **COMPLETE**
- [x] Choose auth method (Google OAuth + JWT)
- [x] Implement user model (Google OAuth integration)
- [x] Create authentication endpoints:
  - [x] POST `/api/auth/google` - Google OAuth login
  - [x] POST `/api/auth/logout` - Logout
  - [x] GET `/api/auth/me` - Get current user
  - [x] POST `/api/auth/refresh` - Refresh access token
  - [x] GET `/api/auth/check` - Check authentication status
- [x] JWT token generation and validation (with cookies)
- [x] Protected route middleware (`@jwt_required()`)
- [x] Email whitelist for access control

### 2.2 Admin Panel (Frontend) 🟡 **85% COMPLETE - IN PROGRESS**
- [x] Create admin login modal (hidden trigger: click header 7x)
- [x] Frontend AuthContext for state management
- [x] Admin controls visible on Portfolio page
- [ ] Admin dashboard layout
- [x] **Portfolio Management Interface** ✅ **COMPLETE**
  - [x] Add project modal with form validation
  - [x] Edit project modal with pre-filled data
  - [x] Delete project with confirmation (hard delete)
  - [x] Hide/Display toggle (visibility management)
  - [x] Drag-and-drop reordering with @dnd-kit
  - [x] Image upload with drag-and-drop (jpg, png, webp, gif, max 5MB)
  - [x] Image preview and serving
  - [x] Three-dots dropdown menu for actions
  - [x] Hidden badge for invisible projects
  - [x] Success/error toast messages
  - [x] Separate admin and public views
  - [x] Database models (isVisible, displayOrder fields)
  - [x] Backend DAO and routes
  - [x] File storage service for project images
- [x] **CV/Resume PDF Management** ✅ **COMPLETE**
  - [x] PDF upload with drag-and-drop
  - [x] Version history list with metadata
  - [x] Activate/deactivate versions (soft delete with new history entries)
  - [x] Two-tab interface (Web View + Admin Panel)
  - [x] PDF viewer with pagination
  - [x] Download functionality (forced download in all browsers)
  - [x] Minimum 2-second loading time
  - [x] Three-dots dropdown menu for actions
  - [x] Database models (ResumePdfVersion)
  - [x] Backend DAO and routes
  - [x] File storage service
- [ ] Contact form inbox
- [x] Protected admin routes (frontend context-based)

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

- [ ] **Mobile Responsive Design** 🚨 **HIGH PRIORITY**
  - [ ] **Homepage (Mobile)**
    - Fix header/navigation layout for small screens
    - Adjust hero section text sizing and spacing
    - Ensure profile photo scales properly
    - Stack sections vertically on mobile
    - Touch-friendly button sizes (min 44x44px)

  - [ ] **Portfolio Page (Mobile)**
    - Project cards should stack in single column
    - Admin controls (three-dots menu) should be touch-friendly
    - Drag-and-drop should work with touch gestures
    - Modal forms should be scrollable and fit screen
    - Image previews should scale appropriately

  - [ ] **CV/Resume Page (Mobile)**
    - PDF viewer should be scrollable and zoomable
    - Admin panel tabs should be accessible
    - Upload button should be touch-friendly
    - Version history list should scroll properly
    - Download button should be easily tappable

  - [ ] **Contact Page (Mobile)**
    - Form fields should be properly sized for mobile
    - Keyboard should not overlap input fields
    - Submit button should be easily tappable
    - Success/error messages should be visible

  - [ ] **Navigation (Mobile)**
    - Add hamburger menu for mobile
    - Ensure all navigation links are accessible
    - Login modal should fit mobile screens

  - [ ] **Testing**
    - Test on iPhone (Safari)
    - Test on Android (Chrome)
    - Test on tablets (iPad, Android tablets)
    - Test different screen sizes (320px - 1024px)
    - Test landscape and portrait orientations

- [ ] **Homepage (Desktop)**
  - Replace placeholder profile photo with real photo
  - Write compelling "About Me" section
  - Add smooth animations/transitions

- [ ] **Portfolio Page**
  - Project cards with hover effects
  - Project detail modal or dedicated page
  - Filter by technology/category
  - Search functionality

- [x] **CV/Resume Page** ✅ **PDF Features Complete**
  - [x] PDF upload and management system
  - [x] Version history with activate/deactivate
  - [x] PDF viewer with pagination controls
  - [x] Download functionality
  - [ ] Timeline design for JSON resume data (future)
  - [ ] Skills visualization (future)
  - [ ] Print-friendly styling (future)

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

## Quick Wins

### ✅ Completed Quick Wins
1. ✅ **Database setup** - PostgreSQL with Docker
2. ✅ **Contact form backend** - Saves to DB + sends email via SendGrid
3. ✅ **Authentication** - Google OAuth + JWT (better than originally planned!)
4. ✅ **Resume PDF Management** - Complete upload/version/download system
5. ✅ **Portfolio Management** - Full CRUD with drag-and-drop, image upload, visibility toggle

### 🎯 Next Quick Wins (Do These!)

1. **Run seed script** (~5 minutes)
   - `cd backend && python seed.py`
   - Populate database with sample projects

2. **Add real content through admin UI** (1-2 hours)
   - Login with Google OAuth
   - Add real projects with images
   - Upload your actual resume PDF
   - Test drag-and-drop reordering

3. **Replace placeholders** (1-2 hours)
   - Add your real photo
   - Write your "About Me" section
   - Update project descriptions

4. **Test end-to-end workflow** (30 minutes)
   - Test portfolio: Add/Edit/Delete/Hide/Reorder
   - Test resume: Upload/Activate/Download
   - Test contact form submission
   - Verify all changes persist in database

---

## Progress & Timeline

**Overall Progress: ~55% Complete** 🎉

- ✅ **Phase 1.1-1.2**: Database + Backend APIs (COMPLETE)
- ✅ **Phase 2.1**: Authentication (COMPLETE)
- 🟡 **Phase 2.2**: Admin Panel Frontend (85% complete - IN PROGRESS)
  - ✅ Resume PDF Management (COMPLETE)
  - ✅ Portfolio Management (COMPLETE)
  - ⏳ Contact Form Inbox (Next priority)
- ⏳ **Phase 1.3**: Content Management (Ready to start - NEXT)
- ⏳ **Phase 3**: Security (Not started)
- 🟡 **Phase 4**: Design enhancements + Features (Partially started - Resume & Portfolio features)
- ⏳ **Phase 5**: Testing (Not started)
- ⏳ **Phase 6-7**: Deployment (Not started)

**Remaining Timeline Estimate:**
- **Phase 2.2 completion**: ~1 week (Contact inbox)
- **Phase 1.3**: ~1 week (Content + Images)
- **Phase 3**: 1 week (Security)
- **Phase 4**: 2-3 weeks (Design enhancements + Features)
- **Phase 5**: 1-2 weeks (Testing)
- **Phase 6-7**: 1 week (Deployment)

**Estimated Time to MVP: ~3-4 weeks** (working part-time)

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

## Next Steps (Updated: 2026-01-08)

### Immediate Priority - Phase 1.3 & 2.2: Content & Contact Inbox

**✅ Completed:**
1. ✅ Backend API with database integration (Phase 1.2)
2. ✅ Google OAuth + JWT authentication (Phase 2.1)
3. ✅ Admin login modal and AuthContext
4. ✅ **Resume PDF Management System** (Complete - Jan 2026)
   - PDF upload, version history, activate/deactivate
   - Two-tab admin interface, download functionality
   - Backend: ResumePdfVersion model, DAO, routes, file storage
   - Frontend: Upload form, history list, PDF viewer, three-dots menu
5. ✅ **Portfolio Management System** (Complete - Jan 2026)
   - Add/Edit/Delete projects with modal forms
   - Hide/Display toggle for visibility control
   - Drag-and-drop reordering with @dnd-kit
   - Image upload with drag-and-drop support
   - Three-dots dropdown menu with actions
   - Backend: isVisible/displayOrder fields, image storage, visibility/reorder endpoints
   - Frontend: ProjectFormModal, ImageUploadField, ProjectCard with admin controls

**🎯 Current Focus: Content Population & Contact Management**

**Step 1: Content Population** (Highest Priority)
1. Run seed script: `cd backend && python seed.py`
2. Test that portfolio items display correctly
3. Add real project data through admin interface
4. Upload real project images
5. Update "About Me" content
6. Replace placeholder profile photo

**Step 2: Contact Management** (Secondary Priority)
1. Create contact submissions inbox page (admin only)
2. Implement GET `/api/contact` endpoint for submissions list
3. Add filtering and search for contact submissions
4. Mark as read/unread functionality

**Step 3: Security Hardening** (Phase 3)
- Add rate limiting to contact form
- Implement reCAPTCHA or hCaptcha
- Add honeypot fields for spam prevention

**Quick Win:** With portfolio management complete, focus on populating the site with real content to make it production-ready!
