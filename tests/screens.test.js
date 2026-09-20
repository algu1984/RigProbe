import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchScreensInfo, supportsScreenDetails, getRuntimeDetails } from '../dist/index.js';
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function monitor(values) { return Object.assign(new EventTarget(), values); }

test('screens preserve false and negative coordinates, update topology/current screen, and dispose', async () => {
  const a = monitor({ label: 'Built-in Retina Display', isInternal: true, isPrimary: true, width: 1512, height: 982, left: 0, top: 0, devicePixelRatio: 2 });
  const b = monitor({ label: 'External', isInternal: false, isPrimary: false, width: 1920, height: 1080, left: -1920, top: 0 });
  const details = Object.assign(new EventTarget(), { screens: [a,b], currentScreen: a });
  let calls = 0;
  globalThis.window = { getScreenDetails: async () => { calls++; return details; } };
  assert.equal(supportsScreenDetails(), true);
  assert.equal(calls, 0);
  const results = [];
  const stop = watchScreensInfo(info => results.push(info));
  await tick();
  assert.equal(results.at(-1).screens.length, 2);
  assert.deepEqual(results[0].screens[1].isInternal, { value: false, source: 'reported' });
  assert.equal(results[0].screens[1].left.value, -1920);
  for (const field of Object.values(results[0].screens[0])) assert.deepEqual(Object.keys(field).sort(), ['source','value']);
  details.currentScreen = b;
  details.dispatchEvent(new Event('currentscreenchange'));
  assert.equal(results.at(-1).screens[1].isCurrent.value, true);
  b.width = 2560; b.dispatchEvent(new Event('change'));
  assert.equal(results.at(-1).screens[1].width.value, 2560);
  details.screens = [b]; details.dispatchEvent(new Event('screenschange'));
  assert.equal(results.at(-1).screens.length, 1);
  const count = results.length;
  a.dispatchEvent(new Event('change'));
  assert.equal(results.length, count);
  stop(); b.dispatchEvent(new Event('change')); details.dispatchEvent(new Event('screenschange'));
  assert.equal(results.length, count);
});

test('unsupported, denied and disposed pending permission requests are handled', async () => {
  globalThis.window = {};
  const results = [];
  watchScreensInfo(info => results.push(info));
  assert.equal(results[0].status, 'unsupported');
  globalThis.window.getScreenDetails = async () => { throw { name: 'NotAllowedError' }; };
  watchScreensInfo(info => results.push(info)); await tick();
  assert.equal(results.at(-1).status, 'denied');
  let resolve;
  globalThis.window.getScreenDetails = () => new Promise(r => { resolve = r; });
  const stop = watchScreensInfo(info => results.push(info)); stop();
  resolve(Object.assign(new EventTarget(), { screens: [], currentScreen: null })); await tick();
  assert.equal(results.length, 2);
});

function hints(value) { Object.defineProperty(globalThis, 'navigator', { configurable: true, value }); }
test('runtime details retain raw platform version and validated hints', async () => {
  hints({ userAgentData: { getHighEntropyValues: async () => ({ platformVersion: '15.0.0', model: '', formFactors: ['Desktop'], architecture: 'arm', bitness: '64', wow64: false }) } });
  const result = await getRuntimeDetails();
  assert.equal(result.platformVersion.value, '15.0.0');
  assert.equal(result.model.value, null);
  assert.deepEqual(result.formFactors.value, ['Desktop']);
  assert.equal(result.wow64.value, false);
  for (const field of Object.values(result)) assert.deepEqual(Object.keys(field).sort(), ['source','value']);
  hints({}); assert.equal((await getRuntimeDetails()).platformVersion.value, null);
  hints({ userAgentData: { getHighEntropyValues: async () => { throw new Error('blocked'); } } });
  assert.equal((await getRuntimeDetails()).architecture.value, null);
});

test('runtime details finish if client hints never resolve', async () => {
  hints({ userAgentData: { getHighEntropyValues: () => new Promise(() => {}) } });
  assert.equal((await getRuntimeDetails()).platformVersion.value, null);
});
