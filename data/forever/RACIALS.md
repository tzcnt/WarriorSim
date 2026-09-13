# WoW Forever racials

Sources: https://www.wowhead.com/forever/guide/new-race-class-combinations and the owner's
provisional parameters, supplied September 13, 2026. Only Forever uses these
replacements.

## User-provided provisional parameters

These values are provisional simulation inputs supplied by the owner, not
confirmed game data.

| Ability / race | Parameter | Provisional value |
| --- | --- | --- |
| Touch of the Grave | Proc chance | 5% |
| Touch of the Grave | Damage | 5% of the player's HP |
| Touch of the Grave | Internal cooldown | None (assumed) |
| Skyborne | Base stats | Use Human base stats for now |
| Eureka! | Cost reduction | 40% |
| Eureka! | Cooldown | 2 minutes (120 seconds) |
| Elune’s Light | Cooldown | 3 minutes (180 seconds) |

The simulator's interpretation of HP as maximum health and its other combat
assumptions are documented below.

## DPS implementation

| Race | DPS implementation |
| --- | --- |
| Human | Swords grant +2 percentage points of autoattack, ability and spell crit; no racial weapon skill. |
| Dwarf | Maces grant +1 point of autoattack, ability and spell crit; +5% physical and magic damage against Beasts. |
| Night Elf | Elune’s Light grants +10 points of melee and spell crit for 15 seconds; 3-minute cooldown. |
| Gnome | Maximum rage multiplied by 1.05 after Boundless Rage; Eureka! makes the next three Warrior abilities cost 40% less rage and deal 10% more damage; 2-minute cooldown. |
| Orc | Axes grant +1 point of autoattack, ability and spell crit; Blood Fury multiplies total AP and spell-power contributions by 1.10 for 15 seconds. No racial weapon skill. |
| Undead | Touch of the Grave: 5% chance per landed damaging melee hit to deal 5% of maximum HP as magic damage, with no internal cooldown and a separate damage report. |
| Tauren | +1 point of hit for autoattacks, abilities and spells, retaining the spell miss floor; +5% maximum health. |
| Troll | Berserking is fixed at +10% haste for 10 seconds regardless of old saved haste settings; +5% physical and magic damage against Beasts. |
| Skyborne | One race for both factions: +1% haste and +5% physical and magic damage against Elementals. Uses Human base stats, without Human racials. |

## Health for Touch of the Grave

The simulator interprets "player HP" as maximum health. It calculates a fixed
maximum health for each build, including gear comparisons. The default uses
existing racial Stamina by level, gear, set bonuses, all-stat enchants, selected
buffs, Vitality's Stamina, and Endurance's health multiplier. Stamina rounds down
only after its multipliers; maximum health rounds to the nearest integer.

The provisional baseline is Classic Warrior base health by level from CMaNGOS's
[`player_classlevelstats`](https://github.com/cmangos/mangos-classic/blob/master/sql/base/mangos.sql),
captured September 13, 2026 in `js/data/levelstats.js`. Stamina contributes one HP
per point for the first 20 points, then ten HP per additional point, following
[CMaNGOS's health calculation](https://github.com/cmangos/mangos-classic/blob/master/src/game/Entities/StatSystem.cpp).
This is a Classic baseline until Forever-specific health data is available.

Existing all-stat buffs now include Stamina: Mark of the Wild (including its
improvement), Songflower, Kings and Zandalar; Mol'dar's Moxie also applies.
[Warchief's Blessing](https://classicdb.ch/?spell=16609) supplies 300 flat HP and
[Flask of the Titans](https://classicdb.ch/?item=13510) supplies 1,200.

Settings includes **Max Health (override)**. Leave it blank to calculate health;
the placeholder displays that calculated value. Enter fully buffed in-game HP to
replace the calculation. The override persists in profiles and is sent to local
and shared simulation workers. It stays fixed while comparing gear; leave it blank
to include Stamina's contribution to item DPS. Effects absent from the existing
catalog can be accounted for with the override.

Touch of the Grave calculates 5% of that health at each proc, without an additional
spell-power coefficient. Main-hand and off-hand hits at the same timestamp can
both proc. It uses the existing spell miss, crit, damage multiplier and resistance
model; those details remain provisional. It cannot trigger itself or generate rage.

## Other retained assumptions

Per the owner's clarification, “critical strike with spells and abilities” also
includes autoattacks. Weapon specialization applies to autoattacks and specials
using the qualifying hand, including queued Heroic Strike/Cleave and each
Whirlwind hand. It does not improve weapon skill. Equipping a qualifying weapon
also grants spell crit; dual wielding does not stack it. The dump does not specify
mixed-weapon behavior. Racial hit bonuses likewise apply to main-hand and
off-hand autoattacks as well as abilities and spells.

- Elune’s Light and Eureka! have no rage cost or GCD. Their first use can be
  scheduled in Rotation; they can be reused in long fights.
- Eureka!'s 40% reduction applies after talent reductions. Fractional rage costs
  are retained. Execute's excess-rage conversion is unchanged. Charges have no
  time limit. Each cast consumes one charge, including misses, dodges and
  non-damaging Warrior abilities. Auto-attacks, stance changes, consumables,
  item procs and racial activation do not consume charges. Queued strikes consume
  at the actual swing; multiple targets and Whirlwind's off-hand share the cast's
  damage bonus and charge. Rend snapshots the bonus for its ticks. Sweeping
  Strikes copies resulting hit damage without applying a second multiplier.
- Blood Fury retains the existing 1.5-second GCD and single scheduled use per fight.
  Berserking retains the existing 5-rage cost and single scheduled use per fight.
  The dump gives no replacement costs, GCDs or cooldowns for either ability.

Current health, incoming health loss, temporary health abilities such as Last
Stand, healing, mana, Spirit regeneration, avoidance, mitigation, crowd control,
movement, professions and utility remain outside the existing DPS model. This
includes the healing portion of Touch of the Grave and the listed utility racials.

Both JS and WASM implement these rules. Racial availability is enforced during
character construction as well as in Rotation, including saved and worker inputs.
Saved rotation descriptions cannot override tooltips for the current provisional
parameters.

## Validation

`test/forever-racials.test.js` covers passives, per-hand autoattack and ability crit,
autoattack hit bonuses, Skyborne
at several levels, racial availability, AP/haste/crit expiry, charge consumption,
refunds, rage caps, exact cooldowns, HP from gear/buffs, HP overrides, the 5% proc
boundary, simultaneous procs and rotation tooltips. Thirteen racial fixtures in
`test/wasm/racial-fixtures.js` compare full JS/WASM reports and fresh/persistent
partitions, including health overrides, long fights, multiple targets, Rend and
queued Cleave.
