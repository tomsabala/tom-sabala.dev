/**
 * Traffic: first-party visitor measurement, read from this site's own database.
 *
 * Two filters run the whole screen, and both are always visible because both
 * change what every number means.
 *
 * `SITE` separates the three front doors. `apps.tom-sabala.dev` is served by
 * the VPS gateway, not Vercel, and a combined "top pages" list would show two
 * different pages both called `/`.
 *
 * `WHO` separates anonymous visitors from the admin — a dimension here, not a
 * silent exclusion. It defaults to `anon` so the owner's own reloads never
 * inflate the headline, and three panels ignore it on purpose because the
 * split is the point: ANON vs ADMIN, SITE, and HANGAR UNITS OPENED. On the
 * apps origin that split is the most informative number on the page: an admin
 * visit gets a volume-backed instance, an anonymous one gets tmpfs the reaper
 * deletes.
 *
 * Every "—" is an honest gap, never a zero: engagement needs the beacon a
 * blocker may have stopped, and a page shorter than the viewport has no scroll
 * depth to report. For the same reason the panels render only once `data`
 * exists — a failed load shows the error, not a wall of confident zeros.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import * as analyticsRepository from '../../repositories/analyticsRepository.ts';
import type {
  TrafficOverview,
  TrafficQuery,
  TrafficSlice,
  TrafficWindow,
} from '../../types/index.ts';
import { useAdminChrome, usePrimaryAction } from './chrome.tsx';
import {
  Bar,
  ConsolePanel,
  EmptyState,
  MetricTile,
  MutedLine,
  PanelHead,
  formatWhen,
  monoButtonClass,
} from '../../components/console.tsx';
import { apiErrorMessage } from '../../repositories/apiError.ts';

const WINDOWS: readonly TrafficWindow[] = [7, 30, 90, 365];
const SITES = ['all', 'portfolio', 'apps', 'terminal'] as const;
const IDENTITIES = ['anon', 'admin', 'all'] as const;
const BOT_MODES = ['excluded', 'included'] as const;

const DEFAULT_QUERY: TrafficQuery = {
  days: 30,
  site: 'all',
  identity: 'anon',
  includeBots: false,
};

/** Milliseconds, not the seconds `console.tsx`'s `formatDuration` takes. */
function formatMs(ms: number | null): string {
  // "no measurement" and "under a second" are different answers: the first
  // means the beacon never reported, the second means nobody stayed.
  if (ms === null) return '—';
  if (ms < 1000) return '<1s';
  const seconds = Math.round(ms / 1000);
  if (seconds < 90) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

/** Square chip row; the selected one inverts, matching the console's toggles. */
function ChipRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-mut">
        {label}
      </span>
      {options.map(option => (
        <button
          key={String(option)}
          type="button"
          // Re-selecting the active chip would otherwise mint a new query
          // object and refetch the same window.
          onClick={() => option !== value && onChange(option)}
          aria-pressed={option === value}
          className={monoButtonClass(option === value ? 'accent' : 'muted', 'sm')}
        >
          {format ? format(option) : String(option)}
        </button>
      ))}
    </div>
  );
}

interface Row {
  key: string;
  label: ReactNode;
  meta: ReactNode;
  /** 0–100; omit for a list with no magnitude to compare. */
  bar?: number;
}

/**
 * Every list on this screen is this list: a label, a right-aligned measure, and
 * optionally a proportional bar. One component so twelve panels cannot drift
 * into twelve slightly different rows.
 */
function RowList({ rows, empty }: { rows: Row[]; empty: string }) {
  if (rows.length === 0) return <EmptyState>{empty}</EmptyState>;
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      {rows.map(row => (
        <div key={row.key} className="flex flex-col gap-1.5 min-w-0">
          <span className="flex justify-between gap-3 font-mono text-[11px] leading-none">
            <span className="truncate">{row.label}</span>
            <span className="text-mut whitespace-nowrap">{row.meta}</span>
          </span>
          {row.bar !== undefined && <Bar pct={row.bar} height={6} />}
        </div>
      ))}
    </div>
  );
}

/** Session-count breakdowns, scaled against the largest row. */
function sliceRows(slices: TrafficSlice[], withVisitors = false): Row[] {
  const max = slices.reduce((peak, slice) => Math.max(peak, slice.sessions), 0);
  return slices.map(slice => ({
    key: slice.label,
    label: slice.label,
    meta: withVisitors ? `${slice.visitors} visitors · ${slice.sessions}` : slice.sessions,
    bar: max > 0 ? Math.round((slice.sessions / max) * 100) : 0,
  }));
}

