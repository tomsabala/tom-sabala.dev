/**
 * The translucent bordered surface every landing section sits on. 93% opacity lets the
 * live field show through faintly; `data-panel="1"` is what the field's click handler looks
 * for to know a click was aimed at content, not at the simulation.
 */
import type { CSSProperties, ReactNode } from 'react';

interface PanelProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export default function Panel({ children, className = '', style }: PanelProps) {
  return (
    <div
      data-panel="1"
      className={`border border-ln2 p-[clamp(20px,3.2vw,44px)] cursor-auto ${className}`}
      style={{ background: 'color-mix(in oklab, var(--bg) 93%, transparent)', ...style }}
    >
      {children}
    </div>
  );
}
