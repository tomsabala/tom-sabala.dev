import { useEffect, useRef } from 'react';

/**
 * ASCII LiDAR, ported from `Terminal.dc.html`: a rover drives towards a random reachable
 * goal while a 10-ray fan sweeps the room. Every return marks the cell it hit and fades
 * through the glyph ladder, so the drawing is a map of what the rover has actually seen.
 *
 * Both <pre> elements are written with direct `textContent` on a ~50 ms tick — twenty
 * React renders a second of a 44x24 character grid would be pure waste.
 */

const COLS = 44;
const ROWS = 24;
const FRAME_MS = 50;

interface World {
  W: number;
  H: number;
  /** 1 = occupied. */
  g: Uint8Array[];
  /** Timestamp (seconds) each cell was last hit by a ray; 0 = never seen. */
  seen: Float32Array[];
  r: { x: number; y: number; a: number };
  goal: { x: number; y: number } | null;
  beam: number;
  pts: number;
  path: [number, number][];
  stuck: number;
}

function makeWorld(W: number, H: number): World {
  const g = Array.from({ length: H }, (_, y) => {
    const row = new Uint8Array(W);
    for (let x = 0; x < W; x++) {
      row[x] = x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 1 : 0;
    }
    return row;
  });

  const box = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (g[j] && g[j][i] !== undefined) g[j][i] = 1;
      }
    }
  };

  box(8, 5, 6, 3);
  box(26, 4, 3, 7);
  box(16, 14, 9, 2);
  box(33, 15, 4, 4);
  box(5, 16, 3, 3);
  box(18, 8, 2, 2);
  // A wall with a doorway, so the rover has somewhere it has to drive around.
  for (let x = 1; x < 12; x++) g[11][x] = 1;
  g[11][6] = 0;
  g[11][7] = 0;

  return {
    W,
    H,
    g,
    seen: Array.from({ length: H }, () => new Float32Array(W)),
    r: { x: 38, y: 6, a: Math.PI },
    goal: null,
    beam: 0,
    pts: 0,
    path: [],
    stuck: 0,
  };
}

function free(w: World, x: number, y: number): boolean {
  const i = Math.floor(x);
  const j = Math.floor(y);
  return j > 0 && j < w.H && i > 0 && i < w.W && !w.g[j][i];
}

function stepWorld(w: World, now: number): string {
  const R = w.r;

  if (!w.goal || Math.hypot(w.goal.x - R.x, w.goal.y - R.y) < 1 || w.stuck > 30) {
    let gx = R.x;
    let gy = R.y;
    let k = 0;
    do {
      gx = 2 + Math.random() * (w.W - 4);
      gy = 2 + Math.random() * (w.H - 4);
    } while (!free(w, gx, gy) && k++ < 50);
    w.goal = { x: gx, y: gy };
    w.stuck = 0;
  }

  const ta = Math.atan2(w.goal.y - R.y, w.goal.x - R.x);
  const da = Math.atan2(Math.sin(ta - R.a), Math.cos(ta - R.a));
  R.a += da * 0.3;

  // Cells are ~twice as wide as they are tall, so vertical motion is scaled by 0.55.
  const nx = R.x + Math.cos(R.a) * 0.35;
  const ny = R.y + Math.sin(R.a) * 0.35 * 0.55;
  if (free(w, nx, ny)) {
    R.x = nx;
    R.y = ny;
  } else {
    w.stuck += 1;
    R.a += 0.9;
  }

  w.path.push([Math.floor(R.x), Math.floor(R.y)]);
  if (w.path.length > 40) w.path.shift();

  const rays: number[] = [];
  for (let k = 0; k < 10; k++) {
    const a = w.beam + k * 0.035;
    for (let s = 0; s < 40; s += 0.4) {
      const x = R.x + Math.cos(a) * s;
      const y = R.y + Math.sin(a) * s * 0.55;
      const i = Math.floor(x);
      const j = Math.floor(y);
      if (j < 0 || j >= w.H || i < 0 || i >= w.W) break;
      if (w.g[j][i]) {
        if (now - w.seen[j][i] > 0.5) w.pts++;
        w.seen[j][i] = now;
        break;
      }
      rays.push(j * w.W + i);
    }
  }
  w.beam = (w.beam + 0.35) % (Math.PI * 2);

  const ray = new Set(rays);
  const trail = new Set(w.path.map(([i, j]) => j * w.W + i));
  const rx = Math.floor(R.x);
  const ry = Math.floor(R.y);
  const gx = Math.floor(w.goal.x);
  const gy = Math.floor(w.goal.y);

  let out = '';
  for (let j = 0; j < w.H; j++) {
    for (let i = 0; i < w.W; i++) {
      if (i === rx && j === ry) { out += '@'; continue; }
      if (i === gx && j === gy) { out += '×'; continue; }
      const seen = w.seen[j][i];
      const age = now - seen;
      if (seen && age < 1.5) out += '█';
      else if (seen && age < 4) out += '▓';
      else if (seen && age < 8) out += '▒';
      else if (seen && age < 14) out += '░';
      else if (ray.has(j * w.W + i)) out += '·';
      else if (trail.has(j * w.W + i)) out += '˙';
      else out += ' ';
    }
    out += '\n';
  }
  return out;
}

function telemetry(w: World): string {
  const R = w.r;
  const heading = Math.round((((R.a * 180) / Math.PI) % 360 + 360) % 360);
  const goal = w.goal ?? { x: 0, y: 0 };
  return [
    `POSE    ${R.x.toFixed(1).padStart(5)}, ${R.y.toFixed(1).padStart(5)}`,
    `HEAD    ${String(heading).padStart(5)}°`,
    `RETURNS ${String(w.pts).padStart(5)}`,
    `GOAL    ${goal.x.toFixed(1).padStart(5)}, ${goal.y.toFixed(1).padStart(5)}`,
  ].join('\n');
}

interface LidarPaneProps {
  /** Bumped by `field reset`; a new value throws the explored map away. */
  resetSignal: number;
}

export default function LidarPane({ resetSignal }: LidarPaneProps) {
  const scanRef = useRef<HTMLPreElement>(null);
  const telemetryRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const world = makeWorld(COLS, ROWS);
    let last = 0;
    let raf = 0;

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (ts - last < FRAME_MS) return;
      last = ts;
      const scan = scanRef.current;
      if (!scan) return;
      scan.textContent = stepWorld(world, ts / 1000);
      if (telemetryRef.current) telemetryRef.current.textContent = telemetry(world);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [resetSignal]);

  return (
    <aside className="terminal-lidar" aria-hidden="true">
      <div className="terminal-lidar-head">
        <span className="terminal-lidar-title">● /dev/lidar0 · SCAN</span>
        <span className="terminal-lidar-hint">field off to hide</span>
      </div>
      <pre className="terminal-lidar-scan" ref={scanRef} />
      <pre className="terminal-lidar-telemetry" ref={telemetryRef} />
    </aside>
  );
}
