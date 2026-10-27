# WoW Forever racials

Sources: https://www.wowhead.com/forever/guide/new-race-class-combinations, the owner's
provisional parameters, supplied September 13, 2026, and the racial patch notes of
October 15 and October 26, 2026. Only Forever uses these replacements.

## October 26, 2026 patch notes

| Race | Change | Simulator |
| --- | --- | --- |
| Human | Ruthless: 1% increased critical strike chance (was 2%). | +1 point of autoattack, ability and spell crit with any weapon. |
| Orc | Savage (1% increased critical strike chance) removed. | No crit bonus. |
| Dwarf | Earth Fury (2% increased critical strike damage and healing) removed. Added Artisan’s Precision: 1% increased hit chance with spells and attacks. | +1 point of melee and spell hit; no critical strike damage bonus. |
| Tauren | Endurance provides only 5% increased health (no hit chance or critical damage modifiers). | No critical strike damage bonus; +5% maximum health is retained. |
| Skyborne | Wind Blessed haste bonus 2% (was 3%). | Haste multiplied by 1.02. |

## October 15, 2026 patch notes

The October 26 notes replace this table's Ruthless, Savage, Earth Fury, Endurance and
Wind Blessed values. Blood Fury's cooldown, Touch of the Grave and Eureka! still apply.

| Race | Change | Simulator |
| --- | --- | --- |
| Human | Sword Specialization replaced with Ruthless: 2% increased critical strike chance. | +2 points of autoattack, ability and spell crit with any weapon. |
| Orc | Axe Specialization replaced with Savage: 1% increased critical strike chance. Blood Fury cooldown 3 minutes (was 2). | +1 point of crit with any weapon; Blood Fury is reused every 180 seconds. |
| Dwarf | Mace Specialization replaced with Earth Fury: 2% increased critical damage and healing. | +2 points of critical strike damage bonus. |
| Tauren | Endurance: 2% increased critical damage and healing (was 1% hit chance). | +2 points of critical strike damage bonus; the hit bonus is removed. |
| Skyborne | Wind Blessed haste bonus 3% (was 1%). | Haste multiplied by 1.03. |
| Undead | Touch of the Grave: 20% chance for Warriors, 25-second internal cooldown; no longer scales with Shadow increases. | 20% chance per eligible hit, shared 25-second cooldown. |
| Gnome | Eureka!: an 8-second buff with no charges; same damage and cost effect. | Every non-periodic Warrior ability cast during the 8 seconds gets the bonus; Rend does not. |

The patch's movement, mount speed, treasure, utility-cooldown, dispel and
crowd-control changes are outside the DPS model.

## User-provided provisional parameters

These values are provisional simulation inputs supplied by the owner, not
confirmed game data.

| Ability / race | Parameter | Provisional value |
| --- | --- | --- |
| Touch of the Grave | Proc chance | 20% for Warriors (patch notes, 2026-10-15; was 5%) |
| Touch of the Grave | Damage | 5% of the player's HP |
| Touch of the Grave | Internal cooldown | 25 seconds (patch notes, 2026-10-15; was 1 second) |
| Skyborne | Base stats | Use Human base stats for now |
| Eureka! | Cost reduction | 10% (patch notes, 2026-09-24; was 40%) |
| Eureka! | Duration | 8 seconds, no charges (patch notes, 2026-10-15; was three charges) |
| Eureka! | Cooldown | 2 minutes (120 seconds) |
| Elune’s Light | Cooldown | 3 minutes (180 seconds) |

The simulator's interpretation of HP as maximum health and its other combat
assumptions are documented below.

## DPS implementation

| Race | DPS implementation |
| --- | --- |
| Human | Ruthless grants +1 percentage point of autoattack, ability and spell crit with any weapon; no racial weapon skill. |
| Dwarf | Artisan’s Precision grants +1 percentage point of melee and spell hit; +5% physical and magic damage against Beasts. |
| Night Elf | Elune’s Light grants +10 points of melee and spell crit for 15 seconds; 3-minute cooldown. |
| Gnome | Maximum rage multiplied by 1.05; for 8 seconds, Eureka! makes non-periodic Warrior abilities cost 10% less rage and deal 10% more damage; 2-minute cooldown. |
| Orc | Blood Fury multiplies total AP and spell-power contributions by 1.10 for 15 seconds, with no GCD or rage cost and a 3-minute cooldown. No racial weapon skill or crit. |
| Undead | Touch of the Grave: 20% chance per landed damaging main-hand, off-hand, or special ability hit to deal 5% of maximum HP as magic damage, with a shared 25-second internal cooldown and a separate damage report. |
| Tauren | Endurance: +5% maximum health. No Tauren damage scales with health. |
| Troll | Berserking is fixed at +10% haste for 10 seconds regardless of old saved haste settings, with no GCD or rage cost; +5% physical and magic damage against Beasts. |
| Skyborne | One race for both factions: +2% haste and +5% physical and magic damage against Elementals. Uses Human base stats, without Human racials. |

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
spell-power coefficient. Each landed damaging hit rolls 20%. Main-hand, off-hand, and
special ability hits share a 25-second internal cooldown, which starts when a roll
succeeds, so simultaneous hits cannot both proc. Armor does not reduce the proc damage.
It uses the existing spell miss, crit, damage multiplier and resistance model; those
details remain provisional. The simulator has no Shadow-specific damage modifiers,
so the patch's removal of Shadow scaling changes nothing here; general spell damage
modifiers such as Sayge's Dark Fortune of Damage still apply. It cannot trigger
itself or generate rage.

