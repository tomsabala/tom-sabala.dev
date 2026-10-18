import { useEffect, useState } from 'react';

/**
 * Boot progress for the frame overlay, read from the broker's `GET /boot/<slug>`.
 *
 * Every line the overlay prints is a phase the broker actually reached
 * (`claim` → (`reuse` | `create` → `start`) → `health` → `probe` → `ready`, or `failed`),
 * timestamped relative to the start of this attempt. Nothing is scripted: a visitor who
 * waits four seconds must be looking at four seconds of real work, not at a canned
 * "pulling image…" animation that would also play if the broker were wedged.
 *
 * The endpoint is unauthenticated and reports only the caller's own instance, so it carries
 * no image, port or memory — there is nothing here to leak.
 */

const POLL_MS = 400;
/** With no gateway in front (plain `vite dev`, or Vercel alone) `/boot` 404s forever. */
const MAX_FAILURES = 3;
const DEFAULT_PHASE_COUNT = 6;

export interface BootPhase {
  name: string;
  /** Milliseconds since this boot attempt started. */
  at: number;
}

export interface BootProgress {
  /** One line per phase reported so far, in arrival order. */
  lines: string[];
  /** Phases a full cold start reports; the overlay bar is `reached / phaseCount`. */
  phaseCount: number;
  reached: number;
  /** The broker answered at least once — i.e. there is a gateway in front of us. */
  answered: boolean;
  failed: boolean;
  error: string | null;
}

const IDLE: BootProgress = {
  lines: [],
  phaseCount: DEFAULT_PHASE_COUNT,
  reached: 0,
  answered: false,
  failed: false,
  error: null,
};

function parsePhases(value: unknown): BootPhase[] {
  if (!Array.isArray(value)) return [];
  const phases: BootPhase[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.name !== 'string' || entry.name.length === 0) continue;
    const at = typeof entry.at === 'number' && Number.isFinite(entry.at) ? entry.at : 0;
    phases.push({ name: entry.name, at });
  }
  return phases;
}

function formatPhase(phase: BootPhase): string {
  return `${phase.name.padEnd(8)} +${Math.max(0, Math.round(phase.at))} ms`;
}

/**
 * Polls while `active`; `attempt` is the reload counter, so bumping it starts a fresh log.
 * Stops on `failed`, on the iframe loading (`active` false) and after `MAX_FAILURES`
 * transport errors.
 */
export function useBootPhases(slug: string, active: boolean, attempt: number): BootProgress {
  const [progress, setProgress] = useState<BootProgress>(IDLE);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let timer = 0;
    let failures = 0;
    let seen = 0;
    let failureLogged = false;
    const lines: string[] = [`$ open /a/${slug}/`];
    setProgress({ ...IDLE, lines: [...lines] });

    const tick = async () => {
      try {
        const response = await fetch(`/boot/${slug}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`boot responded ${response.status}`);
        const body: unknown = await response.json();
        if (cancelled) return;
        failures = 0;

        const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
        const phases = parsePhases(record.phases);
        const phaseCount =
          typeof record.phaseCount === 'number' && record.phaseCount > 0
            ? record.phaseCount
            : DEFAULT_PHASE_COUNT;
        const state = typeof record.state === 'string' ? record.state : 'absent';
        const error =
          typeof record.error === 'string' && record.error.length > 0 ? record.error : null;

        for (let i = seen; i < phases.length; i += 1) lines.push(formatPhase(phases[i]));
        seen = phases.length;

        const failed = state === 'failed';
        if (failed && !failureLogged) {
          failureLogged = true;
          lines.push(`failed   ${error ?? 'the broker could not start this unit'}`);
        }

        setProgress({
          lines: [...lines],
          phaseCount,
          reached: phases.length,
          answered: true,
          failed,
          error,
        });
        if (failed) return;
      } catch {
        if (cancelled) return;
        failures += 1;
        // Nothing to say: the overlay keeps its generic status line and the iframe decides.
        if (failures >= MAX_FAILURES) return;
      }
      timer = window.setTimeout(() => void tick(), POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug, active, attempt]);

  return progress;
}
