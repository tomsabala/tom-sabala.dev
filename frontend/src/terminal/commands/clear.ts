import { registerCommand } from './registry';
import type { CommandResult } from './types';

registerCommand({
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: 'clear',
  aliases: ['cls'],
  execute: (): CommandResult => ({
    output: [],
    sideEffect: { type: 'clear' },
  }),
});
