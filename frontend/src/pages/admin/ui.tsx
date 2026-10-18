/**
 * Console surfaces shared by the six admin screens. Everything here is square, 1px-bordered
 * and mono-labelled — the design handoff has no radii and no shadows.
 */
import type { CSSProperties, ReactNode } from 'react';

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
export function MetricTile({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="bg-s1 p-2.5 flex flex-col gap-1.5 min-w-0">
      <span className="font-mono text-[10px] leading-none font-medium uppercase tracking-[0.08em] text-mut truncate">
        {k}
      </span>
      <span className="font-mono text-[18px] leading-none font-medium text-ink truncate">{v}</span>
    </div>
  );
}

/** Horizontal meter. `pct` is already clamped by the caller when it comes off the wire. */
export function Bar({ pct, color = 'var(--ink)', height = 10 }: { pct: number; color?: string; height?: number }) {
  return (
    <div className="bg-s1 border border-ln w-full" style={{ height }}>
      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export type MonoButtonTone = 'accent' | 'ink' | 'muted';

const TONE_CLASS: Record<MonoButtonTone, string> = {
  accent: 'bg-acc text-onacc border border-acc',
  ink: 'bg-transparent text-ink border border-ink',
  muted: 'bg-transparent text-mut border border-ln2',
};

export function MonoButton({
  children,
  onClick,
  tone = 'ink',
  disabled,
  title,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: MonoButtonTone;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`font-mono text-[11px] leading-none font-medium tracking-[0.06em] px-2.5 py-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

const VERDICT_STYLE: Record<string, CSSProperties> = {
  apply: { background: 'var(--acc)', color: 'var(--onacc)' },
  maybe: { background: 'transparent', color: 'var(--ink)' },
  skip: { background: 'var(--s1)', color: 'var(--mut)' },
};

export function VerdictChip({ verdict }: { verdict: string | null }) {
  const key = verdict ?? 'skip';
  return (
    <span
      className="font-mono text-[10px] leading-none font-medium uppercase tracking-[0.1em] px-2 py-1.5 border border-ink text-center whitespace-nowrap"
      style={VERDICT_STYLE[key] ?? VERDICT_STYLE.skip}
    >
      {verdict ?? 'unscored'}
    </span>
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

export function MutedLine({ children }: { children: ReactNode }) {
  return <p className="m-0 font-mono text-[12px] leading-[1.5] text-mut">{children}</p>;
}

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

export function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`;
}

/** Backend timestamps are naive UTC; without the Z they would be read as local time. */
export function formatWhen(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = new Date(raw.endsWith('Z') || raw.includes('+') ? raw : `${raw}Z`);
  if (Number.isNaN(parsed.getTime())) return raw;
  const now = Date.now();
  const diffMs = now - parsed.getTime();
  if (diffMs >= 0 && diffMs < 3600_000) return `${Math.max(1, Math.round(diffMs / 60_000))}m ago`;
  if (diffMs >= 0 && diffMs < 86_400_000) return `${Math.round(diffMs / 3600_000)}h ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
