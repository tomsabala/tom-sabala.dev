import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInstanceManager } from './instances.mjs';
import { LABELS } from './identity.mjs';

const silent = { info() {}, warn() {}, error() {} };

const APP = {
  slug: 'demo',
  access: 'public',
  kind: 'service',
  runtime: {
    image: 'ghcr.io/example/demo:1',
    port: 3000,
    memoryMb: 1024,
    shmSizeMb: 64,
    dataPath: '/data',
    dataTmpfsMb: 128,
    readyPath: '/',
    capAdd: [],
  },
};

function config({ anon = 2, admin = 2, total = 4 }) {
  return {
    instanceNetwork: 'apps-instances',
    instanceEnvDir: '/nonexistent',
    idleTtlMs: 60_000,
    readyTimeoutMs: 1000,
    reapIntervalMs: 30_000,
    maxInstances: { anon, admin, total },
  };
}

/** Records what the manager tried to do; nothing here reaches a real Docker daemon. */
function fakeDocker(running = []) {
  const calls = { created: [], started: [], removed: [] };
  return {
    calls,
    async list() {
      return running;
    },
    async inspect() {
      return null;
    },
    async create(name, spec) {
      calls.created.push({ name, spec });
      return `id-${name}`;
    },
    async start(id) {
      calls.started.push(id);
    },
    async remove(id) {
      calls.removed.push(id);
    },
  };
}

function runningContainer(kind, index) {
  return { Id: `id${index}`, Names: [`/apps-demo-${kind}-${index}`], Labels: { [LABELS.kind]: kind }, State: 'running' };
}

test('a free slot gets as far as creating the container', async () => {
  const docker = fakeDocker([]);
  const instances = createInstanceManager({ docker, config: { ...config({}) }, log: silent });

  // Readiness polling has nothing to poll against a fake daemon, so this rejects on the
  // ready phase — after create, which is what this asserts.
  await assert.rejects(instances.ensure(APP, 'anon-aaaa'));
  assert.equal(docker.calls.created.length, 1);
  assert.equal(docker.calls.created[0].name, 'apps-demo-anon-aaaa');
});

test('the per-kind cap refuses before creating anything', async () => {
  const docker = fakeDocker([runningContainer('anon', 1)]);
  const instances = createInstanceManager({ docker, config: config({ anon: 1, admin: 1, total: 4 }), log: silent });

  await assert.rejects(instances.ensure(APP, 'anon-bbbb'), error => {
    assert.equal(error.code, 'capacity');
    assert.match(error.message, /anon/);
    return true;
  });
  assert.deepEqual(docker.calls.created, [], 'nothing may be created once at capacity');
});

test('one kind at capacity does not block the other', async () => {
  const docker = fakeDocker([runningContainer('anon', 1)]);
  const instances = createInstanceManager({ docker, config: config({ anon: 1, admin: 1, total: 4 }), log: silent });

  await assert.rejects(instances.ensure(APP, 'admin-cccc'));
  assert.equal(docker.calls.created.length, 1, 'the admin slot was still free');
});

test('the total cap stops the sum of two independent per-kind caps', async () => {
  // anon=1 + admin=1 would allow two instances; total=1 is what a one-instance box can hold.
  const docker = fakeDocker([runningContainer('anon', 1)]);
  const instances = createInstanceManager({ docker, config: config({ anon: 1, admin: 1, total: 1 }), log: silent });

  await assert.rejects(instances.ensure(APP, 'admin-dddd'), error => {
    assert.equal(error.code, 'capacity');
    assert.match(error.message, /instance/);
    return true;
  });
  assert.deepEqual(docker.calls.created, []);
});

test('containers of other apps count against the total', async () => {
  const other = { Id: 'x', Names: ['/apps-other-anon-1'], Labels: { [LABELS.kind]: 'anon' }, State: 'running' };
  const docker = fakeDocker([other]);
  const instances = createInstanceManager({ docker, config: config({ anon: 2, admin: 2, total: 1 }), log: silent });

  await assert.rejects(instances.ensure(APP, 'anon-eeee'), error => {
    assert.equal(error.code, 'capacity');
    return true;
  });
});

test('parallel requests for one instance create exactly one container', async () => {
  const docker = fakeDocker([]);
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  const results = await Promise.allSettled([
    instances.ensure(APP, 'anon-ffff'),
    instances.ensure(APP, 'anon-ffff'),
    instances.ensure(APP, 'anon-ffff'),
  ]);

  assert.equal(results.filter(r => r.status === 'rejected').length, 3);
  assert.equal(docker.calls.created.length, 1, 'the iframe fans out; the broker must not');
});
