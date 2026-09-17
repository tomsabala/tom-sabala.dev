import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseManifest, publicManifest } from './manifest.mjs';

const SHIPPED = fileURLToPath(new URL('../../../frontend/src/apps/apps.json', import.meta.url));

const bundle = {
  kind: 'bundle',
  slug: 'sandbox-check',
  name: 'Sandbox Check',
  tagline: 'Static bundle',
  tech: ['HTML'],
  status: 'live',
  access: 'public',
};

const service = {
  kind: 'service',
  slug: 'secret-tool',
  name: 'Secret Tool',
  tagline: 'Admin only',
  tech: ['FastAPI'],
  status: 'live',
  access: 'admin',
  image: 'ghcr.io/example/secret:1',
  port: 3000,
  dataPath: '/app/data',
};

test('the shipped manifest parses with no drops', async () => {
  const raw = JSON.parse(await readFile(SHIPPED, 'utf8'));
  const { apps, dropped } = parseManifest(raw);
  assert.deepEqual(dropped, []);
  assert.equal(apps.length, raw.apps.length);
});

test('every shipped service carries the settings needed to start it', async () => {
  const { apps } = parseManifest(JSON.parse(await readFile(SHIPPED, 'utf8')));
  const services = apps.filter(app => app.kind === 'service');
  assert.ok(services.length > 0, 'expected at least one service app');
  for (const app of services) {
    assert.ok(app.runtime.image, app.slug);
    assert.ok(app.runtime.port > 0, app.slug);
    assert.ok(app.runtime.dataPath.startsWith('/'), app.slug);
    assert.ok(app.runtime.memoryMb > 0, app.slug);
  }
});

test('optional container limits fall back to safe defaults', () => {
  const { apps } = parseManifest({ apps: [service] });
  assert.deepEqual(apps[0].runtime, {
    image: 'ghcr.io/example/secret:1',
    port: 3000,
    memoryMb: 1024,
    shmSizeMb: 64,
    dataPath: '/app/data',
    dataTmpfsMb: 256,
    readyPath: '/',
    capAdd: [],
  });
});

test('a service the broker could not start is dropped, not advertised', () => {
  const missingImage = { ...service };
  delete missingImage.image;
  assert.equal(parseManifest({ apps: [missingImage] }).apps.length, 0);
  assert.equal(parseManifest({ apps: [{ ...service, port: 'nope' }] }).apps.length, 0);
  assert.equal(parseManifest({ apps: [{ ...service, dataPath: 'relative' }] }).apps.length, 0);
});

test('unsafe slugs, unknown kinds and unknown access levels are dropped', () => {
  for (const patch of [
    { slug: '../etc' },
    { slug: 'Upper' },
    { slug: '' },
    { kind: 'lambda' },
    { access: 'everyone' },
    { status: 'someday' },
    { sourceUrl: 'http://example.test' },
  ]) {
    const { apps, dropped } = parseManifest({ apps: [{ ...service, ...patch }] });
    assert.equal(apps.length, 0, `accepted ${JSON.stringify(patch)}`);
    assert.equal(dropped.length, 1);
  }
});

test('a duplicate slug keeps the first entry only', () => {
  const { apps } = parseManifest({ apps: [bundle, { ...bundle, name: 'Impostor' }] });
  assert.deepEqual(apps.map(app => app.name), ['Sandbox Check']);
});

test('one broken entry does not take the others down', () => {
  const { apps } = parseManifest({ apps: [{ kind: 'nope' }, bundle] });
  assert.deepEqual(apps.map(app => app.slug), ['sandbox-check']);
});

test('junk input yields no apps instead of throwing', () => {
  for (const raw of [null, undefined, {}, [], { apps: 'x' }, 7]) {
    assert.deepEqual(parseManifest(raw).apps, []);
  }
});

test('an anonymous viewer never sees an admin-only app', () => {
  const { apps } = parseManifest({ apps: [bundle, service] });
  const anon = publicManifest(apps, false);
  assert.equal(anon.admin, false);
  assert.deepEqual(anon.apps.map(app => app.slug), ['sandbox-check']);
  assert.ok(!JSON.stringify(anon).includes('secret-tool'));
});

test('an admin viewer sees every app', () => {
  const { apps } = parseManifest({ apps: [bundle, service] });
  const admin = publicManifest(apps, true);
  assert.equal(admin.admin, true);
  assert.deepEqual(admin.apps.map(app => app.slug), ['sandbox-check', 'secret-tool']);
});

test('the wire manifest never names an image or a container setting', () => {
  const { apps } = parseManifest({ apps: [service] });
  const wire = JSON.stringify(publicManifest(apps, true));
  for (const leak of ['ghcr.io', 'image', 'runtime', 'dataPath', 'capAdd', 'memoryMb', 'port']) {
    assert.ok(!wire.includes(leak), `leaked ${leak}: ${wire}`);
  }
});

test('the wire manifest keeps what the launcher renders', () => {
  const { apps } = parseManifest({ apps: [service] });
  assert.deepEqual(publicManifest(apps, true).apps[0], {
    kind: 'service',
    slug: 'secret-tool',
    name: 'Secret Tool',
    tagline: 'Admin only',
    tech: ['FastAPI'],
    status: 'live',
    access: 'admin',
  });
});
