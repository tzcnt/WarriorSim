# Classic Era and WoW Forever WASM validation

The reference engine loads this repository's `session.js` or `session_forever.js` and the matching gear catalog. It executes the production JavaScript combat engine unchanged. No native-generated reference results are used.

- `npm test`: existing combat regressions, deterministic JavaScript full-report goldens, serializer checks, and source/minified worker control tests.
- `npm run test:wasm`: full native counter parity at fixed/zero/max seeds, every fixture's uneven persistent and fresh partitions, ABI validation, optimized edge cases, and the deployed worker with the actual distribution WASM module.
- `node test/wasm/update-goldens.js`: deliberately regenerate sparse full-report goldens from JavaScript only. Review combat changes before accepting updated output.
- `npm run benchmark -- 1000 250 5`: warmed direct-JavaScript/native comparison for both modes (measured iterations, warmup, rounds).
- `node test/wasm/profile-native.js all 50000 10000`: requires the profiling WASM build; profiles both rulesets at short and 90–120 second durations.

Fixtures cover Classic Era dual wield, Cleave, and after-swing Slam, plus WoW Forever's own dual-wield rules. Forever fixtures also exercise Bloodthrill, both Slam timing behaviors, Weaponmaster, Spearing Strike, Sweeping Strikes, off-hand Whirlwind, Enrage, shield damage/cost/stat talents, and raised rage caps. Extra fixtures cover recursive physical procs, Heroic-only set bonus, target level suppression, and scheduled trinket expiration over 190-second fights. Full comparisons include damage, duration, DPS moments/extrema, sparse histogram, all action outcomes, aura uptime, weapon proc damage, and Execute rage. Numeric sums allow floating addition rounding (relative 1e-12); event counts and histogram bins are exact.

Worker VM tests exercise actual source/dist scripts and catalogs. The native worker bridge also executes the real deployed glue and WASM ABI; this does not claim an interactive browser UI was tested.

`test/forever-bleeds.test.js` checks independent Rend and Deep Wounds tick crits in
Forever, using current main-hand ability crit chance and Impale's bonus damage.
Bleed crits do not trigger Deep Wounds or other attack crit procs. Rend's initial
application cannot crit, and Classic bleeds remain unable to crit. The bleed
fixtures cover both modes and all Impale ranks through JS/native partition checks.

`test/sweeping-strikes.test.js` checks Classic talent/rotation gating, activation during an existing GCD, charge consumption, exact 20-second expiry, 30-second cooldown and fight reset. `sweeping-fixtures.js` adds JS/native partition coverage for Cleave, expiry without intervening attacks, and zero adjacent targets. Forever retains its separate timing rules.

Benchmark output belongs to the current checkout/build and local machine. Compare identical fixture definitions, iteration counts, warmups, and rounds. It does not reuse source-project speedup claims.
