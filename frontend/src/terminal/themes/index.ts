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

export function storeThemeName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage unavailable
  }
}

export function getThemeByName(name: string): Theme | undefined {
  return themes.find(t => t.name === name);
}

export function applyTheme(theme: Theme, container: HTMLElement) {
  const { colors } = theme;
  container.style.setProperty('--term-bg', colors.bg);
  container.style.setProperty('--term-fg', colors.fg);
  container.style.setProperty('--term-fg-dim', colors.fgDim);
  container.style.setProperty('--term-prompt', colors.prompt);
  container.style.setProperty('--term-error', colors.error);
  container.style.setProperty('--term-link', colors.link);
  container.style.setProperty('--term-selection-bg', colors.selectionBg);
  container.style.setProperty('--term-selection-fg', colors.selectionFg);
  container.style.setProperty('--term-cursor', colors.cursor);
  // Also set body bg so the whole page matches
  document.body.style.backgroundColor = colors.bg;
}
