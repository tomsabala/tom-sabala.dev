/**
 * GitHubStats — Option C "Activity Focus"
 * Shows the full 52-week contribution heatmap, streak badges,
 * contribution count, and language tag pills.
 */
import { useState, useEffect, useRef } from 'react';
import { getGitHubStats } from '../repositories/githubRepository.ts';
import type { GitHubStats as GitHubStatsType } from '../types/index.ts';

// ── Heatmap geometry ────────────────────────────────────────────────────────
const CELL = 10;
const GAP  = 2;
const STEP = CELL + GAP;
const SVG_W = 52 * STEP;          // 624px
const SVG_H = 7  * STEP + 18;     // 100px  (18 = month label row)

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

// ── Color helpers ────────────────────────────────────────────────────────────
function heatColor(count: number, dark: boolean): string {
  if (dark) {
    if (count === 0) return '#161b22';
    if (count <= 2)  return '#0e4429';
    if (count <= 4)  return '#006d32';
    if (count <= 6)  return '#26a641';
    return '#39d353';
  }
  if (count === 0) return '#ebedf0';
  if (count <= 2)  return '#9be9a8';
  if (count <= 4)  return '#40c463';
  if (count <= 6)  return '#30a14e';
  return '#216e39';
}

// ── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex gap-3 items-center">
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-36" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
      </div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-52" />
      <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="flex gap-2 flex-wrap">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-28" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GitHubStats() {
  const [stats,   setStats]   = useState<GitHubStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const heatmapRef = useRef<HTMLDivElement>(null);

  // Track dark mode by watching the <html> class attribute
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

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
  const labelColor = isDark ? '#6b7280' : '#9ca3af';

  return (
    <div className="bg-white dark:bg-[#252525] rounded-lg shadow-md border border-transparent dark:border-gray-700 p-4 sm:p-8">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
        GitHub Activity
      </h2>

      {loading ? (
        <Skeleton />
      ) : error ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
      ) : stats && (
        <>
          {/* ── Streak badges ── */}
          {(stats.currentStreak > 0 || stats.longestStreak > 0) && (
            <div className="flex items-baseline gap-3 mb-2.5 flex-wrap">
              {stats.currentStreak > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  🔥 {stats.currentStreak} day streak
                </span>
              )}
              {stats.longestStreak > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Best: {stats.longestStreak} days
                </span>
              )}
            </div>
          )}

          {/* ── Contributions summary ── */}
          {stats.hasContributionData && stats.totalContributions > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                {stats.totalContributions.toLocaleString()}
              </strong>{' '}
              contributions in {year}
            </p>
          )}

          {/* ── Contribution heatmap ── */}
          <div ref={heatmapRef} className="overflow-x-auto mb-4 -mx-1 px-1">
            <svg
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{ display: 'block' }}
              aria-label={`GitHub contribution heatmap for ${year}`}
            >
              {/* Month labels */}
              {MONTH_LABELS.map(m => (
                <text
                  key={m.label}
                  x={m.x}
                  y={11}
                  fontSize={9}
                  fill={labelColor}
                  fontFamily="system-ui,-apple-system,sans-serif"
                >
                  {m.label}
                </text>
              ))}

              {/* Contribution cells */}
              {stats.contributions.map((week, w) =>
                week.map((count, d) => (
                  <rect
                    key={`${w}-${d}`}
                    x={w * STEP}
                    y={16 + d * STEP}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    fill={heatColor(count, isDark)}
                  >
                    <title>{count} contribution{count !== 1 ? 's' : ''}</title>
                  </rect>
                ))
              )}
            </svg>
          </div>

          {/* ── Language tags ── */}
          {stats.languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stats.languages.map(lang => (
                <span
                  key={lang.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm"
                  style={{ background: lang.color }}
                >
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
