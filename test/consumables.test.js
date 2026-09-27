'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');
const {frenzyFixtures} = require('./wasm/frenzy-fixtures');
const {NATURAL_FLASKS} = require('./wasm/flask-fixtures');

// Elixir of the Grizzly, Elixir of Ferocity and the Natural flasks.
const FOREVER_BUFFS = [250351, 250350, ...Object.values(NATURAL_FLASKS)];
const MAJOR_FRENZY = 1251940;

test('classic: Forever-only consumables are unavailable and stale selections are ignored', () => {
    const engine = createReferenceEngine('classic');
    const modes = engine.evaluate(`[...buffs.filter(b => ids.includes(b.id)), spells.find(s => s.id === potion)]
        .map(entry => entry.mode)`, {ids: FOREVER_BUFFS, potion: MAJOR_FRENZY});
    assert.deepEqual([...modes], Array(FOREVER_BUFFS.length + 1).fill('forever'));

    const fixture = structuredClone(loadFixtures().find(f => f.mode === 'classic'));
    fixture.buffs = [];
    delete fixture.buffsAdd;
    const baseline = createConfiguredPlayer(engine, fixture);
    fixture.buffs = FOREVER_BUFFS;
    fixture.rotation = {[MAJOR_FRENZY]: {active: true, timetostartactive: true, timetostart: 0}};
    const stale = createConfiguredPlayer(engine, fixture);
    assert.equal(JSON.stringify(stale.base), JSON.stringify(baseline.base));
    assert.equal(JSON.stringify(stale.target), JSON.stringify(baseline.target));
    assert.equal(stale.auras.majorfrenzypotion, undefined);
});

test('forever: new consumables apply stats and follow their neighboring elixirs', () => {
    const engine = createReferenceEngine('forever');
    for (const [id, previous, stats] of [
        [250351, 'Elixir of the Mongoose', {str: 25, crit: 2}],
        [250350, 'Elixir of Giants', {str: 18, agi: 18}],
    ]) {
        assert.equal(engine.evaluate('buffs[buffs.findIndex(b => b.id === id) - 1].name', {id}), previous);
        const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        fixture.buffs = [];
        delete fixture.buffsAdd;
        const baseline = createConfiguredPlayer(engine, fixture);
        fixture.buffs = [id];
        const buffed = createConfiguredPlayer(engine, fixture);
        for (const [stat, amount] of Object.entries(stats))
            assert.equal(buffed.base[stat] - baseline.base[stat], amount);
    }
    const potion = engine.evaluate('spells.find(s => s.classname === "MajorFrenzyPotion")');
    assert.equal(engine.evaluate('spells[spells.findIndex(s => s.classname === "MajorFrenzyPotion") - 1].classname'), 'MightyRagePotion');
    assert.equal(potion.active, false);
    assert.equal(potion.timetostartactive, false);
    assert.equal(potion.timetoendactive, false);
    assert.equal(potion.timetostart, 0);
    assert.equal(potion.timetoend, 31);
});

test('forever: saved selections that use the old name-style consumable IDs still apply', () => {
    const engine = createReferenceEngine('forever');
    const load = (buffs, potion, timetostart) => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        fixture.buffs = buffs;
        delete fixture.buffsAdd;
        fixture.rotation = {[potion]: {active: true, timetostartactive: true, timetostart}};
        return createConfiguredPlayer(engine, fixture);
    };
    // The potion is disabled by default, so its aura only exists if the old entry was applied.
    const legacy = load(['elixir-of-the-grizzly', 'elixir-of-ferocity'], 'major-frenzy-potion', 9);
    assert.ok(legacy.auras.majorfrenzypotion);
    const potion = engine.evaluate('spells.find(s => s.classname === "MajorFrenzyPotion")');
    assert.equal(potion.id, MAJOR_FRENZY);
    assert.equal(potion.timetostart, 9);
    const current = load([250351, 250350], MAJOR_FRENZY, 0);
    assert.equal(JSON.stringify(legacy.base), JSON.stringify(current.base));
});

