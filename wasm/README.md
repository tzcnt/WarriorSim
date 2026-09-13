# Native Classic Era and WoW Forever simulation engine

JavaScript constructs the player from this repository's Classic Era/WoW Forever catalogs and serializes the resolved configuration once per worker. C++ owns the entire combat loop, RNG, attacks, spells, auras, procs, and report accumulation; there are no per-event JavaScript callbacks.

## Build

After installing dependencies with `npm ci`, run `./build-dist.sh` (Linux/macOS)
or `.\build-dist.bat` (Windows) from the repository root to rebuild all deployment
assets. `dist/` is generated locally and is not tracked. See the
[setup guide](../CONTRIBUTING.md) for prerequisites.

This includes sub-calls to `scripts/generate-native-keys.js` and `./wasm/build.ps1` or `./wasm/build.sh`.

Use `./wasm/build.ps1` for Release, `./wasm/build.ps1 -Profiling` for the separate profiling artifact, or `-Configuration Debug`. The script finds Emscripten through EMSDK or the sibling `../emsdk` installation. Generated artifacts live under `wasm/dist`.

For a standalone WASM build, run `node scripts/generate-native-keys.js` first
after changing native action literals.
The generator derives action names from C++ and rebuilds both tables' positional
indices. The property name array is curated: keep names accessed dynamically
(including live weapon skill slots), and remove names only when JavaScript no
longer produces them. `node scripts/generate-native-keys.js --check` verifies that
both headers are current; compile-time assertions also check every index.

## Interface

The ES-module default factory exposes `createEngine(JSON.stringify(spec), seed)`, `runBatch(handle, count, globalIterationOffset, fullReport)`, and `destroyEngine(handle)`. Specification version 1 contains resolved scalar properties, spell/aura constructor kinds and links, weapon/proc definitions, and simulation parameters. Unknown kinds, unsupported game modes and dangling links fail closed. Seeds and iteration ranges are unsigned 32-bit values.

Each iteration uses Mulberry32 seeded by `seed + imul(globalIteration, 0x9e3779b9)`. Report counters reset at batch boundaries; combat reset follows the JavaScript implementation. Sword-proc timestamps reset at the start of every fight in both modes.

## Shared execution

The optional [compute coordinator](../server/README.md) distributes resolved
Classic Era or WoW Forever execution specs to opted-in helpers running the same bundle hash.
A shared worker needs only its fixed worker code, WASM loader, and binary; it
receives the complete resolved spec with the job. It never downloads executable
code supplied by another participant. Each tab preloads and retains every manifest
asset, including both game catalogs, before startup. Its later local and donated
workers use those retained assets even if the original bundle directory is removed.

Shared chunks use the existing engine interface with a fixed seed and disjoint
global iteration ranges. Report counters are batch-only. Aggregation order can change floating point sums. Shared execution does not alter the native combat mechanics.
The protocol is ready for a future native worker application, which must be built
and checked against the advertised bundle's engine behavior before joining its pool.

## Validation and profiling

After a full distribution build, run:

```sh
npm test
npm run test:wasm
npm run test:regressions -- --dist
npm run benchmark -- 1000 250 5
```

The suites compare complete JavaScript and native reports, fixed-seed goldens,
persistent batches, worker partitions, proc ordering, fractional clocks, on-use
items, stance changes, and Classic/Forever talent mechanics. Each mode is checked
against its own rules; their damage totals are intentionally different.

Benchmark timings depend on the machine and configuration. Generate current
measurements with the command above. For CPU profiles, build the profiling
artifact and run:

```sh
node test/wasm/profile-native.js all 500000 100000 wasm/dist/profiles/current
```

Historical port measurements are available in Git history. They do not describe
the current catalogs or engine.
