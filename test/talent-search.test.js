'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {domain, valid, neighbors, enumerate, key, startingBuilds, statistics} = require('../scripts/lib/talent-search');
const {options} = require('../scripts/optimize-forever-talents');
const {searchSeeds} = require('../scripts/lib/search-seeds');

function fixture() {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync('js/data/talents_forever.js', 'utf8'), context);
    vm.runInContext(fs.readFileSync('js/data/session_forever.js', 'utf8'), context);
    const trees = JSON.parse(JSON.stringify(context.talentsForever)).map(tree => ({...tree,
        t: tree.t.map(t => ({...t, key: t.forever.key}))}));
    const baseline = JSON.parse(JSON.stringify(context.session.talents)).map(tree => tree.t);
    return {trees, baseline};
}

test('search constraints require all points, Bloodthirst, no Protection and legal lower rows', () => {
    const {trees, baseline} = fixture(), space = domain(trees);
    assert.ok(space.accepts(baseline));
    for (const change of [r => r[1][17]--, r => r[1][10]--, r => {r[0][0]--; r[2][0]++;},
        r => {r[0][0]--; r[0][13]++;}, r => {r[0][2]--; r[0][0]++;}]) {
        const next = structuredClone(baseline); change(next);
        assert.equal(space.accepts(next), false);
    }
    assert.equal(valid(trees, baseline.map((tree, i) => i ? tree : [])), false);
    assert.equal(valid(trees, baseline.map((tree, i) => i ? tree : tree.map((n, j) => j ? n : NaN))), false);
});

test('neighbor search matches brute-force legal one-point transfers and can move between trees', () => {
    const {trees, baseline} = fixture(), space = domain(trees);
    const expected = new Set(), flat = baseline.flat(), sizes = baseline.map(t => t.length);
    for (let from = 0; from < flat.length; from++) for (let to = 0; to < flat.length; to++) {
        if (from === to) continue;
        const next = flat.slice(); next[from]--; next[to]++;
        let offset = 0;
        const ranks = sizes.map(size => { const tree = next.slice(offset, offset + size); offset += size; return tree; });
        if (space.accepts(ranks)) expected.add(key(ranks));
    }
    const actual = neighbors(space, baseline);
    assert.deepEqual(new Set(actual.map(key)), expected);
    assert.equal(actual.length, expected.size);
    assert.ok(actual.some(ranks => ranks[0].reduce((a, b) => a + b, 0) === baseline[0].reduce((a, b) => a + b, 0) - 1));
});

test('bounded exhaustive enumeration matches brute force, validates bounds, and caps candidate count', () => {
    const {trees, baseline} = fixture();
    const bounds = Object.fromEntries(trees.flatMap((tree, i) => tree.t.map((t, j) => [t.key, baseline[i][j]])));
    Object.assign(bounds, {'arms:improved-heroic-strike': [0, 3], 'arms:improved-tactical-mastery': [0, 5], 'arms:improved-overpower': [0, 2]});
    const space = domain(trees, 51, bounds), expected = [];
    for (let heroic = 0; heroic <= 3; heroic++) for (let tactical = 0; tactical <= 5; tactical++) for (let overpower = 0; overpower <= 2; overpower++) {
        const ranks = structuredClone(baseline);
        ranks[0][0] = heroic; ranks[0][4] = tactical; ranks[0][5] = overpower;
        if (space.accepts(ranks)) expected.push(key(ranks));
    }
    assert.deepEqual(enumerate(space).map(key).sort(), expected.sort());
    assert.ok(expected.length > 1);
    assert.throws(() => enumerate(space, 1), /tighten --bounds/);
    assert.throws(() => domain(trees, 51, {'fury:typo': 1}), /Unknown talent/);
    assert.throws(() => domain(trees, 51, {'fury:cruelty': [5, 2]}), /Invalid bounds/);
});

test('independent starts are deterministic and obey all search constraints', () => {
    const {trees, baseline} = fixture(), space = domain(trees);
    const first = startingBuilds(space, baseline, 5, 123);
    assert.deepEqual(first, startingBuilds(space, baseline, 5, 123));
    assert.equal(first.length, 5);
    assert.ok(first.every(space.accepts));
    assert.equal(new Set(first.map(key)).size, 5);
});

