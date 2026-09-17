# apps.tom-sabala.dev gateway

Runs the apps subdomain on one VPS: Caddy in front, oauth2-proxy for admin sign-in, and a
zero-dependency Node **broker** that starts one container per (app, visitor session).

```
                    ┌─ /oauth2/*      → oauth2-proxy  (Google, admin whitelist)
browser ── Caddy ───┼─ /manifest.json → broker        (the app list you may see)
                    ├─ /a/<slug>/*    → broker        → apps-<slug>-<key>  (your container)
                    └─ everything else → Vercel       (launcher + /hosted/** bundles)
```

`frontend/src/apps/apps.json` is the single manifest: the launcher imports it at build time,
the broker reads the same file at runtime.

## What is and is not isolated

The browser-level boundary is **given up on purpose**. Everything on this origin is
same-origin: an app framed at `/a/<slug>/` can reach `parent.document`, and so can a static
bundle under `/hosted/`. `sandbox` on the iframe does not change that (`allow-same-origin` is
required for app storage). Only first-party code goes here.

What is actually enforced:

| Boundary | Mechanism |
|---|---|
| One visitor's data from another's | A separate container per session: own filesystem, own SQLite, own generated `.secret_key` |
| Anonymous data does not outlive the session | `tmpfs` over the app's data dir; container removed when idle |
| Admin-only apps | oauth2-proxy verdict, checked per request; admin apps are absent from an anonymous `/manifest.json` |
| The session cookie | `HttpOnly`, stripped from every proxied request, and an app's attempt to `Set-Cookie` it is dropped |
| App containers are not addressable | No published ports; they exist only on the internal `apps-instances` network |
| The portfolio admin session | A different origin. `apps.tom-sabala.dev` is never in `CORS_ORIGINS` and no cookie is scoped to `.tom-sabala.dev` |

Deliberate exception: a request for an admin-only app's **document** answers `302` to
sign-in rather than `404`, so a bookmarked deep link still works. That tells a caller who
already knows the slug that the app exists. Non-document requests get `401`, and the launcher
never lists the app, which is the boundary that matters. Switch it to `404` in
`server.mjs` (`handleService`) if you would rather have zero disclosure.

Resume-Matcher's own `X-Workspace-Id` is **not** part of this: its `api_keys`,
`improvements` and `tailoring_previews` tables have no `workspace_id`, and an unknown id
falls back to the default workspace. The container is the boundary.

## VPS bootstrap

Sized for two anonymous instances plus one admin instance at `memoryMb: 1536` each:
**Hetzner CX32-class, 4 vCPU / 8 GB, ≈€7/mo**. A 4 GB box fits one instance, not three.

```bash
# 1. Docker + unattended upgrades
curl -fsSL https://get.docker.com | sh
apt-get install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

# 2. This repo
git clone https://github.com/<you>/tom-sabala.dev.git /srv/apps && cd /srv/apps

# 3. Secrets
cp gateway/.env.example gateway/.env                      # fill every blank
cp gateway/oauth2/emails.txt.example gateway/oauth2/emails.txt   # the admin whitelist
cp gateway/instances/resume-matcher.anon.env.example  gateway/instances/resume-matcher.anon.env
cp gateway/instances/resume-matcher.admin.env.example gateway/instances/resume-matcher.admin.env

# 4. App images (the broker never pulls; it only starts what is already local)
docker pull ghcr.io/tomsabala/resume-matcher:apps-mount

# 5. Up
docker compose -f gateway/docker-compose.yml up -d
```

Then, in this order:

1. Add `https://apps.tom-sabala.dev/oauth2/callback` to the existing Google OAuth client's
   authorised redirect URIs.
2. Point the `apps` A/AAAA record at the VPS.
3. `docker compose -f gateway/docker-compose.yml logs caddy` and confirm it issued a
   certificate (`certificate obtained successfully`).
4. `curl -s https://apps.tom-sabala.dev/manifest.json` → `{"admin":false,...}`.

`SESSION_SECRET` is what separates visitors. Rotating it invalidates every anonymous session
(their containers are orphaned and reaped on idle); admin instances are keyed by email and
survive.

## Adding an app

