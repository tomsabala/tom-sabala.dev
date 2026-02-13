import { registerCommand } from './registry';
import { PERSONAL_INFO, SOCIAL_LINKS } from '../data';
import type { CommandResult, OutputLine } from './types';

registerCommand({
  name: 'contact',
  description: 'Display contact information',
  usage: 'contact',
  execute: (): CommandResult => {
    const lines: OutputLine[] = [
      { text: 'Contact Information:', bold: true },
      { text: '' },
      { text: `  Email:     ${PERSONAL_INFO.email}` },
      { text: `  Website:   ${PERSONAL_INFO.website}` },
      { text: '' },
    ];

    const github = SOCIAL_LINKS.find(l => l.name === 'github');
    const linkedin = SOCIAL_LINKS.find(l => l.name === 'linkedin');

    if (github) {
      lines.push({ text: `  GitHub:    `, link: { href: github.url, label: github.url } });
    }
    if (linkedin) {
      lines.push({ text: `  LinkedIn:  `, link: { href: linkedin.url, label: linkedin.url } });
    }

    lines.push({ text: '' });
    lines.push({ text: "You can also use 'open email' to send a message directly." });

    return { output: lines };
  },
});
