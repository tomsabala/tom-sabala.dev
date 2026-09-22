/**
 * Streaming reverse proxy from the broker to one instance.
 *
 * Bodies are piped, never buffered: the apps behind this stream LLM output, and a request
 * can legitimately run for tens of minutes. Two invariants matter here:
 *
 *   - the session cookie is removed on the way in and any attempt to set it is dropped on
 *     the way out, so an app can neither read nor overwrite the gateway's own credential;
 *   - the inbound `Host` header is preserved, because Next.js compares `Origin` against it
 *     when validating Server Actions.
 */

import http from 'node:http';
import { stripCookie } from './session.mjs';

const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

/**
 * Rewrites an upstream response's headers: hop-by-hop dropped, any attempt to set the
 * gateway's own session cookie discarded, and the freshly minted session appended. An app
 * that could overwrite this cookie could hand every visitor the same instance.
 */
export function filterResponseHeaders(upstreamHeaders, cookieName, setCookie) {
  const headers = {};
  for (const [name, value] of Object.entries(upstreamHeaders)) {
    if (HOP_BY_HOP.includes(name)) continue;
    if (name === 'set-cookie') {
      const kept = value.filter(entry => !entry.startsWith(`${cookieName}=`));
      if (kept.length > 0) headers['set-cookie'] = kept;
      continue;
    }
    headers[name] = value;
  }
  if (setCookie) headers['set-cookie'] = [...(headers['set-cookie'] ?? []), setCookie];
  return headers;
}

/**
 * Builds the headers sent upstream. Two things are deliberate here: the gateway's own
 * session cookie is removed (an app may neither read nor replay it), and the viewer's
 * identity is *added* — the broker is the only thing that can set `X-Apps-*`, since
 * server.mjs deletes any inbound copy before this runs.
 *
 * `tenant.secret` is the app's own `GATEWAY_SECRET`, sent back to it as proof that the
 * identity headers came from the broker: without it an app cannot tell the difference
 * between this gateway and a client that typed the header itself, so an app that takes
 * tenancy from a header refuses to trust an unsigned one. Absent for an app that does not
 * use header tenancy, and then the header is not sent at all rather than sent empty.
 */
export function requestHeaders(req, { cookieName, tenant, keepUpgrade = false }) {
  const headers = { ...req.headers };
  for (const name of HOP_BY_HOP) {
    if (keepUpgrade && (name === 'connection' || name === 'upgrade')) continue;
    delete headers[name];
  }

  const cookie = stripCookie(headers.cookie, cookieName);
  if (cookie) headers.cookie = cookie;
  else delete headers.cookie;

  if (tenant) {
    headers['x-apps-tenant'] = tenant.id;
    headers['x-apps-role'] = tenant.role;
    if (tenant.secret) headers['x-apps-proxy-secret'] = tenant.secret;
  }
  return headers;
}

export function createProxy({ cookieName, log }) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

  function target(endpoint) {
    const url = new URL(endpoint);
    return { hostname: url.hostname, port: url.port };
  }

  return {
    /** Proxies one request. `setCookie` is the freshly minted session, if any. */
    web(req, res, endpoint, { setCookie, tenant } = {}) {
      const { hostname, port } = target(endpoint);
      const upstream = http.request(
        {
          hostname,
          port,
          method: req.method,
          path: req.url,
          headers: requestHeaders(req, { cookieName, tenant }),
          agent,
        },
        proxyRes => {
          const headers = filterResponseHeaders(proxyRes.headers, cookieName, setCookie);
          res.writeHead(proxyRes.statusCode ?? 502, headers);
          res.socket?.setNoDelay(true);
          proxyRes.pipe(res);
        }
      );

      // No timeout: a tailoring run against a local model can take half an hour, and the
      // Caddyfile is configured to match.
      upstream.setTimeout(0);
      upstream.on('error', error => {
        log.error(`upstream ${endpoint}${req.url} failed: ${error.message}`);
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
        res.end('The app instance stopped responding. Reload to start a new one.\n');
      });

      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    },

    /** WebSocket / SSE upgrade passthrough. */
    upgrade(req, socket, head, endpoint, { tenant } = {}) {
      const { hostname, port } = target(endpoint);
      const upstream = http.request({
        hostname,
        port,
        method: req.method,
        path: req.url,
        headers: requestHeaders(req, { cookieName, tenant, keepUpgrade: true }),
      });

      upstream.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        const lines = [`HTTP/1.1 ${proxyRes.statusCode} ${proxyRes.statusMessage}`];
        for (const [name, value] of Object.entries(proxyRes.headers)) {
          if (name === 'set-cookie') {
            for (const entry of value) {
              if (!entry.startsWith(`${cookieName}=`)) lines.push(`set-cookie: ${entry}`);
            }
            continue;
          }
          lines.push(`${name}: ${value}`);
        }
        socket.write(`${lines.join('\r\n')}\r\n\r\n`);

        proxySocket.setNoDelay(true);
        socket.setNoDelay(true);
        if (proxyHead?.length) socket.write(proxyHead);
        proxySocket.pipe(socket).pipe(proxySocket);
        proxySocket.on('error', () => socket.destroy());
        socket.on('error', () => proxySocket.destroy());
      });

      upstream.on('error', error => {
        log.error(`upgrade to ${endpoint}${req.url} failed: ${error.message}`);
        socket.destroy();
      });

      if (head?.length) upstream.write(head);
      req.pipe(upstream);
    },
  };
}
