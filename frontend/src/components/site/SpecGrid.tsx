/**
 * The bordered key/value grid used by hangar cards, project facts and app specs.
 * Keys are muted mono, values inherit ink; a value may be a node (a link, a bar, a dash).
 */
import type { ReactNode } from 'react';

export interface SpecRow {
  k: string;
  v: ReactNode;
}

interface SpecGridProps {
  rows: SpecRow[];
  /** `rail` = two columns (label, value); `cards` = auto-fit bordered tiles. */
  variant?: 'rail' | 'cards';
  className?: string;
}

export default function SpecGrid({ rows, variant = 'rail', className = '' }: SpecGridProps) {
  if (variant === 'cards') {
    return (
      <div
        className={`grid gap-px bg-ln border border-ln ${className}`}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}
      >
        {rows.map(row => (
          <div key={row.k} className="bg-bg p-4 flex flex-col gap-2">
            <span className="font-mono text-[10px] leading-none tracking-[0.12em] uppercase text-mut">
              {row.k}
            </span>
            <span className="font-mono text-[14px] leading-tight text-ink break-words">{row.v}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid gap-y-[9px] gap-x-[18px] font-mono text-[12px] leading-[1.3] ${className}`}
      style={{ gridTemplateColumns: 'auto 1fr' }}
    >
      {rows.map(row => (
        <div key={row.k} className="contents">
          <span className="text-mut">{row.k}</span>
          <span className="text-ink min-w-0 break-words">{row.v}</span>
        </div>
      ))}
    </div>
  );
}
