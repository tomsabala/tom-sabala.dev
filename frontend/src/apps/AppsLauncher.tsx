import { useEffect, useRef, useState } from 'react';
import AppFrame from './AppFrame.tsx';
import AppsIndex from './AppsIndex.tsx';
import { HOSTED_APPS, parseAppHash, parseManifest, resolveApp } from './registry.ts';
import type { HostedApp } from './registry.ts';

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
  const onSecretClick = useSecretClick(() => {
    window.location.href = '/oauth2/start?rd=%2F';
  });

  // Resolved against the gateway's list, never the bundled one: an anonymous visitor
  // deep-linking an admin-only app must get the same "No app called X" as an unknown slug.
  const app = slug && apps ? resolveApp(slug, apps) : null;

  // Keyed on slug: switching apps must mount a fresh iframe. Reusing the element would
  // navigate it instead, pushing a history entry and desyncing Back from the header.
  if (app && apps) return <AppFrame key={app.slug} app={app} index={apps.indexOf(app)} />;

  // Fall back to the raw hash so malformed requests (#/Sandbox-Check, #/a_b) still say why
  // nothing opened; only the validated slug ever reaches resolveApp/appEntryUrl.
  const requested = slug ?? window.location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
  return (
    <AppsIndex
      apps={apps}
      admin={admin}
      missingSlug={(apps && requested) || null}
      onSecretClick={onSecretClick}
    />
  );
}

export default AppsLauncher;
