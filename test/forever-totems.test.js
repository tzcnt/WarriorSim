'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

for (const mode of ['classic', 'forever']) {
    test(`${mode}: totem ranks resolve stats and serialized Windfury AP`, () => {
        const engine = createReferenceEngine(mode);
        const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
        createConfiguredPlayer(engine, fixture);
        engine.evaluate('buffs.forEach(b => b.active = false)');
        const baseline = engine.createPlayer({...fixture.player, mode});
        const totems = engine.evaluate('buffs.filter(b => foreverTotemBuffs[b.group])');
        for (const buff of totems) {
            engine.evaluate('buffs.forEach(b => b.active = b.id === id)', {id: buff.id});
            const player = engine.createPlayer({...fixture.player, mode});
            if (buff.group === 'windfury') {
                const expected = mode === 'forever' ? 246 : buff.wfap;
                assert.equal(player.auras.windfury.stats.ap, expected);
                assert.equal(player.oh?.windfury, undefined);
                const spec = player.serializeSimulationSpec(fixture.sim);
                assert.equal(spec.player.auras.find(a => a.kind === 'Windfury').stats.ap, expected);
            } else {
                const stat = buff.group === 'graceair' ? 'agi' : 'str';
                const expected = mode === 'forever' ? (stat === 'agi' ? 77 : 42) : buff[stat];
                assert.equal(player.base[stat] - baseline.base[stat], expected, `${buff.id}: ${stat}`);
            }
            const resolved = engine.evaluate('getBuffForMode(buffs.find(b => b.id === id), mode)');
            if (mode === 'forever') assert.ok(resolved.description.includes(String(resolved.agi || resolved.str || resolved.wfap)));
            else assert.equal(resolved.description, buff.description);
        }
    });
}

test('Forever Windfury rolls 20% on mainhand autoattacks and melee abilities, excluding misses and offhand hits', () => {
    const engine = createReferenceEngine('forever');
    const result = engine.evaluate(`
        const p = Object.create(Player.prototype);
        p.talents = {};
        p.mh = {windfury: {canProc: () => true, use() { p.extraattacks++; }}};
        p.oh = {};
        p.auras = {};
        const cases = [];
        for (const spell of [null, new Bloodthirst(p), new Whirlwind(p), new ShieldSlam(p)]) {
            for (const weapon of [p.mh, p.oh]) {
                for (const outcome of [RESULT.HIT, RESULT.CRIT, RESULT.MISS, RESULT.DODGE]) {
                    for (const roll of [1999, 2000]) {
                        p.extraattacks = 0;
                        rng10k = () => roll;
                        p.procattack(spell, weapon, outcome, false, 0);
                        cases.push({actual: p.extraattacks, expected: weapon === p.mh &&
                            (outcome === RESULT.HIT || outcome === RESULT.CRIT) && roll < 2000 ? 1 : 0});
                    }
                }
            }
        }
        cases;
    `);
    for (const {actual, expected} of result) assert.equal(actual, expected);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Windfury buff charges, duration and proc cooldown`, () => {
    const engine = createReferenceEngine(mode);
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)');
    player.reset(100);
    const wf = player.mh.windfury;
    const at = ms => engine.evaluate('step = ms', {ms});
    const base = player.stats.ap;
    const buffed = () => player.stats.ap - base === wf.stats.ap;
    const duration = mode === 'forever' ? 1000 : 1500;
    const cooldown = mode === 'forever' ? 100 : 0;

    // A white-swing proc spends one charge and its extra attack the other.
    at(1000);
    assert.ok(wf.canProc());
    wf.use();
    assert.equal(player.extraattacks, 1);
    assert.ok(buffed());
    assert.ok(!wf.canProc());
    wf.proc();
    assert.ok(buffed());
    wf.proc();
    wf.step();
    assert.ok(!buffed());
    assert.equal(wf.canProc(), !cooldown);
    at(1000 + cooldown);
    assert.ok(wf.canProc());

    // After an ability proc, the extra attack leaves one charge until the buff expires.
    at(5000);
    wf.use();
    wf.proc();
    at(5000 + duration - 1);
    wf.step();
    assert.ok(buffed());
    assert.ok(!wf.canProc());
    at(5000 + duration);
    wf.step();
    assert.ok(!buffed());
    assert.ok(wf.canProc());
});
