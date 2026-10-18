/**
 * One static specimen glyph. Repaints on mount, on resize and whenever the theme flips,
 * because the painters bake palette colours into the pixels.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { paintGlyph, slugSeed } from '../../work/specimens.ts';

interface SpecimenCanvasProps {
  glyph: string | null | undefined;
  /** Project slug — seeds the PRNG so the drawing is stable per project. */
  slug: string;
  className?: string;
}

export default function SpecimenCanvas({ glyph, slug, className = '' }: SpecimenCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => paintGlyph(canvas, glyph, slugSeed(slug), theme);
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [glyph, slug, theme]);

  return <canvas ref={ref} aria-hidden="true" className={`border border-ln bg-s1 block ${className}`} />;
}
