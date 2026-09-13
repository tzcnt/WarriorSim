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

## Integration boundaries

All 159 rank descriptions are populated: 67 supplied descriptions and 92 estimates.
The estimates use the site's captured `rankText` and `scaleText` functions,
including its numeric token selection, fixed values, caps, and rounding. Estimated
ranks are marked in metadata. Available descriptions are copied exactly, including
multiline descriptions. The original source snapshot remains unmodified.

The source supplies no talent IDs or spell IDs. Existing Classic IDs and aura
handlers have not been reused based on matching names: many mechanics, rank
counts, positions, and prerequisites changed. No `aura` or `enable` handlers
are supplied, and every talent is marked `implementationStatus: 'unimplemented'`.
This is a schema-aligned integration input, not a runnable replacement for
`talents.js`. It is not loaded by the application or included in build manifests.
Before enabling it, resolve IDs, verify estimated ranks, implement combat effects,
and adapt tooltip handling to the Forever descriptions and IDs. The current
UI uses external spell links and the player builder calls `talent.aura(...)`.

Examples of changes present in this snapshot include Bloodthrill and Weaponmaster
in Arms; Boundless Rage, Raging Blows and Precision in Fury; and Master of Defense,
Vanguard, Vitality, Focused Rage and Bastion in Protection. Improved Slam moves to
Arms, Iron Will to Fury, and Improved Thunder Clap to Protection. These changes
are preserved without changing the existing Classic/SoD simulator.
