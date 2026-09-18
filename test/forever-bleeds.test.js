'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {bleedFixtures} = require('./wasm/bleed-fixtures');
const {createReferenceEngine, createConfiguredPlayer} = require('./wasm/reference-engine');

function close(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

function setup(fixture, key) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)');
    player.reset(100);
    // Ensure Rend lands, while preserving its real application.
    player.mh.miss = player.mh.dodge = 0;
    const aura = player.auras[key];
    aura.use();
    const tickDamage = key === 'rend' ? (fixture.mode === 'forever' ?
        (aura.value1 / aura.value2 + .02 * player.stats.ap) * player.stats.dmgmod *
            aura.dmgmod * player.bleedmod * (player.auras.eureka?.stacks ? 1.1 : 1) : aura.tickdmg) :
        ((player.mh.mindmg + player.mh.maxdmg) / 2 + player.mh.bonusdmg +
            player.stats.moddmgdone + player.stats.ap / 14 * player.mh.speed) *
        player.mh.modifier * player.stats.dmgmod * player.talents.deepwounds * player.bleedmod / 4;
    player.proccrit = () => assert.fail('bleed ticks must not trigger crit procs');
    for (const [name, wound] of Object.entries(player.auras)) {
        if (name.startsWith('deepwounds'))
            wound.use = () => assert.fail('bleed ticks must not apply or refresh Deep Wounds');
    }
    return {engine, player, aura, tickDamage};
}

for (const fixture of bleedFixtures()) {
    for (const key of ['rend', 'deepwounds', 'deepwounds2']) {
        test(`${fixture.name}: ${key} tick crit chance, damage and proc isolation`, () => {
            for (const chance of [0, 30, 100]) {
                const {engine, player, aura, tickDamage} = setup(fixture, key);
                // Include main-hand talent and racial crit in the mixed threshold.
                player.crit = chance ? chance - 7 : 0;
                player.mh.crit = chance ? 5 : 0;
                player.mh.racialcrit = chance ? 2 : 0;
                const rolls = [0, 2999, 3000, 9999];
                engine.evaluate('rng10k = () => rolls.shift()', {rolls});
                const expiration = aura.timer;
                let expected = 0;
                for (let i = 0; i < 4; ++i) {
                    engine.evaluate('step = time', {time: (i + 1) * 3000});
                    aura.step();
                    const crit = key === 'rend' && fixture.mode === 'forever' &&
                        (chance === 100 || (chance === 30 && i < 2));
                    expected += tickDamage * (crit ? 2 + player.talents.abilitiescrit : 1);
                    close(aura.idmg, expected);
                    close(aura.totaldmg, expected);
                    assert.equal(aura.nexttick,
                        fixture.mode === 'forever' && key !== 'rend' && i === 3 ? 0 : (i + 2) * 3000);
                    assert.equal(aura.timer, i === 3 && key !== 'rend' ? 0 : expiration);
                }
                assert.equal(rolls.length, key === 'rend' && fixture.mode === 'forever' ? 0 : 4,
                    'Only Forever Rend ticks may consume crit RNG');
                if (key === 'rend') {
                    if (fixture.mode === 'classic')
                        assert.equal(aura.tickdmg, tickDamage, 'Classic retains its damage snapshot');
                    assert.equal(aura.stacks, aura.value2 - 4);
                    assert.deepEqual(Array.from(aura.data), [1, 0, 0, 0, 0],
                        'Rend outcome counters describe its non-critical application');
                    assert.equal(player.auras.deepwounds.timer, 0);
                }
            }
        });
    }
}

for (const key of ['rend', 'deepwounds']) {
    test(`Forever ${key} ${key === 'rend' ? 'uses current' : 'ignores'} crit chance on each tick, including overdue ticks`, () => {
        const fixture = bleedFixtures().find(f => f.name === 'forever-bleeds-impale-2');
        const {engine, player, aura, tickDamage} = setup(fixture, key);
        player.crit = player.mh.crit = 0;
        delete player.mh.racialcrit;
        const rolls = [5000, 5000, 9999, 0];
        engine.evaluate('rng10k = () => rolls.shift(); step = 3000', {rolls});
        aura.step();
        close(aura.idmg, tickDamage);
        player.crit = 100;
        engine.evaluate('step = 6000');
        aura.step();
        close(aura.idmg, tickDamage * (key === 'rend' ? 3.2 : 2));
        player.crit = 50;
        engine.evaluate('step = 12000');
        aura.step();
        close(aura.idmg, tickDamage * (key === 'rend' ? 6.4 : 4));
        assert.equal(rolls.length, key === 'rend' ? 0 : 4);
    });
}

