#!/usr/bin/env bash
# Deploy apps.tom-sabala.dev from the VPS checkout. Run it as root, from anywhere:
#
#   /srv/apps/gateway/deploy.sh                # full deploy
#   /srv/apps/gateway/deploy.sh --images-only  # just pull app images (what cron runs)
#
# The expensive steps are conditional on what `git pull` actually changed, so a run with
# nothing new costs a few seconds. The Caddy reload and the front-door check are not: they
# are cheap, and skipping them is how a correct checkout ends up behind a stale front door.
set -euo pipefail

REPO=$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)
COMPOSE=(docker compose -f "$REPO/gateway/docker-compose.yml")
MANIFEST="$REPO/frontend/src/apps/apps.json"

IMAGES_ONLY=0
SKIP_GIT=0
FORCE=0

for arg in "$@"; do
  case "$arg" in
    --images-only) IMAGES_ONLY=1 ;;
    --no-git)      SKIP_GIT=1 ;;
    # Rebuild the launcher and reload Caddy even when git reports no change — for a first
    # deploy on an empty launcher volume, or after editing a file by hand on the box.
    --force)       FORCE=1 ;;
    -h|--help)
      sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      echo "deploy: unknown option $arg (try --help)" >&2
      exit 2 ;;
  esac
done

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }

# ── Reading the manifest ────────────────────────────────────────────────────────────
#
# One `slug<TAB>mode<TAB>image` line per service app. Deliberately awk and not jq: jq is
# not installed by the bootstrap, and a deploy script that works on one box and dies on
# the next is worse than one that parses the two fields it needs itself.
#
# It tracks brace depth instead of splitting on "}" because an app entry may contain a
# nested object (`credit`), and splitting on the first closing brace tore one entry into
# two half-records: the half holding `image` had no `kind`, so it was skipped, and every
# app silently reported "no image in the manifest". That froze the whole CD path — the
# hourly `--images-only` cron stopped pulling — without failing. Only the entry's own
# keys are collected (chars are kept at depth 2), so a nested object can never supply a
# field: `credit.text` containing the word image is still just text.
manifest_services() {
  awk '
    function field(rec, name,   v) {
      if (match(rec, "\"" name "\"[ \t]*:[ \t]*\"[^\"]*\"")) {
        v = substr(rec, RSTART, RLENGTH)
        sub(/^"[^"]*"[ \t]*:[ \t]*"/, "", v)
        sub(/"$/, "", v)
        return v
      }
      return ""
    }
    function emit(rec,   mode) {
      if (field(rec, "kind") != "service") return
      mode = field(rec, "mode")
      print field(rec, "slug") "\t" (mode == "" ? "session" : mode) "\t" field(rec, "image")
    }
    BEGIN { depth = 0; rec = "" }
    {
      for (i = 1; i <= length($0); i++) {
        c = substr($0, i, 1)
        if (c == "{") { depth++; if (depth == 2) rec = "" }
        else if (c == "}") { depth--; if (depth == 1) emit(rec) }
        else if (depth == 2) rec = rec c
      }
    }
  ' "$MANIFEST"
}

# ── App images ──────────────────────────────────────────────────────────────────────
#
# The broker never pulls; it only starts what is already local. It does compare each
# running container's resolved image id against what the tag points at now, so a pull is
# the whole deploy — instances are recreated on their next request, within the 30 s digest
# cache. Nothing to restart, and no `docker rm -f` needed.
pull_images() {
  local slug mode image before after found=0
  while IFS=$'\t' read -r slug mode image; do
    [ -n "$image" ] || { note "$slug has no image in the manifest — skipped"; continue; }
    found=1
    before=$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)
    docker pull -q "$image" >/dev/null
    after=$(docker image inspect --format '{{.Id}}' "$image")
    if [ "$before" = "$after" ]; then
      note "$image — unchanged"
    else
      note "$image — NEW (${after:7:12}); live instances recreate within 30 s"
    fi
  done < <(manifest_services)
  [ "$found" = 1 ] || note 'no service apps in the manifest'
}

# ── Instance env files ──────────────────────────────────────────────────────────────
# The broker reads gateway/instances/<slug>.<kind>.env and logs `no env file at …` when one
# is missing, which is easy to miss in a log and shows up as an app that behaves oddly
# rather than one that fails. Say it here instead, where somebody is looking.
#
# Readability is checked the same way and for the same reason: the file is bind-mounted
# read-only into a container whose process is uid 1000, so a root-owned `chmod 600` here
# reads fine to whoever wrote it and is EACCES to the broker — a state that only surfaces
# when a visitor asks for the app and gets a 503.
broker_can_read() {
  local bits owner group
  bits=$(stat -c '%a' "$1") || return 1
  owner=$(stat -c '%u' "$1")
  group=$(stat -c '%g' "$1")
  [ "$(( 0${bits} & 0004 ))" -ne 0 ] && return 0                       # other-readable
  [ "$owner" = 1000 ] && [ "$(( 0${bits} & 0400 ))" -ne 0 ] && return 0 # owned by uid 1000
  [ "$group" = 1000 ] && [ "$(( 0${bits} & 0040 ))" -ne 0 ] && return 0 # group 1000
  return 1
}

check_instance_envs() {
  local missing=0 slug mode image f path
  while IFS=$'\t' read -r slug mode image; do
    case "$mode" in
      shared) set -- "$slug.shared.env" ;;
      *)      set -- "$slug.anon.env" "$slug.admin.env" ;;
    esac
    for f in "$@"; do
      path="$REPO/gateway/instances/$f"
      if [ ! -f "$path" ]; then
        note "MISSING gateway/instances/$f — copy the .example and fill it in"
        missing=1
      elif ! broker_can_read "$path"; then
        note "UNREADABLE gateway/instances/$f ($(stat -c '%a %U:%G' "$path")) — the broker runs as uid 1000: chown root:1000 && chmod 640"
        missing=1
      fi
    done
  done < <(manifest_services)
  [ "$missing" = 0 ] && note 'all present and readable'
  return 0
}

