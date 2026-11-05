/**
 * The engagement gate, which is the one piece of this feature whose failure
 * mode is silence: if the gate never opens, an entire visit's client-side
 * measurement is dropped and nothing anywhere reports an error.
 *
 * Exercised against a hand-written DOM stub rather than jsdom. The stub is
 * ~50 lines, the suite runs in the `node` environment the rest of the repo
 * uses, and — the part that matters — it honours `once: true`, which is
 * precisely the listener option the gate bug turned on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Listener {
  fn: () => void;
  once: boolean;
}

interface Stub {
  fire: (type: string) => void;
  /** Each beacon's JSON body, so assertions can read what was actually sent. */
  beacons: string[];
  setVisibility: (state: 'visible' | 'hidden') => void;
  setHash: (hash: string) => void;
}

function installDom(): Stub {
  const listeners = new Map<string, Listener[]>();
  const beacons: string[] = [];

  const addEventListener = (
    type: string,
    fn: () => void,
    options?: { once?: boolean },
  ) => {
    const bucket = listeners.get(type) ?? [];
    bucket.push({ fn, once: Boolean(options?.once) });
    listeners.set(type, bucket);
  };

  const win = {
    addEventListener,
    removeEventListener: () => {},
    innerHeight: 800,
    scrollY: 0,
    location: { pathname: '/', hash: '' },
    // Delegates to the globals, which `vi.useFakeTimers()` has replaced — no
    // test here ever waits on the wall clock; time only moves via
    // `advanceTimersByTimeAsync`.
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
  };
  const doc = {
    addEventListener,
    removeEventListener: () => {},
    visibilityState: 'visible',
    referrer: '',
    documentElement: { scrollHeight: 4000 },
  };

  const define = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

  define('window', win);
  define('document', doc);
  define('performance', { now: () => Date.now() });
  define('Blob', class {
    body: string;
    constructor(parts: string[]) {
      this.body = String(parts[0]);
    }
  });
  define('navigator', {
    doNotTrack: null,
    sendBeacon: (_url: string, blob: { body: string }) => {
      beacons.push(blob.body);
      return true;
    },
  });

  return {
    beacons,
    fire: (type: string) => {
      const bucket = listeners.get(type) ?? [];
      listeners.set(type, bucket.filter(entry => !entry.once));
      for (const entry of bucket) entry.fn();
    },
    setVisibility: state => {
      doc.visibilityState = state;
      const bucket = listeners.get('visibilitychange') ?? [];
      for (const entry of bucket) entry.fn();
    },
    setHash: hash => {
      win.location.hash = hash;
      const bucket = listeners.get('hashchange') ?? [];
      listeners.set('hashchange', bucket.filter(entry => !entry.once));
      for (const entry of bucket) entry.fn();
    },
  };
}

async function freshTracker() {
  vi.resetModules();
  return import('../track.ts');
}

describe('engagement gate', () => {
  let dom: Stub;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    dom = installDom();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends nothing for a page that is never interacted with', async () => {
    const { initAnalytics, trackEvent } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });
    trackEvent('field.algo', { algo: 'planner' });

    await vi.advanceTimersByTimeAsync(60_000);

    expect(dom.beacons).toHaveLength(0);
  });

  it('opens once the visitor has interacted and the page has been visible long enough', async () => {
    const { initAnalytics, trackEvent } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });
    trackEvent('field.algo', { algo: 'planner' });

    await vi.advanceTimersByTimeAsync(2_500);
    dom.fire('pointerdown');

    expect(dom.beacons).toHaveLength(1);
    expect(JSON.parse(dom.beacons[0]).events).toHaveLength(1);
  });

  it('still opens when the only interaction lands before the visibility threshold', async () => {
    // The regression: `pointerdown`/`keydown`/`touchstart` are registered
    // `once`, so an interaction that arrives too early used to consume the
    // visitor's only chance to open the gate — a tab opened in the background
    // and focused a minute later reported nothing at all.
    const { initAnalytics, trackEvent } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });
    trackEvent('field.algo', { algo: 'planner' });

    await vi.advanceTimersByTimeAsync(200);
    dom.fire('pointerdown');
    expect(dom.beacons).toHaveLength(0);

    // No further interaction — only the flush cadence re-attempting the gate.
    await vi.advanceTimersByTimeAsync(20_000);

    expect(dom.beacons.length).toBeGreaterThan(0);
  });

  it('resumes the same view when the tab comes back, rather than opening a second', async () => {
    // The inflation this replaced: the visible branch called `trackView`, so
    // one page became two `page_views` rows, `page_count` was bumped twice and
    // a single tab switch turned a bounce into a non-bounce.
    const { initAnalytics } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });

    await vi.advanceTimersByTimeAsync(3_000);
    dom.fire('pointerdown');
    dom.setVisibility('hidden');
    expect(dom.beacons).toHaveLength(1);

    const first = JSON.parse(dom.beacons[0]).events[0];
    expect(first.type).toBe('view');
    expect(first.resume).toBeUndefined();

    dom.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(5_000);
    dom.fire('pagehide');

    expect(dom.beacons).toHaveLength(2);
    const second = JSON.parse(dom.beacons[1]).events[0];
    expect(second.type).toBe('view');
    expect(second.path).toBe(first.path);
    // Flagged as a resumption, and cumulative: the server merges with
    // `max(durationMs)`, so the row ends up with total time on the page.
    expect(second.resume).toBe(true);
    expect(second.durationMs).toBeGreaterThan(first.durationMs);
  });

  it('sends nothing on pagehide when the gate never opened', async () => {
    // `pagehide` is the most common exit path and used to flush unguarded,
    // posting exactly the drive-by view the engagement gate exists to refuse.
    const { initAnalytics } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });

    await vi.advanceTimersByTimeAsync(500);
    dom.fire('pagehide');

    expect(dom.beacons).toHaveLength(0);
  });

  it('reports a hash navigation as a new view, keeping the landed entry path', async () => {
    // `hashchange` is the only view source on the apps origin (`#/<slug>`).
    const { initAnalytics } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });

    await vi.advanceTimersByTimeAsync(2_500);
    dom.fire('pointerdown');
    dom.setHash('#/famcfo');
    dom.fire('pagehide');

    const bodies = dom.beacons.map(raw => JSON.parse(raw));
    const views = bodies.flatMap(body => body.events).filter(item => item.type === 'view');
    expect(views.map(item => item.path)).toEqual(['/', '/famcfo']);
    // The batch's own path is where the visit landed, not where it ended.
    expect(bodies[bodies.length - 1].path).toBe('/');
  });

  it('stays silent for a visitor who sends Do Not Track', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { doNotTrack: '1', sendBeacon: () => true },
      configurable: true,
      writable: true,
    });

    const { initAnalytics, trackEvent } = await freshTracker();
    initAnalytics({ endpoint: '/_e' });
    trackEvent('field.algo', { algo: 'planner' });

    await vi.advanceTimersByTimeAsync(3_000);
    dom.fire('pointerdown');

    expect(dom.beacons).toHaveLength(0);
  });
});
