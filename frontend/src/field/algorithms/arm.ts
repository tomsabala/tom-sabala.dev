/**
 * FABRIK inverse-kinematics arm.
 * Ported from `Portfolio Home.dc.html`: `init_arm`, `step_arm`, plus the
 * `S.kind === 'arm'` branches of `onFieldClick` and `hud`.
 */

import { bool, num } from '../config';
import { A, cross, MONO } from '../draw';
import type { FieldAlgo, FieldPointer, FieldStepCtx, FieldTapCtx, FieldTool, Pal, Pt } from '../types';

export interface ArmState {
  kind: 'arm';
  base: Pt;
  /** Link length. */
  L: number;
  /** Joint positions, `J[0]` is the base and `J[n]` the end effector. */
  J: Pt[];
  trail: Pt[];
  tx: number;
  ty: number;
  err: number;
}

export const arm: FieldAlgo<ArmState> = {
  kind: 'arm',

  init(w, h, cfg) {
    const n = num(cfg, 'dof', 4),
      base = { x: w * 0.6, y: h - 30 },
      L = Math.min(h * 0.92, w * 0.62) / n,
      J: Pt[] = [];
    for (let i = 0; i <= n; i++) J.push({ x: base.x, y: base.y - i * L });
    return { kind: 'arm', base, L, J, trail: [], tx: base.x, ty: base.y - n * L * 0.6, err: 0 };
  },

  step(g: CanvasRenderingContext2D, _w: number, _h: number, P: Pal, S: ArmState, ctx: FieldStepCtx) {
    const J = S.J,
      L = S.L,
      n = J.length - 1,
      b = S.base,
      m = ctx.pointer,
      C = ctx.cfg,
      follow = num(C, 'follow', 0.14);
    S.tx += (m.x - S.tx) * follow;
    S.ty += (Math.min(m.y, b.y - 10) - S.ty) * follow;
    const t = { x: S.tx, y: S.ty },
      reach = L * n,
      nrm = (p: Pt, q: Pt): Pt => {
        const d = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        return { x: p.x + ((q.x - p.x) / d) * L, y: p.y + ((q.y - p.y) / d) * L };
      };
    if (Math.hypot(t.x - b.x, t.y - b.y) > reach) {
      for (let i = 0; i < n; i++) J[i + 1] = nrm(J[i], t);
    } else
      for (let it = 0; it < 12; it++) {
        J[n] = { x: t.x, y: t.y };
        for (let i = n - 1; i >= 0; i--) J[i] = nrm(J[i + 1], J[i]);
        J[0] = { x: b.x, y: b.y };
        for (let i = 0; i < n; i++) J[i + 1] = nrm(J[i], J[i + 1]);
      }
    S.err = Math.hypot(J[n].x - t.x, J[n].y - t.y);
    S.trail.push({ x: J[n].x, y: J[n].y });
    if (S.trail.length > 90) S.trail.shift();

    if (bool(C, 'ws')) {
      g.strokeStyle = A(P.mut, 0.45);
      g.setLineDash([3, 6]);
      g.beginPath();
      g.arc(b.x, b.y, reach, Math.PI, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = A(P.mut, 0.7);
      g.font = MONO;
      g.fillText('WORKSPACE', b.x - reach + 6, b.y - 8);
    }
    if (bool(C, 'trail'))
      for (let i = 1; i < S.trail.length; i++) {
        g.strokeStyle = A(P.acc, (i / S.trail.length) * 0.8);
        g.beginPath();
        g.moveTo(S.trail[i - 1].x, S.trail[i - 1].y);
        g.lineTo(S.trail[i].x, S.trail[i].y);
        g.stroke();
      }
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      g.strokeStyle = P.ln2;
      g.lineWidth = 18 - i * 2;
      g.beginPath();
      g.moveTo(J[i].x, J[i].y);
      g.lineTo(J[i + 1].x, J[i + 1].y);
      g.stroke();
      g.strokeStyle = P.s1;
      g.lineWidth = 15 - i * 2;
      g.stroke();
      g.strokeStyle = A(P.acc, 0.8);
      g.lineWidth = 1;
      g.stroke();
    }
    g.lineCap = 'butt';
    let prev = -Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(J[i + 1].y - J[i].y, J[i + 1].x - J[i].x),
        rel = Math.atan2(Math.sin(a - prev), Math.cos(a - prev));
      g.strokeStyle = A(P.acc, 0.9);
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(J[i].x, J[i].y, 20, Math.min(prev, prev + rel), Math.max(prev, prev + rel));
      g.stroke();
      g.fillStyle = P.bg;
      g.strokeStyle = A(P.ink, 1);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(J[i].x, J[i].y, 7, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = A(P.ink, 0.85);
      g.font = MONO;
      g.fillText(`θ${i + 1} ${Math.round((rel * 180) / Math.PI)}°`, J[i].x + 14, J[i].y + 18);
      prev = a;
    }
    const e = J[n];
    g.save();
    g.translate(e.x, e.y);
    g.rotate(prev);
    const open = 5 + 3 * Math.sin(ctx.t * 3);
    g.strokeStyle = A(P.ink, 1);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, -open);
    g.lineTo(12, -open);
    g.moveTo(0, open);
    g.lineTo(12, open);
    g.moveTo(0, -open - 2);
    g.lineTo(0, open + 2);
    g.stroke();
    g.restore();
    g.fillStyle = P.s1;
    g.strokeStyle = A(P.ink, 1);
    g.lineWidth = 1.5;
    g.fillRect(b.x - 34, b.y, 68, 30);
    g.strokeRect(b.x - 34, b.y, 68, 30);
    g.save();
    g.beginPath();
    g.rect(b.x - 34, b.y, 68, 30);
    g.clip();
    g.strokeStyle = A(P.mut, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    for (let k = -40; k < 80; k += 7) {
      g.moveTo(b.x - 34 + k, b.y);
      g.lineTo(b.x - 34 + k + 30, b.y + 30);
    }
    g.stroke();
    g.restore();
    cross(g, m.x, m.y, A(P.acc, 1), 'TARGET');
  },

  hud(S: ArmState, pointer: FieldPointer) {
    const xy = `${Math.round(pointer.x)}, ${Math.round(pointer.y)}`;
    return `DOF    ${S.J.length - 1}\nREACH  ${Math.round(S.L * (S.J.length - 1))} px\nERROR  ${(
      S.err || 0
    ).toFixed(2)} px\nTARGET ${xy}`;
  },

  onTap(_S: ArmState, _x: number, _y: number, tool: FieldTool, ctx: FieldTapCtx) {
    ctx.setCfg('dof', Math.max(2, Math.min(8, num(ctx.cfg, 'dof', 4) + (tool === 'add' ? 1 : -1))), true);
  },
};
