import { getBatteryInfo } from "./battery.js";
import { getCpuInfo } from "./cpu.js";
import { getMemoryInfo } from "./memory.js";
import { getGpuInfo } from "./gpu.js";
import { getDisplayInfo } from "./display.js";
import { getRuntimeInfo } from "./runtime.js";
import type { HardwareInfo } from "./types.js";

export * from "./types.js";
export { getCpuInfo } from "./cpu.js";
export { getMemoryInfo } from "./memory.js";
export { getGpuInfo } from "./gpu.js";
export { getDisplayInfo } from "./display.js";
export { getRuntimeInfo } from "./runtime.js";

export async function probe(): Promise<HardwareInfo> {
  const [cpu, battery] = await Promise.all([getCpuInfo(), getBatteryInfo()]);

  return {
    cpu,
    battery,
    memory: getMemoryInfo(),
    gpu: getGpuInfo(),
    display: getDisplayInfo(),
    runtime: getRuntimeInfo()
  };
}

export const getHardwareInfo = probe;
export { estimateMemoryCapacity } from './memory-estimate.js';
export type { MemoryEstimate } from './memory-estimate.js';
export { getBatteryInfo, watchBatteryInfo } from "./battery.js";
