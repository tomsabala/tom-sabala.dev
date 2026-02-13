import { registerCommand } from './registry';
import type { CommandResult } from './types';

registerCommand({
  name: 'whoami',
  description: 'Display current user',
  usage: 'whoami',
  execute: (): CommandResult => ({
    output: [{ text: 'visitor' }],
  }),
});
