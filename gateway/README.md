# apps.tom-sabala.dev gateway

Runs the apps subdomain on one VPS: Caddy in front, oauth2-proxy for admin sign-in, and a
zero-dependency Node **broker** that starts one container per (app, visitor session).

```
                    ┌─ /oauth2/*      → oauth2-proxy  (Google, admin whitelist)
browser ── Caddy ───┼─ /manifest.json → broker        (the app list you may see)
                    ├─ /a/<slug>/*    → broker        → apps-<slug>-<key>  (your container)
                    └─ everything else → /srv/launcher on disk  (launcher + /hosted/** bundles)
```

Vercel is **not** in this request path. `apps.tom-sabala.dev` serves the frontend build from a
volume filled by the one-shot `launcher-build` service, so the subdomain is self-contained:
no second public hostname, no `Host` rewriting, and no dependency on a Vercel domain that
`vercel.json`'s own host rules would bounce straight back here.

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
falls back to the default workspace. That is why it runs `mode: "session"` — for it, the
container *is* the boundary.

## The tenant contract, for apps that can separate visitors themselves

An app that scopes its own data does not need a container of its own. The broker tells it who
is asking, on every proxied request and upgrade:

| header | value | meaning |
|---|---|---|
| `X-Apps-Tenant` | `anon-<16 hex>` | hash of the gateway session cookie — a cleared cookie is a new tenant, which is what makes an anonymous visit fresh |
| `X-Apps-Tenant` | `admin-<16 hex>` | hash of the lowercased admin email — stable across browsers and sessions |
| `X-Apps-Role` | `anon` \| `admin` | whether oauth2-proxy authenticated the viewer |

Neither can be forged: `server.mjs` deletes every inbound `X-Apps-*` and `X-Auth-Request-*`
header before anything reads them, `proxy.mjs` sets them from the broker's own identity
resolution, and the instance has no published port — the broker is the only route to it.
Verified: a request carrying `X-Apps-Tenant: forged-by-client` and `X-Apps-Role: admin`
arrives at the app as `anon-…` / `anon`.

The values are hashes, so nothing downstream ever sees an email address or a live session id,
and they are stable for as long as the identity is. An app keyed on them gets fresh state per
anonymous visit and persistent state for the admin — the same guarantee `mode: "session"`
buys with a container each, at one container total.

For Resume-Matcher specifically, the work to get there is written up in that repo:
`docs/agent/features/multi-tenancy.md`.

## What this costs, and what drives it

**Cataloguing an app is nearly free. Concurrency is what costs.** A reaped or stopped
instance holds 0 RAM and 113 kB of disk beyond its image, and restarts to healthy in ~6 s.
Twenty apps in `apps.json` that nobody is using cost the same as zero. So the box is sized
for *simultaneous visitors*, never for the length of the app list.

Two dials decide the bill:

| | RAM cost | Use it when |
|---|---|---|
| `"mode": "session"` | `memoryMb` × concurrent visitors | the app has no multi-tenancy of its own, so two visitors must not share state |
| `"mode": "shared"` | `memoryMb`, once, however many visitors | the app stores nothing per visitor, or has its own accounts |

`session` is the default because it is the safe one, and it is also the expensive one —
Resume-Matcher needs it (`api_keys`, `improvements` and `tailoring_previews` have no owner
column). An app with its own login does not, and one `shared` container serves everybody
while staying warm. Per-app disk is the other cost: the image, once, whatever the mode.

### Measured, not estimated

One `resume-matcher` container under the manifest's limits (`memoryMb: 768`, tmpfs 128 MB):

| | RSS |
|---|---|
| idle and healthy | **288 MB** |
| peak during a PDF export (Chromium) | **607 MB** |
| peak during three *concurrent* exports | **582 MB** — it reuses one browser |
| stopped | **0**, and ~6 s to bring back |
| whole gateway (caddy + broker + oauth2-proxy + socket-proxy) | **55 MB** |

A trivial `shared` app for comparison: **21 MB**. Most apps are far closer to that than to
Resume-Matcher, which carries Chromium and a LaTeX engine.

`memoryMb` is a ceiling, not a reservation, so budget by the ceiling — tmpfs content counts
inside the same limit. With ~0.6 GB for the OS, Docker and the gateway:

| RAM | `MAX_TOTAL_INSTANCES` | Means |
|---|---|---|
| 2 GB | 1 | One `session` visitor at a time, or ~5 small `shared` apps warm. Set `IDLE_TTL_SECONDS=300` so one visitor does not hold the only slot for 20 minutes. Do **not** build the app image here (needs ~4 GB) — pull it. `launcher-build` peaks around 1 GB, so run it with no instance up. |
| 4 GB | 4 | Four concurrent `session` visitors, or one plus a dozen small `shared` apps. Set **3** if you ever run `launcher-build` or `docker pull` while the box is serving: that wants ~1 GB, which the fourth slot has already spent. |
| 8 GB | 9 | Headroom to stop thinking about it. |

