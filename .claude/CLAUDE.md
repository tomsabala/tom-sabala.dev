# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio website with Flask backend API and React frontend. The public site is a single long landing page over a live interactive algorithm field (`/`), with per-project detail pages at `/work/:slug`. Everything editable lives behind one admin console at `/admin`: portfolio/work content, resume PDF versions, the contact inbox, job tracking (companies + applications with AI-generated category tags), the on-demand job-search agent that sweeps every tracked company's job board, live apps-hangar instance status, and tab visibility.

**Tech Stack:**
- Backend: Python 3 + Flask + SQLAlchemy + PostgreSQL + Redis/RQ + SendGrid + Anthropic API
- Frontend: React 19 + TypeScript + Vite 7 + React Router + Tailwind CSS v4
- Auth: Google OAuth + JWT with HttpOnly cookies
- Storage: Local filesystem or AWS S3 (configurable via factory pattern)
- Deployment: Vercel (frontend) + Railway (backend web service + agent worker service) + one VPS (apps gateway)

## Development Commands

### Backend (from `backend/` directory)

```bash
# Setup
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Start PostgreSQL + Redis, then the API
docker compose up -d
python run.py

# Agent worker (separate shell; consumes the RQ 'agent' queue)
SERVICE_ROLE=worker python worker.py

# Database migrations
flask db upgrade              # Apply migrations
flask db migrate -m "msg"     # Create new migration
flask db downgrade            # Rollback one migration

# Seed the five designed work projects (idempotent, upsert by slug)
python scripts/seed_work_content.py
```

### Frontend (from `frontend/` directory)

```bash
npm install && cp .env.example .env
npm run dev      # Development server (port 5173)
npm run build    # Production build
npm run lint     # ESLint
npm test         # Vitest
```

## Architecture

### Backend Structure

```
backend/app/
├── __init__.py          # App factory, CORS, security middleware, blueprints
├── models/              # SQLAlchemy models
│   ├── project.py       # Portfolio projects (isVisible, displayOrder) + the work
│   │                    #   detail content: slug, field, lede, facts, aboutParagraphs,
│   │                    #   steps, rulesTitle, rules, runCode, specimen, accessLabel
│   ├── user.py          # Admin users (Google OAuth)
│   ├── resume.py        # CV data (JSON storage)
│   ├── resume_pdf.py    # PDF versions (soft delete, activation history)
│   ├── contact.py       # Contact submissions
│   ├── about.py         # About content
│   ├── company.py       # Job tracker companies (name, url, notes, categories JSON)
│   ├── job_application.py  # Job applications (8 statuses)
│   ├── idea.py          # Ideas list
│   ├── tab_config.py    # Nav tab visibility config (tab_key, is_visible)
│   ├── job_posting.py   # Board postings; firstSeenAt/closedAt drive New/Seen
│   ├── agent_run.py     # Agent sweeps (RUN_STATUSES, activeLock single-run guard)
│   ├── agent_run_company_result.py  # Per-company outcome of a sweep
│   ├── agent_run_finding.py         # Surfaced posting + score/verdict/isNew
│   └── job_search_profile.py        # Singleton (id=1) interests + minScore
├── dao/                 # Data Access Objects (all DB queries)
│   ├── project_dao.py
│   ├── user_dao.py
│   ├── resume_dao.py
│   ├── resume_pdf_dao.py
│   ├── contact_submission_dao.py
│   ├── company_dao.py   # includes _normalizeCategories() helper
│   ├── job_application_dao.py
│   ├── idea_dao.py
│   ├── tab_config_dao.py  # getAll(), getVisible(), bulkUpsert()
│   ├── job_posting_dao.py      # upsert(), closeMissing(), setScore(), dismiss()
│   │                           #   closeMissing spans all sources per company
│   ├── agent_run_dao.py        # create/markRunning/bumpCounters/finish/findStale
│   └── job_search_profile_dao.py  # get(), save()
├── services/            # Business logic
│   ├── auth_service.py           # JWT token management
│   ├── google_oauth_service.py   # Google OAuth verification
│   ├── email_service.py          # SendGrid integration
│   ├── file_storage_service.py   # Local file storage
│   ├── s3_storage_service.py     # AWS S3 storage
│   ├── storage_factory.py        # Storage provider selection
│   ├── board_discovery_service.py # Regex detection, then a bounded tool-use loop
│   ├── ats/                       # Board APIs: greenhouse, lever, ashby,
│   │                              #   workable, smartrecruiters (+ registry);
│   │                              #   each exposes fetchPostings() + boardUrl()
│   └── agent/                     # net.py (egress allow-list), html_text.py,
│                                  #   posting_sync.py, posting_matcher.py,
│                                  #   ranking_service.py, sweep_service.py
├── routes/              # API endpoints (blueprints)
│   ├── portfolio_routes.py   # /api/portfolio/*
│   ├── resume_routes.py      # /api/cv/*
│   ├── contact_routes.py     # /api/contact
│   ├── auth_routes.py        # /api/auth/*
│   ├── dashboard_routes.py   # /api/dashboard/* (stats + tab visibility)
│   ├── health_routes.py      # /api/health
│   ├── jobs_routes.py        # /api/jobs/* (companies + applications + AI categories)
│   ├── ideas_routes.py       # /api/ideas/*
│   ├── agent_routes.py       # /api/jobs/agent/* (runs, findings, postings)
│   ├── about_routes.py       # /api/about/*
│   ├── docs_routes.py        # /api/docs/*
│   ├── github_stats_routes.py # /api/github-stats*
│   └── hangar_routes.py      # /api/hangar/instances (server-to-server broker proxy)
└── utils/
    ├── csrf_protection.py    # CSRF token handling
    ├── slugify.py            # slugify()/uniqueSlug(), shared by migration 015 + ProjectDAO
    └── tab_guard.py          # require_tab_visible() decorator

backend/queue.py           # app/queue.py: Redis connection + RQ queue helpers
backend/worker.py          # RQ worker entry point (SERVICE_ROLE=worker)
backend/start.sh           # One image, two roles; only web runs `flask db upgrade`
backend/scripts/seed_work_content.py  # Idempotent upsert-by-slug seeder for the five
                           #   work projects (mlmp, cgeo, nomic, nudge, chess)
```

