/**
 * Opaque footer closing the landing page. `data-panel="1"` keeps clicks here out of the
 * field, and the blinking block is a plain element, not an animation.
 *
 * Three columns rather than two: the field dock is pinned to the bottom-right corner, so
 * that third cell is deliberately empty on desktop and the copyright sits centred and
 * clear of it. Below `md` the dock is a bottom bar instead, hence the extra bottom padding.
 */
export default function SiteFooter() {
  return (
    <footer data-panel="1" className="relative z-[1] border-t border-ln bg-bg cursor-auto">
      <div className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)] py-7 pb-[72px] md:pb-7 grid grid-cols-1 md:grid-cols-3 items-center gap-4 font-mono text-[12px] leading-none text-mut tracking-[0.04em]">
        <a
          href="https://terminal.tom-sabala.dev"
          target="_blank"
          rel="noopener"
          className="text-mut no-underline flex gap-2 items-center justify-self-center md:justify-self-start hover:text-acct"
        >
          <span className="text-acct">tom@sabala:~$</span>
          <span>ssh into the site</span>
          <span className="w-2 h-3.5 bg-acc block" />
        </a>
        <span className="justify-self-center md:text-center">© {new Date().getFullYear()} Tom Sabała</span>
        <span aria-hidden="true" className="hidden md:block" />
      </div>
    </footer>
  );
}
