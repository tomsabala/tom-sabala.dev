/**
 * Radar-chart geometry, ported verbatim from `radar(cat)` in the design prototype
 * (`Portfolio Home.dc.html`). Everything is computed in a fixed 400×300 viewBox and the
 * axis labels come back as percentage offsets, so the SVG scales with its container and
 * the absolutely-positioned labels follow it without measuring anything.
 */
import type { SkillCategory } from './skills.ts';

/** One axis label: a position, a transform that keeps it clear of the polygon, and the value. */
export interface RadarLabel {
  left: string;
  top: string;
  tf: string;
  /** Skill name. */
  t: string;
  /** Level, as a string, because it is rendered verbatim. */
  v: string;
  /** flex `align-items` for the two-line label stack. */
  al: 'flex-start' | 'flex-end' | 'center';
}

export interface Radar {
  name: string;
  /** Concentric grid rings at 25 / 50 / 75 / 100 % of the radius. */
  ring0: string;
  ring1: string;
  ring2: string;
  ring3: string;
  /** Spokes, as one `M…L…` path. */
  axes: string;
  /** The skill polygon itself. */
  poly: string;
  /** Vertex squares, as one filled path. */
  dots: string;
  /** One entry per skill, in the same order. */
  labels: RadarLabel[];
}

export function radar(cat: SkillCategory): Radar {
  const n = cat.skills.length;
  const cx = 200;
  const cy = 150;
  const R = 78;
  const f = (v: number) => v.toFixed(1);
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const ring = (k: number) =>
    cat.skills.map((_, i) => pt(i, R * k).map(f).join(',')).join(' ');

  const labels: RadarLabel[] = cat.skills.map((s, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const c = Math.cos(a);
    const [x, y] = pt(i, R + 16);
    return {
      left: ((x / 400) * 100).toFixed(2) + '%',
      top: (((y + Math.sin(a) * 4) / 300) * 100).toFixed(2) + '%',
      tf: `translate(${c > 0.3 ? '0' : c < -0.3 ? '-100%' : '-50%'},-50%)`,
      t: s.name,
      v: String(s.level),
      al: c > 0.3 ? 'flex-start' : c < -0.3 ? 'flex-end' : 'center',
    };
  });

  return {
    name: cat.name,
    ring0: ring(0.25),
    ring1: ring(0.5),
    ring2: ring(0.75),
    ring3: ring(1),
    axes: cat.skills
      .map((_, i) => {
        const [x, y] = pt(i, R);
        return `M${cx} ${cy}L${f(x)} ${f(y)}`;
      })
      .join(''),
    poly: cat.skills
      .map((s, i) => pt(i, (R * s.level) / 100).map(f).join(','))
      .join(' '),
    dots: cat.skills
      .map((s, i) => {
        const [x, y] = pt(i, (R * s.level) / 100);
        return `M${f(x - 2.5)} ${f(y - 2.5)}h5v5h-5z`;
      })
      .join(''),
    labels,
  };
}