### Frontend Structure

```
frontend/src/
├── App.tsx              # Routes + legacy redirects
├── pages/
│   ├── Landing.tsx      # The public site: header + field + work/hangar/about/contact
│   ├── WorkDetail.tsx   # /work/:slug — hero, specimen, facts, steps, rules, deep dive
│   ├── Admin.tsx        # /admin shell: rail (off-canvas below lg) + AdminScreenRoute
│   ├── admin/           # Screens: AdminOverview, AdminPipeline, AdminContent,
│   │                    #   AdminInbox, AdminHangar, AdminVisibility
│   │                    #   + chrome.tsx (ADMIN_SCREENS/ADMIN_NAV), ui.tsx, applicationStatus.ts
│   └── jobsSearch.ts    # Shared company/application filtering for the pipeline screen
├── field/               # The live algorithm field behind the landing page
│   ├── FieldCanvas.tsx  # One fixed canvas + the single rAF loop (z-index 0)
│   ├── FieldDock.tsx    # Algorithm tabs, tools, sliders, toggles (bottom sheet on phones)
│   ├── LearnModal.tsx   # Pseudocode + "Used in: …" link into /work/<slug>
│   ├── useField.ts      # {algo, cfg, tool, paused, learnOpen, dockOpen}
│   ├── algorithms/      # planner (RRT*), voronoi, lidar, arm (FABRIK)
│   ├── config.ts        # ALGOS, NAMES, CFG0, SETTINGS, TOGGLES, TOOLS, LEARN, HINTS
│   └── draw.ts          # grid/cross/A(), the light/dark PAL table
├── work/
│   ├── specimens.ts          # Static glyph painters (chain|hull|equity|graph|board)
│   ├── specimens-animated.ts # Animated hero specimens (per-instance caches)
│   ├── AnimatedSpecimen.tsx  # rAF loop, stops off-screen / under reduced motion
│   └── DeepDive.tsx          # Markdown renderer + local TOC (sticky at xl, <details> below)
├── about/
│   ├── skills.ts        # SKILLS — also the source for the terminal's skills/*.txt
│   └── radar.ts         # Radar polygon + label geometry (fixed 400×300 viewBox)
├── components/
│   ├── site/                 # Public chrome: SiteHeader (hidden login), SiteFooter,
│   │                         #   Panel, SectionHeading, SpecGrid, SpecimenCanvas
│   │                         #   sections/: Work, Hangar, About, Contact
│   ├── formStyles.ts         # Shared dialog chrome (DIALOG_TITLE, LABEL, FIELD, …)
│   ├── LoginModal.tsx        # Hidden trigger: click the TS mark 7x in 2 sec
│   ├── ProjectFormModal.tsx  # Add/edit project with image upload
│   ├── AboutFormModal.tsx    # Edit about content + portrait
│   ├── ImageUploadField.tsx / ProfilePhotoUploadField.tsx
│   ├── PdfViewer.tsx / PdfUploadForm.tsx / PdfHistoryList.tsx
│   ├── CompanyFormModal.tsx / JobApplicationFormModal.tsx
│   ├── AgentRunModal.tsx     # Interests + min score; saved as the next default
│   ├── AgentFindingsList.tsx # Findings grouped by company, New/Seen badges
│   ├── AgentRunsHistory.tsx  # Last 20 runs, expands to per-company results
│   ├── GitHubStats.tsx       # Contribution stats, rendered inside the About section
│   ├── ProtectedRoute.tsx    # JWT auth guard (redirects to login)
│   └── VisibleTabRoute.tsx   # Tab visibility guard (renders 404 if tab hidden)
├── contexts/
│   ├── AuthContext.tsx        # Auth state, auto token refresh
│   ├── ThemeContext.tsx       # data-theme on <html>, persisted as localStorage['ts-theme']
│   └── TabConfigContext.tsx   # Shared visible-tabs state (useTabConfig/useIsTabVisible)
├── repositories/             # API client layer
│   ├── apiClient.ts          # Axios instance with interceptors
│   ├── apiError.ts           # apiErrorMessage() — one wording for every failure path
│   ├── portfolioRepository.ts / resumeRepository.ts / aboutRepository.ts
│   ├── contactRepository.ts / csrfTokenRepository.ts / githubRepository.ts
│   ├── authRepository.ts / authEvents.ts / healthRepository.ts
│   ├── dashboardRepository.ts # Admin stats
│   ├── jobsRepository.ts     # Companies + applications + suggestCategories()
│   ├── agentRepository.ts    # Agent profile, runs, findings, dismiss/bookmark
│   ├── hangarRepository.ts   # getInstances() via the backend broker proxy
│   └── settingsRepository.ts # getVisibleTabs() (public), getAdminTabConfigs(), updateTabConfigs()
├── terminal/                 # Interactive terminal view (/terminal)
│   ├── TerminalApp.tsx       # Main component; feeds live projects via populateProjects()
│   ├── commands/             # 18 commands (registry pattern), incl. projects, apps, field
│   ├── components/           # Terminal UI + LidarPane (hidden below 900px)
│   ├── hooks/                # State management hooks
│   ├── themes/               # 8 color themes; `field` is the default, `paper` the light one
│   └── __tests__/            # Vitest tests
├── apps/                     # Apps launcher (apps.tom-sabala.dev)
│   ├── apps.json             # Single manifest: bundle + service apps (broker reads this too)
│   ├── registry.ts           # parseManifest/HOSTED_APPS + slug/hash/entry-URL helpers
│   ├── AppsLauncher.tsx      # Hash routing: index or frame; the ?signin=1 hop
│   ├── AppsIndex.tsx         # Unit list + inspector + RequestPathDiagram
│   ├── AppFrame.tsx          # Framed unit + boot overlay (FRAME_SANDBOX)
│   ├── units.ts              # specRows() — six honest rows, +STATE, +3 for an admin session
│   ├── signin.ts             # ?signin=1 → /oauth2/start, pending slug in sessionStorage
│   ├── useBootPhases.ts      # Polls the broker's GET /boot/<slug>
│   ├── useInstanceKind.ts    # One read of GET /boot/<slug>'s `kind` (anon|admin|shared)
│   ├── useBrokerInstances.ts # Admin-only live instance table
│   └── __tests__/            # Vitest tests
└── types/index.ts
```

