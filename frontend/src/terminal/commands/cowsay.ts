import { registerCommand } from './registry';
import type { CommandResult } from './types';

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current && (current.length + 1 + word.length) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildBubble(text: string): string[] {
  const lines = wrapText(text, 40);
  const maxLen = Math.max(...lines.map(l => l.length));
  const border = '-'.repeat(maxLen + 2);
  const result: string[] = [` ${border}`];

  if (lines.length === 1) {
    result.push(`< ${lines[0].padEnd(maxLen)} >`);
  } else {
    for (const [i, line] of lines.entries()) {
      const padded = line.padEnd(maxLen);
      if (i === 0) result.push(`/ ${padded} \\`);
      else if (i === lines.length - 1) result.push(`\\ ${padded} /`);
      else result.push(`| ${padded} |`);
    }
  }

  result.push(` ${border}`);
  return result;
}

const COW = [
  '        \\   ^__^',
  '         \\  (oo)\\_______',
  '            (__)\\       )\\/\\',
  '                ||----w |',
  '                ||     ||',
];

registerCommand({
  name: 'cowsay',
  description: 'Make a cow say something',
  usage: 'cowsay <message>',
  execute: (args: string[]): CommandResult => {
    const message = args.join(' ') || 'moo';
    const bubble = buildBubble(message);
    const lines = [...bubble, ...COW].map(text => ({ text }));
    return { output: lines };
  },
});
