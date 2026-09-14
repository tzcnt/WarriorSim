# Two-handed Arms preset

`Two-Handed Arms (34/17/0)` is a third permanent snapshot in
`js/data/presets_forever.js`, cloned from `Two-Handed Fury (20/31/0)`.
Both existing presets are unchanged. Bonereaver's Edge, all other equipment,
enchants, buffs, race, fight settings, and available cooldown/consumable schedules
are preserved.

The search required **at least 31 Arms points and Mortal Strike**. It selected
34/17/0, spending the extra Arms points on damage talents while retaining
Improved Execute in Fury. Bloodthirst, Death Wish, and Flurry are unavailable
under this constraint.

| Arms talent | Points | Fury talent | Points |
| --- | ---: | --- | ---: |
| Improved Heroic Strike | 2 | Cruelty | 5 |
| Improved Rend | 3 | Unbridled Wrath | 5 |
| Improved Tactical Mastery | 5 | Improved Cleave | 2 |
| Improved Overpower | 2 | Boundless Rage | 3 |
| Anger Management | 1 | Improved Execute | 2 |
| Deep Wounds | 3 | | |
| Two-Handed Weapon Specialization | 3 | | |
| Impale | 2 | | |
| Bloodthrill | 5 | | |
| Sweeping Strikes | 1 | | |
| Weaponmaster | 5 | | |
| Improved Slam | 1 | | |
| Mortal Strike | 1 | | |

Sweeping Strikes is a prerequisite for Mortal Strike and is disabled for this
single-target setup. Improved Cleave is filler to unlock Improved Execute;
Cleave is not used. One Improved Slam point removes the swing pause and gives
a **1.25-second cast and GCD**. Swings continue to advance during the cast;
due swings wait until it completes. Slam's 15-second cooldown starts at cast
completion. The second Improved Slam point was tested through talent transfers
and did not displace the selected allocation.

| Ability | Normal priority | Execute priority | Settings |
| --- | ---: | ---: | --- |
| Mortal Strike | 10 | Disabled | At least 30 rage |
| Overpower | 9 | 10 | Do not switch stance above 65 rage |
| Slam | 8 | Disabled | At least 20 rage; no main-ability cooldown or after-swing restriction |
| Whirlwind | 7 | Disabled | No main-ability cooldown restriction |
| Rend | 6 | Disabled | Do not switch stance above 40 rage; no additional duration restriction |
| Hamstring | 5 | Disabled | At least 20 rage |
| Execute | Disabled | 9 | No additional rage or swing-timer restriction |
| Heroic Strike | Swing queue | Swing queue | Queue at 80 rage |

Rend enables Bloodthrill's additional Overpower opportunities. Bloodrage and
Elune's Light retain their source schedules. Mighty Rage Potion and Juju Flurry
retain their unscheduled settings. Bloodthirst and Death Wish are explicitly
disabled in this preset. Berserker Rage, Spearing Strike, Battle Shout, and
Sunder Armor are also disabled.

## Production validation

All combat and player construction used
<https://fleetcode.com/WarriorSim/>, bundle
`1caf05580e76c3c7588da2876ce3abb7c5e37dbf18fa9cc30e8ffed3e23386aa`,
on September 14, 2026 UTC (September 13 Pacific).

The initial Arms control is a legal 31/20/0 conversion of the Fury snapshot:
replace Bloodthirst with Mortal Strike at the same priority, disable Death Wish,
and retain the inherited ability settings. Its exact talents and rotation are
recorded with the results.

Each final comparison covers **1,500,000 fights** across three nonoverlapping
seed blocks, run after the optimized configuration was frozen. All use
the source preset's 50–60-second fights, 20% execute phase, zero starting rage,
no incoming damage, no adjacent targets, and target creature type Other.
Intervals are approximate 95% sampling intervals for mean per-fight DPS.

| Configuration | Mean DPS |
| --- | ---: |
| Initial 31/20/0 Arms conversion | 589.628 ± 0.137 |
| Selected Arms talents, inherited rotation | 589.487 ± 0.136 |
| **Selected Arms talents and abilities** | **632.880 ± 0.129** |
| Selected, without Slam | 613.723 ± 0.128 |
| Selected, without Rend | 611.660 ± 0.130 |
| Selected, without Improved Slam¹ | 606.740 ± 0.129 |
| Selected, without Heroic Strike | 632.592 ± 0.129 |
| Existing two-handed Fury preset, rerun on the same build/seeds | 684.001 ± 0.148 |

¹ Move the Improved Slam point to unused Improved Hamstring to keep a legal
51-point build without adding another modeled damage benefit.

The optimized Arms preset gains **43.252 DPS (+7.34%)** over the initial Arms
conversion. It averages **51.121 DPS less than Fury (−7.47%)** in this setup.
Its duration-weighted UI DPS is **632.774**. Slam averages **2.86 casts per
fight** and contributes a net gain of approximately **19.16 DPS** compared
with disabling it while leaving the other settings fixed. Rend's corresponding
net gain is approximately **21.22 DPS**. Heroic Strike's smaller gain should not
be interpreted as proof of a precise, universally optimal rage threshold.

The retained search evaluated **21,351 distinct candidates** and accepted
**231,715,000 fights**, including **220,220,297 through the shared pool (95.04%)**.
It alternated talent neighborhoods, conditional exhaustive ability-order
searches, and threshold tuning, then refined close contenders at 500,000 fights.
Additional checks of seven-point Protection allocations and combined Spearing
Strike talent/rotation changes did not improve the selected build. This is a
local optimization with fixed cooldown schedules, not an exhaustive search of
all talent and rotation combinations.

The final Arms preset was imported into a fresh production browser profile and
its serialized simulation specification matched the optimized candidate exactly.
The Fury control also matched a fresh import of the existing Fury preset.
[Recorded configurations and results](two-handed-arms-result.json) include both
controls, the output snapshot, seed blocks, aggregate DPS moments, damage reports,
search scope, compute counts, and import verification.
