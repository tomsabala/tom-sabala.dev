import { createContext, useContext, useState, type ReactNode } from 'react';

export interface TocItem {
  id: string;
  label: string;
  children?: TocItem[];
}

interface TocContextValue {
  toc: TocItem[];
  activeId: string;
  setToc: (items: TocItem[]) => void;
  setActiveId: (id: string) => void;
}

const TocContext = createContext<TocContextValue>({
  toc: [],
  activeId: '',
  setToc: () => {},
  setActiveId: () => {},
});

export function TocProvider({ children }: { children: ReactNode }) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');

  return (
    <TocContext.Provider value={{ toc, activeId, setToc, setActiveId }}>
      {children}
    </TocContext.Provider>
  );
}

export function useToc() {
  return useContext(TocContext);
}
