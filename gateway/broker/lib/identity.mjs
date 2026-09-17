/**
 * Who is asking, and which instance is theirs.
 *
 * Identity comes from one place only: a subrequest to oauth2-proxy's /oauth2/auth endpoint,
 * forwarding nothing but the inbound Cookie header. Inbound `X-Auth-Request-*` headers are
 * attacker-controlled and are deleted before anything reads them (see server.mjs).
 */

import { createHash } from 'node:crypto';

export const LABEL_PREFIX = 'dev.tom-sabala.apps';
export const LABELS = {
  slug: `${LABEL_PREFIX}.slug`,
  key: `${LABEL_PREFIX}.key`,
  kind: `${LABEL_PREFIX}.kind`,
  image: `${LABEL_PREFIX}.image`,
};

export const SHARED_KEY = 'shared';

/**
 * Instance key: the identity an instance belongs to, hashed so a container name never
 * carries an email address or a live session id.
 *
 * A `shared` app has one instance for everybody, so the key is a constant — that is the
 * whole point: its memory cost does not scale with visitors.
 * Admins key on their email, so every browser and every new session lands on the same
 * persistent instance. Anonymous visitors key on the session cookie, so a cleared cookie is
 * a clean slate.
 */
export function instanceKey({ mode, admin, email, sessionId }) {
  if (mode === 'shared') return SHARED_KEY;
  if (admin) {
    if (!email) throw new Error('admin identity without an email');
    return `admin-${createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16)}`;
  }
  if (!sessionId) throw new Error('anonymous identity without a session id');
  return `anon-${createHash('sha256').update(sessionId).digest('hex').slice(0, 16)}`;
}

export function keyKind(key) {
  if (key === SHARED_KEY) return 'shared';
  return key.startsWith('admin-') ? 'admin' : 'anon';
}

export function containerName(slug, key) {
  return `apps-${slug}-${key}`;
}

export function volumeName(slug, key) {
  return `apps-${slug}-${key}`;
}

/**
 * Asks oauth2-proxy whether this request carries an admin session, with a short-lived cache:
 * one framed page load fans out into dozens of asset requests and each one needs the verdict
 * to pick an instance.
 */
export function createIdentityResolver({ verifyUrl, ttlMs, log, fetchImpl = fetch }) {
  const cache = new Map();
  const MAX_ENTRIES = 512;

  return async function resolve(cookieHeader) {
    const key = createHash('sha256').update(cookieHeader ?? '').digest('base64url');
    const hit = cache.get(key);
    const now = Date.now();
    if (hit && hit.expires > now) return hit.value;

    let value = { admin: false, email: null };
    try {
      const response = await fetchImpl(verifyUrl, {
        headers: cookieHeader ? { cookie: cookieHeader } : {},
        redirect: 'manual',
      });
      if (response.status === 202) {
        const email = response.headers.get('x-auth-request-email');
        // No email means no stable admin identity, so no persistent instance to attach to.
        value = email ? { admin: true, email } : { admin: false, email: null };
      }
    } catch (error) {
      // Auth unreachable is not authentication: fail closed to anonymous.
      log.error(`identity check failed, treating as anonymous: ${error.message}`);
    }

    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(key, { value, expires: now + ttlMs });
    return value;
  };
}