`MAX_TOTAL_INSTANCES` is the cap that matters. The per-kind caps are independent, so
`anon=1` + `admin=1` still allows two containers — on a 2 GB box that is an OOM kill instead
of a 503. Leave it `0` only when `anon + admin` already fits. `shared` instances have no
per-kind cap (there is one per app by definition) but do count against the total.

CPU is not the binding constraint, but it sets the wait: a cold start is ~6 s on 12 cores and
a PDF export ~2.9 s. On 1–2 shared vCPUs expect both to be several times that;
`READY_TIMEOUT_SECONDS=90` still covers it. A host swapfile protects the OS and the gateway,
not the instances — their cgroup has swap disabled on purpose, so an over-limit instance is
killed rather than dragging the box down.

### Consolidating what you already pay for

This box is a plain Docker host with Caddy in front, so the services you rent elsewhere can
move onto it and stop being a per-service bill. Two ways in, and the second is usually right
for an app that already has users:

1. **As an app** — add it to `apps.json` with `"mode": "shared"`. It gets the launcher card,
   the `/a/<slug>/` mount, sign-in gating via `access`, and scale-to-zero for free.
2. **As a plain service** — add it to `gateway/docker-compose.yml` and give it a route in the
   Caddyfile. No manifest entry, no broker involvement, its own hostname if you want one.
   Best for anything with its own domain, users or database.

## VPS bootstrap

Host first. None of this is a default, and all of it bites later:

```bash
apt-get update && apt-get -y full-upgrade
apt-get install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

# Swap. Most small VPS images ship none, and 4 GB has no headroom to lose to a spike. It
# protects the OS and the gateway only — instance cgroups set MemorySwap == Memory, so an
# over-limit instance is still OOM-killed instead of thrashing the whole box. Intended:
# the visitor gets one dead instance, not a dead server.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf

curl -fsSL https://get.docker.com | sh

# Log rotation. The default json-file driver NEVER rotates, so one chatty instance fills
# the disk over a few months.
cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
systemctl restart docker

# Reclaim old layers: every pull of a moving tag leaves the previous image dangling, and
# the app repo pushes :apps-mount on every merge.
echo '30 4 * * 0 root docker image prune -f >/dev/null 2>&1' > /etc/cron.d/apps-docker-prune
```

Then the stack:

```bash
# 1. This repo
git clone https://github.com/<you>/tom-sabala.dev.git /srv/apps && cd /srv/apps

# 2. Secrets
cp gateway/.env.example gateway/.env                      # fill every blank
cp gateway/oauth2/emails.txt.example gateway/oauth2/emails.txt   # the admin whitelist
cp gateway/instances/resume-matcher.anon.env.example  gateway/instances/resume-matcher.anon.env
cp gateway/instances/resume-matcher.admin.env.example gateway/instances/resume-matcher.admin.env

# 3. App images (the broker never pulls; it only starts what is already local)
docker pull ghcr.io/tomsabala/resume-matcher:apps-mount

# 4. The launcher itself: builds frontend/ into the volume Caddy serves.
#    Reads the checkout read-only and writes nothing back into it.
docker compose -f gateway/docker-compose.yml run --rm launcher-build

# 5. Up
docker compose -f gateway/docker-compose.yml up -d
```

Step 4 is the one that is easy to forget: skip it and Caddy serves an empty directory — the
apps subdomain 404s while `/a/*` and `/manifest.json` work fine. Repeat it after every
`git pull` that touches `frontend/`.

Then, in this order:

1. Add `https://apps.tom-sabala.dev/oauth2/callback` to the existing Google OAuth client's
   authorised redirect URIs.
2. Point the `apps` A/AAAA records at the VPS, **DNS-only**: an orange-cloud Cloudflare
   proxy in front of port 80 breaks the HTTP-01 challenge. Delete any CNAME first.
3. `docker compose -f gateway/docker-compose.yml logs caddy` and confirm it issued a
   certificate (`certificate obtained successfully`).
4. `curl -s https://apps.tom-sabala.dev/manifest.json` → `{"admin":false,...}`.
5. Open `https://apps.tom-sabala.dev/#resume-matcher` once and watch
   `docker compose -f gateway/docker-compose.yml logs -f broker` create the instance. This
   is the only measurement that matters on a box you have not used before: time the cold
   start, then `docker stats --no-stream` the instance and compare its RSS against the
   manifest's `memoryMb`. On 1–2 shared vCPUs expect a cold start several times the ~6 s
   measured on 12 cores — 15–25 s is normal, and `READY_TIMEOUT_SECONDS=90` covers it.

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
   | `mode` | `session` (default, one container per visitor) or `shared` (one for everybody). See the cost model above — this is the single biggest lever on what the box has to be. |

3. Write the instance env file(s) from the `.example` twins in `gateway/instances/`. The
   broker reads `<slug>.<kind>.env`, where kind is `anon`, `admin` or `shared` — a
   `session` app wants the first two, a `shared` app only the last.
