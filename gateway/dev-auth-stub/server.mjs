/**
 * Local stand-in for oauth2-proxy, referenced ONLY by docker-compose.dev.yml.
 *
 * It exists so the broker keeps exactly one authentication code path and gains no bypass
 * flag: in dev the /oauth2/auth subrequest is answered by this, in production by the real
 * proxy. Anyone with `dev_admin=1` is an admin here — never run it anywhere reachable.
 */

import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4180);
const EMAIL = process.env.DEV_ADMIN_EMAIL ?? 'admin@example.test';

/** Local paths only: an open redirect is still an open redirect in dev. */
function safeRedirect(url) {
  const rd = new URL(url, 'http://stub').searchParams.get('rd') ?? '/';
  return rd.startsWith('/') && !rd.startsWith('//') ? rd : '/';
}

http
  .createServer((req, res) => {
    const [path] = (req.url ?? '/').split('?');
    const admin = (req.headers.cookie ?? '').split(';').some(pair => pair.trim() === 'dev_admin=1');

    if (path === '/oauth2/auth') {
      if (!admin) return res.writeHead(401).end();
      return res.writeHead(202, { 'x-auth-request-email': EMAIL }).end();
    }

    if (path === '/oauth2/start' || path === '/oauth2/callback') {
      return res
        .writeHead(302, {
          location: safeRedirect(req.url),
          'set-cookie': 'dev_admin=1; Path=/; HttpOnly; SameSite=Lax',
        })
        .end();
    }

    if (path === '/oauth2/sign_out') {
      return res
        .writeHead(302, {
          location: safeRedirect(req.url),
          'set-cookie': 'dev_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        })
        .end();
    }

    res.writeHead(404, { 'content-type': 'text/plain' }).end('dev-auth-stub: no such route\n');
  })
  .listen(PORT, () => console.log(`[dev-auth-stub] admin=${EMAIL} on ${PORT} — DEV ONLY`));
