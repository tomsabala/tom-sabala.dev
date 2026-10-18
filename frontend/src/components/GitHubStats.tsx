/**
 * GitHub activity strip: a 52-week contribution heatmap, streak counters and language
 * shares, drawn in the site's own palette — square cells, 1px borders, mono labels — so it
 * reads as part of the About section rather than an embedded GitHub widget.
 */
import { useState, useEffect, useRef } from 'react';
import { getGitHubStats } from '../repositories/githubRepository.ts';
import type { GitHubStats as GitHubStatsType } from '../types/index.ts';

// ── Heatmap geometry ────────────────────────────────────────────────────────
const CELL = 10;
const GAP  = 2;
const STEP = CELL + GAP;
const SVG_W = 52 * STEP;          // 624px
const SVG_H = 7  * STEP + 18;     // 102px  (18 = month label row)

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Pre-compute month label positions once (based on today's date)
function buildMonthLabels(): { label: string; x: number }[] {
  const today      = new Date();
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - today.getDay());

  const firstSunday = new Date(lastSunday);
  firstSunday.setDate(lastSunday.getDate() - 51 * 7);

  const labels: { label: string; x: number }[] = [];
  const seen   = new Set<number>();

  for (let w = 0; w < 52; w++) {
    const d = new Date(firstSunday);
    d.setDate(firstSunday.getDate() + w * 7);
    const m = d.getMonth();
    if (!seen.has(m)) {
      seen.add(m);
      labels.push({ label: MONTHS[m], x: w * STEP });
    }
  }
  return labels;
}

const MONTH_LABELS = buildMonthLabels();

/**
 * Five steps of the accent, mixed against the surface so an empty day is the panel itself.
 * `color-mix` keeps both themes correct from one ladder.
 */
function heatColor(count: number): string {
  if (count === 0) return 'var(--s1)';
  const pct = count <= 2 ? 22 : count <= 4 ? 45 : count <= 6 ? 70 : 100;
  return `color-mix(in oklab, var(--acc) ${pct}%, var(--s1))`;
}

function Skeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-4">
      <div className="h-6 bg-s1 border border-ln w-44" />
      <div className="h-[102px] bg-s1 border border-ln" />
      <div className="flex gap-2 flex-wrap">
        <div className="h-6 bg-s1 border border-ln w-28" />
        <div className="h-6 bg-s1 border border-ln w-24" />
        <div className="h-6 bg-s1 border border-ln w-20" />
      </div>
    </div>
  );
}

export default function GitHubStats() {
  const [stats,   setStats]   = useState<GitHubStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const heatmapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getGitHubStats()
      .then(resp => {
        if (resp.success && resp.data) setStats(resp.data);
        else setError('Unable to load GitHub stats.');
      })
      .catch(() => setError('Unable to load GitHub stats.'))
      .finally(() => setLoading(false));
  }, []);

  // Scroll heatmap to the right (most recent weeks) on load
  useEffect(() => {
    if (stats && heatmapRef.current) {
      heatmapRef.current.scrollLeft = heatmapRef.current.scrollWidth;
    }
  }, [stats]);

  const year = new Date().getFullYear();

  return (
    <div className="border border-ln p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <span className="font-mono text-[11px] leading-none font-medium text-acct tracking-[0.1em] uppercase">
          GitHub activity
        </span>
        {stats && (
          <a
            href={`https://github.com/${stats.username}`}
            target="_blank"
            rel="noopener"
            className="font-mono text-[11px] leading-none text-mut tracking-[0.06em] uppercase no-underline hover:text-acct"
          >
            @{stats.username} ↗
          </a>
        )}
      </div>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <p className="m-0 font-mono text-[12px] text-mut">{error}</p>
      ) : stats && (
        <>
          <div className="flex items-baseline gap-5 flex-wrap font-mono text-[12px] text-ink2">
            {stats.hasContributionData && stats.totalContributions > 0 && (
              <span>
                <span className="text-acct">{stats.totalContributions.toLocaleString()}</span>{' '}
                contributions in {year}
              </span>
            )}
            {stats.currentStreak > 0 && (
              <span>
                <span className="text-acct">{stats.currentStreak}</span> day streak
              </span>
            )}
            {stats.longestStreak > 0 && (
              <span className="text-mut">best {stats.longestStreak} days</span>
            )}
          </div>

          <div ref={heatmapRef} className="overflow-x-auto">
            <svg
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ display: 'block' }}
              aria-label={`GitHub contribution heatmap for ${year}`}
            >
              {MONTH_LABELS.map(m => (
                <text
                  key={m.label}
                  x={m.x}
                  y={11}
                  fontSize={9}
                  fill="var(--mut)"
                  fontFamily="'DM Mono', monospace"
                >
                  {m.label}
                </text>
              ))}

              {stats.contributions.map((week, w) =>
                week.map((count, d) => (
                  <rect
                    key={`${w}-${d}`}
                    x={w * STEP}
                    y={16 + d * STEP}
                    width={CELL}
                    height={CELL}
                    fill={heatColor(count)}
                  >
                    <title>{count} contribution{count !== 1 ? 's' : ''}</title>
                  </rect>
                ))
              )}
            </svg>
          </div>

          {stats.languages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats.languages.map(lang => (
                <span
                  key={lang.name}
                  className="inline-flex items-center gap-2 border border-ln px-2 py-1.5 font-mono text-[11px] leading-none text-ink2"
                >
                  <span className="w-2 h-2 block" style={{ background: lang.color }} />
                  {lang.name} {lang.pct}%
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
