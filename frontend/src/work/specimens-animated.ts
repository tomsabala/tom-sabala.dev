/**
 * Animated specimens for the project detail hero, ported verbatim from the `sp_*` painters
 * in the design prototype (`Project Detail.dc.html`).
 *
 * The prototype hung its per-specimen caches (`hullPlan`, `eq`, `gr`) off the component
 * instance; here each painter is produced by a factory and closes over its own cache, so
 * two specimens on screen at once cannot share — or invalidate — each other's plan.
 */
import type { Pal } from '../field/draw.ts';
import { A, MONO } from '../field/draw.ts';
import { rng } from './specimens.ts';

export type SpecimenPainter = (
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  P: Pal,
  t: number,
) => void;

type Pt = { x: number; y: number };

function createMlmp(): SpecimenPainter {
  return (g, w, h, P, t) => {
    const gx = w * 0.55;
    const gapY = h * 0.42;
    const gap = h * 0.2;
    g.fillStyle = P.s1;
    g.strokeStyle = P.ln2;
    g.lineWidth = 1;
    const walls: [number, number, number, number][] = [
      [gx - 14, 0, 28, gapY - gap / 2],
      [gx - 14, gapY + gap / 2, 28, h],
    ];
    walls.forEach(r => {
      g.fillRect(r[0], r[1], r[2], r[3]);
      g.strokeRect(r[0], r[1], r[2], r[3]);
      g.save();
      g.beginPath();
      g.rect(r[0], r[1], r[2], r[3]);
      g.clip();
      g.strokeStyle = A(P.mut, 0.35);
      g.beginPath();
      for (let k = -h; k < w; k += 8) {
        g.moveTo(k, 0);
        g.lineTo(k + h, h);
      }
      g.stroke();
      g.restore();
    });

    const T = 7;
    const f = (t % T) / T;
    const Ls = [w * 0.1, w * 0.09, w * 0.075, w * 0.06];
    const pose = (pf: number): [number, number][] => {
      const bx = w * 0.12 + pf * w * 0.62;
      const by = h * 0.86;
      const e = Math.sin(pf * Math.PI);
      const th = [-1.2 + 0.5 * pf, 0.5 - 1.1 * e, 0.7 * e - 0.2, 0.6 - 0.9 * pf];
      const pts: [number, number][] = [[bx, by]];
      let x = bx;
      let y = by;
      let a = 0;
      th.forEach((d, i) => {
        a += d;
        x += Math.cos(a) * Ls[i];
        y += Math.sin(a) * Ls[i];
        pts.push([x, y]);
      });
      return pts;
    };

    for (let k = 0; k < 8; k++) {
      const pf = (f - k * 0.05 + 1) % 1;
      if (pf > f) continue;
      const ghost = pose(pf);
      g.strokeStyle = A(P.mut, 0.5 - k * 0.05);
      g.lineWidth = 1;
      g.beginPath();
      ghost.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
    }

    const pts = pose(f);
    g.lineCap = 'round';
    g.strokeStyle = A(P.acc, 1);
    g.lineWidth = 6;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.lineCap = 'butt';
    pts.forEach(([x, y], i) => {
      g.fillStyle = P.bg;
      g.strokeStyle = A(P.ink, 1);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, i ? 5 : 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    });
    g.strokeStyle = A(P.ink, 0.6);
    g.beginPath();
    g.moveTo(w * 0.08, h * 0.86 + 8);
    g.lineTo(w * 0.8, h * 0.86 + 8);
    g.stroke();
    g.fillStyle = A(P.ink, 0.8);
    g.font = MONO;
    g.fillText(`LEVEL ${1 + Math.floor(f * 3)} / 3  ·  BiQRRT`, 12, h - 12);
  };
}

interface HullStep { cur: number; cand: number; best: number; done: number[] }
interface HullPlan { w: number; pts: Pt[]; steps: HullStep[]; hull: number[] }

