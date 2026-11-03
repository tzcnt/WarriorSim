# WoW Forever ability mechanics: confirmations and assumptions

This document tracks the current implementation per ability, distinguishing
confirmed game behavior from assumptions. Implementation and tests establish what
the simulator does; they do not independently establish live-server behavior.
Coverage currently includes Rend, Bloodthirst, Slam, Heroic Strike, Overpower,
Mortal Strike, Execute, Whirlwind and Reckless Swings. Last reviewed: 2026-11-03.

## Rend

### Confirmed behavior

| Attack power scaling | Each tick gains 0.02 × AP before damage modifiers, in Forever mode only. | Verified via live testing around player level 10 - exact number is slightly approximated. |
| Per-tick damage | There is no snapshotting - AP, damage mods, and crit chance are evaluated on each tick. |

**Crit chance is evaluated independently on each tick, not snapshotted when Rend
is applied.** Zirene confirmed this behavior on Discord, as reported by the user
on 2026-09-18. No message link or verbatim quotation has been recorded here.

Consequently, Elune’s Light's +10 percentage points of crit chance affects Rend
ticks while the 15-second buff is active:

- Rend applied before the buff benefits on ticks during the buff.
- Ticks after the buff expires lose the bonus, even if Rend was applied during it.
- Applying Rend just before the buff expires does not preserve the bonus.

Both the JavaScript reference engine and production WASM engine implement this
per-tick check.

### Assumptions and other implemented behavior

The Discord confirmation above covers crit-chance timing. It does not establish
the remaining mechanics below as confirmed game behavior.

| Mechanic | Current implementation | Evidence / status |
| --- | --- | --- |
| Rank 7 damage and cadence | 147 total base damage, split into seven ticks of 21 before modifiers, at 3-second intervals. First tick occurs 3 seconds after application; last tick at 21 seconds. | Current spell data and engine behavior; not independently confirmed here. |
| Crit chance inputs | Uses current player crit (including Ruthless) plus main-hand weapon/talent crit. | Implemented formula; the confirmation establishes dynamic timing, not every component of this formula. |
| Crit damage | Multiplies a critical tick by `2 + talents.abilitiescrit` (2× without Impale; 2.1× / 2.2× with one / two ranks). | Implemented; multiplier and Impale interaction not independently confirmed here. |
| Eureka! | Neither Rend's cost nor its ticks benefit; the in-game tooltip limits Eureka! to non-periodic abilities. | Tooltip text, reported by the user on 2026-10-15. |
| Application roll | Application can miss or be dodged, but cannot crit. | Implemented; not independently confirmed here. |
| Crit-triggered effects | Tick crits do not trigger Deep Wounds or other attack-crit procs. | Implemented and tested; not independently confirmed here. |
| Improved Rend | Increases damage by 12% / 23% / 35%. | Matches the captured client-build 1.60.1.69876 talent descriptions; not a separate live-server verification. |
| Refresh scheduling | Automatic rotation waits until Rend's aura timer ends before reapplying. Rank 7's configured timer is 22 seconds, despite the final tick occurring at 21 seconds. | Simulator scheduling behavior; not a claim that the game's bleed lasts 22 seconds. |

### Implementation references

- [JavaScript Rend application and ticks](../../js/classes/spell.js) (`class Rend`).
- [Production WASM application and ticks](../../wasm/src/auras.cpp) (`AuraKind::Rend`).
- [Rank damage, tick counts, and rotation duration](../../js/data/spells.js).
- [Forever talent modifiers](../../js/talent-rules.js).
- [Bleed tests](../../test/forever-bleeds.test.js), including changes to AP, damage
  modifiers, and crit chance between ticks, plus Classic snapshot preservation.

These notes describe Forever mode. Classic mode currently does not allow Rend
ticks to crit.

## Bloodthirst

### Confirmed behavior

**At level 60, Bloodthirst's flat damage bonus is 48, in addition to its 45% attack
power scaling.** The 48 flat damage bonus is confirmed in-game, as reported by the
user on 2026-09-18. The 1-2 Oct 2026 server hotfixes raise the scaling from 35% to
45% AP, and the flat bonuses are unchanged.

## Slam

### Confirmed behavior

**At level 60, Slam's flat damage bonus is 87.** This value is confirmed in-game,
as reported by the user on 2026-09-18.

**Slam's cooldown is 15 seconds, reduced by 2.5 seconds per rank of Improved Slam**
(15/12.5/10 seconds). Source: the 3 Nov 2026 patch notes. Before that, the cooldown was
18 seconds, reduced by 3 seconds at either rank by the 1-2 Oct 2026 hotfixes, and by
1.5 / 3 seconds in the 2026-09-24 notes. Improved Slam's cast time, GCD and
swing-timer effects are unchanged.

## Heroic Strike

### Confirmed behavior

**At level 60, Heroic Strike's flat damage bonus is 138.** This value is confirmed
in-game, as reported by the user on 2026-09-18.

## Overpower

### Confirmed behavior

**At level 60, Overpower's flat damage bonus is 35.** This value is confirmed
in-game, as reported by the user on 2026-09-18.

## Mortal Strike

### Confirmed behavior

**At level 60, Mortal Strike's flat damage bonus is 160.** This value is confirmed
in-game, as reported by the user on 2026-09-18.

## Execute

### Confirmed behavior

**At level 60, Execute deals 600 base damage plus 15 damage per point of excess
rage consumed.** These values are confirmed in-game, as reported by the user on
2026-09-18.

## Battle Shout

### Confirmed behavior

Stacks fully with Blessing of Might.

## Whirlwind

### Confirmed behavior

**Improved Whirlwind reduces Whirlwind's cooldown by 1/2 seconds and increases the
damage it deals to the closest enemy by 15/30%.** Source: the 3 Nov 2026 patch notes.

### Assumptions

The simulator applies the bonus to both hands' hits on the primary target as a separate
multiplier. Adjacent targets take normal damage.

## Reckless Swings

### Confirmed behavior

**Reckless Swings (Fury row 4, 1 point) costs 25% of base health and has a 15-second
cooldown. For 8 seconds, the next 4 melee attacks generate 5 additional rage.** Source:
the 3 Nov 2026 patch notes.

### Assumptions

It is off the global cooldown, works in any stance and is used on cooldown. Only landed
melee hits with damage on the primary target spend charges: white swings from either
hand, extra attacks, queued Heroic Strike/Cleave and melee specials. Misses, dodges and
adjacent-target hits do not. Each charge adds a flat 5 rage, up to the rage cap, and
unused charges expire. The health cost is not modeled.
