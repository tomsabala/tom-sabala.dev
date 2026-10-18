/**
 * Canvas primitives shared by all four field algorithms.
 * Ported verbatim from `Portfolio Home.dc.html`: `PAL`, `A(c, a)`, `MONO`,
 * `grid(g, w, h, P)` and `cross(g, x, y, col, label)`.
 */

import type { Pal } from './types';

export type { Pal };

export const PAL: Record<'dark' | 'light', Pal> = {
  dark: {
    acc: '200,245,60',
    mut: '147,165,150',
    ink: '232,240,227',
    bg: '#0a0f0b',
    s1: '#0f1611',
    ln: '#1d2a21',
    ln2: '#2f4134',
    k: 1,
  },
  light: {
    acc: '63,100,0',
    mut: '86,101,90',
    ink: '13,21,15',
    bg: '#eef0e6',
    s1: '#e3e7da',
    ln: '#cdd5c3',
    ln2: '#aab79f',
    k: 1.5,
  },
};

export const A = (c: string, a: number): string => `rgba(${c},${Math.min(1, a)})`;

export const MONO = "500 10px 'DM Mono', monospace";

/** The dot lattice + tick marks the whole field sits on. */
export function grid(g: CanvasRenderingContext2D, w: number, h: number, P: Pal): void {
  g.fillStyle = A(P.mut, 0.18 * P.k);
  for (let x = 40; x < w; x += 40) for (let y = 40; y < h; y += 40) g.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
  g.strokeStyle = A(P.mut, 0.4);
  g.lineWidth = 1;
  g.beginPath();
  for (let y = 0; y < h; y += 40) {
    const L = y % 200 === 0 ? 12 : 5;
    g.moveTo(0, y + 0.5);
    g.lineTo(L, y + 0.5);
  }
  for (let x = 0; x < w; x += 40) {
    const L = x % 200 === 0 ? 12 : 5;
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, L);
  }
  g.stroke();
}

/** The targeting reticle drawn at the pointer. */
export function cross(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  col: string,
  label?: string,
): void {
  g.strokeStyle = col;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(x, y, 10, 0, Math.PI * 2);
  g.moveTo(x - 18, y);
  g.lineTo(x - 4, y);
  g.moveTo(x + 4, y);
  g.lineTo(x + 18, y);
  g.moveTo(x, y - 18);
  g.lineTo(x, y - 4);
  g.moveTo(x, y + 4);
  g.lineTo(x, y + 18);
  g.stroke();
  if (label) {
    g.fillStyle = col;
    g.font = MONO;
    g.fillText(label, x + 16, y - 14);
  }
}
