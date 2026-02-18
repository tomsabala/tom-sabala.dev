import { useRef, useCallback } from 'react';
import { getSuggestions } from '../commands/registry';
import { getPathSuggestions, type FSNode } from '../filesystem';
import { themes } from '../themes';
import type { OutputBlock } from '../commands/types';

const PATH_COMMANDS = new Set(['cd', 'ls']);
const DOUBLE_TAB_THRESHOLD_MS = 400;

export function useTabCompletion(
  addOutput: (block: OutputBlock) => void,
  getFilesystem?: () => FSNode,
  getCurrentDir?: () => string,
) {
  const lastPartialRef = useRef<string>('');
  const cycleIndexRef = useRef<number>(0);
  const lastTabTimeRef = useRef<number>(0);

  /**
   * Handle cycling through suggestions and double-tab display.
   * Returns the selected suggestion, or null if double-tab listed all options.
   */
  function cycleOrList(suggestions: string[], partial: string, now: number): string | null {
    const isDoubleTab = now - lastTabTimeRef.current < DOUBLE_TAB_THRESHOLD_MS
      && partial === lastPartialRef.current;
    lastTabTimeRef.current = now;

    if (isDoubleTab && suggestions.length > 1) {
      addOutput({ lines: [{ text: suggestions.join('  ') }] });
      return null;
    }

    if (partial !== lastPartialRef.current) {
      lastPartialRef.current = partial;
      cycleIndexRef.current = 0;
    } else {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % suggestions.length;
    }

    return suggestions[cycleIndexRef.current];
  }

  const complete = useCallback((currentInput: string): string | null => {
    const now = Date.now();
    const parts = currentInput.split(/\s+/);
    const command = parts[0]?.toLowerCase() || '';

    // Path completion for cd/ls
    if (PATH_COMMANDS.has(command) && getFilesystem && getCurrentDir) {
      const partial = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const suggestions = getPathSuggestions(getCurrentDir(), getFilesystem(), partial);
      if (suggestions.length === 0) return null;

      const selected = cycleOrList(suggestions, partial, now);
      return selected !== null ? `${command} ${selected}` : null;
    }

    // Theme name completion
    if (command === 'theme') {
      const partial = parts[1]?.toLowerCase() || '';
      const themeNames = themes.map(t => t.name).filter(n => n.startsWith(partial));
      if (themeNames.length === 0) return null;

      const selected = cycleOrList(themeNames, partial, now);
      return selected !== null ? `theme ${selected}` : null;
    }

    // Command name completion (first word only)
    if (parts.length > 1 || !command) return null;

    const suggestions = getSuggestions(command);
    if (suggestions.length === 0) return null;

    return cycleOrList(suggestions, command, now);
  }, [addOutput, getFilesystem, getCurrentDir]);

  const resetCompletion = useCallback(() => {
    lastPartialRef.current = '';
    cycleIndexRef.current = 0;
  }, []);

  return { complete, resetCompletion };
}
