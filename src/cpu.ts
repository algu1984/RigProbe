import type { CpuInfo, DetectedValue } from "./types.js";

interface NavigatorUAData {
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, string>>;
}

function unavailable<T>(): DetectedValue<T> {
  return { value: null, source: "unavailable" };
}

function detectWasmSimd(): boolean {
  try {
    return typeof WebAssembly !== "undefined" &&
      typeof WebAssembly.validate === "function" &&
      WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0,
        10, 22, 1, 20, 0, 253, 12,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11
      ]));
  } catch {
    return false;
  }
}

function detectEndianness(): "little" | "big" {
  const u16 = new Uint16Array([0x1234]);
  return new Uint8Array(u16.buffer)[0] === 0x34 ? "little" : "big";
}

export async function getCpuInfo(): Promise<CpuInfo> {
  const logicalThreads = navigator.hardwareConcurrency;
  let architecture = unavailable<string>();
  let bitness = unavailable<string>();

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues(["architecture", "bitness"]);
      if (hints.architecture) architecture = { value: hints.architecture, source: "reported" };
      if (hints.bitness) bitness = { value: hints.bitness, source: "reported" };
    } catch {}
  }

  return {
    logicalThreads: logicalThreads ? { value: logicalThreads, source: "reported" } : unavailable<number>(),
    architecture,
    bitness,
    wasmSimd: { value: detectWasmSimd(), source: "measured" },
    endianness: { value: detectEndianness(), source: "derived" }
  };
}
