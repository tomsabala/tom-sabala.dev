/**
 * RRT* planner.
 * Ported from `Portfolio Home.dc.html`: `init_planner`, `free`, `segFree`,
 * `step_planner`, plus the `S.kind === 'planner'` branches of `onFieldClick`
 * and `hud`.
 */

import { bool, num } from '../config';
import { A, cross, MONO } from '../draw';
import type { FieldAlgo, FieldStepCtx, FieldTapCtx, FieldTool, Pal, FieldPointer, Pt } from '../types';

export interface PlannerNode {
  x: number;
  y: number;
  /** Parent index, `-1` for the root. */
  p: number;
  /** Cost-to-come. */
  c: number;
}

export interface PlannerObstacle {
  x: number;
  y: number;
  r: number;
}

export interface KeepOut {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlannerState {
  kind: 'planner';
  start: Pt;
  obs: PlannerObstacle[];
  ko: KeepOut | null;
  nodes: PlannerNode[];
  path: Pt[];
  cost: number;
  frame: number;
}

export function free(S: PlannerState, x: number, y: number): boolean {
  for (const o of S.obs) if ((x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + 3) ** 2) return false;
  const k = S.ko;
  if (k && x > k.x && x < k.x + k.w && y > k.y && y < k.y + k.h) return false;
  return true;
}

export function segFree(S: PlannerState, a: Pt, b: Pt): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y),
    n = Math.max(2, Math.ceil(d / 5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (!free(S, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
  }
  return true;
}

export const planner: FieldAlgo<PlannerState> = {
  kind: 'planner',

  init(w, h, cfg) {
    // The prototype computed `const ko = null` here (its `keepOut()` rect was
    // never wired into `init_planner`), so the keep-out rejection below it was
    // unreachable and is dropped. `S.ko` and `free()` still honour one if a
    // future caller sets it.
    const ko: KeepOut | null = null,
      start = { x: w * 0.84, y: h * 0.34 },
      obs: PlannerObstacle[] = [];
    const n = Math.round(Math.max(6, (w * h) / 42000) * num(cfg, 'density', 1));
    let tries = 0;
    while (obs.length < n && tries++ < 800) {
      const r = 12 + Math.random() * 46,
        x = Math.random() * w,
        y = Math.random() * h;
      if (Math.hypot(x - start.x, y - start.y) < r + 50) continue;
      if (obs.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 16)) continue;
      obs.push({ x, y, r });
    }
    return {
      kind: 'planner',
      start,
      obs,
      ko,
      nodes: [{ x: start.x, y: start.y, p: -1, c: 0 }],
      path: [],
      cost: 0,
      frame: 0,
    };
  },

  step(g: CanvasRenderingContext2D, w: number, h: number, P: Pal, S: PlannerState, ctx: FieldStepCtx) {
    const N = S.nodes,
      C = ctx.cfg,
      STEP = num(C, 'step', 24),
      MAX = Math.min(Math.round((w * h) / 420), ctx.caps.maxNodes),
      rate = Math.min(num(C, 'rate', 30), ctx.caps.samplesPerFrame);
    for (let k = 0; k < rate && N.length < MAX; k++) {
      const sx = Math.random() * w,
        sy = Math.random() * h;
      let bi = 0,
        bd = 1e18;
      for (let i = 0; i < N.length; i++) {
        const d = (N[i].x - sx) ** 2 + (N[i].y - sy) ** 2;
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const nb = N[bi],
        d = Math.sqrt(bd);
      if (d < 1) continue;
      const s = Math.min(STEP, d),
        q = { x: nb.x + ((sx - nb.x) / d) * s, y: nb.y + ((sy - nb.y) / d) * s };
      if (!segFree(S, nb, q)) continue;
      let p = bi,
        pc = nb.c + s;
      for (let i = 0; i < N.length; i++) {
        const o = N[i],
          dd = Math.hypot(o.x - q.x, o.y - q.y);
        if (dd < STEP * 1.7 && o.c + dd < pc && segFree(S, o, q)) {
          p = i;
          pc = o.c + dd;
        }
      }
      N.push({ x: q.x, y: q.y, p, c: pc });
    }

    const m = ctx.pointer;
    if (S.frame++ % 3 === 0) {
      let best = -1,
        bc = 1e18;
      if (free(S, m.x, m.y))
        for (let i = 0; i < N.length; i++) {
          const o = N[i],
            dd = Math.hypot(o.x - m.x, o.y - m.y);
          if (dd < 70 && o.c + dd < bc && segFree(S, o, m)) {
            best = i;
            bc = o.c + dd;
          }
        }
      S.path = [];
      if (best >= 0) {
        S.path.push({ x: m.x, y: m.y });
        let i = best;
        while (i >= 0) {
          S.path.push(N[i]);
          i = N[i].p;
        }
        S.path.reverse();
        S.cost = bc;
      } else S.cost = 0;
    }

    g.lineWidth = 1;
    for (const o of S.obs) {
      g.beginPath();
      g.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      g.fillStyle = P.s1;
      g.fill();
      g.strokeStyle = P.ln2;
      g.stroke();
      g.save();
      g.clip();
      g.strokeStyle = A(P.mut, 0.16 * P.k);
      g.beginPath();
      for (let k = -o.r * 2; k < o.r * 2; k += 6) {
        g.moveTo(o.x + k - o.r, o.y - o.r);
        g.lineTo(o.x + k + o.r, o.y + o.r);
      }
      g.stroke();
      g.restore();
    }
    if (S.ko) {
      g.setLineDash([4, 5]);
      g.strokeStyle = A(P.acc, 0.3);
      g.strokeRect(S.ko.x + 0.5, S.ko.y + 0.5, S.ko.w, S.ko.h);
      g.setLineDash([]);
    }
    if (bool(C, 'tree')) {
      g.strokeStyle = A(P.acc, 0.16 * P.k);
      g.beginPath();
      for (let i = 1; i < N.length; i++) {
        const q = N[i],
          p = N[q.p];
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      g.stroke();
    }
    g.strokeStyle = A(P.acc, 0.75);
    g.beginPath();
    for (let i = Math.max(1, N.length - 45); i < N.length; i++) {
      const q = N[i],
        p = N[q.p];
      g.moveTo(p.x, p.y);
      g.lineTo(q.x, q.y);
    }
    g.stroke();

    const Pth = S.path,
      ok = Pth.length > 1;
    if (ok) {
      g.strokeStyle = A(P.acc, 1);
      g.lineWidth = 2.5;
      g.lineJoin = 'round';
      g.beginPath();
      Pth.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      g.lineWidth = 1;
      if (bool(C, 'rover')) {
        let tot = 0;
        const seg: number[] = [];
        for (let i = 1; i < Pth.length; i++) {
          const d = Math.hypot(Pth[i].x - Pth[i - 1].x, Pth[i].y - Pth[i - 1].y);
          seg.push(d);
          tot += d;
        }
        let s = (ctx.t * 160) % tot,
          i = 0;
        while (i < seg.length - 1 && s > seg[i]) {
          s -= seg[i];
          i++;
        }
        const a = Pth[i],
          b = Pth[i + 1],
          f = seg[i] ? s / seg[i] : 0,
          rx = a.x + (b.x - a.x) * f,
          ry = a.y + (b.y - a.y) * f;
        g.save();
        g.translate(rx, ry);
        g.rotate(Math.atan2(b.y - a.y, b.x - a.x));
        g.fillStyle = P.bg;
        g.strokeStyle = A(P.acc, 1);
        g.lineWidth = 1.5;
        g.beginPath();
        g.rect(-8, -6, 16, 12);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(8, 0);
        g.lineTo(13, 0);
        g.stroke();
        g.fillStyle = A(P.acc, 1);
        g.fillRect(-2, -2, 4, 4);
        g.restore();
      }
    }
    g.strokeStyle = A(P.ink, 1);
    g.lineWidth = 1.2;
    g.strokeRect(S.start.x - 6, S.start.y - 6, 12, 12);
    g.fillStyle = A(P.ink, 1);
    g.font = MONO;
    g.fillText('START', S.start.x + 12, S.start.y + 4);
    cross(g, m.x, m.y, ok ? A(P.acc, 1) : A(P.mut, 0.9), ok ? 'GOAL' : 'NO PATH YET');
  },

  hud(S: PlannerState, pointer: FieldPointer) {
    const xy = `${Math.round(pointer.x)}, ${Math.round(pointer.y)}`;
    return `NODES  ${S.nodes.length}\nOBST   ${S.obs.length}\nCOST   ${
      S.cost ? S.cost.toFixed(1) + ' px' : 'searching…'
    }\nGOAL   ${xy}`;
  },

  onTap(S: PlannerState, x: number, y: number, tool: FieldTool, _ctx: FieldTapCtx) {
    const add = tool === 'add';
    if (add) {
      if (Math.hypot(x - S.start.x, y - S.start.y) < 60 || !free(S, x, y)) return;
      S.obs.push({ x, y, r: 18 + Math.random() * 22 });
    } else {
      const i = S.obs.findIndex((o) => Math.hypot(o.x - x, o.y - y) < o.r + 10);
      if (i < 0) return;
      S.obs.splice(i, 1);
    }
    S.nodes = [S.nodes[0]];
    S.path = [];
  },
};
