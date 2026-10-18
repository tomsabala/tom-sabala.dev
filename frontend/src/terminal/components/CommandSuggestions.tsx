const SUGGESTIONS = ['help', 'about', 'ls', 'projects', 'apps', 'theme', 'field', 'sudo hire-me'];

interface CommandSuggestionsProps {
  onExecute: (command: string) => void;
  isProcessing: boolean;
}

export default function CommandSuggestions({ onExecute, isProcessing }: CommandSuggestionsProps) {
  return (
    <div className="terminal-suggestions" role="toolbar" aria-label="Command suggestions">
      {SUGGESTIONS.map(cmd => (
        <button
          key={cmd}
          className="terminal-suggestion-pill"
          onClick={() => onExecute(cmd)}
          disabled={isProcessing}
          type="button"
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}
