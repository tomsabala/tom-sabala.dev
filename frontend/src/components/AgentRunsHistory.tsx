import { useState } from 'react';
import axios from 'axios';
import * as agentRepository from '../repositories/agentRepository.ts';
import type { AgentRun, AgentRunDetail } from '../types/index.ts';

interface AgentRunsHistoryProps {
  runs: AgentRun[];
  onError: (message: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  succeeded: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

const TERMINAL_STATUSES = ['succeeded', 'failed', 'cancelled'];

function formatWhen(run: AgentRun): string {
  const raw = run.started_at || run.created_at;
  if (!raw) return '—';
  const parsed = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString();
}

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
      const serverError = axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error
        : undefined;
      onError(serverError || 'Could not load run details');
    } finally {
      setLoadingId(null);
    }
  };

  if (runs.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">No runs yet.</p>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700">
      {runs.map(run => {
        const detail = details[run.id];
        const expanded = expandedId === run.id;
        return (
          <div key={run.id}>
            <button
              type="button"
              onClick={() => toggle(run)}
              aria-expanded={expanded}
              aria-controls={`agent-run-detail-${run.id}`}
              className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors px-1 rounded"
            >
              <svg
                className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-xs text-gray-500 dark:text-gray-400 w-40 flex-shrink-0">
                {formatWhen(run)}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[run.status] || STATUS_STYLES.queued}`}>
                {run.status}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {run.findings_count} findings
              </span>
              {run.companies_failed > 0 && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {run.companies_failed} failed
                </span>
              )}
            </button>

            {expanded && (
              <div id={`agent-run-detail-${run.id}`} className="pb-3 pl-8 pr-1">
                {loadingId === run.id && !detail ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Loading...</p>
                ) : detail ? (
                  <>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span>{detail.companies_processed}/{detail.companies_total} companies</span>
                      <span>{detail.postings_seen} seen</span>
                      <span>{detail.postings_new} new</span>
                      <span>{detail.postings_applied_skipped} already applied</span>
                      {detail.postings_rejected > 0 && <span>{detail.postings_rejected} rejected</span>}
                      <span>{detail.input_tokens + detail.output_tokens} tokens</span>
                      {detail.duration_seconds !== null && <span>{detail.duration_seconds}s</span>}
                    </div>
                    {detail.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-line mb-2">
                        {detail.error}
                      </p>
                    )}
                    {detail.company_results.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">No companies were processed.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 text-left">
                            <th className="font-normal py-1">Company</th>
                            <th className="font-normal py-1">Source</th>
                            <th className="font-normal py-1">Found</th>
                            <th className="font-normal py-1">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.company_results.map(result => (
                            <tr
                              key={result.id}
                              className={result.status === 'error'
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
                                : 'text-gray-600 dark:text-gray-400'}
                            >
                              <td className="py-1 pr-2">{result.company_name}</td>
                              <td className="py-1 pr-2">{result.source || '—'}</td>
                              <td className="py-1 pr-2">{result.postings_found}</td>
                              <td className="py-1">
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
