import Terminal from './components/Terminal';
import TerminalOutput from './components/TerminalOutput';
import TerminalInput from './components/TerminalInput';
import WelcomeBanner from './components/WelcomeBanner';
import CommandSuggestions from './components/CommandSuggestions';
import { useTerminal } from './hooks/useTerminal';
import { useTheme } from './hooks/useTheme';
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

export default function TerminalApp() {
  const { setTheme, setContainerRef } = useTheme();

  const {
    outputHistory,
    currentInput,
    setCurrentInput,
    isProcessing,
    handleKeyDown,
    executeCommand,
    inputRef,
  } = useTerminal({ setTheme });

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
