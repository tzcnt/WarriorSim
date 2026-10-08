# WoW Forever Warrior talent extraction

Captured on 2026-10-07. The trees and rank text come from beta client build
**1.60.1.70170**, with the server's **1-2 Oct 2026 hotfixes** applied. Later builds
through 1.60.1.70245 leave them unchanged. The download URL, retrieval timestamp and
SHA-256 are recorded in `warrior-source.json`. The snapshot preserves the downloaded
Warrior `talents` object without changing its fields.

Run `node scripts/extract-forever-talents.js` to regenerate `js/data/talents_forever.js`.
The catalog contains **52 talents: 17 Arms, 17 Fury, 18 Protection**, with all 150
rank descriptions confirmed by the source. No rank estimation is applied, and no later
patch notes are pending. The extraction script can still apply notes newer than a snapshot.
`rank-text.js` is retained only as a historical extraction helper.

The generated catalog uses the existing `n`/`m`/`d`/`x`/`y` talent structure, converting
rows and columns to zero-based coordinates. Prerequisites use `[parent index, max rank]`.
The source has no talent or rank spell IDs, so `s` stays null. `forever` holds the
stable local key, passive status, source and hotfix date, the Classic comparison, and
costs. The source's single cost line is split into `cost` and the `Requires ...` text.
`js/talent-rules.js` attaches runtime handlers and simulation support metadata.
Forever tooltips continue to use local descriptions.

Saved builds now use `forever-v3`. Keyed builds of any schema migrate by key.
Positional `forever-v1` and `forever-v2` builds use those schemas' recorded talent
order. Removed talents are refunded, as are descendants that lose their row or
prerequisite requirements. Classic positional builds still migrate by name.
Default and permanent presets use the new schema and catalog.

**1-2 Oct 2026 hotfixes (Fury/Protection rework).** Fury gains Lingering Rage (row 2),
Furious Precision (row 3, 4/7/10% off-hand hit) and Gore Drinker (row 6, after Enrage).
Improved Cleave, Boundless Rage and Precision are gone; Iron Will moves to Protection
row 1. Improved Berserker Rage moves to row 5. Flurry moves to row 6 column 2 and now
requires Death Wish; Bloodthirst no longer requires Death Wish. Booming Voice also
reduces shout rage costs by 5% per rank. Unbridled Wrath no longer gives two-handed
weapons 2 rage. Blood Craze no longer triggers from Bloodthirst. Dual Wield
Specialization keeps 5% off-hand damage and 10% off-hand rage per rank, but no
longer adds hit. Raging Blows now reduces the cost of Cleave and Whirlwind by 3.
Whirlwind always strikes with both weapons, and Bloodthirst scales with 45% AP (was 35%).
Protection loses Toughness. Improved Bloodrage moves to row 1, Anticipation and
Improved Revenge to row 2, and Improved Disarm to row 3. Improved Shield Bash moves
to row 4, and Vanguard to row 4 column 2. Focused Rage moves to row 5 column 3, and
Last Stand no longer requires Improved Bloodrage. Improved Slam reduces Slam's
cooldown by 3 seconds at either rank; the 24 Sep notes said 1.5 seconds per rank.

**1 Oct 2026 client build 1.60.1.70170.** Spearing Strike works with any melee
weapon and requires Battle Stance; it needed a two-handed weapon before. Its text no
longer says that mounted targets are dismounted.

Earlier changes are now part of the snapshot. The September 16 Hyjal capture of
build 1.60.1.69876 corrected Improved Rend to 12/23/35%, Improved Execute to 3/5 Rage,
and Improved Disarm to 7/13/20 seconds, and removed Vitality. The September 24 notes
made Bloodthrill 4/8/12/16/20% from main-hand attacks, and the October 1 notes halved
Dual Wield Specialization's off-hand rage bonus. Historical optimization results in this
directory describe their original catalogs; see [the October 2026 presets](#october-2026-presets).

## Combat rules

See [ABILITY_MECHANICS.md](ABILITY_MECHANICS.md) for
per-ability confirmed and unconfirmed info.

See [RAGE_GAIN.md](RAGE_GAIN.md) for rage-gain data and open questions.

JavaScript character/spell construction and the WASM combat engine implement the
same rules. Rank/stat/cost changes include Rend, Tactical Mastery (10 baseline +
3 per point), Flurry, Unbridled Wrath (1 rage with any weapon), off-hand damage/rage
(Dual Wield Specialization) and hit (Furious Precision, 4/7/10%), Focused Rage, Bastion,
Execute/Cleave/Whirlwind/Thunder Clap costs, Battle Shout's cost (Booming Voice, 5%
per rank), and both Bloodrage's initial gain and fractional ticks. The rage cap is 100,
or 105 for Gnomes.

