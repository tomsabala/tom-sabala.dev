/**
 * Field configuration, ported verbatim from `Portfolio Home.dc.html`:
 * `ALGOS`, `NAMES`, `CFG0`, `SETTINGS`, `TOGGLES`, `TOOLS`, `LEARN`, `HINTS`.
 *
 * The only edit to the prototype's data is `LEARN[*].relHref`, which pointed at
 * the prototype file (`Project%20Detail.dc.html?p=mlmp`) and now points at the
 * real route (`/work/mlmp`).
 */

import type { FieldCaps, FieldCfg, FieldKind, FieldTool } from './types';

export const ALGOS: Array<[FieldKind, string]> = [
  ['planner', 'RRT*'],
  ['voronoi', 'Voronoi'],
  ['lidar', 'LiDAR'],
  ['arm', 'IK arm'],
];

export const NAMES: Record<FieldKind, string> = {
  planner: 'RRT* PLANNER',
  voronoi: 'DELAUNAY / VORONOI',
  lidar: 'LIDAR ROVER',
  arm: 'FABRIK ARM',
};

const CFG0: Record<FieldKind, FieldCfg> = {
  planner: { step: 24, rate: 30, density: 1, tree: true, rover: true },
  voronoi: { drift: 16, density: 1, tri: true, circ: true },
  lidar: { range: 300, speed: 0.8, persist: 7, rays: true, trail: true },
  arm: { dof: 4, follow: 0.14, ws: true, trail: true },
};

export interface FieldSetting {
  k: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Changing this drops the simulation state so the next frame re-inits. */
  regen?: boolean;
}

export const SETTINGS: Record<FieldKind, FieldSetting[]> = {
  planner: [
    { k: 'step', label: 'Step size', min: 8, max: 48, step: 1, unit: ' px' },
    { k: 'rate', label: 'Samples per frame', min: 2, max: 80, step: 1, unit: '' },
    { k: 'density', label: 'Obstacle density', min: 0.25, max: 3, step: 0.25, unit: '×', regen: true },
  ],
  voronoi: [
    { k: 'drift', label: 'Site drift', min: 0, max: 60, step: 1, unit: ' px/s' },
    { k: 'density', label: 'Site density', min: 0.25, max: 3, step: 0.25, unit: '×', regen: true },
  ],
  lidar: [
    { k: 'range', label: 'Sensor range', min: 120, max: 480, step: 10, unit: ' px' },
    { k: 'speed', label: 'Spin rate', min: 0.2, max: 4, step: 0.1, unit: ' Hz' },
    { k: 'persist', label: 'Point memory', min: 1, max: 15, step: 1, unit: ' s' },
  ],
  arm: [
    { k: 'dof', label: 'Joints (DOF)', min: 2, max: 8, step: 1, unit: '', regen: true },
    { k: 'follow', label: 'Servo gain', min: 0.02, max: 0.4, step: 0.01, unit: '' },
  ],
};

export interface FieldToggle {
  k: string;
  label: string;
}

export const TOGGLES: Record<FieldKind, FieldToggle[]> = {
  planner: [
    { k: 'tree', label: 'Show tree' },
    { k: 'rover', label: 'Show rover' },
  ],
  voronoi: [
    { k: 'tri', label: 'Delaunay edges' },
    { k: 'circ', label: 'Circumcircle' },
  ],
  lidar: [
    { k: 'rays', label: 'Show rays' },
    { k: 'trail', label: 'Odometry' },
  ],
  arm: [
    { k: 'ws', label: 'Workspace' },
    { k: 'trail', label: 'EE trail' },
  ],
};

/** `[addLabel, removeLabel]`, indexed by `FieldTool`. */
export const TOOLS: Record<FieldKind, [string, string]> = {
  planner: ['+ Obstacle', '− Obstacle'],
  voronoi: ['+ Site', '− Site'],
  lidar: ['+ Crate', '− Crate'],
  arm: ['+ Joint', '− Joint'],
};

export const TOOL_ORDER: FieldTool[] = ['add', 'remove'];

export interface LearnEntry {
  title: string;
  lede: string;
  read: string;
  code: string;
  rel: string;
  relHref: string;
}