### Routes

| Path | Component | Guard |
|---|---|---|
| `/` | `Landing` | — (each section is hidden individually by its tab key) |
| `/work/:slug` | `WorkDetail` | `VisibleTabRoute tabKey="work"` |
| `/admin`, `/admin/:screen` | `Admin` + `AdminScreenRoute` | `ProtectedRoute` |

Admin screens: `overview`, `pipeline`, `content`, `inbox`, `hangar`, `visibility`. `/admin`
and any unrecognised `:screen` resolve to `overview`.

Pre-redesign URLs stay resolvable: `/portfolio → /#work`, `/portfolio/:id → /work/<slug>`
(resolved against the project list; an id that no longer exists lands on `/#work`),
`/cv → /#about`, `/contact → /#contact`, `/github-stats → /#about`,
`/jobs → /admin/pipeline`, `/settings → /admin/visibility`. Anything else redirects to `/`.
`/terminal` and `/apps.html` are separate Vite entry points, not React-Router routes.

### Key Patterns

**DAO Pattern**: All database queries go through DAOs (e.g., `ProjectDAO.getAll()`, `ResumeDAO.getResume()`). Routes call DAOs directly, services handle complex business logic.

**Storage Factory**: `StorageFactory.getStorage()` returns either `FileStorageService` (local) or `S3StorageService` based on `STORAGE_TYPE` env var.

