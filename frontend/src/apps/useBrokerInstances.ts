import { useEffect, useState } from 'react';

/**
 * The broker's admin-gated `GET /instances`, fetched straight from this origin because the
 * oauth2-proxy cookie is already attached here. Anonymous visitors never call it: the
 * manifest tells us whether this session is an admin, and 401 is the broker's answer
 * otherwise.
 *
 * Deliberately a local shape rather than a shared one with the portfolio's
 * `HangarStatus`: that type mirrors the same payload arriving through the backend proxy,
 * and the apps bundle stays independent of the main app's modules.
 */

export interface BrokerInstance {
  slug: string;
  state: string;
  /** Absent when the Docker socket proxy refuses container stats. */
  memUsedBytes: number | null;
  memLimitBytes: number | null;
  coldStartMs: number | null;
}

function parseInstances(value: unknown): BrokerInstance[] {
  if (!Array.isArray(value)) return [];
  const parsed: BrokerInstance[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.slug !== 'string') continue;
    parsed.push({
      slug: entry.slug,
      state: typeof entry.state === 'string' ? entry.state : 'unknown',
      memUsedBytes: typeof entry.memUsedBytes === 'number' ? entry.memUsedBytes : null,
      memLimitBytes: typeof entry.memLimitBytes === 'number' ? entry.memLimitBytes : null,
      coldStartMs: typeof entry.coldStartMs === 'number' ? entry.coldStartMs : null,
    });
  }
  return parsed;
}

/** `null` while in flight or when the broker refused — the inspector then renders dashes. */
export function useBrokerInstances(enabled: boolean): BrokerInstance[] | null {
  const [instances, setInstances] = useState<BrokerInstance[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/instances', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`instances responded ${response.status}`);
        const body: unknown = await response.json();
        if (cancelled) return;
        const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
        setInstances(parseInstances(record.instances));
      } catch {
        if (!cancelled) setInstances(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return instances;
}
