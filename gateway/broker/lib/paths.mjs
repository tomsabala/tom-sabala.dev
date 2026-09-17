/**
 * Splits `/a/<slug>/<rest>` off an inbound request target.
 *
 * The prefix is deliberately *kept* in `rest`: the app image is built with
 * `basePath=/a/<slug>`, so the container expects to see its own prefix. Nothing here is
 * decoded — a request that tries to smuggle traversal through `%2e%2e` is rejected rather
 * than normalised, because the broker is not the thing that resolves these paths.
 */

import { isValidSlug } from './manifest.mjs';

export const SERVICE_ROOT = '/a';

export function parseServicePath(target) {
  if (typeof target !== 'string' || !target.startsWith(`${SERVICE_ROOT}/`)) return null;

  const [pathname] = target.split('?');
  if (/%2e/i.test(pathname) || /%2f/i.test(pathname) || pathname.includes('\\')) return null;

  const segments = pathname.slice(1).split('/');
  // segments[0] === 'a'; an empty later segment means '//', which no app route needs and
  // which reads differently to different proxies.
  if (segments.slice(1, -1).some(segment => segment.length === 0)) return null;
  if (segments.includes('..') || segments.includes('.')) return null;

  const slug = segments[1];
  if (!isValidSlug(slug)) return null;

  return { slug, target };
}