**JWT Auth Flow**: Google OAuth token → backend verifies → issues access + refresh tokens as HttpOnly cookies → frontend interceptor auto-refreshes on 401.

**Admin Access**: Email whitelist in `GOOGLE_OAUTH_WHITELIST` env var. Hidden login: click the `TS` mark in `SiteHeader` 7 times within 2 seconds (same gesture on the apps launcher). Once a session exists the gesture is not the way back in — `SiteHeader` renders an `admin` chip linking to `/admin`, and the 7 clicks navigate there too. `components/Modal.tsx` portals every dialog into `<body>`: the header's `backdrop-filter` is a containing block for `position: fixed`, so a dialog rendered inside it centres on the 59px header strip instead of the viewport.

**Tab Visibility Guard**: `require_tab_visible(tabKey)` decorator on public backend routes. Checks JWT optionally — admin always passes through; non-admin gets 404 if tab is hidden. Frontend mirrors this with `VisibleTabRoute` (for `/work/:slug`) and `useIsTabVisible` (Landing simply does not render a hidden section), both backed by `TabConfigContext`. `TAB_KEYS = ['home', 'work', 'hangar', 'about', 'contact', 'terminal', 'github']` in `tab_config_dao.py`; `home` can never be hidden. Guards: `work` on `/portfolio*` and `/ideas`, `about` on `/cv`, `/cv/pdf` and `/about`, `contact` on the contact form, `github` on the stats. Binary endpoints (`/cv/pdf/file`, `/portfolio/images/<fn>`, `/about/profile-photo/<fn>`) stay unguarded on purpose.

**Design System**: `frontend/src/index.css` holds the raw token set (`--bg`, `--s1`, `--ln`, `--ln2`, `--ink`, `--ink2`, `--mut`, `--acc`, `--acct`, `--onacc`) plus an `@theme inline` bridge that exposes them to Tailwind v4 as `bg-bg`, `text-ink`, `border-ln2`, `font-display`, `font-mono`, … Dark mode is `data-theme="dark"` on `<html>` — set by `ThemeContext`, persisted under `localStorage['ts-theme']`, matched by `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`. The old `.dark` class and `localStorage['theme']` key are gone. Fonts are **Archivo** (display/UI, variable width) and **DM Mono** (every label, number, nav item and spec value). House style: zero border-radius anywhere, 1px borders, essentially no shadows. `components/formStyles.ts` is the shared dialog chrome — admin forms compose `DIALOG_TITLE`/`LABEL`/`FIELD` instead of restyling inputs per modal (16px inputs so iOS does not zoom).

**The Field**: one fixed `<canvas>` behind the whole landing page with a single rAF loop (`field/FieldCanvas.tsx`), running one of four algorithms — RRT* planner, Voronoi/Delaunay, LiDAR raycast, FABRIK arm. `useField` holds `{algo, cfg, tool, paused, learnOpen, dockOpen}`; changing a `regen` setting drops the sim state so the next frame re-inits. The dock starts collapsed on every viewport. Palette is read from `data-theme`. Page content sits above it at `z-index:1`, and a click reaches the field unless it lands on a control or a `data-panel="1"` surface (section cards, header, footer, dock, dialogs) — a deny-list, so the margins either side of the content column, the body and every gap are live. `draw.ts`'s `PAL`/`A()` are shared by the field, the static work glyphs (`work/specimens.ts`) and the animated detail-page specimens (`work/specimens-animated.ts`).

**Work Content in the DB**: a project's detail page is data, not code. Migration `015` adds eleven nullable columns to `projects` (`slug`, `field`, `lede`, `facts`, `about_paragraphs`, `steps`, `rules_title`, `rules`, `run_code`, `specimen`, `access_label`), backfills slugs and adds `uq_projects_slug`; the same migration remaps `tab_configs` (`portfolio → work`, `apps → hangar`, drops `cv`). `app/utils/slugify.py` is the single slug implementation, shared by that backfill and `ProjectDAO`, so a runtime slug is byte-identical to a migrated one. `backend/scripts/seed_work_content.py` is an idempotent upsert-by-slug seeder for the five designed projects; every field is optional at render time, so projects it does not know about degrade to hero + whatever they have.

**Admin Console**: one shell (`pages/Admin.tsx`) with a 232px rail that becomes an off-canvas drawer below `lg`; `pages/admin/chrome.tsx` owns `ADMIN_SCREENS` (crumb, title, glyph, label, path) and `ADMIN_NAV` grouping, and `resolveScreenKey()` sends an unknown `:screen` to the overview rather than a blank page. The public pages are read-only — all editing lives here.

