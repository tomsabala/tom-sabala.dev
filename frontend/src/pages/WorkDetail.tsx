/**
 * `/work/:slug` — one project.
 *
 * The whole visible list is fetched once and `:slug` resolved client-side: the header tab
 * strip and the prev/next pair need every sibling anyway, so a per-slug endpoint would
 * only add a round trip. The deep-dive markdown is still fetched by id.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { getPortfolio, getProjectDeepDive } from '../repositories/portfolioRepository.ts';
import type { PortfolioItem, ProjectFact, ProjectStep } from '../types/index.ts';
import AnimatedSpecimen from '../work/AnimatedSpecimen.tsx';
import DeepDive, { type TocItem } from '../work/DeepDive.tsx';

/** `projects.slug` is unique, but a project predating the redesign can still fall back to its id. */
function projectPath(p: PortfolioItem): string {
  return `/work/${p.slug ?? p.id}`;
}

export default function WorkDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [projects, setProjects] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deepDive, setDeepDive] = useState<string | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    getPortfolio(isAuthenticated)
      .then(resp => {
        if (cancelled) return;
        setProjects(Array.isArray(resp?.data) ? resp.data : []);
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load projects.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading]);

  const index = useMemo(
    () => projects.findIndex(p => (p.slug ?? String(p.id)) === slug),
    [projects, slug],
  );
  const project = index >= 0 ? projects[index] : null;

  // Deep dive is keyed by project id, so it can only be fetched once the list resolved.
  useEffect(() => {
    setDeepDive(null);
    setToc([]);
    if (!project?.docsSlug) return;
    let cancelled = false;
    getProjectDeepDive(project.id)
      .then(resp => {
        if (cancelled || !resp?.success) return;
        setDeepDive(resp.content);
        setToc(Array.isArray(resp.toc) ? resp.toc : []);
      })
      .catch(() => { /* a project can be published before its deep dive is written */ });
    return () => { cancelled = true; };
  }, [project?.id, project?.docsSlug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-[12px] text-mut">Loading…</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="font-mono text-[12px] text-mut tracking-[0.12em] uppercase">404</span>
        <p className="m-0 text-[20px] text-ink2">{error || 'That project does not exist.'}</p>
        <Link
          to="/#work"
          className="bg-acc text-onacc no-underline font-mono text-[12px] leading-none uppercase tracking-[0.06em] px-5 py-3.5"
        >
          ← Back to the work
        </Link>
      </div>
    );
  }

  const total = String(projects.length).padStart(2, '0');
  const idx = String(index + 1).padStart(2, '0');
  const prev = projects[(index - 1 + projects.length) % projects.length];
  const next = projects[(index + 1) % projects.length];
  const facts: ProjectFact[] = project.facts ?? [];
  const steps: ProjectStep[] = project.steps ?? [];
  const rules: string[] = project.rules ?? [];
  const about: string[] = project.aboutParagraphs ?? [];

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage:
          'radial-gradient(color-mix(in oklab, var(--mut) 28%, transparent) 1px, transparent 1.2px)',
        backgroundSize: '40px 40px',
      }}
    >
      <header
        className="sticky top-0 z-30 border-b border-ln"
        style={{
          background: 'color-mix(in oklab, var(--bg) 88%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        <div className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)] py-3 flex items-center justify-between gap-4 flex-wrap">
          <Link to="/#work" className="flex items-center gap-3.5 no-underline text-ink shrink-0">
            <span className="w-[34px] h-[34px] border border-acct text-acct font-mono text-[12px] leading-none font-medium flex items-center justify-center">
              TS
            </span>
            <span className="font-mono text-[12px] leading-none font-medium text-mut tracking-[0.06em] uppercase">
              ← tom-sabala.dev / work
            </span>
          </Link>

          <nav className="flex items-center gap-2 overflow-x-auto whitespace-nowrap max-w-full -mx-1 px-1">
            {projects.map(p => {
              const current = p.id === project.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(projectPath(p))}
                  className="border border-ln2 px-[11px] py-[9px] font-mono text-[11px] leading-none font-medium tracking-[0.08em] uppercase cursor-pointer shrink-0"
                  style={{
                    background: current ? 'var(--ink)' : 'transparent',
                    color: current ? 'var(--bg)' : 'var(--ink)',
                  }}
                >
                  {p.title}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleTheme}
              className="border border-ln2 bg-transparent text-ink px-[11px] py-[9px] font-mono text-[11px] leading-none tracking-[0.06em] uppercase cursor-pointer ml-2 shrink-0"
            >
              {theme === 'dark' ? '◐ Light' : '◑ Dark'}
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)] pb-24">
        {/* Hero */}
        <section
          className="grid gap-10 items-end pt-[clamp(40px,7vw,96px)] pb-10"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))' }}
        >
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex gap-4 items-baseline flex-wrap font-mono text-[12px] leading-none font-medium tracking-[0.1em] uppercase">
              <span className="text-mut">{idx} / {total}</span>
              {project.field && <span className="text-acct">{project.field}</span>}
            </div>
            <h1
              className="m-0 uppercase [overflow-wrap:anywhere]"
              style={{
                fontFamily: "'Archivo', sans-serif",
                fontStretch: '125%',
                fontWeight: 800,
                fontSize: 'clamp(44px,9vw,148px)',
                lineHeight: 0.86,
                letterSpacing: '-0.035em',
              }}
            >
              {project.title}
            </h1>
            <p
              className="m-0 max-w-[52ch] text-ink2 [text-wrap:pretty]"
              style={{ fontSize: 'clamp(17px,1.6vw,22px)', lineHeight: 1.45 }}
            >
              {project.lede || project.description}
            </p>
            <div className="flex gap-3 flex-wrap">
              {project.github_url ? (
                <a
                  href={project.github_url}
                  target="_blank"
                  rel="noopener"
                  className="bg-acc text-onacc no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-[15px] hover:bg-ink hover:text-bg"
                >
                  View source ↗
                </a>
              ) : (
                <Link
                  to="/#contact"
                  className="bg-acc text-onacc no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-[15px] hover:bg-ink hover:text-bg"
                >
                  Private repo · ask for a walkthrough
                </Link>
              )}
              {project.live_url && (
                <a
                  href={project.live_url}
                  target="_blank"
                  rel="noopener"
                  className="border border-ln2 text-ink no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-3.5 hover:border-acct hover:text-acct"
                >
                  Live demo ↗
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="relative border border-ln2 bg-s1" style={{ aspectRatio: '16 / 10' }}>
              <AnimatedSpecimen specimen={project.specimen} className="absolute inset-0 w-full h-full" />
              {project.specimen && (
                <span className="absolute left-3 top-3 font-mono text-[10px] leading-none font-medium text-acct tracking-[0.12em]">
                  ● SPECIMEN · {project.specimen}
                </span>
              )}
            </div>
            {facts.length > 0 && (
              <div
                className="grid border border-ln2 border-t-0 bg-bg"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}
              >
                {facts.map(f => (
                  <div key={f.k} className="px-3.5 py-3 border-r border-ln flex flex-col gap-[7px] min-w-0">
                    <span className="font-mono text-[10px] leading-none font-medium text-mut tracking-[0.12em] uppercase">
                      {f.k}
                    </span>
                    <span className="font-mono text-[14px] leading-[1.25] font-medium break-words">{f.v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 01 / 02 */}
        {(about.length > 0 || steps.length > 0) && (
          <section
            className="grid gap-6 items-start"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}
          >
            {(about.length > 0 || project.technologies.length > 0) && (
              <div
                className="border border-ln2 p-[clamp(20px,3vw,36px)] flex flex-col gap-[18px]"
                style={{ background: 'color-mix(in oklab, var(--bg) 94%, transparent)' }}
              >
                <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.1em]">
                  01 · WHAT IT IS
                </span>
                {(about.length > 0 ? about : [project.description]).map(para => (
                  <p key={para.slice(0, 40)} className="m-0 text-[18px] leading-[1.6] text-ink [text-wrap:pretty]">
                    {para}
                  </p>
                ))}
                <div className="flex gap-2 flex-wrap mt-1">
                  {project.technologies.map(t => (
                    <span
                      key={t}
                      className="font-mono text-[11px] leading-none text-ink2 border border-ln2 px-2 py-[7px] tracking-[0.04em]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {steps.length > 0 && (
              <div
                className="border border-ln2 p-[clamp(20px,3vw,36px)] flex flex-col gap-1.5"
                style={{ background: 'color-mix(in oklab, var(--bg) 94%, transparent)' }}
              >
                <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.1em] mb-3">
                  02 · HOW IT WORKS
                </span>
                {steps.map((st, i) => (
                  <div
                    key={st.t}
                    className="grid gap-y-1 gap-x-3 py-3.5 border-t border-ln"
                    style={{ gridTemplateColumns: '44px 1fr' }}
                  >
                    <span className="font-mono text-[12px] leading-[1.5] font-medium text-mut">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-bold text-[18px] leading-[1.3]">{st.t}</span>
                    <span />
                    <span className="text-[15px] leading-[1.55] text-ink2 [text-wrap:pretty]">{st.d}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 03 */}
        {rules.length > 0 && (
          <section
            className="mt-6 border border-ln2 p-[clamp(20px,3vw,36px)] flex flex-col gap-5"
            style={{ background: 'color-mix(in oklab, var(--bg) 94%, transparent)' }}
          >
            <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.1em]">
              03 · {project.rulesTitle || 'RULES'}
            </span>
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}
            >
              {rules.map((r, i) => (
                <div key={r} className="border border-ln bg-s1 p-[18px] flex flex-col gap-2">
                  <span className="font-mono text-[10px] leading-none font-medium text-mut tracking-[0.12em]">
                    R{String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[16px] leading-[1.45] [text-wrap:pretty]">{r}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 04 */}
        {project.runCode && (
          <section
            className="mt-6 border border-ln2 p-[clamp(20px,3vw,36px)] flex flex-col gap-4"
            style={{ background: 'color-mix(in oklab, var(--bg) 94%, transparent)' }}
          >
            <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.1em]">
              04 · RUN IT YOURSELF
            </span>
            <pre className="m-0 px-5 py-[18px] bg-ink text-bg font-mono text-[13px] leading-[1.75] whitespace-pre overflow-auto">
              {project.runCode}
            </pre>
          </section>
        )}

        {/* Deep dive */}
        {(deepDive ?? project.content) && (
          <section className="mt-14 pt-6 border-t border-ln2">
            <span className="font-mono text-[12px] leading-none font-medium text-acct tracking-[0.1em] block mb-6">
              05 · DEEP DIVE
            </span>
            <DeepDive content={deepDive ?? project.content ?? ''} toc={toc} />
          </section>
        )}

        {/* Prev / next */}
        {projects.length > 1 && (
          <section className="mt-14 pt-6 border-t border-ln2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-5">
            <button
              type="button"
              onClick={() => navigate(projectPath(prev))}
              className="bg-transparent border-0 p-0 text-ink cursor-pointer text-left flex flex-col gap-2 hover:text-acct"
            >
              <span className="font-mono text-[11px] leading-none font-medium text-mut tracking-[0.1em]">← PREVIOUS</span>
              <span
                style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontStretch: '115%',
                  fontWeight: 700,
                  fontSize: 'clamp(22px,3vw,36px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {prev.title}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate(projectPath(next))}
              className="bg-transparent border-0 p-0 text-ink cursor-pointer text-left sm:text-right flex flex-col sm:items-end gap-2 hover:text-acct"
            >
              <span className="font-mono text-[11px] leading-none font-medium text-mut tracking-[0.1em]">NEXT →</span>
              <span
                style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontStretch: '115%',
                  fontWeight: 700,
                  fontSize: 'clamp(22px,3vw,36px)',
                  letterSpacing: '-0.02em',
                }}
              >
                {next.title}
              </span>
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
