# Default dual-wield talent search

The current default is **13/38/0**, with **Death Wish scheduled 31 seconds before
fight end** to overlap Execute. Start-relative scheduling is disabled.
It is also permanently available under **Profiles → Presets → Dual Wield Fury
(13/38/0)**. Selecting it creates and loads an editable copy with the recorded
gear, buffs, fight settings, talents, and rotation. The preset remains available
after copies are edited or deleted.
The old default was already a legal 17/34/0 allocation with all 51 points spent.
Death Wish was selected but had neither timing option enabled, so it never fired.

These measurements used the live <https://fleetcode.com/WarriorSim/> application
on 2026-09-14 UTC (September 13 Pacific), bundle
`022461b67809aeb6ce55c19b32467dc142b7c4d6b538ffea66191b22208dd494`.
Combat ran in that deployed WASM bundle through its normal shared-compute scheduler.
The script used two local threads; the pool reported roughly 84–106 other shared
threads during the searches. No deployment was performed.

## Measurements

The original search below used Death Wish at the pull. The default and permanent
preset subsequently moved it to 31 seconds before fight end; the recorded
measurements are historical and have not been rerun for that timing change.

Each row below uses 1,000,000 fights with a fresh validation seed, separate from
the seeds used to choose the build. The same seed was used across candidates.

| Configuration | Mean fight DPS (95% interval half-width) | UI DPS (damage / duration) |
| --- | ---: | ---: |
| Shipped 17/34/0 and rotation | 289.920 ± 0.087 | 289.914 |
| Same 17/34/0, Death Wish at the pull | 330.596 ± 0.097 | 330.480 |
| Recommended 13/38/0, Death Wish at the pull | 346.023 ± 0.093 | 345.912 |

The talent change contributes **15.427 DPS / 4.67%** with Death Wish enabled in
both builds. Talents plus the Death Wish timing fix contribute **56.103 DPS /
19.35%** relative to the shipped profile. Spearing Strike was tested on and off
whenever learned; it is disabled in the recommendation.

The objective is the mean of individual fights' DPS. The site's displayed DPS
uses total damage divided by total duration; both are retained in the results.
Intervals describe sampling error for a fixed candidate, not a guarantee that
the selected build is the global optimum. Aggregate reports do not supply paired
fight covariance, so the script labels its difference-error estimate as unpaired.

## Allocation

Unlisted talents have zero points.

| Arms | Rank | Fury | Rank |
| --- | ---: | --- | ---: |
| Improved Heroic Strike | 2/3 | Cruelty | 5/5 |
| Improved Rend | 3/3 | Unbridled Wrath | 5/5 |
| Improved Tactical Mastery | 3/5 | Improved Cleave | 3/3 |
| Improved Overpower | 2/2 | Boundless Rage | 2/3 |
| Deep Wounds | 3/3 | Dual Wield Specialization | 5/5 |
| | | Raging Blows | 1/1 |
| | | Enrage | 5/5 |
| | | Improved Execute | 2/2 |
| | | Precision | 3/3 |
| | | Death Wish | 1/1 |
| | | Flurry | 5/5 |
| | | Bloodthirst | 1/1 |

Improved Rend is required for Deep Wounds even though Rend is disabled. Enrage
is required for Flurry even though the target supplies no incoming attacks.
Some early Fury filler allocations give equal DPS in this single-target model;
ties within 0.000001 DPS prefer the fewest changes to the original default.
The retained Improved Cleave points satisfy the row requirement, rather than
contributing single-target damage.

## Search scope and evidence

- Level 60 Human, exactly 51 points, Bloodthirst, at least 31 Fury, zero Protection.
- Default gear and enchants, including Vis'kag the Bloodletter and Stormstrike
  Hammer; default buffs, reaction time, and remaining rotation settings.
- One level-63 target, 3,731 base armor, creature type Other, no incoming attacks;
  50–60 seconds, 20% Execute phase, zero starting rage, 10 ms batching.
- Existing spell settings were preserved. Optional talent actions use their
  deployed defaults; selected talent cooldowns with no timing enabled are also
  tested at the pull. This enabled Death Wish without rescheduling unrelated
  consumables or searching cooldown timing, race, gear, buffs, or other rotations.
