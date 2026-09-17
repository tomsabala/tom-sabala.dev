import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterResponseHeaders, requestHeaders } from './proxy.mjs';

function inbound(headers) {
  return { headers };
}

const TENANT = { id: 'anon-0123456789abcdef', role: 'anon' };

test('the viewer identity is injected for the app to scope on', () => {
  const headers = requestHeaders(inbound({ host: 'apps.test' }), {
    cookieName: 'apps_sid',
    tenant: TENANT,
  });
  assert.equal(headers['x-apps-tenant'], 'anon-0123456789abcdef');
  assert.equal(headers['x-apps-role'], 'anon');
});

test('a client-supplied identity is overwritten, never trusted', () => {
  const headers = requestHeaders(
    inbound({ 'x-apps-tenant': 'admin-deadbeefdeadbeef', 'x-apps-role': 'admin' }),
    { cookieName: 'apps_sid', tenant: TENANT }
  );
  assert.equal(headers['x-apps-tenant'], 'anon-0123456789abcdef');
  assert.equal(headers['x-apps-role'], 'anon');
});

test('the gateway session cookie never reaches the app', () => {
  const headers = requestHeaders(
    inbound({ cookie: 'apps_sid=secret.mac; theme=dark' }),
    { cookieName: 'apps_sid', tenant: TENANT }
  );
  assert.equal(headers.cookie, 'theme=dark');
});

test('the inbound Host survives, so Next accepts its own Server Actions', () => {
  const headers = requestHeaders(inbound({ host: 'apps.tom-sabala.dev' }), {
    cookieName: 'apps_sid',
    tenant: TENANT,
  });
  assert.equal(headers.host, 'apps.tom-sabala.dev');
});

test('hop-by-hop headers are dropped, except on an upgrade', () => {
  const raw = { connection: 'upgrade', upgrade: 'websocket', 'transfer-encoding': 'chunked' };
  const plain = requestHeaders(inbound({ ...raw }), { cookieName: 'apps_sid' });
  assert.deepEqual(Object.keys(plain), []);

  const upgraded = requestHeaders(inbound({ ...raw }), { cookieName: 'apps_sid', keepUpgrade: true });
  assert.equal(upgraded.connection, 'upgrade');
  assert.equal(upgraded.upgrade, 'websocket');
  assert.equal(upgraded['transfer-encoding'], undefined);
});

test('no tenant means no header at all, not an empty one', () => {
  const headers = requestHeaders(inbound({ host: 'apps.test' }), { cookieName: 'apps_sid' });
  assert.ok(!('x-apps-tenant' in headers));
  assert.ok(!('x-apps-role' in headers));
});

test('an app cannot set the gateway session cookie', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=attacker-controlled; Path=/', 'app_theme=dark'] },
    'apps_sid'
  );
  assert.deepEqual(headers['set-cookie'], ['app_theme=dark']);
});

test("an app's own cookies are passed through untouched", () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['session=app-side; HttpOnly', 'locale=en'], 'content-type': 'text/html' },
    'apps_sid'
  );
  assert.deepEqual(headers['set-cookie'], ['session=app-side; HttpOnly', 'locale=en']);
  assert.equal(headers['content-type'], 'text/html');
});

test('a freshly minted session is appended alongside app cookies', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['locale=en'] },
    'apps_sid',
    'apps_sid=new.value; Path=/; HttpOnly'
  );
  assert.deepEqual(headers['set-cookie'], ['locale=en', 'apps_sid=new.value; Path=/; HttpOnly']);
});

test('the minted session survives an app trying to clobber it', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=evil; Path=/'] },
    'apps_sid',
    'apps_sid=mine; Path=/; HttpOnly'
  );
  assert.deepEqual(headers['set-cookie'], ['apps_sid=mine; Path=/; HttpOnly']);
});

test('hop-by-hop headers are not relayed', () => {
  const headers = filterResponseHeaders(
    {
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      upgrade: 'h2c',
      'content-type': 'application/json',
    },
    'apps_sid'
  );
  assert.deepEqual(Object.keys(headers), ['content-type']);
});

test('no cookie header is invented when there is nothing to set', () => {
  const headers = filterResponseHeaders({ 'content-length': '12' }, 'apps_sid');
  assert.ok(!('set-cookie' in headers));
});
