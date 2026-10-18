/**
 * One numbered landing section: the scroll anchor, the translucent panel, and the heading
 * block (mono index, uppercase H2, optional right-hand aside and lede).
 *
 * The panel sits at 93% opacity so the live field shows through faintly, and carries
 * `data-panel="1"` — the field's click handler reads that to tell a click aimed at content
 * from one aimed at the simulation. `data-field="1"` marks the opposite: the surrounding
 * area where a click does reach the field.
 */
import type { ReactNode } from 'react';

interface SectionProps {
  /** Anchor id; also the nav href target. */
  id: string;
  /** `01`–`04`. */
  index: string;
  title: string;
  /** Rendered at the far right of the heading row (a link, a location, …). */
  aside?: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Section({ id, index, title, aside, lede, children, className = '' }: SectionProps) {
  return (
    <section id={id} data-field="1" className={`pt-[clamp(64px,22vh,240px)] scroll-mt-[60px] ${className}`}>
      <div
        data-panel="1"
        className="border border-ln2 p-[clamp(20px,3.2vw,44px)] cursor-auto"
        style={{ background: 'color-mix(in oklab, var(--bg) 93%, transparent)' }}
      >
        <div className="flex items-baseline justify-between gap-6 flex-wrap mb-3">
          <div className="flex items-baseline gap-3 sm:gap-5">
            <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.08em]">
              {index}
            </span>
            <h2
              className="m-0 uppercase text-ink"
              style={{
                fontFamily: "'Archivo', sans-serif",
                fontStretch: '125%',
                fontWeight: 700,
                fontSize: 'clamp(32px,5vw,68px)',
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              {title}
            </h2>
          </div>
          {aside}
        </div>

        {lede && (
          <p className="m-0 mb-6 sm:ml-[52px] max-w-[60ch] text-[17px] leading-[1.55] text-ink2 [text-wrap:pretty]">
            {lede}
          </p>
        )}

        {children}
      </div>
    </section>
  );
}
