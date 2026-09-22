/**
 * apps.tom-sabala.dev instance broker.
 *
 * Serves two things behind Caddy:
 *   GET /manifest.json  — the app list this viewer is allowed to see
 *   ALL /a/<slug>/*     — proxied to a container started on demand for this viewer
 *
 * Zero npm dependencies on purpose: this process is internet-facing and long-lived, and
 * Docker is spoken over plain HTTP to a scoped socket proxy.
 */

import http from 'node:http';
import { loadConfig } from './lib/config.mjs';
import { createDockerClient } from './lib/docker.mjs';
import { createIdentityResolver, instanceKey, tenantKey } from './lib/identity.mjs';
import { createInstanceManager } from './lib/instances.mjs';
import { createManifestStore, publicManifest } from './lib/manifest.mjs';
import { parseServicePath } from './lib/paths.mjs';
import { createProxy } from './lib/proxy.mjs';
import { mintSessionId, readCookie, sessionCookie, signSession, verifySession } from './lib/session.mjs';

const log = {
  info: message => console.log(`[broker] ${message}`),
  warn: message => console.warn(`[broker] ${message}`),
  error: message => console.error(`[broker] ${message}`),
};

/**
 * Identity headers are produced by the broker's own auth subrequest, never accepted from a
 * client: without this, `curl -H 'X-Auth-Request-Email: me@example.com'` would be admin.
 */
