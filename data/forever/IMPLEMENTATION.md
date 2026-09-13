# WoW Forever implementation decisions

**Accepted implementation assumptions (user decisions, 2026-09-13)**

Treat the estimated descriptions as the implementation specification, subject to
later correction, with these explicit overrides:

- Weaponmaster scales linearly per point: 1% axe/polearm crit, 3% mace/staff armor bypass, and 1% sword extra-attack chance; 5/5 gives 5%/15%/5%.
- Forever retains 10 rage on stance changes baseline, plus 3 per point in Improved Tactical Mastery, for 25 at 5/5. Classic retains its talent-only allowance.
- Improved Berserker Rage grants 5 rage and 50% movement-impairment removal chance per point; 2/2 gives 10 rage and 100%.
- Untalented Forever Slam pauses weapon swing timers during the cast and resumes them afterward. With either rank of Improved Slam, timers advance during casting but swings cannot fire until the cast ends; a swing that becomes due fires immediately afterward. Classic continues to reset swing timers at cast completion. Improved Slam also reduces cast time and GCD by 250 ms per point. Subsequent user confirmation establishes a 15-second cooldown for Forever Slam at every talent rank; Classic has no cooldown.
- Forever Bloodthirst deals 35% AP plus 30/40/50/60 at levels 40/48/54/60 respectively.
- Forever Shield Slam retains the existing bases at levels 40/48/54 (225–235, 264–276, 303–317), and uses 421–439 at level 60. All ranks add block value once and no AP coefficient.
- Keep the existing defensive simulation model. Missing avoidance, block, Revenge, Charge, health/healing, threat and crowd-control simulation are pre-existing defects, not requirements to expand this DPS simulator. Enrage can use existing incoming-damage events.
- Bloodthrill uses landed melee attacks from either hand, including specials, against the player's Rended target. No ICD; refresh one six-second opportunity and consume on Overpower use.
- Weaponmaster's armor bypass applies per qualifying hand after armor debuffs. Off-hand rage scaling includes swing-derived dodge compensation but excludes flat proc rage. Unbridled Wrath keeps autos/Heroic Strike/Cleave as its eligible attacks.
- Spearing Strike uses normalized main-hand damage and ordinary melee hit/crit/refund rules. Bloodrage retains fractional rage.

Keep the captured source snapshot unchanged. Put these overrides in the conversion
or runtime layer as appropriate, and make the displayed descriptions agree with
the implemented values. Unknown external IDs do not block local implementation.

The main implementation boundary should be mode-specific talent resolution and
spell construction. Resolve numbers and explicit behavior flags once, then use
them in shared combat code. An individual `mode == "forever"` branch is needed
only where behavior cannot be expressed by existing resolved properties.
JavaScript constructs characters, but production simulations execute in WASM;
changes to JavaScript damage/event methods alone will not change production results.

## Implemented mechanics and retained limitations

See [README.md](README.md#combat-rules) for the implemented combat rules and
[the retained model defects](README.md#pre-existing-model-defects-retained-intentionally).
The visual selector uses the generated Forever tree, stable talent keys and
local descriptions. Classic continues to use its own tree and saved builds.

Forever uses explicit talent properties and action state: Bloodthrill has its
own Overpower timer; Enrage listens to incoming damage; Bastion modifies damage
with a shield; Bloodrage scales its initial gain and ticks; and Slam resolves its
cast time, GCD, cooldown and swing behavior when constructed. Weaponmaster's
percentage bypass applies per hand after armor debuffs. Raging Blows enables
Whirlwind's off-hand attack, and Boundless Rage sets the cap for every supported
rage source. None depends on retired player switches or item effects.

The combat tests cover these rules in JavaScript and WASM. Baseline hit,
glancing and rage formulas remain those of Classic except for the explicit
Forever talent modifiers. Sweeping Strikes shares the damage-copy implementation
in both modes, with the mode-specific activation and expiry rules documented in
README.md. Sword-proc timestamps reset for every fight in both modes.
