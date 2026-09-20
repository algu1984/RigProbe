import type { MemoryInfo } from "./types.js";

export function getMemoryInfo(): MemoryInfo {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return {
    deviceMemoryGiB: memory === undefined
      ? { value: null, source: "unavailable" }
      : { value: memory, source: "reported" }
  };
}
