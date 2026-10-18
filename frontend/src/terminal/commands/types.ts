import type { FSNode } from '../filesystem';
import type { PortfolioItem } from '../../types/index';

/**
 * What the terminal knows about the published project list. `loading` is the window
 * between mount and the first `/portfolio` response; `unavailable` means that request
 * failed, and the `projects` directory stays empty.
 */
export type ProjectsSnapshot =
  | { status: 'loading' }
  | { status: 'ready'; items: PortfolioItem[] }
  | { status: 'unavailable' };

export interface OutputLine {
  text: string;
  color?: string;
  bold?: boolean;
  link?: { href: string; label?: string };
}

export interface OutputBlock {
  command?: string;
  lines: OutputLine[];
  isPrompt?: boolean;
  promptText?: string;
}

export type SideEffect =
  | { type: 'clear' }
  | { type: 'download'; url: string; filename: string }
  | { type: 'open'; url: string };

export interface CommandResult {
  output: OutputLine[];
  sideEffect?: SideEffect;
}

export interface TerminalContext {
  addOutput: (block: OutputBlock) => void;
  clearTerminal: () => void;
  commands: () => Command[];
  history: () => string[];
  setTheme: (name: string) => boolean;
  currentDir: string;
  setCurrentDir: (path: string) => void;
  getFilesystem: () => FSNode;
  currentThemeName: () => string;
  getProjects: () => ProjectsSnapshot;
  /** Show or hide the LiDAR pane (`field on|off`). */
  setFieldVisible: (visible: boolean) => void;
  isFieldVisible: () => boolean;
  /** Regenerate the LiDAR world (`field reset`). */
  resetField: () => void;
}

export interface Command {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  execute: (args: string[], ctx: TerminalContext) => Promise<CommandResult> | CommandResult;
}
