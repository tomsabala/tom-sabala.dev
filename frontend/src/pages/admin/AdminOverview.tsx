/**
 * Mission control: four KPI tiles over the pipeline funnel, the latest scout run, an inbox
 * preview and the hangar health strip. Every number here comes from `/dashboard/stats`
 * except the unit tiles, which need the broker proxy and degrade to a dash when it is down.
 */
import { useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as agentRepository from '../../repositories/agentRepository.ts';
import * as contactRepository from '../../repositories/contactRepository.ts';
import * as hangarRepository from '../../repositories/hangarRepository.ts';
import { HOSTED_APPS } from '../../apps/registry.ts';
import type { AgentFinding, ContactSubmission, HangarStatus } from '../../types/index.ts';
import AgentRunModal from '../../components/AgentRunModal.tsx';
import { useAdminChrome, usePrimaryAction } from './chrome.tsx';
import { BOARD_COLUMNS } from './applicationStatus.ts';
import {
  Bar,
  ConsolePanel,
  MetricTile,
  MutedLine,
  PanelHead,
  VerdictChip,
  formatBytes,
  formatDuration,
  formatWhen,
} from '../../components/console.tsx';

interface Kpi {
  k: string;
  v: string;
  d: string;
  to: string;
}

/** Every panel on this screen hands off to the screen it summarises. */
function OpenLink({ to }: { to: string }) {
  return (
    <Link to={to} className="font-mono text-[11px] leading-none text-mut no-underline">
      open →
    </Link>
  );
}

export default function AdminOverview(): JSX.Element {
  const { stats, statsError, refreshStats, notify } = useAdminChrome();
  const navigate = useNavigate();
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [inbox, setInbox] = useState<ContactSubmission[]>([]);
  const [hangar, setHangar] = useState<HangarStatus | null>(null);
  const [hangarDown, setHangarDown] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const latestRun = stats?.latestRun ?? null;
  const runInFlight = latestRun?.status === 'queued' || latestRun?.status === 'running';

  usePrimaryAction(
    {
      label: runInFlight ? 'Scout running…' : 'Run scout',
      onClick: () => setRunOpen(true),
      disabled: runInFlight,
      title: runInFlight ? 'A sweep is already running' : undefined,
    },
    [runInFlight]
  );

  useEffect(() => {
    if (!latestRun) {
      setFindings([]);
      return;
    }
    let cancelled = false;
    agentRepository
      .getFindings(latestRun.id)
      .then(res => {
        if (!cancelled && res.success) setFindings(res.data as AgentFinding[]);
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      });
    return () => {
      cancelled = true;
    };
  }, [latestRun?.id]);

  useEffect(() => {
    let cancelled = false;
    contactRepository
      .getSubmissions(5, 0, 'all', false)
      .then(res => {
        if (!cancelled && res.success) setInbox(res.data.submissions ?? []);
      })
      .catch(() => {
        if (!cancelled) setInbox([]);
      });
    hangarRepository
      .getInstances()
      .then(status => {
        if (!cancelled) setHangar(status);
      })
      .catch(() => {
        if (!cancelled) setHangarDown(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const instances = hangar?.instances ?? [];
  // The broker reports `ready` once it has health-probed a container and `running` for one
  // it did not start itself (a container that outlived the broker process). Both are live;
  // `starting`, `failed` and the raw Docker states are not.
  const liveSlugs = new Set(
    instances.filter(i => i.state === 'ready' || i.state === 'running').map(i => i.slug),
  );
  const applyCount = findings.filter(f => f.verdict === 'apply').length;

  const funnel = useMemo(() => {
    const byStatus = stats?.applicationsByStatus ?? {};
    const rows = BOARD_COLUMNS.map(col => ({
      label: col.label,
      n: col.statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
      accent: col.key === 'offer',
      closed: col.key === 'closed',
    }));
    const max = Math.max(1, ...rows.map(r => r.n));
    return rows.map(r => ({ ...r, w: Math.round((r.n / max) * 100) }));
  }, [stats]);

  const kpis: Kpi[] = [
    {
      k: 'ACTIVE APPLICATIONS',
      v: stats ? String(stats.activeApplications) : '—',
      d: `${stats?.applicationsByStatus?.interview ?? 0} at interview stage`,
      to: '/admin/pipeline',
    },
    {
      k: 'FINDINGS',
      v: latestRun ? String(latestRun.findings_count) : '—',
      d: latestRun ? `${applyCount} marked apply by scout` : 'no scout run yet',
      to: '/admin/pipeline',
    },
    {
      k: 'UNREAD',
      v: stats ? String(stats.unreadMessages) : '—',
      d: 'contact form',
      to: '/admin/inbox',
    },
    {
      k: 'UNITS LIVE',
      v: hangarDown || !hangar ? '—' : `${liveSlugs.size} / ${HOSTED_APPS.length}`,
      d: hangarDown ? 'status unavailable' : `${instances.length} instances running`,
      to: '/admin/hangar',
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {statsError && <MutedLine>{statsError}</MutedLine>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ln border border-ln2">
        {kpis.map(kpi => (
          <button
            key={kpi.k}
            type="button"
            onClick={() => navigate(kpi.to)}
            className="bg-bg text-ink text-left border-0 px-4 py-4 sm:px-5 flex flex-col gap-2.5 cursor-pointer min-w-0"
          >
            <span className="font-mono text-[10px] leading-none tracking-[0.12em] text-mut truncate">
              {kpi.k}
            </span>
            <span className="font-display font-extrabold text-[32px] sm:text-[40px] leading-none tracking-[-0.02em] [font-stretch:115%]">
              {kpi.v}
            </span>
            <span className="font-mono text-[11px] leading-[1.3] text-ink2">{kpi.d}</span>
          </button>
        ))}
      </div>

      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}
      >
        <ConsolePanel className="p-5 flex flex-col gap-3.5">
          <PanelHead
            label="PIPELINE · FLOW"
            padded={false}
            right={<OpenLink to="/admin/pipeline" />}
          />
          {funnel.map(row => (
            <div
              key={row.label}
              className="grid items-center gap-3 font-mono text-[12px] leading-none"
              style={{ gridTemplateColumns: '92px 1fr 32px' }}
            >
              <span className="text-ink2 uppercase tracking-[0.06em] truncate">{row.label}</span>
              <Bar
                pct={row.w}
                height={18}
                color={row.accent ? 'var(--acc)' : row.closed ? 'var(--ln2)' : 'var(--ink)'}
              />
              <span className="text-right">{row.n}</span>
            </div>
          ))}
        </ConsolePanel>

        <ConsolePanel className="p-5 flex flex-col gap-3.5">
          <PanelHead
            label={latestRun ? `SCOUT AGENT · RUN #${latestRun.id}` : 'SCOUT AGENT'}
            padded={false}
            right={
              <span className="font-mono text-[11px] leading-none text-acct whitespace-nowrap">
                {latestRun
                  ? `● ${latestRun.status} · ${formatDuration(latestRun.duration_seconds)}`
                  : '○ idle'}
              </span>
            }
          />
          {latestRun ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricTile label="COMPANIES" value={latestRun.companies_total} />
                <MetricTile label="POSTINGS" value={latestRun.postings_seen} />
                <MetricTile label="NEW" value={latestRun.postings_new} />
                <MetricTile label="FINDINGS" value={latestRun.findings_count} />
              </div>
              {findings.slice(0, 3).map(f => (
                <div
                  key={f.id}
                  className="grid items-center gap-3 py-2.5 border-t border-ln"
                  style={{ gridTemplateColumns: '40px minmax(0,1fr) auto' }}
                >
                  <span className="font-mono text-[14px] leading-none font-medium text-acct">
                    {f.score ?? '—'}
                  </span>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-semibold text-[15px] leading-tight truncate">
                      {f.posting.title}
                    </span>
                    <span className="font-mono text-[11px] leading-[1.3] text-mut truncate">
                      {f.company.name}
                      {f.posting.location ? ` · ${f.posting.location}` : ''}
                    </span>
                  </div>
                  <VerdictChip verdict={f.verdict} />
                </div>
              ))}
              {findings.length === 0 && <MutedLine>No findings in the latest run.</MutedLine>}
            </>
          ) : (
            <MutedLine>No runs yet. Run the scout to sweep every tracked company's board.</MutedLine>
          )}
        </ConsolePanel>
      </div>

      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}
      >
        <ConsolePanel className="p-5 flex flex-col gap-2.5">
          <PanelHead
            label={`INBOX · ${stats?.unreadMessages ?? 0} UNREAD`}
            padded={false}
            right={<OpenLink to="/admin/inbox" />}
          />
          {inbox.slice(0, 2).map(m => (
            <div key={m.id} className="flex flex-col gap-1 py-2.5 border-t border-ln min-w-0">
              <span className="font-semibold">
                {m.name}{' '}
                <span className="font-mono text-[11px] text-mut">· {formatWhen(m.submittedAt)}</span>
              </span>
              <span className="text-[14px] text-ink2 whitespace-nowrap overflow-hidden text-ellipsis">
                {m.message}
              </span>
            </div>
          ))}
          {inbox.length === 0 && <MutedLine>No messages yet.</MutedLine>}
        </ConsolePanel>

        <ConsolePanel className="p-5 flex flex-col gap-2.5">
          <PanelHead
            label="HANGAR · HEALTH"
            padded={false}
            right={<OpenLink to="/admin/hangar" />}
          />
          {hangarDown && <MutedLine>status unavailable — the broker is not reachable</MutedLine>}
          {!hangarDown && instances.length === 0 && <MutedLine>No instances running.</MutedLine>}
          {instances.map(unit => {
            const pct =
              unit.memUsedBytes && unit.memLimitBytes
                ? Math.round((unit.memUsedBytes / unit.memLimitBytes) * 100)
                : 0;
            return (
              <div
                key={`${unit.slug}-${unit.name}`}
                className="grid items-center gap-3 py-2 border-t border-ln font-mono text-[12px] leading-none"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 90px 72px' }}
              >
                <span className="font-display font-semibold text-[15px] truncate">{unit.name}</span>
                {unit.memUsedBytes && unit.memLimitBytes ? (
                  <Bar pct={pct} height={8} />
                ) : (
                  <span className="text-mut">{formatBytes(unit.memUsedBytes)}</span>
                )}
                <span className="text-right text-acct truncate">● {unit.state}</span>
              </div>
            );
          })}
        </ConsolePanel>
      </div>

      <AgentRunModal
        isOpen={runOpen}
        onClose={() => setRunOpen(false)}
        onStarted={() => {
          notify('ok', 'Scout run started');
          refreshStats();
        }}
      />
    </div>
  );
}
