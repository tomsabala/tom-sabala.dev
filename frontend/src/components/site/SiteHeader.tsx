/**
 * Landing-page header: sticky, blurred, one row on desktop and two on a phone (identity +
 * controls, then a horizontally scrollable nav strip). The `TS` mark is also the hidden
 * admin entrance — seven clicks inside two seconds. Once a session exists the gesture is
 * redundant: the console gets a plain link, because a signed-in admin re-performing a
 * secret handshake to reach their own dashboard is a puzzle, not a safeguard.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import ThemeToggle from './ThemeToggle.tsx';
import LoginModal from '../LoginModal.tsx';

export interface NavLink {
  href: string;
  label: string;
}

interface SiteHeaderProps {
  links: NavLink[];
}

export default function SiteHeader({ links }: SiteHeaderProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const clicks = useRef<number[]>([]);
  const [loginOpen, setLoginOpen] = useState(false);

  const onLogo = () => {
    const now = Date.now();
    clicks.current = clicks.current.filter(t => now - t < 2000).concat(now);
    if (clicks.current.length < 7) return;
    clicks.current = [];
    if (isAuthenticated) navigate('/admin');
    else setLoginOpen(true);
  };

  return (
    <header
      data-panel="1"
      className="sticky top-0 z-30 border-b border-ln cursor-auto"
      style={{
        background: 'color-mix(in oklab, var(--bg) 84%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="max-w-[1360px] mx-auto px-[clamp(16px,4vw,48px)] py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-3 sm:gap-3.5 justify-between md:justify-start min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 md:flex-none">
            <button
              type="button"
              onClick={onLogo}
              aria-label="Tom Sabała"
              className="w-[34px] h-[34px] shrink-0 border border-acct bg-transparent text-acct font-mono text-[12px] leading-none font-medium cursor-pointer p-0 flex items-center justify-center"
            >
              TS
            </button>
            <span className="font-mono text-[12px] leading-none font-medium text-mut tracking-[0.06em] uppercase truncate">
              tom-sabala.dev
            </span>
          </div>
          <div className="flex items-center gap-2 md:hidden shrink-0">
            <ThemeToggle />
            {isAuthenticated && <AdminChip />}
            <TerminalChip />
          </div>
        </div>

        <nav className="flex items-center gap-[clamp(14px,2.2vw,30px)] font-mono text-[13px] leading-none uppercase tracking-[0.06em] overflow-x-auto md:overflow-visible whitespace-nowrap -mx-1 px-1 md:mx-0 md:px-0">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-ink no-underline hover:text-acct shrink-0">
              {l.label}
            </a>
          ))}
          <div className="hidden md:flex items-center gap-[clamp(14px,2.2vw,30px)]">
            <ThemeToggle />
            {isAuthenticated && <AdminChip />}
            <TerminalChip />
          </div>
        </nav>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </header>
  );
}

/** Only rendered for a live session, so it discloses nothing to an anonymous visitor. */
function AdminChip() {
  return (
    <Link
      to="/admin"
      className="text-acct no-underline border border-acct px-3 py-2.5 font-mono text-[13px] leading-none shrink-0 hover:bg-acc hover:text-onacc hover:border-acc"
    >
      admin
    </Link>
  );
}

function TerminalChip() {
  return (
    <a
      href="https://terminal.tom-sabala.dev"
      target="_blank"
      rel="noopener"
      className="text-onacc bg-acc no-underline px-3 py-2.5 font-mono text-[13px] leading-none shrink-0 hover:bg-ink hover:text-bg"
    >
      &gt;_ terminal
    </a>
  );
}