test('forever: Natural flasks follow the other flasks and grant 60 Stamina plus their zone bonus', () => {
    const engine = createReferenceEngine('forever');
    const ids = Object.values(NATURAL_FLASKS);
    const catalog = engine.evaluate('buffs.slice(buffs.findIndex(b => b.name === "Flask of Chromatic Resistance") + 1).slice(0, count)',
        {count: ids.length});
    assert.deepEqual(Array.from(catalog, buff => buff.id), ids);
    for (const buff of catalog) {
        assert.equal(buff.mode, 'forever');
        assert.equal(buff.group, 'flask');
        assert.equal(buff.minlevel, 55);
        assert.equal(buff.consume, true);
    }

    const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
    fixture.buffs = [];
    delete fixture.buffsAdd;
    const baseline = createConfiguredPlayer(engine, fixture);
    const withFlask = id => {
        fixture.buffs = [String(id)];
        const player = createConfiguredPlayer(engine, fixture);
        assert.equal(player.base.sta - baseline.base.sta, 60);
        assert.equal(player.maxhealth - baseline.maxhealth, 600);
        return player;
    };

    const swiftness = withFlask(NATURAL_FLASKS.swiftness);
    assert.equal(swiftness.stats.haste, baseline.stats.haste * 1.05);

    const aggression = withFlask(NATURAL_FLASKS.aggression);
    assert.equal(aggression.base.crit - baseline.base.crit, 4);
    assert.equal(aggression.base.spellcrit - baseline.base.spellcrit, 4);

    // Hit applies to melee and to spell procs, like Forever's Precision talent.
    const accuracy = withFlask(NATURAL_FLASKS.accuracy);
    assert.equal(accuracy.base.hit - baseline.base.hit, 5);
    assert.equal(baseline.target.misschance - accuracy.target.misschance, 500);
    assert.ok(accuracy.target.binaryresist < baseline.target.binaryresist);

    const precision = withFlask(NATURAL_FLASKS.precision);
    assert.equal(baseline.mh.dodge, 6.5);
    assert.equal(precision.mh.dodge, 1.5);
    assert.equal(precision.oh.dodge, 1.5);
    assert.equal(precision.serializeSimulationSpec(fixture.sim).player.target.dodge, 5);
});

test('forever: Major Frenzy grants 40 AP for 30 seconds and recharges from use time', () => {
    const engine = createReferenceEngine('forever');
    const fixture = frenzyFixtures().find(f => f.mode === 'forever');
    fixture.buffs = [];
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)');
    player.reset(0);
    const aura = player.auras.majorfrenzypotion;
    aura.prep(280000, 0);
    const ap = player.stats.ap;
    aura.use();
    assert.equal(player.stats.ap, ap + 40);
    assert.equal(player.timer, 0);
    assert.equal(aura.canUse(), false);
    engine.evaluate('step = 29999');
    player.stepauras();
    assert.equal(player.stats.ap, ap + 40);
    engine.evaluate('step = 30000');
    player.stepauras();
    assert.equal(player.stats.ap, ap);
    assert.equal(aura.uptime, 30000);
    engine.evaluate('step = 119999');
    assert.equal(aura.canUse(), false);
    engine.evaluate('step = 120000');
    assert.equal(aura.canUse(), true);
    aura.use();
    assert.equal(player.stats.ap, ap + 40);
});

for (const fixture of frenzyFixtures()) {
    test(`${fixture.name}: scheduling and repeat uses reset between fights`, () => {
        const engine = createReferenceEngine(fixture.mode);
        const player = createConfiguredPlayer(engine, fixture);
        const aura = player.auras.majorfrenzypotion;
        const casts = [];
        const use = aura.use;
        aura.use = function(...args) {
            casts.push(engine.evaluate('step'));
            return use.apply(this, args);
        };
        engine.createSimulation(player, fixture.sim).startSync();
        const fromEnd = fixture.rotation[MAJOR_FRENZY].timetoendactive;
        // Either schedule fits three uses in 280 seconds. From the end, the first use
        // counts back two cooldowns plus 2 seconds of slop each: 249 - 2 * 122 = 5.
        assert.equal(casts.length, 3 * fixture.sim.iterations);
        const earliest = fromEnd ? 5000 : 0;
        for (let i = 0; i < casts.length; i += 3) {
            assert.ok(casts[i] >= earliest && casts[i] < earliest + 1000);
            assert.ok(casts[i + 1] - casts[i] >= 120000);
            assert.ok(casts[i + 2] - casts[i + 1] >= 120000);
            if (fromEnd) assert.ok(casts[i + 2] >= 249000 && casts[i + 2] < 250000, 'the last use waits for its end-of-fight schedule');
        }
    });
}