for (const mode of ['classic', 'forever']) {
    test(`${mode}: Rend ${mode === 'forever' ? 'uses current stats' : 'retains its snapshot'} on every tick`, () => {
        const fixture = bleedFixtures().find(f => f.mode === mode);
        const {engine, player, aura} = setup(fixture, 'rend');
        const snapshot = aura.tickdmg;
        player.mh.crit = player.mh.racialcrit = 0;
        player.auras.eureka = {stacks: 0};
        aura.eurekamod = 1.1; // A stale cast bonus must not affect Forever ticks.
        for (const [ap, damageMod, bleedMod, eurekaMod, crit] of [
            [100, 1, 1, 1, 0],
            [1000, 1.2, .8, 1.1, 100],
            [0, 1, 1, 1, 0],
        ]) {
            Object.assign(player.stats, {ap, dmgmod: damageMod});
            player.bleedmod = bleedMod;
            player.auras.eureka.stacks = eurekaMod > 1 ? 3 : 0;
            player.crit = crit;
            const expected = mode === 'forever' ?
                (aura.value1 / aura.value2 + .02 * ap) * damageMod * aura.dmgmod * bleedMod *
                    eurekaMod * (crit ? 2 + player.talents.abilitiescrit : 1) : snapshot;
            const before = aura.idmg;
            engine.evaluate('step = time', {time: aura.nexttick});
            aura.step();
            close(aura.idmg - before, expected);
        }
    });
}

function stackingSetup() {
    const fixture = bleedFixtures().find(f => f.name === 'forever-bleeds-impale-2');
    const engine = createReferenceEngine('forever');
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123); rng10k = () => 9999');
    player.reset(100);
    player.stats.ap = player.stats.moddmgdone = player.crit = 0;
    player.stats.dmgmod = player.base.dmgmod = player.bleedmod = 1;
    player.talents.deepwounds = .6;
    Object.assign(player.mh, {mindmg: 100, maxdmg: 100, bonusdmg: 0, modifier: 1, crit: 0, racialcrit: 0});
    Object.assign(player.oh, {mindmg: 40, maxdmg: 40, bonusdmg: 0, modifier: .5});
    return {engine, player, aura: player.auras.deepwounds,
        at: time => engine.evaluate('step = time', {time})};
}

test('Forever restores the SoD damage pool and preserves the pending tick across refreshes', () => {
    const {player, aura, at} = stackingSetup();
    assert.equal(aura.constructor.name, 'DeepWounds');
    aura.use(); // 60 main-hand damage over four ticks.
    at(1000);
    aura.use();
    at(2000);
    aura.use(true); // 12 off-hand damage, including its damage penalty.
    close(aura.saveddmg, 132);
    assert.equal(aura.nexttick, 3000);
    assert.equal(aura.timer, 12000);
    assert.equal(aura.ticksleft, 4);
    at(3000);
    aura.step();
    close(aura.idmg, 33);
    close(aura.saveddmg, 99);
    assert.equal(aura.ticksleft, 3);
    at(4000);
    aura.use();
    close(aura.saveddmg, 159);
    assert.equal(aura.nexttick, 6000);
    assert.equal(aura.timer, 15000);
    assert.equal(aura.ticksleft, 4);
    at(6000);
    aura.step();
    close(aura.idmg, 72.75);
    at(6500);
    aura.use(true);
    close(aura.saveddmg, 131.25);
    assert.equal(aura.nexttick, 9000);
    assert.equal(aura.timer, 18000);
    for (const time of [9000, 12000, 15000, 18000]) {
        at(time);
        aura.step();
    }
    close(aura.idmg, 204);
    close(aura.totaldmg, 204);
    assert.equal(aura.uptime, 18000);
    assert.equal(aura.timer, 0);
    assert.equal(aura.nexttick, 0);
    assert.equal(aura.saveddmg, 0);
    assert.equal(aura.ticksleft, 0);
    // Expired auras cannot pay extra ticks, and the next proc starts a fresh clock.
    at(21000);
    aura.step();
    close(aura.idmg, 204);
    player.proccrit(true);
    close(aura.saveddmg, 12);
    assert.equal(aura.nexttick, 24000);
    assert.equal(aura.timer, 33000);
});