function stripClientIdentityHeaders(req) {
  for (const name of Object.keys(req.headers)) {
    if (name.startsWith('x-auth-request-') || name.startsWith('x-apps-')) delete req.headers[name];
  }
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;height:100vh;color:#374151;background:#fff}
main{max-width:30rem;padding:2rem;text-align:center}h1{font-size:1rem;margin:0 0 .5rem}p{margin:0;color:#6b7280}
@media(prefers-color-scheme:dark){body{background:#111;color:#e5e7eb}p{color:#9ca3af}}</style>
</head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

function respond(res, status, { body = '', type = 'text/plain; charset=utf-8', setCookie, headers = {} }) {
  const all = { 'content-type': type, 'cache-control': 'no-store', ...headers };
  if (setCookie) all['set-cookie'] = setCookie;
  res.writeHead(status, all);
  res.end(body);
}

async function main() {
  const config = loadConfig();
  const manifest = await createManifestStore({ path: config.manifestPath, log });
  const docker = createDockerClient({ baseUrl: config.dockerApi });
  const instances = createInstanceManager({ docker, config, log });
  const identity = createIdentityResolver({
    verifyUrl: config.authVerifyUrl,
    ttlMs: config.identityTtlMs,
    log,
  });
  const proxy = createProxy({ cookieName: config.cookieName, log });

  await instances.adopt();
  instances.startReaper();

  /** Reads the session cookie, minting one when absent or not signed by this broker. */
  function session(req) {
    const existing = verifySession(readCookie(req.headers.cookie, config.cookieName), config.sessionSecret);
    if (existing) return { id: existing, setCookie: undefined };
    const id = mintSessionId();
    return {
      id,
      setCookie: sessionCookie(config.cookieName, signSession(id, config.sessionSecret), {
        secure: config.cookieSecure,
      }),
    };
  }

  async function handleService(req, res, parsed, viewer, sessionState) {
    const app = manifest.service(parsed.slug);
    if (!app) {
      return respond(res, 404, { body: 'No such app.\n', setCookie: sessionState.setCookie });
    }

    if (app.access === 'admin' && !viewer.admin) {
      // A document request gets sent through sign-in so a bookmarked deep link still works;
      // everything else is refused flatly. Note this does tell a caller who already knows
      // the slug that the app exists — the launcher never lists it, which is the boundary
      // that matters.
      if ((req.headers.accept ?? '').includes('text/html')) {
        return respond(res, 302, {
          setCookie: sessionState.setCookie,
          headers: { location: `${config.authSigninPath}?rd=${encodeURIComponent(req.url)}` },
        });
      }
      return respond(res, 401, { body: 'Admin sign-in required.\n', setCookie: sessionState.setCookie });
    }

    // Who the viewer is, independent of which container serves them: for a `shared` app one
    // instance serves everybody, and this is how the app tells them apart.
    const identity = { admin: viewer.admin, email: viewer.email, sessionId: sessionState.id };
    const tenant = {
      id: tenantKey(identity),
      role: viewer.admin ? 'admin' : 'anon',
    };
    const key = instanceKey({ mode: app.mode, ...identity });

    try {
      const { endpoint, secret } = await instances.ensure(app, key);
      proxy.web(req, res, endpoint, {
        setCookie: sessionState.setCookie,
        tenant: { ...tenant, secret },
      });
    } catch (error) {
      if (error.code === 'capacity') {
        log.warn(`capacity reached for ${app.slug}: ${error.message}`);
        return respond(res, 503, {
          type: 'text/html; charset=utf-8',
          setCookie: sessionState.setCookie,
          headers: { 'retry-after': '60' },
          body: page(
            'This app is at capacity right now',
            'Every instance slot is in use. Try again in a few minutes.'
          ),
        });
      }
      log.error(`could not start ${app.slug} for ${key}: ${error.message}`);
      return respond(res, 503, {
        type: 'text/html; charset=utf-8',
        setCookie: sessionState.setCookie,
        headers: { 'retry-after': '30' },
        body: page(
          'This app did not start in time',
          'Your private instance took too long to come up. Reload to try again.'
        ),
      });
    }
  }

  const server = http.createServer((req, res) => {
    stripClientIdentityHeaders(req);

    void (async () => {
      try {
        if (req.url === '/healthz') return respond(res, 200, { body: 'ok\n' });

        const sessionState = session(req);
        const viewer = await identity(req.headers.cookie);

        if (req.url === '/manifest.json') {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            return respond(res, 405, { body: 'Method not allowed.\n', headers: { allow: 'GET, HEAD' } });
          }
          return respond(res, 200, {
            type: 'application/json; charset=utf-8',
            setCookie: sessionState.setCookie,
            body: JSON.stringify(publicManifest(manifest.all(), viewer.admin)),
          });
        }

        const parsed = parseServicePath(req.url);
        if (!parsed) return respond(res, 404, { body: 'No such app.\n' });

        await handleService(req, res, parsed, viewer, sessionState);
      } catch (error) {
        log.error(`request ${req.method} ${req.url} failed: ${error.stack ?? error.message}`);
        if (!res.headersSent) respond(res, 500, { body: 'Gateway error.\n' });
        else res.end();
      }
    })();
  });

  server.on('upgrade', (req, socket, head) => {
    stripClientIdentityHeaders(req);

    void (async () => {
      const parsed = parseServicePath(req.url);
      const app = parsed ? manifest.service(parsed.slug) : null;
      if (!app) return socket.destroy();

      const viewer = await identity(req.headers.cookie);
      if (app.access === 'admin' && !viewer.admin) return socket.destroy();

      // No cookie can be minted on a 101 response, and an upgrade always follows a document
      // request that already established one. A shared app needs no identity at all.
      const sessionId = verifySession(
        readCookie(req.headers.cookie, config.cookieName),
        config.sessionSecret
      );
      if (app.mode !== 'shared' && !viewer.admin && !sessionId) return socket.destroy();

      try {
        const identity = { admin: viewer.admin, email: viewer.email, sessionId };
        // A shared app without a session has no tenant of its own to claim; it gets the
        // anonymous role and no tenant header, so the app falls back to its own default.
        const tenant =
          viewer.admin || sessionId
            ? { id: tenantKey(identity), role: viewer.admin ? 'admin' : 'anon' }
            : undefined;
        const key = instanceKey({ mode: app.mode, ...identity });
        const { endpoint, secret } = await instances.ensure(app, key);
        proxy.upgrade(req, socket, head, endpoint, { tenant: tenant && { ...tenant, secret } });
      } catch (error) {
        log.error(`upgrade for ${app.slug} failed: ${error.message}`);
        socket.destroy();
      }
    })();
  });

  server.listen(config.port, () => {
    log.info(`listening on ${config.port}; docker at ${config.dockerApi}`);
    log.info(
      `idle TTL ${config.idleTtlMs / 1000}s, caps anon=${config.maxInstances.anon} admin=${config.maxInstances.admin} total=${config.maxInstances.total}`
    );
  });

  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      log.info(`${signal} — shutting down; instances are left running and adopted on restart`);
      instances.stopReaper();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}

await main();
