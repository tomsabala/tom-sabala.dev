import type { TerminalContext } from './types';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()';

export function runMatrixAnimation(ctx: TerminalContext): void {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;cursor:pointer;';
  document.body.appendChild(canvas);

  const context = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const fontSize = 14;
  const columns = Math.floor(canvas.width / fontSize);
  const drops: number[] = new Array(columns).fill(1);

  let animationId: number;
  let cleaned = false;

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

  function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    cancelAnimationFrame(animationId);
    canvas.remove();
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('keydown', cleanup);
    document.removeEventListener('click', cleanup);
    ctx.addOutput({ lines: [{ text: 'Exited the Matrix.', color: 'var(--term-fg-dim)' }] });
  }

  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', cleanup, { once: true });
  document.addEventListener('click', cleanup, { once: true });

  draw();
}
