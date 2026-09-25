'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

// Highest-rank reductions: Forever values come from client build 1.60.1.70009.
const EXPECTED = {
    classic: {11597: 2250, 9907: 505, 11717: 640, 11198: 1700},
    forever: {11597: 2250, 9907: 505, 11717: 505, 11198: 0},
};

function armorReductions(mode, activeSets) {
    const engine = createReferenceEngine(mode);
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    createConfiguredPlayer(engine, fixture);
    engine.evaluate('buffs.forEach(b => b.active = false)');
    const player = () => engine.createPlayer({...fixture.player, mode});
    const baseline = player().target.basearmorbuffed;
    return activeSets.map(ids => {
        engine.evaluate('buffs.forEach(b => b.active = ids.includes(b.id))', {ids});
        const p = player();
        return {reduction: baseline - p.target.basearmorbuffed, exposed: !!p.exposed, improvedexposed: !!p.improvedexposed};
    });
}

for (const mode of ['classic', 'forever']) {
    test(`${mode}: highest-rank armor debuffs reduce target armor by the mode's values`, () => {
        const ids = Object.keys(EXPECTED[mode]).map(Number);
        const results = armorReductions(mode, ids.map(id => [id]));
        ids.forEach((id, i) => assert.equal(results[i].reduction, EXPECTED[mode][id], `${id}`));
    });
}

test('Expose Armor and Improved Expose Armor apply in Classic only', () => {
    const [classic] = armorReductions('classic', [[11198, 14169]]);
    assert.deepEqual(classic, {reduction: 1700 * 1.5, exposed: true, improvedexposed: true});
    const [forever] = armorReductions('forever', [[11198, 14169]]);
    assert.deepEqual(forever, {reduction: 0, exposed: false, improvedexposed: false});

    const engine = createReferenceEngine('forever');
    const expose = engine.evaluate('buffs.filter(b => b.name.includes("Expose Armor"))');
    assert.equal(expose.length, 6);
    for (const buff of expose) assert.equal(buff.mode, 'classic', `${buff.id}`);
});

test('Forever Curse of Recklessness describes its own reduction', () => {
    const engine = createReferenceEngine('forever');
    const resolve = mode => engine.evaluate('getBuffForMode(buffs.find(b => b.id === 11717), m)', {m: mode});
    assert.equal(resolve('forever').armor, 505);
    assert.match(resolve('forever').description, /505/);
    assert.equal(resolve('classic').armor, 640);
    assert.equal(resolve('classic').description, undefined);
});
