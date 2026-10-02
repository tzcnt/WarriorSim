'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {berserkerRageFixtures} = require('./wasm/berserker-rage-fixtures');
const {createReferenceEngine, createConfiguredPlayer} = require('./wasm/reference-engine');

function setup(fixture) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)', {p: player});
    player.reset(40);
    return {engine, player, spell: player.spells.berserkerrage};
}

for (const mode of ['classic', 'forever']) {
    const fixture = berserkerRageFixtures().find(f => f.mode === mode);

    test(`${mode}: Berserker Rage generates rage without starting or resetting the GCD`, () => {
        const {player, spell} = setup(fixture);
        for (const gcd of [0, 1100]) {
            player.reset(40);
            player.timer = gcd;
            assert.equal(spell.canUse(), true);
            spell.use();
            assert.equal(player.timer, gcd);
            assert.equal(player.rage, 50);
            assert.equal(spell.timer, 30000);
            assert.equal(player.auras.berserkerrage.timer, 10000);
            assert.equal(spell.canUse(), false);
            spell.step(29999);
            assert.equal(spell.canUse(), false);
            spell.step(1);
            assert.equal(spell.canUse(), true);
        }
        player.reset(player.ragecap - 1);
        spell.use();
        assert.equal(player.rage, player.ragecap);
    });

    test(`${mode}: Berserker Rage respects stance cooldowns and applies its threshold only when switching`, () => {
        const {player, spell} = setup(fixture);
        player.timer = 1100;
        player.stancetimer = 1000;
        assert.equal(spell.canUse(), true, 'already in Berserker Stance, above the threshold');
        player.switch('battle');
        player.rage = 25;
        assert.equal(spell.canUse(), false, 'cannot switch again during the stance cooldown');
        player.stepstancetimer(1000);
        player.rage = 26;
        assert.equal(spell.canUse(), false, 'above the configured switching threshold');
        player.rage = 25;
        assert.equal(spell.canUse(), true);
        spell.use();
        assert.equal(player.stance, 'zerk');
        assert.equal(player.stancetimer, 1000);
        assert.equal(player.timer, 1100);
        assert.equal(player.rage, Math.min(25, player.talents.rageretained) + 10);

        player.reset(0);
        player.stance = 'battle';
        spell.maxrage = 0;
        assert.equal(spell.canUse(), true);
        player.rage = 1;
        assert.equal(spell.canUse(), false, 'zero is a valid threshold, not an unchecked toggle');
        delete spell.maxrage;
        assert.equal(spell.canUse(), true, 'unchecked toggle permits switching at any rage');
    });
}

for (const fixture of berserkerRageFixtures()) {
    test(`${fixture.name}: rotation uses Berserker Rage during the GCD and honors Bloodrage priority`, () => {
        const {engine, player} = setup(fixture);
        const fights = [];
        const reset = player.reset;
        player.reset = function(...args) {
            fights.push([]);
            return reset.apply(this, args);
        };
        for (const key of ['berserkerrage', 'bloodrage']) {
            const spell = player.spells[key];
            const use = spell.use;
            spell.use = function(...args) {
                fights[fights.length - 1].push({key, step: engine.evaluate('step'), gcd: player.timer});
                return use.apply(this, args);
            };
        }
        engine.createSimulation(player, fixture.sim).startSync();
        assert.equal(fights.length, fixture.sim.iterations);
        const priority = fixture.rotation[18499].zerkerpriority;
        // Whether a reuse lands inside another ability's GCD varies by fight, so check them all.
        let duringGcd = 0;
        for (const casts of fights) {
            assert.deepEqual(casts.slice(0, 2).map(c => c.key), priority
                ? ['berserkerrage', 'bloodrage'] : ['bloodrage', 'berserkerrage']);
            const berserker = casts.filter(c => c.key === 'berserkerrage');
            assert.equal(berserker.length, 3);
            duringGcd += berserker.filter(c => c.gcd > 0).length;
            for (let i = 1; i < berserker.length; ++i)
                assert.ok(berserker[i].step - berserker[i - 1].step >= 30000);
        }
        assert.ok(duringGcd > 0, 'must cast while another ability’s GCD is running');
    });
}
