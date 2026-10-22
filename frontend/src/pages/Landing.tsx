/**
 * The landing page: one long scroll over the live algorithm field.
 *
 * Everything with real content sits in `position:relative; z-index:1` above the fixed
 * canvas. Clicks reach the field from anywhere that is not a control or a `data-panel="1"`
 * surface, so the crosshair belongs on the whole page and the panels turn it off again.
 * Sections the visitor cannot see are not rendered at all — the tab guard is enforced again
 * on the backend, so this is cosmetic, not a security boundary.
 */
import { FieldCanvas, FieldDock, FieldProvider, LearnModal, useField } from '../field/index.ts';
import { useIsTabVisible } from '../contexts/TabConfigContext.tsx';
import { useProjects } from '../work/useProjects.ts';
import SiteHeader, { type NavLink } from '../components/site/SiteHeader.tsx';
import SiteFooter from '../components/site/SiteFooter.tsx';
import WorkSection from '../components/site/sections/WorkSection.tsx';
import HangarSection from '../components/site/sections/HangarSection.tsx';
import AboutSection from '../components/site/sections/AboutSection.tsx';
import ContactSection from '../components/site/sections/ContactSection.tsx';

export default function Landing() {
  return (
    <FieldProvider>
      <LandingBody />
    </FieldProvider>
  );
}

function LandingBody() {
  const { openLearn } = useField();
  const { projects, loading: loadingProjects, error: projectsError } = useProjects();

  const showWork = useIsTabVisible('work');
  const showHangar = useIsTabVisible('hangar');
  const showAbout = useIsTabVisible('about');
  const showContact = useIsTabVisible('contact');

  const links: NavLink[] = [
    showWork && { href: '#work', label: 'Work' },
    showHangar && { href: '#hangar', label: 'Hangar' },
    showAbout && { href: '#about', label: 'About' },
    showContact && { href: '#contact', label: 'Contact' },
  ].filter((l): l is NavLink => Boolean(l));

  return (
    <>
      <FieldCanvas />

      <div className="relative z-[1] md:cursor-crosshair">
        <SiteHeader links={links} />

        <section
          data-screen-label="Hero"
          className="relative overflow-hidden"
          style={{
            height: 'calc(100svh - 59px)',
            minHeight: '560px',
            maxHeight: '1000px',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 62% 58% at 0% 100%, color-mix(in oklab, var(--bg) 88%, transparent) 35%, transparent 75%)',
            }}
          />
          {/* Extra bottom padding below `md` keeps the CTAs clear of the collapsed field dock,
              which is a 44px bar pinned to the bottom edge on a phone. */}
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-end px-[clamp(16px,4vw,48px)] pb-[80px] md:pb-[clamp(24px,5vh,56px)]">
            <div className="max-w-[1360px] w-full mx-auto">
              <div className="w-fit max-w-full">
                <div className="font-mono text-[13px] leading-[1.4] text-acct tracking-[0.08em] uppercase mb-[18px]">
                  Full-stack engineer · robotics &amp; geometry nerd
                </div>
                <h1
                  className="m-0 uppercase text-ink"
                  style={{
                    fontFamily: "'Archivo', sans-serif",
                    fontStretch: '125%',
                    fontWeight: 800,
                    fontSize: 'clamp(44px,13vw,176px)',
                    lineHeight: 0.86,
                    letterSpacing: '-0.035em',
                  }}
                >
                  Tom<br />Sabała
                </h1>
                <p
                  className="mt-6 mb-0 max-w-[44ch] text-ink2 [text-wrap:pretty]"
                  style={{ fontSize: 'clamp(16px,1.4vw,19px)', lineHeight: 1.5 }}
                >
                  I write software for the web by day and think about configuration spaces by night.
                  Everything behind this text is running live. Go ahead, poke it.
                </p>
                <div className="flex gap-3 mt-7 flex-wrap pointer-events-auto">
                  {showWork && (
                    <a
                      href="#work"
                      className="bg-acc text-onacc no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-[15px] grow sm:grow-0 text-center hover:bg-ink hover:text-bg"
                    >
                      See the work ↓
                    </a>
                  )}
                  {showContact && (
                    <a
                      href="#contact"
                      className="border border-ln2 text-ink no-underline font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-5 py-3.5 grow sm:grow-0 text-center hover:border-acct hover:text-acct"
                      style={{ background: 'color-mix(in oklab, var(--bg) 70%, transparent)' }}
                    >
                      Say hello
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={openLearn}
                    className="bg-transparent border-0 text-ink font-mono text-[13px] leading-none font-medium tracking-[0.06em] uppercase px-1.5 py-3.5 cursor-pointer underline decoration-acc decoration-2 underline-offset-[5px] grow sm:grow-0 hover:text-acct"
                  >
                    ? What am I looking at
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <main className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)]">
          {showWork && (
            <WorkSection projects={projects} loading={loadingProjects} error={projectsError} />
          )}
          {showHangar && <HangarSection />}
          {showAbout && <AboutSection />}
          {showContact && <ContactSection />}
        </main>

        <SiteFooter />
      </div>

      <FieldDock />
      <LearnModal />
    </>
  );
}
