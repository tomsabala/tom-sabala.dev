import { registerCommand } from './registry';
import type { CommandResult, TerminalContext, OutputLine } from './types';

registerCommand({
  name: 'history',
  description: 'Show command history',
  usage: 'history',
  execute: (_args: string[], ctx: TerminalContext): CommandResult => {
    const items = ctx.history();

    if (items.length === 0) {
      return { output: [{ text: 'No command history yet.' }] };
    }

    // Show oldest first (history array is newest-first)
    const reversed = [...items].reverse();
    const lines: OutputLine[] = reversed.map((cmd, i) => ({
      text: `  ${String(i + 1).padStart(4)}  ${cmd}`,
    }));

    return { output: lines };
  },
});
