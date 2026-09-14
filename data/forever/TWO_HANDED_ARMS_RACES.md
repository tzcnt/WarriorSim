# Race comparison: optimized two-handed Arms

**Night Elf remains the strongest tested race for this preset.** It leads Human
by **7.467 DPS (+1.19%)**. Elune's Light retains the preset's existing
16-seconds-before-end setting. The preset file was not changed.

All races use the same **34/17/0** talents, Bonereaver's Edge, gear, enchants,
buffs, core rotation, and nonracial cooldown schedules. Fights last 50–60 seconds,
with 20% execute time, no incoming damage or adjacent targets, and target creature
type **Other**. Each active racial's timing was tuned separately; talents and
ordinary ability settings were not reoptimized per race.

All combat used <https://fleetcode.com/WarriorSim/> on September 14, 2026 UTC
(September 13 Pacific), bundle
`1caf05580e76c3c7588da2876ce3abb7c5e37dbf18fa9cc30e8ffed3e23386aa`.
The final table uses **1,500,000 fights per race**, split across three
nonoverlapping validation seed blocks after freezing each racial's timing.
Values are mean per-fight DPS with approximate 95% sampling intervals.

| Race | Mean DPS | Selected racial timing |
| --- | ---: | --- |
| Night Elf | 632.853 ± 0.129 | Elune’s Light: 16 seconds before end |
| Human | 625.386 ± 0.126 | Passive bonuses |
| Troll | 622.746 ± 0.125 | Berserking: 14 seconds before end |
| Gnome | 622.004 ± 0.123 | Eureka!: 15 seconds before end |
| Orc | 619.435 ± 0.123 | Blood Fury: 5 seconds after pull |
| Undead | 617.683 ± 0.124 | Passive bonuses |
| Skyborne | 616.915 ± 0.124 | Passive bonuses |
| Tauren | 613.630 ± 0.123 | Passive bonuses |
| Dwarf | 612.200 ± 0.123 | Passive bonuses |

The racial-timing sweep checked defaults, disabling the racial, every integer
1–60 seconds before fight end, and times 0–50 seconds after the pull in five-second
steps. Candidates were screened at 20,000 fights, refined at 200,000, and the
top eight per racial refined at 500,000 before independent validation. Default
racial timings and disabled-racial controls were also validated independently.
The run evaluated **297 distinct configurations**, accepting
**63,740,000 fights**; **97.87%** came through the shared pool.

With Elune's Light disabled, Night Elf averaged
**612.054 DPS**. Its cooldown provides about
**20.798 DPS** in this setup.
The current simulator's [provisional racial assumptions](RACIALS.md) apply.
Undead's computed maximum health is 3749; Skyborne uses Human base stats.
The Beast and Elemental damage bonuses do not apply to this target.

All nine race variants were imported into fresh production browser storage and
matched their simulated specifications exactly, including racial eligibility,
activation times, and the fixed talents and rotation.
[Recorded inputs and results](two-handed-arms-races-result.json) include the
preset snapshot, seeds, aggregate DPS moments, timing settings, controls, compute
counts, and import verification.
