/**
 * 03 · About + CV. The CV no longer has a page of its own: the PDF is downloaded or opened
 * in a modal viewer right here. Skill levels are drawn as radar polygons, and the GitHub
 * strip is mounted only when the feature is configured and its tab is visible.
 */
import { useEffect, useState } from 'react';
import { getAbout } from '../../../repositories/aboutRepository.ts';
import { getActivePdf, getPdfDownloadUrl, getPdfFileUrl } from '../../../repositories/resumeRepository.ts';
import { getGitHubStatsEnabled } from '../../../repositories/githubRepository.ts';
import { useIsTabVisible } from '../../../contexts/TabConfigContext.tsx';
import { SKILLS } from '../../../about/skills.ts';
import { radar } from '../../../about/radar.ts';
import GitHubStats from '../../GitHubStats.tsx';
import PdfViewer from '../../PdfViewer.tsx';
import Panel from '../Panel.tsx';
import SectionHeading from '../SectionHeading.tsx';

const RADARS = SKILLS.map(radar);

const FALLBACK_BIO =
  'Math-minded software engineer with a strong problem-solving approach and a love for clean, scalable systems. Combines algorithmic thinking with full-stack development to turn complex requirements into reliable, data-informed products. Tennis enthusiast.';

export default function AboutSection() {
  const [bio, setBio] = useState(FALLBACK_BIO);
  const [hasPdf, setHasPdf] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [githubEnabled, setGithubEnabled] = useState(false);
  const githubVisible = useIsTabVisible('github');

  useEffect(() => {
    getAbout()
      .then(resp => {
        const content = resp?.data?.content;
        if (typeof content === 'string' && content.trim()) setBio(content.trim());
      })
      .catch(() => { /* the fallback bio is the same copy the terminal ships */ });

    getActivePdf()
      .then(resp => setHasPdf(Boolean(resp?.success && resp?.data)))
      .catch(() => setHasPdf(false));

    getGitHubStatsEnabled().then(setGithubEnabled);
  }, []);

  return (
    <section id="about" data-field="1" className="pt-[clamp(64px,22vh,240px)] scroll-mt-[60px]">
      <Panel>
        <SectionHeading
          index="03"
          title="About + CV"
          aside={
            <span className="font-mono text-[12px] leading-none text-mut tracking-[0.06em] uppercase">
              Based in Israel
            </span>
          }
        />

        <div
          className="grid gap-8 lg:gap-12 items-start mt-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}
        >
          <p
            className="m-0 [text-wrap:pretty]"
            style={{
              fontSize: 'clamp(20px,2.2vw,30px)',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}
          >
            {bio}
          </p>

          <div className="flex flex-col gap-5">
            <p className="m-0 font-mono text-[13px] leading-[1.7] text-ink2">
              The CV no longer gets its own page. Grab the PDF, or open it right here. Below: my own
              honest ratings, plotted as polygons, because of course they are.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a
                href={getPdfDownloadUrl()}
                className={`bg-acc text-onacc no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-[15px] hover:bg-ink hover:text-bg ${
                  hasPdf ? '' : 'pointer-events-none opacity-40'
                }`}
                aria-disabled={!hasPdf}
              >
                Download CV · PDF
              </a>
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                disabled={!hasPdf}
                className="border border-ln2 text-ink bg-transparent font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-3.5 cursor-pointer hover:border-acct hover:text-acct disabled:opacity-40 disabled:cursor-default"
              >
                Open in viewer
              </button>
            </div>
            {!hasPdf && (
              <span className="font-mono text-[11px] text-mut">No CV published right now.</span>
            )}
          </div>
        </div>

        <div
          className="grid gap-4 mt-14"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}
        >
          {RADARS.map(r => (
            <div key={r.name} className="border border-ln pt-5 px-3 pb-2 flex flex-col gap-1">
              <span className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.1em] uppercase pl-2">
                {r.name}
              </span>
              <div className="relative mx-3" style={{ containerType: 'inline-size' }}>
                <svg viewBox="0 0 400 300" className="w-full h-auto block overflow-visible">
                  <polygon points={r.ring0} style={{ fill: 'none', stroke: 'var(--ln)', strokeWidth: 1 }} />
                  <polygon points={r.ring1} style={{ fill: 'none', stroke: 'var(--ln)', strokeWidth: 1 }} />
                  <polygon points={r.ring2} style={{ fill: 'none', stroke: 'var(--ln)', strokeWidth: 1 }} />
                  <polygon points={r.ring3} style={{ fill: 'none', stroke: 'var(--ln2)', strokeWidth: 1 }} />
                  <path d={r.axes} style={{ fill: 'none', stroke: 'var(--ln)', strokeWidth: 1 }} />
                  <polygon
                    points={r.poly}
                    style={{
                      fill: 'color-mix(in oklab, var(--acc) 14%, transparent)',
                      stroke: 'var(--acct)',
                      strokeWidth: 1.5,
                      strokeLinejoin: 'round',
                    }}
                  />
                  <path d={r.dots} style={{ fill: 'var(--acct)' }} />
                </svg>
                {r.labels.map(l => (
                  <span
                    key={l.t}
                    className="absolute whitespace-nowrap flex flex-col text-ink2"
                    style={{
                      left: l.left,
                      top: l.top,
                      transform: l.tf,
                      alignItems: l.al,
                      font: "400 clamp(9px, 3cqw, 12px)/1.25 'DM Mono', monospace",
                    }}
                  >
                    <span>{l.t}</span>
                    <span className="text-acct">{l.v}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {githubEnabled && githubVisible && (
          <div className="mt-14">
            <GitHubStats />
          </div>
        )}
      </Panel>

      {viewerOpen && (
        <div
          data-panel="1"
          className="fixed inset-0 z-[60] flex flex-col"
          style={{ background: 'color-mix(in oklab, var(--bg) 92%, transparent)' }}
        >
          <div className="flex items-center justify-between gap-4 border-b border-ln px-4 py-3 bg-bg">
            <span className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.12em] uppercase">
              CV · PDF
            </span>
            <button
              type="button"
              onClick={() => setViewerOpen(false)}
              aria-label="Close CV viewer"
              className="bg-transparent border border-ln2 text-ink font-mono text-[12px] leading-none px-3 py-2 cursor-pointer hover:border-acct"
            >
              × Close
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <PdfViewer pdfUrl={getPdfFileUrl()} fileName="tom-sabala-cv.pdf" />
          </div>
        </div>
      )}
    </section>
  );
}
