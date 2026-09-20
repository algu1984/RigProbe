import type { DetectedValue } from "./types.js";

export interface VideoCodecInfo {
  name: string;
  configuration: MediaDecodingConfiguration;
  supported: DetectedValue<boolean>;
  smooth: DetectedValue<boolean>;
  /** Browser efficiency prediction, NOT confirmation of hardware decoding. */
  powerEfficient: DetectedValue<boolean>;
}

const profiles = [
  ["H.264 · High · 8-bit", "video/mp4", "avc1.640028"],
  ["HEVC · Main · 8-bit", "video/mp4", "hvc1.1.6.L93.B0"],
  ["HEVC · Main 10 · 10-bit", "video/mp4", "hvc1.2.4.L93.B0"],
  ["VP8 · 8-bit", "video/webm", "vp8"],
  ["VP9 · Profile 0 · 8-bit", "video/webm", "vp09.00.31.08"],
  ["VP9 · Profile 2 · 10-bit", "video/webm", "vp09.02.31.10"],
  ["AV1 · Main · 8-bit", "video/mp4", "av01.0.08M.08"],
  ["AV1 · Main · 10-bit", "video/mp4", "av01.0.08M.10"]
] as const;

function reported(value: unknown): DetectedValue<boolean> {
  return typeof value === "boolean"
    ? { value, source: "reported" } : { value: null, source: "unavailable" };
}

/** Fixed 1080p30 SDR profiles; no playback, downloads, DRM or benchmarks.
 * Separate from probe() so callers can choose when to query video support.
 * Each query is bounded to 1500 ms. Missing, rejected and timed-out queries
 * remain unknown rather than incorrectly declaring a codec unsupported.
 */
export async function getVideoCodecInfo(): Promise<VideoCodecInfo[]> {
  return Promise.all(profiles.map(async ([name, container, codec]) => {
    const configuration: MediaDecodingConfiguration = {
      type: "file",
      video: { contentType: `${container}; codecs="${codec}"`, width: 1920,
        height: 1080, bitrate: 5_000_000, framerate: 30 }
    };
    let result: MediaCapabilitiesDecodingInfo | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.mediaCapabilities?.decodingInfo === "function") {
        result = await Promise.race([
          navigator.mediaCapabilities.decodingInfo(configuration),
          new Promise<undefined>(resolve => { timer = setTimeout(resolve, 1500); })
        ]);
      }
    } catch { /* Privacy restrictions or unsupported configurations remain unknown. */ }
    finally { if (timer !== undefined) clearTimeout(timer); }
    return { name, configuration, supported: reported(result?.supported),
      smooth: reported(result?.smooth), powerEfficient: reported(result?.powerEfficient) };
  }));
}
