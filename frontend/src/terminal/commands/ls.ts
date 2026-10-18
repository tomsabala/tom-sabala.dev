import { registerCommand } from './registry';
import { resolvePath, getNode } from '../filesystem';
import type { CommandResult, TerminalContext, OutputLine } from './types';

function formatError(target: string): CommandResult {
  return {
    output: [{ text: `ls: cannot access '${target}': No such file or directory`, color: 'var(--term-error)' }],
  };
}

registerCommand({
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [directory]',
  execute: (args: string[], ctx: TerminalContext): CommandResult => {
    const target = args[0];
    const absolutePath = resolvePath(ctx.currentDir, target || '.');

    if (!absolutePath) {
      return formatError(target);
    }

    const node = getNode(ctx.getFilesystem(), absolutePath);
    if (!node) {
      return formatError(target);
    }

    if (node.type === 'file') {
      return { output: [{ text: node.name }] };
    }

    if (!node.children || node.children.length === 0) {
      return { output: [] };
    }

    const sorted = [...node.children].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const lines: OutputLine[] = sorted.map(child =>
      child.type === 'dir'
        ? { text: `${child.name}/`, color: 'var(--term-prompt)', bold: true }
        : { text: child.name }
    );

    return { output: lines };
  },
});
