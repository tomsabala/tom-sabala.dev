/**
 * Admin console shell.
 *
 * One 232px sticky rail plus a sticky page header over an `<Outlet/>`. Below `lg` the rail
 * is an off-canvas drawer behind a backdrop, opened by the hamburger in the page header —
 * the console is used from a phone and a 232px column there would leave nothing for content.
 *
 * Router contract (App.tsx owns the table):
 *   <Route path="/admin" element={<ProtectedRoute><Admin/></ProtectedRoute>}>
 *     <Route index element={<AdminScreenRoute/>}/>
 *     <Route path=":screen" element={<AdminScreenRoute/>}/>
 *   </Route>
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useTheme } from '../contexts/ThemeContext.tsx';
import { getDashboardStats } from '../repositories/dashboardRepository.ts';
import { apiErrorMessage } from '../repositories/apiError.ts';
import { HOSTED_APPS } from '../apps/registry.ts';
import type { DashboardStats } from '../types/index.ts';
import {
  ADMIN_NAV,
  ADMIN_SCREENS,
  AdminChromeProvider,
  resolveScreenKey,
  type AdminScreenKey,
  type NoticeKind,
  type PrimaryAction,
} from './admin/chrome.tsx';
import AdminOverview from './admin/AdminOverview.tsx';
import AdminPipeline from './admin/AdminPipeline.tsx';
import AdminContent from './admin/AdminContent.tsx';
import AdminInbox from './admin/AdminInbox.tsx';
import AdminHangar from './admin/AdminHangar.tsx';
import AdminVisibility from './admin/AdminVisibility.tsx';

const SCREEN_COMPONENTS: Record<AdminScreenKey, () => JSX.Element> = {
  overview: AdminOverview,
  pipeline: AdminPipeline,
  content: AdminContent,
  inbox: AdminInbox,
  hangar: AdminHangar,
  visibility: AdminVisibility,
};

export { ADMIN_SCREENS } from './admin/chrome.tsx';
export type { AdminScreenKey } from './admin/chrome.tsx';

/** Resolves `:screen` to a screen component; no param and unknown values land on overview. */
export function AdminScreenRoute(): JSX.Element {
  const { screen } = useParams<{ screen?: string }>();
  const Screen = SCREEN_COMPONENTS[resolveScreenKey(screen)];
  return <Screen />;
}

interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

