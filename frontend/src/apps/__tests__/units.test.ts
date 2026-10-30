import { describe, it, expect } from 'vitest';
import { specRows } from '../units';
import type { HostedApp } from '../registry';
import type { BrokerInstance } from '../useBrokerInstances';

const service: HostedApp = {
  kind: 'service',
  slug: 'notes-api',
  name: 'Notes API',
  tagline: 'Server-rendered notebook with a Postgres backend',
  tech: ['FastAPI'],
  status: 'live',
  access: 'public',
  mode: 'session',
  runtime: {
    image: 'ghcr.io/example/notes:latest',
    port: 8080,
    memoryMb: 512,
    shmSizeMb: 64,
    dataPath: '/data',
    dataTmpfsMb: 128,
    readyPath: '/',
    capAdd: [],
  },
};

const bundle: HostedApp = {
  kind: 'bundle',
  slug: 'snake',
  name: 'Snake',
  tagline: 'Canvas arcade classic',
  tech: ['Canvas'],
  status: 'live',
  access: 'public',
};

const instances: BrokerInstance[] = [];

function keys(rows: { k: string }[]): string[] {
  return rows.map((row) => row.k);
}

function value(rows: { k: string; v: string }[], key: string): string | undefined {
  return rows.find((row) => row.k === key)?.v;
}

describe('specRows STATE row', () => {
  it('tells an anonymous visitor the instance is thrown away', () => {
    const rows = specRows(service, false, instances, 'anon');
    expect(value(rows, 'STATE')).toBe('ephemeral · reset when the instance goes idle');
    // Directly after MODE: the two rows answer the same question and are read together.
    expect(keys(rows).indexOf('STATE')).toBe(keys(rows).indexOf('MODE') + 1);
  });

  it('tells a signed-in admin the instance keeps its data', () => {
    expect(value(specRows(service, true, instances, 'admin'), 'STATE')).toBe(
      'persistent · your own volume',
    );
  });

  it('names a shared instance as shared', () => {
    expect(value(specRows(service, false, instances, 'shared'), 'STATE')).toBe(
      'shared · one volume for everyone',
    );
  });

  it('prints no STATE row when the broker has not answered', () => {
    expect(keys(specRows(service, false, instances, null))).not.toContain('STATE');
  });

  it('prints no STATE row for a bundle, which has no instance', () => {
    expect(keys(specRows(bundle, true, instances, 'anon'))).not.toContain('STATE');
  });
});

describe('specRows admin-only rows', () => {
  it('withholds the daemon-backed rows from an anonymous visitor', () => {
    const rows = keys(specRows(service, false, instances, 'anon'));
    for (const key of ['MEMORY', 'INSTANCES', 'COLD START']) expect(rows).not.toContain(key);
  });

  it('adds them once the gateway has said this session is an admin', () => {
    const rows = keys(specRows(service, true, instances, 'admin'));
    for (const key of ['MEMORY', 'INSTANCES', 'COLD START']) expect(rows).toContain(key);
  });
});
