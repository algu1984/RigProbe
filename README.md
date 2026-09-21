# RigProbe

A lightweight TypeScript library for browser hardware and capability detection. RigProbe brings together information exposed by browser APIs and identifies the source of each value, without running heavy benchmarks.

**[HardwareInfo — see RigProbe in your browser](https://hwinfo.web.app/)**

Explore the hardware and capabilities your browser reports, with a dashboard powered by RigProbe.

## What it detects

- **CPU and memory:** logical threads, architecture, bitness, WebAssembly SIMD support and browser-reported memory class.
- **Graphics and video:** GPU renderer, WebGL capabilities and video decoding support.
- **Displays:** screen dimensions, pixel ratio and, with permission, details and live updates for multiple monitors.
- **System and connectivity:** platform details, device model when available, network estimates, Bluetooth and USB API availability.
- **Battery:** charge level, charging state and reported time estimates.

## Usage

The package is developed in this repository and is not published to npm. Build it locally and link it into your project before importing it.

```ts
import { probe } from "rigprobe";

const hardware = await probe();
console.log(hardware.cpu.logicalThreads);
// { value: 8, source: "reported" }
```

Every detected value uses the same shape: `{ value, source }`. Missing information has `value: null` and `source: "unavailable"`. Other sources are `reported`, `derived`, `measured` and `estimated`.

`probe()` returns CPU, memory, GPU, display, runtime, battery and network information. Individual detectors are also available through focused imports such as `rigprobe/gpu`.

Optional APIs extend the basic snapshot:

- `getVideoCodecInfo()` — video playback, smoothness and power-efficiency predictions.
- `getRuntimeDetails()` — additional platform and device information.
- `watchBatteryInfo()` and `watchNetworkInfo()` — live updates.
- `watchScreensInfo()` — live monitor details; call from a user action to request permission.

Each watcher returns a function to stop listening.

## Browser limits

Availability depends on the browser, permissions and privacy settings. Reported values may be rounded, capped or hidden: memory class is not installed RAM, and power-efficient video decoding does not confirm hardware acceleration. RigProbe keeps unavailable values explicit rather than inventing hardware specifications.

Basic detection does not request permissions or run heavy probes. The optional memory estimator is an explicit opt-in and is never part of `probe()`.

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
```

## License

MIT
