import type { FSNode } from '../filesystem';

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
}

export interface Command {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  execute: (args: string[], ctx: TerminalContext) => Promise<CommandResult> | CommandResult;
}
