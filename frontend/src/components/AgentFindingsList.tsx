import { useMemo, useState } from 'react';
import * as agentRepository from '../repositories/agentRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { MonoButton, VerdictChip } from '../pages/admin/ui.tsx';
import { CHIP } from './formStyles.ts';
import type { AgentFinding } from '../types/index.ts';

interface AgentFindingsListProps {
  findings: AgentFinding[];
  onRemoved: (findingId: number) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/** The score chip leans on weight, not hue — the console has one accent and no palette. */
function scoreChipClass(score: number | null): string {
  if (score === null) return 'border-ln2 text-mut';
  if (score >= 80) return 'border-ink text-ink font-medium';
  if (score >= 60) return 'border-ln2 text-ink2';
  return 'border-ln2 text-mut';
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
          ? `Tracked "${finding.posting.title}"`
          : `Skipped "${finding.posting.title}"`);
      } else {
        onError(res.error || `Could not ${action} this posting`);
      }
    } catch (err: unknown) {
      onError(apiErrorMessage(err, `Could not ${action} this posting`));
    } finally {
      setBusyId(null);
    }
  };

  if (findings.length === 0) {
    return (
      <p className="m-0 px-5 py-10 text-center font-mono text-[11px] leading-none uppercase tracking-[0.12em] text-mut">
        No matching positions in this run
      </p>
    );
  }

  return (
    <div>
      {grouped.map(([companyName, items]) => (
        <div key={companyName}>
          <div className="flex items-center justify-between gap-3 bg-s1 px-5 py-2.5 border-b border-ln">
            <span className="font-mono text-[11px] leading-none font-medium uppercase tracking-[0.12em] text-acct truncate">
              {companyName}
            </span>
            <span className="font-mono text-[11px] leading-none text-mut">{items.length}</span>
          </div>
          {items.map(finding => (
            <div
              key={finding.id}
              className="flex items-start gap-4 px-5 py-3.5 border-b border-ln"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {finding.posting.url ? (
                    <a
                      href={finding.posting.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[15px] leading-tight text-ink hover:text-acct no-underline"
                    >
                      {finding.posting.title}
                    </a>
                  ) : (
                    // href="" would reload the page; a board with no URL at
                    // all is not clickable, so it is plain text.
                    <span className="font-semibold text-[15px] leading-tight text-ink">
                      {finding.posting.title}
                    </span>
                  )}
                  {finding.is_new ? (
                    <span className={`${CHIP} bg-acc text-onacc border-acc`}>New</span>
                  ) : (
                    <span className={`${CHIP} bg-s1 text-mut`}>Seen</span>
                  )}
                  <span className={`${CHIP} ${scoreChipClass(finding.score)}`}>
                    {finding.score === null ? 'unscored' : finding.score}
                  </span>
                  {finding.verdict && <VerdictChip verdict={finding.verdict} />}
                </div>
                <div className="flex items-center gap-3 flex-wrap font-mono text-[11px] leading-none text-mut uppercase tracking-[0.08em]">
                  {finding.posting.location && <span>{finding.posting.location}</span>}
                  {finding.posting.department && <span>{finding.posting.department}</span>}
                  {finding.posting.is_remote && <span className="text-acct">remote</span>}
                </div>
                {finding.reason && (
                  <p className="m-0 font-mono text-[11px] leading-[1.5] text-ink2 line-clamp-2">
                    {finding.reason}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 flex gap-1.5">
                <MonoButton
                  onClick={() => runAction(finding, 'bookmark')}
                  disabled={busyId === finding.id}
                  title="Track as an application"
                >
                  Track
                </MonoButton>
                <MonoButton
                  tone="muted"
                  onClick={() => runAction(finding, 'dismiss')}
                  disabled={busyId === finding.id}
                  title="Hide this posting from future runs"
                >
                  Skip
                </MonoButton>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default AgentFindingsList;
