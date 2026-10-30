# apps.tom-sabala.dev gateway

Runs the apps subdomain on one VPS: Caddy in front, oauth2-proxy for admin sign-in, and a
zero-dependency Node **broker** that starts one container per (app, visitor session).

```
                    ┌─ /oauth2/*      → oauth2-proxy  (Google, admin whitelist)
browser ── Caddy ───┼─ /manifest.json → broker        (the app list you may see)
                    ├─ /boot/<slug>   → broker        (how your own instance is starting)
                    ├─ /instances     → broker        (every instance; admin or status token)
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
| `X-Apps-Proxy-Secret` | the instance's own `GATEWAY_SECRET` | proof the two above came from the broker; sent only when that env file sets one |

None of them can be forged: `server.mjs` deletes every inbound `X-Apps-*` and
`X-Auth-Request-*` header before anything reads them, `proxy.mjs` sets them from the
broker's own identity resolution, and the instance has no published port — the broker is the
only route to it. Verified: a request carrying `X-Apps-Tenant: forged-by-client`,
`X-Apps-Role: admin` and a guessed `X-Apps-Proxy-Secret` arrives at the app as `anon-…` /
`anon` with the broker's real secret.

The secret closes the gap the other two leave open from the *app's* side: an app cannot
tell a header this gateway set from one a client typed, so an app that takes tenancy from a
header must refuse an unsigned one. It lives in `gateway/instances/<slug>.<kind>.env`, which
the broker reads for the container's environment anyway — the app validates
`X-Apps-Proxy-Secret` against `GATEWAY_SECRET` from that same file, so there is one value in
one place and no way for the two sides to drift. `openssl rand -hex 32`, per instance.

The values are hashes, so nothing downstream ever sees an email address or a live session id,
and they are stable for as long as the identity is. An app keyed on them gets fresh state per
anonymous visit and persistent state for the admin — the same guarantee `mode: "session"`
buys with a container each, at one container total.

An app must also be *told* which of the two worlds it is in. Resume-Matcher's 2026-09 builds
refuse to start on an empty `TENANT_MODE`, and behind this gateway the answer is `header`,
never `single` — a `single` instance treats any request carrying the identity headers as a
proxy bypass and answers **404**, so the app boots, passes its healthcheck (`/api/v1/health`
is exempt) and then fails every single call. That failure mode is worth remembering: a
container that is up and a UI that loads are not evidence that the tenancy config is right.

This is also why the env file is part of the deploy and not an afterthought: an app that
adds a required setting takes its instances down at the next `docker pull`, with the
container exiting during startup and no clue in the broker log — until the broker prints the
container's own output, which it now does (`instances.mjs`).

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

One `trek` container (`mode: "shared"`, `memoryMb: 768`, no tmpfs) for the other shape — a
Node server with SQLite and no browser: **253 MB** on a cold boot, **327 MB** after browsing
the dashboard, atlas, journeys and settings. A trivial `shared` app for comparison: **21 MB**.
Most apps are far closer to those than to Resume-Matcher, which carries Chromium and a LaTeX
engine.

`memoryMb` is a ceiling, not a reservation, so budget by the ceiling — tmpfs content counts
inside the same limit. With ~0.6 GB for the OS, Docker and the gateway:

| RAM | `MAX_TOTAL_INSTANCES` | Means |
|---|---|---|
| 2 GB | 1 | One `session` visitor at a time, or ~5 small `shared` apps warm. Set `IDLE_TTL_SECONDS=300` so one visitor does not hold the only slot for 20 minutes. Do **not** build the app image here (needs ~4 GB) — pull it. |
| 4 GB | 3 | Three concurrent `session` visitors — 2.25 GB of ceilings plus 0.6 GB overhead leaves ~1 GB spare, which is what `launcher-build` (405 MB peak, measured) and a `docker pull` want. 4 fits only if you never rebuild while the box is busy. |
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

Reference box: **Hetzner CX23** (Cost-Optimized, x86) — 2 vCPU, 4 GB, 40 GB SSD, Nuremberg,
$6.49/mo plus the separately billed primary IPv4. Ubuntu 24.04 LTS.

### Host

```bash
# 1a. Packages and unattended security updates
apt-get update && apt-get -y full-upgrade
apt-get install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades

# 1b. Swap. Hetzner ships none, and this box has no headroom to lose to a spike.
#     It protects the OS and the gateway only: instance cgroups have swap disabled on
#     purpose, so an over-limit instance is still killed rather than dragged out.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10 && echo 'vm.swappiness=10' > /etc/sysctl.d/99-swap.conf

