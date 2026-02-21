import { registerCommand } from './registry';
import { PERSONAL_INFO, SOCIAL_LINKS } from '../data';
import type { CommandResult, OutputLine } from './types';

registerCommand({
  name: 'contact',
  description: 'Display contact information and social links',
  usage: 'contact',
  execute: (): CommandResult => {
    const lines: OutputLine[] = [
      { text: 'Contact Information:', bold: true },
      { text: '' },
      { text: `  Email:     ${PERSONAL_INFO.email}` },
      { text: `  Website:   ${PERSONAL_INFO.website}` },
      { text: '' },
      { text: 'Social Links:', bold: true },
      { text: '' },
    ];

    for (const link of SOCIAL_LINKS) {
      lines.push({
        text: `  ${link.label.padEnd(20)}`,
        link: { href: link.url, label: link.url },
      });
    }

    lines.push({ text: '' });
    lines.push({ text: "Use 'open email' to send a message directly." });

    return { output: lines };
  },
});
