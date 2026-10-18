/**
 * Pipeline: the application board, the scout's findings for the latest run, the tracked
 * companies and the run history — everything the old `/jobs` page did, in console dress.
 *
 * A run that is queued or running is polled every 3 s and stops polling the moment it goes
 * terminal, exactly as the pre-redesign page did.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import * as jobsRepository from '../../repositories/jobsRepository.ts';
import * as agentRepository from '../../repositories/agentRepository.ts';
import { apiErrorMessage } from '../../repositories/apiError.ts';
import CompanyFormModal from '../../components/CompanyFormModal.tsx';
import JobApplicationFormModal from '../../components/JobApplicationFormModal.tsx';
import AgentFindingsList from '../../components/AgentFindingsList.tsx';
import AgentRunsHistory from '../../components/AgentRunsHistory.tsx';
import type { AgentFinding, AgentRun, Company, JobApplication } from '../../types/index.ts';
import {
  filterCompaniesByCategories,
  searchApplications,
  searchCompanies,
  searchFindings,
} from '../jobsSearch.ts';
import { useAdminAction, useAdminChrome, usePrimaryAction } from './chrome.tsx';
import { BOARD_COLUMNS } from './applicationStatus.ts';
import {
  ConsolePanel,
  EmptyState,
  ERROR_INK,
  MonoButton,
  MutedLine,
  PanelHead,
  SearchField,
  formatWhen,
} from '../../components/console.tsx';

export default function AdminPipeline(): JSX.Element {
  const { notify, refreshStats } = useAdminChrome();
  const act = useAdminAction();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Set<string>>(new Set());

  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [latestRun, setLatestRun] = useState<AgentRun | null>(null);
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [companyModal, setCompanyModal] = useState<{ mode: 'add' | 'edit'; company?: Company } | null>(null);
  const [applicationModal, setApplicationModal] = useState<{ mode: 'add' | 'edit'; application?: JobApplication } | null>(
    null
  );

  const pollRef = useRef<number | null>(null);
  const runInFlight = latestRun?.status === 'queued' || latestRun?.status === 'running';
  const activeRunId = runInFlight && latestRun ? latestRun.id : null;

  usePrimaryAction({ label: '+ Application', onClick: () => setApplicationModal({ mode: 'add' }) }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, applicationsRes] = await Promise.all([
        jobsRepository.getCompanies(),
        jobsRepository.getApplications(),
      ]);
      setCompanies(companiesRes.data ?? []);
      setApplications(applicationsRes.data ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load companies and applications'));
    }
  };

  const fetchAgentData = async () => {
    try {
      const runsRes = await agentRepository.getRuns();
      if (!runsRes.success) return;
      const list = runsRes.data as AgentRun[];
      setRuns(list);
      const newest = list[0] ?? null;
      setLatestRun(newest);
      if (!newest) {
        setFindings([]);
        return;
      }
      const findingsRes = await agentRepository.getFindings(newest.id);
      if (findingsRes.success) setFindings(findingsRes.data as AgentFinding[]);
    } catch (err) {
      notify('err', apiErrorMessage(err, 'Could not load scout runs'));
    }
  };

  useEffect(() => {
    fetchData();
    fetchAgentData();
  }, []);

  // Poll only while a run is in flight; stop as soon as it goes terminal.
  useEffect(() => {
    if (activeRunId === null) return;
    const runId = activeRunId;
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await agentRepository.getRun(runId);
        if (!res.success) return;
        const fresh = res.data as AgentRun;
        setLatestRun(fresh);
        setRuns(prev => prev.map(r => (r.id === fresh.id ? { ...r, ...fresh } : r)));
        if (fresh.status === 'queued' || fresh.status === 'running') return;
        if (pollRef.current !== null) {
          window.clearInterval(pollRef.current);
          pollRef.current = null;
        }
        const findingsRes = await agentRepository.getFindings(fresh.id);
        if (findingsRes.success) setFindings(findingsRes.data as AgentFinding[]);
        await fetchData();
        refreshStats();
        notify(
          fresh.status === 'succeeded' ? 'ok' : 'err',
          fresh.status === 'succeeded'
            ? `Scout run finished — ${fresh.findings_count} findings`
            : `Scout run ${fresh.status}`
        );
      } catch {
        /* a dropped poll is not an error: the next tick retries */
      }
    }, 3000);

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeRunId]);

  const allCategories = useMemo(
    () => [...new Set(companies.flatMap(c => c.categories ?? []))].sort(),
    [companies]
  );

  const companiesInScope = useMemo(
    () => filterCompaniesByCategories(companies, categories),
    [companies, categories]
  );

  const categoryByCompanyId = useMemo(() => {
    const map: Record<number, string> = {};
    companies.forEach(c => {
      if (c.categories && c.categories.length > 0) map[c.id] = c.categories[0];
    });
    return map;
  }, [companies]);

  const visibleApplications = useMemo(() => {
    const inScope = new Set(companiesInScope.map(c => c.id));
    const byCategory =
      categories.size === 0
        ? applications
        : applications.filter(a => a.company_id !== null && inScope.has(a.company_id));
    return searchApplications(byCategory, search);
  }, [applications, companiesInScope, categories, search]);

  const visibleCompanies = useMemo(
    () => searchCompanies(companiesInScope, search),
    [companiesInScope, search]
  );

  const visibleFindings = useMemo(() => searchFindings(findings, search), [findings, search]);

  const handleCancelRun = async () => {
    if (!latestRun) return;
    setCancelling(true);
    const result = await act<AgentRun>(() => agentRepository.cancelRun(latestRun.id), {
      failure: 'Could not cancel the run',
      success: 'Cancellation requested',
    });
    setCancelling(false);
    if (result?.data) setLatestRun(result.data);
  };

  const deleteCompany = async (company: Company) => {
    if (!confirm(`Delete "${company.name}"? This cannot be undone.`)) return;
    const result = await act(() => jobsRepository.deleteCompany(company.id), {
      failure: 'Could not delete the company',
      success: 'Company deleted',
    });
    if (result) await fetchData();
  };

  const deleteApplication = async (application: JobApplication) => {
    if (!confirm(`Delete the application for "${application.position}" at ${application.company_name}?`)) return;
    const result = await act(() => jobsRepository.deleteApplication(application.id), {
      failure: 'Could not delete the application',
      success: 'Application deleted',
    });
    if (!result) return;
    await fetchData();
    refreshStats();
  };

  const toggleCategory = (cat: string) => {
    setCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {loadError && <MutedLine>{loadError}</MutedLine>}

      <div className="flex gap-2 flex-wrap items-center">
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search companies, roles and findings"
          placeholder="Search company, role, note…"
          className="w-full sm:w-[260px]"
        />
        <MonoButton tone={categories.size === 0 ? 'accent' : 'muted'} onClick={() => setCategories(new Set())}>
          All
        </MonoButton>
        {allCategories.map(cat => (
          <MonoButton
            key={cat}
            tone={categories.has(cat) ? 'accent' : 'muted'}
            onClick={() => toggleCategory(cat)}
          >
            {cat}
          </MonoButton>
        ))}
      </div>

      <div
        className="grid gap-3 overflow-x-auto pb-1.5"
        style={{
          gridTemplateColumns: `repeat(${BOARD_COLUMNS.length}, minmax(200px, 1fr))`,
          scrollSnapType: 'x proximity',
        }}
      >
        {BOARD_COLUMNS.map(col => {
          const cards = visibleApplications.filter(a => col.statuses.includes(a.status));
          return (
            <div
              key={col.key}
              className="flex flex-col gap-2 min-w-[200px]"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div
                className="flex justify-between items-center px-3 py-2.5 font-mono text-[11px] leading-none font-medium tracking-[0.1em]"
                style={{
                  background: col.key === 'offer' ? 'var(--acc)' : 'var(--ink)',
                  color: col.key === 'offer' ? 'var(--onacc)' : 'var(--bg)',
                }}
              >
                <span>{col.label}</span>
                <span>{cards.length}</span>
              </div>
              {cards.map(app => (
                <div key={app.id} className="bg-bg border border-ln2 p-3.5 flex flex-col gap-2 min-w-0">
                  <span className="font-mono text-[10px] leading-none text-mut tracking-[0.08em] uppercase truncate">
                    {app.company_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setApplicationModal({ mode: 'edit', application: app })}
                    className="bg-transparent border-0 p-0 text-left font-bold text-[16px] leading-[1.25] text-ink cursor-pointer"
                  >
                    {app.position}
                  </button>
                  <div className="flex justify-between gap-2 font-mono text-[11px] leading-none text-ink2">
                    <span>{app.date_applied || formatWhen(app.created_at)}</span>
                    <span className="truncate">
                      {app.company_id !== null ? categoryByCompanyId[app.company_id] ?? '' : ''}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <MonoButton onClick={() => setApplicationModal({ mode: 'edit', application: app })}>
                      Edit
                    </MonoButton>
                    <MonoButton tone="muted" onClick={() => deleteApplication(app)}>
                      Delete
                    </MonoButton>
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <span className="font-mono text-[11px] leading-none text-mut px-1 py-2">empty</span>
              )}
            </div>
          );
        })}
      </div>

      <ConsolePanel>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b border-ln">
          <span className="font-mono text-[11px] leading-none font-medium uppercase tracking-[0.12em] text-acct">
            {latestRun
              ? `SCOUT FINDINGS · RUN #${latestRun.id} · MIN SCORE ${latestRun.min_score}`
              : 'SCOUT FINDINGS'}
          </span>
          <span className="font-mono text-[11px] leading-[1.5] text-mut">
            {latestRun
              ? `${latestRun.companies_processed}/${latestRun.companies_total} companies · ${latestRun.postings_seen} postings seen · ${latestRun.postings_new} new · ${latestRun.input_tokens + latestRun.output_tokens} tokens`
              : 'no runs yet'}
          </span>
        </div>
        {latestRun?.error && (
          <p
            role="alert"
            className={`m-0 px-5 py-3 border-b border-ln font-mono text-[11px] leading-[1.5] whitespace-pre-line ${ERROR_INK}`}
          >
            {latestRun.error}
          </p>
        )}
        {runInFlight && (
          <div className="px-5 py-3 border-b border-ln flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] leading-none text-ink2">
              ● {latestRun?.status} — polling every 3 s
            </span>
            <MonoButton tone="muted" onClick={handleCancelRun} disabled={cancelling}>
              Cancel run
            </MonoButton>
          </div>
        )}
        <AgentFindingsList
          findings={visibleFindings}
          onRemoved={id => setFindings(prev => prev.filter(f => f.id !== id))}
          onSuccess={async message => {
            notify('ok', message);
            await fetchData();
            refreshStats();
          }}
          onError={message => notify('err', message)}
        />
      </ConsolePanel>

      <ConsolePanel>
        <PanelHead
          label={`TRACKED COMPANIES · ${companies.length}`}
          right={
            <div className="flex gap-2">
              <MonoButton onClick={() => setCompanyModal({ mode: 'add' })}>+ Company</MonoButton>
              <MonoButton tone="muted" onClick={() => setShowCompanies(v => !v)}>
                {showCompanies ? 'Hide' : 'Show'}
              </MonoButton>
            </div>
          }
        />
        {showCompanies &&
          visibleCompanies.map(company => (
            <div
              key={company.id}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-ln last:border-b-0"
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="font-semibold text-[15px] leading-tight truncate">{company.name}</span>
                <span className="font-mono text-[11px] leading-[1.4] text-mut truncate">
                  {(company.categories ?? []).join(' · ') || 'no tags'}
                  {company.ats_provider ? ` · board: ${company.ats_provider}` : ''}
                </span>
              </div>
              <div className="flex gap-1.5">
                <MonoButton onClick={() => setCompanyModal({ mode: 'edit', company })}>Edit</MonoButton>
                <MonoButton tone="muted" onClick={() => deleteCompany(company)}>
                  Delete
                </MonoButton>
              </div>
            </div>
          ))}
        {showCompanies && visibleCompanies.length === 0 && (
          <EmptyState>No companies match the current search and tags.</EmptyState>
        )}
      </ConsolePanel>

      <ConsolePanel>
        <PanelHead
          label={`RUN HISTORY · ${runs.length}`}
          right={
            <MonoButton tone="muted" onClick={() => setShowHistory(v => !v)}>
              {showHistory ? 'Hide' : 'Show'}
            </MonoButton>
          }
        />
        {showHistory && (
          <div className="p-5">
            <AgentRunsHistory runs={runs} onError={message => notify('err', message)} />
          </div>
        )}
      </ConsolePanel>

      <CompanyFormModal
        isOpen={companyModal !== null}
        mode={companyModal?.mode ?? 'add'}
        company={companyModal?.company}
        onClose={() => setCompanyModal(null)}
        onSuccess={async () => {
          notify('ok', companyModal?.mode === 'edit' ? 'Company updated' : 'Company added');
          setCompanyModal(null);
          await fetchData();
        }}
      />

      <JobApplicationFormModal
        isOpen={applicationModal !== null}
        mode={applicationModal?.mode ?? 'add'}
        application={applicationModal?.application}
        onClose={() => setApplicationModal(null)}
        onSuccess={async () => {
          notify('ok', applicationModal?.mode === 'edit' ? 'Application updated' : 'Application added');
          setApplicationModal(null);
          await fetchData();
          refreshStats();
        }}
      />
    </div>
  );
}
