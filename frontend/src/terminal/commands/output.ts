import type { OutputLine } from './types';

/**
 * The palette every command writes in. These are CSS custom properties the active theme
 * fills in (see `src/terminal/themes`), so a line keeps its meaning — dim, error, accent —
 * across all seven themes instead of carrying a literal colour.
 */
export const FG = 'var(--term-fg)';
export const DIM = 'var(--term-fg-dim)';
export const PROMPT = 'var(--term-prompt)';
export const ACCENT = 'var(--term-accent)';
export const ERROR = 'var(--term-error)';

/** The blank line plus closing note every listing command ends with. */
export function hint(text: string, color?: string): OutputLine[] {
  return [{ text: '' }, color ? { text, color } : { text }];
}
