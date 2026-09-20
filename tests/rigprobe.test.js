import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probe, getCpuInfo, getGpuInfo } from '../dist/index.js';

function browser(overrides = {}) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    hardwareConcurrency: 8, deviceMemory: 8, platform: 'TestOS', maxTouchPoints: 0,
    userAgent: 'TestBrowser', ...overrides
  }});
  globalThis.screen = { width: 1440, height: 900, colorDepth: 24, orientation: { type: 'landscape-primary' } };
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.document = { createElement: () => ({ getContext: () => null }) };
}

test('probe returns only value/source leaves and degrades without optional APIs', async () => {
  browser({ deviceMemory: undefined, hardwareConcurrency: undefined });
  const result = await probe();
  for (const section of Object.values(result)) {
    for (const detected of Object.values(section)) {
      assert.deepEqual(Object.keys(detected).sort(), ['source', 'value']);
    }
  }
  assert.deepEqual(result.memory.deviceMemoryGiB, { value: null, source: 'unavailable' });
  assert.equal(result.cpu.logicalThreads.value, null);
  assert.equal(result.gpu.renderer.value, null);
  assert.equal(result.display.width.value, 1440);
  assert.equal(result.runtime.platform.value, 'TestOS');
});

test('CPU uses reported client hints and a valid SIMD capability probe', async () => {
  browser({ userAgentData: { getHighEntropyValues: async () => ({ architecture: 'arm', bitness: '64' }) } });
  const cpu = await getCpuInfo();
  assert.deepEqual(cpu.architecture, { value: 'arm', source: 'reported' });
  assert.equal(cpu.bitness.value, '64');
  assert.equal(cpu.wasmSimd.value, true); // Node's supported SIMD must not report false for malformed bytecode.
  assert.equal(cpu.logicalThreads.value, 8);
});

test('rejected client hints do not prevent other CPU values', async () => {
  browser({ userAgentData: { getHighEntropyValues: async () => { throw new Error('Denied'); } } });
  const cpu = await getCpuInfo();
  assert.equal(cpu.architecture.source, 'unavailable');
  assert.equal(cpu.logicalThreads.value, 8);
});

test('GPU supports masked WebGL and blocked contexts', () => {
  browser();
  const gl = { RENDERER: 1, VENDOR: 2, VERSION: 3, MAX_TEXTURE_SIZE: 4,
    getExtension: () => null, getParameter: key => ({ 1: 'Masked renderer', 2: 'Masked vendor', 3: 'WebGL 1.0', 4: 4096 })[key] };
  globalThis.document.createElement = () => ({ getContext: type => type === 'webgl' ? gl : null });
  assert.equal(getGpuInfo().renderer.value, 'Masked renderer');
  assert.equal(getGpuInfo().maxTextureSize.value, 4096);
  globalThis.document.createElement = () => { throw new Error('Blocked'); };
  assert.deepEqual(getGpuInfo().renderer, { value: null, source: 'unavailable' });
});

test('optional memory estimate distinguishes capped API from a desktop profile', async () => {
  const { estimateMemoryCapacity } = await import('../dist/index.js');
  browser({ hardwareConcurrency: 16 });
  const info = await probe();
  const estimated = estimateMemoryCapacity(info, 4096 * 1048576);
  assert.deepEqual(estimated, { value: { minGiB: 16, maxGiB: 32 }, source: 'estimated' });
  assert.deepEqual(info.memory.deviceMemoryGiB, { value: 8, source: 'reported' });
  assert.equal(estimateMemoryCapacity(info).value, null);
  info.runtime.mobile = { value: true, source: 'reported' };
  assert.equal(estimateMemoryCapacity(info, 4096 * 1048576).value, null);
});

test('Apple desktop profiles remain estimates and do not classify iPads as desktops', async () => {
  const { estimateMemoryCapacity } = await import('../dist/index.js');
  browser();
  const info = await probe();
  info.gpu.renderer = { value: 'ANGLE (Apple, Apple M1 Pro, Metal)', source: 'reported' };
  assert.deepEqual(estimateMemoryCapacity(info), { value: { minGiB: 16, maxGiB: null }, source: 'estimated' });
  info.runtime.platform.value = 'MacIntel';
  info.runtime.touchPoints.value = 5;
  assert.equal(estimateMemoryCapacity(info).source, 'unavailable');
});
