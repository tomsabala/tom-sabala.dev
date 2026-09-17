# Hosted apps

Each subdirectory of `frontend/public/hosted/` is one self-contained, client-side app served
verbatim by Vercel at `https://apps.tom-sabala.dev/hosted/<slug>/index.html` and launched in an
iframe by `src/apps/AppsLauncher.tsx`. This file lives outside `public/` on purpose —
everything under `public/` is deployed as a public asset.

No backend, no upload endpoint, no extra deployment: the bundles ride along with the normal
frontend deploy. Apps that need their own server (Flask/Express/etc.) cannot be hosted this
way — only builds that run entirely in the browser (SPA, canvas, WASM, Pyodide).

## Add an app

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

3. **Register it** in `frontend/src/apps/registry.ts`:

   ```ts
   {
     slug: 'my-app',            // lowercase kebab-case, must equal the directory name
     name: 'My App',
     tagline: 'One line about what it does',
     tech: ['React', 'WASM'],
     status: 'live',            // or 'wip' to show a work-in-progress badge
     sourceUrl: 'https://github.com/tomsabalu/my-app',  // optional
   }
   ```

4. `npm run test` (registry invariants) and `npm run build`, then commit. Vercel deploys it.

## Notes

- Slugs are validated as a single lowercase-kebab path segment; entry URLs are derived from
  the slug, so a registry entry can never point outside this directory.
- The iframe `sandbox` attribute is **not** a boundary here: combined with `allow-same-origin`
  (needed for `localStorage`/IndexedDB) a bundle can reach `parent.document` and therefore owns
  the whole `apps.tom-sabala.dev` origin, launcher included. Keep this directory first-party
  only; never drop in a third-party or generated bundle.
- What *is* enforced: `vercel.json` redirects `/hosted/**` and `/apps.html` off
  `tom-sabala.dev`/`www`, so bundles only ever execute on the apps subdomain — an origin with
  no admin cookies and no entry in the API's `CORS_ORIGINS`. Do not add `apps.tom-sabala.dev`
  to `CORS_ORIGINS`.
- Hiding the `apps` tab in Settings only removes the sidebar link. `apps.tom-sabala.dev` and
  `/hosted/**` are static files with no server-side visibility check — treat anything committed
  here as public.
- Bundles are committed to git. Keep them small (no `node_modules`, no source maps, no
  multi-MB media) — everything here is downloaded by the deploy.
- `sandbox-check/` is a diagnostic app: open it after adding a new bundle to confirm scripts,
  relative assets and storage all work in the frame. Safe to delete.