# ── The live front door ─────────────────────────────────────────────────────────────
#
# Every container can be healthy and the site still serve the wrong thing: Caddy answers
# from the config it loaded, not from the file on disk, so "the checkout is current" says
# nothing about routing. This asks the running site what it does with the three broker
# routes and reads the answer. The failure it exists to catch is silent — a stale config
# sends /boot/* and /instances to the launcher, which returns 200 text/html, and the only
# visible symptom is an app inspector with no numbers in it.
#
# Probed over the real hostname, pinned to this box, so it exercises TLS and the same
# vhost a visitor hits. Missing curl is a skipped check, not a failed deploy.
verify_routes() {
  local site slug status type failed=0
  if ! command -v curl >/dev/null 2>&1; then
    note 'curl not installed — skipping (install it to have deploys check their own work)'
    return 0
  fi
  site=$(sed -n 's/^APPS_SITE_ADDRESS=//p' "$REPO/gateway/.env" 2>/dev/null | tail -1)
  if [ -z "$site" ]; then
    note 'no APPS_SITE_ADDRESS in gateway/.env — skipping'
    return 0
  fi
  slug=$(manifest_services | head -1 | cut -f1)

  probe() { # path, expected status, expected content-type fragment
    local path=$1 want=$2 wanttype=$3 out
    out=$(curl -sS -o /dev/null --max-time 10 --resolve "$site:443:127.0.0.1" \
      -w '%{http_code} %{content_type}' "https://$site$path" 2>/dev/null) || {
      note "FAIL $path — no answer from the site"
      failed=1
      return 0
    }
    status=${out%% *}
    type=${out#* }
    case "$type" in
      *"$wanttype"*) ;;
      *)
        note "FAIL $path — $status $type (expected $wanttype; Caddy is serving an old config: reload it)"
        failed=1
        return 0 ;;
    esac
    [ "$status" = "$want" ] || { note "FAIL $path — $status (expected $want)"; failed=1; return 0; }
    note "ok   $path — $status $type"
  }

  probe /manifest.json 200 json
  [ -n "$slug" ] && probe "/boot/$slug" 200 json
  # 401 is the broker refusing an unauthenticated status read — i.e. the broker answered.
  probe /instances 401 text/plain

  [ "$failed" = 0 ] || return 1
}

if [ "$IMAGES_ONLY" = 1 ]; then
  pull_images
  exit 0
fi

cd "$REPO"

changed=''
if [ "$SKIP_GIT" = 1 ]; then
  step 'Skipping git pull (--no-git)'
else
  step 'Updating the checkout'
  before_head=$(git rev-parse HEAD)
  git pull --ff-only
  after_head=$(git rev-parse HEAD)
  if [ "$before_head" = "$after_head" ]; then
    note 'already up to date'
  else
    changed=$(git diff --name-only "$before_head" "$after_head")
    note "$(printf '%s\n' "$changed" | wc -l) file(s) changed"
  fi
fi

touched() { [ "$FORCE" = 1 ] && return 0; printf '%s\n' "$changed" | grep -q "$1"; }

step 'Pulling app images'
pull_images

step 'Checking instance env files'
check_instance_envs

# The manifest lives in frontend/, and the broker bind-mounts that directory read-only and
# re-reads it by itself within ~5 s. It is the *launcher's* bundled fallback list that needs
# the rebuild — without it the grid keeps showing the old app set.
if touched '^frontend/'; then
  step 'Rebuilding the launcher (frontend changed)'
  "${COMPOSE[@]}" run --rm launcher-build
else
  note 'launcher build not needed'
fi

# Reload Caddy on every deploy. It is cheap (a graceful in-process config swap, no dropped
# connections, no cert work) and the alternative has already cost us: the Caddyfile gained
# /boot/* and /instances, the checkout was updated, the launcher was rebuilt by hand — and
# the front door kept running its old config for weeks, answering both routes with the
# launcher's HTML. Caddy holds its config in memory; a correct file on disk proves nothing.
if [ -n "$("${COMPOSE[@]}" ps -q caddy 2>/dev/null)" ]; then
  step 'Reloading Caddy'
  "${COMPOSE[@]}" exec caddy caddy reload --config /etc/caddy/Caddyfile
else
  note 'caddy not running — `up -d` below starts it with the current config'
fi

step 'Converging the stack'
# --build only when the broker's own source changed: it is the one service built from this
# repo, and an unconditional --build would rebuild it on every deploy.
if touched '^gateway/broker/'; then
  "${COMPOSE[@]}" up -d --build broker
fi
"${COMPOSE[@]}" up -d

# Reapplied on every deploy, not just at boot: the rules name the instances subnet, and a
# `down`/`up` of the stack recreates the bridge the rules filter on.
step 'Applying instance firewall rules'
"$REPO/gateway/firewall.sh"

step 'State'
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
docker ps --filter label=dev.tom-sabala.apps.slug \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

# Last, and fatal: a deploy that leaves the front door answering the wrong thing has not
# deployed. The state above is printed first so a failure here is diagnosable from the
# same output.
step 'Verifying the front door'
verify_routes || {
  printf '\n\033[1mFAILED\033[0m — the stack is up but the site is not routing to the broker.\n'
  printf '  Try: docker compose -f %s/gateway/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile\n' "$REPO"
  exit 1
}

printf '\n\033[1mdone\033[0m — https://apps.tom-sabala.dev/\n'
