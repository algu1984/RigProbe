import type { RuntimeInfo } from "./types.js";

interface NavigatorUAData {
  platform?: string;
  mobile?: boolean;
}

export function getRuntimeInfo(): RuntimeInfo {
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const platform = uaData?.platform || navigator.platform || null;

  return {
    platform: { value: platform, source: platform ? "reported" : "unavailable" },
    mobile: uaData?.mobile === undefined
      ? { value: null, source: "unavailable" }
      : { value: uaData.mobile, source: "reported" },
    touchPoints: { value: navigator.maxTouchPoints, source: "reported" },
    userAgent: { value: navigator.userAgent, source: "reported" }
  };
}
