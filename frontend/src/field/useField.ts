/**
 * Field state: the React translation of the prototype's
 * `state = { algo, tool, cfg, dockOpen, learnOpen, paused }` plus the
 * `setCfg(k, v, regen)` / `resetField` / `togglePause` handlers from
 * `renderVals()` in `Portfolio Home.dc.html`.
 *
 * `FieldProvider` wraps the page; `<FieldCanvas/>`, `<FieldDock/>` and
 * `<LearnModal/>` all read from it, so the hero CTA, the dock and the modal
 * stay in sync without prop drilling.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';

import { defaultCfg } from './config';
import type { FieldCfg, FieldKind, FieldTool } from './types';

export interface FieldContextValue {
  algo: FieldKind;
  setAlgo: (algo: FieldKind) => void;

  /** The current algorithm's slider/toggle values. */
  cfg: FieldCfg;
  setCfg: (key: string, value: number | boolean, regen?: boolean) => void;

  tool: FieldTool;
  setTool: (tool: FieldTool) => void;
  /** Coarse pointers only: a tool is armed for exactly one tap. */
  armed: boolean;
  armTool: (tool: FieldTool) => void;
  disarm: () => void;

  paused: boolean;
  togglePause: () => void;

  learnOpen: boolean;
  openLearn: () => void;
  closeLearn: () => void;

  dockOpen: boolean;
  toggleDock: () => void;

  /** Bumped whenever the simulation state must be dropped and re-initialised. */
  resetSeq: number;
  reset: () => void;

  /** The dock's HUD `<pre>`, written to directly by the canvas loop. */
  hudRef: RefObject<HTMLPreElement | null>;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;
}

/** Reactive `matchMedia`, used for the mobile dock and coarse-pointer input. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matches(query),
    () => false,
  );
}

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_QUERY = '(pointer: coarse)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function FieldProvider({ children }: { children: ReactNode }) {
  const [algo, setAlgoState] = useState<FieldKind>('planner');
  const [allCfg, setAllCfg] = useState<Record<FieldKind, FieldCfg>>(() => defaultCfg());
  const [tool, setToolState] = useState<FieldTool>('add');
  const [armed, setArmed] = useState(false);
  // `prefers-reduced-motion` starts the field paused; the dock shows "▶ Resume".
  const [paused, setPaused] = useState(() => matches(REDUCED_MOTION_QUERY));
  const [learnOpen, setLearnOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 760,
  );
  const [resetSeq, setResetSeq] = useState(0);
  const hudRef = useRef<HTMLPreElement | null>(null);

  const reset = useCallback(() => setResetSeq((n) => n + 1), []);

  const setAlgo = useCallback((next: FieldKind) => {
    setAlgoState(next);
    setToolState('add');
    setArmed(false);
  }, []);

  const setCfg = useCallback(
    (key: string, value: number | boolean, regen?: boolean) => {
      setAllCfg((prev) => ({ ...prev, [algo]: { ...prev[algo], [key]: value } }));
      if (regen) setResetSeq((n) => n + 1);
    },
    [algo],
  );

  const setTool = useCallback((next: FieldTool) => {
    setToolState(next);
    setArmed(false);
  }, []);

  const armTool = useCallback(
    (next: FieldTool) => {
      if (armed && tool === next) {
        setArmed(false);
        return;
      }
      setToolState(next);
      setArmed(true);
    },
    [armed, tool],
  );

  const value = useMemo<FieldContextValue>(
    () => ({
      algo,
      setAlgo,
      cfg: allCfg[algo],
      setCfg,
      tool,
      setTool,
      armed,
      armTool,
      disarm: () => setArmed(false),
      paused,
      togglePause: () => setPaused((p) => !p),
      learnOpen,
      openLearn: () => setLearnOpen(true),
      closeLearn: () => setLearnOpen(false),
      dockOpen,
      toggleDock: () => setDockOpen((o) => !o),
      resetSeq,
      reset,
      hudRef,
    }),
    [algo, setAlgo, allCfg, setCfg, tool, setTool, armed, armTool, paused, learnOpen, dockOpen, resetSeq, reset],
  );

  return createElement(FieldContext.Provider, { value }, children);
}

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error('useField() must be used inside <FieldProvider>');
  return ctx;
}
