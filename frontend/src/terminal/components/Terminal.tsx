import { useEffect, useRef, useCallback, type RefObject, type ReactNode } from 'react';
import type { OutputBlock } from '../commands/types';

interface TerminalProps {
  inputRef: RefObject<HTMLInputElement | null>;
  outputHistory: OutputBlock[];
  onContainerRef?: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}

export default function Terminal({ inputRef, outputHistory, onContainerRef, children }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    onContainerRef?.(el);
  }, [onContainerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [outputHistory.length]);

  return (
    <div
      ref={setRef}
      className="terminal-container"
      onClick={() => inputRef.current?.focus()}
      role="application"
      aria-label="Terminal emulator"
    >
      {children}
    </div>
  );
}
