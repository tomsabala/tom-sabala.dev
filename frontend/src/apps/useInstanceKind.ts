import { useEffect, useState } from 'react';
import { asRecord } from './json.ts';

/**
 * Which kind of instance this visitor would get, read once from the broker's
 * `GET /boot/<slug>` — the same endpoint the boot overlay polls, but for the one field that
 * has to outlive the overlay: `kind`.
 *
 * It is the difference between work that survives and work that does not. `anon` is a tmpfs
 * container the reaper removes when it goes idle; `admin` is a named volume that comes back;
 * `shared` is one container for everybody, where the app itself separates visitors. Nothing
 * else in the UI can tell them apart, which is exactly the bug this exists to fix.
 *
 * `null` means "we do not know" — no gateway in front (plain `vite dev`, or the Vercel-served
 * copy, where `/boot` 404s), a transport failure, or a body that does not carry one of the
 * three literals. Callers print nothing in that case: a durability label that is only
 * sometimes true is worse than no label.
 */

export type InstanceKind = 'anon' | 'admin' | 'shared';

const KINDS: readonly string[] = ['anon', 'admin', 'shared'];

/**
 * One request per `[slug, enabled, attempt]`; no polling — the answer depends on the
 * caller's identity and the app's mode, neither of which changes while the frame is open.
 * `attempt` is the frame's reload counter, so a retry re-reads it.
 */
export function useInstanceKind(
  slug: string | null,
  enabled: boolean,
  attempt = 0
): InstanceKind | null {
  const [kind, setKind] = useState<InstanceKind | null>(null);

  useEffect(() => {
    if (!enabled || !slug) {
      setKind(null);
      return;
    }

    let cancelled = false;
    setKind(null);

    void (async () => {
      try {
        const response = await fetch(`/boot/${slug}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`boot responded ${response.status}`);
        const body: unknown = await response.json();
        if (cancelled) return;
        const value = asRecord(body).kind;
        setKind(typeof value === 'string' && KINDS.includes(value) ? (value as InstanceKind) : null);
      } catch {
        if (!cancelled) setKind(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, enabled, attempt]);

  return kind;
}
