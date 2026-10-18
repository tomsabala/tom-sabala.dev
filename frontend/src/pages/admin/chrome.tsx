/**
 * Shell ↔ screen contract for the admin console.
 *
 * The sticky page header is owned by the shell but its primary action belongs to whichever
 * screen is mounted, so a screen registers one through `usePrimaryAction` and the shell
 * renders it. Dashboard stats are fetched once by the shell (the rail badges need them) and
 * handed down here so no screen re-fetches them.
 */
import { createContext, useContext, useEffect } from 'react';
import type { DashboardStats } from '../../types/index.ts';

export type AdminScreenKey = 'overview' | 'pipeline' | 'content' | 'inbox' | 'hangar' | 'visibility';

export interface AdminScreenMeta {
  /** Mono index rendered as the page-header crumb. */
  crumb: string;
  /** Uppercase page title. */
  title: string;
  /** Rail glyph. */
  glyph: string;
  /** Rail label. */
  label: string;
  /** URL for this screen. */
  path: string;
}

export const ADMIN_SCREENS: Record<AdminScreenKey, AdminScreenMeta> = {
  overview: { crumb: '00', title: 'Mission control', glyph: '◎', label: 'Overview', path: '/admin' },
  pipeline: { crumb: '01', title: 'Pipeline', glyph: '▤', label: 'Pipeline', path: '/admin/pipeline' },
  content: { crumb: '02', title: 'Content', glyph: '▦', label: 'Content', path: '/admin/content' },
  inbox: { crumb: '03', title: 'Inbox', glyph: '✉', label: 'Inbox', path: '/admin/inbox' },
  hangar: { crumb: '04', title: 'Hangar', glyph: '▣', label: 'Hangar', path: '/admin/hangar' },
  visibility: { crumb: '05', title: 'Visibility', glyph: '⚙', label: 'Visibility', path: '/admin/visibility' },
};

/** Rail grouping, in render order. */
export const ADMIN_NAV: Array<{ label: string; items: AdminScreenKey[] }> = [
  { label: 'COMMAND', items: ['overview'] },
  { label: 'JOB HUNT', items: ['pipeline'] },
  { label: 'SITE', items: ['content', 'inbox', 'hangar', 'visibility'] },
];

/**
 * `/admin` and anything unrecognised resolve to the overview — a mistyped screen must never
 * be a crash or a blank page.
 */
export function resolveScreenKey(raw: string | undefined): AdminScreenKey {
  if (raw && raw in ADMIN_SCREENS) return raw as AdminScreenKey;
  return 'overview';
}

export interface PrimaryAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Native tooltip — used to explain a permanently disabled action. */
  title?: string;
}

export type NoticeKind = 'ok' | 'err';

export interface AdminChromeValue {
  stats: DashboardStats | null;
  statsLoading: boolean;
  statsError: string | null;
  refreshStats: () => void;
  setPrimary: (action: PrimaryAction | null) => void;
  notify: (kind: NoticeKind, message: string) => void;
}

const AdminChromeContext = createContext<AdminChromeValue>({
  stats: null,
  statsLoading: false,
  statsError: null,
  refreshStats: () => {},
  setPrimary: () => {},
  notify: () => {},
});

export const AdminChromeProvider = AdminChromeContext.Provider;

export function useAdminChrome(): AdminChromeValue {
  return useContext(AdminChromeContext);
}

/**
 * Publish this screen's primary action to the shell header and withdraw it on unmount.
 * `deps` carries whatever the handler closes over, exactly like `useEffect`.
 */
export function usePrimaryAction(action: PrimaryAction | null, deps: unknown[]): void {
  const { setPrimary } = useAdminChrome();
  useEffect(() => {
    setPrimary(action);
    return () => setPrimary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
