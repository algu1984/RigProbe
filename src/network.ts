import type { DetectedValue, NetworkInfo } from './types.js';

interface Connection extends EventTarget {
  type?: string;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}
type NetworkNavigator = Navigator & {
  connection?: Connection;
  mozConnection?: Connection;
  webkitConnection?: Connection;
  bluetooth?: object;
  usb?: object;
};
const unavailable = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const reported = <T>(value: T): DetectedValue<T> => ({ value, source: 'reported' });
function safely<T>(read: () => T): T | undefined {
  try { return read(); } catch { return undefined; }
}
function connection(): Connection | undefined {
  return safely(() => {
    const nav = navigator as NetworkNavigator;
    return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  });
}

/** Browser observations, not a speed test or proof of Internet/hardware access. */
export function getNetworkInfo(): NetworkInfo {
  const conn = connection();
  const text = (value: unknown): DetectedValue<string> => typeof value === 'string' && value.length > 0 ? reported(value) : unavailable();
  const number = (value: unknown): DetectedValue<number> => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? reported(value) : unavailable();
  const boolean = (value: unknown): DetectedValue<boolean> => typeof value === 'boolean' ? reported(value) : unavailable();
  return {
    online: boolean(safely(() => navigator.onLine)),
    connectionType: text(safely(() => conn?.type)),
    effectiveType: text(safely(() => conn?.effectiveType)),
    rttMs: number(safely(() => conn?.rtt)),
    downlinkMbps: number(safely(() => conn?.downlink)),
    saveData: boolean(safely(() => conn?.saveData)),
    bluetoothApi: boolean(safely(() => (navigator as NetworkNavigator).bluetooth != null)),
    usbApi: boolean(safely(() => (navigator as NetworkNavigator).usb != null))
  };
}

/** Initial snapshot, connection changes and online/offline events. No polling. */
export function watchNetworkInfo(onChange: (info: NetworkInfo) => void): () => void {
  const conn = connection();
  const target = typeof window !== 'undefined' ? window : undefined;
  let stopped = false;
  const update = () => { if (!stopped) onChange(getNetworkInfo()); };
  conn?.addEventListener?.('change', update);
  target?.addEventListener('online', update);
  target?.addEventListener('offline', update);
  update();
  return () => {
    stopped = true;
    conn?.removeEventListener?.('change', update);
    target?.removeEventListener('online', update);
    target?.removeEventListener('offline', update);
  };
}
