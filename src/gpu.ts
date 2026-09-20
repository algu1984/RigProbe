import type { GpuInfo, DetectedValue } from './types.js';

const unavailable = <T>(): DetectedValue<T> => ({ value: null, source: 'unavailable' });
const reported = <T>(value: T): DetectedValue<T> => ({ value, source: 'reported' });
const text = (value: unknown): DetectedValue<string> => typeof value === 'string' && value.length > 0 ? reported(value) : unavailable();
const number = (value: unknown): DetectedValue<number> => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? reported(value) : unavailable();
function safe<T>(read: () => T): T | undefined { try { return read(); } catch { return undefined; } }

export function getGpuInfo(): GpuInfo {
  const result: GpuInfo = {
    renderer: unavailable(), vendor: unavailable(), webglVersion: unavailable(),
    maxTextureSize: unavailable(), shadingLanguageVersion: unavailable(),
    maxCubeMapTextureSize: unavailable(), maxRenderbufferSize: unavailable(),
    maxViewportDimensions: unavailable(), maxCombinedTextureUnits: unavailable(),
    maxVertexAttributes: unavailable(), antialias: unavailable(), extensions: unavailable(),
    max3DTextureSize: unavailable(), maxArrayTextureLayers: unavailable(),
    maxSamples: unavailable(), maxColorAttachments: unavailable(), rendererUnmasked: unavailable()
  };
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    const gl2 = safe(() => canvas.getContext('webgl2'));
    gl = gl2 ?? safe(() => canvas.getContext('webgl')) ?? null;
    if (!gl) return result;
    const context = gl;
    const parameter = (key: number | undefined): unknown => key === undefined ? undefined : safe(() => context.getParameter(key));
    const debug = safe(() => context.getExtension('WEBGL_debug_renderer_info'));
    const renderer = debug ? text(parameter(debug.UNMASKED_RENDERER_WEBGL)) : unavailable<string>();
    result.renderer = renderer.value !== null ? renderer : text(parameter(context.RENDERER));
    const vendor = debug ? text(parameter(debug.UNMASKED_VENDOR_WEBGL)) : unavailable<string>();
    result.vendor = vendor.value !== null ? vendor : text(parameter(context.VENDOR));
    result.rendererUnmasked = reported(renderer.value !== null);
    result.webglVersion = text(parameter(context.VERSION));
    result.shadingLanguageVersion = text(parameter(context.SHADING_LANGUAGE_VERSION));
    result.maxTextureSize = number(parameter(context.MAX_TEXTURE_SIZE));
    result.maxCubeMapTextureSize = number(parameter(context.MAX_CUBE_MAP_TEXTURE_SIZE));
    result.maxRenderbufferSize = number(parameter(context.MAX_RENDERBUFFER_SIZE));
    result.maxCombinedTextureUnits = number(parameter(context.MAX_COMBINED_TEXTURE_IMAGE_UNITS));
    result.maxVertexAttributes = number(parameter(context.MAX_VERTEX_ATTRIBS));
    const viewport = parameter(context.MAX_VIEWPORT_DIMS);
    if ((Array.isArray(viewport) || viewport instanceof Int32Array) && viewport.length === 2 &&
      Array.from(viewport).every(value => Number.isFinite(value) && value >= 0)) {
      result.maxViewportDimensions = reported([viewport[0] as number, viewport[1] as number]);
    }
    const attributes = safe(() => context.getContextAttributes());
    if (typeof attributes?.antialias === 'boolean') result.antialias = reported(attributes.antialias);
    const extensions = safe(() => context.getSupportedExtensions());
    if (Array.isArray(extensions)) result.extensions = reported([...extensions].sort());
    if (gl2) {
      result.max3DTextureSize = number(parameter(gl2.MAX_3D_TEXTURE_SIZE));
      result.maxArrayTextureLayers = number(parameter(gl2.MAX_ARRAY_TEXTURE_LAYERS));
      result.maxSamples = number(parameter(gl2.MAX_SAMPLES));
      result.maxColorAttachments = number(parameter(gl2.MAX_COLOR_ATTACHMENTS));
    }
    return result;
  } catch {
    return result;
  } finally {
    // The probe owns this temporary context; release its GPU resources after reading.
    const context = gl;
    if (context) safe(() => context.getExtension('WEBGL_lose_context')?.loseContext());
  }
}
