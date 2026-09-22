import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDockerClient } from './docker.mjs';

/** Minimal fetch stub: one canned response per call, recorded in order. */
function fakeFetch(responses) {
  const calls = [];
  return {
    calls,
    async fetch(url, init) {
      calls.push({ url, method: init?.method });
      const next = responses.shift();
      if (!next) throw new Error(`unexpected request to ${url}`);
      return {
        status: next.status,
        ok: next.status >= 200 && next.status < 300,
        async text() {
          return next.body === undefined ? '' : JSON.stringify(next.body);
        },
      };
    },
  };
}

function client(responses) {
  const stub = fakeFetch(responses);
  return { stub, docker: createDockerClient({ baseUrl: 'http://proxy', fetchImpl: stub.fetch }) };
}

test('create returns the new container id', async () => {
  const { docker } = client([{ status: 201, body: { Id: 'abc123' } }]);
  assert.equal(await docker.create('apps-demo-shared', { Image: 'ghcr.io/example/demo:1' }), 'abc123');
});

test('create on a missing image names the image instead of dereferencing null', async () => {
  // The daemon answers 404 when the image is not on the box, and request() flattens every
  // 404 to a null body for inspect()'s sake. Reading .Id off that null produced "Cannot
  // read properties of null (reading 'Id')" in the broker log - a message that names
  // neither the cause nor the fix, for the one failure an operator hits most.
  const { docker } = client([{ status: 404, body: null }]);
  await assert.rejects(
    () => docker.create('apps-demo-shared', { Image: 'ghcr.io/example/demo:1' }),
    /ghcr\.io\/example\/demo:1 is not present on this host/,
  );
});

test('inspect still reads an absent container as null', async () => {
  // Same 404 mapping, opposite meaning: no such container is a normal state the caller
  // branches on, so this must not start throwing alongside create().
  const { docker } = client([{ status: 404, body: null }]);
  assert.equal(await docker.inspect('apps-demo-shared'), null);
});

/** One framed chunk as the Engine API writes it: type, three zero bytes, BE length, payload. */
function frame(type, payload) {
  const body = Buffer.from(payload, 'utf8');
  const header = Buffer.alloc(8);
  header[0] = type;
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

/** fetch stub for the binary log endpoint, which returns bytes rather than JSON. */
function bytesFetch(status, buffer) {
  const calls = [];
  return {
    calls,
    async fetch(url) {
      calls.push(url);
      return {
        status,
        ok: status >= 200 && status < 300,
        async arrayBuffer() {
          return buffer;
        },
      };
    },
  };
}

test('logs demultiplexes the stream into the text the app actually wrote', async () => {
  const stub = bytesFetch(200, Buffer.concat([frame(1, 'booting\n'), frame(2, 'ENOSPC: no space left\n')]));
  const docker = createDockerClient({ baseUrl: 'http://proxy', fetchImpl: stub.fetch });

  assert.equal(await docker.logs('apps-demo-anon-1'), 'booting\nENOSPC: no space left');
  assert.match(stub.calls[0], /\/containers\/apps-demo-anon-1\/logs\?stdout=1&stderr=1&tail=40$/);
});

test('logs reads a TTY container, which sends no frames at all', async () => {
  const stub = bytesFetch(200, Buffer.from('plain tty output\n', 'utf8'));
  const docker = createDockerClient({ baseUrl: 'http://proxy', fetchImpl: stub.fetch });
  assert.equal(await docker.logs('apps-demo-anon-1'), 'plain tty output');
});

test('logs stays quiet when the daemon refuses, so it cannot mask the real error', async () => {
  // It runs on an error path. A throw here would replace "exited while starting" with
  // whatever went wrong fetching the logs - losing the failure it was called to explain.
  const refused = createDockerClient({
    baseUrl: 'http://proxy',
    fetchImpl: bytesFetch(500, Buffer.alloc(0)).fetch,
  });
  assert.equal(await refused.logs('apps-demo-anon-1'), '');

  const broken = createDockerClient({
    baseUrl: 'http://proxy',
    fetchImpl: async () => {
      throw new Error('socket proxy is down');
    },
  });
  assert.equal(await broken.logs('apps-demo-anon-1'), '');
});
