import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mintSessionId,
  readCookie,
  sessionCookie,
  signSession,
  stripCookie,
  verifySession,
} from './session.mjs';

const SECRET = 'a'.repeat(48);

test('a minted session round-trips through sign and verify', () => {
  const id = mintSessionId();
  assert.equal(verifySession(signSession(id, SECRET), SECRET), id);
});

test('two mints never collide', () => {
  const ids = new Set(Array.from({ length: 200 }, () => mintSessionId()));
  assert.equal(ids.size, 200);
});

test('verify rejects a tampered signature, id or secret', () => {
  const id = mintSessionId();
  const value = signSession(id, SECRET);
  const [, mac] = value.split('.');

  assert.equal(verifySession(`${mintSessionId()}.${mac}`, SECRET), null, 'swapped id');
  assert.equal(verifySession(`${id}.${mac.slice(0, -1)}X`, SECRET), null, 'flipped mac char');
  assert.equal(verifySession(value, 'b'.repeat(48)), null, 'different secret');
});

test('verify rejects malformed values instead of throwing', () => {
  for (const value of ['', '.', 'nodot', 'a.b.c', `${'x'.repeat(32)}.`, undefined, null, 42]) {
    assert.equal(verifySession(value, SECRET), null, `accepted ${JSON.stringify(value)}`);
  }
});

test('verify rejects an id that is not a 32-char base64url blob', () => {
  const forged = 'admin';
  assert.equal(verifySession(signSession(forged, SECRET), SECRET), null);
});

test('the cookie is HttpOnly and lax, and Secure only when asked', () => {
  const insecure = sessionCookie('apps_sid', 'v', { secure: false });
  assert.match(insecure, /^apps_sid=v; Path=\/; HttpOnly; SameSite=Lax/);
  assert.ok(!insecure.includes('Secure'));
  assert.ok(sessionCookie('__Host-apps_sid', 'v', { secure: true }).includes('; Secure'));
});

test('readCookie picks the named cookie out of a header', () => {
  const header = 'other=1; apps_sid=abc.def; _ga=x';
  assert.equal(readCookie(header, 'apps_sid'), 'abc.def');
  assert.equal(readCookie(header, 'missing'), null);
  assert.equal(readCookie(undefined, 'apps_sid'), null);
});

test('readCookie does not match a cookie whose name merely ends with the target', () => {
  assert.equal(readCookie('not_apps_sid=evil', 'apps_sid'), null);
});

test('stripCookie removes only the session cookie', () => {
  assert.equal(stripCookie('a=1; apps_sid=x; b=2', 'apps_sid'), 'a=1; b=2');
  assert.equal(stripCookie('apps_sid=x', 'apps_sid'), undefined);
  assert.equal(stripCookie('a=1', 'apps_sid'), 'a=1');
  assert.equal(stripCookie(undefined, 'apps_sid'), undefined);
});
