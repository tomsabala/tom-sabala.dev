import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import LoginModal from './LoginModal.tsx';
import LogoMark from './LogoMark.tsx';
import TerminalBackground from './TerminalBackground.tsx';
import { useTheme } from '../contexts/ThemeContext.tsx';

const navItems = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    to: '/cv',
    label: 'CV',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/contact',
    label: 'Contact',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
];

function Layout() {
  const { isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [expanded, setExpanded] = useState(() =>
    localStorage.getItem('sidebarExpanded') === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const clickTimestamps = useRef<number[]>([]);
  const [clickCount, setClickCount] = useState(0);

  const handleLogoClick = () => {
    if (isAuthenticated) return;

    const now = Date.now();
    clickTimestamps.current.push(now);
    clickTimestamps.current = clickTimestamps.current.filter(
      ts => now - ts <= 2000
    );
    setClickCount(clickTimestamps.current.length);

    if (clickTimestamps.current.length >= 7) {
      setIsLoginModalOpen(true);
      clickTimestamps.current = [];
      setClickCount(0);
    }
  };

  useEffect(() => {
    if (clickCount > 0) {
      const timer = setTimeout(() => {
        setClickCount(0);
        clickTimestamps.current = [];
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [clickCount]);

  const toggleSidebar = () => {
    setExpanded(prev => {
      const next = !prev;
      localStorage.setItem('sidebarExpanded', String(next));
      return next;
    });
  };

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <TerminalBackground />

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 flex items-center justify-center w-9 h-9 rounded-md bg-white dark:bg-[#1a1a1a] shadow-md text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        type="button"
        aria-label="Open navigation"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="2" y1="4" x2="16" y2="4"/>
          <line x1="2" y1="9" x2="16" y2="9"/>
          <line x1="2" y1="14" x2="16" y2="14"/>
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          flex-shrink-0 bg-white dark:bg-[#1a1a1a] flex flex-col h-full overflow-hidden
          fixed inset-y-0 left-0 z-50
          md:relative md:z-auto
          transition-transform duration-[250ms]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: mobileOpen ? '220px' : (expanded ? '220px' : '56px'),
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Logo row */}
        <div className="flex items-center h-14 px-3 flex-shrink-0 gap-2">
          <LogoMark onClick={handleLogoClick} />
          {expanded && (
            <span className="flex-1 ml-1 font-semibold text-gray-900 dark:text-gray-100 text-sm whitespace-nowrap overflow-hidden">
              Tom Sabała
            </span>
          )}
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              type="button"
              aria-label="Close navigation"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="1" y1="1" x2="13" y2="13"/>
                <line x1="13" y1="1" x2="1" y2="13"/>
              </svg>
            </button>
          )}
          {expanded && (
            <button
              onClick={toggleTheme}
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              type="button"
            >
              {theme === 'light' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="w-full h-px bg-gray-100 dark:bg-gray-700 flex-shrink-0" />

        {/* Nav items */}
        <nav className="flex-1 py-3 overflow-hidden">
          {navItems.map(({ to, label, icon }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                title={!expanded ? label : undefined}
                className={`relative flex items-center h-10 px-3 mx-1 rounded-md transition-colors ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                style={active ? { color: 'var(--accent)' } : undefined}
              >
                {/* Active dot */}
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{ background: 'var(--accent)' }}
                  />
                )}
                <span className="flex-shrink-0">{icon}</span>
                {expanded && (
                  <span className="ml-3 text-sm font-medium whitespace-nowrap">{label}</span>
                )}
              </Link>
            );
          })}

          {/* Terminal — external link */}
          <a
            href="https://terminal.tom-sabala.dev"
            target="_blank"
            rel="noopener noreferrer"
            title={!expanded ? 'Terminal' : undefined}
            className="flex items-center h-10 px-3 mx-1 rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5"/>
                <line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </span>
            {expanded && (
              <span className="ml-3 text-sm font-medium whitespace-nowrap flex items-center gap-1">
                Terminal
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </span>
            )}
          </a>
        </nav>

        <div className="w-full h-px bg-gray-100 dark:bg-gray-700 flex-shrink-0" />

        {/* Social + sign out */}
        <div className="py-3 overflow-hidden">
          <a
            href="https://github.com/tomsabala"
            target="_blank"
            rel="noopener noreferrer"
            title={!expanded ? 'GitHub' : undefined}
            className="flex items-center h-10 px-3 mx-1 rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </span>
            {expanded && (
              <span className="ml-3 text-sm font-medium whitespace-nowrap">GitHub</span>
            )}
          </a>

          <a
            href="https://www.linkedin.com/in/tom-sabala-a9513721a/"
            target="_blank"
            rel="noopener noreferrer"
            title={!expanded ? 'LinkedIn' : undefined}
            className="flex items-center h-10 px-3 mx-1 rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <span className="flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </span>
            {expanded && (
              <span className="ml-3 text-sm font-medium whitespace-nowrap">LinkedIn</span>
            )}
          </a>

          {/* Sign Out (admin only) */}
          {isAuthenticated && (
            <button
              onClick={logout}
              title={!expanded ? 'Sign Out' : undefined}
              className="flex items-center h-10 px-3 mx-1 w-[calc(100%-8px)] rounded-md transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              type="button"
            >
              <span className="flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </span>
              {expanded && (
                <span className="ml-3 text-sm font-medium whitespace-nowrap">Sign Out</span>
              )}
            </button>
          )}
        </div>

        <div className="w-full h-px bg-gray-100 dark:bg-gray-700 flex-shrink-0" />

        {/* Collapse toggle */}
        <div className="flex-shrink-0 h-12 flex items-center px-3">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-8 h-8 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            type="button"
          >
            {expanded ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}

export default Layout;
