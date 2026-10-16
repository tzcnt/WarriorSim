'use strict';

// Rage gained, rage waits, and the rage cost counters are report-only counters that the JavaScript
// reference engine does not produce, so they are checked here against their definitions rather
// than for parity.
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
        for (const group of ['spells', 'auras']) {
            for (const [key, action] of Object.entries(full.player[group])) {
                const merged = parts.map(part => part.player[group][key]);
                assert.equal(merged.reduce((sum, value) => sum + value.ragedelays, 0), action.ragedelays, `${key}.ragedelays`);
                for (const counter of ['ragewait', 'ragespent', 'stancerage', ...group === 'spells' ? ['whiterage', 'whitedmg'] : []])
                    assertClose(merged.reduce((sum, value) => sum + value[counter], 0), action[counter], `${group}.${key}.${counter}`);
            }
        }
    });

    test(`${fixture.name}: rage spent and lost to stance swaps fits within the rage gained`, () => {
        const spec = specFor(fixture);
        const iterations = 60;
        const [report] = runBatches(spec, fixture.sim.seed, [iterations]);
        const spent = actions(report).reduce((sum, [, action]) => sum + action.ragespent + action.stancerage, 0);
        // What was not spent or lost is the rage left at the end of each fight.
        const left = iterations * spec.sim.startrage + report.ragegained - spent;
        assert.ok(spent > 0);
        assert.ok(left >= -1e-6 && left <= iterations * (spec.player.props.ragecap || 100), `${left} rage left over`);
        assert.equal(report.player.spells.stanceswitch?.stancerage || 0, 0, 'the switch back counts toward its cause');
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

test('abilities pay their cost, less the 80% refunded when they miss or are dodged', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    spec.player.props.ragecap = 1e9;
    const [report] = runBatches(spec, fixture.sim.seed, [100]);
    for (const key of ['bloodthirst', 'hamstring']) {
        const spell = report.player.spells[key];
        const cost = spec.player.spells.find(value => value.key === key).props.cost;
        assert.ok(spell.data[1] + spell.data[2] > 0, `${key} missed or was dodged`);
        assertClose(spell.ragespent, cost * (uses(spell) - .8 * (spell.data[1] + spell.data[2])), `${key}.ragespent`);
        assert.equal(spell.stancerage, 0, `${key} is usable in Berserker Stance`);
        assert.equal(spell.whiterage, 0, `${key} does not replace a white swing`);
        assert.equal(spell.whitedmg, 0, `${key} does not replace a white swing`);
    }
});

// No misses or dodges, and enough target defense that glancing blows fill the rest of the white
// table: every white swing glances, while Heroic Strike still hits and crits.
function glancingSpec(fixture) {
    const spec = specFor(fixture);
    const {player} = spec;
    for (const stats of [player.base, player.stats]) stats.hit = 100;
    player.target.dodge = 100;
    player.target.defense = Number(player.props.level) * 5 + 45;
    return spec;
}

test("Heroic Strike's table roll is read on the white table: Forever gives up glancing rage when every white swing glances", () => {
    const fixture = foreverFixture();
    const spec = glancingSpec(fixture);
    spec.player.props.ragecap = 1e9;
    const [report] = runBatches(spec, fixture.sim.seed, [100]);
    const {speed, twohand} = spec.player.weapons.mh.props;
    const heroic = report.player.spells.heroicstrike;
    // data: hit, miss, dodge, crit, glance. On its own table Heroic Strike crits, which would double the rage.
    const [hits, misses, dodges, crits] = heroic.data;
    assert.ok(hits && crits && !misses && !dodges, `Heroic Strike results ${heroic.data}`);
    assert.ok(report.player.mh.data[4] > 0 && report.player.mh.data[4] === uses(report.player.mh), 'white swings all glance');
    // A glance gives the base rage, plus Unbridled Wrath's chance of 1 more.
    const expected = (hits + crits) * (speed * (twohand ? 4.5 : 3.46) + spec.player.talents.umbridledwrath / 100);
    assertClose(heroic.whiterage, expected, 'heroicstrike.whiterage');
});

// With no bonus damage and no crits, a Heroic Strike deals exactly what the white swing would have
// dealt before its glancing reduction.
function unbonusedGlancingStrike(fixture) {
    const spec = glancingSpec(fixture);
    // Glancing swings generate little rage in Classic, so start with plenty.
    spec.player.props.ragecap = spec.sim.startrage = 1e9;
    Object.assign(spec.player.spells.find(spell => spell.key === 'heroicstrike').props, {bonus: 0, value1: 0, nocrit: true});
    const [report] = runBatches(spec, fixture.sim.seed, [100]);
    const heroic = report.player.spells.heroicstrike;
    assert.ok(heroic.totaldmg > 0);
    assert.equal(heroic.data[0], uses(heroic), 'every Heroic Strike hits');
    const diff = spec.player.target.defense - spec.player.stats[`skill_${spec.player.weapons.mh.props.type}`];
    const clamp = (value, low, high) => Math.min(Math.max(value, low), high);
    const glancing = (clamp(1.3 - .05 * diff, .01, .91) + clamp(1.2 - .03 * diff, .2, .99)) / 2;
    return {spec, heroic, whitedmg: heroic.totaldmg * glancing};
}

for (const mode of ['classic', 'forever']) {
    test(`${mode} Heroic Strike gives up the damage of the same damage roll without its bonus, glancing on average`, () => {
        const {heroic, whitedmg} = unbonusedGlancingStrike(loadFixtures().find(value => value.name === `${mode}-dw-fury`));
        assert.ok(Math.abs(heroic.whitedmg - whitedmg) <= whitedmg * 1e-9, `${heroic.whitedmg} != ${whitedmg}`);
    });
}

test('Classic Heroic Strike gives up the rage that damage would have generated', () => {
    const {spec, heroic, whitedmg} = unbonusedGlancingStrike(loadFixtures().find(value => value.name === 'classic-dw-fury'));
    const expected = whitedmg / spec.player.props.rageconversion * 7.5;
    assert.ok(Math.abs(heroic.whiterage - expected) <= expected * 1e-9, `${heroic.whiterage} != ${expected}`);
});

test('the rage cap limits the white swing rage a queued strike gives up', () => {
    const fixture = foreverFixture();
    const spec = glancingSpec(fixture);
    const heroic = runBatches(spec, fixture.sim.seed, [100])[0].player.spells.heroicstrike;
    const {speed, twohand} = spec.player.weapons.mh.props;
    const uncapped = uses(heroic) * (speed * (twohand ? 4.5 : 3.46) + spec.player.talents.umbridledwrath / 100);
    assert.ok(heroic.whiterage > 0 && heroic.whiterage < uncapped, `${heroic.whiterage} of ${uncapped}`);
});

test('rage over the retained amount, there and back, counts toward the ability that needed the stance', () => {
    const fixture = foreverFixture();
    const spec = specFor(fixture);
    const [report] = runBatches(spec, fixture.sim.seed, [100]);
    const swapped = ['overpower', 'rend'].filter(key => (report.player.spells[key] || report.player.auras[key]).stancerage > 0);
    assert.ok(swapped.length, 'a Battle Stance ability lost rage to a stance swap');
    for (const key of ['bloodthirst', 'whirlwind', 'hamstring', 'stanceswitch'])
        assert.equal(report.player.spells[key].stancerage, 0, key);

    spec.player.talents.rageretained = 100;
    const [kept] = runBatches(spec, fixture.sim.seed, [100]);
    for (const [key, action] of actions(kept)) assert.equal(action.stancerage, 0, `${key} keeps all its rage`);
});
