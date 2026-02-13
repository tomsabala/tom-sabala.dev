import { useState, useCallback, useEffect, useRef } from 'react';
import { themes, getStoredThemeName, storeThemeName, getThemeByName, applyTheme, type Theme } from '../themes';

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const name = getStoredThemeName();
    return getThemeByName(name) || themes[0];
  });
  const containerRef = useRef<HTMLElement | null>(null);

  const setContainerRef = useCallback((el: HTMLElement | null) => {
    containerRef.current = el;
    if (el) {
      applyTheme(currentTheme, el);
    }
  }, [currentTheme]);

  useEffect(() => {
    if (containerRef.current) {
      applyTheme(currentTheme, containerRef.current);
    }
  }, [currentTheme]);

  const setTheme = useCallback((name: string): boolean => {
    const theme = getThemeByName(name);
    if (!theme) return false;
    setCurrentTheme(theme);
    storeThemeName(name);
    return true;
  }, []);

  return { currentTheme, setTheme, setContainerRef };
}
