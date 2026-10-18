/**
 * 2D LiDAR rover.
 * Ported from `Portfolio Home.dc.html`: `init_lidar`, `addBox`, `inPoly`,
 * `blocked`, `cast`, `step_lidar`, `rebuildSegs`, plus the
 * `S.kind === 'lidar'` branches of `onFieldClick` and `hud`.
 *
 * `blocked()` read `this.W`/`this.H` in the prototype; the canvas size is now
 * stored on the state at init and refreshed every step.
 */

import { bool, num } from '../config';
import { A, MONO } from '../draw';
import type { FieldAlgo, FieldPointer, FieldStepCtx, FieldTapCtx, FieldTool, Pal, Pt } from '../types';

export type Seg = [Pt, Pt];
/** A box is exactly four corners, in order. */
export type Box = Pt[];

export interface LidarHit extends Pt {
  /** Timestamp (seconds) the return was recorded at. */
  t: number;
}

export interface LidarState {
  kind: 'lidar';
  segs: Seg[];
  boxes: Box[];
  hits: LidarHit[];
  trail: Pt[];
  r: { x: number; y: number; a: number };
  beam: number;
  range: number;
  walls: Seg[];
  w: number;
  h: number;
  tc: number;
}

export function addBox(S: LidarState, x: number, y: number, bw: number, bh: number, rot: number): void {
  const c = Math.cos(rot),
    s = Math.sin(rot),
    pts: Box = (
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as Array<[number, number]>
    ).map(([u, v]) => ({
      x: x + ((u * bw) / 2) * c - ((v * bh) / 2) * s,
      y: y + ((u * bw) / 2) * s + ((v * bh) / 2) * c,
    }));
  S.boxes.push(pts);
  for (let i = 0; i < 4; i++) S.segs.push([pts[i], pts[(i + 1) % 4]]);
}

export function inPoly(pts: Box, x: number, y: number, pad: number): boolean {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  const sg = Math.sign(s);
  for (let i = 0; i < 4; i++) {
    const p = pts[i],
      q = pts[(i + 1) % 4],
      ex = q.x - p.x,
      ey = q.y - p.y,
      L = Math.hypot(ex, ey);
    if (((ex * (y - p.y) - ey * (x - p.x)) / L) * sg < -pad) return false;
  }
  return true;
}

export function blocked(S: LidarState, x: number, y: number): boolean {
  return (
    x < 12 ||
    y < 12 ||
    x > S.w - 12 ||
    y > S.h - 12 ||
    S.boxes.some((b) => inPoly(b, x, y, 12))
  );
}

