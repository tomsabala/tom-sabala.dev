import { registerCommand } from './registry';
import { projectSlug } from '../filesystem';
import { DIM, hint } from './output';
import type { CommandResult, TerminalContext, OutputLine } from './types';

registerCommand({
  name: 'projects',
  description: 'List projects',
  usage: 'projects',
  execute: (_args: string[], ctx: TerminalContext): CommandResult => {
    const snapshot = ctx.getProjects();

    if (snapshot.status === 'loading') {
      return { output: [{ text: 'project list loading…', color: DIM }] };
    }
    if (snapshot.status === 'unavailable') {
      return { output: [{ text: 'project list unavailable', color: DIM }] };
    }
    if (snapshot.items.length === 0) {
      return { output: [{ text: 'no published projects', color: DIM }] };
    }

    const width = Math.max(...snapshot.items.map(p => projectSlug(p).length), 12);
    const lines: OutputLine[] = [
      { text: 'Projects', bold: true },
      { text: '' },
    ];

    for (const project of snapshot.items) {
      lines.push({ text: `  ${projectSlug(project).padEnd(width)}  ${project.description}` });
    }

    lines.push(...hint('cd projects/<name> and cat README.txt for more.', DIM));

    return { output: lines };
  },
});