/**
 * Daily visitors as a bar strip. Deliberately not a line chart: at this volume
 * the honest read is "which days had anyone at all", and interpolating between
 * two points invents traffic on the days between them.
 */
function Sparks({ data }: { data: TrafficOverview['series'] }) {
  const max = data.reduce((peak, point) => Math.max(peak, point.visitors), 0);
  if (max === 0) return <EmptyState>No visits recorded in this window.</EmptyState>;
  return (
    <div className="px-5 py-4">
      {/* 365 bars at a 2px minimum are ~1.5k wide: scroll the strip rather
          than let it push the panel off a phone screen. */}
      <div className="overflow-x-auto">
        <div className="flex items-end gap-[2px] h-[88px]">
          {data.map(point => (
            <div
              key={point.day}
              title={`${point.day} · ${point.visitors} visitors · ${point.pageViews} views`}
              className="flex-1 min-w-[2px] bg-acc"
              style={{ height: `${Math.max(2, Math.round((point.visitors / max) * 100))}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] leading-none text-mut">
        <span>{data[0]?.day}</span>
        <span>peak {max}/day</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export default function AdminTraffic(): JSX.Element {
  const { notify } = useAdminChrome();
  const [query, setQuery] = useState<TrafficQuery>(DEFAULT_QUERY);
  const [data, setData] = useState<TrafficOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Monotonic request id: changing filters quickly must not let a slow earlier
  // response overwrite the one the chips now describe.
  const latest = useRef(0);

  const load = useCallback(async (next: TrafficQuery): Promise<boolean> => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await analyticsRepository.getOverview(next);
      if (id !== latest.current) return false;
      // A `success: false` envelope is a failure the same as a throw; using
      // `result.data` regardless would render undefined panels.
      if (result.success === false) throw new Error('Traffic unavailable');
      setData(result.data);
      setError(null);
      return true;
    } catch (err) {
      if (id !== latest.current) return false;
      setData(null);
      setError(apiErrorMessage(
        err,
        'Traffic unavailable — the backend could not read the analytics tables.',
      ));
      return false;
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(query);
  }, [load, query]);

  usePrimaryAction(
    {
      label: loading ? 'Refreshing…' : 'Refresh',
      onClick: () => {
        void load(query)
          .then(ok => ok && notify('ok', 'Traffic refreshed'))
          .catch(() => undefined);
      },
      disabled: loading,
    },
    [loading, load, query, notify],
  );

  const summary = data?.summary;
  const funnelMax = (data?.funnel ?? []).reduce((peak, step) => Math.max(peak, step.visits), 0);

  return (
    <div className="flex flex-col gap-4">
      <ConsolePanel className="px-5 py-4 flex flex-col gap-3">
        <ChipRow
          label="WINDOW"
          options={WINDOWS}
          value={query.days}
          onChange={days => setQuery(q => ({ ...q, days }))}
          format={days => `${days}d`}
        />
        <ChipRow
          label="SITE"
          options={SITES}
          value={query.site}
          onChange={site => setQuery(q => ({ ...q, site }))}
        />
        <ChipRow
          label="WHO"
          options={IDENTITIES}
          value={query.identity}
          onChange={identity => setQuery(q => ({ ...q, identity }))}
        />
        <ChipRow
          label="BOTS"
          options={BOT_MODES}
          value={query.includeBots ? 'included' : 'excluded'}
          onChange={choice => setQuery(q => ({ ...q, includeBots: choice === 'included' }))}
        />
        {data && (
          // The only place the window's actual edges are visible — "30d"
          // includes today, which the dates make obvious.
          <MutedLine>
            {data.from.slice(0, 10)} → {data.to.slice(0, 10)} · UTC
          </MutedLine>
        )}
      </ConsolePanel>

      {error && (
        <ConsolePanel className="px-5 py-4">
          <MutedLine>{error}</MutedLine>
        </ConsolePanel>
      )}

      <ConsolePanel>
        <PanelHead label="DAILY VISITORS" />
        {data ? (
          <Sparks data={data.series} />
        ) : (
          <EmptyState>{error ? 'Nothing to show.' : 'Loading…'}</EmptyState>
        )}
      </ConsolePanel>

      {data && summary && (
        // Dimmed while a refetch is in flight: the panels below still show the
        // previous window's numbers under the new chips until it lands.
        <div
          className="flex flex-col gap-4"
          aria-busy={loading}
          style={{ opacity: loading ? 0.45 : 1 }}
        >
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))' }}
          >
            <MetricTile label="VISITORS" value={summary.visitors} />
            <MetricTile label="VISITS" value={summary.sessions} />
            <MetricTile label="PAGE VIEWS" value={summary.pageViews} />
            <MetricTile label="BOUNCE" value={summary.sessions ? pct(summary.bounceRate) : '—'} />
            <MetricTile label="AVG ON PAGE" value={formatMs(summary.avgDurationMs)} />
            <MetricTile label="BOT VISITS" value={summary.botSessions} />
          </div>

          {summary.pageViews > 0 && (
            <MutedLine>
              beacon reached {summary.beaconCoverage}% of measured views — the rest were counted
              server-side from content requests a blocker cannot remove. A low number here is the
              blocker rate, not a fault.
            </MutedLine>
          )}

          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))' }}
          >
            <ConsolePanel>
              <PanelHead label="ANON vs ADMIN" />
              <RowList rows={sliceRows(data.identities, true)} empty="No visits in this window." />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="SITE" />
              <RowList rows={sliceRows(data.sites)} empty="No visits in this window." />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="REFERRERS" />
              <RowList
                rows={sliceRows(
                  data.referrers.map(r => ({ label: r.host, sessions: r.sessions, visitors: r.visitors })),
                  true,
                )}
                empty="Nothing linked here yet."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="PAGES" />
              <RowList
                rows={data.pages.map(page => ({
                  key: page.path,
                  label: page.path,
                  meta: `${page.views} · ${formatMs(page.avgDurationMs)} · ${pct(page.avgScrollPct)}`,
                }))}
                empty="No page views in this window."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="WORK PAGES" />
              <RowList
                rows={data.work.map(row => ({
                  key: row.slug,
                  label: row.title,
                  meta: `${row.visits} visits · ${formatMs(row.avgDurationMs)}`,
                }))}
                empty="No project detail pages opened in this window."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="HANGAR UNITS OPENED" />
              <RowList
                rows={data.apps.map(row => ({
                  key: row.slug,
                  label: row.slug,
                  meta: `${row.opens} opens · ${row.anon} anon / ${row.admin} admin`,
                }))}
                empty="No units opened in this window."
              />
            </ConsolePanel>

            <ConsolePanel>
              {/* The funnel spans whatever SITE is selected; with `all` the apps
                  and terminal origins are in `landed` and cannot reach the rest. */}
              <PanelHead label={`FUNNEL · ${data.site}`} />
              <RowList
                // Five confident zeros are worse than an empty state: `funnel`
                // always returns its five steps, so the empty string below was
                // otherwise unreachable.
                rows={funnelMax === 0 ? [] : data.funnel.map(step => ({
                  key: step.step,
                  label: step.step,
                  meta: step.visits,
                  bar: Math.round((step.visits / funnelMax) * 100),
                }))}
                empty="Nothing to chart yet."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="INTERACTIONS" />
              <RowList
                rows={data.events.map(row => ({
                  key: row.name,
                  label: row.name,
                  meta: `${row.visits} visits · ${row.count}`,
                }))}
                empty="No client interactions recorded — expected if every visitor blocks the beacon."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="DEVICE" />
              <RowList rows={sliceRows(data.devices)} empty="No visits in this window." />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="BROWSER" />
              <RowList rows={sliceRows(data.browsers)} empty="No visits in this window." />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="TIME ZONE" />
              <RowList
                rows={sliceRows(data.timezones)}
                empty="Timezone comes from the beacon only; nothing reached it in this window."
              />
            </ConsolePanel>

            <ConsolePanel>
              <PanelHead label="BOTS REFUSED" />
              <RowList
                rows={sliceRows(data.bots)}
                empty="No crawler traffic classified in this window."
              />
            </ConsolePanel>
          </div>

          <ConsolePanel>
            <PanelHead label="RECENT VISITS" />
            <RowList
              rows={data.recent.map(visit => ({
                key: String(visit.id),
                label: (
                  <>
                    <span className={visit.identity === 'admin' ? 'text-acct' : 'text-mut'}>
                      {visit.site}/{visit.identity}
                    </span>{' '}
                    {visit.entryPath ?? '/'}
                  </>
                ),
                meta: [
                  formatWhen(visit.lastSeenAt),
                  visit.referrerHost ?? 'direct',
                  visit.device ?? '—',
                  visit.country ?? visit.timezone ?? '—',
                  `${visit.pageCount}p`,
                ].join(' · '),
              }))}
              empty="Nothing recorded yet."
            />
          </ConsolePanel>
        </div>
      )}
    </div>
  );
}