test('Forever Deep Wounds snapshots each contribution and keeps separate pools per target', () => {
    const {player, aura, at} = stackingSetup();
    player.stats.ap = 140;
    player.mh.speed = 2;
    player.mh.bonusdmg = 5;
    player.stats.moddmgdone = 5;
    player.stats.dmgmod = 1.5;
    player.bleedmod = .8;
    player.proccrit(false); // (100 + 5 + 5 + 20) * 1.5 * .6 * .8 = 93.6.
    close(aura.saveddmg, 93.6);
    player.stats.ap = player.stats.moddmgdone = player.mh.bonusdmg = 0;
    player.bleedmod = 1;
    at(1000);
    player.proccrit(true, 1);
    close(player.auras.deepwounds2.saveddmg, 12);
    close(aura.saveddmg, 93.6);
    assert.equal(aura.nexttick, 3000);
    assert.equal(player.auras.deepwounds2.nexttick, 4000);
    at(3000);
    aura.step();
    close(aura.idmg, 23.4, 'later stat changes do not recalculate existing damage');
    player.proccrit(false);
    close(aura.saveddmg, 70.2 + 60);
    close(player.auras.deepwounds2.saveddmg, 12);
});

test('Forever Deep Wounds cannot crit and pays only the saved damage across refreshes', () => {
    const {player, aura, at} = stackingSetup();
    player.crit = 100;
    aura.use();
    player.proccrit = () => assert.fail('tick crits must not trigger another Deep Wounds');
    at(3000);
    aura.step();
    close(aura.idmg, 15);
    close(aura.saveddmg, 45);
    at(4000);
    aura.use();
    close(aura.saveddmg, 105);
    for (const time of [6000, 9000, 12000, 15000]) {
        at(time);
        aura.step();
    }
    close(aura.idmg, 120);
    assert.equal(aura.saveddmg, 0);
});

test('Forever off-hand special crits contribute off-hand Deep Wounds damage', () => {
    const {engine, player, aura} = stackingSetup();
    const whirlwind = player.spells.whirlwind;
    player.rollmeleespell = () => engine.evaluate('RESULT.CRIT');
    player.procattack = () => 0;
    player.dealdamage = damage => damage;
    player.castoh(whirlwind);
    close(aura.saveddmg, 12);
    close(player.auras.deepwounds2.saveddmg, 0);
});

test('Forever Deep Wounds clears pending damage at fight end and reset on every target', () => {
    const {player, aura, at} = stackingSetup();
    aura.use();
    at(3000);
    aura.step();
    close(aura.idmg, 15);
    at(4000);
    aura.end();
    assert.equal(aura.uptime, 4000);
    assert.equal(aura.saveddmg, 0);
    assert.equal(aura.ticksleft, 0);
    assert.equal(aura.nexttick, 0);
    aura.use();
    close(aura.saveddmg, 60);
    for (const key of ['deepwounds2', 'deepwounds3', 'deepwounds4']) player.auras[key].use(true);
    at(0);
    player.reset(100);
    for (const key of ['deepwounds', 'deepwounds2', 'deepwounds3', 'deepwounds4']) {
        const wound = player.auras[key];
        for (const field of ['timer', 'nexttick', 'saveddmg', 'ticksleft', 'idmg'])
            assert.equal(wound[field], 0, `${key}.${field}`);
    }
    close(aura.totaldmg, 15, 'report totals survive fight reset');
});

test('Classic Deep Wounds retains overwrite behavior and postpones the first tick', () => {
    const fixture = bleedFixtures().find(f => f.mode === 'classic');
    const engine = createReferenceEngine('classic');
    const player = createConfiguredPlayer(engine, fixture);
    player.reset(100);
    engine.evaluate('step = 0');
    const aura = player.auras.deepwounds;
    assert.equal(aura.constructor.name, 'OldDeepWounds');
    aura.use();
    engine.evaluate('step = 1000');
    aura.use(true);
    assert.equal(aura.nexttick, 4000);
    assert.equal(aura.timer, 13000);
    engine.evaluate('step = 3000');
    aura.step();
    assert.equal(aura.idmg, 0);
});