- Bloodthirst: 45% AP + 30/37/43/48 at levels 40/48/54/60.
- Shield Slam: 225–235 / 264–276 / 303–317 / 421–439 at those levels, plus block value once, with no AP coefficient.
- Forever Slam has an 18-second cooldown, reduced by 3 seconds with either Improved Slam rank to 18/15/15 seconds at 0/1/2 ranks. It starts at cast completion. Without Improved Slam it pauses weapon timers during casting. Either talent rank lets them advance, deferring due swings until cast completion. Cast time and GCD are 1500/1250/1000 ms at 0/1/2 ranks. Classic has no cooldown and still resets timers at cast completion.
- Bloodthrill: landed main-hand melee damage against the player's active Rend rolls 4% per rank for one six-second Overpower opportunity, with no ICD. White swings, queued Heroic Strike/Cleave and main-hand special attacks roll; off-hand swings and Whirlwind's off-hand hit do not. It refreshes, does not stack, and is independent of the ordinary dodge window. Adjacent targets without Rend cannot trigger it.
- Weaponmaster: crit/extra-attack effects use existing weapon specialization code; mace/staff bypass 3% armor per rank for that hand, after armor debuffs. The sword proc guard resets between fights in both Classic and Forever so batching does not change results.
- Whirlwind: always strikes with both weapons. Each hand rolls independently against each target, with one rage cost/cooldown. Off-hand damage uses the actual off-hand weapon.
- Raging Blows: Cleave and Whirlwind cost 3 less rage.
- Spearing Strike: 40% normalized main-hand damage, or 120% against Giant/Dragonkin/mounted targets selected in Settings. Any melee weapon; requires Battle Stance. Like Overpower, it switches stance only when Tactical Mastery retains its cost, optionally below a configured rage. Mounted targets stay mounted, so every hit gets the bonus. Uses ordinary melee hit/crit/refund rules.
- Enrage: existing incoming damaging attacks roll a 30% chance for 2% Physical damage per rank for 12 seconds; reapplication refreshes it. Death Wish's Forever +5% incoming damage penalty applies to the existing damage/rage events.
- Windfury Totem: follows Classic's rules except for 246 AP, a 1-second buff (Classic: 1.5 seconds) and a 100 ms internal cooldown from each proc. Main-hand autoattack and melee ability hits roll 20% for an extra attack. The buff has two charges, spent only by white swings from either hand, and Windfury cannot proc while it is active. A white-swing proc spends one charge and the extra attack the other. After an ability proc, the remaining charge applies the AP to the next white swing, usually the off-hand, and any abilities before it, unless the buff expires first.
- Sweeping Strikes: 30 rage before Focused Rage, Battle Stance, 30-second cooldown, 1.5-second GCD, five copied melee hits to an adjacent target. Copies inherit the original hit's damage, generate no rage/procs, and are reported separately. The captured description supplies no duration, so the implementation retains unspent charges until consumed or combat ends.

