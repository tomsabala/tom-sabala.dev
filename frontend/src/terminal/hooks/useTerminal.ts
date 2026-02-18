import { useState, useCallback, useRef, useMemo } from 'react';
import type { OutputBlock, CommandResult, SideEffect } from '../commands/types';
import { execute, getAllCommands } from '../commands/registry';
import { useCommandHistory } from './useCommandHistory';
import { useTabCompletion } from './useTabCompletion';
import { buildFilesystem } from '../filesystem';
import { getPrompt } from '../constants';

interface UseTerminalOptions {
  setTheme: (name: string) => boolean;
  currentThemeName: () => string;
}

export function useTerminal({ setTheme, currentThemeName }: UseTerminalOptions) {
  const [outputHistory, setOutputHistory] = useState<OutputBlock[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDir, setCurrentDir] = useState('~');
  const inputRef = useRef<HTMLInputElement>(null);

  const filesystem = useMemo(() => buildFilesystem(), []);

  const currentDirRef = useRef(currentDir);
  currentDirRef.current = currentDir;

  const addOutput = useCallback((block: OutputBlock) => {
    setOutputHistory(prev => [...prev, block]);
  }, []);

  const clearTerminal = useCallback(() => {
    setOutputHistory([]);
  }, []);

  const { history, addToHistory, navigateUp, navigateDown, resetNavigation } = useCommandHistory();
  const historyRef = useRef<string[]>(history);
  historyRef.current = history;

  const { complete, resetCompletion } = useTabCompletion(
    addOutput,
    () => filesystem,
    () => currentDirRef.current,
  );

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
    const promptText = getPrompt(currentDirRef.current);

    addOutput({
      command: trimmed,
      lines: [],
      isPrompt: true,
      promptText,
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
      const result: CommandResult = await execute(trimmed, {
        addOutput,
        clearTerminal,
        commands: getAllCommands,
        history: () => historyRef.current,
        setTheme,
        currentDir: currentDirRef.current,
        setCurrentDir: (dir: string) => {
          setCurrentDir(dir);
          currentDirRef.current = dir;
        },
        getFilesystem: () => filesystem,
        currentThemeName,
      });

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
  }, [addOutput, addToHistory, clearTerminal, filesystem, handleSideEffect, resetNavigation, resetCompletion, setTheme, currentThemeName]);

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
    executeCommand,
    addOutput,
    inputRef,
    currentDir,
  };
}
