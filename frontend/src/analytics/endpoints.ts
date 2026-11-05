/**
 * Where each origin's beacon goes, and why they are not the same place.
 *
 * `tom-sabala.dev` and `terminal.tom-sabala.dev` post straight to the backend:
 * same deployment, already in its CORS_ORIGINS, and the visit is already being
 * counted server-side off the content requests these pages make anyway.
 *
 * `apps.tom-sabala.dev` posts to its own gateway instead. It is a separate
 * origin served by the VPS (Vercel is not in its request path), it is
 * deliberately absent from CORS_ORIGINS, and its admin session is an
 * oauth2-proxy cookie the backend cannot verify. The broker already knows who
 * the caller is for every request it serves, so it relays the batch with that
 * verdict attached — which is the only way an `admin` row from this origin is
 * ever believable.
 *
 * Neither path is named `analytics`, `collect`, `track` or `insights`: those
 * are the words filter lists match on, and `/_vercel/insights` is precisely
 * why the old numbers were wrong.
 */

// Deliberately re-derived rather than imported from `repositories/apiClient`:
// that module pulls in axios and the CSRF cookie reader, and this constant is
// used by the apps and terminal bundles, which have no other reason to carry
// either. Do not "deduplicate" this into an import.
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/+$/, '');

/** Portfolio and terminal: straight to the API that already serves their content. */
export const BACKEND_BEACON = `${API_BASE}/_e`;

/**
 * Apps launcher: same-origin, handled by Caddy → broker. Under `vite dev` there
 * is no gateway and the POST 404s, which is the correct outcome — a local dev
 * session is not traffic.
 */
export const GATEWAY_BEACON = '/_e';
