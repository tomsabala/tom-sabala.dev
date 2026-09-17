import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterResponseHeaders } from './proxy.mjs';

test('an app cannot set the gateway session cookie', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=attacker-controlled; Path=/', 'app_theme=dark'] },
    'apps_sid'
  );
  assert.deepEqual(headers['set-cookie'], ['app_theme=dark']);
});

test("an app's own cookies are passed through untouched", () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['session=app-side; HttpOnly', 'locale=en'], 'content-type': 'text/html' },
    'apps_sid'
  );
  assert.deepEqual(headers['set-cookie'], ['session=app-side; HttpOnly', 'locale=en']);
  assert.equal(headers['content-type'], 'text/html');
});

test('a freshly minted session is appended alongside app cookies', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['locale=en'] },
    'apps_sid',
    'apps_sid=new.value; Path=/; HttpOnly'
  );
  assert.deepEqual(headers['set-cookie'], ['locale=en', 'apps_sid=new.value; Path=/; HttpOnly']);
});

test('the minted session survives an app trying to clobber it', () => {
  const headers = filterResponseHeaders(
    { 'set-cookie': ['apps_sid=evil; Path=/'] },
    'apps_sid',
    'apps_sid=mine; Path=/; HttpOnly'
  );
  assert.deepEqual(headers['set-cookie'], ['apps_sid=mine; Path=/; HttpOnly']);
});

test('hop-by-hop headers are not relayed', () => {
  const headers = filterResponseHeaders(
    {
      connection: 'keep-alive',
      'transfer-encoding': 'chunked',
      upgrade: 'h2c',
      'content-type': 'application/json',
    },
    'apps_sid'
  );
  assert.deepEqual(Object.keys(headers), ['content-type']);
});

test('no cookie header is invented when there is nothing to set', () => {
  const headers = filterResponseHeaders({ 'content-length': '12' }, 'apps_sid');
  assert.ok(!('set-cookie' in headers));
});
