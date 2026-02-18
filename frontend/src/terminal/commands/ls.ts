import { registerCommand } from './registry';
import { getPortfolio } from '../../repositories/portfolioRepository';
import { resolvePath, getNode, populateProjects } from '../filesystem';
import { getCachedProjects } from './projects';
import type { CommandResult, TerminalContext, OutputLine } from './types';

const PROJECTS_PATH = '/home/visitor/projects';

async function ensureProjectsPopulated(ctx: TerminalContext): Promise<void> {
  const fs = ctx.getFilesystem();
  const projectsNode = getNode(fs, PROJECTS_PATH);
  if (!projectsNode?.children || projectsNode.children.length > 0) return;

  const projects = getCachedProjects() ?? await getPortfolio().catch(() => null);
  if (projects) {
    populateProjects(fs, projects);
  }
}

function formatError(target: string): CommandResult {
  return {
    output: [{ text: `ls: cannot access '${target}': No such file or directory`, color: 'var(--term-error)' }],
  };
}

registerCommand({
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [directory]',
  execute: async (args: string[], ctx: TerminalContext): Promise<CommandResult> => {
    const target = args[0];
    const absolutePath = resolvePath(ctx.currentDir, target || '.');

    if (!absolutePath) {
      return formatError(target);
    }

    if (absolutePath.startsWith(PROJECTS_PATH)) {
      await ensureProjectsPopulated(ctx);
    }

    const node = getNode(ctx.getFilesystem(), absolutePath);
    if (!node) {
      return formatError(target);
    }

    if (node.type === 'file') {
      return { output: [{ text: node.name }] };
    }

    if (!node.children || node.children.length === 0) {
      return { output: [] };
    }

    const sorted = [...node.children].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const lines: OutputLine[] = sorted.map(child =>
      child.type === 'dir'
        ? { text: `${child.name}/`, color: 'var(--term-prompt)', bold: true }
        : { text: child.name }
    );

    return { output: lines };
  },
});