export default function Admin(): JSX.Element {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsTick, setStatsTick] = useState(0);
  const [primary, setPrimary] = useState<PrimaryAction | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const noticeId = useRef(0);

  const current = resolveScreenKey(pathname.replace(/^\/admin\/?/, '').split('/')[0] || undefined);
  const meta = ADMIN_SCREENS[current];

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    getDashboardStats()
      .then(res => {
        if (cancelled) return;
        if (res.success) {
          setStats(res.data);
          setStatsError(null);
        } else {
          setStatsError('Could not load console stats');
        }
      })
      .catch(err => {
        if (!cancelled) setStatsError(apiErrorMessage(err, 'Could not load console stats'));
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statsTick]);

  // A navigation always closes the drawer: on a phone the screen underneath has changed.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const notify = useCallback((kind: NoticeKind, message: string) => {
    noticeId.current += 1;
    const id = noticeId.current;
    setNotices(prev => [...prev, { id, kind, message }]);
    window.setTimeout(() => setNotices(prev => prev.filter(n => n.id !== id)), 5000);
  }, []);

  const refreshStats = useCallback(() => setStatsTick(t => t + 1), []);

  const chrome = useMemo(
    () => ({ stats, statsLoading, statsError, refreshStats, setPrimary, notify }),
    [stats, statsLoading, statsError, refreshStats, notify]
  );

  const badges: Partial<Record<AdminScreenKey, string>> = {
    pipeline: stats && stats.activeApplications > 0 ? String(stats.activeApplications) : '',
    inbox: stats && stats.unreadMessages > 0 ? String(stats.unreadMessages) : '',
    hangar: String(HOSTED_APPS.length),
  };

  const signOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'color-mix(in oklab, var(--ink) 45%, transparent)' }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Console navigation"
        className={`fixed lg:sticky inset-y-0 left-0 top-0 z-50 w-[232px] shrink-0 h-screen bg-bg border-r border-ln2 flex flex-col transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-[18px] pt-[18px] pb-4 flex items-center gap-3 border-b border-ln">
          <span className="w-[34px] h-[34px] bg-acc text-onacc font-mono text-[12px] leading-none font-medium flex items-center justify-center">
            TS
          </span>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="font-mono text-[12px] leading-none font-medium tracking-[0.06em]">OPERATOR</span>
            <span className="font-mono text-[11px] leading-none text-acct">● session live</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden ml-auto bg-transparent border-0 text-mut font-mono text-[16px] leading-none cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-2.5 py-3 flex flex-col gap-0.5 overflow-auto">
          {ADMIN_NAV.map(group => (
            <div key={group.label} className="flex flex-col gap-0.5 mb-3">
              <span className="font-mono text-[10px] leading-none font-medium tracking-[0.14em] text-mut px-2.5 pt-2 pb-1.5">
                {group.label}
              </span>
              {group.items.map(key => {
                const item = ADMIN_SCREENS[key];
                const active = key === current;
                return (
                  <Link
                    key={key}
                    to={item.path}
                    aria-current={active ? 'page' : undefined}
                    className="flex items-center justify-between gap-2 px-2.5 py-2.5 font-mono text-[13px] leading-none font-medium tracking-[0.02em] no-underline"
                    style={{
                      background: active ? 'var(--ink)' : 'transparent',
                      color: active ? 'var(--bg)' : 'var(--ink)',
                    }}
                  >
                    <span className="flex gap-2.5 items-center">
                      <span className="w-3.5" style={{ color: active ? 'var(--acc)' : 'var(--mut)' }}>
                        {item.glyph}
                      </span>
                      {item.label}
                    </span>
                    <span className="text-[11px]" style={{ color: active ? 'var(--acc)' : 'var(--mut)' }}>
                      {badges[key] ?? ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-ln px-2.5 py-3 flex flex-col gap-0.5 font-mono text-[12px] leading-none">
          <Link to="/" className="text-ink2 no-underline px-2.5 py-2.5">
            ↗ View public site
          </Link>
          <a
            href="https://apps.tom-sabala.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink2 no-underline px-2.5 py-2.5"
          >
            ↗ apps.
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            className="bg-transparent border-0 text-ink2 font-mono text-[12px] leading-none text-left px-2.5 py-2.5 cursor-pointer"
          >
            {theme === 'dark' ? '◐ Light theme' : '◑ Dark theme'}
          </button>
          <button
            type="button"
            onClick={signOut}
            className="bg-transparent border-0 text-mut font-mono text-[12px] leading-none text-left px-2.5 py-2.5 cursor-pointer"
          >
            ⏻ Sign out
          </button>
        </div>
      </aside>

      <main
        className="flex-1 min-w-0"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in oklab, var(--mut) 26%, transparent) 1px, transparent 1.2px)',
          backgroundSize: '32px 32px',
        }}
      >
        <div
          className="sticky top-0 z-30 border-b border-ln px-[clamp(16px,4vw,32px)] py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
          style={{
            background: 'color-mix(in oklab, var(--bg) 90%, transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              className="lg:hidden shrink-0 border border-ln2 bg-transparent text-ink font-mono text-[14px] leading-none px-2.5 py-2.5 cursor-pointer"
            >
              ☰
            </button>
            <span className="font-mono text-[11px] leading-none tracking-[0.1em] text-mut shrink-0">
              {meta.crumb} /
            </span>
            <h1 className="m-0 font-display font-extrabold uppercase text-[20px] sm:text-[28px] leading-none tracking-[-0.02em] truncate [font-stretch:120%]">
              {meta.title}
            </h1>
          </div>
          {primary && (
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              title={primary.title}
              className="w-full lg:w-auto bg-acc text-onacc border-0 font-mono text-[12px] leading-none font-medium uppercase tracking-[0.06em] px-3.5 py-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {primary.label}
            </button>
          )}
        </div>

        {notices.length > 0 && (
          <div className="px-[clamp(16px,4vw,32px)] pt-4 flex flex-col gap-2">
            {notices.map(n => (
              <div
                key={n.id}
                role={n.kind === 'err' ? 'alert' : 'status'}
                className="border px-3 py-2.5 font-mono text-[12px] leading-[1.45]"
                style={{
                  borderColor: n.kind === 'err' ? '#b3261e' : 'var(--ln2)',
                  color: n.kind === 'err' ? '#b3261e' : 'var(--ink)',
                  background: 'var(--bg)',
                }}
              >
                {n.message}
              </div>
            ))}
          </div>
        )}

        <div className="px-[clamp(16px,4vw,32px)] pt-7 pb-16 flex flex-col gap-5">
          <AdminChromeProvider value={chrome}>
            <Outlet />
          </AdminChromeProvider>
        </div>
      </main>
    </div>
  );
}
