/**
 * Delaunay (Bowyer–Watson) / Voronoi.
 * Ported from `Portfolio Home.dc.html`: `init_voronoi`, `delaunay`,
 * `step_voronoi`, plus the `S.kind === 'voronoi'` branches of `onFieldClick`
 * and `hud`.
 */

import { bool, num } from '../config';
import { A, cross } from '../draw';
import type { FieldAlgo, FieldPointer, FieldStepCtx, FieldTapCtx, FieldTool, Pal, Pt } from '../types';

interface Site extends Pt {
  vx: number;
  vy: number;
}

interface Circum {
  x: number;
  y: number;
  r2: number;
}

interface Tri {
  /** Indices into the point array the triangulation was built from. */
  v: [number, number, number];
  c: Circum;
}

export interface VoronoiState {
  kind: 'voronoi';
  pts: Site[];
  ntri: number;
  cellN: number;
  frame: number;
  /** Last triangulation, reused on alternate frames when `caps.cheapTriangulation`. */
  tri: Tri[] | null;
  triN: number;
}

function delaunay(V0: Pt[]): Tri[] {
  const n = V0.length;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of V0) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const d = Math.max(x1 - x0, y1 - y0) * 20,
    cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2;
  const V: Pt[] = V0.concat([
    { x: cx - d, y: cy - d },
    { x: cx + d, y: cy - d },
    { x: cx, y: cy + d },
  ]);
  const circ = (a: number, b: number, c: number): Circum => {
    const P1 = V[a],
      P2 = V[b],
      P3 = V[c],
      D = 2 * (P1.x * (P2.y - P3.y) + P2.x * (P3.y - P1.y) + P3.x * (P1.y - P2.y));
    if (Math.abs(D) < 1e-9) return { x: 0, y: 0, r2: Infinity };
    const a2 = P1.x * P1.x + P1.y * P1.y,
      b2 = P2.x * P2.x + P2.y * P2.y,
      c2 = P3.x * P3.x + P3.y * P3.y;
    const ux = (a2 * (P2.y - P3.y) + b2 * (P3.y - P1.y) + c2 * (P1.y - P2.y)) / D,
      uy = (a2 * (P3.x - P2.x) + b2 * (P1.x - P3.x) + c2 * (P2.x - P1.x)) / D;
    return { x: ux, y: uy, r2: (P1.x - ux) ** 2 + (P1.y - uy) ** 2 };
  };
  let T: Tri[] = [{ v: [n, n + 1, n + 2], c: circ(n, n + 1, n + 2) }];
  for (let i = 0; i < n; i++) {
    const p = V[i],
      bad: Tri[] = [],
      keep: Tri[] = [];
    for (const t of T) ((p.x - t.c.x) ** 2 + (p.y - t.c.y) ** 2 < t.c.r2 ? bad : keep).push(t);
    const em = new Map<number, [number, number] | null>();
    for (const t of bad)
      for (let k = 0; k < 3; k++) {
        const a = t.v[k],
          b = t.v[(k + 1) % 3],
          key = a < b ? a * 8192 + b : b * 8192 + a;
        em.set(key, em.has(key) ? null : [a, b]);
      }
    T = keep;
    for (const e of em.values()) if (e) T.push({ v: [e[0], e[1], i], c: circ(e[0], e[1], i) });
  }
  return T.filter((t) => t.v.every((x) => x < n));
}

