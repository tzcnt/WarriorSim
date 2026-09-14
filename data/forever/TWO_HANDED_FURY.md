# Two-handed Fury preset

`Two-Handed Fury (20/31/0)` is a separate permanent snapshot in
`js/data/presets_forever.js`. It clones the Night Elf dual-wield preset, replaces
both weapons with **Bonereaver's Edge (17076)** in the two-hand slot, and transfers
Crusader and Elemental Sharpening Stone to that weapon. The original preset is
unchanged. Other equipment, buffs, fight settings, and cooldown/consumable schedules
are preserved.

The search required **Bloodthirst and at least 31 Fury points**; the result spends
exactly 31. Mortal Strike builds were excluded. Improved Slam requires 25 earlier
Arms points, so it is unavailable under this constraint. Untalented Forever Slam
has a 1.5-second cast, pauses swings, and starts its 15-second cooldown when the
cast completes.

| Arms talent | Points | Fury talent | Points |
| --- | ---: | --- | ---: |
| Improved Heroic Strike | 2 | Cruelty | 5 |
| Improved Rend | 3 | Unbridled Wrath | 5 |
| Improved Tactical Mastery | 5 | Improved Cleave | 3 |
| Improved Overpower | 2 | Boundless Rage | 3 |
| Anger Management | 1 | Enrage | 5 |
| Deep Wounds | 2 | Improved Execute | 2 |
| Two-Handed Weapon Specialization | 3 | Precision | 1 |
| Impale | 2 | Death Wish | 1 |
| | | Flurry | 5 |
| | | Bloodthirst | 1 |

Improved Rend unlocks Deep Wounds; Rend itself is disabled. Improved Cleave is
filler to reach deeper Fury talents, and Enrage is required for Flurry. This
preset has no incoming attacks and does not use Cleave.

| Ability | Normal priority | Execute priority | Settings |
| --- | ---: | ---: | --- |
| Bloodthirst | 10 | Disabled | No additional rage restriction |
| Overpower | 9 | 10 | Do not switch stance above 70 rage |
| Whirlwind | 8 | Disabled | No Bloodthirst cooldown restriction |
| Slam | 7 | Disabled | At least 70 rage; Bloodthirst cooldown at least 2 seconds; after-swing restriction off |
| Hamstring | 6 | Disabled | At least 10 rage |
| Execute | Disabled | 9 | No additional rage or swing-timer restriction |
| Heroic Strike | Swing queue | Swing queue | Queue at 130 rage, the talented rage cap |

Berserker Rage, Spearing Strike, Rend, Battle Shout, and Sunder Armor remain
unused. Bloodrage, Death Wish, and Elune's Light retain the source preset's
schedules. Mighty Rage Potion and Juju Flurry retain their existing unscheduled
settings.

## Production validation

Combat and player construction for the retained search used
<https://fleetcode.com/WarriorSim/>, bundle
`660b967baa7f6004c17d39bac5d30c778200b8f5efde9e3d943b1ac95c11feed`,
on September 14, 2026 UTC (September 13 Pacific). A preliminary local search
was stopped when production execution was requested; its measurements are not
included below.

The final selection was frozen before three nonoverlapping validation seed
blocks. Each comparison below covers **1,500,000 fights** with the source
preset's 50–60-second duration and 20% execute phase. Intervals are approximate
95% sampling intervals for the mean of individual fights' DPS.

| Configuration | Mean DPS |
| --- | ---: |
| Weapon swap only; original talents and abilities | 616.718 ± 0.136 |
| Selected talents; original abilities | 660.083 ± 0.147 |
| Selected talents and abilities | **683.994 ± 0.148** |
| Selected, without Slam | 683.891 ± 0.148 |
| Selected, without Heroic Strike | 684.094 ± 0.148 |

The selected preset gains **67.276 DPS (+10.91%)** over the weapon swap alone.
Its duration-weighted UI DPS is **683.697**. Slam's net benefit is small at this
untalented cast time; it averages about 0.67 casts per fight. The holdout
comparisons do not establish a clear advantage from enabling Slam or Heroic
Strike. Both remain enabled conservatively, with high rage requirements.

The retained search evaluated **24,958 distinct candidates** and accepted
**215,917,500 fights**, including **199,762,361 through the shared pool (92.52%)**.
It alternated talent neighborhoods, conditional exhaustive ability-order searches,
and threshold tuning, then refined close contenders at 500,000 fights. This is
a local optimization with fixed cooldown schedules, not an exhaustive search of
all talents and settings together.

The final preset was imported into a fresh production browser profile and its
serialized simulation specification matched the selected candidate exactly.
The original dual-wield preset was also checked against the unchanged source.
[Recorded configuration and results](two-handed-fury-result.json) include the
input/output snapshots, seeds, aggregate DPS moments, damage reports, search
scope, compute counts, and import verification.
