import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServicePath } from './paths.mjs';

test('the slug is the first segment and the prefix is kept for the app', () => {
  assert.deepEqual(parseServicePath('/a/resume-matcher/'), {
    slug: 'resume-matcher',
    target: '/a/resume-matcher/',
  });
  // The image is built with basePath=/a/<slug>, so the prefix must survive to the container.
  assert.equal(parseServicePath('/a/resume-matcher/api/v1/health').target, '/a/resume-matcher/api/v1/health');
  assert.equal(parseServicePath('/a/resume-matcher').slug, 'resume-matcher');
  assert.equal(parseServicePath('/a/resume-matcher/x?y=1&z=/a/other').slug, 'resume-matcher');
});

test('anything outside the service root is not ours', () => {
  for (const target of ['/', '/a', '/an/other', '/hosted/x/index.html', '/manifest.json', '', undefined]) {
    assert.equal(parseServicePath(target), null, `claimed ${JSON.stringify(target)}`);
  }
});

test('traversal is rejected rather than normalised', () => {
  for (const target of [
    '/a/../secrets',
    '/a/resume-matcher/../../etc/passwd',
    '/a/resume-matcher/%2e%2e/%2e%2e/etc',
    '/a/%2e%2e',
    '/a/resume-matcher/./x',
    '/a/resume-matcher/..',
    '/a/resume-matcher\\..\\x',
  ]) {
    assert.equal(parseServicePath(target), null, `accepted ${target}`);
  }
});

test('empty segments are rejected: // reads differently to different proxies', () => {
  assert.equal(parseServicePath('/a//resume-matcher/'), null);
  assert.equal(parseServicePath('/a/resume-matcher//api'), null);
});

test('an encoded slash cannot be smuggled into the slug', () => {
  assert.equal(parseServicePath('/a/resume%2Fmatcher/'), null);
  assert.equal(parseServicePath('/a/resume-matcher%2f..%2fx'), null);
});

test('an unsafe slug shape never reaches the manifest lookup', () => {
  for (const target of ['/a/Resume-Matcher/', '/a/-leading/', '/a/trailing-/', '/a/double--dash/']) {
    assert.equal(parseServicePath(target), null, `accepted ${target}`);
  }
});
