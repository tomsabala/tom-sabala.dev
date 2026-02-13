import Terminal from './components/Terminal';
import TerminalOutput from './components/TerminalOutput';
import TerminalInput from './components/TerminalInput';
import { useTerminal } from './hooks/useTerminal';
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

export default function TerminalApp() {
  const {
    outputHistory,
    currentInput,
    setCurrentInput,
    isProcessing,
    handleKeyDown,
    inputRef,
  } = useTerminal();

  return (
    <Terminal inputRef={inputRef} outputHistory={outputHistory}>
      <TerminalOutput outputHistory={outputHistory} />
      <TerminalInput
        currentInput={currentInput}
        onInputChange={setCurrentInput}
        onKeyDown={handleKeyDown}
        inputRef={inputRef}
        isProcessing={isProcessing}
      />
    </Terminal>
  );
}
