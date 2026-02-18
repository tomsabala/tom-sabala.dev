export const HOSTNAME = 'visitor@tom-sabala.dev';

export function getPrompt(currentDir: string): string {
  return `${HOSTNAME}:${currentDir}$ `;
}

export const PROMPT = getPrompt('~');
