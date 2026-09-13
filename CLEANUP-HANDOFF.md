# Handoff: dead kinds and interning-table keys

## Completed cleanup — 2026-09-13

The original handoff below is retained as a historical checklist. Its counts and
pending decisions have been superseded by this implementation:

- Removed 47 native aura kinds and 7 spell kinds, including the 26/6 originally
  listed and the additional unreachable JavaScript classes. Every remaining
  native kind has a JavaScript class; `OldDeepWounds` retains its existing name.
- Removed the full Echoes/Forecast stance-bonus cluster, `UnstoppableMight`, its
  item set, secondary-stance options, profile fields, and batched bonus rage.
  Standard stance switching remains: Overpower enters Battle Stance and the
  return to the configured stance waits for the one-second stance cooldown.
- Removed inert ordered-list entries, obsolete stat updater references, Spicy's
  dynamic proc installation, and state used only by removed abilities.
- Reduced the action table from **325 to 75** names and the dense property table
  from **215 to 167**. `scripts/generate-native-keys.js` generates positional
  indices; `--check` verifies both tables, and C++ static assertions check them
  during builds. The property array remains curated, including live dynamic
  weapon skill slots and the live Classic `impslam` talent property.
- Removed the obsolete Gladiator set-bonus stats, Shield Slam's obsolete
  `resolve`/`swordboard` options, and the unused Slam `swingreset` option. The
  unrelated `swordboard` player hook remains deferred.
- Removed rune/preset SCSS rules and rebuilt the CSS with the updated Sass
  toolchain. Rebuilt JavaScript, WASM, and the compute bundle identity too.
- Marked the old SoD validation and benchmark documentation as historical while
  preserving its recorded results.

### Follow-up after the Forever talent implementation

The twelve deferred legacy player switches have now been removed from both
engines, together with their orphaned proc stages, free-Slam state, Rend proc
clock, and generated keys. Forever uses explicit talent properties and action
state for its supported mechanics; see `data/forever/IMPLEMENTATION.md`.
The current native tables contain 74 action names and 171 dense property names.

### Why the golden reports changed

Contrary to the original assumption, `UnstoppableMight` was not entirely inert:
its active-by-default catalog entry forced a fight-start stance switch, discarded
rage above Tactical Mastery's limit, and blocked `StanceSwitch` even without the
set bonus. Removing it restores the configured starting stance and normal stance
return behavior in both modes.

Before regenerating the goldens, an in-memory comparison loaded `a048f62` and
verified its four complete reports against the previous goldens. Removing only
spell 457820 from that revision's catalog then produced reports **exactly equal**
to the fully cleaned JavaScript engine for all four fixtures. Thus the golden
damage changes are attributable to the requested Unstoppable Might removal,
rather than the enum/table cleanup.

### Verification completed

- `npm run build:css` and `./build-dist.sh` succeeded.
- `node scripts/generate-native-keys.js --check` passed.
- `npm test`: 20 regressions plus 135 reference/worker/compute tests passed.
- `npm run test:wasm`: 46 native/API tests passed.
- `npm run test:regressions -- --dist`: 20 minified regressions passed.
- Added direct Overpower stance/rage/cooldown checks for both modes, native
  parity fixtures exercising those transitions, rejection of retired native
  kinds, and Classic/Forever report comparisons for every baseline fixture.
- `npm run benchmark -- 100 25 1` passed JavaScript/native parity for all six
  scenarios. Classic and Forever matched exactly for both short and long fights.
- The two gear catalogs and default session files are byte-identical.

## Original handoff

Written after the Season of Discovery removal. Nothing in this document changes
simulation results — every entry listed is already unreachable. The work is a
mechanical sweep, but it touches two positional lookup tables, so it needs to be
done with a generator rather than by hand.

## What already happened

| Commit | Removed |
| --- | --- |
| `90fa75a` remove SOD, part 1 | SoD data files, the rune system, `mode == "sod"` branches, SoD test fixtures, `sodMode` in the native engine, 12 unreachable ability classes |
| part 2 (this change) | `DefendersResolve` and `GladiatorStance`, in both engines |

