import { useEffect, useState } from 'react';
import axios from 'axios';
import * as agentRepository from '../repositories/agentRepository.ts';
import Modal from './Modal.tsx';
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
      const serverError = axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error
        : undefined;
      setError(serverError || 'Could not start the run.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} titleId="agent-run-title">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 id="agent-run-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Run Agent
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="agent-interests" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              What are you looking for? <span className="text-red-500" aria-hidden="true">*</span>
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm disabled:opacity-60"
              placeholder={PLACEHOLDER}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Saved as the default for next time, and snapshotted onto this run.
            </p>
          </div>

          <div>
            <label htmlFor="agent-min-score" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum score
            </label>
            <input
              type="number"
              id="agent-min-score"
              name="min_score"
              min={0}
              max={100}
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Postings scored below this are not shown.
            </p>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Runs against all tracked companies. Positions you have already applied to are
            never listed; aggregators like LinkedIn and Indeed are never fetched.
          </p>

          {error && (
            <div role="alert" className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingProfile}
              className="px-6 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'var(--accent)')}
            >
              {submitting ? (
                <>
                  <div role="status" aria-label="Starting" className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Starting...
                </>
              ) : (
                'Run'
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default AgentRunModal;
