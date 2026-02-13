import { useState, useCallback, useRef } from 'react';

const STORAGE_KEY = 'terminal-command-history';
const MAX_HISTORY = 100;

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage full or unavailable
  }
}

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);
  const indexRef = useRef<number>(-1);
  const draftRef = useRef<string>('');

  const addToHistory = useCallback((command: string) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    setHistory(prev => {
      const next = [trimmed, ...prev.filter(c => c !== trimmed)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
    indexRef.current = -1;
    draftRef.current = '';
  }, []);

  const navigateUp = useCallback((currentInput: string): string | null => {
    if (history.length === 0) return null;

    if (indexRef.current === -1) {
      draftRef.current = currentInput;
    }

    const nextIndex = Math.min(indexRef.current + 1, history.length - 1);
    if (nextIndex === indexRef.current && indexRef.current !== -1) return null;

    indexRef.current = nextIndex;
    return history[nextIndex];
  }, [history]);

  const navigateDown = useCallback((): string | null => {
    if (indexRef.current <= -1) return null;

    const nextIndex = indexRef.current - 1;
    indexRef.current = nextIndex;

    if (nextIndex === -1) {
      return draftRef.current;
    }

    return history[nextIndex];
  }, [history]);

  const resetNavigation = useCallback(() => {
    indexRef.current = -1;
    draftRef.current = '';
  }, []);

  return { history, addToHistory, navigateUp, navigateDown, resetNavigation };
}
