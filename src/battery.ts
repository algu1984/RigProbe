import type { BatteryInfo, DetectedValue } from './types.js';

interface BatteryManager extends EventTarget {
  readonly level: number;
  readonly charging: boolean;
  readonly chargingTime: number;
  readonly dischargingTime: number;
}

const events = ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'] as const;
const unavailable = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const reported = <T>(value: T): DetectedValue<T> => ({ value, source: 'reported' });

function snapshot(manager: BatteryManager | null): BatteryInfo {
  const seconds = (value: number | undefined): DetectedValue<number> =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? reported(value) : unavailable();
  return {
    level: manager && Number.isFinite(manager.level) && manager.level >= 0 && manager.level <= 1
      ? reported(manager.level) : unavailable(),
    charging: typeof manager?.charging === 'boolean' ? reported(manager.charging) : unavailable(),
    chargingTimeSeconds: seconds(manager?.chargingTime),
    dischargingTimeSeconds: seconds(manager?.dischargingTime)
  };
}

async function requestManager(): Promise<BatteryManager | null> {
  try {
    if (typeof navigator === 'undefined') return null;
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    return typeof nav.getBattery === 'function' ? await nav.getBattery() : null;
  } catch {
    return null;
  }
}

async function getManager(): Promise<BatteryManager | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A snapshot is bounded, but subscriptions still accept a late API response.
    return await Promise.race([
      requestManager(),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); })
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Snapshot of browser-reported battery values. Does not infer battery presence. */
export async function getBatteryInfo(): Promise<BatteryInfo> {
  return snapshot(await getManager());
}

/** Emits an initial snapshot and subsequent changes; call the returned function to stop. */
export function watchBatteryInfo(onChange: (info: BatteryInfo) => void): () => void {
  let stopped = false;
  let manager: BatteryManager | null = null;
  const update = () => { if (!stopped) onChange(snapshot(manager)); };
  const timer = setTimeout(update, 1500);
  void requestManager().then(result => {
    clearTimeout(timer);
    if (stopped) return;
    manager = result;
    for (const event of events) manager?.addEventListener(event, update);
    update();
  });
  return () => {
    stopped = true;
    clearTimeout(timer);
    for (const event of events) manager?.removeEventListener(event, update);
    manager = null;
  };
}
