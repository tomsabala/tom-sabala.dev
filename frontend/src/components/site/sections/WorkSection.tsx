/**
 * 01 · Selected work. One row per visible project, linking to `/work/<slug>`. The specimen
 * canvas sits to the right on desktop and above the text on a phone, where a 220px canvas
 * next to 62ch of prose does not fit.
 */
import { Link } from 'react-router-dom';
import type { PortfolioItem } from '../../../types/index.ts';
import Panel from '../Panel.tsx';
import SectionHeading from '../SectionHeading.tsx';
import SpecimenCanvas from '../SpecimenCanvas.tsx';

interface WorkSectionProps {
  projects: PortfolioItem[];
  loading: boolean;
  error: string;
}

export default function WorkSection({ projects, loading, error }: WorkSectionProps) {
  return (
    <section id="work" data-field="1" className="pt-[clamp(64px,22vh,240px)] scroll-mt-[60px]">
      <Panel>
        <SectionHeading
          index="01"
          title="Selected work"
          lede="Planners, polygons, agents with guardrails, and one chess engine. Each specimen on the right is drawn by the same kind of algorithm the project is about."
        />
        <div className="flex flex-col">
          {loading && (
            <p className="m-0 py-8 font-mono text-[12px] text-mut">Loading projects…</p>
          )}
          {!loading && error && (
            <p className="m-0 py-8 font-mono text-[12px] text-mut">{error}</p>
          )}
          {!loading && !error && projects.length === 0 && (
            <p className="m-0 py-8 font-mono text-[12px] text-mut">No projects published yet.</p>
          )}
          {projects.map((p, i) => (
            <Link
              key={p.id}
              to={p.slug ? `/work/${p.slug}` : `/work/${p.id}`}
              className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-5 md:gap-x-8 py-6 md:py-[30px] px-3 -mx-3 border-b border-ln no-underline text-ink hover:bg-s1"
            >
              <span className="hidden md:block flex-[0_0_40px] font-mono text-[12px] leading-none font-medium text-mut">
                {String(i + 1).padStart(2, '0')}
              </span>

              <SpecimenCanvas
                glyph={p.specimen}
                slug={p.slug ?? String(p.id)}
                className="md:hidden w-full h-[140px] order-first"
              />

              <div className="flex-1 md:flex-[1_1_360px] min-w-0 flex flex-col gap-3">
                <div className="flex items-baseline gap-x-4 gap-y-2 flex-wrap">
                  <span className="md:hidden font-mono text-[12px] leading-none font-medium text-mut">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="leading-none"
                    style={{
                      fontFamily: "'Archivo', sans-serif",
                      fontStretch: '112%',
                      fontWeight: 700,
                      fontSize: 'clamp(26px,3vw,40px)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {p.title}
                  </span>
                  {p.field && (
                    <span className="font-mono text-[11px] leading-none text-acct tracking-[0.1em] uppercase">
                      {p.field}
                    </span>
                  )}
                </div>
                <p className="m-0 max-w-[62ch] text-[16px] leading-[1.55] text-ink2 [text-wrap:pretty]">
                  {p.description}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {p.technologies.map(t => (
                    <span
                      key={t}
                      className="font-mono text-[11px] leading-none text-mut border border-ln px-2 py-1.5 tracking-[0.04em]"
                    >
                      {t}
                    </span>
                  ))}
                  {p.accessLabel && (
                    <span className="font-mono text-[11px] leading-none text-ink2 py-1.5 tracking-[0.04em]">
                      · {p.accessLabel}
                    </span>
                  )}
                </div>
              </div>

              <SpecimenCanvas
                glyph={p.specimen}
                slug={p.slug ?? String(p.id)}
                className="hidden md:block flex-[0_0_220px] w-[220px] h-[124px]"
              />

              <span className="hidden md:block flex-[0_0_24px] font-mono text-[20px] leading-none text-acct">→</span>
            </Link>
          ))}
        </div>
      </Panel>
    </section>
  );
}
