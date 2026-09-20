import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getVideoCodecInfo } from '../dist/index.js';

function mock(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'navigator', descriptor) : delete globalThis.navigator);
}

test('video preserves independent browser flags and exact tested profiles', async t => {
  const calls = [];
  mock(t, { mediaCapabilities: { async decodingInfo(config) {
    calls.push(config);
    return { supported: true, smooth: false, powerEfficient: false };
  } } });
  const rows = await getVideoCodecInfo();
  assert.equal(rows.length, 8);
  assert.equal(calls.length, 8);
  for (const row of rows) {
    assert.equal(row.configuration.video.width, 1920);
    assert.equal(row.configuration.video.framerate, 30);
    assert.equal(row.configuration.type, 'file');
    assert.equal(row.configuration.keySystemConfiguration, undefined);
    assert.deepEqual(row.supported, { value: true, source: 'reported' });
    assert.deepEqual(row.powerEfficient, { value: false, source: 'reported' });
    for (const key of ['supported', 'smooth', 'powerEfficient'])
      assert.deepEqual(Object.keys(row[key]).sort(), ['source', 'value']);
  }
});

test('missing video API is unavailable, not unsupported', async t => {
  mock(t, undefined);
  for (const row of await getVideoCodecInfo())
    assert.deepEqual(row.supported, { value: null, source: 'unavailable' });
});

test('rejected and malformed queries do not suppress other codec results', async t => {
  let count = 0;
  mock(t, { mediaCapabilities: { decodingInfo() {
    count++;
    if (count === 1) throw new Error('blocked');
    if (count === 2) return Promise.reject(new Error('rejected'));
    if (count === 3) return Promise.resolve({ supported: 'yes' });
    return Promise.resolve({ supported: false, smooth: false, powerEfficient: false });
  } } });
  const rows = await getVideoCodecInfo();
  for (const row of rows.slice(0, 3)) assert.equal(row.supported.value, null);
  assert.deepEqual(rows[3].supported, { value: false, source: 'reported' });
});

test('unresolved video queries time out independently', async t => {
  mock(t, { mediaCapabilities: { decodingInfo: () => new Promise(() => {}) } });
  const rows = await getVideoCodecInfo();
  assert.equal(rows.length, 8);
  assert.ok(rows.every(row => row.supported.value === null));
});
