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
  shadingLanguageVersion: DetectedValue<string>;
  maxCubeMapTextureSize: DetectedValue<number>;
  maxRenderbufferSize: DetectedValue<number>;
  maxViewportDimensions: DetectedValue<[number, number]>;
  maxCombinedTextureUnits: DetectedValue<number>;
  maxVertexAttributes: DetectedValue<number>;
  antialias: DetectedValue<boolean>;
  extensions: DetectedValue<string[]>;
  max3DTextureSize: DetectedValue<number>;
  maxArrayTextureLayers: DetectedValue<number>;
  maxSamples: DetectedValue<number>;
  maxColorAttachments: DetectedValue<number>;
  rendererUnmasked: DetectedValue<boolean>;
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

export interface BatteryInfo {
  /** Fraction from 0 to 1; null when unavailable. */
  level: DetectedValue<number>;
  charging: DetectedValue<boolean>;
  chargingTimeSeconds: DetectedValue<number>;
  dischargingTimeSeconds: DetectedValue<number>;
}

export interface NetworkInfo {
  online: DetectedValue<boolean>;
  connectionType: DetectedValue<string>;
  /** Browser quality class, not the cellular generation. */
  effectiveType: DetectedValue<string>;
  rttMs: DetectedValue<number>;
  downlinkMbps: DetectedValue<number>;
  saveData: DetectedValue<boolean>;
  /** API exposure only: no discovery or permission requests. */
  bluetoothApi: DetectedValue<boolean>;
  usbApi: DetectedValue<boolean>;
}

export interface HardwareInfo {
  network: NetworkInfo;
  battery: BatteryInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpu: GpuInfo;
  display: DisplayInfo;
  runtime: RuntimeInfo;
}
