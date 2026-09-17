import { describe, it, expect } from 'vitest';
import {
  HOSTED_APPS,
  HOSTED_ROOT,
  appEntryUrl,
  appHash,
  filterApps,
  isValidSlug,
  parseAppHash,
  resolveApp,
} from '../registry';
import type { HostedApp } from '../registry';

const fixtures: HostedApp[] = [
  { slug: 'snake', name: 'Snake', tagline: 'Canvas arcade classic', tech: ['Canvas', 'TypeScript'], status: 'live' },
  { slug: 'budget-split', name: 'Budget Split', tagline: 'Share expenses offline', tech: ['React'], status: 'wip' },
];

// --- Shipped manifest invariants ---

describe('HOSTED_APPS manifest', () => {
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

  // Vite resolves this glob at transform time, so the on-disk check needs no node APIs.
  const bundlesOnDisk = Object.keys(import.meta.glob('../../../public/hosted/*/index.html'))
    .map(path => path.split('/').at(-2));

  it('ships a bundle on disk for every registered slug', () => {
    for (const app of HOSTED_APPS) {
      expect(bundlesOnDisk, `no bundle directory for ${app.slug}`).toContain(app.slug);
    }
  });

  it('only links out over https', () => {
    for (const app of HOSTED_APPS) {
      if (app.sourceUrl) expect(app.sourceUrl.startsWith('https://'), app.sourceUrl).toBe(true);
    }
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
  it('resolves under the hosted root', () => {
    expect(appEntryUrl(fixtures[0])).toBe(`${HOSTED_ROOT}/snake/index.html`);
  });

  it('never escapes the hosted root for any shipped app', () => {
    for (const app of HOSTED_APPS) {
      const url = appEntryUrl(app);
      expect(url.startsWith(`${HOSTED_ROOT}/`)).toBe(true);
      expect(url).not.toContain('..');
      expect(url).not.toContain('//');
    }
  });
});

// --- Lookup ---

describe('resolveApp', () => {
  it('finds an app by slug', () => {
    expect(resolveApp('budget-split', fixtures)).toBe(fixtures[1]);
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
  });

  it('returns nothing when no app matches', () => {
    expect(filterApps(fixtures, 'kubernetes')).toEqual([]);
  });
});
