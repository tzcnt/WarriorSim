**WoW Forever talent implementation audit — commit `7051ca4`**

This is the original implementation audit against the 54 talents captured in
[warrior-source.json](warrior-source.json), compared with the actual Classic
catalog and both simulator engines at that commit. The audit's descriptions of
missing implementations below are historical; see [README.md](README.md) for the
current implementation and retained limitations.
On 2026-09-13, the Warrior object in the
[live source asset](https://forevertalents.up.railway.app/talents.js?v=971f06ba)
still matched the committed object exactly. The whole asset's hash had changed.
The listing remains third-party demo information; see the [provenance notes](README.md).

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

**1. Same-name and renamed talents: required differences**

Here `r` means selected talent rank. Estimated ranks are accepted provisionally
for implementation, with the explicit overrides above. “Existing” describes
the repository implementation, which sometimes differs from its Classic tooltip.

| Talent | Classic / existing behavior | Forever resolution and implementation |
| --- | --- | --- |
| Improved Rend | Descriptions 15/25/35%; handler `rendmod = 5 + 10r` even at rank zero. | Resolve `rendmod = 12r` (12/24/36%). Existing Rend multiplier works. Give Forever rank zero a neutral value; a Classic rank-zero correction is a separate regression decision. |
| Tactical Mastery → Improved Tactical Mastery | Total retained rage `5r`. | Resolve `rageretained = 10 + 3r`, per the accepted assumption. Stance eligibility and switching already consume the resolved total. |
| Two-Handed Weapon Specialization | Five ranks, `twomod = .01r`. | Same per-rank modifier, maximum three ranks. A catalog/rank-limit change, without a different damage formula. |
| Improved Slam | Five ranks; `1500 - 100r` ms cast, 1500 ms GCD, resets weapon timers after casting. | Two ranks; `1500 - 250r` ms cast **and GCD**. Untalented Forever Slam pauses swing timers; with either rank they advance, with any due swing deferred until cast completion. At 2/2 this is a 1-second cast and GCD. Update cast construction, the hardcoded GCD in both event loops, timer reset, and swing scheduling during the cast. |
| Unbridled Wrath | `8r`% proc chance; 1 rage, currently on successful autos/queued strikes. | `12r`% chance; 2 rage with a two-handed weapon, otherwise 1. Keep proc rage distinct from damage-generated rage and verify eligible attacks rather than broadening the trigger from tooltip wording alone. |
| Improved Cleave | `cleavebonus = 40r`%, increasing only the bonus damage. | Reduce Cleave cost by `r`; remove the talent's damage increase. Combine with Raging Blows' 2-rage reduction and Focused Rage. Use a separate resolved Cleave cost reduction, not `cleavebonus`. |
| Dual Wield Specialization | `offmod = .05r`, applied to off-hand damage. | Retain damage scaling; add `.20r` off-hand rage-generation bonus and `2r` percentage points of off-hand hit. Apply hit to the relevant off-hand white and special tables, including queued-Heroic-Strike behavior, without changing main-hand hit. Determine whether the rage bonus includes dodge compensation or flat procs. |
| Enrage | Talent property is `5r`% melee damage after receiving a crit, 12 seconds / up to 12 swings; no active implementation in the current supported modes. | New incoming-damage trigger: fixed 30% proc chance, `2r`% Physical damage, 12 seconds, no stated swing charges. Implement aura lifecycle, refresh, reset and an incoming attack hook. Do not activate it from outgoing crits, Bloodthirst hits, or Bloodrage merely because old hooks exist. |
| Improved Execute | Cost reductions 2/5. | Resolve `executecost = 3r` (3/6); existing Execute constructor consumes it. |
| Flurry | 10/15/20/25/30% haste at ranks 1–5. | Resolve `flurry = 5r` (5/10/15/20/25%); retain the existing three-swing aura. |
| Bloodthirst | Damage `.45 * AP`. | Resolve `.35 * AP + bonus`, with bonus 30/40/50/60 at levels 40/48/54/60. Same listed 30-rage cost / 6-second cooldown. Replace the healing rider with a 10% movement-speed buff for 10 seconds; Blood Craze gains a separate Bloodthirst-damage trigger. |
| Shield Specialization | Same block chance and `20r`% chance for **1** rage on block in the catalog; incoming blocks are not simulated. | Same chance, **5** rage per proc. Needs incoming block events. Keep block chance separate from `stats.block`, which currently means block value for Shield Slam. |
| Anticipation | `defense = 2r`. | Resolve `defense = 4r`. The builder already adds Defense to base stats, but defensive outcomes must be modeled for it to affect incoming attacks. |
| Improved Bloodrage | +2/+5 to the initial 10 rage; periodic ticks remain 1. | Multiply **all** Bloodrage rage by `1 + .25r`: initial 12.5/15 and ten ticks of 1.25/1.5 before any verified game rounding. Update `Bloodrage` and `BloodrageAura`, including WASM ticks; do not just change `bloodragebonus`. |
| Improved Thunder Clap | Cost reduction 1/2/4 at ranks 1–3. | Resolve `impthunderclap = 2r` (2/4/6). This talent does not grant extra damage or permission to cast in other stances. |
| Improved Berserker Rage | +5/+10 initial rage. | Resolve `berserkerbonus = 5r` and `50r`% movement-impairment removal chance, per the accepted override. Correct the generated rank-2 description to 10 rage / 100%. |
| Booming Voice | Shout radius **and duration**. | Radius only. No current radius/duration talent behavior is implemented, so this is a tooltip/data change until shout scheduling/range is modeled. |
| Iron Will | Stun/charm resistance chance. | Stun/**fear duration reduction**, `3r`%. Use distinct duration-reduction properties if crowd control is modeled; the existing `stunresist` meaning is unsuitable. |
| Blood Craze | Healing after receiving a crit. | Also triggers from dealing Bloodthirst damage or taking more than 20% maximum health in one attack. Requires health/healing state for an effect; no direct stationary DPS bonus. |
| Death Wish | Same outgoing +20% Physical damage, 30 seconds; tooltip penalty is reduced armor/resistances. | Incoming penalty becomes +5% damage taken. Outgoing DPS aura can be reused; incoming damage/rage needs the new penalty if that subsystem models it. |
| Improved Revenge | Chance to stun. | `20r`% Revenge damage. Revenge itself is absent from the current spell implementation; this needs the base action and its reactive availability before the multiplier matters. |
| Defiance | Five ranks, `3r`% threat in Defensive Stance. | Three ranks, `5r`% additional threat, now requires a shield. No current threat model. |
| Improved Disarm | +1 second duration per rank. | -7 seconds cooldown per rank. No current Disarm action. |
| Improved Shield Wall | +3/+5 seconds duration. | -5.5 minutes cooldown per rank (second rank estimated). No current Shield Wall action; baseline cooldown/ranks also need verification. |
| Shield Slam | Runtime damage is rank-dependent base damage + **2 × block value + floor(.15 × AP)** in both modes. Level-60 base in `spells.js` is 342–358. | Captured damage is **421–439 + block value**, with no stated AP coefficient; keep listed 20-rage cost / 6-second cooldown. Change both damage methods and resolve rank data. Do not derive a supposed Classic formula from the scraped comparison text, which contains SoD overrides, or overwrite Classic behavior as part of Forever integration. |

The following talents need no new mode-dependent combat rule based on this
snapshot: Improved Heroic Strike, Deflection, Improved Charge, Improved Overpower,
Anger Management, Deep Wounds, Impale, Sweeping Strikes, Improved Hamstring,
Cruelty, Piercing Howl, Improved Intercept, Toughness, Last Stand, Improved Sunder
Armor, Concussion Blow and Improved Shield Bash. Several remain unmodeled utility
talents; equal descriptions do not mean full simulation support.

In particular:

- Anger Management already grants 1 rage every 3 seconds in combat. The new wording does not require a new proc.
- Both catalogs specify Deep Wounds at 20/40/60% over 12 seconds. Retain `OldDeepWounds` absent evidence for different refresh, snapshot or stacking rules; wording alone does not establish rolling damage.
- Impale's existing crit-bonus code has no stance gate, so the wording change needs no additional branch. Its prerequisite changes below.
- Sweeping Strikes has a talent property but no action/aura/cleave-copy implementation. Implementing it would fill an existing shared feature gap, not introduce a Forever-only mechanic.
- Improved Charge has a property but no Charge action. Vanguard therefore cannot become functional merely by relaxing an existing stance check.

**2. Settings selector: exact structural changes**

Positions below are one-based row/column; the generated data uses zero-based `y/x`.
The current generic renderer already builds the required 7 × 4 grid.

| Tree | Change |
| --- | --- |
| Arms | Rename Tactical Mastery at **R2C2** to Improved Tactical Mastery, still 5 ranks. |
| Arms | Move Improved Overpower **R3C1 → R2C4**, taking the former Thunder Clap slot. Move Thunder Clap to Protection. |
| Arms | Add **Spearing Strike, R4C1, 1 rank**. |
| Arms | Reduce Two-Handed Weapon Specialization at **R4C2 from 5 to 3 ranks**. |
| Arms | Remove the **Deep Wounds → Impale prerequisite**; the captured Impale has none. |
| Arms | Replace Axe Specialization at **R5C1** with **Bloodthrill, 5 ranks**. |
| Arms | Put **Weaponmaster, 5 ranks, R5C3**, in the old Mace Specialization slot. It consolidates axe/polearm crit and sword extra attacks and changes mace behavior to armor bypass, adding staves. Remove the separate Sword Specialization at **R5C4**. |
| Arms | Move Improved Slam from **Fury R5C1 → Arms R6C1**, replacing Polearm Specialization, and reduce it **5 → 2 ranks**. |
| Fury | Move Iron Will from **Protection R2C4 → Fury R2C2**, replacing Improved Demoralizing Shout. |
| Fury | Replace Improved Battle Shout at **R3C4** with **Boundless Rage, 3 ranks**. |
| Fury | Move Improved Execute **R4C2 → R4C4**; place **Raging Blows, 1 rank**, at **R4C2**. |
| Fury | Replace the moved Improved Slam at **R5C1** with **Precision, 3 ranks**. |
| Protection | Put Improved Thunder Clap at **R2C4**, vacated by Iron Will. |
| Protection | Replace Improved Shield Block at **R3C2** with **Master of Defense, 2 ranks**. Retain its prerequisite of 5/5 Shield Specialization. |
| Protection | Reduce Defiance at **R3C4 from 5 to 3 ranks**. |
| Protection | Replace Improved Taunt at **R4C3** with **Vanguard, 1 rank**. |
| Protection | Add **Vitality, 5 ranks, R5C4** and **Focused Rage, 3 ranks, R6C1**. |
| Protection | Replace One-Handed Weapon Specialization at **R6C3** with **Bastion, 5 ranks**. |

Everything else keeps its captured position. Tree sizes become **17 Arms / 18 Fury /
19 Protection**, versus **18 / 17 / 17**. Rebuild prerequisite indices from the new
tree arrays: Anger Management still requires full Improved Tactical Mastery; Deep
Wounds full Improved Rend; Mortal Strike Sweeping Strikes; Flurry full Enrage;
Bloodthirst Death Wish; Last Stand full Improved Bloodrage; Shield Slam Concussion Blow.

Integration work around the grid is as important as the moves:

- Load a runnable Forever catalog in the page bundle, simulation worker and reference loader. Currently [compute-build.js](../../scripts/compute-build.js), [sim-worker.js](../../js/sim-worker.js) and [reference-engine.js](../../test/wasm/reference-engine.js) all load Classic talents for Forever. Select the catalog before `updateGlobals` and `new Player`.
- Keep generated `talentsForever` as source data and attach runtime handlers through a separate adapter keyed by `forever.key`, so regeneration cannot delete implementations. Every talent needs a safe `aura(rank)` result because `Player.addTalents()` calls it even at rank zero. Initialize removed Classic effect keys such as `onemod`, `axecrit`, `polearmcrit`, `cleavebonus`, and `impbattleshout` to neutral values where consumers expect numbers; otherwise missing keys produce NaN.
- Render local rank descriptions, costs and requirements for Forever. All talent/spell IDs are null; existing Wowhead links produce `spell=null` and would show wrong text even if matched Classic IDs were substituted. Stable local keys are enough for the selector; do not invent game IDs.
- Add active-talent rotation gating (`enable` / stable action mapping), including Spearing Strike. A visible talent icon alone does not construct or enable its action.
- Enforce prerequisites and points in **lower rows** for both adding and removing points. Existing clicks check total points in the tree and ignore `r`; removal checks row totals but also ignores `r`.
- Version/migrate saved talent selections, default `session_forever`, imported/shared profiles and worker deltas. They store ranks by array index. Applying the old arrays to these new trees assigns points to unrelated talents and can access out-of-range entries. Map moved/renamed talents by identity, clamp smaller rank limits and revalidate; explicitly reset/refund replacements and invalid dependents. Do not guess a Weaponmaster rank by summing four former specializations.

**3. Retained flags: what actually maps**

None of the twelve listed names is an unchanged, ready-to-enable Forever talent
switch. Some retain useful plumbing. Others have only references left: the current
tree has no `FreshMeat`, `WreckingCrew` or `SuddenDeath` JavaScript class/native aura
kind, and `gladdmg`, `gladbloodrage`, `switchbonus` have no current implementation.
Their earlier definitions were inspected in `35191ae^` to establish their meanings.

| Retained name | Existing/historical meaning | Forever disposition |
| --- | --- | --- |
| `bloodsurge` | 30% proc from Whirlwind/Bloodthirst/Heroic Strike granting free instant Slam; also makes the rotation wait for free Slam and can add an off-hand hit. | **No match.** Improved Slam grants neither a free cast nor a proc. |
| `devastate` | Converts Sunder Armor into a damaging, crit-capable attack with a shield/Defensive setup. | **No match.** Improved Sunder Armor is only a cost reduction; the snapshot does not grant Devastate. |
| `tasteforblood` | Rend ticks activate Overpower for 9 seconds with a 6-second internal cooldown. | **Adapt the activation plumbing for Bloodthrill.** Roll `2r`% on eligible melee attacks against a target with the player's Rend; grant one Overpower opportunity lasting 6 seconds. No stated internal cooldown. Remove the old tick trigger for Forever and distinguish proc expiry from the ordinary 5-second dodge opportunity so one cannot shorten/overwrite the other incorrectly. Prefer a `bloodthrill` property. |
| `freshmeat` | Outgoing core-ability hits proc a 12-second +10% Physical damage aura, guaranteed on first use then 10%. | **Reuse the historical aura shape for Enrage**, with `2r`% damage and 30% chance on incoming damaging attacks. Its old trigger is wrong. Not a Blood Craze mapping: Blood Craze heals. Prefer `enrage` as the action/key. |
| `suddendeath` | 10% proc enabling Execute outside execute phase and retaining 10 rage afterward. | **No match.** Improved Execute changes cost; Boundless Rage changes capacity. |
| `wreckingcrew` | Outgoing crits trigger a 12-second bonus to `mainspelldmg`, covering core abilities rather than all Physical damage. | **No direct match.** Wrong trigger and coverage for Enrage; Fresh Meat's general damage-aura shape is closer. |
| `bloodfrenzy` | Current branches enhance Rend damage with base damage/AP and allow Rend in Berserker Stance; the historical rune description additionally discussed bleed-generated rage. | **No match.** Neither Improved Rend nor Bloodthrill grants those effects. The reused icon is not evidence of shared mechanics. |
| `furiousthunder` | Double Thunder Clap damage and relax its stance restriction. | **No match.** Improved Thunder Clap changes only rage cost in this snapshot. |
| `precisetiming` | Instant Slam with a 6-second cooldown. | **Related code location, incompatible behavior.** Improved Slam needs reduced cast/GCD and preserved swing time. Forever's subsequently confirmed cooldown is 15 seconds. Use explicit cast/GCD/cooldown/preserve-swing properties instead. |
| `gladdmg` | Shield damage modifier historically gated by Gladiator Stance. | **Adapt for Bastion** as `2r`% damage whenever a shield is equipped, in any stance. Remove the Gladiator dependency and cover both physical and spell damage, including applicable proc paths. Prefer a shield-damage property or the existing `dmgshield` pattern. |
| `gladbloodrage` | Historically reduced Bloodrage cooldown by 30 seconds in Gladiator Stance. | **No behavioral match.** Improved Bloodrage increases rage amounts, not cooldown. A new multiplier is clearer than repurposing this boolean. |
| `switchbonus` | Historically constructed Battle/Berserker/Defensive Forecast buffs on stance changes. | **No match.** Improved Tactical Mastery uses retained rage; Vanguard changes Charge eligibility. Neither grants a stance-switch buff. |

Useful reuse outside the requested list:

- **Focused Rage → `ragecostbonus = r`.** Existing offensive constructors already subtract this field, including Rend. Set it before constructing actions, combine ability-specific reductions, and clamp total costs at zero where reductions can exceed cost. Preserve the distinction between offensive abilities and utility/self buffs.
- **Weaponmaster → `axecrit`, `polearmcrit`, `swordproc`.** Preserve the extra-attack implementation and anti-self-proc guard where verified. Mace/staff percentage armor bypass still needs new semantics.
- **Raging Blows → `offhandhit` / `castoh`.** Use this path for Whirlwind, but repair `Whirlwind.dmg(weapon)`: it currently ignores the supplied off-hand and uses the main-hand weapon. WASM has the same problem. Set the flag for each target, respect off-hand damage/hit/procs, and charge rage/cooldown only once. Do not reuse the old singular “Raging Blow” ability or enable `consumedrage` just to reach this hook.
- **Vitality → `base.strmod`.** Add the strength multiplier before stats resolve. Stamina is not represented in the current player's base stats, so its defensive half requires additional state.
- **Precision → hit stats**, with a separate spell-hit application where attacks use the magic miss table. Existing `stats.hit` only supplies weapon hit; the tooltip says all abilities and attacks.
- **Boundless Rage → `ragecap`** is partially supported by native attack-rage code, but neither the JS builder nor all other native rage sources use it yet.

The native engine also retains `turtleMode` branches for off-hand hit, two-handed
Unbridled Wrath, Slam and Bloodthirst, plus `macearp`/weapon armor-penetration
properties. `readPlayer` always sets `turtleMode = false`. Do **not** turn it on for
Forever: it changes unrelated hit, glancing and rage formulas, makes Bloodthirst
`.35 AP + 200`, and changes Slam damage. Extract only the verified behavior into
explicit properties. The existing armor-penetration path subtracts flat armor; it
does not implement Weaponmaster's percentage bypass.

**4. New talents and new simulator capabilities**

There are **11 new talent entries** relative to the Classic catalog. Their required
work spans parameter reuse and genuinely new state/events:

| New entry | Minimum functional implementation |
| --- | --- |
| Spearing Strike | New melee action, 15 rage, 20-second cooldown, 40% weapon damage plus an additional 80% against Giants, Dragonkin or mounted targets. Add target creature type and, if supported, mounted state/dismount. Qualifying damage is 120% total. Verify normalization, hit/refund/proc rules and ranks; use normal rotation/action reporting and native kind registration. |
| Bloodthrill | Target-aware Rend condition, melee-hit proc chance, one-use 6-second reactive Overpower window. Existing Rend state describes the primary target; do not grant procs from un-Rended adjacent targets. Confirm eligible attacks and refresh/consumption behavior. |
| Weaponmaster | Consolidate weapon specialization stats/procs; add percentage armor bypass for mace/staff attacks. Use the accepted 1%/3%/1% per-rank scaling. Define per-hand scope with mixed weapons and ordering relative to armor debuffs/other penetration. Avoid reducing the shared target's armor for every attack just because one hand holds a mace. |
| Boundless Rage | `ragecap = 100 + 10r`. Replace hardcoded caps/near-cap branches across attack rage, refunds, Bloodrage, Berserker Rage, potions, Anger Management, incoming damage, encounter rage buffs, reset/initial rage and supported item effects in JS and WASM. Audit rotation thresholds and reporting at 110/120/130; retain absolute user thresholds unless deliberately specified as relative to capacity. |
| Raging Blows | Whirlwind off-hand strikes plus -2 Cleave rage; mostly existing attack plumbing after correcting weapon selection and target handling. |
| Precision | +1 percentage point per rank to hit with all applicable attacks/abilities. Existing weapon stats help; magical hit paths need explicit handling. |
| Master of Defense | With a shield, 50/100% chance for 5 rage on dodge or parry. Needs incoming avoidance outcomes, separate from the target dodging the warrior's outgoing attacks. |
| Vanguard | Charge usable in Defensive Stance. Needs a Charge action/prepull model; does not itself say Charge is usable in combat. |
| Vitality | +2% Strength and Stamina per rank. Strength uses existing stat multipliers; Stamina/health needs new modeling to affect results. |
| Focused Rage | -1 offensive-ability rage cost per rank; direct use of the existing cost-reduction field with proper construction order. |
| Bastion | +2% **all damage** per rank with a shield. Reuse damage multipliers but apply physical and magical coverage consistently, independent of stance. |

New capabilities also arise from changed existing talents: a variable Slam GCD
and preserved swings, off-hand-specific hit/rage modifiers, Bloodrage tick scaling,
incoming-damage Enrage, and reactive defensive rage. The current incoming-attack
loop simply draws configured damage and converts it to rage. Full Shield
Specialization/Master of Defense/Revenge support requires an incoming attack table
with block, dodge, parry and crit outcomes, not the outgoing `dodgetimer`. Health,
healing, threat and crowd-control simulation are further capabilities for the
utility/defensive effects above. If those remain outside DPS scope, mark those
effects explicitly unsupported instead of presenting all 54 talents as functional.

**5. Remaining implementation choices**

- Of 159 rank descriptions, 92 are estimates accepted for implementation. Use explicit numeric handlers/rank tables, retaining provenance so later corrections are straightforward. Weaponmaster and Improved Berserker Rage must use the user overrides rather than the existing generated text.
- Shield Slam still has only the single 421–439 description; its level/rank progression needs a provisional choice. Bloodthirst's progression is now specified above.
- Decide whether this work includes an incoming avoidance/block model and the missing Revenge/Charge actions, and whether health, healing, threat and crowd control remain outside the DPS simulator's scope. Talents affecting those systems cannot become functional through numeric handlers alone.
- Document provisional choices for Bloodthrill's eligible attacks/refresh/consumption, Weaponmaster's per-hand armor bypass ordering, off-hand rage bonus coverage, Spearing Strike's weapon normalization and target conditions, and fractional Bloodrage generation. These can use explicit implementation defaults instead of waiting for verified game data.
- No game IDs are provided. Use stable local keys for UI/runtime identity, and retain unknown external IDs until established.

**6. Suggested implementation sequence and validation**

1. Wire mode-specific catalogs, neutral talent defaults, local tooltips, prerequisites, active-action gating and versioned saved builds. Keep the raw source/generator separate from behavior.
2. Implement stat/cost/rank differences and Focused Rage, Precision, Vitality's strength, Bastion, then Bloodthirst/Shield Slam and both Bloodrage components. Parameterize applicable JS constructors and native damage methods together.
3. Implement rage capacity and off-hand mechanics, then Weaponmaster, Improved Slam, Bloodthrill and Spearing Strike. Use the accepted assumptions and document provisional defaults for the remaining mechanics.
4. Implement incoming attack events, defensive rage, Enrage and Revenge; separately decide the intended health/threat/utility simulation scope. Add the shared Sweeping Strikes gap if full talent coverage is intended.

Use deterministic JS/native tests that assert externally meaningful behavior:
rank-zero neutrality; unchanged Classic results; rank-specific costs and damage;
Bloodrage initial/tick amounts; every supported rage source above 100; off-hand
Whirlwind with deliberately different main/off-hand weapons; off-hand-only hit/rage;
Slam GCD and swing timestamps at 0/1/2 ranks; Bloodthrill with no Rend, misses,
expired Rend, adjacent targets, expiry and ordinary dodge overlap; shield/stance
gates; incoming avoidance/Enrage; aura reset across iterations. Add selector and
profile checks for removed prerequisites, moved talents, smaller rank caps and
old positional builds. Update native kind/action/property registries when adding
actions, rebuild the browser/compute bundle, and run the repository's JS and native
parity suites against both modes.

The audit itself was checked by comparing names, coordinates, rank limits and
named prerequisites programmatically, tracing both engines and examining the
historical flag definitions. No combat tests were run for this documentation-only change.
