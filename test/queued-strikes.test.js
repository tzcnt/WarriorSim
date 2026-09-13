'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const {createReferenceEngine, createConfiguredPlayer, runReference} = require('./wasm/reference-engine');
const {queuedStrikeFixtures} = require('./wasm/queued-strike-fixtures');

for (const fixture of queuedStrikeFixtures()) {
    const mode = fixture.mode;
    const key = fixture.name.includes('heroicstrike') ? 'heroicstrike' : 'cleave';
    function setup() {
        const engine = createReferenceEngine(mode);
        const player = createConfiguredPlayer(engine, fixture);
        engine.evaluate('step = 0; setSimulationSeed(123)', {p: player});
        player.reset(100);
        return {engine, player, strike: player.spells[key]};
    }

    test(`${mode} ${key}: queued off-hand miss chance follows the game mode`, () => {
        const {engine, player, strike} = setup();
        for (const miss of [0, 5]) {
            Object.assign(player.oh, {miss, dwmiss: 24, dodge: 5, glanceChance: 40, crit: 0});
            player.crit = 20;
            const outcomes = () => Array.from(engine.evaluate(`(() => {
                const counts = [0, 0, 0, 0, 0];
                for (let roll = 0; roll < 10000; roll++) {
                    rng10k = () => roll;
                    counts[p.rollweapon(p.oh)]++;
                }
                return counts;
            })()`));
            player.nextswinghs = false;
            const normal = outcomes();
            strike.use();
            const queued = outcomes();
            const missIndex = engine.evaluate('RESULT.MISS');
            assert.equal(normal[missIndex], 2400);
            assert.equal(queued[missIndex], mode === 'forever' ? 2400 : miss * 100);
            if (mode === 'forever') assert.deepEqual(queued, normal, 'the entire off-hand table is unchanged');
        }
    });

    test(`${mode} ${key}: saved queue tricks and the pre-swing eligibility window`, () => {
        const {player, strike} = setup();
        player.mh.timer = 1;
        assert.equal(strike.canUse(), mode === 'forever');
        assert.equal(strike.unqueue, mode === 'forever' ? undefined : 1000);
        assert.equal(strike.exmacro, mode === 'forever' ? undefined : true);
        if (key === 'cleave') assert.equal(Boolean(strike.backupheroic), mode === 'classic');
        const serialized = player.serializeSimulationSpec(fixture.sim).player.spells.find(spell => spell.key === key);
        assert.equal(serialized.props.unqueue, strike.unqueue);
        assert.equal(serialized.props.exmacro, strike.exmacro);
    });

    test(`${mode} ${key}: a normal queued strike lands and pays rage on the main-hand swing`, () => {
        const {engine, player, strike} = setup();
        engine.evaluate('p.procattack = () => 0; p.rollmeleespell = () => RESULT.HIT;');
        strike.use();
        assert.equal(player.rage, 100, 'queueing itself costs no rage');
        player.attackmh(player.mh);
        assert.equal(player.rage, 100 - strike.cost);
        assert.equal(player.nextswinghs, false);
        assert.ok(strike.totaldmg > 0);
        assert.equal(strike.data[engine.evaluate('RESULT.HIT')], 1);
    });

    test(`${mode} ${key}: Execute only uses the queue macro in Classic`, () => {
        const {engine, player, strike} = setup();
        player.stance = 'zerk';
        player.mh.timer = 2000;
        engine.evaluate('new Execute(p, 20662).use(p.spells[key])', {key});
        assert.equal(player.nextswinghs, mode === 'classic');
        if (key === 'cleave') {
            player.reset(strike.cost - 1);
            player.stance = 'zerk';
            player.mh.timer = 2000;
            engine.evaluate('new Execute(p, 20662).use(p.spells.cleave)');
            assert.equal(player.nextswinghs, mode === 'classic', 'the hidden backup Heroic Strike follows the same rule');
        }
    });

    test(`${mode} ${key}: the combat loop only cancels queued strikes in Classic`, () => {
        const report = runReference(fixture);
        const strikes = report.player.spells[key].data.reduce((sum, count) => sum + count, 0);
        assert.ok(mode === 'forever' ? strikes > 0 : strikes === 0);
        assert.ok(report.player.oh.totaldmg > 0);
    });
}

for (const mode of ['classic', 'forever']) test(`${mode}: rotation details expose queue tricks only in Classic`, () => {
    const engine = createReferenceEngine(mode);
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const rows = [];
    const element = {
        find() { return this; }, data() { return this; }, empty() { return this; },
        append(value) { if (typeof value === 'string') rows.push(value); return this; },
        css() { return this; }, height() { return 0; },
    };
    engine.evaluate('$ = () => element; setTimeout = () => {}; SIM.SETTINGS.rotation = element;', {element});
    for (const id of [25286, 20569]) {
        rows.length = 0;
        engine.evaluate('SIM.SETTINGS.buildSpellDetails(spells.find(spell => spell.id === id), element)', {id});
        const html = rows.join('');
        assert.equal(html.includes('data-id="unqueueactive"'), mode === 'classic');
        assert.equal(html.includes('data-id="exmacro"'), mode === 'classic');
        assert.ok(html.includes('data-id="minrageactive"'), 'normal rage-based queueing remains available');
    }
});
