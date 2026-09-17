import { useMemo, useState } from 'react';
import axios from 'axios';
import * as agentRepository from '../repositories/agentRepository.ts';
import type { AgentFinding } from '../types/index.ts';

interface AgentFindingsListProps {
  findings: AgentFinding[];
  onRemoved: (findingId: number) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const VERDICT_STYLES: Record<string, string> = {
  apply: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  maybe: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  skip: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function scorePillStyle(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  if (score >= 60) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
}

const AgentFindingsList: React.FC<AgentFindingsListProps> = ({
  findings,
  onRemoved,
  onSuccess,
  onError,
}) => {
  const [busyId, setBusyId] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, AgentFinding[]>();
    findings.forEach(finding => {
      const key = finding.company.name;
      const list = map.get(key);
      if (list) list.push(finding);
      else map.set(key, [finding]);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [findings]);

  const runAction = async (
    finding: AgentFinding,
    action: 'bookmark' | 'dismiss',
  ) => {
    setBusyId(finding.id);
    try {
      const res = action === 'bookmark'
        ? await agentRepository.bookmarkPosting(finding.posting.id)
        : await agentRepository.dismissPosting(finding.posting.id);
      if (res.success) {
        onRemoved(finding.id);
        onSuccess(action === 'bookmark'
          ? `Bookmarked "${finding.posting.title}"`
          : `Dismissed "${finding.posting.title}"`);
      } else {
        onError(res.error || `Could not ${action} this posting`);
      }
    } catch (err: unknown) {
      const serverError = axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error
        : undefined;
      onError(serverError || `Could not ${action} this posting`);
    } finally {
      setBusyId(null);
    }
  };

  if (findings.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 dark:text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-sm">No matching positions in this run.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([companyName, items]) => (
        <div key={companyName}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {companyName}
            <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
              {items.length}
            </span>
          </h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.map(finding => (
              <div key={finding.id} className="flex items-start gap-4 py-3 group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {finding.posting.url ? (
                      <a
                        href={finding.posting.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-900 dark:text-gray-100 text-sm hover:text-[var(--accent)] transition-colors"
                      >
                        {finding.posting.title}
                      </a>
                    ) : (
                      // href="" would reload the page; a board with no URL at
                      // all is not clickable, so it is plain text.
                      <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {finding.posting.title}
                      </span>
                    )}
                    {finding.is_new ? (
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ background: 'var(--accent)' }}
                      >
                        New
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Seen
                      </span>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${scorePillStyle(finding.score)}`}>
                      {finding.score === null ? 'unscored' : finding.score}
                    </span>
                    {finding.verdict && (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${VERDICT_STYLES[finding.verdict] || VERDICT_STYLES.skip}`}>
                        {finding.verdict}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {finding.posting.location && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{finding.posting.location}</span>
                    )}
                    {finding.posting.department && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">{finding.posting.department}</span>
                    )}
                    {finding.posting.is_remote && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">remote</span>
                    )}
                  </div>
                  {finding.reason && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {finding.reason}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => runAction(finding, 'bookmark')}
                    disabled={busyId === finding.id}
                    className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Bookmark
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(finding, 'dismiss')}
                    disabled={busyId === finding.id}
                    className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AgentFindingsList;