export const LEARN: Record<FieldKind, LearnEntry> = {
  planner: {
    title: 'RRT*: a tree that rewires itself',
    lede: 'A sampling-based motion planner. Every frame it throws random samples into the space, grows the tree one short step toward each, and rewires nearby branches whenever a cheaper route to a node shows up. That rewiring is the asterisk: with enough samples the path converges toward the shortest one.',
    read: 'Faint lines are the tree. Bright lines are the newest growth. The bold line is the current best path from START to your cursor, and the little box is a rover driving it. Drop obstacles and watch it re-plan.',
    code: 'q_rand ← sample()\nq_near ← nearest(T, q_rand)\nq_new  ← steer(q_near, q_rand, step)\nif collision_free(q_near, q_new):\n    parent ← cheapest_neighbor(q_new)\n    T.add(q_new, parent)\n    rewire(neighbors(q_new))',
    rel: 'Used in: MLMP, multi-level planners built on this idea →',
    relHref: '/work/mlmp',
  },
  voronoi: {
    title: 'Voronoi & Delaunay: who owns the plane',
    lede: 'Every site owns the region of the plane that is closer to it than to any other site. That partition is the Voronoi diagram. Its dual, the Delaunay triangulation, connects sites whose regions touch, and no site ever sits inside a Delaunay triangle’s circumcircle.',
    read: 'Your cursor is a site. The outlined polygon is your cell. Dashed lines go to your Delaunay neighbours, and the ring is one of your empty circumcircles. Plant or remove sites and the whole partition re-flows.',
    code: 'T ← super_triangle()\nfor p in sites:\n    bad  ← {t ∈ T : p inside circumcircle(t)}\n    hole ← boundary_edges(bad)\n    T ← (T − bad) ∪ {(e, p) : e ∈ hole}\nvoronoi ← join circumcenters of adjacent triangles',
    rel: 'Used in: CGEO, my computational geometry toolkit →',
    relHref: '/work/cgeo',
  },
  lidar: {
    title: '2D LiDAR: seeing the world as points',
    lede: 'A spinning range sensor fires beams and records where each one lands. The crates and walls here are never drawn. They exist only as geometry the beams can hit, so you see the room the way the rover does, as a fading point cloud.',
    read: 'The ring is the sensor range and the wedge is the beam sweeping. Lime dots are returns, fading with age. Move your cursor to set a waypoint; the rover steers toward it and stops at obstacles. Real stacks feed scans like this into SLAM.',
    code: 'for θ in sweep(beam, beam + Δθ):\n    r ← min(ray(pose, θ) ∩ segments)\n    if r < range:\n        cloud.add(pose + r·(cos θ, sin θ))\ncloud.forget(older_than = memory)\npose ← steer(waypoint) unless blocked',
    rel: 'More autonomy-flavoured work in Selected work →',
    relHref: '/#work',
  },
  arm: {
    title: 'FABRIK: inverse kinematics without trig',
    lede: 'Forward And Backward Reaching IK solves for joint positions with nothing but vector math. Drag the end effector to the target and pull each link along behind it, then pin the base back and push forward again. A dozen iterations per frame is plenty.',
    read: 'θ labels are relative joint angles. The dashed arc is the reachable workspace; outside it the arm simply stretches toward you. Add joints to see redundancy at work: more DOF, more ways to reach the same point.',
    code: 'repeat k times:\n    J[n] ← target\n    for i = n−1 … 0:  J[i]   ← J[i+1] + L·dir(J[i+1] → J[i])\n    J[0] ← base\n    for i = 0 … n−1:  J[i+1] ← J[i]   + L·dir(J[i] → J[i+1])',
    rel: 'Used in: MLMP, planning for 2D kinematic chains →',
    relHref: '/work/mlmp',
  },
};

export const HINTS: Record<FieldKind, string> = {
  planner: 'Move · set goal   Click · drop obstacle',
  voronoi: 'Move · you are a site   Click · plant one',
  lidar: 'Move · drive the rover   Click · drop a crate',
  arm: 'Move · reach   Click · add a joint',
};

/** Touch-flavoured variants of `HINTS`: there is no hover on a coarse pointer. */
export const TOUCH_HINTS: Record<FieldKind, string> = {
  planner: 'Tap · set goal   Arm a tool · drop obstacle',
  voronoi: 'Tap · move your site   Arm a tool · plant one',
  lidar: 'Tap · set waypoint   Arm a tool · drop a crate',
  arm: 'Tap · reach   Arm a tool · add a joint',
};

/** Desktop budgets reproduce the prototype exactly; phones get the reduced ones. */
export function fieldCaps(mobile: boolean): FieldCaps {
  return mobile
    ? {
        maxNodes: 1200,
        samplesPerFrame: 12,
        maxSites: 60,
        maxPoints: 3000,
        cheapTriangulation: true,
      }
    : {
        maxNodes: Infinity,
        samplesPerFrame: 80,
        maxSites: Infinity,
        maxPoints: 9000,
        cheapTriangulation: false,
      };
}

export function defaultCfg(): Record<FieldKind, FieldCfg> {
  return {
    planner: { ...CFG0.planner },
    voronoi: { ...CFG0.voronoi },
    lidar: { ...CFG0.lidar },
    arm: { ...CFG0.arm },
  };
}

/** Typed reads out of the loosely-typed per-algorithm config bag. */
export function num(cfg: FieldCfg, key: string, fallback: number): number {
  const v = cfg[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function bool(cfg: FieldCfg, key: string, fallback = false): boolean {
  const v = cfg[key];
  return typeof v === 'boolean' ? v : fallback;
}
