/**
 * Registry of self-hosted, client-side apps served from `frontend/public/hosted/<slug>/`
 * and launched at https://apps.tom-sabala.dev.
 *
 * Entry URLs are derived from the slug, never stored, so a bundle can only ever be
 * addressed inside HOSTED_ROOT. See src/apps/README.md for how to add one.
 */

type HostedAppStatus = 'live' | 'wip';

export interface HostedApp {
  /** Directory name under public/hosted and the launcher deep link (`#/<slug>`). */
  slug: string;
  name: string;
  tagline: string;
  tech: string[];
  status: HostedAppStatus;
  sourceUrl?: string;
}

export const HOSTED_ROOT = '/hosted';

/** Lowercase kebab-case: safe as a single URL path segment, no traversal, no escaping. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const HOSTED_APPS: HostedApp[] = [
  {
    slug: 'sandbox-check',
    name: 'Sandbox Check',
    tagline: 'Verifies a hosted bundle gets its assets, storage and input inside the launcher frame',
    tech: ['HTML', 'JavaScript'],
    status: 'live',
  },
];

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function appEntryUrl(app: HostedApp): string {
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
