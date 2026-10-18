/**
 * The console design language.
 *
 * One vocabulary for the six admin screens and the dialogs they open: square, 1px borders,
 * mono labels, no radii and no shadows. A dialog button and a console button are the same
 * object at two sizes, so there is one button here rather than a second set of class
 * constants. Inputs are 16px so iOS does not zoom the page on focus — the console is used
 * from a phone.
 */
import type { CSSProperties, ReactNode } from 'react';

/* ── Buttons ──────────────────────────────────────────────────────────────── */

type MonoTone = 'accent' | 'ink' | 'muted';
/** `sm` is the console's inline action; `md` is the heavier button a dialog closes with. */
type MonoSize = 'sm' | 'md';

const TONE_CLASS: Record<MonoTone, string> = {
  accent: 'bg-acc text-onacc border-acc',
  ink: 'bg-transparent text-ink border-ink',
  muted: 'bg-transparent text-mut border-ln2',
};

const SIZE_CLASS: Record<MonoSize, string> = {
  sm: 'text-[11px] px-2.5 py-2',
  md: 'text-[12px] uppercase px-4 py-[11px]',
};

/** The button face as a class string, for the one `<a>` that has to look like a button. */
export function monoButtonClass(tone: MonoTone = 'ink', size: MonoSize = 'sm'): string {
  return (
    'inline-flex items-center justify-center gap-2 border font-mono leading-none font-medium ' +
    'tracking-[0.06em] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ' +
    `${TONE_CLASS[tone]} ${SIZE_CLASS[size]}`
  );
}

export function MonoButton({
  children,
  onClick,
  tone = 'ink',
  size = 'sm',
  disabled,
  title,
  ariaLabel,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: MonoTone;
  size?: MonoSize;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`${monoButtonClass(tone, size)} ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Dialog chrome ────────────────────────────────────────────────────────── */

const DIALOG_TITLE =
  'font-display font-extrabold uppercase text-[26px] leading-none tracking-[-0.02em] m-0 [font-stretch:115%]';

/** Title plus the close button every dialog carries; `id` is the `Modal` `titleId`. */
export function DialogHeader({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-between items-start gap-4 mb-6">
      <h2 id={id} className={DIALOG_TITLE}>
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="bg-transparent border border-ln2 text-mut font-mono text-[12px] leading-none px-2.5 py-2 cursor-pointer hover:text-ink hover:border-ink"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/* ── Fields ───────────────────────────────────────────────────────────────── */

export const LABEL =
  'block font-mono text-[10px] leading-none uppercase tracking-[0.12em] text-mut mb-2';

export const FIELD =
  'w-full bg-bg text-ink border border-ln2 px-3 py-2.5 text-[16px] leading-snug ' +
  'focus:outline-none focus:border-acct placeholder:text-mut';

/** `!` is required: this is appended to `FIELD`, so it must beat `FIELD`'s `border-ln2`. */
export const FIELD_ERROR = '!border-[#b3261e] focus:!border-[#b3261e]';

export const FIELD_MONO = `${FIELD} font-mono text-[14px]`;

export const HINT = 'mt-1.5 font-mono text-[11px] leading-[1.4] text-mut';

/** Search box styled for the console; 16px so iOS does not zoom on focus. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      aria-label={label}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`bg-bg text-ink border border-ln2 px-3 py-2.5 font-mono text-[16px] md:text-[13px] leading-none placeholder:text-mut focus:outline-none focus:border-acct ${className}`}
    />
  );
}

/** The handoff's 52×26 square switch. */
export function SquareToggle({
  on,
  onChange,
  label,
  disabled,
  title,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onChange}
      className="flex items-center w-[52px] h-[26px] shrink-0 p-[3px] border border-ink cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
      style={{
        background: on ? 'var(--acc)' : 'var(--s1)',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <span className="w-[18px] h-[18px] bg-ink" />
    </button>
  );
}

/* ── Errors ───────────────────────────────────────────────────────────────── */

/** The console's single error hue — nothing else in the palette is red. */
export const ERROR_INK = 'text-[#b3261e]';

export const ERROR_TEXT = `mt-1.5 font-mono text-[11px] leading-[1.4] ${ERROR_INK}`;

export const ERROR_BOX = `border border-[#b3261e] px-3 py-2.5 font-mono text-[12px] leading-[1.45] ${ERROR_INK}`;

/* ── Surfaces ─────────────────────────────────────────────────────────────── */

export function ConsolePanel({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`border border-ln2 bg-bg min-w-0 ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Accent mono caption used as a panel header, optionally with a right-hand slot. */
export function PanelHead({
  label,
  right,
  padded = true,
}: {
  label: string;
  right?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        padded ? 'px-5 py-4 border-b border-ln' : ''
      }`}
    >
      <span className="font-mono text-[11px] leading-none font-medium uppercase tracking-[0.12em] text-acct">
        {label}
      </span>
      {right}
    </div>
  );
}

/** `--s1` tile with a mono caption over a big mono number. */
export function MetricTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-s1 p-2.5 flex flex-col gap-1.5 min-w-0">
      <span className="font-mono text-[10px] leading-none font-medium uppercase tracking-[0.08em] text-mut truncate">
        {label}
      </span>
      <span className="font-mono text-[18px] leading-none font-medium text-ink truncate">
        {value}
      </span>
    </div>
  );
}