Both parts removed *behaviour* and stopped there. The `AuraKind`/`SpellKind`
enums and the two interning tables were only touched where the compiler forced
it. What is left is a set of names that no longer refer to anything.

## The two tables, and why this is not a find-and-delete job

`wasm/src/action_keys.hpp` (`kActionKeyNames`, 325 entries) interns aura and
spell **keys**. `wasm/src/property_ids.hpp` (`kDensePropertyNames`, 215 entries)
interns **property names**. They overlap: 164 property names also appear in the
action table.

Each file is an array plus a `switch` that maps a compile-time hash back to an
index, and **the switch index is the array position**. Both invariants hold
today and both must hold after any edit:

```
kActionKeyCount   == kActionKeyNames.size()     (325)
kDensePropertyCount == kDensePropertyNames.size() (215)
actionKeyIndex(kActionKeyNames[i])   == i   for every i
propertyIndex(kDensePropertyNames[i]) == i   for every i
```

So removing one name renumbers every later entry. Do not hand-edit. Write a
small script that takes the name list, emits both the array and the switch, and
then re-verify the invariants (there is a checker in *Verification* below).

The action table is sorted; the property table is sorted **except** for three
entries appended later without re-sorting (`afterswing`, `swingreset`,
`dodgetimeworn`, positions 212–214). Sorting is not load-bearing — only the
index/position agreement is — but keep the existing order to keep the diff
readable.

### Safety criteria differ per table

- **Action table.** An entry is removable iff no `"name"_action` literal exists
  in the C++ sources. `_action` is `consteval` and rejects unknown names, so a
  mistake here is a compile error, not a silent bug. 217 of 325 entries
  currently have no `_action` literal.
- **Property table.** Removing an entry is **behaviour-preserving, not
  behaviour-changing**: `PropertyBag::number/has/boolean(std::string_view)` fall
  back to the sparse `numbers`/`strings` maps when `propertyIndex` returns -1,
  and `clearNumbers()` clears the sparse map too. A removed property simply
  moves from a dense slot to a hash lookup. This table is therefore a
  *performance* structure — trim it only for names that can no longer appear at
  all, and do not agonise over the marginal ones.
- **Enum entries.** `AuraKind`/`SpellKind` are parsed from constructor names in
  `parseAuraKind`/`parseSpellKind`. Nothing depends on their numeric values, so
  removing entries is safe as long as the matching `AURA_KIND(...)` /
  `SPELL_KIND(...)` registration and every `case` are removed together. All the
  relevant switches have a `default:`, so a missed `case` will not fail to
  compile — grep, do not rely on the compiler.

## 1. `AuraKind` entries with no JavaScript class (26)

No `class <Name>` exists in `js/classes/spell.js`, so the native engine can
never be handed this kind. Remove from the `AuraKind` enum in `engine.hpp`, the
`AURA_KIND(...)` line in `engine.cpp`, and each `case AuraKind::<Name>:` below.

Dead before the SoD work started (18):

```
TwowEnrageAura  PotentVenoms  QuicknessPotion  Bloodlust  Chastise  Perception
Tempest  Champion  ZandalariVigil  ForgottenOrder  ElementiumChampion
Hategrips  WorgenMark  TowerForgeSetBonus  Shieldrender  MoltenEmberstone
Modrag  UnrelentingStrikes
```

Other historical SoD-only aura entries:

```
DeepWounds  ConsumedRage  MildlyIrradiated  Rampage  SingleMinded
```

`DeepWounds` is the Season of Discovery variant. Classic uses `OldDeepWounds`,
which stays. Do not rename it — the name is the serialization contract, and
renaming means regenerating goldens for no behavioural gain.

Case sites per kind: all 26 appear once in `engine.cpp` (the registration) and
1–4 times in `auras.cpp`. `DeepWounds` also appears once in `player.cpp`,
`PotentVenoms` once in `player.cpp`.

