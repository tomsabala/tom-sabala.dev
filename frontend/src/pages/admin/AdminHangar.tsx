/**
 * Hangar: one card per catalogued unit, joined with whatever the broker reports.
 *
 * The broker has no mutation surface — nothing restarts, redeploys or re-scopes a unit over
 * HTTP — so those controls are rendered disabled with the reason in their tooltip rather
 * than wired to an endpoint that does not exist. The primary action is a refresh.
 */
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { HOSTED_APPS, appEntryUrl } from '../../apps/registry.ts';
import * as hangarRepository from '../../repositories/hangarRepository.ts';
import type { HangarStatus } from '../../types/index.ts';
import { useAdminChrome, usePrimaryAction } from './chrome.tsx';
import {
  Bar,
  ConsolePanel,
  MetricTile,
  MonoButton,
  MutedLine,
  formatBytes,
} from '../../components/console.tsx';

const NO_MUTATION = 'The gateway broker exposes no mutation endpoint — status only';

/** A bundle is always static; a service is healthy only while the broker reports a unit up. */
function cardState(down: boolean, isBundle: boolean, liveCount: number): string {
  if (down) return '—';
  if (isBundle) return 'static';
  return liveCount > 0 ? 'healthy' : 'idle';
}

/**
 * Seconds/minutes, never a clock: the broker reports an age, and the only question this
 * answers is whether an instance is still being used.
 */
function formatAge(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 90 ? `${minutes}m` : `${Math.round(minutes / 60)}h`;
}

export default function AdminHangar(): JSX.Element {
  const { notify } = useAdminChrome();
  const [status, setStatus] = useState<HangarStatus | null>(null);
  const [down, setDown] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await hangarRepository.getInstances());
      setDown(false);
    } catch {
      setStatus(null);
      setDown(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  usePrimaryAction(
    {
      label: loading ? 'Refreshing…' : 'Refresh',
      onClick: () => {
        load();
        notify('ok', 'Hangar status refreshed');
      },
      disabled: loading,
    },
    [loading, load, notify]
  );

  return (
    <div className="flex flex-col gap-4">
      {down && (
        <ConsolePanel className="px-5 py-4">
          <MutedLine>
            status unavailable — the backend could not reach the gateway broker. Units are still
            catalogued below; live numbers resume once a broker with /instances is deployed.
          </MutedLine>
        </ConsolePanel>
      )}
      {status && (
        <MutedLine>
          caps · total {status.caps.total} · anon {status.caps.anon} · admin {status.caps.admin}
        </MutedLine>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}
      >
        {HOSTED_APPS.map(app => {
          const units = (status?.instances ?? []).filter(i => i.slug === app.slug);
          // `ready` is a broker-started container past its health probe; `running` is one
          // the broker found already up. Anything else (starting, failed, exited) is not live.
          const live = units.filter(u => u.state === 'ready' || u.state === 'running');
          const used = units.reduce((sum, u) => sum + (u.memUsedBytes ?? 0), 0);
          const limit = units.reduce((sum, u) => sum + (u.memLimitBytes ?? 0), 0);
          const cold = units
            .map(u => u.coldStartMs)
            .filter((ms): ms is number => typeof ms === 'number');
          const state = cardState(down, app.kind === 'bundle', live.length);

          return (
            <ConsolePanel key={app.slug} className="p-5 flex flex-col gap-3.5">
              <div className="flex justify-between gap-3 font-mono text-[11px] leading-none font-medium tracking-[0.1em]">
                <span className="text-mut truncate">{appEntryUrl(app)}</span>
                <span className="text-acct whitespace-nowrap">● {state}</span>
              </div>
              <span className="font-display font-extrabold text-[26px] sm:text-[30px] leading-none tracking-[-0.02em] [font-stretch:115%] break-words">
                {app.name}
              </span>
              <div className="grid grid-cols-3 gap-2">
                <MetricTile label="INSTANCES" value={down ? '—' : String(units.length)} />
                <MetricTile
                  label="COLD START"
                  value={cold.length > 0 ? `${(Math.max(...cold) / 1000).toFixed(1)} s` : '—'}
                />
                <MetricTile label="MODE" value={app.kind === 'service' ? app.mode : 'bundle'} />
              </div>
              <div className="flex flex-col gap-1.5 font-mono text-[11px] leading-none">
                <span className="flex justify-between gap-2">
                  <span className="text-mut">MEMORY</span>
                  <span>
                    {limit > 0 ? `${formatBytes(used)} / ${formatBytes(limit)}` : '—'}
                  </span>
                </span>
                <Bar pct={limit > 0 ? Math.round((used / limit) * 100) : 0} />
              </div>
              {units.length > 0 && (
                <div className="flex flex-col gap-1 font-mono text-[11px] leading-none">
                  {units.map(unit => (
                    <span key={unit.name} className="flex justify-between gap-2">
                      <span className={unit.kind === 'anon' ? 'text-mut' : 'text-acct'}>
                        {unit.kind}
                      </span>
                      <span className="text-mut truncate">
                        {[
                          unit.state,
                          typeof unit.memUsedBytes === 'number' ? formatBytes(unit.memUsedBytes) : null,
                          unit.lastSeenMs === null ? null : `seen ${formatAge(unit.lastSeenMs)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                <MonoButton disabled title={NO_MUTATION}>
                  Restart
                </MonoButton>
                <MonoButton disabled title={NO_MUTATION}>
                  Logs
                </MonoButton>
                <MonoButton tone="muted" disabled title={NO_MUTATION}>
                  Set admin-only
                </MonoButton>
              </div>
            </ConsolePanel>
          );
        })}
      </div>
    </div>
  );
}
