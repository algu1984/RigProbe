import type { GpuInfo, DetectedValue } from "./types.js";

function unavailable<T>(): DetectedValue<T> {
  return { value: null, source: "unavailable" };
}

export function getGpuInfo(): GpuInfo {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");

    if (!gl) {
      return {
        renderer: unavailable(),
        vendor: unavailable(),
        webglVersion: unavailable(),
        maxTextureSize: unavailable()
      };
    }

    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const vendor = debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);

    return {
      renderer: { value: String(renderer), source: "reported" },
      vendor: { value: String(vendor), source: "reported" },
      webglVersion: { value: String(gl.getParameter(gl.VERSION)), source: "reported" },
      maxTextureSize: { value: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)), source: "reported" }
    };
  } catch {
    return {
      renderer: unavailable(),
      vendor: unavailable(),
      webglVersion: unavailable(),
      maxTextureSize: unavailable()
    };
  }
}
