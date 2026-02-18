import { registerCommand } from './registry';
import { themes } from '../themes';
import type { CommandResult, TerminalContext, OutputLine } from './types';

registerCommand({
  name: 'theme',
  description: 'List or switch terminal themes',
  usage: 'theme [name]',
  execute: (args: string[], ctx: TerminalContext): CommandResult => {
    if (args.length === 0) {
      const currentName = ctx.currentThemeName();
      const lines: OutputLine[] = [
        { text: 'Available themes:', bold: true },
        { text: '' },
      ];

      for (const t of themes) {
        const isActive = t.name === currentName;
        const marker = isActive ? '>' : ' ';
        const dot = '\u25CF';
        lines.push({
          text: `${marker} ${dot} ${t.name.padEnd(18)} ${t.label}`,
          color: t.colors.fg,
        });
      }

      lines.push({ text: '' });
      lines.push({ text: "Usage: theme <name>" });

      return { output: lines };
    }

    const name = args[0].toLowerCase();
    const success = ctx.setTheme(name);

    if (!success) {
      return {
        output: [
          { text: `Unknown theme: ${name}` },
          { text: "Type 'theme' to see available themes." },
        ],
      };
    }

    return {
      output: [{ text: `Theme switched to '${name}'.` }],
    };
  },
});