- All row gates, rank caps, and prerequisites are checked locally and by the
  deployed validator before each job. At least 31 Fury leaves at most 20 Arms,
  which excludes Weaponmaster and the rest of Arms row five and deeper.

A multistart beam search first explored legal one-point transfers. An exhaustive
pass then evaluated **1,847 allocations / 4,202 talent-and-action combinations**
inside [these explicit bounds](dual-wield-search-bounds.json). Those bounds hold
Cruelty, Unbridled Wrath, Dual Wield Specialization, Enrage, Flurry, Raging Blows,
Death Wish, and Bloodthirst at maximum rank; limit early Fury filler; and omit
non-damaging Arms filler and Two-Handed Weapon Specialization. These are search
assumptions, not proven globally optimal locks.

A final local search started from the exhaustive winner with those locks removed.
It screened at 5,000 fights, rechecked plausible contenders and starting builds at
200,000 fights, and evaluated **all 86 legal one-point transfers** from the winner,
including their action choices. None improved its refinement score. Finalist
selection was frozen before the independent 1,000,000-fight validation.
The final search and its resumed tie-resolution pass evaluated 1,516 allocations,
3,032 action combinations, and 160,690,000 fights. Shared workers completed
156,799,917 of those fights (97.58%).

This supports a local optimum and an exhaustive result within the published
bounds. It does not establish a global optimum across every legal Bloodthirst
build, every rotation, or other fight profiles. The simulator's provisional
Forever mechanics and documented model limitations still apply.

[The recorded result](dual-wield-talents-result.json) includes the build identity,
original at-pull configuration, talent keys, raw validation aggregates,
seeds, and compute counts. The permanent preset in `js/data/presets_forever.js`
preserves that configuration with the corrected end-relative Death Wish timing.

## Running the script

From the repository root:

```sh
npm ci --prefix compute
npm run --prefix compute install:browser
npm run optimize:talents -- --talent-actions
```

The script opens a fresh browser context on production, uses the site's verified
asset loader and scheduler, and leaves your browser profiles untouched. It does
not load local combat code or rebuild `dist/`. `--site` can select another hosted
deployment. The default output directory is `scratch/forever-talents`.
When enabling an unscheduled Death Wish, `--talent-actions` now schedules it 31
seconds before fight end. Old checkpoints using the at-pull option are incompatible.

To repeat the bounded search and then remove its locks:

```sh
npm run optimize:talents -- --talent-actions --method exhaustive \
  --bounds data/forever/dual-wield-search-bounds.json \
  --out scratch/forever-exhaustive --refine 200000 --final 1000000 --finalists 12

npm run optimize:talents -- --talent-actions \
  --start-from scratch/forever-exhaustive/results.json \
  --out scratch/forever-local --refine 200000 --final 1000000 --finalists 12
```

`--bounds` maps talent keys to fixed ranks or `[minimum, maximum]`. Exhaustive
search requires explicit bounds and stops if the candidate count exceeds
`--limit` (100,000 by default). Local search also accepts bounds. It explores
multiple independent legal starts and a beam of candidates, then refines a full
one-point neighborhood. It reports failure if the round limit prevents convergence.

Add `--resume` to the same command to reuse completed samples. The checkpoint
checks the deployed bundle, loaded profile, search settings, and bounds; it refuses
to mix results after those change. After a deployment the script optimizes the
new site's defaults, so numerical results can differ from this historical run.
Seeds assign the same per-fight random streams across candidates. Worker chunk
partitioning and floating-point aggregation can still cause small differences;
see [the compute documentation](../../server/README.md).

Outputs:

- `checkpoint.json`: completed simulation aggregates, configuration, and progress.
- `results.json`: selected candidate, baseline/action comparisons, uncertainty,
  talent keys, and production snapshot.
- `profile.json` / `profile.txt`: JSON/base64 for the site's Import Profile action.
- `session.json`: the full saved session with the selected talents and action settings.

Run `node --test test/talent-search.test.js` for search-rule and enumeration checks.
`npm test` also includes these checks and the existing simulator regressions.
