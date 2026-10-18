/**
 * The project hero's animated specimen. One rAF loop per mounted canvas; it stops when the
 * canvas scrolls out of view or the visitor asked for reduced motion, in which case a
 * single frame is drawn so the panel is never empty.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { A, PAL } from '../field/draw.ts';
import { ANIMATED_SPECIMENS } from './specimens-animated.ts';

interface AnimatedSpecimenProps {
  /** `projects.specimen` — a glyph key. Unknown or null renders the dot grid only. */
  specimen: string | null | undefined;
  className?: string;
}

export default function AnimatedSpecimen({ specimen, className = '' }: AnimatedSpecimenProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const factory = specimen ? ANIMATED_SPECIMENS[specimen] : undefined;
    const paint = factory?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let t0: number | null = null;
    let visible = true;

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      if (t0 == null) t0 = ts;
      const P = PAL[theme];
      g.fillStyle = A(P.mut, 0.22);
      for (let x = 24; x < w; x += 24) for (let y = 24; y < h; y += 24) g.fillRect(x - 0.5, y - 0.5, 1, 1);
      paint?.(g, w, h, P, (ts - t0) / 1000);
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(canvas);
    raf = requestAnimationFrame(frame);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [specimen, theme]);

  return <canvas ref={ref} aria-hidden="true" className={`block ${className}`} />;
}
