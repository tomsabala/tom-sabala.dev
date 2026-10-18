/**
 * Static specimen glyphs for the work list, ported verbatim from the `glyph_*` painters in
 * the design prototype (`Portfolio Home.dc.html`). Each one is deterministic for a given
 * seed, so a row redraws identically on resize and on a theme flip.
 */
import type { Pal } from '../field/draw.ts';
import { A, PAL } from '../field/draw.ts';
import { dotGrid, prepareCanvas } from './canvas.ts';

type GlyphPainter = (
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  P: Pal,
  R: () => number,
) => void;

/** mulberry32 — the prototype's seeded PRNG, kept so glyphs match the design exactly. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Monotone chain convex hull; returns the hull vertices in order. */
function hull<T extends { x: number; y: number }>(P: T[]): T[] {
  const p = P.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cr = (o: T, a: T, b: T) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: T[] = [];
  const up: T[] = [];
  for (const q of p) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const glyphHull: GlyphPainter = (g, w, h, P, R) => {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 26; i++) pts.push({ x: 24 + R() * (w - 48), y: 18 + R() * (h - 36) });
  const H = hull(pts);
  g.beginPath();
  H.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.closePath();
  g.fillStyle = A(P.acc, 0.1 * P.k);
  g.fill();
  g.strokeStyle = A(P.acc, 1);
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = A(P.ink, 0.8);
  for (const p of pts) g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  g.fillStyle = A(P.acc, 1);
  for (const p of H) g.fillRect(p.x - 3, p.y - 3, 6, 6);
};

const glyphChain: GlyphPainter = (g, w, h, P) => {
  g.fillStyle = P.ln2;
  g.fillRect(w * 0.44, 0, 18, h * 0.42);
  g.fillRect(w * 0.44, h * 0.68, 18, h * 0.32);
  const bx = 24;
  const by = h - 22;
  const Ls = [44, 38, 30];
  for (let k = 0; k <= 6; k++) {
    const f = k / 6;
    const th = [-0.25 - f * 0.55, 0.9 - f * 1.4 + Math.sin(f * 3) * 0.3, 0.7 - f * 0.4];
    let x = bx + f * (w - 120);
    let y = by;
    let a = 0;
    g.strokeStyle = A(k === 6 ? P.acc : P.mut, k === 6 ? 1 : 0.25 + f * 0.4);
    g.lineWidth = k === 6 ? 2.5 : 1.2;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 3; i++) {
      a += th[i];
      x += Math.cos(a) * Ls[i];
      y += Math.sin(a) * Ls[i] - 6;
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = A(P.ink, k === 6 ? 1 : 0.4);
    g.fillRect(bx + f * (w - 120) - 3, by - 3, 6, 6);
  }
};

const glyphEquity: GlyphPainter = (g, w, h, P, R) => {
  g.strokeStyle = A(P.mut, 0.5);
  g.beginPath();
  g.moveTo(14, h * 0.6);
  g.lineTo(w - 14, h * 0.6);
  g.stroke();
  let y = h * 0.6;
  let yb = h * 0.6;
  const a: [number, number][] = [];
  const b: [number, number][] = [];
  for (let x = 14; x <= w - 14; x += 6) {
    y += (R() - 0.43) * 9;
    yb += (R() - 0.47) * 4;
    a.push([x, Math.max(10, Math.min(h - 10, y))]);
    b.push([x, yb]);
  }
  g.setLineDash([3, 4]);
  g.strokeStyle = A(P.ink, 0.5);
  g.beginPath();
  b.forEach(([bx, by], i) => (i ? g.lineTo(bx, by) : g.moveTo(bx, by)));
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = A(P.acc, 1);
  g.lineWidth = 1.8;
  g.beginPath();
  a.forEach(([ax, ay], i) => (i ? g.lineTo(ax, ay) : g.moveTo(ax, ay)));
  g.stroke();
  g.fillStyle = A(P.acc, 1);
  a.forEach(([ax, ay], i) => {
    if (i % 7 === 3) g.fillRect(ax - 2, ay - 2, 4, 4);
  });
  g.fillStyle = A(P.mut, 0.9);
  g.font = "400 9px 'DM Mono', monospace";
  g.fillText('α vs SPY', 14, 16);
};

