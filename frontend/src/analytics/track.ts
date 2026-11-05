/**
 * The client half of first-party traffic measurement.
 *
 * It is the *second* tier, and deliberately the weaker one. Every visit is
 * already counted server-side from API calls the page cannot render without
 * (see `analytics_service.py`), so nothing here has to survive a content
 * blocker. What this adds is the part a server cannot see: which SPA route the
 * visitor moved to, how long they stayed, how far they scrolled, and which
 * interactive thing they touched.
 *
 * Three rules shape it:
 *
 * 1. **Engagement gate.** Nothing is ever sent until the page has been visible
 *    for `ENGAGE_MS` *and* the visitor has moved, scrolled, tapped or typed.
 *    Headless scrapers load pages; they do not scroll. A bot that never opens
 *    the gate contributes nothing at all, rather than contributing a row the
 *    server then has to classify.
 * 2. **No identity, no storage.** No cookie, no localStorage, no fingerprint.
 *    The visitor id is derived server-side from a daily-rotating salt, so there
 *    is nothing here to persist and nothing to ask consent for.
 * 3. **Honour an explicit opt-out.** Do Not Track and Global Privacy Control
 *    silence the beacon. The server-observed tier still counts the visit, so
 *    the totals stay honest — only the engagement detail is given up, which is
 *    exactly the trade the visitor asked for.
 */

type EventItem =
  | { type: 'view'; path: string; durationMs?: number; scrollPct?: number; resume?: boolean }
  | { type: 'event'; name: string; path: string; props?: Record<string, unknown> };

interface Config {
  /** Absolute or same-origin URL that accepts the batch. */
  endpoint: string;
}

/** Visible-and-interacted before anything is sent. */
const ENGAGE_MS = 2000;
/** Flush cadence while the page is open; hiding the page flushes immediately. */
const FLUSH_MS = 15000;
/**
 * Must not exceed the backend's `MAX_BATCH`: one flush is one batch, and
 * `ingest` silently discards everything past that cap. The queue can fill
 * before the gate opens — nothing is flushed until then — so the cap, not the
 * flush threshold, is what the backend sees.
 */
const MAX_QUEUE = 20;
/** Half-full is a flush, so a chatty page never sits on a backlog. */
const FLUSH_AT = MAX_QUEUE / 2;

let config: Config | null = null;
let queue: EventItem[] = [];
let engaged = false;
let interacted = false;
let visibleSince = 0;
/** Where this page load landed, so the session's entry path is the entry. */
let landedPath = '/';

/** The view currently being measured, so leaving it can report duration/scroll. */
let current: {
  path: string;
  startedAt: number;
  maxScroll: number | null;
  /** Time already reported for this view by an earlier hide. */
  accumulatedMs: number;
} | null = null;

/**
 * The view a `visibilitychange` to hidden closed, kept so coming back to the
 * same page resumes it instead of opening a second one.
 */
let paused: { path: string; accumulatedMs: number; maxScroll: number | null } | null = null;

function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes') return true;
  // Global Privacy Control is not in lib.dom yet; `in` keeps the read checked
  // instead of asserting a shape onto Navigator.
  return 'globalPrivacyControl' in navigator && navigator.globalPrivacyControl === true;
}

/**
 * How far down the page the visitor has read, or `null` when the question does
 * not apply. A page shorter than the viewport has no scroll depth; reporting
 * 100% for it would put "fully read" next to pages nobody scrolled, which is
 * the kind of flattering number this whole feature exists to avoid.
 */
function scrollPct(): number | null {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)));
}

function currentPath(): string {
  // Hash routing is the apps launcher's whole navigation model (`#/<slug>`), so
  // dropping the fragment there would collapse every unit onto one path.
  const { pathname, hash } = window.location;
  return hash.startsWith('#/') ? `${pathname.replace(/\/$/, '')}${hash.slice(1)}` : pathname;
}

function send(): void {
  // The gate guards the single choke point, not each call site: `pagehide` is
  // the most common exit and used to bypass it, posting exactly the drive-by
  // view the gate exists not to create.
  if (!config || !engaged || queue.length === 0) return;
  const batch = queue;
  queue = [];

  const body = JSON.stringify({
    // Where the visitor landed, not where they are now: the backend uses this
    // as the visit's entry path, and on the apps origin the beacon is usually
    // what creates the visit. Per-event paths are unaffected.
    path: landedPath,
    referrer: document.referrer || undefined,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    events: batch,
  });

  // `text/plain` keeps this a CORS "simple request": no preflight, so a beacon
  // fired during pagehide is not racing an OPTIONS round trip it will lose.
  const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
  if (navigator.sendBeacon?.(config.endpoint, blob)) return;
  // `credentials: 'include'` to match sendBeacon, which always sends them.
  // Without it the fallback drops the JWT cookie cross-origin and an admin's
  // own beacon is filed as anonymous.
  void fetch(config.endpoint, {
    method: 'POST',
    body: blob,
    keepalive: true,
    mode: 'cors',
    credentials: 'include',
  }).catch(() => undefined);
}