Target armor debuffs use the highest-rank values in client build 1.60.1.70009
([wago.tools](https://wago.tools/db2/SpellEffect?build=1.60.1.70009), Classic Beta).
Sunder Armor Rank 5 (11597) removes 450 armor per stack, 2250 at five stacks.
Faerie Fire Rank 4 (9907) removes 505. Forever omits Curse of Recklessness: it
does not stack with Faerie Fire, so the option is hidden and stale profiles that
enable it are ignored. Forever also omits Expose Armor and Improved Expose Armor,
which share the Sunder Armor slot.

The Natural flasks ([Wowhead](https://www.wowhead.com/forever/item=274276/flask-of-natural-swiftness),
items 274273–274276, spells 1293740–1293743 in the same build) each grant 60 Stamina.
In Mount Hyjal, Hyjal Summit and the Barrow Deeps, each also grants a bonus. The
simulator has no zone setting, so it always applies that bonus. Swiftness gives 5%
melee haste. Its 5% casting speed does not shorten Slam, which has the Ability
attribute (0x10). Aggression gives 4% melee and spell crit, and Accuracy gives 5%
melee and spell hit. Precision's expertise aura (240) removes 5 percentage points
from the target's dodge chance. Attacks from behind cannot be parried, so parry is
unaffected. The Natural flasks share the flask slot with Flask of the Titans.

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
reactive rage, and Anticipation/Deflection do not simulate mitigation.
Revenge and Charge are absent, so Improved Revenge, Improved Charge and Vanguard
remain data-only. Current health/healing (Blood Craze, Gore Drinker, Last Stand),
threat (Defiance), out-of-combat rage decay (Lingering Rage), shout radius (Booming
Voice), and crowd-control/movement/utility effects (Iron Will) are also outside the
existing DPS model. Maximum health is calculated for
Touch of the Grave; see [the racial notes](RACIALS.md). The other defensive-model
limitations remain unchanged.
The current equipment catalog also has no shields; Shield Slam/Bastion validation
uses a synthetic shield fixture. The corresponding numeric talent handlers and descriptions are present, without
claiming those missing systems are simulated.

## Validation

`test/forever-talents.test.js` checks formulas, costs, rage caps, fractional
Bloodrage ticks, per-hand damage/hit/rage/armor bypass, Bloodthrill, Spearing Strike,
Sweeping Strikes, exact Slam cast/GCD/swing timestamps, tree positions and prerequisites,
removed talents, v1/v2 migration and local tooltips.
`test/wasm/forever-fixtures.js` adds six full-report JS/native parity fixtures with
fresh/persistent partitions. Existing Classic goldens are unchanged; Forever's
golden now reflects its own rules. Run `npm test`, `npm run test:wasm`, and
`npm run test:regressions -- --dist` after a full distribution build.

Examples of changes present in this snapshot include Bloodthrill and Weaponmaster
in Arms; Lingering Rage, Furious Precision, Raging Blows and Gore Drinker in Fury; and
Master of Defense, Vanguard, Focused Rage and Bastion in Protection. Improved Slam
moves to Arms and Improved Thunder Clap to Protection. These changes are implemented
for Forever while preserving Classic combat behavior.

## October 2026 presets

Every permanent preset spent points in removed talents, so each was rebuilt on
2026-10-07 and then tuned in the app. Gear, buffs and rotations were also revised.
The first-visit default (`session_forever.js`) is the Dual Wield Fury preset.
The DPS below is from this checkout's native engine, including the Deep Wounds change.
It uses 100,000 fights per preset with a common seed and each preset's own settings
(single-target, 50–60 s). This is a measurement, not a rerun of
`scripts/optimize-forever-talents.js`.

| Preset | Talents | Mean DPS (± 95%) |
| --- | --- | ---: |
| Dual Wield Fury (19/32/0) | Arms: IHS 3, IR 3, ITM 5, IOP 2, AM 1, DW 3, Impale 2. Fury: Cruelty 5, LR 1, UW 5, FP 3, PH 1, DWS 5, RB 1, IE 2, IBR 2, DW 1, Flurry 5, BT 1 | 911.6 ± 0.5 |
| Two-Handed Fury (20/31/0) | Arms: IHS 2, IR 3, ITM 5, IOP 2, DW 3, 2HWS 3, Impale 2. Fury: BV 5, Cruelty 5, UW 5, RB 1, Enrage 5, IE 2, IBR 1, DW 1, Flurry 5, BT 1 | 841.0 ± 0.6 |
| Two-Handed Arms (35/16/0) | Arms: Deflection 2, IR 3, ITM 5, IOP 2, AM 1, DW 3, 2HWS 3, Impale 2, Bloodthrill 5, SS 1, WM 5, ISlam 2, MS 1. Fury: BV 5, Cruelty 5, UW 5, IE 1 | 737.7 ± 0.5 |

The presets' target never attacks (target speed 0), so Enrage cannot trigger. The
earlier 17/34/0 Dual Wield build kept Enrage 5/5 and measures 885.4 ± 0.6 on the same
engine. Each Fury build needs 30 points in rows 1–6 for Bloodthirst, so some points
go to talents that are inert here. Neither two-handed rotation uses Heroic Strike,
so Deflection and Improved Heroic Strike are equivalent for the Arms preset.

See [the implementation audit](IMPLEMENTATION.md) for mode-specific rules, selector
moves, runtime property mappings, engine gaps, and the accepted placeholder decisions.

See [the racial implementation notes](RACIALS.md) for the new racial bonuses,
Skyborne, and provisional values absent from the supplied racial dump.