1. Build an image whose HTTP server is mounted at `/a/<slug>` (for Next.js: `basePath`, baked
   in at build time — see `NEXT_PUBLIC_BASE_PATH` in Resume-Matcher's `Dockerfile`).
2. Add an entry to `frontend/src/apps/apps.json` with `"kind": "service"`:

   | field | meaning |
   |---|---|
   | `image` | must already be present on the VPS (`docker pull`) |
   | `port` | the port the app listens on inside the container |
   | `memoryMb` | hard limit; swap is disabled, so an over-limit instance is killed |
   | `shmSizeMb` | raise to ≥256 if the app runs Chromium |
   | `dataPath` | the directory holding all per-visitor state |
   | `dataTmpfsMb` | size of the anonymous tmpfs over `dataPath`; counts against `memoryMb` |
   | `readyPath` | probed until it answers non-5xx (404 counts: a basePath app has no `/` route) |
   | `capAdd` | capabilities to add back on top of `CapDrop: ALL` |
   | `access` | `public`, or `admin` to hide it from anonymous visitors entirely |

3. `cp gateway/instances/<slug>.anon.env.example …` and write the two env files.
4. Commit, `git pull` on the VPS. The broker re-reads the manifest within ~5 s; no restart.
   (The compose file bind-mounts the *directory* — a single-file mount would be detached by
   `git pull`'s atomic rename and freeze the broker on the old manifest.)

Anonymous instances get no `LLM_API_KEY` by design. Give one out and any visitor can spend
it; the app's only cap is global per instance.

## Local verification

```bash
cd frontend && npm run dev                                          # launcher upstream, :5173
docker compose -f gateway/docker-compose.dev.yml up --build         # gateway on :8080
# 8080 taken? APPS_DEV_PORT=8088 docker compose -f … up --build
node --test 'gateway/broker/**/*.test.mjs'                          # broker units
```

The dev stack swaps oauth2-proxy for `dev-auth-stub/` (`Cookie: dev_admin=1` == admin) and
points Caddy's launcher upstream at the Vite dev server. The broker itself is identical and
has no bypass flag. `IDLE_TTL_SECONDS`, `MAX_ANON_INSTANCES` and `MAX_ADMIN_INSTANCES` are
overridable per run, which is how the reaper and capacity paths get tested in seconds:

```bash
IDLE_TTL_SECONDS=20 docker compose -f gateway/docker-compose.dev.yml up -d
MAX_ANON_INSTANCES=1 docker compose -f gateway/docker-compose.dev.yml up -d
```

Tear down with `docker compose -f gateway/docker-compose.dev.yml down`, then check
`docker ps -a --filter label=dev.tom-sabala.apps.slug` is empty — instance containers are not
part of the compose project and outlive it.

## Operating

```bash
# What is running for whom
docker ps --filter label=dev.tom-sabala.apps.slug \
  --format '{{.Names}}\t{{.Status}}\t{{.Label "dev.tom-sabala.apps.kind"}}'

# One visitor's logs
docker logs apps-<slug>-<key>

# Admin state (volumes survive stop; anonymous instances have none)
docker volume ls --filter name=apps-

# Force a clean slate for everyone
docker rm -f $(docker ps -aq --filter label=dev.tom-sabala.apps.kind=anon)

# After pushing a new image tag: the broker recreates any instance whose
# dev.tom-sabala.apps.image label no longer matches the manifest, on its next request.
docker pull ghcr.io/tomsabala/resume-matcher:apps-mount
```

Broker logs are the audit trail: instance create/restart/recreate, capacity refusals, ready
timeouts, reaps, and dropped manifest entries.

### Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `503` "at capacity" | `MAX_*_INSTANCES` reached | raise it (and the RAM), or lower `memoryMb` |
| `503` "did not start in time" | image missing locally, crash on boot, or `READY_TIMEOUT_SECONDS` too low for a cold image | `docker logs` the instance; anonymous instances are removed on timeout, admin ones kept for inspection |
| App loads but its API 404s | image built without the right `basePath` | rebuild with `--build-arg NEXT_PUBLIC_BASE_PATH=/a/<slug>` |
| PDF export renders a login page | `FRONTEND_BASE_URL` escaped to the gateway | the broker sets it to `http://127.0.0.1:<port>/a/<slug>`; do not override it in the instance env file |
| Chromium fails to launch | `CapDrop: ALL` too tight for that image | add `"capAdd": ["SYS_ADMIN"]`. Not needed for Resume-Matcher — verified working with all capabilities dropped |
| Manifest edits ignored | the file was replaced by rename and the mount is a file, not a directory | check `volumes:` mounts `../frontend/src/apps`, not `.../apps.json` |

## Invariants — do not break these

- **Never** add `apps.tom-sabala.dev` to the portfolio API's `CORS_ORIGINS`. Every app and
  bundle on this origin runs arbitrary first-party JS with no admin cookie; a CORS entry would
  hand it the API.
- **Never** give either origin a `Domain=.tom-sabala.dev` cookie. `backend/app/__init__.py`
  sets no `JWT_COOKIE_DOMAIN`, so the portfolio admin session is host-locked today. Keep it so.
- `frontend/public/hosted/` and every `image` in `apps.json` are **first-party only**. There
  is no sandbox behind them.
- The socket proxy is not a privilege boundary: anything that owns the broker can create a
  container, and therefore the host. It limits *reachable API surface*, nothing more. Treat
  broker RCE as host compromise and keep its dependency count at zero.
- Hiding the `apps` tab in the portfolio's Settings hides the sidebar link only. This
  subdomain has no connection to that flag.