4. Commit, then on the VPS:

   ```bash
   git pull
   # apps.json alone: nothing else to do — the broker re-reads it within ~5 s. (The compose
   # file bind-mounts the *directory*; a single-file mount would be detached by git pull's
   # atomic rename and freeze the broker on the old manifest.)

   # anything else under frontend/ (or to refresh the launcher's own bundled fallback list):
   docker compose -f gateway/docker-compose.yml run --rm launcher-build
   ```

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
mounts `caddy/launcher-proxy.caddy`, so the launcher comes from the Vite dev server with hot
reload instead of from disk. Everything else — Caddyfile, broker, socket proxy — is the same
file production uses; the broker has no bypass flag. `IDLE_TTL_SECONDS`,
`MAX_ANON_INSTANCES` and `MAX_ADMIN_INSTANCES` are overridable per run, which is how the
reaper and capacity paths get tested in seconds:

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

# Deploy a new app build. The broker compares each container's resolved image digest against
# what the tag points at now, so a pull is the whole deploy: running instances are recreated
# on their next request (within 30 s, the digest cache TTL). Nothing to restart.
docker pull ghcr.io/tomsabala/resume-matcher:apps-mount

# Rebuild the launcher after a frontend change (safe while the stack is up: Caddy picks up
# the new files immediately, and the volume is only swapped at the end of the build)
docker compose -f gateway/docker-compose.yml run --rm launcher-build
```

Broker logs are the audit trail: instance create/restart/recreate, capacity refusals, ready
timeouts, reaps, and dropped manifest entries.

### Continuous delivery for an app

The app repo builds and pushes its own image; the VPS only pulls. For Resume-Matcher that is
`.github/workflows/apps-image.yml` in its repo: on push to `main` it builds with
`--build-arg NEXT_PUBLIC_BASE_PATH=/a/resume-matcher` (the mount prefix is inlined at build
time, so this image is deployment-specific) and pushes two tags —
`:apps-mount`, which moves, and `:apps-mount-<sha>`, which does not.

Getting it onto the box, cheapest first:

```bash
# Manual: one command, and the broker does the rest.
docker pull ghcr.io/tomsabala/resume-matcher:apps-mount

# Automatic: a timer, so nothing needs inbound access to the VPS.
#   /etc/cron.d/apps-image-pull
0 * * * * root docker pull -q ghcr.io/tomsabala/resume-matcher:apps-mount
```

A cron beats wiring CI to SSH in: no deploy key, no secret in GitHub, and nothing that can
reach the box from outside. The cost is up to an hour's delay — `docker pull` by hand when
that matters.

Pin `:apps-mount-<sha>` in `apps.json` instead if you would rather deploys be explicit: the
image reference changes, so the broker recreates on the next request and a rollback is an
`apps.json` edit plus `git pull`.

GHCR packages start **private**. Either make the package public (GitHub → Packages → …  →
Package settings) or `docker login ghcr.io` on the VPS with a read-only PAT — otherwise the
pull fails and instances 503 with "did not start in time".

### Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `503` "at capacity" | `MAX_TOTAL_INSTANCES` or a per-kind cap reached — the broker log names which | raise it *and* the RAM, lower `memoryMb`, or shorten `IDLE_TTL_SECONDS` so idle slots free up sooner |
| `503` "did not start in time" | image missing locally, crash on boot, or `READY_TIMEOUT_SECONDS` too low for a cold image | `docker logs` the instance; anonymous instances are removed on timeout, admin ones kept for inspection |
| App loads but its API 404s | image built without the right `basePath` | rebuild with `--build-arg NEXT_PUBLIC_BASE_PATH=/a/<slug>` |
| PDF export renders a login page | `FRONTEND_BASE_URL` escaped to the gateway | the broker sets it to `http://127.0.0.1:<port>/a/<slug>`; do not override it in the instance env file |
| Chromium fails to launch | `CapDrop: ALL` too tight for that image | add `"capAdd": ["SYS_ADMIN"]`. Not needed for Resume-Matcher — verified working with all capabilities dropped |
| Manifest edits ignored | the file was replaced by rename and the mount is a file, not a directory | check `volumes:` mounts `../frontend/src/apps`, not `.../apps.json` |
| Launcher 404s while `/a/*` works | `launcher-build` never ran, so `/srv/launcher` is empty | `docker compose … run --rm launcher-build` |
| Launcher shows an old app list | the build volume predates the last `git pull` | same — rebuild |
| App still serves the old build after a pull | the digest cache has up to 30 s left, or the instance is mid-request | wait, or `docker rm -f` the instance; a `503` "did not start in time" right after a pull usually means the pull failed on auth |
| Cert never issued | DNS not on the VPS yet, or Cloudflare is proxying (orange cloud) | HTTP-01 needs port 80 reaching Caddy directly; set the `apps` record to DNS-only |

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
- Do **not** point the launcher at `tom-sabala.dev` as an upstream if you ever put Vercel back
  in the path. `vercel.json` redirects `/apps.html` and `/hosted/**` off that host to this
  subdomain, so the gateway would proxy a request out and get the same request back: an
  infinite loop. Those redirects are what keeps bundles off the cookie-bearing origin, so the
  fix is never to delete them.
