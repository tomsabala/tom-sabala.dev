import { registerCommand } from './registry';
import { toAbsolute } from '../filesystem';
import type { CommandResult, TerminalContext } from './types';

registerCommand({
  name: 'pwd',
  description: 'Print current working directory',
  usage: 'pwd',
  execute: (_args: string[], ctx: TerminalContext): CommandResult => {
    return {
      output: [{ text: toAbsolute(ctx.currentDir) }],
    };
  },
});
