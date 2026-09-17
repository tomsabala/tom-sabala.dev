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
function fakeDocker(running = [], { existing = null, imageId = 'sha256:current' } = {}) {
  const calls = { created: [], started: [], removed: [], imageLookups: 0 };
  return {
    calls,
    async list() {
      return running;
    },
    async inspect() {
      return existing;
    },
    async inspectImage() {
      calls.imageLookups += 1;
      return imageId === null ? null : { Id: imageId };
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

/** A running container as the Docker inspect endpoint reports it. */
function existingContainer({ imageId = 'sha256:current', reference = APP.runtime.image } = {}) {
  return {
    Id: 'existing',
    Image: imageId,
    Name: '/apps-demo-shared',
    Config: { Labels: { [LABELS.image]: reference } },
    State: { Running: true },
    NetworkSettings: { Networks: { 'apps-instances': { IPAddress: '127.0.0.1' } } },
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

test('an anonymous instance gets tmpfs, so its data dies with it', async () => {
  const docker = fakeDocker([]);
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  await assert.rejects(instances.ensure(APP, 'anon-1111'));
  const { HostConfig } = docker.calls.created[0].spec;
  assert.deepEqual(HostConfig.Tmpfs, { '/data': 'rw,size=128m,mode=1777' });
  assert.equal(HostConfig.Mounts, undefined);
});

test('admin and shared instances get a named volume, so their data survives', async () => {
  for (const key of ['admin-2222', 'shared']) {
    const docker = fakeDocker([]);
    const instances = createInstanceManager({ docker, config: config({}), log: silent });

    await assert.rejects(instances.ensure(APP, key));
    const { HostConfig } = docker.calls.created[0].spec;
    assert.deepEqual(HostConfig.Mounts, [
      { Type: 'volume', Source: `apps-demo-${key}`, Target: '/data' },
    ]);
    assert.equal(HostConfig.Tmpfs, undefined, `${key} must not be on tmpfs`);
  }
});

test('a shared instance has no per-kind cap but still counts against the total', async () => {
  const free = fakeDocker([]);
  const instances = createInstanceManager({
    docker: free,
    config: config({ anon: 0, admin: 0, total: 1 }),
    log: silent,
  });
  // anon and admin are capped at 0 here; a shared app is still allowed to start.
  await assert.rejects(instances.ensure(APP, 'shared'));
  assert.equal(free.calls.created.length, 1);

  const full = fakeDocker([{ Id: 'x', Names: ['/apps-other-shared'], Labels: { [LABELS.kind]: 'shared' }, State: 'running' }]);
  const capped = createInstanceManager({ docker: full, config: config({ total: 1 }), log: silent });
  await assert.rejects(capped.ensure(APP, 'shared'), error => {
    assert.equal(error.code, 'capacity');
    return true;
  });
  assert.deepEqual(full.calls.created, []);
});

test('the reaper removes idle anonymous instances and only stops the others', async () => {
  const containers = [
    { Id: 'a', Names: ['/apps-demo-anon-1'], Labels: { [LABELS.kind]: 'anon' }, State: 'running' },
    { Id: 'b', Names: ['/apps-demo-admin-1'], Labels: { [LABELS.kind]: 'admin' }, State: 'running' },
    { Id: 'c', Names: ['/apps-demo-shared'], Labels: { [LABELS.kind]: 'shared' }, State: 'running' },
  ];
  const stopped = [];
  const docker = {
    ...fakeDocker(containers),
    async stop(id) {
      stopped.push(id);
    },
  };
  let clock = 1_000;
  const instances = createInstanceManager({
    docker,
    config: config({}),
    log: silent,
    now: () => clock,
  });

  await instances.adopt();
  clock += 10_000;
  await instances.reapOnce();
  assert.deepEqual(docker.calls.removed, [], 'nothing is idle yet');

  clock += 120_000;
  await instances.reapOnce();
  assert.deepEqual(docker.calls.removed, ['a'], 'only the anonymous instance is removed');
  assert.deepEqual(stopped.sort(), ['b', 'c'], 'admin and shared keep their volumes');
});

test('instances left by a previous broker are adopted, not reaped immediately', async () => {
  const containers = [{ Id: 'a', Names: ['/apps-demo-anon-1'], Labels: { [LABELS.kind]: 'anon' }, State: 'running' }];
  const docker = fakeDocker(containers);
  let clock = 1_000;
  const instances = createInstanceManager({ docker, config: config({}), log: silent, now: () => clock });

  // No adopt() call: the first reap sees an unknown container and must give it a full TTL.
  clock += 999_999;
  await instances.reapOnce();
  assert.deepEqual(docker.calls.removed, []);

  clock += 999_999;
  await instances.reapOnce();
  assert.deepEqual(docker.calls.removed, ['a']);
});

test('a running instance on the current image is reused as-is', async () => {
  const docker = fakeDocker([], { existing: existingContainer() });
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  const { endpoint } = await instances.ensure(APP, 'shared');
  assert.equal(endpoint, 'http://127.0.0.1:3000');
  assert.deepEqual(docker.calls.created, []);
  assert.deepEqual(docker.calls.removed, []);
});

test('a moved tag recreates the instance, even though the label is unchanged', async () => {
  // What `docker pull` on a moving tag looks like: same reference, different digest. Without
  // the digest check an admin or shared instance would serve the old build indefinitely.
  const docker = fakeDocker([], {
    existing: existingContainer({ imageId: 'sha256:previous' }),
    imageId: 'sha256:current',
  });
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  await assert.rejects(instances.ensure(APP, 'shared'));
  assert.deepEqual(docker.calls.removed, ['existing']);
  assert.equal(docker.calls.created.length, 1);
});

test('a renamed image in the manifest recreates the instance', async () => {
  const docker = fakeDocker([], {
    existing: existingContainer({ reference: 'ghcr.io/example/demo:old' }),
  });
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  await assert.rejects(instances.ensure(APP, 'shared'));
  assert.deepEqual(docker.calls.removed, ['existing']);
});

test('an unresolvable image leaves the instance alone rather than killing it', async () => {
  // Mid-pull, or the image was removed by hand: serving the old build beats serving a 503.
  const docker = fakeDocker([], {
    existing: existingContainer({ imageId: 'sha256:previous' }),
    imageId: null,
  });
  const instances = createInstanceManager({ docker, config: config({}), log: silent });

  const { endpoint } = await instances.ensure(APP, 'shared');
  assert.equal(endpoint, 'http://127.0.0.1:3000');
  assert.deepEqual(docker.calls.removed, []);
});

test('the image digest is not looked up on every request', async () => {
  const docker = fakeDocker([], { existing: existingContainer() });
  let clock = 1_000;
  const instances = createInstanceManager({ docker, config: config({}), log: silent, now: () => clock });

  for (let i = 0; i < 5; i += 1) await instances.ensure(APP, 'shared');
  assert.equal(docker.calls.imageLookups, 1, 'cached within the TTL');

  clock += 60_000;
  await instances.ensure(APP, 'shared');
  assert.equal(docker.calls.imageLookups, 2, 'and refreshed after it');
});