export function cast(S: LidarState, ox: number, oy: number, a: number): number {
  const dx = Math.cos(a),
    dy = Math.sin(a);
  let best = S.range;
  for (const [p, q] of S.segs) {
    const ex = q.x - p.x,
      ey = q.y - p.y,
      den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const fx = p.x - ox,
      fy = p.y - oy,
      t = (fx * ey - fy * ex) / den,
      u = (fx * dy - fy * dx) / den;
    if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

export function rebuildSegs(S: LidarState): void {
  S.segs = S.walls.slice();
  for (const pts of S.boxes) for (let i = 0; i < 4; i++) S.segs.push([pts[i], pts[(i + 1) % 4]]);
}

export const lidar: FieldAlgo<LidarState> = {
  kind: 'lidar',

  init(w, h, cfg) {
    const S: LidarState = {
      kind: 'lidar',
      segs: [],
      boxes: [],
      hits: [],
      trail: [],
      r: { x: w * 0.72, y: h * 0.4, a: Math.PI },
      beam: 0,
      range: num(cfg, 'range', 300),
      walls: [],
      w,
      h,
      tc: 0,
    };
    const c: Pt[] = [
      { x: 1, y: 1 },
      { x: w - 1, y: 1 },
      { x: w - 1, y: h - 1 },
      { x: 1, y: h - 1 },
    ];
    for (let i = 0; i < 4; i++) S.walls.push([c[i], c[(i + 1) % 4]]);
    S.segs = S.walls.slice();
    const n = Math.max(8, Math.round((w * h) / 50000));
    let tries = 0;
    while (S.boxes.length < n && tries++ < 300) {
      const x = Math.random() * w,
        y = Math.random() * h;
      if (Math.hypot(x - S.r.x, y - S.r.y) < 110) continue;
      addBox(S, x, y, 30 + Math.random() * 110, 24 + Math.random() * 60, Math.random() * Math.PI);
    }
    return S;
  },

  step(g: CanvasRenderingContext2D, w: number, h: number, P: Pal, S: LidarState, ctx: FieldStepCtx) {
    const R = S.r,
      m = ctx.pointer,
      now = ctx.t,
      C = ctx.cfg;
    S.w = w;
    S.h = h;
    S.range = num(C, 'range', 300);
    const persist = num(C, 'persist', 7);
    const dx = m.x - R.x,
      dy = m.y - R.y,
      d = Math.hypot(dx, dy);
    if (d > 8) {
      const ta = Math.atan2(dy, dx);
      let da = ta - R.a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      R.a += da * 0.12;
      const st = Math.min(2.4, d * 0.05),
        nx = R.x + Math.cos(R.a) * st,
        ny = R.y + Math.sin(R.a) * st;
      if (!blocked(S, nx, ny)) {
        R.x = nx;
        R.y = ny;
      } else if (!blocked(S, nx, R.y)) R.x = nx;
      else if (!blocked(S, R.x, ny)) R.y = ny;
    }
    if ((S.tc = (S.tc || 0) + 1) % 4 === 0) {
      S.trail.push({ x: R.x, y: R.y });
      if (S.trail.length > 120) S.trail.shift();
    }
    const db = (num(C, 'speed', 0.8) * Math.PI * 2) / 60,
      nr = Math.max(6, Math.min(48, Math.round(db / 0.0054))),
      b0 = S.beam,
      b1 = b0 + db,
      rays: Pt[] = [];
    for (let k = 0; k < nr; k++) {
      const a = b0 + ((b1 - b0) * k) / nr,
        t = cast(S, R.x, R.y, a);
      if (t < S.range) {
        const p: LidarHit = { x: R.x + Math.cos(a) * t, y: R.y + Math.sin(a) * t, t: now };
        S.hits.push(p);
        rays.push(p);
      }
    }
    S.beam = b1 % (Math.PI * 2);
    S.hits = S.hits.filter((p) => now - p.t < persist);
    const cap = ctx.caps.maxPoints;
    if (S.hits.length > cap) S.hits.splice(0, S.hits.length - cap);

    g.strokeStyle = A(P.mut, 0.4);
    g.setLineDash([2, 6]);
    g.beginPath();
    g.arc(R.x, R.y, S.range, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(R.x, R.y);
    g.arc(R.x, R.y, S.range, b1 - 0.6, b1);
    g.closePath();
    g.fillStyle = A(P.acc, 0.07 * P.k);
    g.fill();
    if (bool(C, 'trail')) {
      g.strokeStyle = A(P.mut, 0.3);
      g.beginPath();
      S.trail.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
    }
    for (let b = 0; b < 5; b++) {
      g.fillStyle = A(P.acc, (1 - b / 5) * 0.95);
      const bw = persist / 5,
        lo = b * bw,
        hi = lo + bw;
      for (const p of S.hits) {
        const age = now - p.t;
        if (age >= lo && age < hi) g.fillRect(p.x - 1.25, p.y - 1.25, 2.5, 2.5);
      }
    }
    if (bool(C, 'rays')) {
      g.strokeStyle = A(P.acc, 0.35);
      g.beginPath();
      for (const p of rays) {
        g.moveTo(R.x, R.y);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
    }
    g.save();
    g.translate(R.x, R.y);
    g.rotate(R.a);
    g.fillStyle = P.bg;
    g.strokeStyle = A(P.ink, 1);
    g.lineWidth = 1.5;
    g.beginPath();
    g.rect(-14, -11, 28, 22);
    g.fill();
    g.stroke();
    g.fillStyle = A(P.ink, 1);
    g.fillRect(-12, -14, 9, 3);
    g.fillRect(3, -14, 9, 3);
    g.fillRect(-12, 11, 9, 3);
    g.fillRect(3, 11, 9, 3);
    g.beginPath();
    g.arc(0, 0, 5, 0, Math.PI * 2);
    g.fillStyle = A(P.acc, 1);
    g.fill();
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(20, 0);
    g.stroke();
    g.restore();
    g.strokeStyle = A(P.acc, 1);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(m.x, m.y - 8);
    g.lineTo(m.x + 8, m.y);
    g.lineTo(m.x, m.y + 8);
    g.lineTo(m.x - 8, m.y);
    g.closePath();
    g.stroke();
    g.fillStyle = A(P.acc, 1);
    g.font = MONO;
    g.fillText('WAYPOINT', m.x + 14, m.y - 10);
  },

  hud(S: LidarState, _pointer: FieldPointer) {
    return `RANGE  ${S.range} px\nPOINTS ${S.hits.length}\nPOSE   ${Math.round(S.r.x)}, ${Math.round(
      S.r.y,
    )}\nHEAD   ${Math.round((((S.r.a * 180) / Math.PI) % 360 + 360) % 360)}°`;
  },

  onTap(S: LidarState, x: number, y: number, tool: FieldTool, _ctx: FieldTapCtx) {
    if (tool === 'add') {
      if (Math.hypot(x - S.r.x, y - S.r.y) > 50)
        addBox(S, x, y, 40 + Math.random() * 50, 30 + Math.random() * 30, Math.random() * Math.PI);
    } else {
      const i = S.boxes.findIndex((b) => inPoly(b, x, y, 8));
      if (i >= 0) {
        S.boxes.splice(i, 1);
        rebuildSegs(S);
      }
    }
  },
};
