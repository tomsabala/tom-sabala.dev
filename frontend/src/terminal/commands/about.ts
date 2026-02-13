import { registerCommand } from './registry';
import { PERSONAL_INFO } from '../data';
import type { CommandResult, OutputLine } from './types';

registerCommand({
  name: 'about',
  description: 'Display personal information',
  usage: 'about',
  execute: (): CommandResult => {
    const lines: OutputLine[] = [
      { text: PERSONAL_INFO.name, bold: true },
      { text: PERSONAL_INFO.title, color: 'var(--term-prompt)' },
      { text: '' },
      { text: `Location:  ${PERSONAL_INFO.location}` },
      { text: `Email:     ${PERSONAL_INFO.email}` },
      { text: `Website:   ${PERSONAL_INFO.website}` },
      { text: '' },
      { text: PERSONAL_INFO.bio },
    ];
    return { output: lines };
  },
});
