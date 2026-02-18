import { useRef, useCallback, type RefObject } from 'react';

interface TerminalInputProps {
  prompt: string;
  currentInput: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
}

export default function TerminalInput({
  prompt,
  currentInput,
  onInputChange,
  onKeyDown,
  inputRef,
  isProcessing,
}: TerminalInputProps) {
  const cursorPosRef = useRef<number>(0);
  const visualRef = useRef<HTMLDivElement>(null);

  const updateCursorPos = useCallback(() => {
    const el = inputRef.current;
    if (el) {
      cursorPosRef.current = el.selectionStart ?? currentInput.length;
      // Force visual update without state
      if (visualRef.current) {
        const pos = cursorPosRef.current;
        const before = currentInput.slice(0, pos);
        const at = currentInput[pos] || ' ';
        const after = currentInput.slice(pos + 1);
        const spans = visualRef.current.children;
        if (spans[0]) spans[0].textContent = before;
        if (spans[1]) spans[1].textContent = at;
        if (spans[2]) spans[2].textContent = after;
      }
    }
  }, [inputRef, currentInput]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e.target.value);
  }, [onInputChange]);

  const handleKeyDownInternal = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown(e);
    // After arrow key moves, update cursor position on next tick
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
      requestAnimationFrame(updateCursorPos);
    }
  }, [onKeyDown, updateCursorPos]);

  const pos = inputRef.current?.selectionStart ?? currentInput.length;
  const textBefore = currentInput.slice(0, pos);
  const charAtCursor = currentInput[pos] || ' ';
  const textAfter = currentInput.slice(pos + 1);

  return (
    <div className="terminal-input-row">
      <span className="terminal-prompt-text">{prompt}</span>
      <div className="terminal-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="terminal-input-field"
          value={currentInput}
          onChange={handleChange}
          onKeyDown={handleKeyDownInternal}
          onSelect={updateCursorPos}
          onClick={updateCursorPos}
          disabled={isProcessing}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Terminal input"
        />
        <div className="terminal-input-visual" ref={visualRef} aria-hidden="true">
          <span>{textBefore}</span>
          <span className="terminal-cursor">{charAtCursor}</span>
          <span>{textAfter}</span>
        </div>
      </div>
    </div>
  );
}
