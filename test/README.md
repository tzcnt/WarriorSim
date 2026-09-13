# JavaScript simulation regression tests

Run `npm run test:regressions` or `node test/simulation-regressions.test.js`. The suite uses Node
built-ins and requires no package installation. To check the browser's minified
assets as well, run `npm run test:regressions -- --dist`.

Regression tests cover these fixes:

- Reset spell reaction delays, Heroic Strike/Cleave unqueue timers (including
  Cleave's hidden backup Heroic Strike), and Execute's per-fight rage usage.
- Reset aura start timestamps, reaction delays, and minimum-use timing.
- Calculate the first off-hand swing after resetting auras, stances, and stats,
  so haste from the previous fight cannot affect it.
- Merge maximum DPS and completion times using the largest worker values.
- Sum Execute's excess rage across workers for damage-per-rage reporting.
- Charge Shield Slam's rage cost after a fight reset.
- Support seeded random rolls, including glancing damage, with independent
  streams for each global iteration so RNG assignment is reproducible.
  The seed formula is `(seed + imul(iterationOffset + i, 0x9e3779b9)) >>> 0`;
  each fight initializes a Mulberry32 stream before resetting the player.

`node --test test/queued-strikes.test.js` checks that Forever off-hand miss rolls
are independent of queued Heroic Strike/Cleave, saved unqueue and Execute macro
options are ignored, and those options are hidden in rotation details. Classic
retains both mechanics and options. The fixtures also run through native parity
and partition checks in `npm run test:wasm`.

The integration tests construct real Classic players from `js/data/session.js`
and the Classic catalogs. Fury and Cleave fixtures check repeatability and
compare the entire combat report after uneven partitions with fresh players.
They require actual Execute, glancing blows, and Flurry activity. Synchronous,
asynchronous, and manual execution are also compared with a zero seed and a
nonzero iteration offset. Unit tests isolate the individual reset and report
aggregation errors.

For a negative control against the original checkout (`ad5ac8b`), the helper can
read production sources from Git in memory, without modifying working files:

```powershell
$env:SIM_SOURCE_REF = 'ad5ac8b'
try { node test/simulation-regressions.test.js }
finally { Remove-Item Env:SIM_SOURCE_REF }
```

This run is expected to exit with failure. It covers historical regressions;
the current suite also checks behavior added after that checkout.

## Shared compute tests

After building the deployment assets, install the coordinator's independent
dependencies and run:

```powershell
npm ci --prefix server
npm run test:compute
```

The suite covers bundle hashing and complete asset preload, retained worker assets
after bundle URLs disappear, Classic Era and WoW Forever entrypoints, coordinator pool
isolation, the sharing preference and foreground priority, pool thread accounting
and the panel's thread rows, lease recovery, ownership, duplicate
results, and local fallback. Integration tests run real deployed WASM workers over
a loopback WebSocket coordinator. See [server/README.md](../server/README.md) for
the protocol and a two-tab browser preview. Native parity tests remain documented
in [wasm/README.md](wasm/README.md).
