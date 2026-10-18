import { useState } from 'react';
import * as agentRepository from '../repositories/agentRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { CHIP, ERROR_INK, MutedLine, formatDateTime } from './console.tsx';
import type { AgentRun, AgentRunDetail } from '../types/index.ts';

interface AgentRunsHistoryProps {
  runs: AgentRun[];
  onError: (message: string) => void;
}

/** One accent, one ink, one muted — the console has no status palette. */
const STATUS_DOT: Record<string, string> = {
  queued: 'text-mut',
  running: 'text-acct',
  succeeded: 'text-ink',
  failed: ERROR_INK,
  cancelled: 'text-mut',
};

const TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled'];

/** Every counter in an expanded run wears the same chip. */
const STAT_CHIP = `${CHIP} border-ln2`;

const AgentRunsHistory: React.FC<AgentRunsHistoryProps> = ({ runs, onError }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, AgentRunDetail>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const toggle = async (run: AgentRun) => {
    if (expandedId === run.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(run.id);
    // A terminal run's counters can never change, so its detail is cached.
    // A queued or running one is still moving: refetch on every expand or the
    // panel shows whatever it happened to say the first time it was opened.
    if (details[run.id] && TERMINAL_STATUSES.includes(run.status)) return;
    setLoadingId(run.id);
    try {
      const res = await agentRepository.getRun(run.id);
      if (res.success) {
        setDetails(prev => ({ ...prev, [run.id]: res.data as AgentRunDetail }));
      } else {
        onError(res.error || 'Could not load run details');
      }
    } catch (err: unknown) {
      onError(apiErrorMessage(err, 'Could not load run details'));
    } finally {
      setLoadingId(null);
    }
  };

  if (runs.length === 0) {
    return <MutedLine>No runs yet.</MutedLine>;
  }

  return (
    <div className="flex flex-col">
      {runs.map(run => {
        const detail = details[run.id];
        const expanded = expandedId === run.id;
        return (
          <div key={run.id} className="border-b border-ln last:border-b-0">
            <button
              type="button"
              onClick={() => toggle(run)}
              aria-expanded={expanded}
              aria-controls={`agent-run-detail-${run.id}`}
              className="w-full flex items-center gap-3 flex-wrap py-2.5 text-left bg-transparent border-0 cursor-pointer"
            >
              <span className="font-mono text-[11px] leading-none text-mut w-3 flex-shrink-0">
                {expanded ? '−' : '+'}
              </span>
              <span className="font-mono text-[11px] leading-none text-ink2 w-40 flex-shrink-0">
                {formatDateTime(run.started_at || run.created_at)}
              </span>
              <span className={`font-mono text-[11px] leading-none uppercase tracking-[0.08em] ${STATUS_DOT[run.status] ?? STATUS_DOT.queued}`}>
                ● {run.status}
              </span>
              <span className="font-mono text-[11px] leading-none text-ink2">
                {run.findings_count} findings
              </span>
              {run.companies_failed > 0 && (
                <span className={`font-mono text-[11px] leading-none ${ERROR_INK}`}>
                  {run.companies_failed} failed
                </span>
              )}
            </button>

            {expanded && (
              <div id={`agent-run-detail-${run.id}`} className="pb-3.5 pl-6">
                {loadingId === run.id && !detail ? (
                  <p className="m-0 font-mono text-[11px] leading-none text-mut">Loading…</p>
                ) : detail ? (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      <span className={`${STAT_CHIP} text-ink2`}>
                        {detail.companies_processed}/{detail.companies_total} companies
                      </span>
                      <span className={`${STAT_CHIP} text-ink2`}>{detail.postings_seen} seen</span>
                      <span className={`${STAT_CHIP} text-ink2`}>{detail.postings_new} new</span>
                      <span className={`${STAT_CHIP} text-mut`}>
                        {detail.postings_applied_skipped} applied
                      </span>
                      {detail.postings_rejected > 0 && (
                        <span className={`${STAT_CHIP} text-mut`}>
                          {detail.postings_rejected} rejected
                        </span>
                      )}
                      <span className={`${STAT_CHIP} text-ink2`}>
                        {detail.input_tokens + detail.output_tokens} tokens
                      </span>
                      {detail.duration_seconds !== null && (
                        <span className={`${STAT_CHIP} text-ink2`}>{detail.duration_seconds}s</span>
                      )}
                    </div>
                    {detail.error && (
                      <p className={`m-0 mb-2.5 font-mono text-[11px] leading-[1.5] whitespace-pre-line ${ERROR_INK}`}>
                        {detail.error}
                      </p>
                    )}
                    {detail.company_results.length === 0 ? (
                      <p className="m-0 font-mono text-[11px] leading-none text-mut">
                        No companies were processed.
                      </p>
                    ) : (
                      <table className="w-full font-mono text-[11px] leading-none border-collapse">
                        <thead>
                          <tr className="text-left text-acct">
                            <th className="font-medium uppercase tracking-[0.08em] py-1.5 pr-3">Company</th>
                            <th className="font-medium uppercase tracking-[0.08em] py-1.5 pr-3">Source</th>
                            <th className="font-medium uppercase tracking-[0.08em] py-1.5 pr-3">Found</th>
                            <th className="font-medium uppercase tracking-[0.08em] py-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.company_results.map(result => (
                            <tr
                              key={result.id}
                              className={`border-t border-ln ${
                                result.status === 'error' ? ERROR_INK : 'text-ink2'
                              }`}
                            >
                              <td className="py-1.5 pr-3 align-top">{result.company_name}</td>
                              <td className="py-1.5 pr-3 align-top">{result.source || '—'}</td>
                              <td className="py-1.5 pr-3 align-top">{result.postings_found}</td>
                              <td className="py-1.5 align-top leading-[1.4]">
                                {result.status === 'error' ? (result.error || 'error') : result.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AgentRunsHistory;
