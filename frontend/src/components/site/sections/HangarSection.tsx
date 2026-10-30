/**
 * 02 · The hangar. Reads the build-time manifest, not the gateway's: `apps.tom-sabala.dev`
 * is a different origin and is deliberately absent from CORS_ORIGINS, and `apps.json` is
 * the same source of truth the broker mounts. Admin-only apps are filtered out here, the
 * way the gateway filters them out of the manifest it serves anonymous visitors.
 */
import { HOSTED_APPS, appEntryUrl } from '../../../apps/registry.ts';
import type { HostedApp } from '../../../apps/registry.ts';
import Section from '../Section.tsx';
import SpecGrid from '../SpecGrid.tsx';
import { useAuth } from '../../../contexts/AuthContext.tsx';

const APPS_ORIGIN = 'https://apps.tom-sabala.dev';
const PUBLIC_APPS = HOSTED_APPS.filter(app => app.access === 'public');

function memoryLabel(app: HostedApp): string {
  if (app.kind !== 'service' || !app.runtime) return 'static bundle';
  return (app.runtime.memoryMb / 1024).toFixed(2).replace(/\.?0+$/, '') + ' GB';
}

/**
 * `?signin=1` only for a visitor the portfolio already knows is an admin, and only for a
 * service: the apps origin has its own session, so without the hop the broker resolves an
 * admin as anonymous and hands them a tmpfs instance the reaper deletes. A bundle is static
 * files with no instance, and an anonymous visitor sees byte-identical hrefs to before —
 * which is what keeps this origin's hidden-admin property intact.
 */
export default function HangarSection() {
  const { isAuthenticated } = useAuth();

  return (
    <Section
      id="hangar"
      index="02"
      title="The hangar"
      aside={
        <a
          href={isAuthenticated ? `${APPS_ORIGIN}/?signin=1` : APPS_ORIGIN}
          target="_blank"
          rel="noopener"
          className="font-mono text-[12px] leading-none text-mut tracking-[0.06em] uppercase no-underline hover:text-acct"
        >
          apps.tom-sabala.dev ↗
        </a>
      }
      lede="Apps that were born to live on localhost. I gave them a container and a public address. Spin one up; it boots on demand."
    >
      <div
        className="grid gap-4 mt-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}
      >
        {PUBLIC_APPS.map((app, i) => (
          <div key={app.slug} className="bg-s1 border border-ln p-6 flex flex-col gap-[18px]">
            <div className="flex justify-between items-center gap-3 font-mono text-[11px] leading-none font-medium tracking-[0.1em] uppercase">
              <span className="text-mut">
                Unit {String(i + 1).padStart(2, '0')} · {appEntryUrl(app)}
              </span>
              <span className="text-acct">● {app.status === 'live' ? 'live' : 'wip'}</span>
            </div>

            <div className="flex flex-col gap-2">
              <span
                className="leading-[1.05]"
                style={{
                  fontFamily: "'Archivo', sans-serif",
                  fontStretch: '112%',
                  fontWeight: 700,
                  fontSize: '30px',
                  letterSpacing: '-0.02em',
                }}
              >
                {app.name}
              </span>
              <p className="m-0 text-[15px] leading-[1.5] text-ink2 [text-wrap:pretty]">{app.tagline}</p>
            </div>

            <SpecGrid
              className="border-t border-ln pt-4"
              rows={[
                { k: 'MODE', v: app.kind === 'service' ? app.mode : 'static' },
                { k: 'MEMORY', v: memoryLabel(app) },
                { k: 'STACK', v: app.tech.join(' · ') },
                {
                  k: 'ORIGIN',
                  v: app.credit ? (
                    app.credit.url ? (
                      <a
                        href={app.credit.url}
                        target="_blank"
                        rel="noopener"
                        className="text-ink underline decoration-ln2 underline-offset-[3px] hover:text-acct"
                      >
                        {app.credit.text}
                      </a>
                    ) : (
                      app.credit.text
                    )
                  ) : (
                    'first-party'
                  ),
                },
              ]}
            />

            <a
              href={
                isAuthenticated && app.kind === 'service'
                  ? `${APPS_ORIGIN}/?signin=1#/${app.slug}`
                  : `${APPS_ORIGIN}${appEntryUrl(app)}`
              }
              target="_blank"
              rel="noopener"
              className="mt-auto border border-acct text-acct no-underline font-mono text-[12px] leading-none font-medium tracking-[0.1em] uppercase px-4 py-3.5 flex justify-between hover:bg-acc hover:border-acc hover:text-onacc"
            >
              <span>Launch unit</span>
              <span>↗</span>
            </a>
          </div>
        ))}
      </div>
    </Section>
  );
}
