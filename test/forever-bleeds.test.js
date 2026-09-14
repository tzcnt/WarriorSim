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
    // Ensure Rend lands, while preserving its real application and damage snapshot.
    player.mh.miss = player.mh.dodge = 0;
    const aura = player.auras[key];
    aura.use();
    const tickDamage = key === 'rend' ? aura.tickdmg :
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
                    const crit = fixture.mode === 'forever' && (chance === 100 || (chance === 30 && i < 2));
                    expected += tickDamage * (crit ? 2 + player.talents.abilitiescrit : 1);
                    close(aura.idmg, expected);
                    close(aura.totaldmg, expected);
                    assert.equal(aura.nexttick, (i + 2) * 3000);
                    assert.equal(aura.timer, i === 3 && key !== 'rend' ? 0 : expiration);
                }
                assert.equal(rolls.length, fixture.mode === 'forever' ? 0 : 4,
                    'Classic bleed ticks must not consume RNG');
                if (key === 'rend') {
                    assert.equal(aura.tickdmg, tickDamage, 'crits must not multiply the saved base damage');
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
    test(`Forever ${key} uses current crit chance on each tick, including overdue ticks`, () => {
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
        close(aura.idmg, tickDamage * 3.2);
        player.crit = 50;
        engine.evaluate('step = 12000');
        aura.step();
        close(aura.idmg, tickDamage * 6.4);
        assert.equal(rolls.length, 0);
    });
}