const glyphGraph: GlyphPainter = (g, w, h, P, R) => {
  const N: { x: number; y: number }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R() * 0.4;
    const r = 0.32 + R() * 0.12;
    N.push({ x: w / 2 + Math.cos(a) * w * r, y: h / 2 + Math.sin(a) * h * r * 1.1 });
  }
  const c = { x: w / 2, y: h / 2 };
  g.strokeStyle = A(P.mut, 0.6);
  g.lineWidth = 1;
  g.beginPath();
  N.forEach((p, i) => {
    g.moveTo(c.x, c.y);
    g.lineTo(p.x, p.y);
    if (i % 3 === 0) {
      const q = N[(i + 2) % 9];
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
    }
  });
  g.stroke();
  g.strokeStyle = A(P.acc, 1);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(c.x, c.y);
  g.lineTo(N[2].x, N[2].y);
  g.stroke();
  g.fillStyle = P.s1;
  g.strokeStyle = A(P.ink, 0.9);
  g.lineWidth = 1.2;
  N.forEach(p => {
    g.fillRect(p.x - 4, p.y - 4, 8, 8);
    g.strokeRect(p.x - 4, p.y - 4, 8, 8);
  });
  g.fillStyle = A(P.acc, 1);
  g.fillRect(c.x - 6, c.y - 6, 12, 12);
  g.fillRect(N[2].x - 4, N[2].y - 4, 8, 8);
};

const glyphBoard: GlyphPainter = (g, w, h, P) => {
  const s = Math.floor((h - 16) / 8);
  const ox = Math.round((w - s * 8) / 2);
  const oy = 8;
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if ((i + j) % 2) {
        g.fillStyle = A(P.mut, 0.22);
        g.fillRect(ox + i * s, oy + j * s, s, s);
      }
  g.strokeStyle = A(P.mut, 0.6);
  g.strokeRect(ox + 0.5, oy + 0.5, s * 8, s * 8);
  const k: [number, number] = [3, 4];
  const cen = (a: number, b: number): [number, number] => [ox + a * s + s / 2, oy + b * s + s / 2];
  const [kx, ky] = cen(k[0], k[1]);
  const mv: [number, number][] = [
    [1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1],
  ];
  g.strokeStyle = A(P.acc, 0.9);
  g.lineWidth = 1.2;
  g.beginPath();
  mv.forEach(([a, b]) => {
    const [x, y] = cen(k[0] + a, k[1] + b);
    g.moveTo(kx, ky);
    g.lineTo(x, y);
  });
  g.stroke();
  g.fillStyle = A(P.acc, 1);
  mv.forEach(([a, b]) => {
    const [x, y] = cen(k[0] + a, k[1] + b);
    g.fillRect(x - 2.5, y - 2.5, 5, 5);
  });
  g.fillStyle = A(P.ink, 1);
  g.font = `600 ${s}px 'Archivo', sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♞', kx, ky + 1);
  g.textAlign = 'start';
  g.textBaseline = 'alphabetic';
};

/** Keyed by `projects.specimen`; a project whose key is not here gets the dot grid alone. */
const GLYPHS: Record<string, GlyphPainter> = {
  chain: glyphChain,
  hull: glyphHull,
  equity: glyphEquity,
  graph: glyphGraph,
  board: glyphBoard,
};

/**
 * Paints one list glyph into a canvas. A `glyph` that is null or unknown leaves the dot
 * grid alone, which is what a project without a specimen should look like.
 */
export function paintGlyph(
  canvas: HTMLCanvasElement,
  glyph: string | null | undefined,
  seed: number,
  theme: 'light' | 'dark',
): void {
  const surface = prepareCanvas(canvas);
  if (!surface) return;
  const { g, w, h } = surface;
  const P = PAL[theme];
  dotGrid(g, w, h, P, 16, 0.25);
  const paint = glyph ? GLYPHS[glyph] : undefined;
  paint?.(g, w, h, P, rng(seed || 1));
}

/**
 * The five designed projects keep the prototype's hand-picked seeds, so their glyphs are
 * pixel-for-pixel the ones in the handoff.
 */
const DESIGNED_SEEDS: Record<string, number> = {
  mlmp: 23, cgeo: 11, nomic: 7, nudge: 31, chess: 5,
};

/**
 * Stable per-project seed: the designed value when there is one, otherwise an FNV-1a hash
 * of the slug so a project added later is still deterministic without a seed column.
 */
export function slugSeed(slug: string): number {
  if (slug in DESIGNED_SEEDS) return DESIGNED_SEEDS[slug];
  let hashed = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    hashed ^= slug.charCodeAt(i);
    hashed = Math.imul(hashed, 16777619);
  }
  return hashed >>> 0;
}