function enqueue(item: EventItem): void {
  if (!config) return;
  if (queue.length >= MAX_QUEUE) return;
  queue.push(item);
  if (engaged && queue.length >= FLUSH_AT) send();
}

/** Furthest of two readings, treating "not scrollable" as no reading at all. */
function deepest(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** Seals the current view with what the server could not have measured. */
function closeCurrentView(): void {
  if (!current) return;
  const depth = deepest(current.maxScroll, scrollPct());
  // Cumulative, not per-segment: the server merges with `max(durationMs)`, so
  // a resumed view reports total time on the page and nothing is lost or
  // double-counted.
  const durationMs = current.accumulatedMs + Math.round(performance.now() - current.startedAt);
  enqueue({
    type: 'view',
    path: current.path,
    durationMs,
    ...(depth === null ? {} : { scrollPct: depth }),
    ...(current.accumulatedMs > 0 ? { resume: true } : {}),
  });
  paused = { path: current.path, accumulatedMs: durationMs, maxScroll: depth };
  current = null;
}

function openGate(): void {
  if (engaged || !interacted) return;
  if (Date.now() - visibleSince < ENGAGE_MS) return;
  engaged = true;
  send();
}

function onInteract(): void {
  interacted = true;
  if (current) current.maxScroll = deepest(current.maxScroll, scrollPct());
  openGate();
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') {
    // The only reliable moment to report engagement: `unload` does not fire on
    // mobile Safari, and a tab can be discarded without ever coming back. The
    // view is therefore closed and sent here rather than held open.
    closeCurrentView();
    if (engaged) send();
  } else {
    visibleSince = Date.now();
    // Resume rather than re-open. `closeCurrentView` nulled `current`, so
    // without this the rest of the visit went unmeasured — but calling
    // `trackView` here made one page two rows, double-counted `pageCount` and
    // turned a bounce into a non-bounce on every tab switch.
    const path = currentPath();
    if (paused && paused.path === path) {
      current = {
        path,
        startedAt: performance.now(),
        maxScroll: paused.maxScroll,
        accumulatedMs: paused.accumulatedMs,
      };
      paused = null;
    } else {
      trackView(path);
    }
  }
}

/**
 * Starts measurement for one page load. Safe to call once per entry point;
 * repeated calls are ignored.
 */
export function initAnalytics(options: Config): void {
  if (config || typeof window === 'undefined' || optedOut()) return;
  config = options;
  visibleSince = Date.now();

  for (const type of ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'] as const) {
    window.addEventListener(type, onInteract, { passive: true, once: type !== 'scroll' });
  }
  // Scroll stays subscribed: it is both an interaction signal and the depth
  // measurement, and `once` would freeze the latter at the first wheel notch.
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => {
    closeCurrentView();
    send();
  });
  window.addEventListener('hashchange', () => trackView(currentPath()));
  // The gate is re-attempted on the flush cadence, not only once. The
  // interaction listeners are `once`, so a visitor who clicks before the 2 s
  // visibility requirement has elapsed — a tab opened in the background and
  // focused later — would otherwise have consumed their only chance to open
  // it, and the whole visit would go unreported.
  window.setInterval(() => {
    openGate();
    if (engaged) send();
  }, FLUSH_MS);

  landedPath = currentPath();
  trackView(landedPath);
}

/** Ends the previous view and begins measuring a new one. */
export function trackView(path: string): void {
  if (!config) return;
  if (current?.path === path) return;
  closeCurrentView();
  // A navigation is never a resumption, whatever the previous hide left behind.
  paused = null;
  current = { path, startedAt: performance.now(), maxScroll: scrollPct(), accumulatedMs: 0 };
}

/**
 * Records a named interaction. Names must match the backend's
 * `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`; anything else is dropped there, so the
 * constants below are the vocabulary.
 */
export function trackEvent(name: string, props?: Record<string, unknown>): void {
  // Guarded before touching `location`: call sites are ordinary application
  // code (the field provider, the terminal's command dispatcher) that also
  // runs under a non-DOM test environment, where measurement is simply off.
  if (!config) return;
  enqueue({ type: 'event', name, path: current?.path ?? currentPath(), props });
}