function createCgeo(): SpecimenPainter {
  let plan: HullPlan | null = null;
  return (g, w, h, P, t) => {
    if (!plan || plan.w !== w) {
      const R = rng(11);
      const pts: Pt[] = [];
      for (let i = 0; i < 30; i++) pts.push({ x: w * 0.1 + R() * w * 0.8, y: h * 0.16 + R() * h * 0.7 });
      let start = 0;
      pts.forEach((p, i) => {
        if (p.x < pts[start].x) start = i;
      });
      const steps: HullStep[] = [];
      const hull = [start];
      let cur = start;
      for (let guard = 0; guard < 40; guard++) {
        let best = (cur + 1) % pts.length;
        for (let j = 0; j < pts.length; j++) {
          const a = pts[cur];
          const b = pts[best];
          const c = pts[j];
          const cr = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
          if (cr < 0) best = j;
          steps.push({ cur, cand: j, best, done: hull.slice() });
        }
        cur = best;
        if (cur === start) break;
        hull.push(cur);
      }
      plan = { w, pts, steps, hull };
    }

    const { pts, steps, hull } = plan;
    const total = steps.length + 60;
    const k = Math.floor(t * 90) % total;
    const st = steps[Math.min(k, steps.length - 1)];
    const fin = k >= steps.length;
    const H = fin ? hull : st.done;

    if (fin) {
      g.beginPath();
      hull.forEach((i, n) => (n ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y)));
      g.closePath();
      g.fillStyle = A(P.acc, 0.12 * P.k);
      g.fill();
    }
    g.strokeStyle = A(P.acc, 1);
    g.lineWidth = 2;
    g.beginPath();
    H.forEach((i, n) => (n ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y)));
    if (fin) g.closePath();
    g.stroke();

    if (!fin) {
      const a = pts[st.cur];
      g.setLineDash([3, 4]);
      g.strokeStyle = A(P.mut, 0.9);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(pts[st.cand].x, pts[st.cand].y);
      g.stroke();
      g.setLineDash([]);
      g.strokeStyle = A(P.ink, 1);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(pts[st.best].x, pts[st.best].y);
      g.stroke();
    }

    g.fillStyle = A(P.ink, 0.85);
    pts.forEach(p => g.fillRect(p.x - 2, p.y - 2, 4, 4));
    g.fillStyle = A(P.acc, 1);
    H.forEach(i => g.fillRect(pts[i].x - 4, pts[i].y - 4, 8, 8));
    g.fillStyle = A(P.ink, 0.8);
    g.font = MONO;
    g.fillText(fin ? `HULL · ${hull.length} VERTICES · O(nh)` : `JARVIS MARCH · STEP ${k}`, 12, h - 12);
  };
}

interface EqPlan { w: number; a: number[]; b: number[]; o: { i: number; ok: boolean }[] }