## Other retained assumptions

Ruthless adds to the base crit chance, so it applies with any weapon to autoattacks,
abilities, Forever Rend ticks, physical item procs and spells. It does not improve
weapon skill.

Artisan’s Precision follows the rule used for Endurance's former +1% hit. One point
of melee hit lowers the miss chance of abilities and of each autoattack hand,
including dual-wield. The target's spell miss chance falls by one point, no lower
than Classic's 1% minimum, which also lowers binary resists. It does not improve
weapon skill. No race modifies the critical strike damage bonus.

- Elune’s Light, Eureka!, Blood Fury and Berserking have no rage cost or GCD (Blood
  Fury and Berserking per the owner, September 28, 2026). Their first use can be
  scheduled in Rotation; they can be reused in long fights. They do not wait for the
  GCD and are used as soon as they are ready, after the usual reaction delay.
- Eureka! lasts 8 seconds and has no charges. While it is active, every non-periodic
  Warrior ability costs 10% less rage, after talent reductions, and deals 10% more
  damage. The in-game tooltip limits it to non-periodic abilities, so Rend pays its
  full cost and its ticks get no bonus. Fractional rage costs are retained. Execute's
  excess-rage conversion is unchanged. The bonus is checked when an ability is cast.
  Queued Heroic Strike and Cleave check it, and pay their cost, at the actual swing, so
  a strike queued just before it ends swings at full cost and damage. Multiple targets
  and Whirlwind's off-hand share the cast's bonus. Sweeping Strikes copies resulting
  hit damage without applying a second multiplier. Autoattacks, stance changes,
  consumables and item procs are unaffected. The buff ends exactly 8 seconds after
  use, so its discount never covers an ability chosen after it ends.
- Blood Fury has a 3-minute cooldown (patch notes, 2026-10-15; Classic keeps 2
  minutes). The dump gives no replacement cooldown for Berserking, so it uses
  Classic's 3 minutes. Both are reused in long fights.
- Every scheduled cooldown is reused as soon as it is ready after its first use. A
  schedule N seconds before the end counts back whole cooldowns, plus 2 seconds each
  for GCD and reaction delays, to the first use; the final use waits for that time.
  Once due, scheduled cooldowns are the highest priority. They replace a GCD ability
  chosen but not yet cast, and while a due Death Wish waits for rage, no other GCD
  ability is used and Heroic Strike, Cleave and Classic Sweeping Strikes may only
  spend rage above its cost.

Current health, incoming health loss, temporary health abilities such as Last
Stand, healing, mana, Spirit regeneration, avoidance, mitigation, crowd control,
movement, professions and utility remain outside the existing DPS model. This
includes the healing portion of Touch of the Grave and the listed utility racials.

Both JS and WASM implement these rules. Racial availability is enforced during
character construction as well as in Rotation, including saved and worker inputs.
Saved rotation descriptions cannot override tooltips for the current provisional
parameters.

## Validation

`test/forever-racials.test.js` covers passives, autoattack, ability and spell crit
with every weapon type, Artisan’s Precision's melee and spell hit, unmodified crit
damage at each kind of critical hit for every race, Endurance's removed hit bonus,
Skyborne at several levels, racial availability, AP/haste/crit expiry, Eureka!'s
8-second window and exact expiry in combat, queued strikes, refunds, rage caps, exact
cooldowns including Blood Fury's 3 minutes, HP from gear/buffs, HP overrides, the 20%
proc boundary, the shared 25-second proc cooldown, ability hit eligibility and
rotation tooltips. Seventeen racial fixtures in
`test/wasm/racial-fixtures.js` compare full JS/WASM reports and fresh/persistent
partitions, including health overrides, long fights, multiple targets, Rend and
queued Cleave.
