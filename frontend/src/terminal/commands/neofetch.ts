import { registerCommand } from './registry';
import { PERSONAL_INFO, SKILLS } from '../data';
import type { CommandResult, OutputLine } from './types';

const ASCII_ART = [
  '        .---.        ',
  '       /     \\       ',
  '       \\.@-@./       ',
  '       /`\\_/`\\       ',
  '      //  _  \\\\      ',
  '     | \\     )|_     ',
  '    /`\\_`>  <_/ \\    ',
  '    \\__/\'---\'\\__/    ',
];

function getSiteUptime(): string {
  const launched = new Date('2025-01-01');
  const now = new Date();
  const diffMs = now.getTime() - launched.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
}

registerCommand({
  name: 'neofetch',
  description: 'Display system info card',
  usage: 'neofetch',
  execute: (): CommandResult => {
    const topSkills = SKILLS.flatMap(c => c.skills)
      .sort((a, b) => b.level - a.level)
      .slice(0, 5)
      .map(s => s.name)
      .join(', ');

    const info: [string, string][] = [
      ['', `${PERSONAL_INFO.name}`],
      ['', '─'.repeat(PERSONAL_INFO.name.length)],
      ['Title', PERSONAL_INFO.title],
      ['Location', PERSONAL_INFO.location],
      ['OS', 'Web (Browser)'],
      ['Terminal', 'terminal.tom-sabala.dev'],
      ['Shell', 'custom-react-shell'],
      ['Uptime', getSiteUptime()],
      ['Skills', topSkills],
      ['Contact', PERSONAL_INFO.email],
    ];

    const lines: OutputLine[] = [];
    const maxArt = ASCII_ART.length;
    const maxInfo = info.length;
    const rows = Math.max(maxArt, maxInfo);

    for (let i = 0; i < rows; i++) {
      const artPart = i < maxArt ? ASCII_ART[i] : ' '.repeat(ASCII_ART[0].length);

      let infoPart = '';
      if (i < maxInfo) {
        const [label, value] = info[i];
        infoPart = label ? `${label}: ${value}` : value;
      }

      lines.push({
        text: `${artPart}  ${infoPart}`,
        color: i === 0 || i === 1 ? 'var(--term-prompt)' : undefined,
        bold: i === 0,
      });
    }

    return { output: lines };
  },
});
