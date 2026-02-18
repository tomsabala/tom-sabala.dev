export interface Theme {
  name: string;
  label: string;
  colors: {
    bg: string;
    fg: string;
    fgDim: string;
    prompt: string;
    error: string;
    link: string;
    selectionBg: string;
    selectionFg: string;
    cursor: string;
    accent?: string;
    warning?: string;
    success?: string;
    border?: string;
  };
}

export const themes: Theme[] = [
  {
    name: 'default',
    label: 'Default (Green)',
    colors: {
      bg: '#0a0e14',
      fg: '#33ff33',
      fgDim: '#1a8c1a',
      prompt: '#5cff5c',
      error: '#ff5555',
      link: '#5caaff',
      selectionBg: '#33ff3340',
      selectionFg: '#ffffff',
      cursor: '#33ff33',
      accent: '#5cff5c',
      warning: '#ffaa00',
      success: '#5cff5c',
      border: '#1a8c1a',
    },
  },
  {
    name: 'dracula',
    label: 'Dracula',
    colors: {
      bg: '#282a36',
      fg: '#f8f8f2',
      fgDim: '#6272a4',
      prompt: '#50fa7b',
      error: '#ff5555',
      link: '#8be9fd',
      selectionBg: '#44475a',
      selectionFg: '#f8f8f2',
      cursor: '#f8f8f2',
      accent: '#bd93f9',
      warning: '#f1fa8c',
      success: '#50fa7b',
      border: '#6272a4',
    },
  },
  {
    name: 'nord',
    label: 'Nord',
    colors: {
      bg: '#2e3440',
      fg: '#d8dee9',
      fgDim: '#4c566a',
      prompt: '#a3be8c',
      error: '#bf616a',
      link: '#88c0d0',
      selectionBg: '#434c5e',
      selectionFg: '#eceff4',
      cursor: '#d8dee9',
      accent: '#81a1c1',
      warning: '#ebcb8b',
      success: '#a3be8c',
      border: '#4c566a',
    },
  },
  {
    name: 'gruvbox',
    label: 'Gruvbox',
    colors: {
      bg: '#282828',
      fg: '#ebdbb2',
      fgDim: '#928374',
      prompt: '#b8bb26',
      error: '#fb4934',
      link: '#83a598',
      selectionBg: '#3c3836',
      selectionFg: '#ebdbb2',
      cursor: '#ebdbb2',
      accent: '#d79921',
      warning: '#fabd2f',
      success: '#b8bb26',
      border: '#928374',
    },
  },
  {
    name: 'matrix',
    label: 'Matrix',
    colors: {
      bg: '#000000',
      fg: '#00ff41',
      fgDim: '#008f11',
      prompt: '#00ff41',
      error: '#ff0000',
      link: '#00cc33',
      selectionBg: '#00ff4130',
      selectionFg: '#ffffff',
      cursor: '#00ff41',
      accent: '#00ff41',
      warning: '#ffaa00',
      success: '#00ff41',
      border: '#008f11',
    },
  },
  {
    name: 'catppuccin-mocha',
    label: 'Catppuccin Mocha',
    colors: {
      bg: '#1e1e2e',
      fg: '#cdd6f4',
      fgDim: '#585b70',
      prompt: '#a6e3a1',
      error: '#f38ba8',
      link: '#89b4fa',
      selectionBg: '#45475a',
      selectionFg: '#cdd6f4',
      cursor: '#cdd6f4',
      accent: '#cba6f7',
      warning: '#f9e2af',
      success: '#a6e3a1',
      border: '#585b70',
    },
  },
  {
    name: 'amber',
    label: 'Amber',
    colors: {
      bg: '#0a0a00',
      fg: '#ffbf00',
      fgDim: '#996600',
      prompt: '#ffd700',
      error: '#ff4444',
      link: '#ffaa00',
      selectionBg: '#ffbf0030',
      selectionFg: '#ffffff',
      cursor: '#ffbf00',
      accent: '#ffd700',
      warning: '#ffaa00',
      success: '#ffd700',
      border: '#996600',
    },
  },
];

const STORAGE_KEY = 'terminal-theme';

export function getStoredThemeName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function storeThemeName(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage unavailable
  }
}

export function getThemeByName(name: string): Theme | undefined {
  return themes.find(t => t.name === name);
}

const BASE_COLOR_TO_VAR: Record<string, string> = {
  bg: '--term-bg',
  fg: '--term-fg',
  fgDim: '--term-fg-dim',
  prompt: '--term-prompt',
  error: '--term-error',
  link: '--term-link',
  selectionBg: '--term-selection-bg',
  selectionFg: '--term-selection-fg',
  cursor: '--term-cursor',
};

export function applyTheme(theme: Theme, container: HTMLElement): void {
  const c = theme.colors;

  for (const [key, cssVar] of Object.entries(BASE_COLOR_TO_VAR)) {
    container.style.setProperty(cssVar, c[key as keyof typeof c] as string);
  }

  // Extended colors with fallbacks
  container.style.setProperty('--term-accent', c.accent || c.prompt);
  container.style.setProperty('--term-warning', c.warning || '#ffaa00');
  container.style.setProperty('--term-success', c.success || c.prompt);
  container.style.setProperty('--term-border', c.border || c.fgDim);

  document.body.style.backgroundColor = c.bg;
}
