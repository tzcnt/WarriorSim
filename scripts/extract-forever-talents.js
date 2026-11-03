// Regenerate the integration listing from the captured Warrior source data.
// Usage: node scripts/extract-forever-talents.js
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'data/forever/warrior-source.json'), 'utf8'));
// Live changes newer than the snapshot, as {date, max?, desc?, row?, col?, req?} keyed by
// "Tree:Talent"; `req: null` removes a prerequisite. The raw snapshot stays unchanged.
// The 2026-10-07 snapshot already contains every earlier patch and the 1-2 Oct hotfixes.
const NOV3 = '2026-11-03';
const ranks = (values, text) => values.map(text);
const patches = {
    // Client build 1.60.1.70291: Deep Wounds is again required for Impale.
    'Arms:Impale': {date: '2026-10-08', req: 'Deep Wounds'},
    'Arms:Improved Tactical Mastery': {date: NOV3, max: 3, desc: ranks([5, 10, 15], rage =>
        `Tactical Mastery lets you retain up to an additional ${rage} Rage when you change stances.`)},
    'Arms:Two-Handed Weapon Specialization': {date: NOV3, desc: ranks([2, 4, 6], pct =>
        `Increases the damage you deal with two-handed melee weapons by ${pct}%.`)},
    'Arms:Bloodthrill': {date: NOV3, max: 2, desc: ranks([10, 20], pct =>
        `Grants your Main Hand melee attacks against enemies afflicted by your Rend a ${pct}% chance to allow an activation of Overpower.`)},
    'Arms:Improved Slam': {date: NOV3, desc: ranks([['0.25', '2.5'], ['0.50', '5.0']], ([cast, cooldown]) =>
        `Reduces the global cooldown and cast time of your Slam ability by ${cast} sec. In addition, Slam no longer ` +
        `interrupts or delays your melee swing and Slam's cooldown is reduced by ${cooldown} sec.`)},
    'Fury:Booming Voice': {date: NOV3, desc: ranks([1, 2, 3, 4, 5], rank =>
        `Increases the area of effect of your Shouts by ${rank * 10}% and reduces their Rage cost by ${rank * 5}%. ` +
        `Also reduces the Rage cost of your Piercing Howl by ${rank * 5}%.`)},
    'Fury:Enrage': {date: NOV3, row: 3, col: 4},
    'Fury:Gore Drinker': {date: NOV3, row: 5, col: 3, req: 'Blood Craze'},
    'Fury:Flurry': {date: NOV3, max: 3, req: null, desc: ranks([10, 20, 30], pct =>
        `Increases your melee attack speed by ${pct}% for your next 3 swings after dealing a melee critical strike.`)},
    'Fury:Bloodthirst': {date: NOV3, req: 'Death Wish'},
    'Protection:Defiance': {date: NOV3, desc: ranks([7, 13, 20], pct =>
        `Increases all threat generated in Defensive stance by an additional ${pct}% while a shield is equipped.`)},
};
// New talents, in the snapshot's own format.
const added = {
    Fury: [
        {name: 'Reckless Swings', max: 1, row: 4, col: 3, passive: false, icon: 'ability_warrior_endlessrage',
            desc: ['Your next 4 melee attacks generate 5 additional Rage. Lasts 8 sec.'],
            cost: '25% of base health | Instant | 15 sec cooldown', date: NOV3},
        {name: 'Improved Whirlwind', max: 2, row: 6, col: 3, passive: true, icon: 'ability_whirlwind',
            desc: ranks([[1, 15], [2, 30]], ([cooldown, pct]) =>
                `Reduces the cooldown of your Whirlwind ability by ${cooldown} sec and increases the damage it deals to the closest enemy by ${pct}%.`),
            date: NOV3},
    ],
};
const applied = new Set();
const talents = snapshot.warrior.trees.map(tree => {
    const positions = new Set();
    const source = [
        ...tree.talents.map(talent => {
            const patchKey = `${tree.name}:${talent.name}`;
            const patch = patches[patchKey];
            if (!patch) return talent;
            applied.add(patchKey);
            const result = {...talent, patch: patch.date};
            for (const field of ['max', 'desc', 'row', 'col']) if (Object.hasOwn(patch, field)) result[field] = patch[field];
            if (Object.hasOwn(patch, 'req')) {
                if (patch.req) result.req = patch.req;
                else delete result.req;
            }
            if (patch.max && !patch.desc) assert.equal(result.desc.length, patch.max, `Patched rank count: ${patchKey}`);
            if (patch.max) result.confirmed = (result.confirmed || []).filter(rank => rank <= patch.max);
            return result;
        }),
        ...(added[tree.name] || []).map(({date, ...talent}) => ({...talent, complete: true,
            confirmed: Array.from({length: talent.max}, (_, rank) => rank + 1), src: 'patch-notes',
            classic: {status: 'new'}, patch: date})),
    ].sort((a, b) => a.row - b.row || a.col - b.col);
    return { n: tree.name, t: source.map(talent => {
        const key = `${tree.name}:${talent.name}`;
        const row = talent.row, col = talent.col;
        const position = `${row}:${col}`;
        assert(!positions.has(position), `Duplicate position: ${tree.name} ${position}`);
        positions.add(position);
        assert(row >= 1 && row <= 7 && col >= 1 && col <= 4);
        assert(Number.isInteger(talent.max) && talent.max > 0);
        const d = talent.desc;
        assert(d.length === talent.max && d.every(text => typeof text === 'string' && text.length), `Rank text: ${key}`);
        const result = {
            n: talent.name,
            m: talent.max,
            s: Array(talent.max).fill(null),
            d,
            x: col - 1,
            y: row - 1,
            iconname: talent.icon,
            c: 0,
        };
        if (talent.req) {
            const parent = source.findIndex(t => t.name === talent.req);
            assert(parent >= 0, `Missing prerequisite: ${talent.req}`);
            assert(source[parent].row < row, `Prerequisite below its talent: ${key}`);
            result.r = [parent, source[parent].max];
        }
        const confirmed = new Set(talent.confirmed || []);
        const estimated = Array.from({length: talent.max}, (_, rank) => rank + 1).filter(rank => !confirmed.has(rank));
        result.forever = {
            key: `${tree.name.toLowerCase()}:${talent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}`,
            passive: talent.passive,
            sourceComplete: talent.complete === true && !estimated.length,
            estimatedDescriptionRanks: estimated,
            source: talent.src,
            implementationStatus: 'unimplemented',
        };
        if (talent.cost) {
            // "15 Rage | Melee Range | Instant | 20 sec cooldown | Requires Battle Stance"
            const parts = talent.cost.split('|').map(part => part.trim());
            const requires = parts.filter(part => part.startsWith('Requires '));
            result.forever.cost = parts.filter(part => !requires.includes(part)).join('; ');
            if (requires.length) result.forever.reqText = requires.join(', ');
        }
        for (const field of ['hotfix', 'fixed', 'classic']) {
            if (Object.hasOwn(talent, field)) result.forever[field] = talent[field];
        }
        if (talent.patch) result.forever.patch = talent.patch;
        return result;
    }) };
});
assert.deepEqual([...applied].sort(), Object.keys(patches).sort(), 'Every patch must match a source talent');
assert.deepEqual(talents.map(tree => [tree.n, tree.t.length]), [['Arms', 17], ['Fury', 19], ['Protection', 18]]);
const all = talents.flatMap(tree => tree.t);
assert.equal(new Set(all.map(t => t.forever.key)).size, all.length);
const header = '// Generated by scripts/extract-forever-talents.js; see data/forever/README.md.\n' +
    '// Beta client talent data with the 1-2 Oct 2026 server hotfixes and the 3 Nov 2026 patch notes; ' +
    'rank spell IDs are unknown. Runtime handlers are in js/talent-rules.js.\n';
fs.writeFileSync(path.join(root, 'js/data/talents_forever.js'), header +
    'var talentsForever = ' + JSON.stringify(talents, null, 3) + ';\n');
const patched = all.filter(t => t.forever.patch).length;
console.log(`Extracted ${all.length} talents with ${all.reduce((n, t) => n + t.d.length, 0)} rank descriptions; ` +
    `${all.filter(t => t.forever.hotfix).length} carry server hotfixes; ${patched} patched or added from later notes.`);
