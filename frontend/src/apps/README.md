# Apps

`apps.json` is the single manifest behind https://apps.tom-sabala.dev. This module imports it
(`registry.ts`), and the gateway broker bind-mounts the very same file. Two kinds of app:

| `kind` | Served from | Framed at | Needs the gateway? |
|---|---|---|---|
| `bundle` | `frontend/public/hosted/<slug>/`, a static file in the build | `/hosted/<slug>/index.html` | to be published on the subdomain, yes |
| `service` | a container the broker starts, one per visitor (`mode: session`) or one for everybody (`mode: shared`) | `/a/<slug>/` | yes |

`apps.tom-sabala.dev` is served entirely by the gateway VPS (`gateway/`), which serves the
frontend build from disk. Vercel still builds and deploys the same output for
`tom-sabala.dev`, but it is not in the apps subdomain's request path, so publishing a bundle
there is `git pull` plus one build command on the VPS — see `gateway/README.md`.

This file lives outside `public/` on purpose — everything under `public/` is a public asset.

## Add a bundle (client-side only)

1. **Build it with a matching base path** so its asset URLs resolve inside `/hosted/<slug>/`:

   - Vite: `vite build --base=/hosted/<slug>/`
   - CRA / webpack: set `"homepage": "/hosted/<slug>/"` or `publicPath`
   - Plain HTML: use relative paths (`./app.js`), nothing to configure

2. **Copy the build output** into a directory named exactly like the slug:

   ```bash
   mkdir -p frontend/public/hosted/my-app
   cp -r ../my-project/dist/* frontend/public/hosted/my-app/
   ```

   `index.html` must sit at the root of that directory.

3. **Register it** in `frontend/src/apps/apps.json`:

   ```json
   {
     "kind": "bundle",
     "slug": "my-app",
     "name": "My App",
     "tagline": "One line about what it does",
     "tech": ["React", "WASM"],
     "status": "live",
     "access": "public",
     "sourceUrl": "https://github.com/tomsabalu/my-app"
   }
   ```

   `status: "wip"` shows a work-in-progress badge. `access: "admin"` hides the app from
   anonymous visitors entirely (enforced by the gateway, not here). `sourceUrl` is optional
   and must be https.

4. `npm run test` (registry invariants) and `npm run build`, then commit. On the VPS:
   `git pull && docker compose -f gateway/docker-compose.yml run --rm launcher-build`.

## Add a service (its own server)

Needs the gateway — see `gateway/README.md` for the image requirements, the extra manifest
fields (`mode`, `image`, `port`, `memoryMb`, `dataPath`, …) and the per-instance env files.
Nothing in this directory changes except the `apps.json` entry.

`mode` is the decision that matters: `session` gives every visitor their own container (the
only safe answer for an app with no multi-tenancy, and the one that multiplies RAM by
concurrent visitors), `shared` runs one warm container for everybody (cheap, but everyone
sees the same data — say so in the tagline if it stores anything).

## Notes

- Slugs are validated as a single lowercase-kebab path segment; entry URLs are derived from
  the slug, so an entry can never point outside its own root.
- `parseManifest` drops a bad entry and logs it rather than throwing — one typo must not take
  the launcher down for every other app.
- The launcher fetches `/manifest.json` from the gateway at runtime; the bundled `apps.json`
  is the fallback when there is no gateway in front — plain `npm run dev`, or the copy of
  `apps.html` that Vercel still serves at `tom-sabala.dev` — filtered to `access: "public"`.
- The iframe `sandbox` attribute is **not** a boundary here: combined with `allow-same-origin`
  (needed for `localStorage`/IndexedDB) a bundle can reach `parent.document` and therefore owns
  the whole `apps.tom-sabala.dev` origin, launcher included. Keep this directory first-party
  only; never drop in a third-party or generated bundle.
- What *is* enforced: `vercel.json` redirects `/hosted/**` and `/apps.html` off
  `tom-sabala.dev`/`www`, so bundles only ever execute on the apps subdomain — an origin with
  no admin cookies and no entry in the API's `CORS_ORIGINS`. Do not add `apps.tom-sabala.dev`
  to `CORS_ORIGINS`. For services, the real boundary is the per-session container.
- Hiding the `apps` tab in Settings only removes the sidebar link. `apps.tom-sabala.dev` and
  `/hosted/**` are static files with no server-side visibility check — treat anything committed
  here as public. `access: "admin"` is the only thing that actually hides an app, and only for
  service/bundle entries listed through the gateway's manifest, never for the static files.
- Bundles are committed to git. Keep them small (no `node_modules`, no source maps, no
  multi-MB media) — everything here is downloaded by the deploy.
- `sandbox-check/` is a diagnostic app: open it after adding a new bundle to confirm scripts,
  relative assets and storage all work in the frame. Safe to delete.
