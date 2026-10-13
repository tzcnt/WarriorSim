'use strict';

// Rage gained and rage waits are report-only counters that the JavaScript reference engine does
// not produce, so they are checked here against their definitions rather than for parity.
const assert = require('node:assert/strict');
const test = require('node:test');
const {createConfiguredPlayer, createReferenceEngine, loadFixtures} = require('./reference-engine');
const {loadNativeModule} = require('./native-engine');

let wasmModule;
test.before(async () => { wasmModule = await loadNativeModule(); });

const foreverFixture = () => loadFixtures().find(fixture => fixture.name === 'forever-dw-fury');

function specFor(fixture) {
    return createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture).serializeSimulationSpec(fixture.sim);
}

function runBatches(spec, seed, counts, fullReport = true) {
    const handle = wasmModule.createEngine(JSON.stringify(spec), seed >>> 0);
    try {
        let offset = 0;
        return counts.map(count => {
            const report = JSON.parse(wasmModule.runBatch(handle, count, offset, fullReport));
            offset += count;
            return report;
        });
    } finally {
        wasmModule.destroyEngine(handle);
    }
}

function assertClose(actual, expected, label) {
    assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-12),
        `${label}: ${actual} != ${expected}`);
}

const actions = report => [...Object.entries(report.player.spells), ...Object.entries(report.player.auras)];
const fightMs = report => report.totalduration * 1000;
const uses = action => action.data.reduce((sum, count) => sum + count, 0);

for (const fixture of loadFixtures()) {
    test(`${fixture.name}: rage counters leave combat unchanged and merge across batches`, () => {
        const spec = specFor(fixture);
        const iterations = 60;
        const [full] = runBatches(spec, fixture.sim.seed, [iterations]);
        const [summary] = runBatches(spec, fixture.sim.seed, [iterations], false);
        for (const key of ['totaldmg', 'totalduration', 'sumdps', 'sumdps2', 'ragegained'])
            assert.equal(summary[key], full[key], `summary ${key}`);
        assert.equal(summary.ragespread, undefined);
        assert.equal(summary.player, undefined);

        assert.ok(full.ragegained > 0, 'white swings generate rage');
        assert.equal(Object.values(full.ragespread).reduce((sum, count) => sum + count, 0), iterations);
        // At most one action waits at a time, so all waits fit in the fights.
        const waited = actions(full).reduce((sum, [, action]) => sum + action.ragewait, 0);
        assert.ok(waited <= fightMs(full), `${waited} ms of waits in ${fightMs(full)} ms of fights`);

        const parts = runBatches(spec, fixture.sim.seed, [2, 7, 3, iterations - 12]);
        assertClose(parts.reduce((sum, part) => sum + part.ragegained, 0), full.ragegained, 'ragegained');
        const spread = {};
        for (const part of parts) {
            for (const [key, count] of Object.entries(part.ragespread)) spread[key] = (spread[key] || 0) + count;
        }
        assert.deepEqual(spread, full.ragespread);
        for (const [key, action] of actions(full)) {
            const group = key in full.player.spells ? 'spells' : 'auras';
            const merged = parts.map(part => part.player[group][key]);
            assert.equal(merged.reduce((sum, value) => sum + value.ragedelays, 0), action.ragedelays, `${key}.ragedelays`);
            assertClose(merged.reduce((sum, value) => sum + value.ragewait, 0), action.ragewait, `${key}.ragewait`);
        }
    });
}

test('with a fixed fight length, the rage spread averages to rage gained per second', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    spec.sim.timesecsmin = spec.sim.timesecsmax = 30;
    const [report] = runBatches(spec, fixture.sim.seed, [200]);
    const keys = Object.entries(report.ragespread);
    // Each fight's rage per second is rounded to the nearest thousandth.
    const average = keys.reduce((sum, [key, count]) => sum + key * count, 0) / report.iterations / 1000;
    assert.ok(Math.abs(average - report.ragegained / report.totalduration) <= .0005);
});

test('Forever rage gained is the white-swing formula when nothing else generates or spends rage', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    const {props, talents, weapons} = spec.player;
    props.ragecap = 1e9;
    talents.angermanagement = talents.umbridledwrath = 0;
    // Abilities cost more than any rage reached, so none is used, spends, refunds, or changes stance.
    for (const action of [...spec.player.spells, ...spec.player.auras]) {
        if (action.props.cost !== undefined) action.props.cost = 1e9;
        for (const key of ['rage', 'tickrage', 'value1', 'value2']) {
            if (action.props[key] !== undefined) action.props[key] = 0;
        }
    }
    const [report] = runBatches(spec, fixture.sim.seed, [40]);
    // data: hit, miss, dodge, crit, glance. Crits double the rage; glances do not change it.
    const whiteRage = (weapon, data) => weapon.speed * (weapon.twohand ? 4.5 : 3.46) *
        (weapon.offhand ? .5 * (1 + (talents.offragebonus || 0)) : 1) * (data[0] + 2 * data[3] + data[4]);
    const expected = whiteRage(weapons.mh.props, report.player.mh.data) +
        (weapons.oh ? whiteRage(weapons.oh.props, report.player.oh.data) : 0);
    assert.ok(expected > 0);
    assert.ok(Math.abs(report.ragegained - expected) <= expected * 1e-12, `${report.ragegained} != ${expected}`);
    for (const [key, action] of actions(report)) {
        if (action.ragedelays) assert.ok(action.ragewait > 0, key);
    }
});

test('an ability that can never pay its cost waits for the rest of the fight, ahead of the abilities below it', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    spec.sim.executeperc = 0;
    const priority = spec.player.links.normalSpells.map(link => link.key);
    const index = priority.indexOf('bloodthirst');
    assert.ok(index >= 0 && index < priority.length - 1, 'fixture uses Bloodthirst above other abilities');
    spec.player.spells.find(spell => spell.key === 'bloodthirst').props.cost = 1e6;
    const iterations = 50;
    const [report] = runBatches(spec, fixture.sim.seed, [iterations]);
    const bloodthirst = report.player.spells.bloodthirst;
    assert.equal(uses(bloodthirst), 0);
    assert.ok(bloodthirst.ragedelays >= iterations);
    assert.ok(bloodthirst.ragewait >= fightMs(report) / 2, `${bloodthirst.ragewait} of ${fightMs(report)} ms`);
    for (const key of priority.slice(index + 1)) {
        const action = report.player.spells[key] || report.player.auras[key];
        assert.equal(action.ragedelays, 0, `${key} is never the next ability while Bloodthirst waits`);
    }
});

test('Death Wish waiting for rage holds every GCD ability and is reported as its own wait', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    const deathWish = spec.player.auras.find(aura => aura.key === 'deathwish');
    assert.ok(deathWish, 'fixture uses Death Wish');
    delete deathWish.props.timetoend;
    deathWish.props.timetostart = 0;
    deathWish.props.cost = 1e6;
    const iterations = 50;
    const [report] = runBatches(spec, fixture.sim.seed, [iterations]);
    const wait = report.player.auras.deathwish;
    assert.equal(report.player.auras.deathwish.uptime, 0);
    assert.ok(wait.ragedelays >= iterations);
    assert.ok(wait.ragewait >= fightMs(report) * .8, `${wait.ragewait} of ${fightMs(report)} ms`);
    for (const [key, spell] of Object.entries(report.player.spells)) {
        assert.equal(spell.ragedelays, 0, key);
        if (spell.cost) assert.equal(uses(spell), 0, `${key} waits behind the rage reserved for Death Wish`);
    }
});
