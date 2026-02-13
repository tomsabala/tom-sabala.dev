import { useState, useCallback, useRef } from 'react';
import type { OutputBlock, CommandResult, SideEffect } from '../commands/types';
import { execute, getAllCommands } from '../commands/registry';
import { useCommandHistory } from './useCommandHistory';
import { useTabCompletion } from './useTabCompletion';

export function useTerminal() {
  const [outputHistory, setOutputHistory] = useState<OutputBlock[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addOutput = useCallback((block: OutputBlock) => {
    setOutputHistory(prev => [...prev, block]);
  }, []);

  const clearTerminal = useCallback(() => {
    setOutputHistory([]);
  }, []);

  const { history, addToHistory, navigateUp, navigateDown, resetNavigation } = useCommandHistory();
  const historyRef = useRef<string[]>(history);
  historyRef.current = history;
  const { complete, resetCompletion } = useTabCompletion(addOutput);

  const handleSideEffect = useCallback((effect: SideEffect) => {
    switch (effect.type) {
      case 'clear':
        clearTerminal();
        break;
      case 'download': {
        const a = document.createElement('a');
        a.href = effect.url;
        a.download = effect.filename;
        a.click();
        break;
      }
      case 'open':
        window.open(effect.url, '_blank', 'noopener,noreferrer');
        break;
    }
  }, [clearTerminal]);

  const executeCommand = useCallback(async (input: string) => {
    const trimmed = input.trim();

    // Add prompt + command echo to output
    addOutput({
      command: trimmed,
      lines: [],
      isPrompt: true,
    });

    if (!trimmed) {
      setCurrentInput('');
      return;
    }

    addToHistory(trimmed);
    resetNavigation();
    resetCompletion();
    setCurrentInput('');
    setIsProcessing(true);

    try {
      const result: CommandResult = await execute(trimmed, { addOutput, clearTerminal, commands: getAllCommands, history: () => historyRef.current });

      if (result.output.length > 0) {
        addOutput({ lines: result.output });
      }

      if (result.sideEffect) {
        handleSideEffect(result.sideEffect);
      }
    } catch (err) {
      addOutput({
        lines: [{ text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, color: 'var(--term-error)' }],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [addOutput, addToHistory, clearTerminal, handleSideEffect, resetNavigation, resetCompletion]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isProcessing) {
        executeCommand(currentInput);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = navigateUp(currentInput);
      if (prev !== null) setCurrentInput(prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = navigateDown();
      if (next !== null) setCurrentInput(next);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const completed = complete(currentInput);
      if (completed !== null) setCurrentInput(completed);
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearTerminal();
    }
  }, [isProcessing, currentInput, executeCommand, navigateUp, navigateDown, complete, clearTerminal]);

  return {
    outputHistory,
    currentInput,
    setCurrentInput,
    isProcessing,
    handleKeyDown,
    inputRef,
  };
}
