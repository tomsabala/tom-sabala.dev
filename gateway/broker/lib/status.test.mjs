/**
 * The two status surfaces, exercised against the real server process.
 *
 * They are tested end to end rather than by unit-calling a handler because what matters is
 * exactly what goes out over the wire: whether /instances answers an unauthenticated caller
 * at all, and whether /boot — which is unauthenticated by design — can be made to say
 * anything about an app's image, port or memory. A handler test would not see the JSON.
 *
 * Nothing here talks to Docker or Google: a stub daemon and a stub auth endpoint stand in.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..', 'server.mjs');
const MANIFEST = join(HERE, '..', '..', '..', 'frontend', 'src', 'apps', 'apps.json');

const SLUG = 'trek';
const STATUS_TOKEN = 'test-only-status-token-0123456789abcdef';
const CONTAINER = `/apps-${SLUG}-shared`;

let broker = null;
let brokerUrl = '';
const stubs = [];

/** Minimal JSON server; returns its own base URL. */
async function stub(handler) {
  const server = http.createServer((req, res) => {
    const body = handler(req);
    if (body === null) {
      res.writeHead(401).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  stubs.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function get(path, headers = {}) {
  const response = await fetch(`${brokerUrl}${path}`, { headers, redirect: 'manual' });
  return { status: response.status, text: await response.text() };
}

before(async () => {
  // Never-admin: the broker's only source of identity, so every request below is anonymous.
  const auth = await stub(() => null);
  const docker = await stub(req => {
    const [path] = req.url.split('?');
    if (path === '/containers/json') {
      return [
        {
          Id: 'c1',
          Names: [CONTAINER],
          Labels: { 'dev.tom-sabala.apps.slug': SLUG, 'dev.tom-sabala.apps.kind': 'shared' },
          State: 'running',
        },
      ];
    }
    if (path === '/containers/c1/json') {
      return { Id: 'c1', State: { Running: true, StartedAt: '2026-01-01T00:00:00Z' } };
    }
    if (path === '/containers/c1/stats') {
      return { memory_stats: { usage: 200_000_000, limit: 768_000_000, stats: { inactive_file: 50_000_000 } } };
    }
    return {};
  });

  // The broker needs a fixed PORT (loadConfig refuses 0), so one is borrowed from the OS
  // and released again immediately.
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));

  broker = spawn(process.execPath, [SERVER], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      MANIFEST_PATH: MANIFEST,
      DOCKER_API: docker,
      SESSION_SECRET: 'test-only-session-secret-0123456789abcdef',
      STATUS_TOKEN,
      COOKIE_NAME: 'apps_sid',
      ADMIN_COOKIE_NAME: 'apps_admin',
      COOKIE_SECURE: 'false',
      AUTH_VERIFY_URL: `${auth}/oauth2/auth`,
      AUTH_SIGNIN_PATH: '/oauth2/start',
      INSTANCE_NETWORK: 'apps-instances-test',
      INSTANCE_ENV_DIR: join(HERE, 'nonexistent-env-dir'),
      REAP_INTERVAL_SECONDS: '3600',
    },
  });
  broker.stderr.on('data', chunk => {
    if (process.env.BROKER_TEST_LOG) process.stderr.write(chunk);
  });
  broker.stdout.resume();
  brokerUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const { status } = await get('/healthz');
      if (status === 200) return;
    } catch {
      // not listening yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('broker did not start');
});

after(async () => {
  if (broker) broker.kill();
  await Promise.all(stubs.map(server => new Promise(resolve => server.close(resolve))));
});

test('/instances is refused without an admin session or the status token', async () => {
  const { status } = await get('/instances');
  assert.equal(status, 401);
});

test('a wrong status token is refused too', async () => {
  const { status } = await get('/instances', { 'X-Hangar-Token': 'not-the-token-0123456789abcdefghij' });
  assert.equal(status, 401);
});

test('the status token returns the documented instance shape', async () => {
  const { status, text } = await get('/instances', { 'X-Hangar-Token': STATUS_TOKEN });
  assert.equal(status, 200);
  const body = JSON.parse(text);

  assert.deepEqual(Object.keys(body).sort(), ['caps', 'instances']);
  assert.deepEqual(Object.keys(body.caps).sort(), ['admin', 'anon', 'total']);
  assert.deepEqual(Object.keys(body.instances[0]).sort(), [
    'coldStartMs',
    'kind',
    'lastSeenMs',
    'memLimitBytes',
    'memUsedBytes',
    'mode',
    'name',
    'slug',
    'startedAt',
    'state',
  ]);
  assert.equal(body.instances[0].slug, SLUG);
  assert.equal(body.instances[0].state, 'running');
  // usage minus the reclaimable page cache, as `docker stats` reports it.
  assert.equal(body.instances[0].memUsedBytes, 150_000_000);
  assert.equal(body.instances[0].memLimitBytes, 768_000_000);
});

test('/boot reports absent before anything has been started', async () => {
  const { status, text } = await get(`/boot/${SLUG}`);
  assert.equal(status, 200);
  const body = JSON.parse(text);
  assert.equal(body.state, 'absent');
  assert.deepEqual(body.phases, []);
  assert.equal(body.error, null);
});

test('/boot leaks nothing from the runtime block', async () => {
  const { text } = await get(`/boot/${SLUG}`);
  for (const forbidden of ['ghcr.io', 'image', 'memoryMb', 'shmSizeMb', 'dataPath', 'readyPath']) {
    assert.ok(!text.includes(forbidden), `${forbidden} must not appear in a /boot payload`);
  }
  // "port" is checked separately: it must not be a *field*, and the substring would also
  // match a future word like "report".
  assert.equal(JSON.parse(text).port, undefined);
});

test('/boot refuses an unknown or malformed slug', async () => {
  assert.equal((await get('/boot/nope')).status, 404);
  assert.equal((await get('/boot/..%2fetc')).status, 404);
});

test('status responses are never cached', async () => {
  const response = await fetch(`${brokerUrl}/boot/${SLUG}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('the manifest stays runtime-stripped, status endpoints or not', async () => {
  const { text } = await get('/manifest.json');
  assert.ok(!text.includes('ghcr.io'));
});
