import type { DisplayInfo } from "./types.js";

export function getDisplayInfo(): DisplayInfo {
  const orientation = screen.orientation?.type ?? null;
  return {
    width: { value: screen.width, source: "reported" },
    height: { value: screen.height, source: "reported" },
    devicePixelRatio: { value: window.devicePixelRatio, source: "reported" },
    colorDepth: { value: screen.colorDepth, source: "reported" },
    orientation: { value: orientation, source: orientation ? "reported" : "unavailable" }
  };
}
