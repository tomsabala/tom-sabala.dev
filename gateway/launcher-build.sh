#!/bin/sh
# Builds the frontend into the volume Caddy serves, from a read-only copy of the checkout.
#
# Nothing here may write into /src: `npm ci` deletes node_modules, which on a bind-mounted
# checkout means it replaces the directory with a root-owned one and breaks the developer's
# own `npm run dev`. So the sources are copied into a workspace volume first, and /src is
# mounted read-only to make that a hard guarantee rather than a convention.
set -eu

echo "[launcher-build] staging sources"
# Everything except the two directories the build owns; node_modules stays in the workspace
# volume so npm has something to validate against, and dist is never used (see --outDir).
find /build -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C /src -cf - --exclude=./node_modules --exclude=./dist . | tar -C /build -xf -

cd /build
echo "[launcher-build] installing dependencies"
npm ci --no-audit --no-fund

echo "[launcher-build] building into /srv/launcher"
npm run build -- --outDir /srv/launcher --emptyOutDir

echo "[launcher-build] done:"
ls /srv/launcher