## 2. `SpellKind` entries with no JavaScript class (6)

```
Pummel  MasterStrike            (dead before the SoD work)
VictoryRush  RagingBlow  QuickStrike  Shockwave   (dead as of the SoD removal)
```

Each appears once in `engine.cpp` and three times in `spells.cpp`.
`QuickStrike` also appears once in `player.cpp`, `Shockwave` once in
`simulation.cpp`.

## 3. `action_keys.hpp`

217 of 325 entries have no `_action` literal. 160 of those are also property
names — dropping them from the *action* table is still correct, because
properties resolve through `property_ids.hpp`, but that is a large diff for no
behavioural gain. Suggested order:

**Tier 1 — removed abilities and mechanics. Do these.**

```
sod  defendersresolve  gladiatorstance  glad  pummel  masterstrike
potentvenoms  potentvenoms2  worgenmark  moltenemberstone  turtle
```

Add `echoesglad` and `gladforecast` if you take the decision in §6.

**Tier 2 — spec field names and scalars that are never looked up as actions.**
These are interning leftovers from the original port; they are consumed by
`value["auras"]`-style JSON access, not by `_action`.

```
attackproc1  attackproc2  aura  auras  base  battle  boolean  count  def
echoes  executeperc  forecast  handle  key  keys  kind  length  links  mh
null  number  object  oh  parse  player  proc1  proc2  procs  props  seed
sim  spell  spells  startrage  stats  string  talents  target  timesecsmax
timesecsmin  trinketproc1  trinketproc2  version  weapon  weapons  zerk
```

**Tier 3 — the 160 names shared with the property table.** Optional; highest
churn, lowest value.

## 4. `property_ids.hpp`

50 of 215 entries have no `_prop` literal. Only these can never be produced at
all, so only these are worth removing:

```
hasFlurry  swingpercent  swingtimerless  wwcd
```

plus the 27 weapon-skill slots that `Player.setSkills()` never assigns:

```
skill_8  skill_9  skill_12  skill_14  skill_15  skill_16  skill_17  skill_18
skill_19  skill_22  skill_24  skill_25  skill_26  skill_27  skill_28  skill_29
skill_30  skill_31  skill_32  skill_33  skill_34  skill_35  skill_36  skill_37
skill_38  skill_39  skill_40
```

**Trap:** `player.cpp` builds `"skill_" + std::to_string(weapon.type)` and looks
it up by string, so these slots are not reachable by grep. The live set is
exactly what `js/classes/player.js` assigns: `skill_0`–`skill_7`, `skill_10`,
`skill_11`, `skill_13`, `skill_20`, `skill_21`, `skill_23`. Adding a weapon type
later means adding its slot back — or relying on the sparse fallback, which is
correct but slower.

Leave `impslam`, `resolve`, `switchdelay`, `swingreset` in place for now; they
are still written by JavaScript even though no `_prop` reader remains. Removing
them is covered by §6.

## 5. `engine.cpp` ordered-key lists

`stepNamed`, `endNamed`, `onUseAuras`, `absoluteAuras`, `timedSpells`,
`stepSpells`, `noGcdAuras`, `moreNoGcdAuras` and the `addOrderedKey` calls name
abilities that no longer exist. `addOrderedKey` skips keys it cannot resolve, so
these are inert — but they are the clearest signal of the debt:

```
rampage 3x   mildlyirradiated 3x
singleminded 3x   echoesglad 3x   gladforecast 3x
consumedrage 2x   quickstrike 2x   ragingblow 2x
shockwave 2x
```

Remove these before touching the action table, otherwise the `_action` literals
here will keep those names looking live.

## 6. Decisions to make, not just deletions

These need a judgement call rather than a mechanical edit:

