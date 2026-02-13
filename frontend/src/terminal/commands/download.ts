import { registerCommand } from './registry';
import { getPdfDownloadUrl } from '../../repositories/resumeRepository';
import type { CommandResult } from './types';

registerCommand({
  name: 'download',
  description: 'Download files (e.g., download cv)',
  usage: 'download cv',
  execute: (args: string[]): CommandResult => {
    if (args.length === 0 || args[0].toLowerCase() !== 'cv') {
      return {
        output: [
          { text: "Usage: download cv" },
          { text: "Downloads the current version of my CV/resume as PDF." },
        ],
      };
    }

    const url = getPdfDownloadUrl();

    return {
      output: [{ text: 'Starting CV download...' }],
      sideEffect: { type: 'download', url, filename: 'Tom_Sabala_CV.pdf' },
    };
  },
});
