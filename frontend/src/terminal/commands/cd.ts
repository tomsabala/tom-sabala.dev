import { registerCommand } from './registry';
import { resolvePath, getNode, toDisplay } from '../filesystem';
import { ERROR } from './output';
import type { CommandResult, TerminalContext } from './types';

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

    if (!resolved || !node) {
      return {
        output: [{ text: `cd: no such directory: ${target}`, color: ERROR }],
      };
    }

    if (node.type !== 'dir') {
      return {
        output: [{ text: `cd: not a directory: ${target}`, color: ERROR }],
      };
    }

    ctx.setCurrentDir(toDisplay(resolved));
    return { output: [] };
  },
});
