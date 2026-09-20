import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBatteryInfo, watchBatteryInfo } from '../dist/index.js';

const setNavigator = value => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function manager() {
  return Object.assign(new EventTarget(), { level: 0.72, charging: false, chargingTime: Infinity, dischargingTime: 10800 });
}

test('normalizes battery values and keeps the strict value/source contract', async () => {
  const battery = manager();
  setNavigator({ getBattery: async () => battery });
  let info = await getBatteryInfo();
  assert.deepEqual(info.level, { value: 0.72, source: 'reported' });
  assert.deepEqual(info.charging, { value: false, source: 'reported' });
  assert.deepEqual(info.chargingTimeSeconds, { value: null, source: 'unavailable' });
  assert.equal(info.dischargingTimeSeconds.value, 10800);
  for (const value of Object.values(info)) assert.deepEqual(Object.keys(value).sort(), ['source', 'value']);
  battery.level = 0; battery.chargingTime = 0; battery.dischargingTime = NaN;
  info = await getBatteryInfo();
  assert.equal(info.level.value, 0);
  assert.equal(info.chargingTimeSeconds.value, 0);
  assert.equal(info.dischargingTimeSeconds.value, null);
  battery.level = 2; battery.chargingTime = -1;
  info = await getBatteryInfo();
  assert.equal(info.level.value, null);
  assert.equal(info.chargingTimeSeconds.value, null);
});

test('missing, rejected and stalled battery access degrades safely', async () => {
  for (const nav of [undefined, {}, { getBattery: async () => { throw new Error('Denied'); } }, { getBattery: () => new Promise(() => {}) }]) {
    setNavigator(nav);
    for (const value of Object.values(await getBatteryInfo())) assert.deepEqual(value, { value: null, source: 'unavailable' });
  }
});

test('subscription updates all four fields and removes listeners on disposal', async () => {
  const battery = manager();const updates=[];
  setNavigator({ getBattery: async () => battery });
  const stop=watchBatteryInfo(info=>updates.push(info));await flush();
  assert.equal(updates.length,1);
  battery.level=.5;battery.dispatchEvent(new Event('levelchange'));
  battery.charging=true;battery.dispatchEvent(new Event('chargingchange'));
  battery.chargingTime=1800;battery.dispatchEvent(new Event('chargingtimechange'));
  battery.dischargingTime=Infinity;battery.dispatchEvent(new Event('dischargingtimechange'));
  assert.equal(updates.length,5);
  assert.equal(updates.at(-1).level.value,.5);
  assert.equal(updates.at(-1).chargingTimeSeconds.value,1800);
  assert.equal(updates.at(-1).dischargingTimeSeconds.value,null);
  stop();stop();battery.dispatchEvent(new Event('levelchange'));
  assert.equal(updates.length,5);
});

test('disposing before resolution prevents late callbacks and listeners', async () => {
  const battery=manager();let resolve;let count=0;
  setNavigator({getBattery:()=>new Promise(r=>resolve=r)});
  const stop=watchBatteryInfo(()=>count++);stop();resolve(battery);await flush();
  battery.dispatchEvent(new Event('levelchange'));assert.equal(count,0);
});

test('subscription recovers when the battery response arrives after the snapshot timeout', async () => {
  const battery=manager();let resolve;const updates=[];
  setNavigator({getBattery:()=>new Promise(r=>resolve=r)});
  const stop=watchBatteryInfo(info=>updates.push(info));
  await new Promise(r=>setTimeout(r,1550));
  assert.equal(updates.at(-1).level.value,null);
  resolve(battery);await flush();
  assert.equal(updates.at(-1).level.value,.72);
  battery.level=.94;battery.dispatchEvent(new Event('levelchange'));
  assert.equal(updates.at(-1).level.value,.94);
  stop();
});
