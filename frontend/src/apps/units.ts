import { appEntryUrl } from './registry.ts';
import type { HostedApp } from './registry.ts';
import type { BrokerInstance } from './useBrokerInstances.ts';

/**
 * How a unit is worded in the launcher.
 *
 * Everything here comes from the manifest the gateway actually served. The browser-facing
 * manifest strips `image`, `port`, `memoryMb`, `shmSizeMb`, `dataPath` and `readyPath`
 * (see `gateway/broker/lib/manifest.mjs`), so the inspector never displays them — not even
 * from the bundled fallback copy, where they happen to be present. Printing a container's
 * image tag or memory ceiling to an anonymous visitor is exactly the disclosure that
 * stripping exists to prevent, and a value that is only accurate in local development is
 * worse than no value at all.
 */

export interface SpecRow {
  k: string;
  v: string;
}

/** `01`, `02`, … — the unit's identity across the diagram, the inspector and the frame. */
export function unitIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** A bundle has no container, so "session"/"shared" would be meaningless for it. */
export function modeLabel(app: HostedApp): string {
  if (app.kind !== 'service') return 'browser build';
  return app.mode === 'session' ? 'private session' : 'shared';
}

/** The inspector's primary action, worded as what clicking it actually does. */
export function launchLabel(app: HostedApp | null): string {
  if (app === null || app.kind !== 'service') return 'Open the build';
  return app.mode === 'session' ? 'Start my private instance' : 'Wake the shared instance';
}

/** The same distinction one step later, under the frame's boot log. */
export function bootLabel(app: HostedApp): string {
  if (app.kind === 'service' && app.mode === 'shared') return 'Waking the app…';
  return 'Starting your private instance…';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

/** Summed across this app's live containers; the limit is per container, so it scales. */
function memoryRow(running: BrokerInstance[]): string {
  const used = running.reduce(
    (sum, instance) => (typeof instance.memUsedBytes === 'number' ? sum + instance.memUsedBytes : sum),
    0,
  );
  const limit = running.find(instance => typeof instance.memLimitBytes === 'number')?.memLimitBytes;
  if (!used || !limit) return '—';
  return `${formatBytes(used)} / ${formatBytes(limit * running.length)}`;
}

/**
 * Six honest rows for everybody; the three that need the Docker daemon only when the
 * gateway has already told us this session is an admin.
 */
export function specRows(
  app: HostedApp,
  admin: boolean,
  instances: BrokerInstance[] | null,
): SpecRow[] {
  const rows: SpecRow[] = [
    { k: 'MODE', v: modeLabel(app) },
    { k: 'ACCESS', v: app.access },
    { k: 'STATUS', v: app.status === 'live' ? 'live' : 'work in progress' },
    { k: 'STACK', v: app.tech.join(' · ') || '—' },
    { k: 'ENTRY', v: appEntryUrl(app) },
    { k: 'ORIGIN', v: app.credit?.text ?? 'first-party' },
  ];
  if (!admin) return rows;

  const mine = instances?.filter(instance => instance.slug === app.slug) ?? [];
  const coldStart = mine.find(instance => typeof instance.coldStartMs === 'number')?.coldStartMs;

  rows.push(
    { k: 'MEMORY', v: instances === null ? '—' : memoryRow(mine) },
    {
      k: 'INSTANCES',
      v: instances === null ? '—' : mine.length === 0 ? 'none running' : String(mine.length),
    },
    { k: 'COLD START', v: typeof coldStart === 'number' ? formatMs(coldStart) : '—' },
  );
  return rows;
}
