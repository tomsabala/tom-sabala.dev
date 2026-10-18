/**
 * stats — GitHub contribution statistics in Option B terminal style.
 *
 * Shows: stat lines with Unicode block bars, 7×20 ASCII activity grid,
 * and language breakdown — all styled with terminal theme CSS vars.
 */
import { registerCommand } from './registry';
import { getGitHubStats } from '../../repositories/githubRepository.ts';
import { DIM, ERROR, FG, PROMPT } from './output';
import type { CommandResult, OutputLine } from './types';

function blockBar(val: number, max: number, width = 20): string {
  if (max === 0) return '░'.repeat(width);
  const filled = Math.round((val / max) * width);
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, width - filled));
}

function asciiChar(n: number): string {
  if (n === 0) return '·';
  if (n <= 2)  return '░';
  if (n <= 4)  return '▒';
  if (n <= 6)  return '▓';
  return '█';
}

function fmt(n: number): string {
  return n.toLocaleString();
}

registerCommand({
  name: 'stats',
  description: 'Show GitHub contribution statistics',
  usage: 'stats',
  execute: async (): Promise<CommandResult> => {
    let resp: Awaited<ReturnType<typeof getGitHubStats>>;
    try {
      resp = await getGitHubStats();
    } catch {
      return {
        output: [{ text: 'stats: failed to reach the server.', color: ERROR }],
      };
    }

    if (!resp.success || !resp.data) {
      return {
        output: [{ text: 'stats: no data available.', color: ERROR }],
      };
    }

    const d = resp.data;
    const year = new Date().getFullYear();
    const maxVal = Math.max(d.prs, d.stars, d.publicRepos, 1);

    const lines: OutputLine[] = [
      { text: `$ git stats --year ${year}`, color: DIM },
      { text: '' },
    ];

    // ── Stat rows with block bars ──────────────────────────────────────────
    const statRows: [string, number][] = [
      ['prs_merged:', d.prs],
      ['stars:',      d.stars],
      ['repos:',      d.publicRepos],
    ];

    if (d.hasContributionData && d.totalContributions > 0) {
      lines.push({
        text: `  ${'contributions:'.padEnd(15)}${fmt(d.totalContributions).padStart(6)}  ${blockBar(d.totalContributions, Math.max(1, d.totalContributions))}`,
        color: FG,
      });
    }

    for (const [key, val] of statRows) {
      lines.push({
        text: `  ${key.padEnd(15)}${fmt(val).padStart(6)}  ${blockBar(val, maxVal)}`,
        color: FG,
      });
    }

    // Streak
    if (d.currentStreak > 0 || d.longestStreak > 0) {
      lines.push({
        text: `  ${'streak:'.padEnd(15)}${String(d.currentStreak + ' days').padStart(6)}  (best: ${d.longestStreak} days)`,
        color: DIM,
      });
    }

    lines.push({ text: '' });

    // ── Activity grid (last 20 weeks × 7 days) ────────────────────────────
    const hasActivity = d.contributions.some(w => w.some(v => v > 0));
    if (hasActivity) {
      lines.push({
        text: '── activity · last 20 weeks ─────────────────',
        color: DIM,
      });

      const recent = d.contributions.slice(-20);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let day = 0; day < 7; day++) {
        let row = dayNames[day] + ' ';
        for (let week = 0; week < 20; week++) {
          row += asciiChar(recent[week]?.[day] ?? 0);
        }
        lines.push({ text: row, color: FG });
      }

      lines.push({ text: '' });
    }

    // ── Language breakdown ────────────────────────────────────────────────
    if (d.languages.length > 0) {
      lines.push({
        text: '── languages ────────────────────────────────',
        color: DIM,
      });

      for (const lang of d.languages) {
        const label = lang.name.padEnd(14);
        const bar   = '█'.repeat(Math.round(lang.pct / 3.5));
        const pct   = `${lang.pct}%`.padStart(4);
        lines.push({
          text: `${label}${bar} ${pct}`,
          color: PROMPT,
        });
      }
    }

    return { output: lines };
  },
});