**Hangar Status**: `GET /api/hangar/instances` (`hangar_routes.py`) is a server-to-server hop to the gateway broker's `/instances`, carrying `X-Hangar-Token`. The browser cannot make that call itself: different origin, deliberately absent from `CORS_ORIGINS`, and the broker's `__Host-apps_admin` cookie is `SameSite=Lax`. Any failure or missing env var answers `503 {"success": false, "error": "Hangar status unavailable"}`, which is the normal state until a broker with `/instances` is running — callers render a dash row, never a crash. `AdminHangar` lists each instance's `kind` (`admin`/`anon`/`shared`) with its state, memory and idle age: an aggregate count cannot tell a volume-backed admin container from an anonymous tmpfs one, and that is the question the screen exists to answer.

**Company Categories**: AI-generated tags via Anthropic API (`claude-haiku-4-5-20251001`). Stored as JSON array on `companies.categories`. Triggered explicitly by "Suggest with AI" button in `CompanyFormModal`. Normalized + deduplicated by `_normalizeCategories()` in `company_dao.py`.

**Job-Search Agent**: On-demand sweep of every tracked company, run on a dedicated
Railway worker (`SERVICE_ROLE=worker`) consuming an RQ queue on Redis. Per company:
stored board config → regex detection of a known ATS token → a bounded Anthropic
tool-use loop (`board_discovery_service.py`, max 10 turns, 4 tools). Postings are
read from the provider's API (`services/ats/`) whenever one exists; a hand-rolled
board falls back to postings the agent reports, filtered by `validateAgentPostings`
(URL allow-listed AND title present in text the agent actually fetched).

**Agent Facts, Not Opinions**: "Already applied?" is `posting_matcher` —
`buildApplicationIndex()` normalizes every application once per sweep into three
lookup tiers, and `ApplicationIndex.find()` resolves a posting by
`job_applications.job_posting_id` FK, then normalized URL, then (company +
exactly equal normalized title). Fallback hits are queued and written by a single
`commitLinks()` after the scan, so later runs join at tier 1. "Is this new?" is
`job_postings.first_seen_at >= run.started_at`. Applied postings are omitted
entirely; everything else carries a `New` or `Seen` badge.

**Agent Egress Allow-List**: All discovery traffic goes through `services/agent/net.py`.
`isFetchAllowed()` permits only the company's own domain (or a subdomain) and known
ATS hosts, and refuses LinkedIn/Indeed/Glassdoor/ZipRecruiter/Monster/SimplyHired/Dice
at any depth. Redirects are followed by hand (max 5) so the allow-list is re-checked
on every hop — `requests` would check only the first URL, letting an allowed host
302 straight past the guard. Playwright is a fallback for client-rendered pages,
gated by `BROWSER_FALLBACK_ENABLED` and degrading to the static fetch when chromium
is absent.

**Agent Posting URLs**: a posting whose board API carries no URL of its own inherits
the provider's public board index (`AtsAdapter.boardUrl`), else the careers page
discovery landed on, else the company URL — a finding you cannot click through to is
not usable. `closeMissing()` considers every open posting for the company, not only
rows matching the current source, so switching board (redetect, ATS migration,
`custom` later resolving to a real provider) cannot orphan rows that stay open forever.

**Agent Score Cache**: `job_postings.last_scored_hash` stores
`sha256(content_hash + interests)`. An unchanged posting scored against unchanged
interests is replayed for free; changing either rescores. Re-running the same search
therefore costs ~0 tokens.

**Single Active Run**: `agent_runs.active_lock` is TRUE while queued/running and NULL
when terminal, under a unique index (`uq_agent_runs_active`) — Postgres treats NULLs
as distinct, so at most one run holds the lock. A second POST gets 409. A run whose
worker died is force-finished as `failed` after `AGENT_RUN_STALE_MINUTES`.

**Apps subdomain**: `frontend/src/apps/apps.json` is the single manifest, read by the launcher (import) and by the gateway broker (bind-mounted file). Two kinds: `bundle` apps are static builds committed to `frontend/public/hosted/<slug>/` and framed at `/hosted/<slug>/index.html`; `service` apps are containers the broker starts and frames at `/a/<slug>/` — `mode: "session"` (default) gives every visitor their own, `mode: "shared"` runs one warm container for everybody. Entry URLs are derived from the validated slug, never stored. The launcher fetches `/manifest.json` from the gateway at runtime (falling back to the bundled public entries with no gateway in front), so `access: "admin"` apps are absent for anonymous visitors — names included.

