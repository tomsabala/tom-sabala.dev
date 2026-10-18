/**
 * Numbered section heading: a mono index in the accent tint, the uppercase ultra-wide
 * Archivo H2, an optional right-hand aside, and an indented lede paragraph.
 */
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  /** `01`–`04`. */
  index: string;
  title: string;
  /** Rendered at the far right of the heading row (a link, a location, …). */
  aside?: ReactNode;
  lede?: ReactNode;
}

export default function SectionHeading({ index, title, aside, lede }: SectionHeadingProps) {
  return (
    <>
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
    </>
  );
}
