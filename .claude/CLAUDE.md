# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website with a Flask backend API and React frontend showcasing projects, CV, and contact information.

**Tech Stack:**
- Backend: Python 3 + Flask + Flask-CORS
- Frontend: React 18 + TypeScript + Vite + React Router + Tailwind CSS + Axios

## Development Commands

### Backend (Flask API)

From the `backend/` directory:

```bash
# Setup (first time)
python3 -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env

# Start PostgreSQL database
docker-compose up -d

# Run development server (port 5000)
python run.py

# Or from project root
cd backend && docker-compose up -d && source venv/bin/activate && python run.py
```

### Frontend (React + Vite)

From the `frontend/` directory:

```bash
# Setup (first time)
npm install
cp .env.example .env

# Development server (port 5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

### Running Both Servers

Typically requires two terminal sessions - backend on port 5000, frontend on port 5173.

## Architecture

### Backend Structure (`backend/`)

- **`run.py`** - Entry point that creates and runs the Flask app
- **`app/__init__.py`** - Flask app factory with CORS configuration and blueprint registration
- **`app/routes.py`** - API blueprint with all endpoints (`/api/*`)
- **Configuration** - Uses `python-dotenv` to load environment variables from `.env`

**API Endpoints:**
- `GET /api/health` - Health check
- `GET /api/portfolio` - Returns portfolio items (currently hardcoded in routes.py)
- `GET /api/cv` - Returns CV/resume data (currently hardcoded in routes.py)
- `POST /api/contact` - Contact form submission (currently just logs to console)

**Environment Variables:**
- `SECRET_KEY` - Flask secret key (defaults to 'dev-secret-key-change-in-production')
- `CORS_ORIGINS` - Comma-separated list of allowed origins (defaults to 'http://localhost:5173')
- `PORT` - Server port (defaults to 5000)

### Frontend Structure (`frontend/src/`)

- **`main.tsx`** - Application entry point
- **`App.tsx`** - Router configuration with routes for Home, Portfolio, CV, Contact
- **`components/Layout.tsx`** - Shared layout component (wraps all pages)
- **`pages/`** - Page components (Home, Portfolio, CV, Contact)
- **`types/index.ts`** - TypeScript type definitions
- **`utils/api.ts`** - Axios API client with methods for all backend endpoints

**API Client:**
- Base URL configured via `VITE_API_URL` environment variable (defaults to 'http://localhost:5000/api')
- Centralized API methods: `healthCheck()`, `getPortfolio()`, `getCV()`, `submitContact()`

**Routing:**
- `/` - Home page
- `/portfolio` - Portfolio/projects page
- `/cv` - CV/resume page
- `/contact` - Contact form page

### Data Flow

1. Frontend pages call methods from `utils/api.ts`
2. Axios sends HTTP requests to Flask backend at `/api/*` endpoints
3. Flask routes return JSON responses
4. Frontend displays data using React components

**Current Limitation:** Portfolio items and CV data are hardcoded in `backend/app/routes.py`. Contact form submissions are only logged to console. Future implementation will require database integration and email service.

## Planning & Documentation

- **Feature Plans**: Detailed implementation plans for features are saved in `.claude/features/` directory
- **Roadmap**: High-level project roadmap is in `ROADMAP.md` at project root
- When planning new features or phases, create detailed markdown files in `.claude/features/` for reference

## Coding Conventions

### Naming Style
- **Python variables and methods**: Use **camelCase** style (e.g., `myProject`, `getUserData()`)
  - ⚠️ This overrides Python's PEP 8 convention (which recommends snake_case)
- **Database tables and columns**: Use **snake_case** style (e.g., `created_at`, `user_id`)
  - This follows SQL/PostgreSQL conventions
- **JavaScript/TypeScript**: Use **camelCase** style (standard for JS/TS)

### Code Style
- Use meaningful variable and function names
- Add comments for complex logic
- Follow existing code patterns in the project

## Important Notes

- The backend uses Flask's application factory pattern (`create_app()`)
- CORS is configured to allow frontend development server by default
- All API responses follow the pattern: `{ success: boolean, data/error: any, message?: string }`
- Frontend uses Tailwind CSS for styling (v4.1.18)
- TypeScript strict mode is enabled
