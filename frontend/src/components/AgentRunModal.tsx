import { useEffect, useState } from 'react';
import * as agentRepository from '../repositories/agentRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import Modal from './Modal.tsx';
import {
  DialogHeader,
  ERROR_BOX,
  FIELD,
  FIELD_MONO,
  HINT,
  LABEL,
  MonoButton,
} from './console.tsx';
import type { AgentRun } from '../types/index.ts';

interface AgentRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStarted: (run: AgentRun) => void;
}

const PLACEHOLDER = `Backend and platform engineering: Python, Go, distributed systems.
Mid-to-senior IC roles, not management.
Remote-first or Tel Aviv.
Comp floor: 250k ILS.
Dealbreakers: on-call-heavy support roles, no crypto trading desks.`;

const AgentRunModal: React.FC<AgentRunModalProps> = ({ isOpen, onClose, onStarted }) => {
  const [interests, setInterests] = useState('');
  const [minScore, setMinScore] = useState(60);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLoadingProfile(true);
    agentRepository
      .getProfile()
      .then(res => {
        if (res.success) {
          setInterests(res.data.interests || '');
          setMinScore(typeof res.data.min_score === 'number' ? res.data.min_score : 60);
        }
      })
      .catch(() => setError('Could not load your saved interests.'))
      .finally(() => setLoadingProfile(false));
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interests.trim()) {
      setError('Describe what you are looking for — the agent scores against this.');
      return;
    }
    if (minScore < 0 || minScore > 100) {
      setError('Minimum score must be between 0 and 100.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await agentRepository.startRun({ interests: interests.trim(), min_score: minScore });
      if (res.success) {
        onStarted(res.data as AgentRun);
        onClose();
      } else {
        setError(res.error || 'Could not start the run.');
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not start the run.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="agent-run-title">
      <div className="p-6">
        <DialogHeader id="agent-run-title" title="Run scout" onClose={onClose} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="agent-interests" className={LABEL}>
              What are you looking for? <span className="text-acct" aria-hidden="true">*</span>
              <span className="sr-only">(required)</span>
            </label>
            <textarea
              id="agent-interests"
              name="interests"
              rows={8}
              value={interests}
              onChange={e => setInterests(e.target.value)}
              disabled={loadingProfile}
              aria-required="true"
              className={`${FIELD} disabled:opacity-60`}
              placeholder={PLACEHOLDER}
            />
            <p className={HINT}>
              Saved as the default for next time, and snapshotted onto this run.
            </p>
          </div>

          <div>
            <label htmlFor="agent-min-score" className={LABEL}>Minimum score</label>
            <input
              type="number"
              id="agent-min-score"
              name="min_score"
              min={0}
              max={100}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className={`${FIELD_MONO} w-28`}
            />
            <p className={HINT}>Postings scored below this are not shown.</p>
          </div>

          <p className="m-0 font-mono text-[11px] leading-[1.5] text-mut">
            Runs against all tracked companies. Positions you have already applied to are
            never listed; aggregators like LinkedIn and Indeed are never fetched.
          </p>

          {error && <div role="alert" className={ERROR_BOX}>{error}</div>}

          <div className="flex gap-2 justify-end pt-2">
            <MonoButton onClick={onClose} size="md" disabled={submitting}>
              Cancel
            </MonoButton>
            <MonoButton
              type="submit"
              tone="accent"
              size="md"
              disabled={submitting || loadingProfile}
            >
              {submitting ? 'Starting…' : 'Run'}
            </MonoButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AgentRunModal;
