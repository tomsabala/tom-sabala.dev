import { describe, it, expect, vi } from 'vitest';
import type { TerminalContext } from '../commands/types';
import { execute, getSuggestions, getAllCommands } from '../commands/registry';

// Import all commands to register them (mirrors TerminalApp.tsx)
import '../commands/clear';
import '../commands/help';
import '../commands/about';
import '../commands/skills';
import '../commands/social';
import '../commands/contact';
import '../commands/history';
import '../commands/theme';
import '../commands/cowsay';
import '../commands/whoami';
import '../commands/sudo';
// Skipping: projects, download, open, matrix, neofetch
// (they depend on browser APIs, fetch, or dynamic imports)

function createMockContext(overrides?: Partial<TerminalContext>): TerminalContext {
  return {
    addOutput: vi.fn(),
    clearTerminal: vi.fn(),
    commands: getAllCommands,
    history: () => ['help', 'about'],
    setTheme: vi.fn(() => true),
    ...overrides,
  };
}

// --- Registry ---

describe('Command Registry', () => {
  it('registers commands and resolves by name', async () => {
    const result = await execute('whoami', createMockContext());
    expect(result.output).toEqual([{ text: 'visitor' }]);
  });

  it('resolves aliases', async () => {
    const result = await execute('cls', createMockContext());
    expect(result.sideEffect).toEqual({ type: 'clear' });
  });

  it('returns error for unknown commands', async () => {
    const result = await execute('nonexistent', createMockContext());
    expect(result.output[0].text).toContain('Command not found: nonexistent');
  });

  it('returns empty output for blank input', async () => {
    const result = await execute('   ', createMockContext());
    expect(result.output).toEqual([]);
  });

  it('is case-insensitive for command names', async () => {
    const result = await execute('WHOAMI', createMockContext());
    expect(result.output).toEqual([{ text: 'visitor' }]);
  });

  it('passes arguments to commands', async () => {
    const result = await execute('cowsay hello world', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('hello world');
  });
});

// --- Suggestions ---

describe('getSuggestions', () => {
  it('returns matching commands for partial input', () => {
    const suggestions = getSuggestions('he');
    expect(suggestions).toContain('help');
  });

  it('returns matching aliases', () => {
    const suggestions = getSuggestions('cl');
    expect(suggestions).toContain('clear');
    expect(suggestions).toContain('cls');
  });

  it('returns empty array for no matches', () => {
    expect(getSuggestions('zzz')).toEqual([]);
  });

  it('returns sorted results', () => {
    const suggestions = getSuggestions('c');
    const sorted = [...suggestions].sort();
    expect(suggestions).toEqual(sorted);
  });
});

// --- getAllCommands ---

describe('getAllCommands', () => {
  it('returns all registered commands', () => {
    const commands = getAllCommands();
    const names = commands.map(c => c.name);
    expect(names).toContain('help');
    expect(names).toContain('clear');
    expect(names).toContain('about');
    expect(names).toContain('theme');
  });

  it('does not include aliases as separate commands', () => {
    const commands = getAllCommands();
    const names = commands.map(c => c.name);
    expect(names).not.toContain('cls');
    expect(names).not.toContain('?');
  });
});

// --- Individual commands ---

describe('clear command', () => {
  it('returns clear side effect', async () => {
    const result = await execute('clear', createMockContext());
    expect(result.output).toEqual([]);
    expect(result.sideEffect).toEqual({ type: 'clear' });
  });
});

describe('help command', () => {
  it('lists all commands when called without args', async () => {
    const result = await execute('help', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Available commands:');
    expect(text).toContain('help');
    expect(text).toContain('clear');
  });

  it('shows details for a specific command', async () => {
    const result = await execute('help clear', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('clear');
    expect(text).toContain('Clear the terminal screen');
  });

  it('shows error for unknown command', async () => {
    const result = await execute('help nonexistent', createMockContext());
    expect(result.output[0].text).toContain('Unknown command: nonexistent');
  });
});

describe('about command', () => {
  it('displays personal info', async () => {
    const result = await execute('about', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Tom Sabala');
    expect(text).toContain('Poland');
    expect(text).toContain('contact@tom-sabala.dev');
  });
});

describe('skills command', () => {
  it('displays skill categories with progress bars', async () => {
    const result = await execute('skills', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Languages');
    expect(text).toContain('Python');
    expect(text).toContain('90%');
  });
});

describe('social command', () => {
  it('displays social links', async () => {
    const result = await execute('social', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Social Links:');
    const links = result.output.filter(l => l.link);
    expect(links.length).toBeGreaterThanOrEqual(2);
  });
});

describe('contact command', () => {
  it('displays contact info', async () => {
    const result = await execute('contact', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('contact@tom-sabala.dev');
  });
});

describe('history command', () => {
  it('displays command history', async () => {
    const ctx = createMockContext({ history: () => ['about', 'help'] });
    const result = await execute('history', ctx);
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('help');
    expect(text).toContain('about');
  });

  it('shows message when history is empty', async () => {
    const ctx = createMockContext({ history: () => [] });
    const result = await execute('history', ctx);
    expect(result.output[0].text).toContain('No command history');
  });
});

describe('cowsay command', () => {
  it('renders cow with default message', async () => {
    const result = await execute('cowsay', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('moo');
    expect(text).toContain('\\   ^__^');
  });

  it('renders cow with custom message', async () => {
    const result = await execute('cowsay test message', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('test message');
  });

  it('wraps long messages', async () => {
    const longMsg = 'word '.repeat(20).trim();
    const result = await execute(`cowsay ${longMsg}`, createMockContext());
    // Should produce multiple lines in the bubble
    const bubbleLines = result.output.filter(l => l.text.startsWith('/') || l.text.startsWith('|') || l.text.startsWith('\\'));
    expect(bubbleLines.length).toBeGreaterThan(1);
  });
});

describe('whoami command', () => {
  it('returns visitor', async () => {
    const result = await execute('whoami', createMockContext());
    expect(result.output).toEqual([{ text: 'visitor' }]);
  });
});

describe('sudo command', () => {
  it('shows usage when called without args', async () => {
    const result = await execute('sudo', createMockContext());
    expect(result.output[0].text).toContain('Usage: sudo');
  });

  it('responds to sudo hire-me', async () => {
    const result = await execute('sudo hire-me', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Permission granted');
    expect(text).toContain('contact@tom-sabala.dev');
  });

  it('denies other sudo commands', async () => {
    const result = await execute('sudo rm -rf /', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain("don't have sudo privileges");
  });
});

describe('theme command', () => {
  it('lists themes when called without args', async () => {
    const result = await execute('theme', createMockContext());
    const text = result.output.map(l => l.text).join('\n');
    expect(text).toContain('Available themes:');
    expect(text).toContain('dracula');
    expect(text).toContain('nord');
  });

  it('calls setTheme on context when given a name', async () => {
    const ctx = createMockContext();
    const result = await execute('theme dracula', ctx);
    expect(ctx.setTheme).toHaveBeenCalledWith('dracula');
    expect(result.output[0].text).toContain("Theme switched to 'dracula'");
  });

  it('reports error for unknown theme', async () => {
    const ctx = createMockContext({ setTheme: vi.fn(() => false) });
    const result = await execute('theme faketheme', ctx);
    expect(result.output[0].text).toContain('Unknown theme: faketheme');
  });
});
