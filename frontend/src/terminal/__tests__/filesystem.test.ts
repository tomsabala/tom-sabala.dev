import { describe, it, expect } from 'vitest';
import {
  buildFilesystem,
  resolvePath,
  getNode,
  getPathSuggestions,
  toDisplay,
  populateProjects,
} from '../filesystem';

describe('buildFilesystem', () => {
  it('returns a root dir node', () => {
    const root = buildFilesystem();
    expect(root.name).toBe('~');
    expect(root.type).toBe('dir');
    expect(root.children).toBeDefined();
  });

  it('has expected top-level directories', () => {
    const root = buildFilesystem();
    const names = root.children!.map(c => c.name);
    expect(names).toContain('about');
    expect(names).toContain('projects');
    expect(names).toContain('skills');
    expect(names).toContain('contact');
    expect(names).toContain('social');
    expect(names).toContain('cv');
  });

  it('about dir has files with content', () => {
    const root = buildFilesystem();
    const about = root.children!.find(c => c.name === 'about')!;
    const bio = about.children!.find(c => c.name === 'bio.txt')!;
    expect(bio.type).toBe('file');
    expect(bio.content).toBeTruthy();
  });
});

describe('resolvePath', () => {
  it('resolves ~ to home', () => {
    expect(resolvePath('~', '~')).toBe('/home/visitor');
  });

  it('resolves relative path from home', () => {
    expect(resolvePath('~', 'about')).toBe('/home/visitor/about');
  });

  it('resolves .. from subdirectory', () => {
    expect(resolvePath('~/about', '..')).toBe('/home/visitor');
  });

  it('resolves ~/path from any directory', () => {
    expect(resolvePath('~/about', '~/skills')).toBe('/home/visitor/skills');
  });

  it('resolves . to current directory', () => {
    expect(resolvePath('~/about', '.')).toBe('/home/visitor/about');
  });

  it('resolves nested relative path', () => {
    expect(resolvePath('~', 'about/bio.txt')).toBe('/home/visitor/about/bio.txt');
  });

  it('resolves empty target to home', () => {
    expect(resolvePath('~', '')).toBe('/home/visitor');
  });
});

describe('getNode', () => {
  const root = buildFilesystem();

  it('returns root for home path', () => {
    const node = getNode(root, '/home/visitor');
    expect(node).toBe(root);
  });

  it('returns directory node', () => {
    const node = getNode(root, '/home/visitor/about');
    expect(node).toBeDefined();
    expect(node!.name).toBe('about');
    expect(node!.type).toBe('dir');
  });

  it('returns file node', () => {
    const node = getNode(root, '/home/visitor/about/bio.txt');
    expect(node).toBeDefined();
    expect(node!.name).toBe('bio.txt');
    expect(node!.type).toBe('file');
  });

  it('returns null for non-existent path', () => {
    expect(getNode(root, '/home/visitor/nonexistent')).toBeNull();
  });

  it('returns null for path outside home', () => {
    expect(getNode(root, '/etc/passwd')).toBeNull();
  });
});

describe('toDisplay', () => {
  it('converts home to ~', () => {
    expect(toDisplay('/home/visitor')).toBe('~');
  });

  it('converts home subpath to ~/...', () => {
    expect(toDisplay('/home/visitor/about')).toBe('~/about');
  });

  it('leaves other paths unchanged', () => {
    expect(toDisplay('/etc/passwd')).toBe('/etc/passwd');
  });
});

describe('getPathSuggestions', () => {
  const root = buildFilesystem();

  it('suggests all children when no partial', () => {
    const suggestions = getPathSuggestions('~', root, '');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.startsWith('about/'))).toBe(true);
  });

  it('filters by partial name', () => {
    const suggestions = getPathSuggestions('~', root, 'ab');
    expect(suggestions).toContain('about/');
  });

  it('suggests children of partial directory', () => {
    const suggestions = getPathSuggestions('~', root, 'about/');
    expect(suggestions.some(s => s.includes('bio.txt'))).toBe(true);
  });

  it('returns empty for non-existent dir', () => {
    const suggestions = getPathSuggestions('~', root, 'nonexistent/');
    expect(suggestions).toEqual([]);
  });
});

describe('populateProjects', () => {
  it('adds project subdirectories', () => {
    const root = buildFilesystem();
    populateProjects(root, [
      {
        id: 1,
        title: 'My Project',
        description: 'A test project',
        technologies: ['React', 'TypeScript'],
        isVisible: true,
        displayOrder: 1,
        github_url: 'https://github.com/test/test',
      },
    ]);

    const projects = root.children!.find(c => c.name === 'projects')!;
    expect(projects.children!.length).toBe(1);
    expect(projects.children![0].name).toBe('my-project');
    expect(projects.children![0].type).toBe('dir');

    const readme = projects.children![0].children!.find(c => c.name === 'README.txt');
    expect(readme).toBeDefined();
    expect(readme!.content).toBe('A test project');

    const tech = projects.children![0].children!.find(c => c.name === 'tech.txt');
    expect(tech).toBeDefined();
    expect(tech!.content).toBe('React, TypeScript');
  });
});
