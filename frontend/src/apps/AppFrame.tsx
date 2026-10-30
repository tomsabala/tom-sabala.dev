import { useState } from 'react';
import { appEntryUrl } from './registry.ts';
import type { HostedApp } from './registry.ts';
import ThemeToggle from './ThemeToggle.tsx';
import { bootLabel, unitIndex } from './units.ts';
import { useBootPhases } from './useBootPhases.ts';
import { useInstanceKind } from './useInstanceKind.ts';
import type { InstanceKind } from './useInstanceKind.ts';

/**
 * NOT a security boundary. `allow-scripts` + `allow-same-origin` on a same-origin frame
 * cancel the sandbox out: a bundle can reach `parent.document`, so it fully controls
 * apps.tom-sabala.dev including this launcher. That is accepted because public/hosted is
 * first-party code by policy, and the origin is kept credential-free: vercel.json redirects
 * /hosted/** off tom-sabala.dev (the CORS-allowed origin) so bundles never execute where the
 * admin session is usable. `allow-same-origin` is required for their localStorage/IndexedDB.
 * Never drop a third-party or generated bundle in here.
 */
const FRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads';

/** One step of the request path, drawn as a chip in the frame header. */
interface StripChip {
  label: string;
  lit: boolean;
  /** The unit itself — the end of the path, so it lights in the accent, not in ink. */
  unit?: boolean;
}

function chipTone(chip: StripChip): string {
  if (!chip.lit) return 'bg-transparent text-mut';
  return chip.unit ? 'bg-acc text-onacc' : 'bg-ink text-bg';
}

/**
 * Whether the instance behind this frame keeps anything. The three kinds are the broker's
 * own (`lib/identity.mjs#keyKind`): an anonymous container is tmpfs-backed and reaped, so
 * saying so before someone starts working in it is the point of the badge.
 */
const DURABILITY: Record<InstanceKind, { label: string; title: string; tone: string }> = {
  anon: {
    label: 'EPHEMERAL',
    title: 'Not signed in — this instance and everything in it is discarded when it goes idle',
    tone: 'border-acc text-acc',
  },
  admin: {
    label: 'PERSISTENT',
    title: 'Signed in — this instance keeps its data on its own volume',
    tone: 'border-ln2 text-ink2',
  },
  shared: {
    label: 'SHARED',
    title: 'One instance serves everybody; the app separates visitors itself',
    tone: 'border-ln2 text-ink2',
  },
};

function AppFrame({ app, index }: { app: HostedApp; index: number }) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const entry = appEntryUrl(app);
  // A service app is a container the broker may still be creating; the frame stays blank for
  // one to three seconds on a cold start, which reads as "broken" without an explicit overlay.
  // A bundle is static files — it has no boot, so it gets no overlay.
  const starting = app.kind === 'service' && !loaded;
  const boot = useBootPhases(app.slug, starting, attempt);
  // A shared app is one instance for everybody; calling it private would be a lie.
  const bootStatus = bootLabel(app);
  // Unlike boot progress, this has to outlive the overlay: the badge stays in the header
  // for as long as the unit is open. `attempt` re-reads it after a retry.
  const kind = useInstanceKind(app.slug, app.kind === 'service', attempt);
  const durability = kind ? DURABILITY[kind] : null;

  const idx = unitIndex(index);
  const strip: StripChip[] = [
    { label: 'YOU', lit: true },
    { label: 'GATEWAY', lit: loaded || boot.answered },
    { label: 'BROKER', lit: loaded || boot.reached >= 1 },
    { label: `UNIT ${idx}`, lit: loaded || boot.reached >= boot.phaseCount, unit: true },
  ];

  const retry = () => {
    setLoaded(false);
    setAttempt(value => value + 1);
  };

  return (
    <div className="flex h-screen flex-col bg-bg text-ink">
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-ln2 px-[clamp(10px,2vw,16px)] max-sm:pb-2">
        <a
          href="#/"
          aria-label="Back to all apps"
          className="shrink-0 border border-ln2 px-[11px] py-[9px] font-mono text-xs uppercase leading-none tracking-[0.06em] text-ink no-underline hover:border-acct"
        >
          ← Apps
        </a>

        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-[3px] py-2">
          <span className="truncate text-[15px] font-bold">{app.name}</span>
          <span className="truncate text-xs text-ink2">{app.tagline}</span>
        </div>

        <div className="flex basis-full items-center gap-1.5 overflow-x-auto font-mono text-[10px] uppercase leading-none tracking-[0.08em] max-sm:order-last sm:basis-auto">
          {strip.map((chip, i) => (
            <span key={chip.label} className="flex shrink-0 items-center gap-1.5">
              <span className={`whitespace-nowrap border border-ink px-[7px] py-1.5 ${chipTone(chip)}`}>
                {chip.label}
              </span>
              {i < strip.length - 1 && <span className="text-mut">→</span>}
            </span>
          ))}
          {durability && (
            <>
              {/* Not a fifth hop in the request path — a different fact about the unit. */}
              <span className="text-mut">·</span>
              <span
                title={durability.title}
                className={`whitespace-nowrap border px-[7px] py-1.5 ${durability.tone}`}
              >
                {durability.label}
              </span>
            </>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={retry}
            aria-label="Reload app"
            className="h-[34px] w-9 border border-ln2 bg-transparent font-mono text-sm leading-none text-ink hover:border-acct"
          >
            ↻
          </button>
          <a
            href={entry}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${app.name} in a new tab`}
            className="h-[34px] w-9 border border-ln2 text-center font-mono text-sm leading-[32px] text-ink no-underline hover:border-acct"
          >
            ↗
          </a>
          <ThemeToggle variant="glyph" />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {starting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink p-6 text-bg">
            <div className="flex w-full max-w-[620px] flex-col gap-4">
              <span className="font-mono text-[11px] leading-none tracking-[0.12em] text-acc">
                UNIT {idx} · BOOT
              </span>
              <span
                className="font-display text-[clamp(36px,6vw,64px)] font-extrabold leading-[0.95] tracking-[-0.03em]"
                style={{ fontStretch: '120%' }}
              >
                {app.name}
              </span>
              <pre
                data-testid="boot-log"
                className="m-0 min-h-[200px] whitespace-pre-wrap font-mono text-[13px] leading-[1.9] text-[color-mix(in_oklab,var(--bg)_80%,var(--ink))]"
              >
                {boot.lines.join('\n')}
              </pre>
              <div className="h-1 bg-[color-mix(in_oklab,var(--bg)_20%,var(--ink))]">
                <div
                  className="h-1 bg-acc transition-[width] duration-200"
                  style={{
                    width: `${Math.min(100, Math.round((boot.reached / boot.phaseCount) * 100))}%`,
                  }}
                />
              </div>
              {boot.failed ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[13px] leading-[1.4] text-acc">
                    {boot.error ?? 'The broker could not start this unit.'}
                  </span>
                  <button
                    type="button"
                    onClick={retry}
                    className="border border-acc bg-transparent px-4 py-2 font-mono text-xs uppercase leading-none tracking-[0.08em] text-acc"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-mono text-[13px] leading-none text-acc">{bootStatus}</span>
                  {kind === 'anon' && (
                    <span className="font-mono text-[13px] leading-[1.4] text-acc">
                      Not signed in — anything you do here is wiped when the instance goes idle.
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        <iframe
          key={attempt}
          src={entry}
          title={app.name}
          sandbox={FRAME_SANDBOX}
          allow="fullscreen; clipboard-write"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="h-full w-full border-0 bg-bg"
        />
      </div>
    </div>
  );
}

export default AppFrame;
