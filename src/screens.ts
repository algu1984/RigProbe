import type { DetectedValue } from "./types.js";

type RawScreen = EventTarget & Record<string, unknown>;
interface ScreenDetails extends EventTarget {
  screens: RawScreen[];
  currentScreen: RawScreen;
}
export interface MonitorInfo {
  label: DetectedValue<string>;
  isInternal: DetectedValue<boolean>;
  isPrimary: DetectedValue<boolean>;
  isCurrent: DetectedValue<boolean>;
  width: DetectedValue<number>;
  height: DetectedValue<number>;
  left: DetectedValue<number>;
  top: DetectedValue<number>;
  availWidth: DetectedValue<number>;
  availHeight: DetectedValue<number>;
  availLeft: DetectedValue<number>;
  availTop: DetectedValue<number>;
  devicePixelRatio: DetectedValue<number>;
  colorDepth: DetectedValue<number>;
}
export interface ScreensInfo {
  status: "available" | "unsupported" | "denied" | "error";
  screens: MonitorInfo[];
}
export function supportsScreenDetails(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { getScreenDetails?: unknown }).getScreenDetails === "function";
}
function field<T>(value: unknown, type: string): DetectedValue<T> {
  const valid = typeof value === type && (type !== "number" || Number.isFinite(value)) && (type !== "string" || value !== "");
  return valid ? { value: value as T, source: "reported" } : { value: null, source: "unavailable" };
}
function snapshot(details: ScreenDetails): ScreensInfo {
  return { status: "available", screens: Array.from(details.screens, s => ({
    label: field<string>(s.label, "string"),
    isInternal: field<boolean>(s.isInternal, "boolean"),
    isPrimary: field<boolean>(s.isPrimary, "boolean"),
    isCurrent: { value: s === details.currentScreen, source: "derived" },
    ...Object.fromEntries(["width", "height", "left", "top", "availWidth", "availHeight", "availLeft", "availTop", "devicePixelRatio", "colorDepth"].map(key => [key, field<number>(s[key], "number")]))
  } as MonitorInfo)) };
}
/** Call from a user gesture: may request window-management permission.
 * Updates on monitor connection, geometry changes and current-screen changes.
 * Dispose on pagehide. No permission request occurs until this function is called.
 */
export function watchScreensInfo(callback: (info: ScreensInfo) => void): () => void {
  let disposed = false;
  let details: ScreenDetails | undefined;
  let screens: RawScreen[] = [];
  const emit = () => { if (!disposed && details) callback(snapshot(details)); };
  const sync = () => {
    for (const s of screens) s.removeEventListener("change", emit);
    screens = details ? Array.from(details.screens) : [];
    for (const s of screens) s.addEventListener("change", emit);
    emit();
  };
  const fail = (status: ScreensInfo["status"]) => { if (!disposed) callback({ status, screens: [] }); };
  if (!supportsScreenDetails()) fail("unsupported");
  else {
    try {
      const request = (window as unknown as { getScreenDetails(): Promise<ScreenDetails> }).getScreenDetails();
      void request.then(result => {
        if (disposed) return;
        details = result;
        details.addEventListener("screenschange", sync);
        details.addEventListener("currentscreenchange", emit);
        sync();
      }, error => fail(error?.name === "NotAllowedError" ? "denied" : "error"));
    } catch (error) { fail((error as { name?: string })?.name === "NotAllowedError" ? "denied" : "error"); }
  }
  return () => {
    disposed = true;
    details?.removeEventListener("screenschange", sync);
    details?.removeEventListener("currentscreenchange", emit);
    for (const s of screens) s.removeEventListener("change", emit);
    screens = [];
  };
}