# 1c. Docker, with log rotation. The default json-file driver never rotates, and one
#     chatty instance can otherwise fill 40 GB over a few months.
curl -fsSL https://get.docker.com | sh
cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

# 1d. Reclaim old image layers. Every `docker pull` of a moving tag leaves the previous
#     1.9 GB image dangling, and CI pushes on every merge to the app repo.
cat > /etc/cron.d/apps-docker-prune <<'CRON'
30 4 * * 0 root docker image prune -f >/dev/null 2>&1
CRON
```

### Stack

```bash
# 2. This repo
git clone https://github.com/<you>/tom-sabala.dev.git /srv/apps && cd /srv/apps

# 3. Secrets
cp gateway/.env.example gateway/.env                      # fill every blank
cp gateway/oauth2/emails.txt.example gateway/oauth2/emails.txt   # the admin whitelist
cp gateway/instances/resume-matcher.anon.env.example  gateway/instances/resume-matcher.anon.env
cp gateway/instances/resume-matcher.admin.env.example gateway/instances/resume-matcher.admin.env
cp gateway/instances/trek.shared.env.example          gateway/instances/trek.shared.env

# 4. App images (the broker never pulls; it only starts what is already local). The tags are
#    pinned in frontend/src/apps/apps.json — `gateway/deploy.sh --images-only` pulls exactly
#    what the manifest names, and refuses a moving tag:
gateway/deploy.sh --images-only

# 5. The launcher itself: builds frontend/ into the volume Caddy serves.
#    Reads the checkout read-only and writes nothing back into it.
docker compose -f gateway/docker-compose.yml run --rm launcher-build

