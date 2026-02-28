/**
 * RobotBackground
 *
 * Renders a fixed layer of wandering robot sprites behind all page content.
 * Robots walk across the screen and occasionally wave. Extends the playful
 * developer aesthetic alongside TerminalBackground.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';

// ── Color ─────────────────────────────────────────────────────────────────────
const COLOR_LIGHT = '#1d4ed8';
const COLOR_DARK  = '#dbeafe';
const TARGET_OPACITY = 0.25;

// ── Robot pool ─────────────────────────────────────────────────────────────────
const TARGET_ROBOTS = 3;
const MIN_ROBOTS    = 2;
const MAX_ROBOTS    = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ── State machine ─────────────────────────────────────────────────────────────
type RobotState = 'walking' | 'turning' | 'waving';

// SVG robot anatomy — viewBox="0 0 40 60"
//   Antenna ball : circle cx=20 cy=6 r=3  (stroke-only)
//   Antenna stick: line (20,9)→(20,13)
//   Head         : rect x=7 y=13 w=26 h=17 rx=3
//   Eyes         : filled circles at (14,21) and (26,21) r=2
//   Body         : rect x=9 y=32 w=22 h=18 rx=2
//   Left arm     : line (9,36)→(2,45)  [static]
//   Right arm    : line (31,36)→(38,45) [wave-animated]
//   Left leg     : line (15,50)→[walk-frame]
//   Right leg    : line (25,50)→[walk-frame]

// Walk frame [leftLegX2, leftLegY2, rightLegX2, rightLegY2]
// Designed for rightward travel; SVG is mirrored (scaleX(-1)) when vx < 0.
const WALK_FRAMES: [number, number, number, number][] = [
  [14, 58, 26, 58], // neutral
  [21, 58, 19, 58], // left foot forward
  [ 9, 58, 31, 58], // right foot forward
];

// Wave frame [rightArmX2, rightArmY2]
const WAVE_FRAMES: [number, number][] = [
  [38, 45], // arm down (normal)
  [38, 27], // arm raised
];

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Robot class ───────────────────────────────────────────────────────────────
class Robot {
  el: HTMLDivElement;
  private svgEl: SVGSVGElement;
  private legLeftEl: SVGLineElement;
  private legRightEl: SVGLineElement;
  private armRightEl: SVGLineElement;

  x: number;
  y: number;
  private vx: number;
  private vy: number;

  private state: RobotState = 'walking';
  private stateTimer: number;
  private walkFrame: 0 | 1 | 2 = 0;
  private walkFrameTimer = 150;
  private waveFrame: 0 | 1 = 0;
  private waveFrameTimer = 350;
  private lifetime: number;
  done = false;

  constructor(container: HTMLDivElement, color: string) {
    const W = window.innerWidth;
    const H = window.innerHeight;

    this.x = rnd(20, Math.max(21, W - 60));
    this.y = rnd(H * 0.05, H * 0.9);

    const speed = rnd(30, 70);
    const angle  = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed * 0.25;

    this.lifetime    = rnd(20_000, 40_000);
    this.stateTimer  = rnd(4000, 12000);

    // ── Build SVG ────────────────────────────────────────────────────────────
    this.svgEl = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
    this.svgEl.setAttribute('viewBox', '0 0 40 60');
    this.svgEl.setAttribute('width', '40');
    this.svgEl.setAttribute('height', '60');
    this.svgEl.style.cssText = 'display:block; transform-origin:center;';

    const sw = '2.5';

    const mkLine = (x1: number, y1: number, x2: number, y2: number): SVGLineElement => {
      const el = document.createElementNS(SVG_NS, 'line') as SVGLineElement;
      el.setAttribute('x1', String(x1)); el.setAttribute('y1', String(y1));
      el.setAttribute('x2', String(x2)); el.setAttribute('y2', String(y2));
      el.setAttribute('stroke', color);
      el.setAttribute('stroke-width', sw);
      el.setAttribute('stroke-linecap', 'round');
      return el;
    };

    const mkRect = (x: number, y: number, w: number, h: number, rx = 2): SVGRectElement => {
      const el = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
      el.setAttribute('x', String(x)); el.setAttribute('y', String(y));
      el.setAttribute('width', String(w)); el.setAttribute('height', String(h));
      el.setAttribute('rx', String(rx));
      el.setAttribute('fill', 'none');
      el.setAttribute('stroke', color);
      el.setAttribute('stroke-width', sw);
      return el;
    };

    const mkCircle = (cx: number, cy: number, r: number, filled: boolean): SVGCircleElement => {
      const el = document.createElementNS(SVG_NS, 'circle') as SVGCircleElement;
      el.setAttribute('cx', String(cx)); el.setAttribute('cy', String(cy));
      el.setAttribute('r', String(r));
      el.setAttribute('fill', filled ? color : 'none');
      if (!filled) {
        el.setAttribute('stroke', color);
        el.setAttribute('stroke-width', '2');
      }
      return el;
    };

    // Antenna
    this.svgEl.appendChild(mkCircle(20, 6, 3, false));
    this.svgEl.appendChild(mkLine(20, 9, 20, 13));

    // Head + eyes
    this.svgEl.appendChild(mkRect(7, 13, 26, 17, 3));
    this.svgEl.appendChild(mkCircle(14, 21, 2, true));
    this.svgEl.appendChild(mkCircle(26, 21, 2, true));

    // Body
    this.svgEl.appendChild(mkRect(9, 32, 22, 18, 2));

    // Arms
    this.svgEl.appendChild(mkLine(9, 36, 2, 45));    // left arm (static)
    this.armRightEl = mkLine(31, 36, 38, 45);         // right arm (wave-animated)
    this.svgEl.appendChild(this.armRightEl);

    // Legs
    this.legLeftEl  = mkLine(15, 50, 14, 58);
    this.legRightEl = mkLine(25, 50, 26, 58);
    this.svgEl.appendChild(this.legLeftEl);
    this.svgEl.appendChild(this.legRightEl);

    // ── Wrapper div ──────────────────────────────────────────────────────────
    this.el = document.createElement('div');
    this.el.style.cssText = `position:absolute; left:${this.x}px; top:${this.y}px; opacity:0; transition:opacity 0.7s ease; pointer-events:none;`;
    this.el.appendChild(this.svgEl);
    container.appendChild(this.el);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.el.style.opacity = String(TARGET_OPACITY);
    }));
  }

  private applyWalkFrame() {
    const [llx2, lly2, rlx2, rly2] = WALK_FRAMES[this.walkFrame];
    this.legLeftEl.setAttribute('x2', String(llx2));
    this.legLeftEl.setAttribute('y2', String(lly2));
    this.legRightEl.setAttribute('x2', String(rlx2));
    this.legRightEl.setAttribute('y2', String(rly2));
  }

  private applyWaveFrame() {
    const [x2, y2] = WAVE_FRAMES[this.waveFrame];
    this.armRightEl.setAttribute('x2', String(x2));
    this.armRightEl.setAttribute('y2', String(y2));
  }

  private resetArm() {
    this.armRightEl.setAttribute('x2', '38');
    this.armRightEl.setAttribute('y2', '45');
  }

  private pickNewDirection() {
    const speed = rnd(30, 70);
    const angle  = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed * 0.25;
  }

  update(dt: number) {
    if (this.done) return;

    this.lifetime -= dt;
    if (this.lifetime <= 0) { this.done = true; return; }

    const W = window.innerWidth;
    const H = window.innerHeight;

    switch (this.state) {
      case 'walking': {
        this.x += this.vx * (dt / 1000);
        this.y += this.vy * (dt / 1000);

        // Wall bounce — reflect velocity and stay in walking state
        if (this.x < 0)          { this.x = 0;       this.vx =  Math.abs(this.vx); }
        else if (this.x > W - 40) { this.x = W - 40; this.vx = -Math.abs(this.vx); }
        if (this.y < 0)          { this.y = 0;       this.vy =  Math.abs(this.vy); }
        else if (this.y > H - 60) { this.y = H - 60; this.vy = -Math.abs(this.vy); }

        this.el.style.left = `${this.x}px`;
        this.el.style.top  = `${this.y}px`;
        this.svgEl.style.transform = this.vx < 0 ? 'scaleX(-1)' : 'scaleX(1)';

        // Walk frame animation
        this.walkFrameTimer -= dt;
        if (this.walkFrameTimer <= 0) {
          this.walkFrame = ((this.walkFrame + 1) % 3) as 0 | 1 | 2;
          this.walkFrameTimer = 150;
          this.applyWalkFrame();
        }

        // Random state transition
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          if (Math.random() < 0.08) {
            this.vx = 0; this.vy = 0;
            this.walkFrame = 0;
            this.applyWalkFrame();
            this.state = 'waving';
            this.stateTimer     = rnd(2000, 4000);
            this.waveFrame      = 0;
            this.waveFrameTimer = 350;
          } else {
            this.state = 'turning';
            this.stateTimer = rnd(400, 800);
          }
        }
        break;
      }

      case 'turning': {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.pickNewDirection();
          this.state = 'walking';
          this.stateTimer     = rnd(4000, 12000);
          this.walkFrameTimer = 150;
        }
        break;
      }

      case 'waving': {
        this.waveFrameTimer -= dt;
        if (this.waveFrameTimer <= 0) {
          this.waveFrame = this.waveFrame === 0 ? 1 : 0;
          this.waveFrameTimer = 350;
          this.applyWaveFrame();
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.resetArm();
          this.pickNewDirection();
          this.state = 'walking';
          this.stateTimer     = rnd(4000, 12000);
          this.walkFrameTimer = 150;
        }
        break;
      }
    }
  }

  close(onDone: () => void) {
    this.el.style.opacity = '0';
    setTimeout(() => { this.el.remove(); onDone(); }, 700);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const RobotBackground: React.FC = () => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const color = theme === 'dark' ? COLOR_DARK : COLOR_LIGHT;
    const robots: Robot[] = [];
    let rafId: number;
    let lastT = performance.now();
    let spawnScheduled = 0;
    // Track every pending timeout so cleanup can cancel them all, preventing
    // stale callbacks from spawning robots after the effect has been torn down.
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    function spawnRobot() {
      if (robots.length >= MAX_ROBOTS) return;
      robots.push(new Robot(container!, color));
    }

    function scheduleRespawn() {
      if (spawnScheduled >= 3) return;
      spawnScheduled++;
      pendingTimeouts.push(setTimeout(() => {
        spawnScheduled--;
        if (robots.length < MIN_ROBOTS) spawnRobot();
        else if (robots.length < TARGET_ROBOTS && Math.random() < 0.7) spawnRobot();
      }, rnd(300, 2000)));
    }

    // Initial staggered spawn
    for (let i = 0; i < TARGET_ROBOTS; i++) {
      pendingTimeouts.push(setTimeout(() => spawnRobot(), i * rnd(150, 600)));
    }

    function tick(ts: number) {
      const dt = Math.min(ts - lastT, 80);
      lastT = ts;

      for (let i = robots.length - 1; i >= 0; i--) {
        robots[i].update(dt);
        if (robots[i].done) {
          const robot = robots.splice(i, 1)[0];
          robot.close(() => scheduleRespawn());
        }
      }

      if (robots.length < MIN_ROBOTS && spawnScheduled === 0) scheduleRespawn();

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      pendingTimeouts.forEach(id => clearTimeout(id));
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
      }}
    />
  );
};

export default RobotBackground;
