import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import type { OutputBlock } from '../commands/types';

interface TerminalProps {
  inputRef: RefObject<HTMLInputElement | null>;
  outputHistory: OutputBlock[];
  children: ReactNode;
}

export default function Terminal({ inputRef, outputHistory, children }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom only when output changes
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [outputHistory.length]);

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      onClick={handleClick}
      role="application"
      aria-label="Terminal emulator"
    >
      {children}
    </div>
  );
}
