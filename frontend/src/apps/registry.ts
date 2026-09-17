/**
 * Registry of apps launched at https://apps.tom-sabala.dev.
 *
 * Two kinds:
 *   - `bundle`  — static client-side build committed to `frontend/public/hosted/<slug>/`,
 *                 served by Vercel and framed at `/hosted/<slug>/index.html`.
 *   - `service` — containerised full-stack app started on demand by the gateway broker
 *                 (one container per visitor session) and framed at `/a/<slug>/`.
 *
 * `apps.json` is the single source of truth: this module imports it, and the broker
 * bind-mounts the very same file. Entry URLs are derived from the validated slug, never
 * stored, so an entry can only ever address its own path. See src/apps/README.md.
 */

import manifestJson from './apps.json';

type HostedAppStatus = 'live' | 'wip';
export type AppKind = 'bundle' | 'service';
/** `admin` apps are absent from the manifest the gateway serves anonymous visitors. */
export type AppAccess = 'public' | 'admin';
/**
 * What one container is shared by.
 *
 * `session` — one per visitor. The only safe mode for an app with no multi-tenancy of its
 *   own, and the expensive one: RAM is multiplied by concurrent visitors.
 * `shared`  — one per app, for everybody, kept warm. Costs the app's memory once no matter
 *   how many people are on it. Only for apps that either store nothing per visitor or have
 *   their own accounts: every visitor sees the same data.
 */
export type ServiceMode = 'session' | 'shared';

interface AppBase {
  /** Launcher deep link (`#/<slug>`); for bundles also the directory under public/hosted. */
  slug: string;
  name: string;
  tagline: string;
  tech: string[];
  status: HostedAppStatus;
  access: AppAccess;
  sourceUrl?: string;
}

export interface BundleApp extends AppBase {
  kind: 'bundle';
}

/**
 * Container settings the broker needs. Only ever populated from the bundled/mounted
 * `apps.json`: the gateway strips these keys before serving `/manifest.json` to a browser,
 * so a parsed service app coming off the wire has `runtime === undefined`.
 */
export interface ServiceRuntime {
  image: string;
  port: number;
  memoryMb: number;
  shmSizeMb: number;
  /** Per-session state directory inside the container (tmpfs for anon, volume for admin). */
  dataPath: string;
  dataTmpfsMb: number;
  readyPath: string;
  capAdd: string[];
}

export interface ServiceApp extends AppBase {
  kind: 'service';
  /** Survives into the browser-facing manifest: the launcher words its overlay from it. */
  mode: ServiceMode;
  runtime?: ServiceRuntime;
}

export type HostedApp = BundleApp | ServiceApp;

/** Unvalidated JSON, asserted once at the parse boundary; every field stays `unknown`. */
type RawEntry = Record<string, unknown>;

export const HOSTED_ROOT = '/hosted';
export const SERVICE_ROOT = '/a';

/** Lowercase kebab-case: safe as a single URL path segment, no traversal, no escaping. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STATUSES: Record<string, true> = { live: true, wip: true };
const ACCESS_LEVELS: Record<string, true> = { public: true, admin: true };

const RUNTIME_KEYS = [
  'image',
  'port',
  'memoryMb',
  'shmSizeMb',
  'dataPath',
  'dataTmpfsMb',
  'readyPath',
  'capAdd',
] as const;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

function drop(reason: string, value: unknown): null {
  console.error(`[apps] dropped manifest entry: ${reason}`, value);
  return null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Integer > 0, or `fallback` when the key is absent; null means "present but unusable". */
