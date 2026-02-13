import { registerCommand } from './registry';
import { PERSONAL_INFO } from '../data';
import type { CommandResult, OutputLine } from './types';

registerCommand({
  name: 'sudo',
  description: 'Execute with elevated privileges',
  usage: 'sudo <command>',
  execute: (args: string[]): CommandResult => {
    if (args.length === 0) {
      return {
        output: [{ text: 'Usage: sudo <command>' }],
      };
    }

    const subcommand = args.join(' ').toLowerCase();

    if (subcommand === 'hire-me' || subcommand === 'hire me') {
      const lines: OutputLine[] = [
        { text: '[sudo] password for visitor: ********', color: 'var(--term-fg-dim)' },
        { text: '' },
        { text: "Permission granted! Here's how to reach me:", bold: true, color: 'var(--term-prompt)' },
        { text: '' },
        { text: `  Email:    ${PERSONAL_INFO.email}` },
        { text: `  Website:  ${PERSONAL_INFO.website}` },
        { text: '' },
        { text: "  I'm always open to interesting opportunities.", color: 'var(--term-fg-dim)' },
        { text: "  Let's build something great together!" },
      ];
      return { output: lines };
    }

    return {
      output: [
        { text: `[sudo] password for visitor: ********`, color: 'var(--term-fg-dim)' },
        { text: "Nice try. You don't have sudo privileges here.", color: 'var(--term-error)' },
      ],
    };
  },
});
