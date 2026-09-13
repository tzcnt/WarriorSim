# Classic Era and WoW Forever maintenance notes

The legacy cleanup is complete. The supported modes are `classic` and `forever`.
There are no deferred Season of Discovery mechanics in the runtime or catalogs.

## Removed

- Retired player switches, proc stages, free-ability state, rage thresholds,
  stance bonuses, and item-set hooks in both JavaScript and WASM.
- Obsolete item actions and auras, enchants, skill-specialization buffs, and
  seasonal item sets, including seasonal IDs mixed into Classic sets.
- Corresponding rotation/profile fields, Settings options, Timeworn gear filters,
  reporting hooks, native kinds and lookup-table entries.
- Dormant native Turtle WoW combat formulas and unused armor/rage modifiers.
- The obsolete `gear/` import pages and their unreferenced raw data exports.
- Superseded implementation checklists and benchmark records from current docs;
  their original versions remain available in Git history.

Ordinary Classic gear and sets remain supported, including The Gladiator set and
Timeworn Mace. Their names do not imply the removed stance or seasonal mechanics.
The captured Forever source and its provenance remain unchanged.

Imperial Plate had copied the seasonal Wailing Berserker set's two-/three-piece
hit/Strength bonuses in commit `2d6e2a8`. It now uses its supported Classic DPS
bonus: [28 AP at four pieces](https://www.wowhead.com/classic/item-set=321/imperial-plate).
This changes results only for configurations activating that set bonus.

## Current implementation

[Forever's implementation notes](data/forever/README.md#combat-rules) describe the
accepted estimates, runtime rules, talent selector and saved-build migration.
Shared combat code uses resolved talent properties where possible. Behavior that
differs by mode remains explicit in both engines. Classic and Forever have their
own expected results; equality between the modes is not an invariant.

Sweeping Strikes requires the talent, an enabled rotation action and adjacent
mobs in both modes. Its copies share damage logic, with mode-specific GCD and
expiry rules. Sword-proc timestamps reset every fight. Forever Slam has a
15-second cooldown and its specified swing behavior; Classic retains no cooldown
and resets swings after casting.

The defensive model's pre-existing limitations remain intentional: incoming
attacks are raw damage events, without avoidance/block/crit outcomes, health,
healing, threat, crowd control, Charge or Revenge simulation. Data-only defensive
talent descriptions and handlers remain; they do not enable missing systems.

## Native tables and verification

The current native tables contain **52 action names** and **139 dense property
names**. `scripts/generate-native-keys.js` derives action names from C++ literals
and regenerates positional indices for both tables. The property-name array is
curated; retain live dynamically accessed weapon-skill slots. Compilation and
`--check` verify the index invariants.

After changing runtime sources, rebuild before running deployment tests:

```sh
./build-dist.sh
node scripts/generate-native-keys.js --check
npm test
npm run test:wasm
npm run test:regressions -- --dist
```

The cleanup preserves all four checked-in golden reports. Tests for retired
mechanics were removed; proc-order coverage uses the supported Annihilator aura.
Native API tests also reject the removed constructor kinds.

Final verification passed 175 Node tests, 18 source regressions, 55 native/API
checks, and 18 minified regressions. Browser checks passed Settings, catalogs,
saved configuration and deployed-worker DPS runs in both modes.
