/**
 * Opaque footer closing the landing page. `data-panel="1"` keeps clicks here out of the
 * field, and the blinking block is a plain element, not an animation.
 */
export default function SiteFooter() {
  return (
    <footer data-panel="1" className="relative z-[1] border-t border-ln bg-bg">
      <div className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)] py-7 flex justify-between items-center gap-5 flex-wrap font-mono text-[12px] leading-none text-mut tracking-[0.04em]">
        <span>© {new Date().getFullYear()} Tom Sabała · no robots were harmed</span>
        <a
          href="https://terminal.tom-sabala.dev"
          target="_blank"
          rel="noopener"
          className="text-mut no-underline flex gap-2 items-center hover:text-acct"
        >
          <span className="text-acct">tom@sabala:~$</span>
          <span>ssh into the site</span>
          <span className="w-2 h-3.5 bg-acc block" />
        </a>
      </div>
    </footer>
  );
}
