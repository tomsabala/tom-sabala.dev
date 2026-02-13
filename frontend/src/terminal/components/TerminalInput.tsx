import type { RefObject } from 'react';
import { PROMPT } from '../constants';

interface TerminalInputProps {
  currentInput: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  isProcessing: boolean;
}

export default function TerminalInput({
  currentInput,
  onInputChange,
  onKeyDown,
  inputRef,
  isProcessing,
}: TerminalInputProps) {
  return (
    <div className="terminal-input-row">
      <span className="terminal-prompt-text">{PROMPT}</span>
      <input
        ref={inputRef}
        type="text"
        className="terminal-input-field"
        value={currentInput}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={isProcessing}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Terminal input"
      />
      <span className="terminal-cursor" aria-hidden="true" />
    </div>
  );
}
