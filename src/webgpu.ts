import type { DetectedValue } from './types.js';

export interface WebGpuInfo {
  status: 'available' | 'unsupported' | 'no-adapter' | 'error' | 'timeout';
  vendor: DetectedValue<string>;
  architecture: DetectedValue<string>;
  device: DetectedValue<string>;
  description: DetectedValue<string>;
  isFallbackAdapter: DetectedValue<boolean>;
  features: DetectedValue<string[]>;
  limits: Record<string, DetectedValue<number>>;
}
const limitNames = [
  'maxTextureDimension1D', 'maxTextureDimension2D', 'maxTextureDimension3D', 'maxTextureArrayLayers',
  'maxBindGroups', 'maxBindGroupsPlusVertexBuffers', 'maxBindingsPerBindGroup',
  'maxDynamicUniformBuffersPerPipelineLayout', 'maxDynamicStorageBuffersPerPipelineLayout',
  'maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxStorageBuffersPerShaderStage',
  'maxStorageTexturesPerShaderStage', 'maxUniformBuffersPerShaderStage',
  'maxUniformBufferBindingSize', 'maxStorageBufferBindingSize', 'minUniformBufferOffsetAlignment',
  'minStorageBufferOffsetAlignment', 'maxVertexBuffers', 'maxBufferSize', 'maxVertexAttributes',
  'maxVertexBufferArrayStride', 'maxInterStageShaderVariables', 'maxColorAttachments',
  'maxColorAttachmentBytesPerSample', 'maxComputeWorkgroupStorageSize', 'maxComputeInvocationsPerWorkgroup',
  'maxComputeWorkgroupSizeX', 'maxComputeWorkgroupSizeY', 'maxComputeWorkgroupSizeZ', 'maxComputeWorkgroupsPerDimension'
];
const empty = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const reported = <T>(value: T): DetectedValue<T> => ({ value, source: 'reported' });
function safe(read: () => unknown): unknown { try { return read(); } catch { return undefined; } }
interface Adapter {
  info?: Record<string, unknown>;
  isFallbackAdapter?: boolean;
  features?: Iterable<string>;
  limits?: Record<string, unknown>;
}
/** Queries the default adapter only. No device, buffers, shaders or benchmarks.
 * Adapter limits describe browser capabilities, not VRAM or physical GPU limits.
 */
export async function getWebGpuInfo(): Promise<WebGpuInfo> {
  const result: WebGpuInfo = { status: 'unsupported', vendor: empty(), architecture: empty(),
    device: empty(), description: empty(), isFallbackAdapter: empty(), features: empty(), limits: {} };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const gpu = typeof navigator === 'undefined' ? undefined :
      (navigator as Navigator & { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu;
    if (typeof gpu?.requestAdapter !== 'function') return result;
    const adapter = await Promise.race([
      gpu.requestAdapter(),
      new Promise<undefined>(resolve => { timer = setTimeout(resolve, 1500); })
    ]);
    if (adapter === undefined) { result.status = 'timeout'; return result; }
    if (adapter === null) { result.status = 'no-adapter'; return result; }
    result.status = 'available';
    for (const key of ['vendor', 'architecture', 'device', 'description'] as const) {
      const value = safe(() => adapter.info?.[key]);
      if (typeof value === 'string' && value) result[key] = reported(value);
    }
    const fallback = safe(() => adapter.info?.isFallbackAdapter) ?? safe(() => adapter.isFallbackAdapter);
    if (typeof fallback === 'boolean') result.isFallbackAdapter = reported(fallback);
    const features = safe(() => adapter.features ? Array.from(adapter.features) : undefined);
    if (Array.isArray(features) && features.every(f => typeof f === 'string')) result.features = reported(features.sort());
    for (const name of limitNames) {
      const value = safe(() => adapter.limits?.[name]);
      result.limits[name] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? reported(value) : empty();
    }
    return result;
  } catch { result.status = 'error'; return result; }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
