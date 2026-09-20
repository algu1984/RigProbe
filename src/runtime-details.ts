import type { DetectedValue } from "./types.js";
export interface RuntimeDetails {
  platformVersion: DetectedValue<string>;
  model: DetectedValue<string>;
  formFactors: DetectedValue<string[]>;
  architecture: DetectedValue<string>;
  bitness: DetectedValue<string>;
  wow64: DetectedValue<boolean>;
}
/** Raw UA Client Hints, not a guessed OS release. Windows platformVersion
 * represents a platform API version. Empty/blocked hints remain unavailable.
 */
export async function getRuntimeDetails(): Promise<RuntimeDetails> {
  let hints: Record<string, unknown> = {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ua = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(keys: string[]): Promise<Record<string, unknown>> } }).userAgentData;
    if (ua?.getHighEntropyValues) hints = await Promise.race([
      ua.getHighEntropyValues(["platformVersion", "model", "formFactors", "architecture", "bitness", "wow64"]),
      new Promise<Record<string, unknown>>(resolve => { timer = setTimeout(() => resolve({}), 1500); })
    ]);
  } catch { /* Optional API, privacy restrictions or non-browser environment. */ }
  finally { if (timer !== undefined) clearTimeout(timer); }
  const text = (key: string): DetectedValue<string> => typeof hints?.[key] === "string" && hints[key] !== ""
    ? { value: hints[key] as string, source: "reported" } : { value: null, source: "unavailable" };
  const factors = hints?.formFactors;
  return {
    platformVersion: text("platformVersion"), model: text("model"), architecture: text("architecture"), bitness: text("bitness"),
    formFactors: Array.isArray(factors) && factors.length > 0 && factors.every(f => typeof f === "string" && f.length > 0)
      ? { value: [...factors], source: "reported" } : { value: null, source: "unavailable" },
    wow64: typeof hints?.wow64 === "boolean" ? { value: hints.wow64, source: "reported" } : { value: null, source: "unavailable" }
  };
}
