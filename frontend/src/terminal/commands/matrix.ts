import { registerCommand } from './registry';
import type { CommandResult, TerminalContext } from './types';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function runMatrixAnimation(ctx: TerminalContext): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'matrix-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;cursor:pointer;';
  document.body.appendChild(canvas);

  const context = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const fontSize = 14;
  const columns = Math.floor(canvas.width / fontSize);
  const drops: number[] = new Array(columns).fill(1);

  let animationId: number;

  function draw() {
    context.fillStyle = 'rgba(0, 0, 0, 0.05)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#00ff41';
    context.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      const char = CHARS[Math.floor(Math.random() * CHARS.length)];
      context.fillText(char, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }

    animationId = requestAnimationFrame(draw);
  }

  function cleanup() {
    cancelAnimationFrame(animationId);
    canvas.remove();
    document.removeEventListener('keydown', cleanup);
    document.removeEventListener('click', cleanup);
    ctx.addOutput({ lines: [{ text: 'Exited the Matrix.', color: 'var(--term-fg-dim)' }] });
  }

  document.addEventListener('keydown', cleanup, { once: true });
  document.addEventListener('click', cleanup, { once: true });

  draw();
}

registerCommand({
  name: 'matrix',
  description: 'Enter the Matrix',
  usage: 'matrix',
  execute: (_args: string[], ctx: TerminalContext): CommandResult => {
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

    // Defer animation to after command output renders
    setTimeout(() => runMatrixAnimation(ctx), 100);

    return {
      output: [{ text: 'Entering the Matrix... (press any key or click to exit)', color: '#00ff41' }],
    };
  },
});
