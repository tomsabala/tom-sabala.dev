import { describe, it, expect, vi } from 'vitest';
import {
  HOSTED_APPS,
  HOSTED_ROOT,
  SERVICE_ROOT,
  appEntryUrl,
  appHash,
  filterApps,
  isValidSlug,
  parseAppHash,
  parseManifest,
  resolveApp,
} from '../registry';
import type { HostedApp } from '../registry';
import manifestJson from '../apps.json';

const fixtures: HostedApp[] = [
  { kind: 'bundle', slug: 'snake', name: 'Snake', tagline: 'Canvas arcade classic', tech: ['Canvas', 'TypeScript'], status: 'live', access: 'public' },
  { kind: 'bundle', slug: 'budget-split', name: 'Budget Split', tagline: 'Share expenses offline', tech: ['React'], status: 'wip', access: 'public' },
  {
    kind: 'service',
    slug: 'notes-api',
    name: 'Notes API',
    tagline: 'Server-rendered notebook with a Postgres backend',
    tech: ['FastAPI'],
    status: 'live',
    access: 'admin',
    runtime: {
      image: 'ghcr.io/example/notes:latest',
      port: 8080,
      memoryMb: 512,
      shmSizeMb: 64,
      dataPath: '/data',
      dataTmpfsMb: 128,
      readyPath: '/',
      capAdd: [],
    },
  },
];

/** Silences the intentional console.error from a drop so the run stays readable. */
function parseQuietly(raw: unknown): HostedApp[] {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    return parseManifest(raw);
  } finally {
    spy.mockRestore();
  }
}

// --- Shipped manifest invariants ---

describe('HOSTED_APPS manifest', () => {
  it('parses every shipped entry without a drop', () => {
    expect(HOSTED_APPS.length).toBe(manifestJson.apps.length);
  });

  it('uses unique slugs', () => {
    const slugs = HOSTED_APPS.map((app) => app.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only uses slugs that are safe as a single path segment', () => {
    for (const app of HOSTED_APPS) {
      expect(isValidSlug(app.slug), `${app.slug} is not a safe slug`).toBe(true);
    }
  });

  it('gives every app a name and a tagline', () => {
    for (const app of HOSTED_APPS) {
      expect(app.name.trim().length).toBeGreaterThan(0);
      expect(app.tagline.trim().length).toBeGreaterThan(0);
    }
  });

  it('restricts access to the two known levels', () => {
    for (const app of HOSTED_APPS) {
      expect(['public', 'admin'], app.slug).toContain(app.access);
    }
  });

  // Vite resolves this glob at transform time, so the on-disk check needs no node APIs.
  const bundlesOnDisk = Object.keys(import.meta.glob('../../../public/hosted/*/index.html'))
    .map(path => path.split('/').at(-2));

  it('ships a bundle on disk for every registered bundle slug', () => {
    for (const app of HOSTED_APPS) {
      if (app.kind !== 'bundle') continue;
      expect(bundlesOnDisk, `no bundle directory for ${app.slug}`).toContain(app.slug);
    }
  });

  it('gives every service the container settings the broker needs', () => {
    for (const app of HOSTED_APPS) {
      if (app.kind !== 'service') continue;
      expect(app.runtime, `${app.slug} has no runtime block`).toBeDefined();
      expect(app.runtime?.image.length, app.slug).toBeGreaterThan(0);
      expect(app.runtime?.port, app.slug).toBeGreaterThan(0);
      expect(app.runtime?.memoryMb, app.slug).toBeGreaterThan(0);
      expect(app.runtime?.dataPath.startsWith('/'), app.slug).toBe(true);
    }
  });

  it('only links out over https', () => {
    for (const app of HOSTED_APPS) {
      if (app.sourceUrl) expect(app.sourceUrl.startsWith('https://'), app.sourceUrl).toBe(true);
    }
  });
});

// --- Manifest parsing ---

describe('parseManifest', () => {
  const service = {
    kind: 'service',
    slug: 'svc',
    name: 'Svc',
    tagline: 'A service',
    tech: [],
    status: 'live',
    access: 'public',
    image: 'ghcr.io/example/svc:1',
    port: 3000,
    dataPath: '/app/data',
  };

  it('accepts the browser-facing form with the runtime fields stripped', () => {
    const { image, port, dataPath, ...stripped } = service;
    void image;
    void port;
    void dataPath;
    const [app] = parseManifest({ apps: [stripped] });
    expect(app.kind).toBe('service');
    expect(app.kind === 'service' && app.runtime).toBeUndefined();
  });

  it('defaults the optional container limits', () => {
    const [app] = parseManifest({ apps: [service] });
    expect(app.kind === 'service' && app.runtime).toMatchObject({
      memoryMb: 1024,
      shmSizeMb: 64,
      dataTmpfsMb: 256,
      readyPath: '/',
      capAdd: [],
    });
  });

  it('drops a service that names no image', () => {
    const { image, ...noImage } = service;
    void image;
    expect(parseQuietly({ apps: [noImage] })).toEqual([]);
  });

  it('drops a service whose port is not a positive integer', () => {
    expect(parseQuietly({ apps: [{ ...service, port: 0 }] })).toEqual([]);
    expect(parseQuietly({ apps: [{ ...service, port: '3000' }] })).toEqual([]);
  });

  it('drops an unsafe slug rather than trusting it in a URL', () => {
    expect(parseQuietly({ apps: [{ ...service, slug: 'Svc' }] })).toEqual([]);
    expect(parseQuietly({ apps: [{ ...service, slug: '../etc' }] })).toEqual([]);
  });

  it('keeps the first of a duplicated slug and drops the rest', () => {
    const apps = parseQuietly({ apps: [service, { ...service, name: 'Impostor' }] });
    expect(apps.map(app => app.name)).toEqual(['Svc']);
  });

  it('drops unknown kinds, statuses and access levels', () => {
    expect(parseQuietly({ apps: [{ ...service, kind: 'lambda' }] })).toEqual([]);
    expect(parseQuietly({ apps: [{ ...service, status: 'soon' }] })).toEqual([]);
    expect(parseQuietly({ apps: [{ ...service, access: 'everyone' }] })).toEqual([]);
  });

  it('drops a non-https sourceUrl', () => {
    expect(parseQuietly({ apps: [{ ...service, sourceUrl: 'http://example.test' }] })).toEqual([]);
  });

  it('keeps the valid entries around a broken one', () => {
    const apps = parseQuietly({ apps: [{ kind: 'nope' }, service] });
    expect(apps.map(app => app.slug)).toEqual(['svc']);
  });

  it('returns nothing instead of throwing on junk', () => {
    expect(parseQuietly(null)).toEqual([]);
    expect(parseQuietly({})).toEqual([]);
    expect(parseQuietly({ apps: 'nope' })).toEqual([]);
  });
});

// --- Slug validation ---

describe('isValidSlug', () => {
  it('accepts lowercase kebab-case', () => {
    expect(isValidSlug('snake')).toBe(true);
    expect(isValidSlug('budget-split')).toBe(true);
    expect(isValidSlug('wasm-2048')).toBe(true);
  });

  it('rejects traversal, separators and protocol-relative targets', () => {
    expect(isValidSlug('..')).toBe(false);
    expect(isValidSlug('../etc')).toBe(false);
    expect(isValidSlug('a/b')).toBe(false);
    expect(isValidSlug('a\\b')).toBe(false);
    expect(isValidSlug('%2e%2e')).toBe(false);
    expect(isValidSlug('//evil.test')).toBe(false);
  });

  it('rejects empty, uppercase and edge-dashed slugs', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('Snake')).toBe(false);
    expect(isValidSlug('-snake')).toBe(false);
    expect(isValidSlug('snake-')).toBe(false);
    expect(isValidSlug('snake--eyes')).toBe(false);
  });
});

