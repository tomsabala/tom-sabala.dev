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
