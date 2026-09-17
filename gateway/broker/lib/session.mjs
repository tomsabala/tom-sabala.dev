/**
 * Visitor session: an opaque random id, HMAC-signed so the broker can tell its own cookie
 * from a guessed one without storing anything. The id is the only thing that separates one
 * anonymous visitor's container from another's, so it is never derived from client input.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ID_BYTES = 24;
const ID_PATTERN = /^[A-Za-z0-9_-]{32}$/;

function sign(id, secret) {
  return createHmac('sha256', secret).update(id).digest('base64url');
}

export function mintSessionId() {
  return randomBytes(ID_BYTES).toString('base64url');
}

export function signSession(id, secret) {
  return `${id}.${sign(id, secret)}`;
}

/** Returns the session id, or null for anything this broker did not sign. */
export function verifySession(value, secret) {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [id, mac] = parts;
  if (!ID_PATTERN.test(id)) return null;

  const expected = Buffer.from(sign(id, secret), 'utf8');
  const received = Buffer.from(mac, 'utf8');
  if (expected.length !== received.length) return null;
  return timingSafeEqual(expected, received) ? id : null;
}

export function sessionCookie(name, value, { secure }) {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
}

/**
 * Drops one cookie from a Cookie header. The session cookie is the gateway's own credential;
 * an app behind the broker must never see it, let alone be able to replay it.
 */
export function stripCookie(header, name) {
  if (!header) return undefined;
  const kept = header
    .split(';')
    .filter(pair => {
      const index = pair.indexOf('=');
      return index < 0 ? pair.trim().length > 0 : pair.slice(0, index).trim() !== name;
    })
    .map(pair => pair.trim());
  return kept.length > 0 ? kept.join('; ') : undefined;
}
