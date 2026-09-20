import type { CpuInfo, GpuInfo, RuntimeInfo, MemoryInfo, DetectedValue } from './types.js';

/** A rough capacity profile, never a measurement or guaranteed hardware bound. */
export interface MemoryEstimate {
  minGiB: number;
  maxGiB: number | null;
}

/** Optional, allocation-free legacy dashboard heuristics. Not run by probe(). */
export function estimateMemoryCapacity(info: {
  cpu: CpuInfo;
  gpu: GpuInfo;
  runtime: RuntimeInfo;
  memory: MemoryInfo;
}, heapLimitBytes?: number): DetectedValue<MemoryEstimate> {
  const renderer = (info.gpu.renderer.value || '').toLowerCase();
  const runtime = info.runtime;
  const mobile = runtime.mobile.value === true ||
    /android|iphone|ipad|ipod|mobile/i.test(runtime.userAgent.value || '') ||
    (runtime.platform.value === 'MacIntel' && (runtime.touchPoints.value || 0) > 1) ||
    /adreno|mali|immortalis|powervr|xclipse/.test(renderer);
  const reported = info.memory.deviceMemoryGiB.value;
  if (mobile || (reported !== null && reported < 8)) {
    return { value: null, source: 'unavailable' };
  }
  // These are intentionally labelled estimates. GPU names do not reveal installed RAM.
  if (/apple.*m\d+.*max/.test(renderer)) {
    return { value: { minGiB: 32, maxGiB: null }, source: 'estimated' };
  }
  if (/apple.*m\d+.*pro/.test(renderer)) {
    return { value: { minGiB: 16, maxGiB: null }, source: 'estimated' };
  }
  if ((info.cpu.logicalThreads.value || 0) >= 16 && (heapLimitBytes || 0) >= 4000 * 1048576) {
    return { value: { minGiB: 16, maxGiB: 32 }, source: 'estimated' };
  }
  return { value: null, source: 'unavailable' };
}
