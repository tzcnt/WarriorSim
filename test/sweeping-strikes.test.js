'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {sweepingFixtures} = require('./wasm/sweeping-fixtures');
const {createReferenceEngine, createConfiguredPlayer, runReference} = require('./wasm/reference-engine');

function setup() {
    const fixture = sweepingFixtures()[0];
    const engine = createReferenceEngine('classic');
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)', {p: player});
    player.reset(100);
    return {fixture, engine, player, aura: player.auras.sweepingstrikes};
}

test('Classic Sweeping Strikes is gated by talent, level and rotation selection', () => {
    const {fixture, engine, aura} = setup();
    assert.equal(aura.id, 12292);
    assert.equal(engine.evaluate('classicTalents[0].t[12].enable'), 12292);
    fixture.talents[0][12] = 0;
    assert.equal(createConfiguredPlayer(engine, fixture).auras.sweepingstrikes, undefined);
    fixture.talents[0][12] = 1;
    fixture.player.level = 29;
    assert.equal(createConfiguredPlayer(engine, fixture).auras.sweepingstrikes, undefined);
    fixture.player.level = 60;
    fixture.rotation[12292].active = false;
    assert.equal(createConfiguredPlayer(engine, fixture).auras.sweepingstrikes, undefined);
});

test('Classic Sweeping Strikes preserves an existing GCD and enforces rage, stance and adjacency', () => {
    const {player, aura} = setup();
    player.timer = 1100;
    player.adjacent = 0;
    assert.equal(aura.canUse(), false);
    player.adjacent = 1;
    player.rage = 29;
    assert.equal(aura.canUse(), false);
    player.rage = 100;
    player.stance = 'zerk';
    assert.equal(aura.canUse(), false);
    player.stance = 'battle';
    assert.equal(aura.canUse(), true);
    aura.use();
    assert.equal(player.timer, 1100);
    assert.equal(player.rage, 70);
    assert.equal(aura.stacks, 5);
    assert.equal(aura.timer, 20000);
    assert.equal(aura.cooldowntimer, 30000);
});

test('Classic Sweeping Strikes copies five landed primary hits, without recursive copies or rage', () => {
    const {engine, player, aura} = setup();
    player.target.armor = player.armorReduction = 0;
    aura.use();
    // A zero-cost melee special isolates Sweeping Strikes from white-hit rage.
    engine.evaluate('hit = result => p.dealdamage(100, result, p.mh, {defenseType: DEFENSETYPE.MELEE, school: SCHOOL.PHYSICAL, cost: 0}, false)');
    engine.evaluate('hit(RESULT.MISS); hit(RESULT.DODGE); p.dealdamage(100, RESULT.HIT, p.mh, null, true)');
    assert.equal(aura.stacks, 5);
    engine.evaluate('for (let i = 0; i < 6; i++) hit(RESULT.HIT)');
    assert.equal(aura.totaldmg, 500);
    assert.equal(player.rage, 70);
    assert.equal(aura.timer, 0);
    assert.equal(aura.stacks, 0);
});

test('Classic Sweeping Strikes expires at 20 seconds, recasts at 30, and resets between fights', () => {
    const {engine, player, aura} = setup();
    aura.use();
    engine.evaluate('step = 19999; p.stepauras()');
    assert.equal(aura.stacks, 5);
    engine.evaluate('step = 20000; p.stepauras(); p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(aura.stacks, 0);
    assert.equal(aura.totaldmg, 0);
    assert.equal(aura.uptime, 20000);
    assert.equal(aura.canUse(), false);
    engine.evaluate('step = 30000');
    assert.equal(aura.canUse(), true);
    aura.use();
    assert.equal(aura.timer, 50000);
    player.reset(100);
    assert.equal(aura.timer, 0);
    assert.equal(aura.stacks, 0);
    assert.equal(aura.cooldowntimer, 0);
    assert.equal(aura.idmg, 0);
});

test('Classic event loop uses Sweeping Strikes during a GCD and accounts for its copied damage', () => {
    const {fixture, engine, player, aura} = setup();
    const casts = [];
    const use = aura.use.bind(aura);
    aura.use = () => { casts.push(player.timer); use(); };
    engine.createSimulation(player, fixture.sim).startSync();
    assert.ok(casts.some(timer => timer > 0), 'activation during another ability\'s GCD is exercised');
    assert.ok(aura.totaldmg > 0);
    assert.ok(casts.length >= fixture.sim.iterations * 2, 'cooldown allows a second activation each fight');
});

test('Classic event loop expires unused charges and never activates without adjacent targets', () => {
    const [,expiry,single] = sweepingFixtures();
    const expired = runReference(expiry).player.auras.sweepingstrikes;
    assert.equal(expired.uptime, expiry.sim.iterations * 20000);
    assert.equal(expired.totaldmg, 0);
    const inactive = runReference(single).player.auras.sweepingstrikes;
    assert.equal(inactive.uptime, 0);
    assert.equal(inactive.totaldmg, 0);
});