// --- Entry URLs ---

describe('appEntryUrl', () => {
  it('resolves a bundle under the hosted root', () => {
    expect(appEntryUrl(fixtures[0])).toBe(`${HOSTED_ROOT}/snake/index.html`);
  });

  it('resolves a service under the gateway root', () => {
    expect(appEntryUrl(fixtures[2])).toBe(`${SERVICE_ROOT}/notes-api/`);
  });

  it('never escapes its root for any shipped app', () => {
    for (const app of HOSTED_APPS) {
      const url = appEntryUrl(app);
      const root = app.kind === 'service' ? SERVICE_ROOT : HOSTED_ROOT;
      expect(url.startsWith(`${root}/`)).toBe(true);
      expect(url).not.toContain('..');
      expect(url.slice(1)).not.toContain('//');
    }
  });
});

// --- Lookup ---

describe('resolveApp', () => {
  it('finds an app by slug', () => {
    expect(resolveApp('budget-split', fixtures)).toBe(fixtures[1]);
  });

  it('finds a service app by slug', () => {
    expect(resolveApp('notes-api', fixtures)).toBe(fixtures[2]);
  });

  it('returns null for unknown slugs', () => {
    expect(resolveApp('nope', fixtures)).toBeNull();
  });

  it('returns null for traversal attempts instead of matching by prefix', () => {
    expect(resolveApp('../snake', fixtures)).toBeNull();
    expect(resolveApp('snake/../..', fixtures)).toBeNull();
  });

  it('defaults to the shipped manifest', () => {
    const first = HOSTED_APPS[0];
    expect(resolveApp(first.slug)).toBe(first);
  });
});

// --- Hash routing ---

describe('parseAppHash', () => {
  it('extracts the slug', () => {
    expect(parseAppHash('#/snake')).toBe('snake');
    expect(parseAppHash('#/budget-split/')).toBe('budget-split');
    // unregistered but well-formed: the launcher's "No app called X" banner depends on this
    expect(parseAppHash('#/not-installed')).toBe('not-installed');
  });

  it('treats the launcher index as no selection', () => {
    expect(parseAppHash('')).toBeNull();
    expect(parseAppHash('#')).toBeNull();
    expect(parseAppHash('#/')).toBeNull();
  });

  it('ignores a query string appended by the browser', () => {
    expect(parseAppHash('#/snake?utm=x')).toBe('snake');
  });

  it('rejects unsafe slugs rather than passing them through', () => {
    expect(parseAppHash('#/../secrets')).toBeNull();
    expect(parseAppHash('#//evil.test')).toBeNull();
    expect(parseAppHash('#/%2e%2e/')).toBeNull();
  });

  it('round-trips with appHash', () => {
    expect(parseAppHash(appHash('snake'))).toBe('snake');
  });
});

// --- Search ---

describe('filterApps', () => {
  it('returns every app for a blank query', () => {
    expect(filterApps(fixtures, '   ')).toEqual(fixtures);
  });

  it('matches name, tagline, tech and slug case-insensitively', () => {
    expect(filterApps(fixtures, 'SNAKE')).toEqual([fixtures[0]]);
    expect(filterApps(fixtures, 'offline')).toEqual([fixtures[1]]);
    expect(filterApps(fixtures, 'canvas')).toEqual([fixtures[0]]);
    expect(filterApps(fixtures, 'budget-split')).toEqual([fixtures[1]]);
    expect(filterApps(fixtures, 'fastapi')).toEqual([fixtures[2]]);
  });

  it('returns nothing when no app matches', () => {
    expect(filterApps(fixtures, 'kubernetes')).toEqual([]);
  });
});