- **`EchoesGlad` / `GladForecast`, and the whole stance-dance cluster.** Part 2
  removed Gladiator Stance, so these two auras can never be entered. They are
  were constructed by the old stance-switch set bonuses, and
  `BattleForecast` pairs with `GladForecast` explicitly
  (`auras.cpp`, `case AuraKind::GladForecast`). Removing them also makes
  `UnstoppableMight` (spell id 457820, `js/data/spells.js`), the `secondarystance`
  rotation option, and the `Unstoppable Might` item set inert. Decide whether the
  stance-swap machinery has a future in WoW Forever before deleting it.
- **Deferred legacy player switches and obsolete Gladiator set-bonus stats.**
  Cleanup is complete; the supported Forever talents use separate runtime
  properties. Catalog omissions alone still do not establish whether an
  unrelated item set is obsolete.
- **Spell options that no longer do anything.** `js/data/spells.js` Shield Slam
  still carries `resolve: false` and `swordboard: false`; both were rune-only
  gates.
- **Unreachable ability classes still in `js/classes/spell.js`.** No catalog
  string names them and nothing constructs them:
  `Vibroblade`, `Ultrasonic`, `BlisteringRagehammer`, `Jackhammer`,
  `LordGeneral`, `Stoneslayer`, `CleaveArmor`, `StrengthChampion`, `EchoesDread`,
  `MeltArmor`, `CrusaderZeal`, and `Ragehammer`/`Spicy` (each referenced only
  once inside `spell.js` itself). Most predate the SoD work.
- **SCSS.** `scss/gear.scss`, `scss/settings.scss` and `scss/profiles.scss` still
  carry `.runes` and `.presets` rules. They were left alone because the
  `gulp-sass`/node-sass toolchain is not installed and will not build on Node 21,
  so editing them would desync `dist/css/style.css`. Fix the toolchain first, or
  edit both together.
- **Historical documentation.** `wasm/README.md` and `server/README.md` still say
  "SoD" in their dated validation records and benchmark tables. Those describe
  measurements against fixtures that no longer exist; rewriting them would make
  the record false. Left deliberately.

## Procedure

1. Do §5 first — the ordered-key lists — so the remaining `_action` literals
   reflect reality.
2. Do §1 and §2 (enums, registrations, `case` labels). Build and run the suites.
3. Regenerate `action_keys.hpp` (§3) and, if you want it, `property_ids.hpp`
   (§4) from a name list with a generator. Build and run the suites.
4. Take the §6 decisions separately, one at a time.

Steps 1–3 should produce **zero** change in any simulation number. If a golden
report moves, something live was removed — do not regenerate the goldens to make
it pass.

## Verification

Table invariants, after any edit to either header:

```js
// node -e '...' from the repository root
const fs = require('fs');
for (const [file, arr, count] of [
    ['wasm/src/action_keys.hpp', 'kActionKeyNames', 'kActionKeyCount'],
    ['wasm/src/property_ids.hpp', 'kDensePropertyNames', 'kDensePropertyCount']]) {
    const s = fs.readFileSync(file, 'utf8');
    const names = [...s.match(new RegExp(arr + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\};'))[1]
        .matchAll(/"([^"]+)"/g)].map(m => m[1]);
    const cases = [...s.matchAll(
        /case \w+Hash\("([^"]+)"\): return value == "[^"]+" \? (-?\d+) : -1;/g)]
        .map(m => [m[1], Number(m[2])]);
    const declared = Number(s.match(new RegExp(count + '\\s*=\\s*(\\d+)'))[1]);
    console.log(file, names.length === declared &&
        cases.length === names.length &&
        cases.every(([n, i]) => names[i] === n) ? 'OK' : 'BROKEN');
}
```

Then the full suite. `npm test` and `npm run test:compute` need freshly built
assets; the native suites need a fresh `npm run wasm`.

```sh
./build-dist.sh
npm test               # 20 regressions + 135
npm run test:wasm      # 48 native/API parity
npm run test:compute   # 80
npm run test:regressions -- --dist
```

Finally, confirm the two modes are still identical — `forever-dw-fury` must
reproduce `classic-dw-fury` exactly:

```sh
npm run benchmark -- 100 25 1
```
