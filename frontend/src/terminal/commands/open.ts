import { registerCommand } from './registry';
import { SOCIAL_LINKS } from '../data';
import type { CommandResult } from './types';

registerCommand({
  name: 'open',
  description: 'Open a URL in a new tab',
  usage: 'open <github|linkedin|email|website|url>',
  execute: (args: string[]): CommandResult => {
    if (args.length === 0) {
      return {
        output: [
          { text: 'Usage: open <target>', bold: true },
          { text: '' },
          { text: '  open github        Open GitHub profile' },
          { text: '  open linkedin      Open LinkedIn profile' },
          { text: '  open email         Open email client' },
          { text: '  open website       Open portfolio website' },
          { text: '  open <url>         Open any URL' },
        ],
      };
    }

    const target = args[0].toLowerCase();

    // Match social links
    const social = SOCIAL_LINKS.find(l => l.name === target);
    if (social) {
      return {
        output: [{ text: `Opening ${social.label}...` }],
        sideEffect: { type: 'open', url: social.url },
      };
    }

    // Try as raw URL
    const rawUrl = args.join(' ');
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      return {
        output: [{ text: `Opening ${rawUrl}...` }],
        sideEffect: { type: 'open', url: rawUrl },
      };
    }

    return {
      output: [{ text: `Unknown target: ${target}. Type 'open' for usage.` }],
    };
  },
});
