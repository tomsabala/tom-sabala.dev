import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containerName, createIdentityResolver, instanceKey, keyKind, volumeName } from './identity.mjs';

const silent = { info() {}, warn() {}, error() {} };

test('an admin key is stable per email and case-insensitive', () => {
  const key = instanceKey({ admin: true, email: 'Tom@Example.com' });
  assert.equal(key, instanceKey({ admin: true, email: ' tom@example.com ' }));
  assert.equal(keyKind(key), 'admin');
});

test('different admins get different keys', () => {
  assert.notEqual(
    instanceKey({ admin: true, email: 'a@example.com' }),
    instanceKey({ admin: true, email: 'b@example.com' })
  );
});

test('an anonymous key is stable per session and differs per session', () => {
  const key = instanceKey({ admin: false, sessionId: 'session-one' });
  assert.equal(key, instanceKey({ admin: false, sessionId: 'session-one' }));
  assert.notEqual(key, instanceKey({ admin: false, sessionId: 'session-two' }));
  assert.equal(keyKind(key), 'anon');
});

test('a key never carries the email or session id it came from', () => {
  const admin = instanceKey({ admin: true, email: 'tom@example.com' });
  const anon = instanceKey({ admin: false, sessionId: 'raw-session-value' });
  assert.ok(!admin.includes('tom'), admin);
  assert.ok(!admin.includes('example'), admin);
  assert.ok(!anon.includes('raw-session-value'), anon);
  assert.match(admin, /^admin-[0-9a-f]{16}$/);
  assert.match(anon, /^anon-[0-9a-f]{16}$/);
});

test('an identity without its input is refused rather than shared', () => {
  assert.throws(() => instanceKey({ admin: true, email: '' }));
  assert.throws(() => instanceKey({ admin: false, sessionId: undefined }));
});

test('container and volume names are derived from slug and key', () => {
  const key = instanceKey({ admin: false, sessionId: 's' });
  assert.equal(containerName('resume-matcher', key), `apps-resume-matcher-${key}`);
  assert.equal(volumeName('resume-matcher', key), `apps-resume-matcher-${key}`);
});

test('a shared app has one key for everybody', () => {
  const anon = instanceKey({ mode: 'shared', admin: false, sessionId: 'session-one' });
  const other = instanceKey({ mode: 'shared', admin: false, sessionId: 'session-two' });
  const admin = instanceKey({ mode: 'shared', admin: true, email: 'tom@example.com' });

  assert.equal(anon, 'shared');
  assert.equal(other, 'shared');
  assert.equal(admin, 'shared', 'an admin must not get a second copy of a shared app');
  assert.equal(keyKind(anon), 'shared');
});

test('a shared app needs no identity at all', () => {
  assert.equal(instanceKey({ mode: 'shared' }), 'shared');
});

test('202 with an email is the only admin verdict', async () => {
  const cases = [
    { status: 202, email: 'tom@example.com', admin: true },
    { status: 202, email: null, admin: false },
    { status: 401, email: 'tom@example.com', admin: false },
    { status: 200, email: 'tom@example.com', admin: false },
    { status: 302, email: null, admin: false },
  ];

  for (const { status, email, admin } of cases) {
    const resolve = createIdentityResolver({
      verifyUrl: 'http://auth/oauth2/auth',
      ttlMs: 0,
      log: silent,
      fetchImpl: async () => ({ status, headers: { get: () => email } }),
    });
    const viewer = await resolve('cookie=1');
    assert.equal(viewer.admin, admin, `status ${status} email ${email}`);
    if (!admin) assert.equal(viewer.email, null);
  }
});

test('only the cookie header is forwarded to the auth endpoint', async () => {
  let seen = null;
  const resolve = createIdentityResolver({
    verifyUrl: 'http://auth/oauth2/auth',
    ttlMs: 0,
    log: silent,
    fetchImpl: async (url, options) => {
      seen = options;
      return { status: 401, headers: { get: () => null } };
    },
  });

  await resolve('admin_session=abc');
  assert.deepEqual(Object.keys(seen.headers), ['cookie']);
  assert.equal(seen.headers.cookie, 'admin_session=abc');
});

test('an unreachable auth service means anonymous, not admin', async () => {
  const resolve = createIdentityResolver({
    verifyUrl: 'http://auth/oauth2/auth',
    ttlMs: 60_000,
    log: silent,
    fetchImpl: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  assert.deepEqual(await resolve('x=1'), { admin: false, email: null });
});

test('verdicts are cached per cookie header, not shared across them', async () => {
  let calls = 0;
  const resolve = createIdentityResolver({
    verifyUrl: 'http://auth/oauth2/auth',
    ttlMs: 60_000,
    log: silent,
    fetchImpl: async (_url, options) => {
      calls += 1;
      const admin = options.headers.cookie === 'admin=1';
      return { status: admin ? 202 : 401, headers: { get: () => (admin ? 'a@b.c' : null) } };
    },
  });

  assert.equal((await resolve('admin=1')).admin, true);
  assert.equal((await resolve('admin=1')).admin, true);
  assert.equal(calls, 1, 'second identical lookup should hit the cache');
  assert.equal((await resolve('anon=1')).admin, false);
  assert.equal(calls, 2, 'a different cookie must be verified separately');
});