function positiveInt(value: unknown, fallback?: number): number | null {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Validates a service entry's container settings. Returns `undefined` when none of the
 * runtime keys are present (the browser-facing manifest), `null` when they are present but
 * wrong — a half-configured service must be dropped, not started with guessed limits.
 */
function parseRuntime(entry: RawEntry): ServiceRuntime | null | undefined {
  if (!RUNTIME_KEYS.some(key => entry[key] !== undefined)) return undefined;

  const capAddRaw = entry.capAdd ?? [];
  const capAdd =
    Array.isArray(capAddRaw) && capAddRaw.every(cap => typeof cap === 'string')
      ? (capAddRaw as string[])
      : null;

  const image = nonEmptyString(entry.image);
  const dataPath = nonEmptyString(entry.dataPath);
  const readyPath = entry.readyPath === undefined ? '/' : nonEmptyString(entry.readyPath);
  const port = positiveInt(entry.port);
  const memoryMb = positiveInt(entry.memoryMb, 1024);
  const shmSizeMb = positiveInt(entry.shmSizeMb, 64);
  const dataTmpfsMb = positiveInt(entry.dataTmpfsMb, 256);

  if (!image || !dataPath || !readyPath || !port || !memoryMb || !shmSizeMb || !dataTmpfsMb || !capAdd) {
    return null;
  }
  if (!dataPath.startsWith('/') || !readyPath.startsWith('/')) return null;

  return { image, port, memoryMb, shmSizeMb, dataPath, dataTmpfsMb, readyPath, capAdd };
}

function parseEntry(raw: unknown): HostedApp | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return drop('entry is not an object', raw);
  }
  const entry = raw as RawEntry;

  const slug = nonEmptyString(entry.slug);
  if (!slug || !isValidSlug(slug)) return drop('unsafe or missing slug', entry.slug);

  const kind = entry.kind;
  if (kind !== 'bundle' && kind !== 'service') return drop(`unknown kind for ${slug}`, kind);

  const name = nonEmptyString(entry.name);
  const tagline = nonEmptyString(entry.tagline);
  if (!name || !tagline) return drop(`missing name or tagline for ${slug}`, entry);

  const techRaw = entry.tech ?? [];
  if (!Array.isArray(techRaw) || !techRaw.every(item => typeof item === 'string')) {
    return drop(`tech must be an array of strings for ${slug}`, entry.tech);
  }
  const tech = techRaw as string[];

  if (typeof entry.status !== 'string' || !STATUSES[entry.status]) {
    return drop(`unknown status for ${slug}`, entry.status);
  }
  if (typeof entry.access !== 'string' || !ACCESS_LEVELS[entry.access]) {
    return drop(`unknown access for ${slug}`, entry.access);
  }
  const status = entry.status as HostedAppStatus;
  const access = entry.access as AppAccess;

  const sourceUrl = entry.sourceUrl === undefined ? undefined : nonEmptyString(entry.sourceUrl);
  if (entry.sourceUrl !== undefined && !sourceUrl?.startsWith('https://')) {
    return drop(`sourceUrl must be https for ${slug}`, entry.sourceUrl);
  }

  const base = { slug, name, tagline, tech, status, access, ...(sourceUrl ? { sourceUrl } : {}) };

  if (kind === 'bundle') return { kind, ...base };

  // Default `session`: per-visitor isolation is the safe answer for an app whose
  // multi-tenancy is unknown. Sharing has to be opted into deliberately.
  const mode = entry.mode === undefined ? 'session' : entry.mode;
  if (mode !== 'session' && mode !== 'shared') return drop(`unknown mode for ${slug}`, entry.mode);

  const runtime = parseRuntime(entry);
  if (runtime === null) return drop(`invalid container settings for ${slug}`, entry);
  return { kind, ...base, mode, ...(runtime ? { runtime } : {}) };
}

/**
 * Parses either form of the manifest (bundled file or the gateway's filtered response).
 * Never throws: bad data must cost only the offending entry, or one typo takes the whole
 * launcher down.
 */
export function parseManifest(raw: unknown): HostedApp[] {
  if (typeof raw !== 'object' || raw === null || !('apps' in raw) || !Array.isArray(raw.apps)) {
    console.error('[apps] manifest has no apps array', raw);
    return [];
  }

  const parsed: HostedApp[] = [];
  const seen = new Set<string>();
  for (const entry of raw.apps) {
    const app = parseEntry(entry);
    if (!app) continue;
    if (seen.has(app.slug)) {
      drop(`duplicate slug ${app.slug}`, entry);
      continue;
    }
    seen.add(app.slug);
    parsed.push(app);
  }
  return parsed;
}

/** Build-time manifest: every app, runtime settings included. */
export const HOSTED_APPS: HostedApp[] = parseManifest(manifestJson);

export function appEntryUrl(app: HostedApp): string {
  if (app.kind === 'service') return `${SERVICE_ROOT}/${app.slug}/`;
  return `${HOSTED_ROOT}/${app.slug}/index.html`;
}

export function appHash(slug: string): string {
  return `#/${slug}`;
}

/** Reads the selected app slug out of `location.hash`; null means "show the launcher". */
export function parseAppHash(hash: string): string | null {
  const withoutQuery = hash.split('?')[0];
  const slug = withoutQuery.replace(/^#/, '').replace(/^\//, '').replace(/\/$/, '');
  return isValidSlug(slug) ? slug : null;
}

export function resolveApp(slug: string, apps: HostedApp[] = HOSTED_APPS): HostedApp | null {
  if (!isValidSlug(slug)) return null;
  return apps.find((app) => app.slug === slug) ?? null;
}

export function filterApps(apps: HostedApp[], query: string): HostedApp[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return apps;
  return apps.filter((app) =>
    [app.slug, app.name, app.tagline, ...app.tech].some((field) => field.toLowerCase().includes(needle))
  );
}
