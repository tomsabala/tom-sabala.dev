/**
 * Reads `frontend/src/apps/apps.json` — the same file the launcher imports — and keeps it
 * hot. Validation mirrors `parseManifest` in `frontend/src/apps/registry.ts`; an entry that
 * fails is logged and skipped so one typo cannot take the whole gateway down.
 *
 * A `service` entry must carry complete container settings here: the broker cannot start
 * what it cannot describe, and advertising an app it would fail to launch is worse than
 * hiding it.
 */

import { readFile } from 'node:fs/promises';
import { watchFile } from 'node:fs';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = { live: true, wip: true };
const ACCESS_LEVELS = { public: true, admin: true };

/** Container settings: internal only. Never sent to a browser. */
const RUNTIME_KEYS = [
  'image',
  'port',
  'memoryMb',
  'shmSizeMb',
  'dataPath',
  'dataTmpfsMb',
  'readyPath',
  'capAdd',
];

export function isValidSlug(value) {
  return typeof value === 'string' && SLUG_PATTERN.test(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function positiveInt(value, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function parseRuntime(entry, slug, dropped) {
  const capAddRaw = entry.capAdd ?? [];
  const capAdd =
    Array.isArray(capAddRaw) && capAddRaw.every(cap => typeof cap === 'string') ? capAddRaw : null;

  const image = nonEmptyString(entry.image);
  const dataPath = nonEmptyString(entry.dataPath);
  const readyPath = entry.readyPath === undefined ? '/' : nonEmptyString(entry.readyPath);
  const port = positiveInt(entry.port);
  const memoryMb = positiveInt(entry.memoryMb, 1024);
  const shmSizeMb = positiveInt(entry.shmSizeMb, 64);
  const dataTmpfsMb = positiveInt(entry.dataTmpfsMb, 256);

  if (!image || !port || !dataPath || !readyPath || !memoryMb || !shmSizeMb || !dataTmpfsMb || !capAdd) {
    dropped.push(`${slug}: incomplete container settings (needs image, port, dataPath)`);
    return null;
  }
  if (!dataPath.startsWith('/') || !readyPath.startsWith('/')) {
    dropped.push(`${slug}: dataPath and readyPath must be absolute`);
    return null;
  }

  return { image, port, memoryMb, shmSizeMb, dataPath, dataTmpfsMb, readyPath, capAdd };
}

function parseEntry(entry, dropped) {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    dropped.push('entry is not an object');
    return null;
  }

  const slug = nonEmptyString(entry.slug);
  if (!slug || !isValidSlug(slug)) {
    dropped.push(`unsafe or missing slug: ${JSON.stringify(entry.slug)}`);
    return null;
  }
  if (entry.kind !== 'bundle' && entry.kind !== 'service') {
    dropped.push(`${slug}: unknown kind ${JSON.stringify(entry.kind)}`);
    return null;
  }

  const name = nonEmptyString(entry.name);
  const tagline = nonEmptyString(entry.tagline);
  if (!name || !tagline) {
    dropped.push(`${slug}: missing name or tagline`);
    return null;
  }

  const tech = entry.tech ?? [];
  if (!Array.isArray(tech) || !tech.every(item => typeof item === 'string')) {
    dropped.push(`${slug}: tech must be an array of strings`);
    return null;
  }
  if (!STATUSES[entry.status]) {
    dropped.push(`${slug}: unknown status ${JSON.stringify(entry.status)}`);
    return null;
  }
  if (!ACCESS_LEVELS[entry.access]) {
    dropped.push(`${slug}: unknown access ${JSON.stringify(entry.access)}`);
    return null;
  }
  if (entry.sourceUrl !== undefined && !String(entry.sourceUrl).startsWith('https://')) {
    dropped.push(`${slug}: sourceUrl must be https`);
    return null;
  }

  const app = {
    kind: entry.kind,
    slug,
    name,
    tagline,
    tech,
    status: entry.status,
    access: entry.access,
  };
  if (entry.sourceUrl !== undefined) app.sourceUrl = entry.sourceUrl;

  if (entry.kind === 'bundle') return app;

  // `session` (one container per visitor) is the default because it is the safe one; a
  // `shared` app is one warm container for everybody and must be opted into.
  const mode = entry.mode === undefined ? 'session' : entry.mode;
  if (mode !== 'session' && mode !== 'shared') {
    dropped.push(`${slug}: unknown mode ${JSON.stringify(entry.mode)}`);
    return null;
  }

  const runtime = parseRuntime(entry, slug, dropped);
  if (!runtime) return null;
  return { ...app, mode, runtime };
}

export function parseManifest(raw) {
  const dropped = [];
  const entries = typeof raw === 'object' && raw !== null && Array.isArray(raw.apps) ? raw.apps : null;
  if (!entries) return { apps: [], dropped: ['manifest has no apps array'] };

  const apps = [];
  const seen = new Set();
  for (const entry of entries) {
    const app = parseEntry(entry, dropped);
    if (!app) continue;
    if (seen.has(app.slug)) {
      dropped.push(`${app.slug}: duplicate slug`);
      continue;
    }
    seen.add(app.slug);
    apps.push(app);
  }
  return { apps, dropped };
}

/**
 * The browser-facing view. Admin-only apps are absent for anonymous viewers — not marked
 * locked, absent, so their names never reach a client that may not open them. Container
 * settings are stripped: they name internal images and are of no use to a browser.
 */
export function publicManifest(apps, admin) {
  return {
    admin,
    apps: apps
      .filter(app => app.access === 'public' || admin)
      .map(app => {
        const wire = {};
        for (const [key, value] of Object.entries(app)) {
          if (key === 'runtime' || RUNTIME_KEYS.includes(key)) continue;
          wire[key] = value;
        }
        return wire;
      }),
  };
}

/**
 * Loads the manifest and re-reads it whenever the file changes, so adding an app is a
 * commit plus a `docker compose restart`-free edit of the bind-mounted file.
 */
export async function createManifestStore({ path, log }) {
  let apps = [];

  const reload = async () => {
    try {
      const parsed = parseManifest(JSON.parse(await readFile(path, 'utf8')));
      for (const reason of parsed.dropped) log.warn(`manifest entry dropped — ${reason}`);
      apps = parsed.apps;
      log.info(`manifest loaded: ${apps.length} app(s) from ${path}`);
    } catch (error) {
      // Keep serving the last good copy: a half-written file must not empty the launcher.
      log.error(`manifest reload failed, keeping ${apps.length} app(s): ${error.message}`);
    }
  };

  await reload();

  // watchFile (stat polling) rather than fs.watch: a bind-mounted file replaced by an
  // editor's rename is missed by inotify inside the container.
  watchFile(path, { interval: 5000 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) void reload();
  });

  return {
    all: () => apps,
    service: slug => apps.find(app => app.slug === slug && app.kind === 'service') ?? null,
  };
}
