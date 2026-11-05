/**
 * Relays this origin's analytics beacons to the portfolio backend, carrying the
 * one fact only the gateway can establish: whether the caller is an admin.
 *
 * apps.tom-sabala.dev is a separate origin with a separate session. The admin
 * cookie here is oauth2-proxy's SameSite=Lax `__Host-apps_admin`, which the
 * portfolio backend can neither see nor verify, and this origin is deliberately
 * absent from its CORS_ORIGINS. A beacon posted straight from the browser could
 * therefore only ever *claim* to be an admin, and a claim is worth nothing.
 *
 * So the browser posts here instead. The broker already resolves the
 * oauth2-proxy verdict for every request it serves, and forwards the batch
 * server-to-server behind a shared token the backend checks in constant time.
 * The upstream headers are built here from that verdict — the inbound request's
 * own headers are never copied — so a client that sends
 * `X-Analytics-Identity: admin` changes nothing. (server.mjs also deletes
 * those headers on arrival, so nothing else can be the one that trusts them.)
 *
 * What is NOT forwarded: cookies, the session id, the oauth2 email. The backend
 * needs an anon/admin label and the visitor's address and User-Agent — which it
 * uses to derive a daily-rotating hash and then discards — and nothing else.
 */

/** Beacons are a few hundred bytes; anything larger is not one. */
const MAX_BODY_BYTES = 16 * 1024;
const FORWARD_TIMEOUT_MS = 2000;
/** Matches the backend's own per-visitor ceiling for `POST /api/_e`. */
const RELAY_MAX_PER_HOUR = 600;
const RELAY_WINDOW_MS = 60 * 60 * 1000;
const RELAY_MAX_KEYS = 10_000;

/** Collects the request body, aborting the moment it exceeds the cap. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('beacon too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * The visitor's address as Caddy saw it.
 *
 * **Rightmost** X-Forwarded-For entry. Caddy *appends* the peer it accepted,
 * so anything to the left of that was sent by the client. Reading the left
 * would let `curl -H 'X-Forwarded-For: <victim ip>'` choose the address this
 * relay then asserts behind a valid token — which is enough to mint visitor
 * hashes at will and, given a victim's current IP and exact User-Agent, to
 * write your own page views into their open visit, including an admin one.
 */
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const chain = forwarded.split(',');
    return chain[chain.length - 1].trim();
  }
  return req.socket?.remoteAddress ?? '';
}

export function createAnalyticsRelay({ url, token, log, fetchImpl = fetch, now = Date.now }) {
  if (!url || !token) return null;

  // An unauthenticated endpoint that makes an outbound request is an
  // amplifier, so each address gets a fixed hourly budget here as well as at
  // the backend. Bounded map: cleared wholesale once it grows past the cap,
  // which costs one visitor's budget and never leaks memory.
  const seen = new Map();
  const burstFor = address => {
    const hour = Math.floor(now() / RELAY_WINDOW_MS);
    const key = `${hour}:${address}`;
    const used = (seen.get(key) ?? 0) + 1;
    if (seen.size > RELAY_MAX_KEYS) seen.clear();
    seen.set(key, used);
    return used;
  };

  return async function relay(req, res, viewer) {
    // Answered before the upstream call: the visitor's browser must never wait
    // on measurement, and sendBeacon discards the body anyway.
    const finish = status => {
      if (!res.headersSent) res.writeHead(status, { 'cache-control': 'no-store' });
      res.end();
    };

    let body;
    try {
      body = await readBody(req);
    } catch {
      return finish(204);
    }
    finish(204);
    if (body.length === 0) return;

    const address = clientIp(req);
    if (burstFor(address) > RELAY_MAX_PER_HOUR) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
    try {
      await fetchImpl(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-analytics-token': token,
          'x-analytics-identity': viewer.admin ? 'admin' : 'anon',
          'x-analytics-site': 'apps',
          'x-analytics-ip': address,
          // The backend hashes this with the address and the daily salt, then
          // throws it away; it is also what classifies the visit as a bot.
          'user-agent': typeof req.headers['user-agent'] === 'string'
            ? req.headers['user-agent']
            : '',
        },
        body,
      });
    } catch (error) {
      // A measurement outage is not a visitor-facing failure; they already got
      // their 204.
      log.warn(`analytics relay failed: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
  };
}
