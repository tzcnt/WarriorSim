# Dual-wield ability search

The Night Elf **Dual Wield Fury (13/38/0)** preset now uses:

| Ability | Normal priority | Execute-phase priority | Other settings |
| --- | ---: | ---: | --- |
| Bloodthirst | 9 | Not used | Existing settings |
| Whirlwind | 7 | Not used | Keep the 2-second main-ability cooldown restriction |
| Overpower | 6 | 1 | Fallback after Execute; don't switch stance above 52 rage |
| Hamstring | 2 | Not used | Enabled at 10 rage; no duration restriction |
| Sunder Armor | Highest (10), disabled | Not used | Only use on first 1 globals |
| Execute | 8, unavailable before Execute phase | 8 | Existing settings |
| Heroic Strike | Separate swing queue | Existing behavior | Keep the 40-rage threshold |
| Berserker Rage | Disabled | Disabled | No Improved Berserker Rage talent points |

Higher numbers take precedence. Bloodrage and Battle Shout remain enabled.
Death Wish remains scheduled **31 seconds before fight end**. The user's race,
description, talents, gear, enchants, buffs, fight settings, and other spell
options were preserved.

Sunder is disabled, with Highest priority and the one-use limit saved for anyone
who enables it. The earlier search placed it below Hamstring, where it never
cast; that configuration measured identically to disabling Sunder.

## Production measurements

The preset's weapons were subsequently changed to Deathbringer main hand and
Brutality Blade off hand, and its [Overpower stance-switch limit](OVERPOWER_RAGE.md)
was set to 52 rage. The measurements below retain the earlier weapons and
unrestricted Overpower; the full priority search has not been rerun for those changes.

All combat used the deployed application at <https://fleetcode.com/WarriorSim/>
on September 14, 2026 UTC (September 13 Pacific), bundle
`353fef31172c98e7c39d7d09b8f5fbdbe953e8fc08a55d3d8fbaa912ae900250`.

The input was the user's edited preset: level 60 Night Elf, 13/38/0, Vis'kag the
Bloodletter / Stormstrike Hammer, Sunder Armor + Faerie Fire + Curse of
Recklessness as target debuffs, and Battle Shout enabled. The target has 336
armor after those debuffs. Fights last 50–60 seconds, with 20% Execute time,
zero starting rage, no adjacent targets, and no incoming attacks. AQ books
remain off. These results should not be compared directly with the older
Human talent-search results, which used different buffs and a different bundle.

Each row below was validated over **3,000,000 fights**, split across three
nonoverlapping random-seed blocks. The selected rotation was fixed before
validation. The metric is the mean of individual fights' DPS; intervals are
approximate 95% sampling intervals for each fixed configuration.

| Configuration | Mean DPS |
| --- | ---: |
| User's preset before the ability changes | 707.325 ± 0.097 |
| Only enable Sunder's one-use limit | 732.607 ± 0.090 |
| One-use Sunder + lowest-priority Hamstring at the default 50 rage | 732.485 ± 0.090 |
| Selected rotation | **742.949 ± 0.093** |

The selected rotation gains **35.624 DPS (+5.04%)** over the input, or
**10.343 DPS (+1.41%)** beyond the Sunder limit alone. Its duration-weighted UI
DPS is **742.737**. Gains over the input were +35.592, +35.697, and +35.584 DPS
in the three validation blocks.

The following changes are relative to the selected rotation, with everything
else held fixed:

| Change | Mean DPS | Difference |
| --- | ---: | ---: |
| Disable Hamstring | 738.902 | −4.048 |
| Require 20 rage for Hamstring | 741.878 | −1.072 |
| Require 50 rage for Hamstring | 739.157 | −3.792 |
| Restore Berserker Rage | 738.039 | −4.911 |
| Put one-use Sunder back ahead of Overpower/Hamstring | 741.560 | −1.389 |
| Remove Overpower only from Execute phase | 742.728 | −0.222 |
| Disable Heroic Strike | 717.361 | −25.588 |
| Disable Bloodthirst | 665.597 | −77.352 |
| Disable Whirlwind | 713.271 | −29.678 |
| Disable Overpower in both phases | 725.733 | −17.217 |
| Disable Execute | 618.908 | −124.042 |
| Disable Bloodrage | 735.735 | −7.214 |
| Disable Battle Shout | 674.082 | −68.867 |
| Disable Death Wish | 645.732 | −97.218 |

