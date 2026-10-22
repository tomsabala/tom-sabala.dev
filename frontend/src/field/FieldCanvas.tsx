/**
 * The one fixed, full-viewport canvas behind the page, and the one rAF loop
 * that drives it. Ported from the `loop()` / `onFieldClick()` / pointer
 * plumbing of `Portfolio Home.dc.html`, with the mobile budgets, the
 * IntersectionObserver gate and the resize-reset suppression from the
 * redesign plan's "Mobile design" section added on top.
 */

import { useEffect, useRef } from 'react';

import { arm, type ArmState } from './algorithms/arm';
import { lidar, type LidarState } from './algorithms/lidar';
import { planner, type PlannerState } from './algorithms/planner';
import { voronoi, type VoronoiState } from './algorithms/voronoi';
import { fieldCaps } from './config';
import { grid, PAL } from './draw';
import type { FieldAlgo, FieldKind, FieldPointer } from './types';
import { COARSE_QUERY, MOBILE_QUERY, useField, useMediaQuery } from './useField';

type FieldState = PlannerState | VoronoiState | LidarState | ArmState;

const IMPL: Record<FieldKind, FieldAlgo<FieldState>> = { planner, voronoi, lidar, arm };

/**
 * A click reaches the field unless it lands on something that owns it: a control, or a
 * content panel (`data-panel="1"` — every section card, the header, the footer, the dock,
 * any dialog). This is a deny-list on purpose. The allow-list it replaces missed every
 * part of the page that is visibly nothing but field: the margins either side of the
 * 1360px content column, the strip under the footer, the body itself. Those are exactly
 * where "go ahead, poke it" invites a click, and they did nothing.
 */
const PANEL_SELECTOR = 'a,button,input,textarea,label,select,form,[data-panel]';

export default function FieldCanvas() {
  const field = useField();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mobile = useMediaQuery(MOBILE_QUERY);
  const coarse = useMediaQuery(COARSE_QUERY);

  const fieldRef = useRef(field);
  fieldRef.current = field;
  const mobileRef = useRef(mobile);
  mobileRef.current = mobile;
  const coarseRef = useRef(coarse);
  coarseRef.current = coarse;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let S: FieldState | null = null;
    let W = 0;
    let H = 0;
    let hudT = 0;
    let lastSeq = fieldRef.current.resetSeq;
    let lastTheme = '';
    let needsDraw = true;
    let visible = true;
    const pointer: FieldPointer = { x: 0, y: 0, active: false };

    const themeName = (): 'light' | 'dark' =>
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const c = canvasRef.current;
      if (!c) return;
      const st = fieldRef.current;

      const th = themeName();
      if (th !== lastTheme) {
        lastTheme = th;
        needsDraw = true;
      }
      if (st.resetSeq !== lastSeq) {
        lastSeq = st.resetSeq;
        S = null;
        needsDraw = true;
      }
      // Below the fold, or paused with nothing new to show: burn no frames.
      if (!visible) return;
      if (st.paused && !needsDraw) return;

      const w = c.clientWidth,
        h = c.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, mobileRef.current ? 1.5 : 2);
      const bw = Math.round(w * dpr),
        bh = Math.round(h * dpr);
      if (w !== W || h !== H || c.width !== bw || c.height !== bh) {
        // A mobile URL bar collapsing mid-scroll changes the height by ~60-100px;
        // that must not restart the simulation.
        const hard = w !== W || Math.abs(h - H) > 120;
        W = w;
        H = h;
        c.width = bw;
        c.height = bh;
        if (hard) S = null;
        needsDraw = true;
      }

      const g = c.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      const t = ts / 1000;
      if (!pointer.active) {
        // Idle auto-drift, until the visitor moves or taps.
        pointer.x = w * (0.64 + 0.24 * Math.sin(t * 0.23));
        pointer.y = h * (0.4 + 0.28 * Math.sin(t * 0.37 + 1));
      }

      const caps = fieldCaps(mobileRef.current);
      const impl = IMPL[st.algo];
      if (!S || S.kind !== st.algo) S = impl.init(w, h, st.cfg, caps);

      const P = PAL[th];
      g.clearRect(0, 0, w, h);
      grid(g, w, h, P);
      impl.step(g, w, h, P, S, { t, pointer, cfg: st.cfg, caps });

      if (ts - hudT > 120 && st.hudRef.current) {
        hudT = ts;
        // Direct textContent write: a 120ms React re-render loop would be absurd.
        st.hudRef.current.textContent = impl.hud(S, pointer);
      }
      needsDraw = false;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (coarseRef.current) return; // No hover on touch: the target follows taps.
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      needsDraw = true;
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) pointer.active = false;
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest(PANEL_SELECTOR)) return;

      const st = fieldRef.current;
      const x = e.clientX,
        y = e.clientY;

      if (coarseRef.current) {
        if (!st.armed) {
          // Plain tap retargets the goal / site / waypoint / reach point.
          pointer.x = x;
          pointer.y = y;
          pointer.active = true;
          needsDraw = true;
          return;
        }
        st.disarm();
      }

      if (!S) return;
      IMPL[st.algo].onTap(S, x, y, st.tool, {
        cfg: st.cfg,
        caps: fieldCaps(mobileRef.current),
        w: W,
        h: H,
        setCfg: st.setCfg,
      });
      needsDraw = true;
    };

    // The canvas is fixed behind the whole page and every section floats on it at 93%
    // opacity, so the simulation stays live and steerable for the entire scroll — it used
    // to freeze once the hero left the viewport, which made the sections look like a
    // screenshot. The only reason to stop is a page nobody is looking at.
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) needsDraw = true;
    };
    document.addEventListener('visibilitychange', onVisibility);

    window.addEventListener('pointermove', onPointerMove);
    document.addEventListener('mouseout', onMouseOut);
    window.addEventListener('click', onClick);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