`AppsLauncher` is hash-routed into two screens: `AppsIndex` (unit list + inspector + `RequestPathDiagram`, which draws the actual `YOU → GATEWAY → BROKER → UNIT` request path) and `AppFrame` (the framed unit). `units.ts#specRows()` gives every visitor six rows that are true without the Docker daemon — MODE, ACCESS, STATUS, STACK, ENTRY, ORIGIN — and only adds MEMORY, INSTANCES and COLD START once the gateway has said this session is an admin; the browser-facing manifest strips `image`, `port` and `memoryMb`, so the inspector never prints them. `AppFrame`'s boot overlay is driven by `useBootPhases` polling the broker's `GET /boot/<slug>`: every line it prints is a phase the broker actually reached, never a canned animation.

**Signing in to the apps origin**: `apps.tom-sabala.dev` has its own session (oauth2-proxy, `__Host-apps_admin`) and cannot see the portfolio's JWT, so an admin following a plain `/a/<slug>/` link is resolved as anonymous and handed a tmpfs instance the reaper deletes. `HangarSection` and `Admin.tsx` therefore link to `/?signin=1` (service cards: `/?signin=1#/<slug>`) **only** when `useAuth().isAuthenticated` — an anonymous visitor's hrefs are byte-identical to before, which is what keeps admin invisible on that origin. `apps/signin.ts` + `AppsLauncher` turn the flag into one hop through `/oauth2/start?rd=%2F`, remembering the requested slug in `sessionStorage` (`apps.pendingSlug`) because `rd` cannot carry a fragment through the OAuth round trip. The hop is guarded by `fromGateway` (no `/oauth2/*` under `vite dev` or the Vercel copy), `!admin` (already signed in → no-op, which also avoids oauth2-proxy's `approval_prompt=force` consent screen) and `apps !== null`; the return trip drops `signin=1`, so a refused sign-in lands anonymously on the index and cannot loop. The 7-click gesture now also preserves the current slug.

**Instance durability is visible**: `useInstanceKind` reads `kind` (`anon | admin | shared`) once from `GET /boot/<slug>`. `AppFrame` badges the header EPHEMERAL (accent) / PERSISTENT / SHARED with the boot overlay adding "anything you do here is wiped when the instance goes idle" for `anon`, and `specRows()` inserts a `STATE` row after MODE. An unknown kind — no gateway in front, or a failed fetch — prints nothing rather than guessing.

**Instance cost model**: cataloguing an app is nearly free — a stopped or reaped instance is 0 RAM and restarts in ~6 s — so the VPS is sized for *concurrent visitors*, not for the length of the app list. `session` mode costs `memoryMb` per concurrent visitor and is the only safe mode for an app without its own multi-tenancy (FamilyCFO: no login and one household per database file, so the container is the tenancy boundary; Resume-Matcher scopes every table by `workspace_id` and authenticates the gateway hop, so it is multi-tenant in-process); `shared` mode costs `memoryMb` once, however many visitors. `MAX_TOTAL_INSTANCES` is the cap that must match the box's RAM, because the per-kind caps are independent of each other. Measured footprints are in `gateway/README.md`.

The iframe `sandbox` is not a security boundary (`allow-same-origin` lets a bundle reach `parent.document`), and that is accepted: `public/hosted/` and every `image` in `apps.json` are first-party only. What is enforced is (a) the origin — `vercel.json` redirects `/hosted/**` and `/apps.html` off `tom-sabala.dev`/`www`, so nothing here runs where the admin session is usable, and `apps.tom-sabala.dev` is never in `CORS_ORIGINS`; (b) for services, a separate container per session — own filesystem, own database, tmpfs-backed and reaped for anonymous visitors, volume-backed for admins. See `frontend/src/apps/README.md` and `gateway/README.md`.

**Apps gateway** (`gateway/`): Caddy + oauth2-proxy + a zero-dependency Node broker on one VPS, serving `apps.tom-sabala.dev` end to end. Caddy routes `/oauth2/*` to oauth2-proxy, `/manifest.json`, `/boot/*`, `/instances` and `/a/*` to the broker, and everything else to the frontend build on disk — Vercel is not in this subdomain's request path, so the launcher and the bundles are published by `docker compose -f gateway/docker-compose.yml run --rm launcher-build` on the VPS after a `git pull`. The broker starts/reaps one container per (app, session), proxies to it, and never sees the Docker socket (a scoped socket proxy does). Hiding the `hangar` tab in `/admin/visibility` only removes the landing-page section — it has no effect on this subdomain.

**Broker status surfaces**: `lib/instances.mjs` records real boot phases per container (`BOOT_PHASES = ['claim','create','start','health','probe','ready']`, with `reuse` instead of `create`/`start` for a warm hit and `failed` on any throw), which back two routes, both `no-store`:
- `GET /boot/<slug>` — unauthenticated, resolves the caller's *own* `instanceKey` and returns `{slug, mode, kind, state, phases, phaseCount, elapsedMs, readyMs, error}` for that instance only (`state: "absent"` when there is none, 404 for an unknown or admin-only slug). `kind` is `keyKind(instanceKey)` — the same anon/admin fact `/manifest.json` already tells this caller, and what the launcher's durability labels are built on. Phase timings are relative to the start of the attempt, and it carries no `image`, `port` or `memoryMb`, because anyone can call it.
- `GET /instances` — an oauth2-proxy admin identity **or** an `X-Hangar-Token` equal to `config.statusToken` (`STATUS_TOKEN`, rejected at boot if set and shorter than 32 chars); 401 without either. Returns every instance with state, memory, `coldStartMs` and the `{total, anon, admin}` caps. Exposing memory here is a deliberate admin-gated surface, not a relaxation of the `/manifest.json` stripping invariant.

`gateway/deploy.sh` is the VPS entry point for all of that: `git pull`, pull every image `apps.json` names, rebuild the launcher only if `frontend/` changed, reload Caddy only if the routing did, `up -d`. `--images-only` is the unattended form an hourly `cron.d` job runs — a pull is a full app deploy, because the broker compares each container's resolved image id against what the tag points at now and recreates on the next request. Each app repo publishes its own `:apps-mount` (moving) and `:apps-mount-<sha>` (immutable) tags from its `main`; the mount prefix is a build arg, so the images are deployment-specific and rollback is an `apps.json` edit.

## API Endpoints

**Public (may return 404 if tab hidden):**
- `GET /api/health` - Health check
- `GET /api/portfolio` - List visible projects (includes the work-detail content fields)
- `GET /api/portfolio/:id` - Single project
- `GET /api/portfolio/:id/deep-dive` - Deep-dive markdown + TOC for the detail page
- `GET /api/portfolio/images/:filename` - Project image (unguarded binary)
- `GET /api/about` - About content
- `GET /api/about/profile-photo/:filename` - Portrait (unguarded binary)
- `GET /api/cv` - Get resume data
- `GET /api/cv/pdf` - Active PDF metadata
- `GET /api/cv/pdf/file` - Download/view active PDF (unguarded binary)
- `GET /api/contact/csrf-token` - CSRF token for contact form
- `POST /api/contact` - Submit contact form (rate limited: 5/min)
- `GET /api/github-stats` - GitHub contribution stats
- `GET /api/github-stats/status` - Whether GitHub stats feature is enabled (always public)
- `GET /api/dashboard/tabs` - List of visible tab keys (array, no hidden tabs disclosed)
- `GET /api/ideas` - Ideas list (still served; the redesign dropped only its UI)

**Admin (JWT required):**
- `POST/PUT/DELETE /api/portfolio/:id` - CRUD projects
- `PATCH /api/portfolio/:id/visibility` - `{"isVisible": bool}` sets explicitly; no body toggles
- `PATCH /api/portfolio/reorder` - Update display order
- `POST /api/portfolio/upload-image` - Upload project image
- `PUT /api/cv` - Update resume data
- `POST /api/cv/pdf/upload` - Upload new PDF version
- `GET /api/cv/pdf/history` - List all PDF versions
- `PUT /api/cv/pdf/:id/activate` - Activate specific version
- `DELETE /api/cv/pdf/:id` - Soft delete version
- `GET /api/dashboard/stats` - `projectCount` (all projects, hidden included), `hiddenProjectCount`, `pdfVersionCount`, `unreadMessages`, `resumeExists`, `activeApplications` (excludes rejected/withdrawn/closed), `applicationsByStatus`, `latestRun` (null when none), `lastLogin`, `adminUser`
- `GET /api/dashboard/tabs/admin` - Full tab config including hidden tabs
- `PUT /api/dashboard/tabs` - Update tab visibility
- `GET /api/contact/submissions` - Inbox list (filters + pagination)
- `GET /api/contact/submissions/:id` - One submission
- `PATCH /api/contact/submissions/:id/read` - `{"read": bool}` sets explicitly; no body toggles
- `POST /api/contact/submissions/read-all` - Mark every unarchived unread message read → `{"updated": N}`
- `DELETE /api/contact/submissions/:id` - Delete a submission
- `PUT /api/about` + `POST /api/about/upload-profile-photo` - About content + portrait
- `POST/PUT/DELETE /api/ideas/:id` - CRUD ideas
- `GET /api/hangar/instances` - Live broker instance status; proxied server-side with `X-Hangar-Token`, 503 when the broker is unreachable or unconfigured
- `GET /api/jobs/companies` - List companies
- `POST /api/jobs/companies` - Create company (accepts `categories`, `careers_url`)
- `PUT /api/jobs/companies/:id` - Update company (accepts `categories`, `careers_url`, `redetect_board`)
- `DELETE /api/jobs/companies/:id` - Delete company
- `POST /api/jobs/companies/suggest-categories` - AI tag suggestions (Anthropic, 20/hr limit)
- `GET /api/jobs/applications` - List applications (optional ?status= filter)
- `POST/PUT/DELETE /api/jobs/applications/:id` - CRUD applications
- `PATCH /api/jobs/applications/:id/status` - Quick status update
- `GET /api/jobs/agent/profile` - Saved interests + min score (prefills the run modal)
- `POST /api/jobs/agent/runs` - Start a sweep (10/hr; 409 if one is active, 503 without ANTHROPIC_API_KEY/REDIS_URL)
- `GET /api/jobs/agent/runs` - Recent runs, newest first (300/hr)
- `GET /api/jobs/agent/runs/:id` - One run + per-company results (1200/hr: the UI polls every 3s)
- `GET /api/jobs/agent/runs/:id/findings` - Findings joined to postings + companies (300/hr)
- `POST /api/jobs/agent/runs/:id/cancel` - Signal cancellation (409 if already terminal)
- `POST /api/jobs/agent/postings/:id/dismiss` - Hide a posting from all future runs
- `POST /api/jobs/agent/postings/:id/bookmark` - Create a linked `bookmarked` application (409 if already linked)

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
- `GOOGLE_OAUTH_WHITELIST` - Comma-separated admin email whitelist
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `CONTACT_EMAIL` - Email config
- `STORAGE_TYPE` - `local` or `s3`
- `AWS_*` - S3 credentials (if using S3)
- `SENTRY_DSN` - Error tracking (production)
- `ANTHROPIC_API_KEY` - AI company category suggestions + the job-search agent
- `GITHUB_USERNAME` - For GitHub stats feature
- `REDIS_URL` - Redis for the agent queue (default `redis://localhost:6379/0`)
- `SERVICE_ROLE` - `web` (default) or `worker`; only `web` runs migrations
- `RATELIMIT_ENABLED` - `True` by default; set `False` only locally, where an admin-console reload loop would otherwise trip the ceilings
- `HANGAR_BROKER_URL` - Apps gateway origin for the hangar proxy (e.g. `https://apps.tom-sabala.dev`)
- `HANGAR_BROKER_TOKEN` - Sent as `X-Hangar-Token`; must equal the broker's `STATUS_TOKEN` (min 32 chars)
- `BROWSER_FALLBACK_ENABLED` - Playwright fallback for client-rendered career pages
- `AGENT_DISCOVERY_MODEL` - Board-discovery model (default `claude-sonnet-4-5-20250929`)
- `AGENT_RANKING_MODEL` - Relevance model (default `claude-haiku-4-5-20251001`)
- `AGENT_MAX_COMPANIES_PER_RUN`, `AGENT_MAX_TOKENS_PER_RUN` - Per-run ceilings
- `AGENT_RUN_STALE_MINUTES` - After this, a run whose worker died is failed and unlocked
- `AGENT_REDISCOVER_AFTER_DAYS` - Negative-cache window before retrying a board-less company

**Frontend:**
- `VITE_API_URL` - Backend API URL (default: `http://localhost:5001/api`)
- `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `VITE_RECAPTCHA_V3_SITE_KEY` - reCAPTCHA v3 site key for the contact form

**Gateway (`gateway/.env`):**
- `STATUS_TOKEN` - Optional; enables `GET /instances` for the backend's hangar proxy. Rejected at boot if set and shorter than 32 characters; without it `/instances` accepts an admin session only.

## Security Features

- Rate limiting via Flask-Limiter (200/day, 50/hour default; 5/min on contact; agent reads have their own ceilings); `RATELIMIT_ENABLED=False` turns it off for local development only
- Security headers (XSS, HSTS, CSP, X-Frame-Options)
- CSRF protection for state-changing operations
- JWT tokens in HttpOnly cookies with secure flag in production
- Input validation and file upload restrictions
- Sentry error tracking in production
- Tab visibility enforced at both backend (404 for hidden tabs) and frontend (VisibleTabRoute)
- `/api/hangar/instances` requires JWT and never forwards the caller's credentials; the broker token lives on the server only
- The broker's `/boot/<slug>` is unauthenticated but scoped to the caller's own instance and carries no image, port or memory
- Public tab config endpoint returns only visible tab keys — hidden tabs not disclosed
- Agent egress is allow-listed: company domain + known ATS hosts only, aggregators always refused
- Agent-reported postings are validated against fetched page text before they reach the database
