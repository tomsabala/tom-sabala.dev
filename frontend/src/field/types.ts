/**
 * Shared types for the live field engine.
 *
 * The maths behind every algorithm is ported verbatim from the
 * `<script type="text/x-dc">` block of the `Portfolio Home` design prototype;
 * this file only replaces the prototype's mutable `this.S` / `this.state.cfg`
 * with an explicit, typed contract.
 */

export type FieldKind = 'planner' | 'voronoi' | 'lidar' | 'arm';

export type FieldTool = 'add' | 'remove';

export interface Pt {
  x: number;
  y: number;
}

/** Where the field is being "aimed": hover on fine pointers, last tap on coarse ones. */
export interface FieldPointer {
  x: number;
  y: number;
  /** False until the visitor has moved/tapped — the field idles on an auto-drift until then. */
  active: boolean;
}

/** Canvas palette, read from the `data-theme` attribute on `<html>`. */
export interface Pal {
  /** `r,g,b` triplet, fed to `A()`. */
  acc: string;
  mut: string;
  ink: string;
  bg: string;
  s1: string;
  ln: string;
  ln2: string;
  /** Opacity multiplier — light mode needs stronger alphas than dark. */
  k: number;
}

/** One algorithm's slider/toggle values, keyed by `SETTINGS`/`TOGGLES` entries. */
export type FieldCfg = Record<string, number | boolean>;

/**
 * Per-device work ceilings. Desktop values reproduce the prototype exactly;
 * phones get the reduced budgets from the redesign plan's "Mobile design".
 */
export interface FieldCaps {
  /** RRT* node ceiling (desktop: `Infinity`, i.e. the prototype's `w*h/420`). */
  maxNodes: number;
  /** Upper bound on the samples-per-frame slider. */
  samplesPerFrame: number;
  /** Voronoi site ceiling at init and on "+ Site". */
  maxSites: number;
  /** LiDAR point-cloud memory ceiling. */
  maxPoints: number;
  /** Rebuild the Delaunay triangulation every other frame instead of every frame. */
  cheapTriangulation: boolean;
}

export interface FieldStepCtx {
  /** Seconds since the page's first animation frame. */
  t: number;
  pointer: FieldPointer;
  cfg: FieldCfg;
  caps: FieldCaps;
}

export interface FieldTapCtx {
  cfg: FieldCfg;
  caps: FieldCaps;
  w: number;
  h: number;
  setCfg: (key: string, value: number | boolean, regen?: boolean) => void;
}

export interface FieldAlgo<S> {
  kind: FieldKind;
  init(w: number, h: number, cfg: FieldCfg, caps: FieldCaps): S;
  step(
    g: CanvasRenderingContext2D,
    w: number,
    h: number,
    pal: Pal,
    s: S,
    ctx: FieldStepCtx,
  ): void;
  hud(s: S, pointer: FieldPointer): string;
  onTap(s: S, x: number, y: number, tool: FieldTool, ctx: FieldTapCtx): void;
}
