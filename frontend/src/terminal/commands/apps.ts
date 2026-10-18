import { registerCommand } from './registry';
import { HOSTED_APPS, appEntryUrl, type HostedApp } from '../../apps/registry';
import type { CommandResult, OutputLine } from './types';

const DIM = 'var(--term-fg-dim)';
const ACCENT = 'var(--term-accent)';
const ERROR = 'var(--term-error)';
const APPS_ORIGIN = 'https://apps.tom-sabala.dev';

/** Only what an anonymous visitor would also see on apps.tom-sabala.dev. */
const PUBLIC_APPS = HOSTED_APPS.filter(app => app.access === 'public');

/** `768 MB` / `1 GB` from the build-time runtime block; `—` for bundles, which run nowhere. */
function memoryOf(app: HostedApp): string {
  if (app.kind !== 'service') return '—';
  const mb = app.runtime?.memoryMb;
  if (!mb) return '—';
  return mb >= 1024 && mb % 1024 === 0 ? `${mb / 1024} GB` : `${mb} MB`;
}

registerCommand({
  name: 'apps',
  description: 'List hosted units on apps.tom-sabala.dev',
  usage: 'apps [open <slug>]',
  execute: (args: string[]): CommandResult => {
    if (args[0] === 'open') {
      const slug = args[1];
      if (!slug) {
        return { output: [{ text: 'Usage: apps open <slug>', color: DIM }] };
      }
      const app = PUBLIC_APPS.find(a => a.slug === slug.toLowerCase());
      if (!app) {
        return { output: [{ text: `apps: no unit called ${slug}`, color: ERROR }] };
      }
      const claim = app.kind === 'service'
        ? `${app.mode === 'session' ? 'private instance' : 'shared instance'} · ${app.name}`
        : `static bundle · ${app.name}`;
      return {
        output: [{ text: `broker  claim ${claim}`, color: ACCENT }],
        sideEffect: { type: 'open', url: `${APPS_ORIGIN}${appEntryUrl(app)}` },
      };
    }

    if (args.length > 0) {
      return { output: [{ text: 'Usage: apps [open <slug>]', color: DIM }] };
    }

    if (PUBLIC_APPS.length === 0) {
      return { output: [{ text: 'no public units', color: DIM }] };
    }

    const slugWidth = Math.max(...PUBLIC_APPS.map(a => a.slug.length), 16);
    const lines: OutputLine[] = [
      { text: `UNIT  ${'SLUG'.padEnd(slugWidth)}  ${'MODE'.padEnd(8)}  MEMORY`, color: DIM },
    ];

    PUBLIC_APPS.forEach((app, i) => {
      const unit = String(i + 1).padStart(2, '0');
      const mode = app.kind === 'service' ? app.mode : 'static';
      const status = app.status === 'live' ? '● live' : '○ wip ';
      lines.push({
        text: `  ${unit}  ${app.slug.padEnd(slugWidth)}  ${mode.padEnd(8)}  ${memoryOf(app).padEnd(6)}   ${status}   ${app.name}`,
      });
    });

    lines.push({ text: '' });
    lines.push({ text: 'apps open <slug> to launch one.', color: DIM });

    return { output: lines };
  },
});
