/**
 * TerminalBackground
 *
 * Renders a fixed layer of floating terminal windows behind all page content.
 * Sessions open and close asynchronously (fade in/out), keeping 8–10 live at
 * a time. Each window gets a randomly assigned font, font size, dimensions,
 * position, and session type. Sessions run a character-by-character typing
 * simulation with realistic pauses and streamed output.
 */
import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext.tsx';

// ── Fonts ─────────────────────────────────────────────────────────────────────
const MONO_FONTS = [
  { name: 'JetBrains Mono', css: "'JetBrains Mono', monospace" },
  { name: 'Fira Code',      css: "'Fira Code', monospace" },
  { name: 'IBM Plex Mono',  css: "'IBM Plex Mono', monospace" },
] as const;

const FONT_SIZES_PX = [13, 15, 17, 19] as const;

// ── Color ─────────────────────────────────────────────────────────────────────
const COLOR_LIGHT = '#1d4ed8';
const COLOR_DARK  = '#dbeafe';
const TARGET_OPACITY = 0.22;

// ── Pane pool ─────────────────────────────────────────────────────────────────
const TARGET_PANES = 4;
const MIN_PANES    = 3;
const MAX_PANES    = 5;

// ── Typing speed — "very fast" ────────────────────────────────────────────────
const SPEED_MULT = 0.28;

// ── Session content ───────────────────────────────────────────────────────────
interface Cmd { cmd: string; out: string[]; pause?: number; }
interface SessionDef {
  label: string;
  streaming?: boolean;
  sequences?: Cmd[][];
  lines?: string[];
}

type SessionType = 'git' | 'build' | 'server' | 'test' | 'docker' | 'python';