function createNomic(): SpecimenPainter {
  let eq: EqPlan | null = null;
  return (g, w, h, P, t) => {
    if (!eq || eq.w !== w) {
      const R = rng(7);
      const a: number[] = [];
      const b: number[] = [];
      const o: { i: number; ok: boolean }[] = [];
      let y = 0;
      let yb = 0;
      for (let i = 0; i <= 120; i++) {
        y += (R() - 0.44) * 2.2;
        yb += (R() - 0.47) * 1.1;
        a.push(y);
        b.push(yb);
        if (i % 9 === 4) o.push({ i, ok: R() > 0.3 });
      }
      eq = { w, a, b, o };
    }

    const { a, b, o } = eq;
    const n = a.length;
    const f = Math.min(1, (t % 9) / 7);
    const m = Math.max(2, Math.floor(f * n));
    const x0 = 16;
    const x1 = w - 16;
    const X = (i: number) => x0 + ((x1 - x0) * i) / (n - 1);
    const lo = Math.min(...a, ...b) - 2;
    const hi = Math.max(...a, ...b) + 2;
    const Y = (v: number) => h * 0.82 - ((v - lo) / (hi - lo)) * h * 0.62;

    g.strokeStyle = A(P.mut, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0, Y(0));
    g.lineTo(x1, Y(0));
    g.stroke();
    g.setLineDash([6, 4]);
    g.strokeStyle = A(P.ink, 0.6);
    g.beginPath();
    g.moveTo(x0, h * 0.14);
    g.lineTo(x1, h * 0.14);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = A(P.ink, 0.7);
    g.font = MONO;
    g.fillText('POSITION CAP', x0, h * 0.14 - 6);

    g.setLineDash([3, 4]);
    g.strokeStyle = A(P.mut, 0.9);
    g.beginPath();
    for (let i = 0; i < m; i++) (i ? g.lineTo(X(i), Y(b[i])) : g.moveTo(X(i), Y(b[i])));
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = A(P.acc, 1);
    g.lineWidth = 2.2;
    g.beginPath();
    for (let i = 0; i < m; i++) (i ? g.lineTo(X(i), Y(a[i])) : g.moveTo(X(i), Y(a[i])));
    g.stroke();

    o.forEach(({ i, ok }) => {
      if (i >= m) return;
      const x = X(i);
      const y = Y(a[i]);
      if (ok) {
        g.fillStyle = A(P.acc, 1);
        g.fillRect(x - 3.5, y - 3.5, 7, 7);
        g.strokeStyle = A(P.ink, 1);
        g.lineWidth = 1;
        g.strokeRect(x - 3.5, y - 3.5, 7, 7);
      } else {
        g.strokeStyle = A(P.ink, 0.9);
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x - 4, y - 4);
        g.lineTo(x + 4, y + 4);
        g.moveTo(x + 4, y - 4);
        g.lineTo(x - 4, y + 4);
        g.stroke();
      }
    });

    const fills = o.filter(q => q.i < m && q.ok).length;
    const rej = o.filter(q => q.i < m && !q.ok).length;
    g.fillStyle = A(P.ink, 0.8);
    g.fillText(`TICK ${m} · ■ FILLED ${fills} · × REFUSED BY RISK ${rej} · - - SPY`, 12, h - 12);
  };
}

interface GraphPlan { w: number; N: { x: number; y: number; l: string }[]; rej: number[] }

function createNudge(): SpecimenPainter {
  let gr: GraphPlan | null = null;
  return (g, w, h, P, t) => {
    if (!gr || gr.w !== w) {
      const R = rng(31);
      const N = [{ x: w / 2, y: h * 0.48, l: 'user' }];
      const L = ['tennis', 'Israel', 'nomic', 'Rust', 'OMPL', 'CGEO', 'coffee', 'MLMP', 'Postgres'];
      L.forEach((l, i) => {
        const a = (i / L.length) * Math.PI * 2 - 0.4;
        const r = 0.3 + R() * 0.1;
        N.push({ x: w / 2 + Math.cos(a) * w * r, y: h * 0.48 + Math.sin(a) * h * r * 1.05, l });
      });
      gr = { w, N, rej: [3, 7] };
    }

    const { N, rej } = gr;
    const cyc = 1.4;
    const k = Math.floor(t / cyc) % (N.length + 3);
    const ph = (t % cyc) / cyc;

    for (let i = 1; i < N.length; i++) {
      const p = N[i];
      const done = i < k;
      const active = i === k;
      if (!done && !active) continue;
      const isRej = rej.includes(i);
      if (done && isRej) continue;
      g.strokeStyle = done ? A(P.acc, 1) : A(P.ink, 0.6);
      g.lineWidth = done ? 2 : 1.2;
      if (!done) g.setLineDash([4, 4]);
      const f = active ? Math.min(1, ph * 1.6) : 1;
      g.beginPath();
      g.moveTo(N[0].x, N[0].y);
      g.lineTo(N[0].x + (p.x - N[0].x) * f, N[0].y + (p.y - N[0].y) * f);
      g.stroke();
      g.setLineDash([]);
      if (active && ph > 0.6) {
        g.fillStyle = isRej ? A(P.mut, 1) : A(P.acc, 1);
        g.font = MONO;
        g.fillText(isRej ? 'REJECTED' : 'CONFIRMED', (N[0].x + p.x) / 2 + 6, (N[0].y + p.y) / 2 - 6);
      }
    }

    N.forEach((p, i) => {
      const on = i === 0 || (i < k && !rej.includes(i));
      g.fillStyle = i === 0 ? A(P.acc, 1) : on ? P.bg : P.s1;
      g.strokeStyle = A(P.ink, on ? 1 : 0.4);
      g.lineWidth = 1.2;
      const s = i === 0 ? 14 : 9;
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      g.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      g.fillStyle = A(P.ink, on ? 0.9 : 0.45);
      g.font = MONO;
      g.fillText(p.l, p.x + 9, p.y + 3);
    });

    g.fillStyle = A(P.ink, 0.8);
    g.font = MONO;
    g.fillText('PROPOSAL → HUMAN CONFIRM → FACT', 12, h - 12);
  };
}

