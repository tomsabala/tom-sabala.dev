import { createContext, useContext, useState, useEffect } from 'react';
import { getVisibleTabs } from '../repositories/settingsRepository.ts';
import { useAuth } from './AuthContext.tsx';

interface TabConfigContextValue {
  /** Set of tab keys visible to the public. null = still loading. */
  visibleTabs: Set<string> | null;
}

const TabConfigContext = createContext<TabConfigContextValue>({ visibleTabs: null });

export function TabConfigProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [visibleTabs, setVisibleTabs] = useState<Set<string> | null>(null);

  useEffect(() => {
    // Admins see everything — skip the fetch entirely
    if (isAuthenticated) {
      setVisibleTabs(null); // null = "show all" when admin
      return;
    }
    getVisibleTabs().then(tabs => setVisibleTabs(tabs));
  }, [isAuthenticated]);

  return (
    <TabConfigContext.Provider value={{ visibleTabs }}>
      {children}
    </TabConfigContext.Provider>
  );
}

export function useTabConfig() {
  return useContext(TabConfigContext);
}

/**
 * Returns true if a given tab key should be shown to the current user.
 * - Admin (isAuthenticated): always true
 * - Still loading (visibleTabs === null): true (optimistic)
 * - Loaded: true only if key is in the visible set
 */
export function useIsTabVisible(tabKey: string): boolean {
  const { visibleTabs } = useTabConfig();
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return true;
  if (visibleTabs === null) return true;
  return visibleTabs.has(tabKey);
}
