import { registerCommand } from './registry';
import type { CommandResult, TerminalContext } from './types';
import { resolvePath, getNode, toDisplay } from '../filesystem';

registerCommand({
  name: 'cd',
  description: 'Change current directory',
  usage: 'cd [directory]',
  execute: (_args: string[], ctx: TerminalContext): CommandResult => {
    const target = _args[0];

    if (!target) {
      ctx.setCurrentDir('~');
      return { output: [] };
    }

    const resolved = resolvePath(ctx.currentDir, target);
    const node = resolved ? getNode(ctx.getFilesystem(), resolved) : null;

    if (!node) {
      return {
        output: [{ text: `cd: no such directory: ${target}`, color: 'var(--term-error)' }],
      };
    }

    if (node.type !== 'dir') {
      return {
        output: [{ text: `cd: not a directory: ${target}`, color: 'var(--term-error)' }],
      };
    }

    ctx.setCurrentDir(toDisplay(resolved!));
    return { output: [] };
  },
});
