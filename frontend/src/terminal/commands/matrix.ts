import { registerCommand } from './registry';
import type { CommandResult, TerminalContext } from './types';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

registerCommand({
  name: 'matrix',
  description: 'Enter the Matrix',
  usage: 'matrix',
  execute: async (_args: string[], ctx: TerminalContext): Promise<CommandResult> => {
    if (prefersReducedMotion()) {
      return {
        output: [
          { text: '' },
          { text: 'Wake up, Neo...', color: '#00ff41', bold: true },
          { text: 'The Matrix has you.', color: '#00ff41' },
          { text: 'Follow the white rabbit.', color: '#00ff41' },
          { text: '' },
        ],
      };
    }

    const { runMatrixAnimation } = await import('./matrixAnimation');
    setTimeout(() => runMatrixAnimation(ctx), 100);

    return {
      output: [{ text: 'Entering the Matrix... (press any key or click to exit)', color: '#00ff41' }],
    };
  },
});
