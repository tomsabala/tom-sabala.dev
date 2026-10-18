import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';
import type { HostedApp } from './registry.ts';
import { modeLabel, unitIndex } from './units.ts';

/**
 * The request path, drawn the way it actually runs: the browser talks to the gateway, the
 * gateway's broker decides which container serves `/a/<slug>/`, and one unit node per app
 * sits at the end of that chain. The nodes are real DOM (so they stay selectable,
 * focusable and legible at any width); the canvas underneath only measures them and draws
 * the elbow connectors plus the packets marching along the selected route.
 */

interface Palette {
  ink: string;
  mut: string;
  acc: string;
  dot: string;
}

const PAL: Record<'light' | 'dark', Palette> = {
  light: { ink: '#0d150f', mut: 'rgba(86,101,90,0.6)', acc: '#c8f53c', dot: '#56655a' },
  dark: { ink: '#e8f0e3', mut: 'rgba(147,165,150,0.5)', acc: '#c8f53c', dot: '#93a596' },
};

interface Spot {
  left: string;
  top: string;
  width: string;
}

interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
  cx: number;
  cy: number;
}

type Point = [number, number];

const INFRA: { id: string; label: string; note: string; invert: boolean }[] = [
  { id: 'you', label: 'YOU', note: 'browser', invert: false },
  { id: 'gw', label: 'GATEWAY', note: 'manifest.json', invert: true },
  { id: 'br', label: 'BROKER', note: 'spawns units', invert: false },
];

function infraSpot(id: string, narrow: boolean): Spot {
  if (narrow) {
    const tops: Record<string, string> = { you: '7%', gw: '21%', br: '35%' };
    return { left: '50%', top: tops[id] ?? '7%', width: id === 'you' ? '44%' : '52%' };
  }
  const wide: Record<string, [string, string]> = {
    you: ['10%', '13%'],
    gw: ['30%', '16%'],
    br: ['50%', '15%'],
  };
  const [left, width] = wide[id] ?? wide.you;
  return { left, top: '46%', width };
}

/** Pixels between stacked unit centres; `null` when the units sit side by side. */
function stackStep(count: number, heightPx: number | null): number | null {
  if (heightPx === null) return null;
  // The band runs from just under the broker to just over the legend strip.
  return (heightPx - 90 - heightPx * 0.46) / Math.max(count, 1);
}

/**
 * The prototype hard-codes three units. Spacing is derived instead so a fourth app does not
 * silently land on top of a third: wide units stay centred on the vertical run, stacked
 * units share the band between the broker and the legend. The stacked case needs the real
 * pixel height because a percentage gap shrinks with the box and the node boxes do not.
 */
function unitSpot(index: number, count: number, heightPx: number | null): Spot {
  const step = stackStep(count, heightPx);
  if (heightPx !== null && step !== null) {
    const centre = heightPx * 0.46 + step * (index + 0.5);
    return { left: '50%', top: `${(centre / heightPx) * 100}%`, width: '78%' };
  }
  const gap = Math.min(30, 84 / Math.max(count, 1));
  return { left: '78%', top: `${50 + (index - (count - 1) / 2) * gap}%`, width: '28%' };
}

