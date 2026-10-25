import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterResponseHeaders, requestHeaders } from './proxy.mjs';

function inbound(headers) {
  return { headers };
}

const TENANT = { id: 'anon-0123456789abcdef', role: 'anon' };
const COOKIES = ['apps_sid', 'apps_admin'];

test('the viewer identity is injected for the app to scope on', () => {
  const headers = requestHeaders(inbound({ host: 'apps.test' }), {
    cookieNames: COOKIES,
    tenant: TENANT,
  });
  assert.equal(headers['x-apps-tenant'], 'anon-0123456789abcdef');
  assert.equal(headers['x-apps-role'], 'anon');
});

test('the gateway secret is sent so the app can trust that identity', () => {
  const headers = requestHeaders(inbound({ host: 'apps.test' }), {
    cookieNames: COOKIES,
    tenant: { ...TENANT, secret: 'a1b2c3' },
  });
  assert.equal(headers['x-apps-proxy-secret'], 'a1b2c3');
});

test('an app with no gateway secret gets no secret header, not an empty one', () => {
  // An app in single-tenant mode rejects a request carrying identity headers it cannot
  // attribute to a gateway. An empty secret is a value, and would be presented as one.
  const headers = requestHeaders(inbound({ host: 'apps.test' }), {
    cookieNames: COOKIES,
    tenant: { ...TENANT, secret: '' },
  });
  assert.ok(!('x-apps-proxy-secret' in headers));
});

test('a client-supplied gateway secret is replaced by the broker value', () => {
  const headers = requestHeaders(inbound({ 'x-apps-proxy-secret': 'guessed-by-client' }), {
    cookieNames: COOKIES,
    tenant: { ...TENANT, secret: 'a1b2c3' },
  });
  assert.equal(headers['x-apps-proxy-secret'], 'a1b2c3');
});

test('a client-supplied identity is overwritten, never trusted', () => {
  const headers = requestHeaders(
    inbound({ 'x-apps-tenant': 'admin-deadbeefdeadbeef', 'x-apps-role': 'admin' }),
    { cookieNames: COOKIES, tenant: TENANT }
  );
  assert.equal(headers['x-apps-tenant'], 'anon-0123456789abcdef');
  assert.equal(headers['x-apps-role'], 'anon');
});

test('the gateway session cookie never reaches the app', () => {
  const headers = requestHeaders(
    inbound({ cookie: 'apps_sid=secret.mac; theme=dark' }),
    { cookieNames: COOKIES, tenant: TENANT }
  );
  assert.equal(headers.cookie, 'theme=dark');
});

test('the oauth2-proxy admin cookie never reaches the app, chunks included', () => {
  const headers = requestHeaders(
    inbound({ cookie: 'apps_sid=s.mac; apps_admin=live; apps_admin_0=a; theme=dark' }),
    { cookieNames: COOKIES, tenant: TENANT }
  );
  assert.equal(headers.cookie, 'theme=dark');
});

test('an app cannot set either gateway cookie on the way out', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_admin=forged; Path=/', 'apps_sid=forged', 'theme=dark'] },
    COOKIES,
    undefined
  );
  assert.deepEqual(headers['set-cookie'], ['theme=dark']);
});

test('the inbound Host survives, so Next accepts its own Server Actions', () => {
  const headers = requestHeaders(inbound({ host: 'apps.tom-sabala.dev' }), {
    cookieNames: COOKIES,
    tenant: TENANT,
  });
  assert.equal(headers.host, 'apps.tom-sabala.dev');
});

test('hop-by-hop headers are dropped, except on an upgrade', () => {
  const raw = { connection: 'upgrade', upgrade: 'websocket', 'transfer-encoding': 'chunked' };
  const plain = requestHeaders(inbound({ ...raw }), { cookieNames: COOKIES });
  assert.deepEqual(Object.keys(plain), []);

  const upgraded = requestHeaders(inbound({ ...raw }), { cookieNames: COOKIES, keepUpgrade: true });
  assert.equal(upgraded.connection, 'upgrade');
  assert.equal(upgraded.upgrade, 'websocket');
  assert.equal(upgraded['transfer-encoding'], undefined);
});

test('no tenant means no header at all, not an empty one', () => {
  const headers = requestHeaders(inbound({ host: 'apps.test' }), { cookieNames: COOKIES });
  assert.ok(!('x-apps-tenant' in headers));
  assert.ok(!('x-apps-role' in headers));
});

test('an app cannot set the gateway session cookie', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=attacker-controlled; Path=/', 'app_theme=dark'] },
    COOKIES
  );
  assert.deepEqual(headers['set-cookie'], ['app_theme=dark']);
});

test("an app's own cookies are passed through untouched", () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['session=app-side; HttpOnly', 'locale=en'], 'content-type': 'text/html' },
    COOKIES
  );
  assert.deepEqual(headers['set-cookie'], ['session=app-side; HttpOnly', 'locale=en']);
  assert.equal(headers['content-type'], 'text/html');
});

test('a freshly minted session is appended alongside app cookies', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['locale=en'] },
    COOKIES,
    'apps_sid=new.value; Path=/; HttpOnly'
  );
  assert.deepEqual(headers['set-cookie'], ['locale=en', 'apps_sid=new.value; Path=/; HttpOnly']);
});

test('the minted session survives an app trying to clobber it', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=evil; Path=/'] },
    COOKIES,
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
    COOKIES
  );
  assert.deepEqual(Object.keys(headers), ['content-type']);
});

test('no cookie header is invented when there is nothing to set', () => {
  const headers = filterResponseHeaders({ 'content-length': '12' }, COOKIES);
  assert.ok(!('set-cookie' in headers));
});