function createChess(): SpecimenPainter {
  return (g, w, h, P, t) => {
    const D = 3;
    const B = 3;
    const nodes: { d: number; i: number; x: number; y: number }[] = [];
    for (let d = 0; d <= D; d++) {
      const n = B ** d;
      for (let i = 0; i < n; i++) nodes.push({ d, i, x: (w * (i + 0.5)) / n, y: h * 0.14 + d * h * 0.22 });
    }
    const idx = (d: number, i: number) => (B ** d - 1) / (B - 1) + i;
    const shown = Math.floor(t * 8) % (nodes.length + 16);
    const pruned = new Set([idx(2, 4), idx(2, 5), idx(2, 7), idx(2, 8)]);
    const isPruned = (d: number, i: number) => {
      for (let dd = d; dd >= 2; dd--) {
        const anc = Math.floor(i / B ** (d - dd));
        if (pruned.has(idx(dd, anc))) return true;
      }
      return false;
    };

    nodes.forEach((n, k) => {
      if (n.d === 0 || k > shown) return;
      const par = nodes[idx(n.d - 1, Math.floor(n.i / B))];
      const pr = isPruned(n.d, n.i);
      g.strokeStyle = pr ? A(P.mut, 0.35) : A(P.acc, 0.9);
      g.lineWidth = pr ? 1 : 1.5;
      if (pr) g.setLineDash([2, 4]);
      g.beginPath();
      g.moveTo(par.x, par.y);
      g.lineTo(n.x, n.y);
      g.stroke();
      g.setLineDash([]);
    });

    const R = rng(5);
    nodes.forEach((n, k) => {
      if (k > shown) return;
      const pr = n.d > 0 && isPruned(n.d, n.i);
      const s = n.d === D ? 6 : 10;
      g.fillStyle = pr ? P.s1 : n.d % 2 ? P.bg : A(P.ink, 1);
      g.strokeStyle = A(P.ink, pr ? 0.35 : 1);
      g.lineWidth = 1.2;
      g.fillRect(n.x - s / 2, n.y - s / 2, s, s);
      g.strokeRect(n.x - s / 2, n.y - s / 2, s, s);
      if (n.d === D && !pr) {
        g.fillStyle = A(P.ink, 0.8);
        g.font = "400 9px 'DM Mono', monospace";
        g.textAlign = 'center';
        g.fillText(String(Math.round((R() - 0.5) * 20)), n.x, n.y + 16);
        g.textAlign = 'start';
      } else if (n.d === D) {
        R();
      }
    });

    g.fillStyle = A(P.ink, 0.8);
    g.font = MONO;
    g.fillText('MAX ■ · MIN □ · DASHED = PRUNED · DEPTH 3', 12, h - 12);
  };
}

/**
 * Factories, not painters: a mounted specimen calls the factory once so its plan cache is
 * private to that canvas.
 */
export const ANIMATED_SPECIMENS: Record<string, () => SpecimenPainter> = {
  chain: createMlmp,
  hull: createCgeo,
  equity: createNomic,
  graph: createNudge,
  board: createChess,
};
