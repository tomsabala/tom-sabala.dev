import { useCallback } from 'react';
import Terminal from './components/Terminal';
import TerminalOutput from './components/TerminalOutput';
import TerminalInput from './components/TerminalInput';
import WelcomeBanner from './components/WelcomeBanner';
import CommandSuggestions from './components/CommandSuggestions';
import { useTerminal } from './hooks/useTerminal';
import { useTheme } from './hooks/useTheme';
import { useKonamiCode } from './hooks/useKonamiCode';
import './commands/clear';
import './commands/help';
import './commands/about';
import './commands/skills';
import './commands/social';
import './commands/contact';
import './commands/projects';
import './commands/download';
import './commands/open';
import './commands/history';
import './commands/theme';
import './commands/neofetch';
import './commands/sudo';
import './commands/cowsay';
import './commands/whoami';
import './commands/matrix';

export default function TerminalApp() {
  const { setTheme, setContainerRef } = useTheme();

  const {
    outputHistory,
    currentInput,
    setCurrentInput,
    isProcessing,
    handleKeyDown,
    executeCommand,
    addOutput,
    inputRef,
  } = useTerminal({ setTheme });

  const handleKonami = useCallback(() => {
    addOutput({
      lines: [
        { text: '' },
        { text: '  \u2191 \u2191 \u2193 \u2193 \u2190 \u2192 \u2190 \u2192 B A', bold: true, color: 'var(--term-prompt)' },
        { text: '' },
        { text: '  You found the secret!', bold: true },
        { text: '  Switching to Dracula theme...', color: 'var(--term-fg-dim)' },
        { text: '' },
      ],
    });
    setTheme('dracula');
  }, [addOutput, setTheme]);

  useKonamiCode(handleKonami);

  return (
    <Terminal inputRef={inputRef} outputHistory={outputHistory} onContainerRef={setContainerRef}>
      <WelcomeBanner />
      <TerminalOutput outputHistory={outputHistory} />
      <div className="terminal-sticky-footer">
        <TerminalInput
          currentInput={currentInput}
          onInputChange={setCurrentInput}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          isProcessing={isProcessing}
        />
        <CommandSuggestions onExecute={executeCommand} isProcessing={isProcessing} />
      </div>
    </Terminal>
  );
}
