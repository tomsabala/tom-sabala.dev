import { registerCommand } from './registry';
import { SKILLS } from '../data';
import type { CommandResult, OutputLine } from './types';

function progressBar(level: number): string {
  const filled = Math.round(level / 5);
  const empty = 20 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

registerCommand({
  name: 'skills',
  description: 'Display technical skills',
  usage: 'skills',
  execute: (): CommandResult => {
    const lines: OutputLine[] = [];

    for (const category of SKILLS) {
      lines.push({ text: category.name, bold: true, color: 'var(--term-prompt)' });
      for (const skill of category.skills) {
        const bar = progressBar(skill.level);
        lines.push({ text: `  ${skill.name.padEnd(16)} ${bar}  ${skill.level}%` });
      }
      lines.push({ text: '' });
    }

    return { output: lines };
  },
});
