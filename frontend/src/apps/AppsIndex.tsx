import { useEffect, useRef, useState } from 'react';
import { appHash, appEntryUrl } from './registry.ts';
import type { HostedApp } from './registry.ts';
import RequestPathDiagram from './RequestPathDiagram.tsx';
import ThemeToggle from './ThemeToggle.tsx';
import { specRows, unitIndex } from './units.ts';
import { useBrokerInstances } from './useBrokerInstances.ts';

/** Below this the diagram stacks vertically and the inspector moves above it. */
const NARROW_PX = 640;

function AppsIndex({
  apps,
  admin,
  missingSlug,
  onSecretClick,
}: {
  /** `null` while the manifest is in flight; only the header renders. */
  apps: HostedApp[] | null;
  admin: boolean;
  missingSlug: string | null;
  onSecretClick: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [width, setWidth] = useState(() => window.innerWidth);
  const rowRef = useRef<HTMLDivElement>(null);
  const instances = useBrokerInstances(admin);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const list = apps ?? [];
  const index = Math.min(selected, Math.max(list.length - 1, 0));
  const app = list[index] ?? null;
  const narrow = width < NARROW_PX;
  // A stacked diagram needs room for every unit; a wide one is a viewport-relative band.
  // Past three units the stack grows rather than squeezing the nodes into each other.
  const diagramHeight = narrow
    ? (width < 480 ? 620 : 760) + Math.max(0, list.length - 3) * 110
    : null;
  const liveCount = list.filter(entry => entry.status === 'live').length;
  const rows = app ? specRows(app, admin, instances) : [];
  const source = app?.sourceUrl ?? app?.credit?.url ?? null;
  const cta =
    app === null || app.kind !== 'service'
      ? 'Open the build'
      : app.mode === 'session'
        ? 'Start my private instance'
        : 'Wake the shared instance';

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-ln px-[clamp(16px,3vw,32px)] py-4">
        <button
          type="button"
          tabIndex={-1}
          onClick={admin ? undefined : onSecretClick}
          style={{ fontStretch: '120%' }}
          className="cursor-default select-none border-0 bg-transparent p-0 text-left font-display text-[22px] font-extrabold uppercase leading-none tracking-[-0.02em] text-ink focus:outline-none"
        >
          apps<span className="text-acct">.</span>tom-sabala.dev
        </button>
        <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2.5 font-mono text-xs uppercase leading-none tracking-[0.06em]">
          <span className="text-mut">{list.length} units</span>
          <span className="text-acct">
            ● {list.length > 0 && liveCount === list.length ? 'all live' : `${liveCount} live`}
          </span>
          {admin && (
            <a href="/oauth2/sign_out?rd=%2F" className="text-mut no-underline hover:text-ink">
              Sign out
            </a>
          )}
          <ThemeToggle />
          <a href="https://tom-sabala.dev" className="text-ink no-underline hover:text-acct">
            ← tom-sabala.dev
          </a>
        </div>
      </header>

      {missingSlug && (
        <p className="m-0 border-b border-ln px-[clamp(16px,3vw,32px)] py-3 font-mono text-xs leading-none text-mut">
          No app called <span className="text-ink">{missingSlug}</span>.
        </p>
      )}

      <div ref={rowRef} className="flex flex-1 flex-wrap">
        {app === null ? (
          <p className="m-0 border-b border-ln px-[clamp(16px,3vw,32px)] py-6 font-mono text-xs leading-none text-mut">
            {apps === null ? 'Reading the manifest…' : 'No units published yet.'}
          </p>
        ) : (
          <>
            <div style={{ order: narrow ? 2 : 1 }} className="flex min-w-0 flex-[1_1_560px]">
              <RequestPathDiagram
                apps={list}
                selected={selected}
                onSelect={setSelected}
                heightPx={diagramHeight}
              />
            </div>

            <section
              style={{ order: narrow ? 1 : 2 }}
              className="flex max-w-full flex-[1_1_360px] flex-col gap-5 border-b border-ln p-[clamp(20px,3vw,32px)]"
            >
              <span className="font-mono text-[11px] leading-none tracking-[0.12em] text-acct">
                INSPECTING UNIT {unitIndex(index)} · {appEntryUrl(app)}
              </span>
              <h2
                style={{ fontStretch: '120%' }}
                className="m-0 font-display text-[clamp(40px,4.4vw,56px)] font-extrabold leading-[0.92] tracking-[-0.03em]"
              >
                {app.name}
              </h2>
              <p className="m-0 text-[17px] leading-[1.5] text-ink2 [text-wrap:pretty]">
                {app.tagline}
              </p>

              <div className="grid grid-cols-2 border-l border-t border-ln2">
                {rows.map(row => (
                  <div
                    key={row.k}
                    className="flex min-w-0 flex-col gap-1.5 border-b border-r border-ln2 px-3.5 py-3"
                  >
                    <span className="font-mono text-[10px] leading-none tracking-[0.12em] text-mut">
                      {row.k}
                    </span>
                    <span className="font-mono text-[13px] leading-[1.3] [overflow-wrap:anywhere]">
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              {app.credit &&
                (app.credit.url ? (
                  <a
                    href={app.credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs leading-none text-acct no-underline hover:text-ink"
                  >
                    {app.credit.text} ↗
                  </a>
                ) : (
                  <span className="font-mono text-xs leading-none text-mut">{app.credit.text}</span>
                ))}

              <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
                <a
                  href={appHash(app.slug)}
                  className="flex items-center justify-between bg-acc px-[18px] py-[17px] font-mono text-[13px] uppercase leading-none tracking-[0.08em] text-onacc no-underline hover:bg-ink hover:text-bg"
                >
                  <span>{cta}</span>
                  <span>→</span>
                </a>
                {source && (
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-ink px-[18px] py-4 font-mono text-[13px] uppercase leading-none tracking-[0.08em] text-ink no-underline hover:bg-ink hover:text-bg"
                  >
                    Source
                  </a>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="flex flex-wrap justify-between gap-3 px-[clamp(16px,3vw,32px)] py-4 font-mono text-xs leading-[1.4] text-mut">
        <span>Service units cold-start in 1–3 s. Pure browser builds open instantly.</span>
        <span>First-party code only.</span>
      </footer>
    </div>
  );
}

export default AppsIndex;
