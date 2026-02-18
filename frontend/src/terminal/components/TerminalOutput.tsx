import type { OutputBlock, OutputLine } from '../commands/types';
import { PROMPT } from '../constants';

function LineContent({ line }: { line: OutputLine }) {
  const style: React.CSSProperties = {};
  if (line.color) style.color = line.color;

  const className = `terminal-line${line.bold ? ' terminal-line--bold' : ''}`;

  if (line.link) {
    return (
      <div className={className} style={style}>
        <a href={line.link.href} target="_blank" rel="noopener noreferrer" className="terminal-link">
          {line.link.label || line.link.href}
        </a>
        {line.text && ` ${line.text}`}
      </div>
    );
  }

  return <div className={className} style={style}>{line.text}</div>;
}

interface TerminalOutputProps {
  outputHistory: OutputBlock[];
}

export default function TerminalOutput({ outputHistory }: TerminalOutputProps) {
  return (
    <div className="terminal-output" aria-live="polite" role="log">
      {outputHistory.map((block, i) => (
        <div key={i} className="terminal-output-block">
          {block.isPrompt && (
            <div>
              <span className="terminal-prompt-text">{block.promptText || PROMPT}</span>
              <span className="terminal-command-echo">{block.command}</span>
            </div>
          )}
          {block.lines.map((line, j) => (
            <LineContent key={j} line={line} />
          ))}
        </div>
      ))}
    </div>
  );
}
