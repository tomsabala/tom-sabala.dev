import { registerCommand } from './registry';
import { getPortfolio } from '../../repositories/portfolioRepository';
import { resolvePath, getNode, populateProjects } from '../filesystem';
import type { CommandResult, TerminalContext, OutputLine } from './types';

const PROJECTS_PATH = '/home/visitor/projects';

async function ensureProjectsPopulated(ctx: TerminalContext): Promise<void> {
  const fs = ctx.getFilesystem();
  const projectsNode = getNode(fs, PROJECTS_PATH);
  if (!projectsNode?.children || projectsNode.children.length > 0) return;

  const projects = await getPortfolio().catch(() => null);
  if (projects) {
    populateProjects(fs, projects);
  }
}

registerCommand({
  name: 'cat',
  description: 'Display file contents',
  usage: 'cat <file> [file2 ...]',
  execute: async (args: string[], ctx: TerminalContext): Promise<CommandResult> => {
    if (args.length === 0) {
      return { output: [{ text: 'Usage: cat <file>', color: 'var(--term-error)' }] };
    }

    const lines: OutputLine[] = [];

    for (const arg of args) {
      const absolutePath = resolvePath(ctx.currentDir, arg);

      if (!absolutePath) {
        lines.push({ text: `cat: ${arg}: No such file or directory`, color: 'var(--term-error)' });
        continue;
      }

      if (absolutePath.startsWith(PROJECTS_PATH)) {
        await ensureProjectsPopulated(ctx);
      }

      const node = getNode(ctx.getFilesystem(), absolutePath);

      if (!node) {
        lines.push({ text: `cat: ${arg}: No such file or directory`, color: 'var(--term-error)' });
        continue;
      }

      if (node.type === 'dir') {
        lines.push({ text: `cat: ${arg}: Is a directory`, color: 'var(--term-error)' });
        continue;
      }

      if (node.content) {
        for (const line of node.content.split('\n')) {
          lines.push({ text: line });
        }
      }

      if (args.length > 1) {
        lines.push({ text: '' });
      }
    }

    return { output: lines };
  },
});