const SESSIONS: Record<SessionType, SessionDef> = {

  git: {
    label: 'git',
    sequences: [
      [
        { cmd: 'git status', out: ['On branch feature/dark-mode', 'Your branch is up to date.', '', 'Changes to be committed:', '  modified:   src/contexts/ThemeContext.tsx', '  new file:   src/pages/ProjectDetail.tsx', '', 'Changes not staged:', '  modified:   src/index.css'] },
        { cmd: 'git add src/', out: [], pause: 300 },
        { cmd: 'git commit -m "feat: dark mode with system pref"', out: ['[feature/dark-mode a3f2c1d] feat: dark mode', ' 3 files changed, 89 insertions(+), 4 deletions(-)'], pause: 1000 },
        { cmd: 'git push origin feature/dark-mode', out: ['Enumerating objects: 12, done.', 'Counting objects: 100% (12/12), done.', 'Writing objects: 100% (7/7), 3.14 KiB | 3.14 MiB/s, done.', 'To github.com:tomsabala/portfolio.git', '   b8e4a2f..a3f2c1d  feature/dark-mode -> feature/dark-mode'], pause: 2000 },
      ],
      [
        { cmd: 'git log --oneline -8', out: ['a3f2c1d (HEAD -> main) feat: dark mode toggle', 'b8e4a2f fix: sidebar z-index on mobile', 'c91d3b0 refactor: extract ThemeContext', 'd5f7e4a style: nav hover states', 'e2c8b3f chore: bump react-router to 6.27', 'f1a9d2c feat: project detail pages', '02b7e5f fix: mobile overflow'] },
        { cmd: 'git diff --stat HEAD~3', out: ['  src/App.tsx              |  12 +++--', '  src/components/Layout.tsx|  94 +++++++------', '  src/contexts/ThemeContext.tsx | 41 ++++++++++', '  4 files changed, 130 insertions(+), 22 deletions(-)'], pause: 1200 },
        { cmd: 'git stash', out: ['Saved working directory and index state WIP on main: a3f2c1d'] },
        { cmd: 'git stash pop', out: ['On branch main', 'Changes not staged for commit:', '  modified:   src/pages/Home.tsx', 'Dropped refs/stash@{0}'], pause: 800 },
      ],
      [
        { cmd: 'git fetch --prune', out: ['From github.com:tomsabala/portfolio', '   d5f7e4a..a3f2c1d  main -> origin/main'] },
        { cmd: 'git pull --rebase', out: ['First, rewinding head to replay your work on top of it...', 'Applying: fix: sidebar z-index'] },
        { cmd: 'git log --graph --oneline -5', out: ['* a3f2c1d (HEAD -> main) fix: sidebar z-index', '* c91d3b0 feat: dark mode', '* d5f7e4a refactor: ThemeContext', '* e2c8b3f chore: deps'] },
      ],
    ],
  },

  build: {
    label: 'build',
    sequences: [
      [
        { cmd: 'npm run build', out: ['', '> portfolio@0.1.0 build', '> vite build', '', 'vite v5.4.2 building for production...', '✓ 317 modules transformed.', '', 'dist/index.html                   0.61 kB │ gzip:  0.38 kB', 'dist/assets/index-BKX2f9qP.css   28.14 kB │ gzip:  5.42 kB', 'dist/assets/index-Dh2c8Kmq.js   187.43 kB │ gzip: 58.11 kB', '', '✓ built in 3.42s'], pause: 1500 },
        { cmd: 'npx tsc --noEmit', out: [], pause: 1800 },
        { cmd: 'echo "✓ types OK"', out: ['✓ types OK'] },
      ],
      [
        { cmd: 'npm run lint', out: ['', '> portfolio@0.1.0 lint', '> eslint src --ext ts,tsx --max-warnings 0', '', 'src/pages/Portfolio.tsx', '  Warning: React Hook useEffect missing dep  [react-hooks/exhaustive-deps]', '', '✖ 1 problem (0 errors, 1 warning)'] },
        { cmd: 'npm run lint -- --fix', out: ['', '> portfolio@0.1.0 lint', '> eslint src --ext ts,tsx --fix', '', 'All files pass linting.'], pause: 800 },
        { cmd: 'git add src/pages/Portfolio.tsx && git commit -m "fix: exhaustive-deps"', out: ['[main 9fa12c1] fix: exhaustive-deps', ' 1 file changed, 2 insertions(+), 2 deletions(-)'] },
      ],
      [
        { cmd: 'npm install react-markdown', out: ['', 'added 4 packages, and audited 512 packages in 3s', '', 'found 0 vulnerabilities'] },
        { cmd: 'npm run build', out: ['', 'vite v5.4.2 building for production...', '✓ 321 modules transformed.', '✓ built in 3.89s'] },
      ],
    ],
  },

  server: {
    label: 'dev server',
    streaming: true,
    lines: [
      '  VITE v5.4.2  ready in 298 ms',
      '  ➜  Local:   http://localhost:5173/',
      '  ➜  press h + enter to show help',
      '',
      '11:04:32 [vite] hmr update /src/index.css',
      '11:04:38 [vite] hmr update /src/components/Layout.tsx',
      '11:04:38 [vite] ✓ 2 modules transformed.',
      'GET /api/portfolio         200  12ms',
      'GET /api/cv/pdf/file       200  38ms',
      'GET /api/auth/me           401   4ms',
      'POST /api/auth/google      200  84ms',
      'GET /api/auth/me           200   9ms',
      'GET /api/portfolio?includeHidden=true  200  14ms',
      '11:05:17 [vite] hmr update /src/pages/Portfolio.tsx (x2)',
      'POST /api/portfolio        201  22ms',
      'GET /api/portfolio         200  11ms',
      '11:06:03 [vite] hmr update /src/pages/ProjectDetail.tsx',
      'GET /api/portfolio/4       200   8ms',
      'POST /api/contact          429 Too Many Requests',
      'GET /api/health            200   2ms',
      '11:06:55 [vite] hmr update /src/components/Layout.tsx',
      '11:06:55 [vite] ✓ 1 module transformed.',
      'GET /api/cv                200  19ms',
    ],
  },

  test: {
    label: 'vitest',
    sequences: [
      [
        { cmd: 'npx vitest run', out: ['', '  DEV  v1.6.0', '', ' ✓ src/terminal/__tests__/commands.test.ts (42)', '   ✓ help command returns all commands', '   ✓ ls lists directory contents', '   ✓ cd changes working directory', '   ✓ theme cycles through themes', '   ✓ whoami returns user', '   ... 37 more', '', ' ✓ src/terminal/__tests__/TerminalApp.test.tsx (27)', '   ✓ renders initial prompt', '   ✓ handles keyboard input', '   ... 25 more', '', 'Test Files  2 passed (2)', '     Tests  69 passed (69)', '   Duration  1.84s'], pause: 2000 },
      ],
      [
        { cmd: 'npx vitest --coverage', out: ['', 'File                 | % Stmts | % Branch | % Lines', '---------------------|---------|----------|--------', 'All files            |   94.3  |   88.1   |  94.3  ', '  commands/          |   97.2  |   91.4   |  97.2  ', '  components/        |   91.8  |   84.2   |  91.8  ', '  hooks/             |   94.1  |   87.5   |  94.1  ', ''], pause: 1500 },
        { cmd: 'npx vitest watch --reporter verbose', out: ['', ' WATCH  waiting for file changes...', '', 'press q to quit'] },
      ],
    ],
  },

  docker: {
    label: 'docker',
    sequences: [
      [
        { cmd: 'docker build -t portfolio-backend .', out: ['[+] Building 14.3s (12/12) FINISHED', '=> [1/7] FROM python:3.11-slim', '=> [2/7] WORKDIR /app', '=> [3/7] COPY requirements.txt .', '=> [4/7] RUN pip install -r requirements.txt', '=> [5/7] COPY . .', '=> [6/7] EXPOSE 5000', '=> [7/7] CMD ["gunicorn", "run:app"]', '=> exporting to image', 'Successfully built portfolio-backend:latest'], pause: 1000 },
        { cmd: 'docker ps', out: ['CONTAINER ID   IMAGE                STATUS         PORTS', 'a4f2c1d9e8b7   portfolio-backend   Up 2 minutes   0.0.0.0:5000->5000', 'b8e4a2f3c1d0   postgres:15         Up 2 minutes   5432/tcp'] },
        { cmd: 'docker logs portfolio-backend --tail 10', out: ['[2026-02-21 11:04:12] INFO  Starting gunicorn 21.2.0', '[2026-02-21 11:04:12] INFO  Listening at: http://0.0.0.0:5000', '[2026-02-21 11:04:12] INFO  Worker booted (pid: 8)', '[2026-02-21 11:04:31] INFO  GET /api/health 200', '[2026-02-21 11:04:38] INFO  POST /api/auth/google 200', '[2026-02-21 11:05:02] INFO  GET /api/portfolio 200'], pause: 1800 },
      ],
      [
        { cmd: 'docker-compose up -d', out: ['Creating network "backend_default" with the default driver', 'Creating backend_db_1     ... done', 'Creating backend_web_1    ... done'] },
        { cmd: 'docker-compose ps', out: ['Name                 Command               State   Ports', 'backend_db_1    docker-entrypoint.sh postgres  Up    5432/tcp', 'backend_web_1   gunicorn run:app               Up    0.0.0.0:5000->5000/tcp'] },
        { cmd: 'docker stats --no-stream', out: ['CONTAINER       CPU %   MEM USAGE / LIMIT     MEM %', 'portfolio-backend  0.8%   78.3MiB / 512MiB     15.3%', 'postgres:15         0.2%   41.7MiB / 512MiB      8.1%'], pause: 1500 },
      ],
    ],
  },

  python: {
    label: 'python',
    sequences: [
      [
        { cmd: 'python scripts/migrate_data.py', out: ['Connecting to database...', '✓ Connected to postgres://localhost:5432/portfolio', '', 'Running migrations...', '[1/3] Adding content column... ✓', '[2/3] Indexing display_order... ✓', '[3/3] Updating timestamps... ✓', '', 'Migrated 8 rows in 0.14s'], pause: 1200 },
      ],
      [
        { cmd: 'python -m pytest tests/ -v --tb=short', out: ['========================= test session starts ==========================', 'platform linux -- Python 3.11.4, pytest-7.4.0', 'collected 34 items', '', 'tests/test_portfolio.py::test_get_projects PASSED       [  5%]', 'tests/test_portfolio.py::test_create_project PASSED     [ 11%]', 'tests/test_portfolio.py::test_delete_project PASSED     [ 17%]', 'tests/test_auth.py::test_google_oauth PASSED            [ 23%]', 'tests/test_auth.py::test_jwt_refresh PASSED             [ 29%]', 'tests/test_contact.py::test_submit_form PASSED          [ 35%]', 'tests/test_contact.py::test_rate_limiting PASSED        [ 41%]', '', '========================= 34 passed in 2.18s =========================='], pause: 2000 },
      ],
      [
        { cmd: 'python -c "from app import create_app; print(create_app().config)"', out: ["{'ENV': 'production', 'DEBUG': False, 'SECRET_KEY': '***', 'DATABASE_URL': 'postgres://...', 'STORAGE_TYPE': 's3'}"] },
        { cmd: 'flask db upgrade', out: ['INFO  [alembic.runtime.migration] Running upgrade 006 -> 007, add content to project'] },
      ],
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Zone-based spread: 5 cols × 3 rows = 15 zones
// Weights push terminals to the edges/corners and away from the centered page content.
//   col 0 → far left / sidebar area    — near-zero
//   col 1 → left-center content area   — very low
//   col 2 → center content area        — very low
//   col 3 → right-center              — medium
//   col 4 → far right edge            — high
//   row 0 → top strip                 — high (above content fold)
//   row 1 → middle strip              — low  (main content lives here)
//   row 2 → bottom strip              — high (below content fold)
const ZONE_COLS = 5;
const ZONE_ROWS = 3;
const zoneCounts = new Array(ZONE_COLS * ZONE_ROWS).fill(0);

function pickZone(): { zoneIdx: number; x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const zoneW = W / ZONE_COLS;
  const zoneH = H / ZONE_ROWS;

  const weights = zoneCounts.map((c, i) => {
    const col = i % ZONE_COLS;
    const row = Math.floor(i / ZONE_COLS);

    let base: number;
    if (col === 0)                        base = 0.04; // sidebar — almost never
    else if (col <= 2 && row === 1)       base = 0.08; // center-middle — page content
    else if (col === 3 && row === 1)      base = 0.35; // right-center-middle
    else if (col === 4)                   base = 2.2;  // far-right edge — preferred
    else if (row === 0 || row === 2)      base = 1.6;  // top / bottom strips
    else                                  base = 0.4;

    return Math.max(0.01, base / (c + 1));
  });

  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  let zoneIdx = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) { zoneIdx = i; break; }
  }

  const col = zoneIdx % ZONE_COLS;
  const row = Math.floor(zoneIdx / ZONE_COLS);

  return {
    zoneIdx,
    x: Math.max(8, col * zoneW + rnd(8, zoneW * 0.65)),
    y: Math.max(8, row * zoneH + rnd(8, zoneH * 0.55)),
  };
}

// ── Terminal pane session ─────────────────────────────────────────────────────
type SessionState =
  | 'init_pause' | 'show_prompt' | 'typing'
  | 'exec_pause' | 'outputting' | 'end_pause'
  | 'streaming' | 'done';

class TerminalPane {
  el: HTMLDivElement;
  private bodyEl: HTMLDivElement;
  private buf: string[] = [];
  private maxLines: number;
  private state: SessionState = 'init_pause';
  private timer = 0;
  private typeName: SessionType;
  private def: SessionDef;
  private seqIdx = 0;
  private cmdIdx = 0;
  private charIdx = 0;
  private outIdx = 0;
  private streamIdx = 0;
  private zoneIdx: number;
  private lifetime: number; // ms until forced close
  posX = 0;
  posY = 0;
  paneW = 0;
  paneH = 0;
  done = false;

  constructor(container: HTMLDivElement, types: SessionType[], color: string, existing: TerminalPane[]) {
    this.typeName = pick(types);
    this.def = SESSIONS[this.typeName];

    const font = pick(MONO_FONTS);
    const fontSize = pick(FONT_SIZES_PX);
    const w = Math.round(rnd(240, 430));
    const h = Math.round(rnd(130, 270));

    // Try up to 12 zone picks to find a non-overlapping position
    let cx = 0, cy = 0, chosenZone = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      const { zoneIdx, x, y } = pickZone();
      const maxX = Math.max(10, window.innerWidth  - w - 10);
      const maxY = Math.max(10, window.innerHeight - h - 10);
      const candX = Math.min(x, maxX);
      const candY = Math.min(y, maxY);
      const overlaps = existing.some(p =>
        candX < p.posX + p.paneW && candX + w > p.posX &&
        candY < p.posY + p.paneH && candY + h > p.posY
      );
      cx = candX; cy = candY; chosenZone = zoneIdx;
      if (!overlaps) break;
    }

    this.posX = cx; this.posY = cy; this.paneW = w; this.paneH = h;
    this.zoneIdx = chosenZone;
    zoneCounts[chosenZone]++;

    this.maxLines = Math.ceil(h / (fontSize * 1.5)) + 3;

    // Build DOM
    this.el = document.createElement('div');
    this.el.style.cssText = `
      position:absolute; left:${cx}px; top:${cy}px;
      width:${w}px; height:${h}px; overflow:hidden;
      border:1px solid ${color}2a; border-radius:6px;
      opacity:0; transition:opacity 0.7s ease; pointer-events:none;
      display:flex; flex-direction:column;
    `;

    const bar = document.createElement('div');
    bar.style.cssText = `
      height:18px; background:${color}10; border-bottom:1px solid ${color}1a;
      display:flex; align-items:center; padding:0 7px; gap:4px;
      flex-shrink:0; font-family:${font.css}; font-size:8.5px; color:${color}65;
      white-space:nowrap;
    `;
    bar.innerHTML = `
      <span style="width:6px;height:6px;border-radius:50%;background:${color}35;flex-shrink:0"></span>
      <span style="width:6px;height:6px;border-radius:50%;background:${color}35;flex-shrink:0"></span>
      <span style="width:6px;height:6px;border-radius:50%;background:${color}35;flex-shrink:0"></span>
      <span style="flex:1;text-align:center;overflow:hidden;text-overflow:ellipsis">${this.def.label} — ${font.name}</span>
    `;

    this.bodyEl = document.createElement('div');
    this.bodyEl.style.cssText = `
      font-family:${font.css}; font-size:${fontSize}px; line-height:1.5;
      color:${color}; white-space:pre; overflow:hidden;
      padding:5px 8px; flex:1; word-break:break-all;
    `;

    this.el.appendChild(bar);
    this.el.appendChild(this.bodyEl);
    container.appendChild(this.el);

    // Fade in after next paint
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.el.style.opacity = String(TARGET_OPACITY);
    }));

    // Start state machine — short initial pause so panes are active immediately
    this.timer = rnd(50, 300);

    if (this.def.streaming) {
      this.state = 'streaming';
      this.streamIdx = Math.floor(Math.random() * (this.def.lines?.length ?? 1));
    } else {
      this.seqIdx = Math.floor(Math.random() * (this.def.sequences?.length ?? 1));
    }

    this.lifetime = rnd(5000, 12000);
  }

  private get seq() { return this.def.sequences![this.seqIdx]; }
  private get cmd() { return this.seq[this.cmdIdx]; }

  private addLine(s: string) {
    this.buf.push(s);
    if (this.buf.length > this.maxLines) this.buf.shift();
  }

  private render() {
    this.bodyEl.textContent = this.buf.join('\n');
  }

  update(dt: number): boolean {
    if (this.done) return false;

    this.lifetime -= dt;
    if (this.lifetime <= 0) { this.done = true; return false; }

    this.timer -= dt;
    if (this.timer > 0) return false;

    switch (this.state) {
      case 'init_pause':
        this.addLine('');
        this.state = 'show_prompt';
        this.timer = 150;
        break;

      case 'show_prompt':
        this.addLine('$ ');
        this.charIdx = 0;
        this.state = 'typing';
        this.timer = 100 * SPEED_MULT + Math.random() * 150;
        break;

      case 'typing': {
        const full = this.cmd.cmd;
        if (this.charIdx >= full.length) {
          this.buf[this.buf.length - 1] = '$ ' + full;
          this.state = 'exec_pause';
          this.timer = 60 + Math.random() * 120;
          break;
        }
        const ch = full[this.charIdx++];
        this.buf[this.buf.length - 1] = '$ ' + full.slice(0, this.charIdx);

        let delay = ch === ' ' ? 55 + Math.random() * 80
          : (ch === '-' || ch === '/') ? 35 + Math.random() * 60
          : 18 + Math.random() * 48;
        if (Math.random() < 0.04) delay += 250 + Math.random() * 500; // rare pause
        this.timer = delay * SPEED_MULT;
        break;
      }

      case 'exec_pause':
        this.outIdx = 0;
        if (!this.cmd.out.length) { this.finishCmd(); break; }
        this.state = 'outputting';
        this.timer = 50 + Math.random() * 80;
        break;

      case 'outputting':
        if (this.outIdx >= this.cmd.out.length) { this.finishCmd(); break; }
        this.addLine(this.cmd.out[this.outIdx++]);
        const isSlowLine = this.cmd.out[this.outIdx - 1].includes('...') || this.cmd.out[this.outIdx - 1] === '';
        this.timer = (isSlowLine ? 160 : 50 + Math.random() * 70) * SPEED_MULT;
        break;

      case 'end_pause':
        this.state = 'show_prompt';
        this.timer = 250;
        break;

      case 'streaming': {
        const lines = this.def.lines!;
        this.addLine(lines[this.streamIdx % lines.length]);
        this.streamIdx++;
        // burst occasionally, otherwise a short pause between log lines
        this.timer = Math.random() < 0.18
          ? 60 + Math.random() * 100
          : 500 + Math.random() * 1200;
        break;
      }

      case 'done':
        this.done = true;
        break;
    }

    this.render();
    return true;
  }

  private finishCmd() {
    const pauseMs = this.cmd.pause ?? 0;
    this.cmdIdx++;
    if (this.cmdIdx >= this.seq.length) {
      // Sequence done — pick a new one and continue (lifetime controls exit)
      this.cmdIdx = 0;
      this.seqIdx = Math.floor(Math.random() * this.def.sequences!.length);
      this.addLine('');
      this.state = 'init_pause';
      this.timer = 300 + Math.random() * 500 + pauseMs;
    } else {
      this.addLine('');
      this.state = 'end_pause';
      this.timer = (pauseMs || 250) + Math.random() * 350;
    }
  }

  close(onDone: () => void) {
    this.el.style.opacity = '0';
    zoneCounts[this.zoneIdx] = Math.max(0, zoneCounts[this.zoneIdx] - 1);
    setTimeout(() => { this.el.remove(); onDone(); }, 700);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const ALL_TYPES: SessionType[] = ['git', 'build', 'server', 'test', 'docker', 'python'];

const TerminalBackground: React.FC = () => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset zone counts
    zoneCounts.fill(0);

    const color = theme === 'dark' ? COLOR_DARK : COLOR_LIGHT;
    const panes: TerminalPane[] = [];
    let rafId: number;
    let lastT = performance.now();
    let spawnScheduled = 0;

    function spawnPane() {
      if (panes.length >= MAX_PANES) return;
      const pane = new TerminalPane(container!, ALL_TYPES, color, panes);
      panes.push(pane);
    }

    function scheduleRespawn() {
      if (spawnScheduled >= 3) return; // cap pending spawns
      spawnScheduled++;
      const delay = rnd(300, 2000);
      setTimeout(() => {
        spawnScheduled--;
        if (panes.length < MIN_PANES) spawnPane();
        else if (panes.length < TARGET_PANES && Math.random() < 0.7) spawnPane();
      }, delay);
    }

    // Initial staggered spawn
    for (let i = 0; i < TARGET_PANES; i++) {
      setTimeout(() => spawnPane(), i * rnd(150, 400));
    }

    function tick(ts: number) {
      const dt = Math.min(ts - lastT, 80);
      lastT = ts;

      for (let i = panes.length - 1; i >= 0; i--) {
        panes[i].update(dt);
        if (panes[i].done) {
          const pane = panes.splice(i, 1)[0];
          pane.close(() => scheduleRespawn());
        }
      }

      // Keep pool topped up
      if (panes.length < MIN_PANES && spawnScheduled === 0) scheduleRespawn();

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      while (container.firstChild) container.removeChild(container.firstChild);
      zoneCounts.fill(0);
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

export default TerminalBackground;
