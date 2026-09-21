import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWebGpuInfo } from '../dist/index.js';
function mock(gpu) { Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu } }); }
test('WebGPU reads prototype limits and preserves hidden and false values without creating a device', async () => {
  mock({ requestAdapter: async () => ({ info: { vendor: 'apple', architecture: '', isFallbackAdapter: false },
    features: new Set(['shader-f16', 'timestamp-query']), limits: Object.create({ maxBufferSize: 268435456, maxTextureDimension2D: 8192 }),
    requestDevice() { throw new Error('Must not create device'); } }) });
  const data = await getWebGpuInfo();
  assert.equal(data.status, 'available');
  assert.deepEqual(data.vendor, { value: 'apple', source: 'reported' });
  assert.equal(data.architecture.value, null);
  assert.deepEqual(data.isFallbackAdapter, { value: false, source: 'reported' });
  assert.equal(data.limits.maxBufferSize.value, 268435456);
  assert.equal(data.limits.maxTextureDimension3D.value, null);
  assert.deepEqual(data.features.value, ['shader-f16', 'timestamp-query']);
});
test('WebGPU distinguishes missing API, absent adapter, rejection and stalled API', async () => {
  mock(undefined); assert.equal((await getWebGpuInfo()).status, 'unsupported');
  mock({ requestAdapter: async () => null }); assert.equal((await getWebGpuInfo()).status, 'no-adapter');
  mock({ requestAdapter: async () => { throw new Error('blocked'); } }); assert.equal((await getWebGpuInfo()).status, 'error');
  mock({ requestAdapter: () => new Promise(() => {}) }); assert.equal((await getWebGpuInfo()).status, 'timeout');
});
test('blocked adapter identity does not discard features or limits', async () => {
  mock({ requestAdapter: async () => ({ get info() { throw new Error('private'); }, isFallbackAdapter: true, features: new Set(), limits: { maxBindGroups: 4 } }) });
  const data = await getWebGpuInfo(); assert.equal(data.status, 'available');
  assert.equal(data.isFallbackAdapter.value, true); assert.equal(data.vendor.value, null);
  assert.deepEqual(data.features.value, []); assert.equal(data.limits.maxBindGroups.value, 4);
});
