import { registerCommand } from './registry';
import { SOCIAL_LINKS } from '../data';
import type { CommandResult, OutputLine } from './types';

registerCommand({
  name: 'social',
  description: 'Display social links',
  usage: 'social',
  aliases: ['links'],
  execute: (): CommandResult => {
    const lines: OutputLine[] = [
      { text: 'Social Links:', bold: true },
      { text: '' },
    ];

    SOCIAL_LINKS.forEach((link, i) => {
      lines.push({
        text: `  ${i + 1}. ${link.label.padEnd(20)}`,
        link: { href: link.url, label: link.url },
      });
    });

    lines.push({ text: '' });
    lines.push({ text: "Tip: use 'open github' or 'open linkedin' to visit directly." });

    return { output: lines };
  },
});
