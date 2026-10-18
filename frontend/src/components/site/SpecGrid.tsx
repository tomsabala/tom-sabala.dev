/**
 * The label/value rail on a hangar card: muted mono keys in the first column, values in
 * the second. A value may be a node, so a row can carry a link or a dash.
 */
import type { ReactNode } from 'react';

interface SpecRow {
  k: string;
  v: ReactNode;
}

interface SpecGridProps {
  rows: SpecRow[];
  className?: string;
}

export default function SpecGrid({ rows, className = '' }: SpecGridProps) {
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