function RequestPathDiagram({
  apps,
  selected,
  onSelect,
  heightPx,
}: {
  apps: HostedApp[];
  selected: number;
  onSelect: (index: number) => void;
  /** Stacked layout at a known height; `null` is the wide, viewport-relative band. */
  heightPx: number | null;
}) {
  const { theme } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const narrow = heightPx !== null;
  // Read inside the animation frame so changing selection or theme never restarts the loop.
  const live = useRef({ selected, narrow, theme, count: apps.length });
  live.current = { selected, narrow, theme, count: apps.length };

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const host = hostRef.current;
      const canvas = canvasRef.current;
      if (!host || !canvas) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      const g = canvas.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);

      const box = host.getBoundingClientRect();
      const measure = (id: string): Box | null => {
        const el = host.querySelector(`[data-node="${id}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          l: r.left - box.left,
          t: r.top - box.top,
          r: r.right - box.left,
          b: r.bottom - box.top,
          cx: (r.left + r.right) / 2 - box.left,
          cy: (r.top + r.bottom) / 2 - box.top,
        };
      };

      const you = measure('you');
      const gw = measure('gw');
      const br = measure('br');
      if (!you || !gw || !br) return;

      const { selected: sel, narrow: isNarrow, theme: mode, count } = live.current;
      const pal = PAL[mode === 'dark' ? 'dark' : 'light'];
      const t = reduced ? 0 : ts / 1000;

      // Elbow: down-across-down when stacked, across-down-across when side by side.
      const link = (a: Box, b: Box): Point[] =>
        isNarrow
          ? [
              [a.cx, a.b],
              [a.cx, (a.b + b.t) / 2],
              [b.cx, (a.b + b.t) / 2],
              [b.cx, b.t],
            ]
          : [
              [a.r, a.cy],
              [(a.r + b.l) / 2, a.cy],
              [(a.r + b.l) / 2, b.cy],
              [b.l, b.cy],
            ];

      for (let i = 0; i < count; i += 1) {
        const unit = measure(`u${i}`);
        if (!unit) continue;
        const path: Point[] = [...link(you, gw), ...link(gw, br), ...link(br, unit)];
        const on = i === sel;

        g.strokeStyle = on ? pal.ink : pal.mut;
        g.lineWidth = on ? 2 : 1;
        g.setLineDash(on ? [] : [4, 4]);
        g.beginPath();
        path.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.setLineDash([]);

        const segments: number[] = [];
        let total = 0;
        for (let k = 1; k < path.length; k += 1) {
          const d = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
          segments.push(d);
          total += d;
        }
        if (!total) continue;

        for (let q = 0; q < (on ? 3 : 1); q += 1) {
          let travelled = (t * (on ? 150 : 70) + (q * total) / 3 + i * 80) % total;
          let k = 0;
          while (k < segments.length - 1 && travelled > segments[k]) {
            travelled -= segments[k];
            k += 1;
          }
          const f = segments[k] ? travelled / segments[k] : 0;
          const x = path[k][0] + (path[k + 1][0] - path[k][0]) * f;
          const y = path[k][1] + (path[k + 1][1] - path[k][1]) * f;
          g.fillStyle = on ? pal.acc : pal.dot;
          g.fillRect(x - 4, y - 4, 8, 8);
          if (on) {
            g.strokeStyle = pal.ink;
            g.lineWidth = 1;
            g.strokeRect(x - 4, y - 4, 8, 8);
          }
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        height: heightPx === null ? 'min(72vh,640px)' : `${heightPx}px`,
        backgroundImage:
          'radial-gradient(color-mix(in oklab,var(--mut) 35%,transparent) 1px,transparent 1.2px)',
        backgroundSize: '24px 24px',
      }}
      className="relative min-w-0 flex-[1_1_560px] border-b border-r border-ln"
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />

      <span className="absolute left-5 top-[18px] font-mono text-[11px] leading-none tracking-[0.12em] text-mut">
        REQUEST PATH · LIVE
      </span>

      {INFRA.map(node => {
        const spot = infraSpot(node.id, narrow);
        return (
          <div
            key={node.id}
            data-node={node.id}
            style={spot}
            className={`absolute box-border -translate-x-1/2 -translate-y-1/2 border border-ink px-2.5 py-[13px] text-center font-mono text-[11px] leading-[1.45] ${
              node.invert ? 'bg-ink text-bg' : 'bg-bg text-ink'
            }`}
          >
            {node.label}
            <br />
            <span className={node.invert ? 'text-acc' : 'text-mut'}>{node.note}</span>
          </div>
        );
      })}

      {apps.map((app, i) => {
        const spot = unitSpot(i, apps.length, heightPx);
        const on = i === selected;
        return (
          <button
            key={app.slug}
            type="button"
            data-node={`u${i}`}
            style={spot}
            onClick={() => onSelect(i)}
            aria-pressed={on}
            className={`absolute box-border flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1 border border-ink p-3 text-left font-mono text-[11px] leading-[1.4] ${
              on ? 'bg-acc text-onacc' : 'bg-bg text-ink hover:border-acct'
            }`}
          >
            <span>UNIT {unitIndex(i)}</span>
            <span className="font-display text-base font-bold tracking-[-0.01em]">{app.name}</span>
            <span className={on ? 'text-onacc' : 'text-ink2'}>
              {app.tech[0] ? `${modeLabel(app)} · ${app.tech[0]}` : modeLabel(app)}
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-4 left-5 right-5 flex flex-wrap gap-x-[18px] gap-y-1.5 font-mono text-[11px] leading-[1.3] text-ink2">
        <span>■ request in flight</span>
        <span>session · private instance per visitor</span>
        <span>shared · one instance for everyone</span>
      </div>
    </div>
  );
}

export default RequestPathDiagram;
