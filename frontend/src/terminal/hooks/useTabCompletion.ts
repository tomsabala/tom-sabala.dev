import { useRef, useCallback } from 'react';
import { getSuggestions } from '../commands/registry';
import type { OutputBlock } from '../commands/types';

export function useTabCompletion(addOutput: (block: OutputBlock) => void) {
  const lastPartialRef = useRef<string>('');
  const cycleIndexRef = useRef<number>(0);
  const lastTabTimeRef = useRef<number>(0);

  const complete = useCallback((currentInput: string): string | null => {
    const now = Date.now();
    const parts = currentInput.split(/\s+/);
    const partial = parts[0]?.toLowerCase() || '';

    // Only complete the command name (first word)
    if (parts.length > 1 || !partial) return null;

    const suggestions = getSuggestions(partial);
    if (suggestions.length === 0) return null;

    const isDoubleTab = now - lastTabTimeRef.current < 400 && partial === lastPartialRef.current;
    lastTabTimeRef.current = now;

    if (isDoubleTab && suggestions.length > 1) {
      // Show all suggestions
      addOutput({
        lines: [{ text: suggestions.join('  ') }],
      });
      return null;
    }

    if (partial !== lastPartialRef.current) {
      lastPartialRef.current = partial;
      cycleIndexRef.current = 0;
    } else {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % suggestions.length;
    }

    return suggestions[cycleIndexRef.current];
  }, [addOutput]);

  const resetCompletion = useCallback(() => {
    lastPartialRef.current = '';
    cycleIndexRef.current = 0;
  }, []);

  return { complete, resetCompletion };
}
