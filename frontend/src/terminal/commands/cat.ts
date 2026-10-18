import { registerCommand } from './registry';
import { resolvePath, getNode } from '../filesystem';
import type { CommandResult, TerminalContext, OutputLine } from './types';

registerCommand({
  name: 'cat',
  description: 'Display file contents',
  usage: 'cat <file> [file2 ...]',
  execute: (args: string[], ctx: TerminalContext): CommandResult => {
    if (args.length === 0) {
      return { output: [{ text: 'Usage: cat <file>', color: 'var(--term-error)' }] };
    }

    const lines: OutputLine[] = [];

    for (const arg of args) {
      const absolutePath = resolvePath(ctx.currentDir, arg);

      if (!absolutePath) {
        lines.push({ text: `cat: ${arg}: No such file or directory`, color: 'var(--term-error)' });
        continue;
      }

      const node = getNode(ctx.getFilesystem(), absolutePath);

      if (!node) {
        lines.push({ text: `cat: ${arg}: No such file or directory`, color: 'var(--term-error)' });
        continue;
      }

      if (node.type === 'dir') {
        lines.push({ text: `cat: ${arg}: Is a directory`, color: 'var(--term-error)' });
        continue;
      }

      if (node.content) {
        for (const line of node.content.split('\n')) {
          lines.push({ text: line });
        }
      }

      if (args.length > 1) {
        lines.push({ text: '' });
      }
    }

    return { output: lines };
  },
});
