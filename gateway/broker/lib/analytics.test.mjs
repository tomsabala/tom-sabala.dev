/**
 * The analytics relay, exercised against the real server process.
 *
 * One question matters here and it is a security question: can a visitor on
 * apps.tom-sabala.dev get their visit filed as an admin? The whole reason this
 * hop exists is that the portfolio backend cannot verify this origin's session,
 * so if a forged `X-Analytics-Identity: admin` survived the relay, the admin
 * column in every traffic report would be worthless.
 *
 * Tested end to end rather than by unit-calling the forwarder, because what is
 * being asserted is exactly what goes out over the wire to the backend — a
 * handler test would not see the headers.
 *
 * The auth stub below is never-admin, matching an anonymous visitor.
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

const ANALYTICS_TOKEN = 'test-only-analytics-token-0123456789abcdef';

let broker = null;
let brokerUrl = '';
const stubs = [];
/** Every batch the broker relayed, in arrival order. */
const relayed = [];

async function stub(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  stubs.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function post(path, { body = '', headers = {} } = {}) {
  const response = await fetch(`${brokerUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...headers },
    body,
    redirect: 'manual',
  });
  return { status: response.status, text: await response.text() };
}

/** The relay answers before it forwards, so arrival has to be waited for. */
async function nextRelay(count) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (relayed.length >= count) return relayed[count - 1];
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`relay ${count} never arrived`);
}

before(async () => {
  const auth = await stub((req, res) => {
    void req;
    res.writeHead(401).end();
  });
  const docker = await stub((req, res) => {
    void req;
    res.writeHead(200, { 'content-type': 'application/json' }).end('[]');
  });
  const backend = await stub((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      relayed.push({ headers: req.headers, body: Buffer.concat(chunks).toString() });
      res.writeHead(204).end();
    });
  });

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
      COOKIE_NAME: 'apps_sid',
      ADMIN_COOKIE_NAME: 'apps_admin',
      COOKIE_SECURE: 'false',
      AUTH_VERIFY_URL: `${auth}/oauth2/auth`,
      AUTH_SIGNIN_PATH: '/oauth2/start',
      INSTANCE_NETWORK: 'apps-instances-test',
      INSTANCE_ENV_DIR: join(HERE, 'nonexistent-env-dir'),
      REAP_INTERVAL_SECONDS: '3600',
      ANALYTICS_URL: `${backend}/api/_e`,
      ANALYTICS_TOKEN,
    },
  });
  broker.stderr.on('data', chunk => {
    if (process.env.BROKER_TEST_LOG) process.stderr.write(chunk);
  });
  broker.stdout.resume();
  brokerUrl = `http://127.0.0.1:${port}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${brokerUrl}/healthz`);
      if (response.status === 200) {
        await response.text();
        return;
      }
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

test('a beacon is relayed with the token and the gateway-resolved identity', async () => {
  const { status } = await post('/_e', { body: '{"events":[{"type":"view","path":"/"}]}' });
  assert.equal(status, 204);

  const hop = await nextRelay(1);
  assert.equal(hop.headers['x-analytics-token'], ANALYTICS_TOKEN);
  assert.equal(hop.headers['x-analytics-site'], 'apps');
  assert.equal(hop.headers['x-analytics-identity'], 'anon');
  assert.equal(hop.body, '{"events":[{"type":"view","path":"/"}]}');
});

test('a client cannot claim to be an admin', async () => {
  const { status } = await post('/_e', {
    body: '{"events":[{"type":"event","name":"apps.open"}]}',
    headers: {
      'x-analytics-identity': 'admin',
      'x-analytics-token': 'forged',
      'x-auth-request-email': 'someone@example.com',
    },
  });
  assert.equal(status, 204);

  const hop = await nextRelay(2);
  // The auth stub refuses every session, so the only honest answer is anon —
  // and the forged token must not have survived either.
  assert.equal(hop.headers['x-analytics-identity'], 'anon');
  assert.equal(hop.headers['x-analytics-token'], ANALYTICS_TOKEN);
});

test('the visitor address is the entry the proxy appended, not the one the client sent', async () => {
  await post('/_e', {
    body: '{"events":[{"type":"view","path":"/"}]}',
    headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'user-agent': 'TestAgent/1.0' },
  });

  const hop = await nextRelay(3);
  // Caddy appends the peer it accepted, so everything to the left of the last
  // entry was supplied by the client. Reading the left would let a caller pick
  // the address this relay then asserts behind a valid token — enough to mint
  // visitor hashes, or to write their own page views into someone else's open
  // visit by reproducing that visitor's IP and User-Agent.
  assert.equal(hop.headers['x-analytics-ip'], '10.0.0.1');
  // Forwarded because the backend hashes it into the daily visitor id and uses
  // it to classify bots, then discards it.
  assert.equal(hop.headers['user-agent'], 'TestAgent/1.0');
});

test('GET is refused: the beacon is a write', async () => {
  const response = await fetch(`${brokerUrl}/_e`, { redirect: 'manual' });
  await response.text();
  assert.equal(response.status, 405);
});
