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

[Demo Page](https://hwinfo.web.app/)

`estimateMemoryCapacity(hardware, heapLimitBytes?)` explicitly opts into lightweight,
allocation-free desktop heuristics. Its `{ value, source }` result contains an
estimated range (`minGiB`, `maxGiB`; null maximum means open-ended). It is not an
installed-RAM measurement or a guaranteed bound. `probe()` never runs this estimator
and preserves the raw browser-reported `deviceMemoryGiB` separately.

## Battery

`probe()` includes a `battery` snapshot. `getBatteryInfo()` is also available from
`rigprobe` or `rigprobe/battery`. Fields are `level` (0–1), `charging`,
`chargingTimeSeconds`, and `dischargingTimeSeconds`, each strictly `{ value, source }`.
Missing, blocked or stalled APIs return unavailable values. Infinite/invalid time
estimates become `null`; a valid zero is preserved. Snapshots time out after 1.5 seconds; subscriptions still accept late responses.

```ts
import { watchBatteryInfo } from 'rigprobe/battery';
const stop = watchBatteryInfo(battery => console.log(battery));
// On component teardown:
stop();
```

The subscription emits an initial snapshot and listens to all four battery events,
without polling. It can be cancelled even before the API resolves. Browser values
can be defaults (100%, charging); they do not prove a physical battery is present.
