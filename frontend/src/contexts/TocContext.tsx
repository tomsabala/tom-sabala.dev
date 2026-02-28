import { createContext, useContext, useState, type ReactNode } from 'react';

export interface TocItem {
  id: string;
  label: string;
  children?: TocItem[];
}

interface TocContextValue {
  toc: TocItem[];
  activeId: string;
  tocTitle: string;
  setToc: (items: TocItem[]) => void;
  setActiveId: (id: string) => void;
  setTocTitle: (title: string) => void;
}

const TocContext = createContext<TocContextValue>({
  toc: [],
  activeId: '',
  tocTitle: '',
  setToc: () => {},
  setActiveId: () => {},
  setTocTitle: () => {},
});

export function TocProvider({ children }: { children: ReactNode }) {
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [tocTitle, setTocTitle] = useState('');

  return (
    <TocContext.Provider value={{ toc, activeId, tocTitle, setToc, setActiveId, setTocTitle }}>
      {children}
    </TocContext.Provider>
  );
}

export function useToc() {
  return useContext(TocContext);
}
