export type DetectionSource = "reported" | "derived" | "measured" | "estimated" | "unavailable";

export interface DetectedValue<T> {
  value: T | null;
  source: DetectionSource;
}

export interface CpuInfo {
  logicalThreads: DetectedValue<number>;
  architecture: DetectedValue<string>;
  bitness: DetectedValue<string>;
  wasmSimd: DetectedValue<boolean>;
  endianness: DetectedValue<"little" | "big">;
}

export interface MemoryInfo {
  deviceMemoryGiB: DetectedValue<number>;
}

export interface GpuInfo {
  renderer: DetectedValue<string>;
  vendor: DetectedValue<string>;
  webglVersion: DetectedValue<string>;
  maxTextureSize: DetectedValue<number>;
}

export interface DisplayInfo {
  width: DetectedValue<number>;
  height: DetectedValue<number>;
  devicePixelRatio: DetectedValue<number>;
  colorDepth: DetectedValue<number>;
  orientation: DetectedValue<string>;
}

export interface RuntimeInfo {
  platform: DetectedValue<string>;
  mobile: DetectedValue<boolean>;
  touchPoints: DetectedValue<number>;
  userAgent: DetectedValue<string>;
}

export interface HardwareInfo {
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpu: GpuInfo;
  display: DisplayInfo;
  runtime: RuntimeInfo;
}
