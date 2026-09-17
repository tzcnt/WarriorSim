# WoW Forever Warrior talent extraction

Captured from [Hyjal's Warrior calculator](https://hyjal.cc/talent-calculator/warrior)
on 2026-09-16. The source labels all tooltips as client build **1.60.1.69876**.
The asset URL, retrieval timestamp and SHA-256 are recorded in `warrior-source.json`.
The snapshot preserves Hyjal's Warrior object without changing its fields.

Run `node scripts/extract-forever-talents.js` to regenerate `js/data/talents_forever.js`.
The catalog contains **53 talents: 17 Arms, 18 Fury, 18 Protection**, with all 154
rank descriptions supplied explicitly by the source. No rank estimation or overrides
are applied. `rank-text.js` is retained only as a historical extraction helper.

The generated catalog uses the existing `n`/`m`/`d`/`x`/`y` talent structure, converting
rows and columns to zero-based coordinates. Prerequisites use `[parent index, max rank]`.
`i` stores Hyjal's talent ID; `s` remains null because the source does not provide every
rank's spell ID. `forever.tooltip` preserves source/build/base spell ID/notes, alongside
requirements, costs, passive status, and stable local keys. All ranks are source-complete.
`js/talent-rules.js` attaches runtime handlers and simulation support metadata.
Forever tooltips continue to use local descriptions.

Saved builds now use `forever-v2`. Keyed builds and positional `forever-v1` builds
migrate with Vitality points refunded, preserving talent identity across the removed
slot. Invalid descendants are also refunded. Classic positional builds still migrate
by name. Default and permanent presets use the updated schema and catalog.

The September 16 update corrects Improved Rend to 12/23/35%, Improved Execute to
3/5 Rage, and Improved Disarm to 7/13/20 seconds; removes Vitality; moves Focused Rage
to row 6 column 3 and Bastion to row 5 column 4; and requires a two-handed melee weapon
for Spearing Strike. Weaponmaster and Improved Berserker Rage match our prior overrides.
Historical optimization results in this directory describe their original source
snapshot; the stored builds migrate, but the results have not been re-optimized.

## Combat rules

JavaScript character/spell construction and the WASM combat engine implement the
same rules. Rank/stat/cost changes include Rend, Tactical Mastery (10 baseline +
3 per point), Flurry, Unbridled Wrath, off-hand damage/hit/rage, Precision, Focused
Rage, Bastion, Execute/Cleave/Thunder Clap costs, and both
Bloodrage's initial gain and fractional ticks. Boundless Rage raises all supported
rage-source caps, including refunds and initial rage.

- Bloodthirst: 35% AP + 30/40/50/60 at levels 40/48/54/60.
- Shield Slam: 225–235 / 264–276 / 303–317 / 421–439 at those levels, plus block value once, with no AP coefficient.
- Forever Slam has a confirmed 15-second cooldown, starting at cast completion, at every talent rank. Without Improved Slam it pauses weapon timers during casting. Either talent rank lets them advance, deferring due swings until cast completion. Cast time and GCD are 1500/1250/1000 ms at 0/1/2 ranks. Classic has no cooldown and still resets timers at cast completion.
- Bloodthrill: landed melee damage against the player's active Rend rolls 2% per rank for one six-second Overpower opportunity, with no ICD. It refreshes, does not stack, and is independent of the ordinary dodge window. Adjacent targets without Rend cannot trigger it.
- Weaponmaster: crit/extra-attack effects use existing weapon specialization code; mace/staff bypass 3% armor per rank for that hand, after armor debuffs. The sword proc guard resets between fights in both Classic and Forever so batching does not change results.
- Raging Blows: Whirlwind rolls each hand independently against each target, with one rage cost/cooldown. Off-hand damage uses the actual off-hand weapon. Cleave costs 2 less rage.
- Spearing Strike: 40% normalized main-hand damage, or 120% against Giant/Dragonkin/mounted targets selected in Settings. A landed hit dismounts a mounted target. Uses ordinary melee hit/crit/refund rules.
- Enrage: existing incoming damaging attacks roll a 30% chance for 2% Physical damage per rank for 12 seconds; reapplication refreshes it. Death Wish's Forever +5% incoming damage penalty applies to the existing damage/rage events.
- Sweeping Strikes: 30 rage before Focused Rage, Battle Stance, 30-second cooldown, 1.5-second GCD, five copied melee hits to an adjacent target. Copies inherit the original hit's damage, generate no rage/procs, and are reported separately. The captured description supplies no duration, so the implementation retains unspent charges until consumed or combat ends.

Classic also implements Sweeping Strikes using spell 12292 and the same copy logic.
Its five charges expire after 20 seconds, and activation neither requires a free GCD
nor starts or clears one, matching the [Classic spell data](https://www.wowhead.com/classic/spell=12292/sweeping-strikes).
Both modes require the talent, an enabled rotation action, and Adjacent Mobs > 0.

Off-hand rage scaling includes damage-derived swing rage and dodge compensation,
but not flat procs such as Unbridled Wrath. Unbridled Wrath continues to trigger on
autos and queued Heroic Strike/Cleave. Baseline hit, glancing and rage formulas
remain Classic, with explicit Forever talent modifiers.

## Pre-existing model defects retained intentionally

Incoming attacks are configured damage events, without avoidance, block or crit
outcomes. Consequently Shield Specialization and Master of Defense cannot generate
reactive rage, and Anticipation/Deflection/Toughness do not simulate mitigation.
Revenge and Charge are absent, so Improved Revenge, Improved Charge and Vanguard
remain data-only. Current health/healing (Blood Craze, Last Stand),
threat (Defiance), and crowd-control/movement/utility effects are also outside the
existing DPS model. Maximum health is calculated for
Touch of the Grave; see [the racial notes](RACIALS.md). The other defensive-model
limitations remain unchanged.
The current equipment catalog also has no shields; Shield Slam/Bastion validation
uses a synthetic shield fixture. The corresponding numeric talent handlers and descriptions are present, without
claiming those missing systems are simulated.

## Validation

`test/forever-talents.test.js` checks formulas, costs, raised rage caps, fractional
Bloodrage ticks, per-hand damage/hit/rage/armor bypass, Bloodthrill, Spearing Strike,
Sweeping Strikes, exact Slam cast/GCD/swing timestamps, migration and local tooltips.
`test/wasm/forever-fixtures.js` adds six full-report JS/native parity fixtures with
fresh/persistent partitions. Existing Classic goldens are unchanged; Forever's
golden now reflects its own rules. Run `npm test`, `npm run test:wasm`, and
`npm run test:regressions -- --dist` after a full distribution build.

Examples of changes present in this snapshot include Bloodthrill and Weaponmaster
in Arms; Boundless Rage, Raging Blows and Precision in Fury; and Master of Defense,
Vanguard, Focused Rage and Bastion in Protection. Improved Slam moves to
Arms, Iron Will to Fury, and Improved Thunder Clap to Protection. These changes
are implemented for Forever while preserving Classic combat behavior.

See [the implementation audit](IMPLEMENTATION.md) for mode-specific rules, selector
moves, runtime property mappings, engine gaps, and the accepted placeholder decisions.

See [the racial implementation notes](RACIALS.md) for the new racial bonuses,
Skyborne, and provisional values absent from the supplied racial dump.