# 6. Up
docker compose -f gateway/docker-compose.yml up -d
```

Step 5 is the one that is easy to forget: skip it and Caddy serves an empty directory — the
apps subdomain 404s while `/a/*` and `/manifest.json` work fine. Repeat it after every
`git pull` that touches `frontend/`.

### Network

Use the **Hetzner Cloud Firewall**, not `ufw`: it sits outside the VM, so it filters Docker's
published ports. `ufw` does not — Docker writes its own iptables rules and bypasses it, which
is the classic way a "firewalled" Docker host ends up wide open.

| direction | port | source |
|---|---|---|
| in | 22 | your IP, if it is static; otherwise anywhere |
| in | 80 | anywhere — ACME HTTP-01 needs it, and Caddy redirects to 443 |
| in | 443 | anywhere (TCP **and** UDP, for HTTP/3) |

Keep the primary IPv4: ACME works over either family, but an IPv6-only box is unreachable for
a large slice of visitors. No Hetzner Volume is needed — the local 40 GB holds the OS, a
1.9 GB app image, the launcher build (~2 MB of assets plus a few hundred MB of `node_modules`
cache) and instance volumes with room to spare. Add one only when an app's data grows.

Then, in this order:

1. Add `https://apps.tom-sabala.dev/oauth2/callback` to the existing Google OAuth client's
   authorised redirect URIs.
2. Point the `apps` A (and AAAA) record at the VPS. On Cloudflare set it to **DNS only** —
   the orange cloud terminates TLS itself and Caddy's HTTP-01 challenge never completes.
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

## Instance status

Two read-only endpoints expose what the broker is doing, because both the launcher's boot
overlay and the portfolio's admin console were otherwise reduced to inventing it.

`GET /boot/<slug>` is **unauthenticated** — it is polled while an iframe is still blank, so
there is no session to require — and in exchange it answers about one instance only: the one
the same caller would be proxied to, resolved from their own cookie exactly as `/a/<slug>/`
does. It returns `{slug, mode, kind, state, phases, phaseCount, elapsedMs, readyMs, error}`,
where `state` is `absent | starting | ready | failed | stopped` and each phase is
`{name, at}` with `at` in milliseconds since this attempt began. The phase names, in order:

| phase | meaning |
|---|---|
| `claim` | the request has been resolved to a container name |
| `reuse` | the container already existed (warm, or stopped with its volume) |
| `create` | a container was created from the manifest's image |
| `start` | `docker start` issued |
| `health` | waiting on the image's own `HEALTHCHECK` |
| `probe` | healthy; waiting for `readyPath` to answer |
| `ready` | serving |
| `failed` | terminal; `error` carries the broker's message |

Nothing from the manifest's runtime block (`image`, `port`, `memoryMb`, `shmSizeMb`,
`dataPath`, `readyPath`) appears in that payload — the same stripping `publicManifest()`
enforces, asserted in `lib/status.test.mjs`.

`kind` is `anon | admin | shared` — the identity the caller's own `instanceKey` resolves to,
and therefore whether the instance they are about to use keeps its data (`admin`: a named
volume) or throws it away (`anon`: tmpfs, removed by the reaper). It is the same fact
`/manifest.json` already tells the same caller as `admin: true|false`, and the launcher
prints it as the frame's EPHEMERAL/PERSISTENT/SHARED badge and the inspector's `STATE` row.

`GET /instances` is the admin view: every instance container on the box joined to the
broker's in-memory boot state, plus the capacity ceilings. It takes **either** an admin
oauth2-proxy session (the launcher's own inspector, same origin) **or**
`X-Hangar-Token: $STATUS_TOKEN`. The token exists because the portfolio admin console lives
on a different origin and cannot send this origin's `__Host-` cookie: its backend proxies the
call server-side (`HANGAR_BROKER_URL` / `HANGAR_BROKER_TOKEN`). Leave `STATUS_TOKEN` empty to
allow admin sessions only; set it and it must be 32+ characters, like `SESSION_SECRET`.

```json
{"instances": [{"slug": "trek", "name": "apps-trek-shared", "kind": "shared",
                "mode": "shared", "state": "ready", "memUsedBytes": 265289728,
                "memLimitBytes": 805306368, "startedAt": "ISO", "lastSeenMs": 4120,
                "coldStartMs": 6210}],
 "caps": {"total": 4, "anon": 2, "admin": 2}}
```

Memory comes from `GET /containers/<id>/stats?stream=0` through the socket proxy, minus the
reclaimable page cache. A proxy without `CONTAINERS=1` on that route reports
`memUsedBytes: null` and the console draws a dash; nothing else is affected. Boot state is
in-memory only: after a broker restart every instance is adopted and reports `running` with a
null `coldStartMs` until it is next started.

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
   `session` app wants the first two, a `shared` app only the last. The directory is
   bind-mounted read-only into the broker, which runs as **uid 1000**, so the file has to be
   readable by it — `chown root:1000 && chmod 640`. A root-owned `chmod 600` looks right to
   whoever wrote it and is `EACCES` to the broker, which surfaces only when a visitor asks
   for the app. `deploy.sh` checks this and says `UNREADABLE …` rather than letting you find
   out from a 503.
4. Commit, then on the VPS run `gateway/deploy.sh` — it pulls the checkout, pulls every
   image the manifest names, rebuilds the launcher if `frontend/` changed, reloads Caddy,
   and then asks the live site whether `/manifest.json`, `/boot/<slug>` and `/instances`
   really come from the broker. By hand, the same thing is:

   ```bash
   git pull
   # apps.json alone: nothing else to do — the broker re-reads it within ~5 s. (The compose
   # file bind-mounts the *directory*; a single-file mount would be detached by git pull's
   # atomic rename and freeze the broker on the old manifest.)

   # anything else under frontend/ (or to refresh the launcher's own bundled fallback list):
   docker compose -f gateway/docker-compose.yml run --rm launcher-build

   # ALWAYS, if the Caddyfile moved at all. Caddy serves the config it loaded, not the file
   # on disk: this step is how /boot/* and /instances spent weeks being answered by the
   # launcher's HTML while the checkout, the broker and the launcher build were all current.
   docker compose -f gateway/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
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

```bash
# The status surfaces (the dev stack fixes STATUS_TOKEN so this works without sign-in)
curl -s localhost:8080/instances -o /dev/null -w '%{http_code}\n'   # 401
curl -s -H "X-Hangar-Token: dev-only-status-token-not-for-production-0123456789" \
  localhost:8080/instances | jq '.instances[0], .caps'
curl -s localhost:8080/boot/trek | jq '{state, phases: [.phases[].name]}'
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

# Deploy everything: git pull, pull every image the manifest names, rebuild the launcher if
# frontend/ changed, reload Caddy, converge the stack, then verify the live routes. The
# reload and the verify are unconditional; the expensive steps are skipped when nothing
# relevant changed.
gateway/deploy.sh

# Just the images. The broker compares each container's resolved image digest against what
# the tag points at now, so a pull IS the deploy: running instances are recreated on their
# next request (within 30 s, the digest cache TTL). Nothing to restart, nothing to remove.
gateway/deploy.sh --images-only

# Rebuild the launcher after a frontend change (safe while the stack is up: Caddy picks up
# the new files immediately, and the volume is only swapped at the end of the build)
docker compose -f gateway/docker-compose.yml run --rm launcher-build
```

Broker logs are the audit trail: instance create/restart/recreate, capacity refusals, ready
timeouts, reaps, and dropped manifest entries.

### Continuous delivery for an app

The app repo builds and pushes its own image; the VPS only pulls. Each has an
`.github/workflows/apps-image.yml` of its own that builds the mount prefix in — the prefix is
inlined at build time, so these images are deployment-specific — and pushes two tags,
`:apps-mount`, which moves, and `:apps-mount-<sha>`, which does not.

| app | build arg | trigger |
|---|---|---|
| Resume-Matcher | `NEXT_PUBLIC_BASE_PATH=/a/resume-matcher` | push to `main` |
| TREK | `TREK_BASE_PATH=/a/trek` | push to `main` of the fork (`tomsabala/TREK`) |
| FamilyCFO | `FAMILYCFO_BASE_PATH=/a/familycfo` | push to `main` |

`deploy.sh` reads `apps.json` itself, so an app added there is picked up without editing
anything here. The manifest names `:apps-mount-<sha>`; `:apps-mount` is only what the app
repo's CI moves, and `deploy.sh` refuses it. Getting a new build onto the box:

```bash
# A new app build is a commit here: bump the pinned tag in frontend/src/apps/apps.json to the
# sha the app repo's CI published, then on the VPS:
/srv/apps/gateway/deploy.sh                   # git pull + pull the newly pinned image + converge

# The sha is the app repo's main HEAD, provided its apps-image workflow succeeded for it:
#   ghcr.io/tomsabala/trek:apps-mount-$(git -C <app checkout> rev-parse main)

# Firewall rules live in iptables, which does not survive a reboot:
cat > /etc/cron.d/apps-firewall <<'CRON'
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# m h dom mon dow user command
@reboot root /srv/apps/gateway/firewall.sh >> /var/log/apps-firewall.log 2>&1
CRON
chmod 0644 /etc/cron.d/apps-firewall
```

> There is deliberately no unattended deploy timer. The images these containers run hold
> visitors' bank logins and API keys, and an hourly `docker pull` of a moving tag means a
> compromised app-repo CI reaches this box unreviewed within the hour, with live instances
> recreated within 30 s. A release is a reviewed commit; `deploy.sh` refuses an unpinned image.

If an `/etc/cron.d/apps-deploy` file exists on the box from an earlier setup, delete it.

GHCR packages start **private**. Either make the package public (GitHub → Packages → …  →
Package settings) or `docker login ghcr.io` on the VPS with a read-only PAT — otherwise the
pull fails and instances 503 with "did not start in time".

### Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `503` "at capacity" | `MAX_TOTAL_INSTANCES` or a per-kind cap reached — the broker log names which | raise it *and* the RAM, lower `memoryMb`, or shorten `IDLE_TTL_SECONDS` so idle slots free up sooner |
| `503` "did not start in time" | image missing locally, env file unreadable, crash on boot, or `READY_TIMEOUT_SECONDS` too low for a cold image | the broker log line `could not start <slug> …` names which; then `docker logs` the instance — anonymous instances are removed on timeout, admin and shared ones kept for inspection |
| Broker logs `EACCES … instances/<slug>.<kind>.env` | the env file is not readable by uid 1000 | `chown root:1000 && chmod 640` it, then `docker rm -f apps-<slug>-<key>` — env is baked into a container at create time |
| App loads but its API 404s | image built without the right `basePath` | rebuild with `--build-arg NEXT_PUBLIC_BASE_PATH=/a/<slug>` |
| PDF export renders a login page | `FRONTEND_BASE_URL` escaped to the gateway | the broker sets it to `http://127.0.0.1:<port>/a/<slug>`; do not override it in the instance env file |
| Chromium fails to launch | `CapDrop: ALL` too tight for that image | add `"capAdd": ["SYS_ADMIN"]`. Not needed for Resume-Matcher — verified working with all capabilities dropped |
| Manifest edits ignored | the file was replaced by rename and the mount is a file, not a directory | check `volumes:` mounts `../frontend/src/apps`, not `.../apps.json` |
| Launcher 404s while `/a/*` works | `launcher-build` never ran, so `/srv/launcher` is empty | `docker compose … run --rm launcher-build` |
| Launcher shows an old app list | the build volume predates the last `git pull` | same — rebuild |
| App still serves the old build after a pull | the digest cache has up to 30 s left, or the instance is mid-request | wait, or `docker rm -f` the instance; a `503` "did not start in time" right after a pull usually means the pull failed on auth |
| Boot overlay never fills in, admin inspector has no MEMORY/INSTANCES/COLD START, `/admin/hangar` says status unavailable | Caddy is running a config that predates the `/boot/*` and `/instances` routes, so both fall through to the launcher and answer `200 text/html` | `curl -s -o /dev/null -w '%{http_code} %{content_type}' https://apps.tom-sabala.dev/instances` — anything but `401 text/plain` means stale. `gateway/deploy.sh` reloads and then checks this |
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