export const voronoi: FieldAlgo<VoronoiState> = {
  kind: 'voronoi',

  init(w, h, cfg, caps) {
    const n = Math.min(
      Math.round(Math.max(18, (w * h) / 20000) * num(cfg, 'density', 1)),
      caps.maxSites,
    );
    const pts: Site[] = [];
    for (let i = 0; i < n; i++)
      pts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    return { kind: 'voronoi', pts, ntri: 0, cellN: 0, frame: 0, tri: null, triN: 0 };
  },

  step(g: CanvasRenderingContext2D, w: number, h: number, P: Pal, S: VoronoiState, ctx: FieldStepCtx) {
    const m = ctx.pointer,
      C = ctx.cfg,
      sp = num(C, 'drift', 16) / 60;
    for (const p of S.pts) {
      p.x += p.vx * sp;
      p.y += p.vy * sp;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      p.x = Math.max(0, Math.min(w, p.x));
      p.y = Math.max(0, Math.min(h, p.y));
    }
    const pts: Pt[] = (S.pts as Pt[]).concat([{ x: m.x, y: m.y }]),
      ci = pts.length - 1;
    const stale = ctx.caps.cheapTriangulation && S.tri !== null && S.triN === pts.length && S.frame % 2 === 1;
    const T = stale && S.tri ? S.tri : delaunay(pts);
    S.tri = T;
    S.triN = pts.length;
    S.frame++;
    S.ntri = T.length;

    g.lineWidth = 1;
    if (bool(C, 'tri')) {
      g.strokeStyle = A(P.mut, 0.2 * P.k);
      g.beginPath();
      for (const t of T) {
        const [a, b, c] = t.v;
        g.moveTo(pts[a].x, pts[a].y);
        g.lineTo(pts[b].x, pts[b].y);
        g.lineTo(pts[c].x, pts[c].y);
        g.closePath();
      }
      g.stroke();
    }
    const em = new Map<number, number[]>();
    T.forEach((t, i) => {
      for (let k = 0; k < 3; k++) {
        const a = t.v[k],
          b = t.v[(k + 1) % 3],
          key = a < b ? a * 8192 + b : b * 8192 + a,
          e = em.get(key);
        if (e) e.push(i);
        else em.set(key, [i]);
      }
    });
    g.strokeStyle = A(P.acc, 0.5 * P.k);
    g.beginPath();
    for (const e of em.values())
      if (e.length === 2) {
        const p = T[e[0]].c,
          q = T[e[1]].c;
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
    g.stroke();

    const mine = T.filter((t) => t.v.includes(ci));
    const cc = mine
      .map((t) => t.c)
      .sort((p, q) => Math.atan2(p.y - m.y, p.x - m.x) - Math.atan2(q.y - m.y, q.x - m.x));
    S.cellN = cc.length;
    if (cc.length > 2) {
      g.beginPath();
      cc.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.closePath();
      g.fillStyle = A(P.acc, 0.1 * P.k);
      g.fill();
      g.strokeStyle = A(P.acc, 1);
      g.lineWidth = 2;
      g.stroke();
      g.lineWidth = 1;
      const nb = new Set<number>();
      mine.forEach((t) => t.v.forEach((v) => v !== ci && nb.add(v)));
      g.strokeStyle = A(P.ink, 0.5);
      g.setLineDash([3, 4]);
      g.beginPath();
      nb.forEach((v) => {
        g.moveTo(m.x, m.y);
        g.lineTo(pts[v].x, pts[v].y);
      });
      g.stroke();
      g.setLineDash([]);
      const t = bool(C, 'circ') && mine.length ? mine[Math.floor(ctx.t * 0.8) % mine.length] : null;
      if (t && isFinite(t.c.r2)) {
        g.strokeStyle = A(P.ink, 0.35);
        g.beginPath();
        g.arc(t.c.x, t.c.y, Math.sqrt(t.c.r2), 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = A(P.ink, 0.6);
        g.fillRect(t.c.x - 2, t.c.y - 2, 4, 4);
      }
    }
    g.fillStyle = A(P.ink, 0.85);
    for (const p of S.pts) g.fillRect(p.x - 1.75, p.y - 1.75, 3.5, 3.5);
    cross(g, m.x, m.y, A(P.acc, 1), 'SITE · YOU');
  },

  hud(S: VoronoiState, pointer: FieldPointer) {
    const xy = `${Math.round(pointer.x)}, ${Math.round(pointer.y)}`;
    return `SITES  ${S.pts.length + 1}\nTRIS   ${S.ntri || 0}\nCELL   ${S.cellN || 0}-gon\nYOU    ${xy}`;
  },

  onTap(S: VoronoiState, x: number, y: number, tool: FieldTool, ctx: FieldTapCtx) {
    if (tool === 'add') {
      if (S.pts.length < Math.min(220, ctx.caps.maxSites))
        S.pts.push({ x, y, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 });
    } else {
      let bi = -1,
        bd = 60;
      S.pts.forEach((p, i) => {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      if (bi >= 0) S.pts.splice(bi, 1);
    }
    S.tri = null;
  },
};
