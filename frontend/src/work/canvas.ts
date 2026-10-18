/**
 * The preamble every specimen canvas shares: size the backing store to the device pixel
 * ratio, hand the painter a context in CSS pixels, and lay down the dot lattice the
 * prototype draws under both the static glyphs and the animated hero specimens.
 */
import type { Pal } from '../field/draw.ts';
import { A } from '../field/draw.ts';

/** A canvas ready to paint on: cleared, and scaled so painters work in CSS pixels. */
export interface CanvasSurface {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/**
 * Null when the element has no layout yet or no 2D context — both are "try again on the
 * next frame", never an error. The backing store is capped at 2× because a 3× store costs
 * 2.25× the fill rate for no visible gain, and is only reallocated when the size actually
 * changed, so a theme flip does not throw the pixels away before `clearRect` does.
 */
export function prepareCanvas(canvas: HTMLCanvasElement): CanvasSurface | null {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return null;
  const g = canvas.getContext('2d');
  if (!g) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(w * dpr);
  const bh = Math.round(h * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

/** The dot lattice a specimen sits on; a project without a glyph shows this alone. */
export function dotGrid(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  P: Pal,
  step: number,
  alpha: number,
): void {
  g.fillStyle = A(P.mut, alpha);
  for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) g.fillRect(x - 0.5, y - 0.5, 1, 1);
}
