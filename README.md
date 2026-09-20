# RigProbe

Lightweight, transparent browser hardware and capability detection.

RigProbe prefers browser-reported facts and small deterministic capability checks. It does not run heavy benchmarks or large memory-allocation probes as part of normal detection.

## Usage

```ts
import { probe } from "rigprobe";

const hardware = await probe();
console.log(hardware);
```

Focused imports are also available:

```ts
import { getGpuInfo } from "rigprobe/gpu";
import { getMemoryInfo } from "rigprobe/memory";
```

Every detected value contains only the value and its provenance:

```ts
{
  value: 16,
  source: "reported"
}
```

Sources are `reported`, `derived`, `measured`, `estimated`, or `unavailable`.

The initial package intentionally contains no heavy heuristics. Experimental estimators and benchmarks should live behind explicit opt-in APIs.

## Development

```sh
npm ci
npm run typecheck
npm test
```

This repository is consumed by HWInfo as a pinned Git submodule at `lib/` and a
local npm workspace. No npm publication is required. The package is private.
