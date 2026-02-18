import { PERSONAL_INFO, SOCIAL_LINKS, SKILLS } from './data';
import type { PortfolioItem } from '../types/index';

export interface FSNode {
  name: string;
  type: 'dir' | 'file';
  children?: FSNode[];
  content?: string;
}

export function buildFilesystem(): FSNode {
  const root: FSNode = {
    name: '~',
    type: 'dir',
    children: [
      {
        name: 'about',
        type: 'dir',
        children: [
          { name: 'bio.txt', type: 'file', content: PERSONAL_INFO.bio },
          { name: 'location.txt', type: 'file', content: PERSONAL_INFO.location },
          { name: 'email.txt', type: 'file', content: PERSONAL_INFO.email },
        ],
      },
      {
        name: 'projects',
        type: 'dir',
        children: [],
      },
      {
        name: 'skills',
        type: 'dir',
        children: SKILLS.map(cat => ({
          name: `${cat.name.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}.txt`,
          type: 'file' as const,
          content: cat.skills.map(s => `${s.name}: ${s.level}%`).join('\n'),
        })),
      },
      {
        name: 'contact',
        type: 'dir',
        children: [
          { name: 'email.txt', type: 'file', content: PERSONAL_INFO.email },
          { name: 'website.txt', type: 'file', content: PERSONAL_INFO.website },
        ],
      },
      {
        name: 'social',
        type: 'dir',
        children: SOCIAL_LINKS.map(link => ({
          name: `${link.name}.txt`,
          type: 'file' as const,
          content: `${link.label}: ${link.url}`,
        })),
      },
      {
        name: 'cv',
        type: 'dir',
        children: [
          { name: 'download.txt', type: 'file', content: "Use 'download cv' command to download the CV." },
        ],
      },
    ],
  };

  return root;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function populateProjects(root: FSNode, projects: PortfolioItem[]): void {
  const projectsDir = root.children?.find(c => c.name === 'projects');
  if (!projectsDir) return;

  projectsDir.children = projects.map(p => {
    const children: FSNode[] = [
      { name: 'README.txt', type: 'file', content: p.description },
    ];
    if (p.technologies.length > 0) {
      children.push({ name: 'tech.txt', type: 'file', content: p.technologies.join(', ') });
    }
    const urls: string[] = [];
    if (p.live_url) urls.push(`Live: ${p.live_url}`);
    if (p.github_url) urls.push(`GitHub: ${p.github_url}`);
    if (urls.length > 0) {
      children.push({ name: 'url.txt', type: 'file', content: urls.join('\n') });
    }
    return {
      name: slugify(p.title),
      type: 'dir' as const,
      children,
    };
  });
}

const HOME_PREFIX = '/home/visitor';

/** Normalize an absolute path: resolve `.` and `..`, remove trailing slashes */
function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return '/' + resolved.join('/');
}

/** Convert display path (with ~) to absolute internal path */
export function toAbsolute(path: string): string {
  if (path === '~' || path === '') return HOME_PREFIX;
  if (path.startsWith('~/')) return HOME_PREFIX + path.slice(1);
  return path;
}

/** Convert absolute internal path to display path (with ~) */
export function toDisplay(absolutePath: string): string {
  if (absolutePath === HOME_PREFIX) return '~';
  if (absolutePath.startsWith(HOME_PREFIX + '/')) return '~' + absolutePath.slice(HOME_PREFIX.length);
  return absolutePath;
}

/**
 * Resolve a target path relative to the current directory.
 * Returns a normalized absolute path, or null if it escapes above root.
 */
export function resolvePath(currentDir: string, target: string): string | null {
  if (!target || target === '~') return HOME_PREFIX;
  if (target.startsWith('~/')) return normalizePath(HOME_PREFIX + target.slice(1));
  if (target.startsWith('/')) return normalizePath(target);

  const base = toAbsolute(currentDir);
  return normalizePath(base + '/' + target);
}

/**
 * Get a node in the filesystem tree by absolute path.
 */
export function getNode(root: FSNode, absolutePath: string): FSNode | null {
  if (absolutePath === HOME_PREFIX || absolutePath === HOME_PREFIX + '/') return root;

  if (!absolutePath.startsWith(HOME_PREFIX + '/')) return null;

  const relative = absolutePath.slice(HOME_PREFIX.length + 1);
  if (!relative) return root;

  const parts = relative.split('/').filter(Boolean);
  let current: FSNode = root;

  for (const part of parts) {
    if (current.type !== 'dir' || !current.children) return null;
    const child = current.children.find(c => c.name === part);
    if (!child) return null;
    current = child;
  }

  return current;
}

/**
 * Get tab-completion suggestions for paths.
 */
export function getPathSuggestions(currentDir: string, root: FSNode, partial: string): string[] {
  // Determine the directory to list and the prefix to match
  let dirPath: string;
  let prefix: string;

  if (!partial) {
    dirPath = toAbsolute(currentDir);
    prefix = '';
  } else if (partial.endsWith('/')) {
    dirPath = resolvePath(currentDir, partial) || toAbsolute(currentDir);
    prefix = '';
  } else {
    const lastSlash = partial.lastIndexOf('/');
    if (lastSlash === -1) {
      dirPath = toAbsolute(currentDir);
      prefix = partial;
    } else {
      const dirPart = partial.slice(0, lastSlash + 1);
      dirPath = resolvePath(currentDir, dirPart) || toAbsolute(currentDir);
      prefix = partial.slice(lastSlash + 1);
    }
  }

  const dirNode = getNode(root, dirPath);
  if (!dirNode || dirNode.type !== 'dir' || !dirNode.children) return [];

  const matches = dirNode.children
    .filter(c => c.name.startsWith(prefix))
    .map(c => {
      const lastSlash = partial.lastIndexOf('/');
      const base = lastSlash === -1 ? '' : partial.slice(0, lastSlash + 1);
      return base + c.name + (c.type === 'dir' ? '/' : '');
    });

  return matches.sort();
}
