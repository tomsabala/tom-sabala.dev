import type { Command, CommandResult, TerminalContext } from './types';

const commands = new Map<string, Command>();
const aliases = new Map<string, string>();

export function registerCommand(command: Command) {
  commands.set(command.name, command);
  if (command.aliases) {
    for (const alias of command.aliases) {
      aliases.set(alias, command.name);
    }
  }
}

function resolveCommand(name: string): Command | undefined {
  return commands.get(name) || commands.get(aliases.get(name) || '');
}

export async function execute(rawInput: string, ctx: TerminalContext): Promise<CommandResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { output: [] };
  }

  const parts = trimmed.split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = resolveCommand(commandName);
  if (!command) {
    return {
      output: [
        { text: `Command not found: ${commandName}. Type 'help' for available commands.` },
      ],
    };
  }

  return command.execute(args, ctx);
}

export function getSuggestions(partial: string): string[] {
  const lower = partial.toLowerCase();
  const matches: string[] = [];

  for (const name of commands.keys()) {
    if (name.startsWith(lower)) {
      matches.push(name);
    }
  }
  for (const alias of aliases.keys()) {
    if (alias.startsWith(lower)) {
      matches.push(alias);
    }
  }

  return matches.sort();
}

export function getAllCommands(): Command[] {
  return Array.from(commands.values());
}
