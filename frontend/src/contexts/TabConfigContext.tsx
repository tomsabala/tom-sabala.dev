import { createContext, useContext, useState, useEffect } from 'react';
import { getVisibleTabs, getAdminTabConfigs } from '../repositories/settingsRepository.ts';
import { useAuth } from './AuthContext.tsx';

interface TabConfigContextValue {
  /** Set of tab keys visible to the public. null = still loading or admin (show all). */
  visibleTabs: Set<string> | null;
  /** Tab keys that are hidden from public visitors. Only populated for admin. */
  hiddenFromPublic: Set<string>;
  /** Re-fetch tab configs — call after saving changes in Settings. */
  refreshTabConfigs: () => void;
}

const TabConfigContext = createContext<TabConfigContextValue>({
  visibleTabs: null,
  hiddenFromPublic: new Set(),
  refreshTabConfigs: () => {},
});

export function TabConfigProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [visibleTabs, setVisibleTabs] = useState<Set<string> | null>(null);
  const [hiddenFromPublic, setHiddenFromPublic] = useState<Set<string>>(new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshTabConfigs = () => setRefreshTick(t => t + 1);

  useEffect(() => {
    // Wait for auth to resolve before doing anything
    if (isLoading) return;

    if (isAuthenticated) {
      // Admin sees all tabs — fetch the full config to know which are hidden from public
      setVisibleTabs(null);
      getAdminTabConfigs()
        .then(configs => {
          const hidden = new Set(
            Object.entries(configs)
              .filter(([, v]) => !v)
              .map(([k]) => k)
          );
          setHiddenFromPublic(hidden);
        })
        .catch(() => setHiddenFromPublic(new Set()));
      return;
    }

    // Public visitor — fetch only visible tabs
    setHiddenFromPublic(new Set());
    let cancelled = false;
    getVisibleTabs().then(tabs => {
      if (!cancelled) setVisibleTabs(tabs);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, isLoading, refreshTick]);

  return (
    <TabConfigContext.Provider value={{ visibleTabs, hiddenFromPublic, refreshTabConfigs }}>
      {children}
    </TabConfigContext.Provider>
  );
}

export function useTabConfig() {
  return useContext(TabConfigContext);
}

/**
 * Returns true if a given tab key should be shown to the current user.
 * - Auth still loading: true (optimistic — avoids flash of 404)
 * - Admin: always true
 * - Loaded public visitor: true only if key is in the visible set
 */
export function useIsTabVisible(tabKey: string): boolean {
  const { visibleTabs } = useTabConfig();
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return true;       // optimistic while resolving
  if (isAuthenticated) return true; // admin always passes
  if (visibleTabs === null) return true;
  return visibleTabs.has(tabKey);
}
