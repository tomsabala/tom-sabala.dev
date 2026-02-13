import { registerCommand } from './registry';
import { SOCIAL_LINKS } from '../data';
import { getCachedProjects } from './projects';
import type { CommandResult } from './types';

registerCommand({
  name: 'open',
  description: 'Open a URL in a new tab',
  usage: 'open <github|linkedin|email|website|project N|url>',
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
          { text: '  open project <n>   Open nth project' },
          { text: '  open <url>         Open any URL' },
        ],
      };
    }

    const target = args[0].toLowerCase();

    // Handle "open project <n>"
    if (target === 'project') {
      return openProject(args[1]);
    }

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

function openProject(indexStr: string | undefined): CommandResult {
  if (!indexStr) {
    return {
      output: [{ text: "Usage: open project <number>. Run 'projects' first to see the list." }],
    };
  }

  const projects = getCachedProjects();
  if (!projects) {
    return {
      output: [{ text: "No projects loaded. Run 'projects' first." }],
    };
  }

  const index = parseInt(indexStr, 10);
  if (isNaN(index) || index < 1 || index > projects.length) {
    return {
      output: [{ text: `Invalid project number. Choose 1-${projects.length}.` }],
    };
  }

  const project = projects[index - 1];
  const url = project.live_url || project.github_url;

  if (!url) {
    return {
      output: [{ text: `No URL available for project "${project.title}".` }],
    };
  }

  return {
    output: [{ text: `Opening ${project.title}...` }],
    sideEffect: { type: 'open', url },
  };
}
