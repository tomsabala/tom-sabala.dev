import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';
import TerminalBackground from '../components/TerminalBackground.tsx';
import RobotBackground from '../components/RobotBackground.tsx';
import {
  HOSTED_APPS,
  appEntryUrl,
  appHash,
  filterApps,
  parseAppHash,
  parseManifest,
  resolveApp,
} from './registry.ts';
import type { HostedApp } from './registry.ts';

/**
 * NOT a security boundary. `allow-scripts` + `allow-same-origin` on a same-origin frame
 * cancel the sandbox out: a bundle can reach `parent.document`, so it fully controls
 * apps.tom-sabala.dev including this launcher. That is accepted because public/hosted is
 * first-party code by policy, and the origin is kept credential-free: vercel.json redirects
 * /hosted/** off tom-sabala.dev (the CORS-allowed origin) so bundles never execute where the
 * admin session is usable. `allow-same-origin` is required for their localStorage/IndexedDB.
 * Never drop a third-party or generated bundle in here.
 */
const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads';

function useHashSlug(): string | null {
  const [slug, setSlug] = useState(() => parseAppHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setSlug(parseAppHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return slug;
}

/**
 * Admin sign-in is deliberately invisible here: an anonymous visitor must see no evidence
 * that an admin exists. Same gesture as the portfolio's hidden login — 7 clicks in 2 s.
 */
function useSecretClick(onTrigger: () => void): () => void {
  const stamps = useRef<number[]>([]);
  return () => {
    const now = Date.now();
    stamps.current = [...stamps.current, now].filter(ts => now - ts <= 2000);
    if (stamps.current.length >= 7) {
      stamps.current = [];
      onTrigger();
    }
  };
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function AppFrame({ app }: { app: HostedApp }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const entry = appEntryUrl(app);
  // A service app is a container the broker may still be creating; the frame stays blank for
  // one to three seconds on a cold start, which reads as "broken" without an explicit overlay.
  const starting = app.kind === 'service' && !loaded;
  // A shared app is one instance for everybody; calling it private would be a lie.
  const startingLabel =
    app.kind === 'service' && app.mode === 'shared'
      ? 'Waking the app…'
      : 'Starting your private instance…';

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center gap-3 px-3 sm:px-4 h-14 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a]">
        <a
          href="#/"
          aria-label="Back to all apps"
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="hidden sm:inline">Apps</span>
        </a>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{app.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{app.tagline}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoaded(false);
            setReloadKey(key => key + 1);
          }}
          aria-label="Reload app"
          className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-3.5-7.1" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>

        <a
          href={entry}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${app.name} in a new tab`}
          className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>

        <ThemeToggle />
      </header>

      <div className="relative flex-1 min-h-0">
        {starting && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#111111] text-sm text-gray-500 dark:text-gray-400">
            <span className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-transparent animate-spin" />
            {startingLabel}
          </div>
        )}
        <iframe
          key={reloadKey}
          src={entry}
          title={app.name}
          sandbox={FRAME_SANDBOX}
          allow="fullscreen; clipboard-write"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="h-full w-full border-0 bg-white dark:bg-[#111111]"
        />
      </div>
    </div>
  );
}

function AppCard({ app }: { app: HostedApp }) {
  return (
    <div className="bg-white dark:bg-[#252525] rounded-lg shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-800 p-5 flex flex-col transition-shadow">
      <div className="flex items-start gap-2">
        <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100">{app.name}</h2>
        {app.status === 'wip' && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 whitespace-nowrap">
            work in progress
          </span>
        )}
      </div>

      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 flex-1">{app.tagline}</p>

      {app.tech.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {app.tech.map(tech => (
            <span
              key={tech}
              className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      {app.credit && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {app.credit.url ? (
            <a
              href={app.credit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted hover:text-gray-700 dark:hover:text-gray-200"
            >
              {app.credit.text}
            </a>
          ) : (
            app.credit.text
          )}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <a
          href={appHash(app.slug)}
          className="text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          Open
        </a>
        {app.sourceUrl && (
          <a
            href={app.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium px-3 py-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Source
          </a>
        )}
      </div>
    </div>
  );
}

/** `apps === null` means the manifest is still in flight; only the header renders. */
function AppsIndex({
  apps,
  admin,
  missingSlug,
}: {
  apps: HostedApp[] | null;
  admin: boolean;
  missingSlug: string | null;
}) {
  const [query, setQuery] = useState('');
  const onSecretClick = useSecretClick(() => {
    window.location.href = '/oauth2/start?rd=%2F';
  });
  const matches = filterApps(apps ?? [], query);

  return (
    <div className="min-h-screen px-4 sm:px-8 py-10">
      <TerminalBackground />
      <RobotBackground />
      <div className="max-w-5xl mx-auto">
        <header className="flex items-start gap-4 bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-4 sm:p-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <button
                type="button"
                tabIndex={-1}
                onClick={admin ? undefined : onSecretClick}
                className="select-none cursor-default focus:outline-none"
              >
                Apps
              </button>
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Small apps I built and run here. Some are pure browser builds; others start a
              private instance just for your session.
            </p>
          </div>
          {admin && (
            <a
              href="/oauth2/sign_out?rd=%2F"
              className="mt-1.5 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Sign out
            </a>
          )}
          <ThemeToggle />
        </header>

        {missingSlug && (
          <p className="mt-6 text-sm px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
            No app called <span className="font-mono">{missingSlug}</span>.
          </p>
        )}

        {apps && apps.length > 4 && (
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Filter apps"
            aria-label="Filter apps"
            className="mt-6 w-full sm:w-72 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        )}

        {apps === null ? null : apps.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-[#252525] rounded-lg shadow-sm border border-transparent dark:border-gray-700 px-4 py-3">
            No apps published yet.
          </p>
        ) : matches.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-[#252525] rounded-lg shadow-sm border border-transparent dark:border-gray-700 px-4 py-3">
            Nothing matches that filter.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(app => (
              <AppCard key={app.slug} app={app} />
            ))}
          </div>
        )}

        <footer className="mt-12 text-sm">
          <a
            href="https://tom-sabala.dev"
            className="inline-block px-3 py-1.5 rounded-lg bg-white dark:bg-[#252525] shadow-sm border border-transparent dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            ← tom-sabala.dev
          </a>
        </footer>
      </div>
    </div>
  );
}

/**
 * The gateway serves `/manifest.json`: every public app, plus admin-only ones when the
 * oauth2-proxy session identifies a whitelisted admin. With no gateway in front (plain
 * `npm run dev`) the request fails and the bundled public entries stand in, so the launcher
 * still works from Vercel alone. Admin-only apps are never part of that fallback.
 */
function useManifest(): { apps: HostedApp[] | null; admin: boolean } {
  const [state, setState] = useState<{ apps: HostedApp[] | null; admin: boolean }>({
    apps: null,
    admin: false,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/manifest.json', { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`manifest responded ${response.status}`);
        const body: unknown = await response.json();
        if (cancelled) return;
        const admin =
          typeof body === 'object' && body !== null && 'admin' in body && body.admin === true;
        setState({ apps: parseManifest(body), admin });
      } catch {
        if (cancelled) return;
        setState({ apps: HOSTED_APPS.filter(app => app.access === 'public'), admin: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function AppsLauncher() {
  const slug = useHashSlug();
  const { apps, admin } = useManifest();

  // Resolved against the gateway's list, never the bundled one: an anonymous visitor
  // deep-linking an admin-only app must get the same "No app called X" as an unknown slug.
  const app = slug && apps ? resolveApp(slug, apps) : null;

  // Keyed on slug: switching apps must mount a fresh iframe. Reusing the element would
  // navigate it instead, pushing a history entry and desyncing Back from the header.
  if (app) return <AppFrame key={app.slug} app={app} />;

  // Fall back to the raw hash so malformed requests (#/Sandbox-Check, #/a_b) still say why
  // nothing opened; only the validated slug ever reaches resolveApp/appEntryUrl.
  const requested = slug ?? window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return <AppsIndex apps={apps} admin={admin} missingSlug={(apps && requested) || null} />;
}

export default AppsLauncher;
