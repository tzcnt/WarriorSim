# WoW Forever Warrior talent extraction

Captured from [Talents Forever's Warrior calculator](https://forevertalents.up.railway.app/warrior)
on 2026-09-13. The page describes its data as read from the BlizzCon 2026 demo;
this is a snapshot of that third-party listing, not independently verified game data.
The exact asset URL, retrieval timestamp and SHA-256 of the downloaded JavaScript
are recorded in `warrior-source.json`. That file preserves the Warrior object from
the site's `window.TALENT_DATA` without modifying its fields or descriptions.

## Files and regeneration

- `data/forever/warrior-source.json`: source snapshot and provenance.
- `data/forever/rank-text.js`: the captured site's rank estimation functions, copied verbatim.
- `js/data/talents_forever.js`: converted listing, exposed as `talentsForever`.
- `scripts/extract-forever-talents.js`: offline conversion and structural validation.

Run `node scripts/extract-forever-talents.js` from the repository root to regenerate.
The listing contains 54 talents: 17 Arms, 18 Fury, and 19 Protection.

## Mapping to the existing talent structure

| Field | Meaning |
| --- | --- |
| Tree `n`, `t` | Tree name and ordered talent array, as in `js/data/talents.js` |
| `n`, `m` | Talent name and maximum ranks |
| `x`, `y` | Zero-based column and row, converted from the source's one-based positions |
| `d` | All rank descriptions; array length equals `m`; missing source ranks are extrapolated using the site's logic |
| `iconname` | Source icon name, compatible with the existing icon URL convention |
| `c` | Selected rank, initialized to zero |
| `r` | Optional prerequisite: `[zero-based index within this tree, required ranks]`; the site requires the parent's maximum rank |
| `i`, `s` | Unknown talent ID and per-rank spell IDs, represented by `null` and an array of `null` values |
| `forever` | Extra source information and integration tracking |

`forever` preserves active/passive status, cost/range/cooldown text (`cost`),
equipment/stance requirements (`reqText`), Classic comparisons (`classic`), and
the site's estimation hints (`scaleIdx`, `fixed`) where supplied. Its `key` is
a local tree/name identifier, not a game ID. `sourceComplete` copies the site's
flag; `estimatedDescriptionRanks` explicitly lists extrapolated one-based ranks.
Classic comparison text is retained verbatim, including any embedded HTML;
it should not be treated as a verified simulator mapping.

## Rank estimates and runtime integration

All 159 rank descriptions are populated: 67 supplied descriptions and 92 estimates.
The estimates use the site's captured `rankText` and `scaleText` functions,
including its numeric token selection, fixed values, caps, and rounding. Estimated
ranks are marked in metadata. Available descriptions are copied exactly, including
multiline descriptions. The original source snapshot remains unmodified.

The simulator uses these estimated descriptions provisionally. The extraction
script overrides Weaponmaster to linear 1%/3%/1% per rank, and Improved Berserker
Rage to 5 rage / 50% removal chance per rank, per the implementation decisions.
The raw snapshot and captured estimation functions remain unchanged.

The source supplies no talent IDs or spell IDs. `talents_forever.js` remains a
data-only generated file. `js/talent-rules.js` attaches runtime `aura`/`enable`
handlers, neutral defaults for removed Classic effects, and support metadata;
it selects the catalog for the active mode. Both page bundles, simulation workers,
and reference tests load it. Forever tooltips use local descriptions rather than
invented game IDs. New actions use stable local string IDs.

Saved Forever builds use `talentSchema: 'forever-v1'` and talent keys. Legacy
positional builds are mapped by talent name, with removed/replaced points refunded,
rank limits clamped, and invalid descendants refunded. No points are guessed for
new replacement talents. The default dual-wield build is 13/38/0. Its talents were selected by a
[production talent search](DUAL_WIELD_TALENTS.md). Classic saves and talent
effects retain their existing behavior.

The permanent Night Elf preset's priorities and Hamstring settings were selected
by a subsequent [production ability search](DUAL_WIELD_ABILITIES.md), reproducible
with `npm run optimize:abilities`.

## Combat rules

JavaScript character/spell construction and the WASM combat engine implement the
same rules. Rank/stat/cost changes include Rend, Tactical Mastery (10 baseline +
3 per point), Flurry, Unbridled Wrath, off-hand damage/hit/rage, Precision, Focused
Rage, Vitality's Strength, Bastion, Execute/Cleave/Thunder Clap costs, and both
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
existing DPS model. Maximum health and Vitality's Stamina are now calculated for
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
Vanguard, Vitality, Focused Rage and Bastion in Protection. Improved Slam moves to
Arms, Iron Will to Fury, and Improved Thunder Clap to Protection. These changes
are implemented for Forever while preserving Classic combat behavior.

See [the implementation audit](IMPLEMENTATION.md) for mode-specific rules, selector
moves, runtime property mappings, engine gaps, and the accepted placeholder decisions.

See [the racial implementation notes](RACIALS.md) for the new racial bonuses,
Skyborne, and provisional values absent from the supplied racial dump.
