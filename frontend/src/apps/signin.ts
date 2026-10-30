/**
 * Where the launcher sends a visitor who asked to sign in, and how it remembers where they
 * were.
 *
 * This origin has its own session (oauth2-proxy, `__Host-apps_admin`) and knows nothing
 * about the portfolio's JWT — a cookie set on tom-sabala.dev is invisible here. So an admin
 * arriving from the portfolio is resolved as anonymous and handed a tmpfs instance the
 * reaper deletes. `?signin=1` is the portfolio's way of saying "this visitor has a session
 * over there, send them through oauth2-proxy before you pick an instance".
 *
 * The slug travels in `sessionStorage` rather than inside `rd`: a fragment in `rd` has to
 * survive oauth2-proxy's state round trip and Google's redirect, while `rd=%2F` is the plain
 * form already proven in this repo. If sessionStorage is unavailable (private-mode Safari)
 * the visitor lands signed in on the index and clicks the unit once more — a worse landing,
 * not a broken one.
 */

const PENDING_SLUG_KEY = 'apps.pendingSlug';

/** The launcher's own query flag; `/oauth2/start` is public anyway, so this hides nothing. */
export function wantsSignin(search: string): boolean {
  return new URLSearchParams(search).get('signin') === '1';
}

/** Remembers the unit the visitor was on, then leaves for the sign-in round trip. */
export function requestSignin(slug: string | null): void {
  if (slug) {
    try {
      sessionStorage.setItem(PENDING_SLUG_KEY, slug);
    } catch {
      // No storage: the return trip lands on the index instead. Still worth signing in.
    }
  }
  window.location.href = '/oauth2/start?rd=%2F';
}

/** Read once and delete: a stale slug must not hijack a later visit to the index. */
export function consumePendingSlug(): string | null {
  try {
    const slug = sessionStorage.getItem(PENDING_SLUG_KEY);
    sessionStorage.removeItem(PENDING_SLUG_KEY);
    return slug;
  } catch {
    return null;
  }
}
