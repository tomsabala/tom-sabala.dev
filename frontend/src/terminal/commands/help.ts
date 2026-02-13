import { registerCommand } from './registry';
import type { CommandResult, TerminalContext, OutputLine } from './types';

registerCommand({
  name: 'help',
  description: 'List available commands',
  usage: 'help [command]',
  aliases: ['?'],
  execute: (args: string[], ctx: TerminalContext): CommandResult => {
    const commands = ctx.commands();

    if (args.length > 0) {
      const target = args[0].toLowerCase();
      const cmd = commands.find(c => c.name === target || c.aliases?.includes(target));
      if (!cmd) {
        return { output: [{ text: `Unknown command: ${target}` }] };
      }
      const lines: OutputLine[] = [
        { text: cmd.name, bold: true },
        { text: `  ${cmd.description}` },
      ];
      if (cmd.usage) {
        lines.push({ text: `  Usage: ${cmd.usage}` });
      }
      if (cmd.aliases?.length) {
        lines.push({ text: `  Aliases: ${cmd.aliases.join(', ')}` });
      }
      return { output: lines };
    }

    const lines: OutputLine[] = [
      { text: 'Available commands:', bold: true },
      { text: '' },
    ];

    for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
      const aliasStr = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
      lines.push({ text: `  ${cmd.name.padEnd(12)} ${cmd.description}${aliasStr}` });
    }

    lines.push({ text: '' });
    lines.push({ text: "Type 'help <command>' for more details." });

    return { output: lines };
  },
});