/** Horizontal meter. `pct` is already clamped by the caller when it comes off the wire. */
export function Bar({
  pct,
  color = 'var(--ink)',
  height = 10,
}: {
  pct: number;
  color?: string;
  height?: number;
}) {
  return (
    <div className="bg-s1 border border-ln w-full" style={{ height }}>
      <div
        style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  );
}

export function MutedLine({ children }: { children: ReactNode }) {
  return <p className="m-0 font-mono text-[12px] leading-[1.5] text-mut">{children}</p>;
}

/** A list or panel with nothing in it; the console says so in one muted line. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-5">
      <MutedLine>{children}</MutedLine>
    </div>
  );
}

/* ── Chips ────────────────────────────────────────────────────────────────── */

/**
 * Small bordered mono chip used for tags, statuses and inline toggles. The caller names the
 * border and text colour, so no chip depends on which colour utility Tailwind emits last.
 */
export const CHIP =
  'font-mono text-[10px] leading-none uppercase tracking-[0.1em] border px-2 py-1.5';

const VERDICT_STYLE: Record<string, CSSProperties> = {
  apply: { background: 'var(--acc)', color: 'var(--onacc)' },
  maybe: { background: 'transparent', color: 'var(--ink)' },
  skip: { background: 'var(--s1)', color: 'var(--mut)' },
};

export function VerdictChip({ verdict }: { verdict: string | null }) {
  const key = verdict ?? 'skip';
  return (
    <span
      className={`${CHIP} font-medium border-ink text-center whitespace-nowrap`}
      style={VERDICT_STYLE[key] ?? VERDICT_STYLE.skip}
    >
      {verdict ?? 'unscored'}
    </span>
  );
}

/* ── Formatters ───────────────────────────────────────────────────────────── */

/** Backend timestamps are naive UTC; without the Z they would be read as local time. */
function parseTimestamp(raw: string): Date {
  return new Date(raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`);
}

/** Relative for the last day, then a short date — the console's default timestamp. */
export function formatWhen(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = parseTimestamp(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs >= 0 && diffMs < 3600_000) return `${Math.max(1, Math.round(diffMs / 60_000))}m ago`;
  if (diffMs >= 0 && diffMs < 86_400_000) return `${Math.round(diffMs / 3600_000)}h ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** The long form of `formatWhen`, for history rows where the exact moment is the point. */
export function formatDateTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = parseTimestamp(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toLocaleString(undefined, DATE_TIME);
}

/** Coarse size for live memory, where a megabyte either way is noise. */
export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

/** Exact size for a file the admin picked, where "0 MB" for a 400 KB PDF would be a lie. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
}