Swapping Bloodthirst and Whirlwind produced identical results while Whirlwind's
existing 2-second main-cooldown restriction was retained. Additional Bloodthirst
or Hamstring entries below Execute also did not change the result: they cannot
be afforded when the talented 10-rage Execute cannot be afforded. Overpower
costs only 5 rage, so it can fill some of those gaps when available.

Disabling Mighty Rage Potion or Juju Flurry made no difference because their
existing scheduling options were both off. This does not compare using those
consumables against not using them.

## Search and validation

The reusable script is `scripts/optimize-forever-abilities.js`:

- Import the local preset into a fresh production browser profile and verify
  its race, talents, buffs, and resolved baseline specification.
- Set the Sunder one-use cap; compare individual ability removals and the
  default low-priority Hamstring suggestion.
- Enumerate all **326 ordered subsets** of Bloodthirst, Whirlwind, Overpower,
  Sunder Armor, and Hamstring in normal phase. Include Heroic Strike on/off
  and Hamstring thresholds of 10, 30, 50, and 70 where relevant: **2,218**
  candidate settings per normal-phase pass.
- Enumerate all **1,957 ordered subsets** of those abilities plus Execute for
  Execute phase, with the current normal phase fixed.
- Screen at 10,000 fights. Refine the top 24 plus any candidates within three
  combined standard errors of the screen leader at 100,000 fights.
- Check Hamstring thresholds from 10 to 100 in steps of 10 and individual
  ability removals. Alternate phase searches until the selected configuration
  stops changing. This run converged after two rounds.
- Freeze the selected configuration, then validate 26 controls, finalists,
  and individual changes at 1,000,000 fights in each of three separate blocks.

The retained run evaluated **8,386 distinct candidate settings** and accepted
**258,080,000 fights**: 252,409,625 remotely (**97.80%**) and 5,670,375 locally.
The browser used two local threads and the pool reported 88 other shared
threads. Those counts exclude preliminary trials and the later preset-import
check. The exact applied preset was separately checked over 100,000 production
fights and matched the selected rotation's aggregate result.

This is exhaustive within each conditional phase search, followed by local
iteration between phases. It is not an exhaustive search of their Cartesian
product, other talents, all rage thresholds, all cooldown timings, or every
available ability. Heroic Strike's rage threshold and Whirlwind's main-cooldown
restriction were held fixed.

### Random-seed correction

The engine initializes fight `i` with `seed + i * 0x9e3779b9`, modulo 2^32.
The older talent script's stage-seed increments therefore shifted the same
sequence by one fight. That approach was initially reused here; the nearly
identical validation aggregates exposed the overlap. Those trials were discarded
from the results above, and the entire ability search was rerun.

Both optimizers now use `scripts/lib/search-seeds.js`, which reserves disjoint
blocks of 2^28 fight seeds for screening, refinement, and validation. Tests
exercise the actual simulator's seed function to guard against overlapping
blocks. The final seeds here were 557131827, 2973050931, and 1094002739. Player
construction separately uses a fixed seed to keep irrelevant random Heroic
Strike queue timers constant; that does not replace the combat seeds.

## Reproduce

```sh
npm ci --prefix compute
npm run --prefix compute install:browser
npm run optimize:abilities
```

By default this reads the current preset from `js/data/presets_forever.js` and
writes a checkpoint, raw reports, JSON profile, and base64 import string under
`scratch/forever-abilities`. To reproduce the historical input used above:

```sh
npm run optimize:abilities -- \
  --preset data/forever/dual-wield-abilities-result.json \
  --out scratch/forever-abilities-recheck
```

`--resume` requires the same deployed bundle, input, and search options.
`--smoke` runs only the initial controlled comparisons. The script writes local
artifacts and does not deploy or alter the user's browser profiles.

[Recorded results](dual-wield-abilities-result.json) retain the input and applied
presets, production identity, phase-search coverage, raw validation aggregates,
selected damage reports, and import verification. The permanent preset in
`js/data/presets_forever.js` was updated and the local distribution rebuilt.