test('Arms search retains Mortal Strike, enforces prerequisites, and explores legal allocations', () => {
    const {trees} = fixture();
    const context = {};
    vm.runInNewContext(fs.readFileSync('js/data/presets_forever.js', 'utf8'), context);
    const baseline = JSON.parse(JSON.stringify(context.profilePresets.find(p =>
        p.id === 'forever-two-handed-arms').profile.talents.map(t => t.t)));
    const space = domain(trees, 51, {}, 'arms');
    assert.ok(space.accepts(baseline));
    const starts = startingBuilds(space, baseline, 12, 123);
    assert.equal(starts.length, 12);
    assert.deepEqual(starts, startingBuilds(space, baseline, 12, 123));
    for (const ranks of [...starts, ...neighbors(space, baseline)]) {
        assert.ok(space.accepts(ranks));
        assert.ok(ranks[0].reduce((a, b) => a + b, 0) >= 31);
        assert.equal(ranks[0][16], 1);
        assert.equal(ranks[1][17], 0);
        assert.equal(ranks[2].reduce((a, b) => a + b, 0), 0);
    }
    for (const index of [12, 16]) {
        const invalid = structuredClone(baseline);
        invalid[0][index]--;
        invalid[1][0]++;
        assert.equal(space.accepts(invalid), false);
    }
    const bounds = Object.fromEntries(trees.flatMap((t, i) => t.t.map((t, j) => [t.key, baseline[i][j]])));
    bounds['arms:improved-slam'] = [0, 2];
    bounds['arms:bloodthrill'] = [0, 5];
    const bounded = domain(trees, 51, bounds, 'arms'), expected = [];
    for (let slam = 0; slam <= 2; slam++) for (let bloodthrill = 0; bloodthrill <= 5; bloodthrill++) {
        const ranks = structuredClone(baseline);
        ranks[0][14] = slam;
        ranks[0][11] = bloodthrill;
        if (bounded.accepts(ranks)) expected.push(key(ranks));
    }
    assert.deepEqual(enumerate(bounded).map(key).sort(), expected.sort());
    assert.equal(options(['--spec', 'arms']).spec, 'arms');
    assert.throws(() => options(['--spec', 'protection']), /--spec/);
});

test('statistics distinguish per-fight mean from duration-weighted UI DPS', () => {
    // Two fights: 10 DPS over 1 second and 20 DPS over 3 seconds.
    const result = statistics({iterations: 2, totaldmg: 70, totalduration: 4, sumdps: 30, sumdps2: 500});
    assert.equal(result.mean, 15);
    assert.equal(result.dps, 17.5);
    assert.equal(result.se, 5);
    assert.equal(result.ci95, 9.8);
});

test('search stages do not reuse fights under the simulator seed mapping', () => {
    const engine = vm.createContext({});
    vm.runInContext(fs.readFileSync('js/classes/simulation.js', 'utf8'), engine);
    for (const base of [0, 20260915, 0xffffffff]) {
        const seen = new Set();
        for (const seed of searchSeeds(base)) {
            // Check both edges of each reserved block, including uint32 wrap.
            for (let i = 0; i < 5000; i++) for (const offset of [i, 0x10000000 - 5000 + i]) {
                const fight = engine.simulationIterationSeed(seed, offset);
                assert.equal(seen.has(fight), false, 'a validation fight overlaps another stage');
                seen.add(fight);
            }
        }
    }
    assert.throws(() => searchSeeds(0, 17), /Invalid seed partition/);
    assert.throws(() => searchSeeds(0, 5, 0x10000001), /Invalid seed partition/);
});

test('CLI rejects malformed configuration before launching a browser', () => {
    assert.equal(options(['--site', 'https://fleetcode.com/WarriorSim']).site, 'https://fleetcode.com/WarriorSim/');
    for (const args of [['--threads', '0'], ['--threads', '65'], ['--seed', '-1'], ['--iterations', 'NaN'],
        ['--method', 'exhaustive'], ['--method', 'typo'], ['--site', 'file:///tmp/index.html']]) {
        assert.throws(() => options(args));
    }
});
