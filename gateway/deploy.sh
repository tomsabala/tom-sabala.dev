#!/usr/bin/env bash
# Deploy apps.tom-sabala.dev from the VPS checkout. Run it as root, from anywhere:
#
#   /srv/apps/gateway/deploy.sh                # full deploy
#   /srv/apps/gateway/deploy.sh --images-only  # just pull app images (what cron runs)
#
# The expensive steps are conditional on what `git pull` actually changed, so a run with
# nothing new costs a few seconds and touches nothing. Everything here is idempotent.
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
# the next is worse than one that parses the two fields it needs itself. RS="}" splits the
# pretty-printed manifest into one record per object, which is all the structure this needs.
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
    BEGIN { RS = "}" }
    {
      if (field($0, "kind") != "service") next
      mode = field($0, "mode")
      print field($0, "slug") "\t" (mode == "" ? "session" : mode) "\t" field($0, "image")
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
#
# The broker reads gateway/instances/<slug>.<kind>.env and logs `no env file at …` when one
# is missing, which is easy to miss in a log and shows up as an app that behaves oddly
# rather than one that fails. Say it here instead, where somebody is looking.
check_instance_envs() {
  local missing=0 slug mode image f
  while IFS=$'\t' read -r slug mode image; do
    case "$mode" in
      shared) set -- "$slug.shared.env" ;;
      *)      set -- "$slug.anon.env" "$slug.admin.env" ;;
    esac
    for f in "$@"; do
      if [ ! -f "$REPO/gateway/instances/$f" ]; then
        note "MISSING gateway/instances/$f — copy the .example and fill it in"
        missing=1
      fi
    done
  done < <(manifest_services)
  [ "$missing" = 0 ] && note 'all present'
  return 0
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

# A Caddyfile change needs a reload; the file is bind-mounted, so there is nothing to
# rebuild and no reason to restart the container (a restart drops in-flight requests and
# re-reads the cert store for nothing).
if touched '^gateway/\(Caddyfile\|caddy/\)'; then
  if [ -n "$("${COMPOSE[@]}" ps -q caddy 2>/dev/null)" ]; then
    step 'Reloading Caddy (routing changed)'
    "${COMPOSE[@]}" exec caddy caddy reload --config /etc/caddy/Caddyfile
  else
    note 'caddy not running — `up -d` below starts it with the new config'
  fi
else
  note 'caddy reload not needed'
fi

step 'Converging the stack'
# --build only when the broker's own source changed: it is the one service built from this
# repo, and an unconditional --build would rebuild it on every deploy.
if touched '^gateway/broker/'; then
  "${COMPOSE[@]}" up -d --build broker
fi
"${COMPOSE[@]}" up -d

step 'State'
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}'
docker ps --filter label=dev.tom-sabala.apps.slug \
  --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'

printf '\n\033[1mdone\033[0m — https://apps.tom-sabala.dev/\n'
