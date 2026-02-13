import { registerCommand } from './registry';
import { getPortfolio } from '../../repositories/portfolioRepository';
import type { PortfolioItem } from '../../types/index';
import type { CommandResult, OutputLine } from './types';

let cachedProjects: PortfolioItem[] | null = null;

export function getCachedProjects(): PortfolioItem[] | null {
  return cachedProjects;
}

registerCommand({
  name: 'projects',
  description: 'Display portfolio projects',
  usage: 'projects',
  aliases: ['portfolio'],
  execute: async (): Promise<CommandResult> => {
    if (cachedProjects) {
      return formatProjects(cachedProjects);
    }

    try {
      const projects: PortfolioItem[] = await getPortfolio();
      cachedProjects = projects;
      return formatProjects(projects);
    } catch {
      return {
        output: [{ text: 'Error: Unable to fetch projects. The API may be offline. Try again later.', color: 'var(--term-error)' }],
      };
    }
  },
});

function formatProjects(projects: PortfolioItem[]): CommandResult {
  if (projects.length === 0) {
    return { output: [{ text: 'No projects found.' }] };
  }

  const lines: OutputLine[] = [
    { text: 'Portfolio Projects:', bold: true },
    { text: '' },
  ];

  projects.forEach((project, i) => {
    lines.push({ text: `  ${i + 1}. ${project.title}`, bold: true, color: 'var(--term-prompt)' });

    const desc = project.description.length > 120
      ? project.description.slice(0, 117) + '...'
      : project.description;
    lines.push({ text: `     ${desc}` });

    if (project.technologies.length > 0) {
      lines.push({ text: `     Tech: ${project.technologies.join(', ')}` });
    }

    const urls: string[] = [];
    if (project.live_url) urls.push(`Live: ${project.live_url}`);
    if (project.github_url) urls.push(`GitHub: ${project.github_url}`);
    if (urls.length > 0) {
      lines.push({ text: `     ${urls.join('  |  ')}` });
    }

    lines.push({ text: '' });
  });

  lines.push({ text: "Tip: use 'open project <number>' to visit a project." });

  return { output: lines };
}
