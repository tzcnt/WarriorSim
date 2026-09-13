'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {extraFixtures} = require('./extra-fixtures');
const {assertNativeReports} = require('./report-assertions');
const {
    createConfiguredPlayer, createReferenceEngine, runReference,
    runPartitioned, loadFixtures,
} = require('./reference-engine');

for (const fixture of extraFixtures()) {
    test(`${fixture.name}: JavaScript reproducibility and partitions`, () => {
        const expected = runReference(fixture);
        assertNativeReports(runReference(fixture), expected, fixture.name);
        const partitions = fixture.sim.iterations === 3 ? [1, 2] : [1, 4, fixture.sim.iterations - 5];
        assertNativeReports(runPartitioned(fixture, partitions), expected, fixture.name);
        assert.ok(expected.totaldmg > 0);
        for (const group of ['spells', 'auras'])
            for (const key of (fixture.mode === 'forever' ? fixture.expect?.[group] : []) || []) {
                const action = expected.player[group][key];
                assert.ok(action && (action.totaldmg > 0 || action.uptime > 0), `${fixture.name}: ${key} is exercised`);
            }
        if (fixture.name.includes('phantom')) assert.ok(expected.player.mh.totalprocdmg > 0);
        for (const [key, duration] of Object.entries({slayer: 20000, spider: 15000, earthstrike: 20000})) {
            if (expected.player.auras[key]) {
                assert.equal(expected.player.auras[key].uptime, duration * fixture.sim.iterations,
                    `${key} must expire after exactly one use per long fight`);
            }
        }
        if (fixture.name === 'classic-long-on-use-orc') {
            assert.equal(expected.player.auras.bloodfury.uptime, 15000 * fixture.sim.iterations);
            assert.equal(expected.player.auras.flask.uptime, 60000 * fixture.sim.iterations);
        }
        if (/bloodrage-(start-schedule|end-schedule|explicit-step)$/.test(fixture.name)) {
            assert.ok(expected.player.auras.bloodrage.uptime > 0);
        }
        if (fixture.name.endsWith('bloodrage-unscheduled')) {
            assert.equal(expected.player.auras.bloodrage.uptime, 0);
        }
        if (fixture.name.endsWith('overpower-stance-switch')) {
            assert.ok(expected.player.spells.overpower.totaldmg > 0);
        }
    });
}

for (const mode of ['classic', 'forever']) {
    test(`${mode}: Overpower requires Battle Stance and returns after the stance cooldown`, () => {
        const fixture = extraFixtures().find(value => value.name === `${mode}-overpower-stance-switch`);
        const player = createConfiguredPlayer(createReferenceEngine(mode), fixture);
        player.reset(100);
        const {overpower, stanceswitch} = player.spells;
        assert.equal(player.stance, 'zerk', 'start in the configured stance');
        assert.equal(player.stancetimer, 0, 'no automatic switch at fight start');
        assert.equal(player.rage, 100, 'starting rage is not lost to a forced switch');
        assert.ok(!player.isValidStance('battle'));
        assert.ok(!overpower.canUse(), 'Overpower needs a dodge');
        player.dodgetimer = 5000;
        player.talents.rageretained = 0;
        assert.ok(!overpower.canUse(), 'switching must retain enough rage to cast');
        player.talents.rageretained = 25;
        assert.equal(overpower.canUse(), true);
        overpower.use();
        assert.equal(player.stance, 'battle');
        assert.equal(player.rage, 25 - overpower.cost);
        assert.equal(player.dodgetimer, 0);
        assert.ok(!stanceswitch.canUse(), 'the stance cooldown gates the return');
        player.stepstancetimer(1000);
        assert.equal(stanceswitch.canUse(), true);
        stanceswitch.use();
        assert.equal(player.stance, 'zerk');
        assert.ok(!player.isValidStance('battle'));
    });
}

test('WoW Forever uses its own talents and differs from the Classic Era baseline', () => {
    for (const fixture of loadFixtures().filter(value => value.mode === 'classic')) {
        assert.notEqual(runReference({...fixture, mode: 'forever'}).totaldmg, runReference(fixture).totaldmg, fixture.name);
    }
});

test('Heroic bonus changes Heroic Strike but leaves Cleave weapon damage unchanged', () => {
    for (const name of ['classic-dw-fury', 'classic-adjacent-cleave']) {
        const fixture = loadFixtures().find(value => value.name === name);
        const player = createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture);
        player.mh.mindmg = player.mh.maxdmg = 100;
        const action = player.spells.heroicstrike || player.spells.cleave;
        player.heroicbonus = false;
        const before = player.mh.dmg(action);
        player.heroicbonus = true;
        const after = player.mh.dmg(action);
        if (name.includes('cleave')) assert.equal(after, before);
        else assert.ok(after > before);
    }
});

test('Classic OldDeepWounds schedules three-second ticks and inactive Flurry starts empty', () => {
    const fixture = loadFixtures()[0];
    const player = createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture);
    assert.equal(player.auras.deepwounds.constructor.name, 'OldDeepWounds');
    player.auras.deepwounds.use();
    assert.equal(player.auras.deepwounds.nexttick, 3000);
    assert.equal(player.auras.flurry.stacks, 0);
});

test('equal action priorities preserve Classic catalog order in both execution phases', () => {
    const fixture = extraFixtures().find(value => value.name === 'classic-stable-action-priorities');
    const player = createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture);
    const links = player.serializeSimulationSpec(fixture.sim).player.links;
    assert.deepEqual(Array.from(links.normalSpells, action => action.key),
        ['whirlwind', 'bloodthirst', 'sunderarmor', 'overpower', 'execute']);
    assert.deepEqual(Array.from(links.executeSpells, action => action.key),
        ['execute', 'whirlwind', 'bloodthirst']);
});

test('zero-chance proc slots still consume RNG before the later proc chain', () => {
    const fixture = extraFixtures().find(value => value.name === 'classic-ordered-multi-procs');
    const withoutZeroSlots = {...fixture, mutatePlayer(player, engine) {
        fixture.mutatePlayer(player, engine);
        delete player.mh.proc2;
        delete player.oh.proc1;
    }};
    assert.notEqual(runReference(fixture).totaldmg, runReference(withoutZeroSlots).totaldmg);
});

test('Hamstring inherits its own cooldown and ignores the main ability cooldown option', () => {
    const fixture = extraFixtures().find(value => value.name === 'classic-hamstring-inherited-eligibility');
    const player = createConfiguredPlayer(createReferenceEngine(fixture.mode), fixture);
    const hamstring = player.spells.hamstring;
    assert.equal(hamstring.maincd, 999000);
    assert.equal(hamstring.cooldown, 4);
    player.rage = 100;
    player.timer = 0;
    player.spells.bloodthirst.timer = 0;
    hamstring.timer = 0;
    assert.equal(hamstring.canUse(), true, 'maincd does not gate destination Hamstring');
    hamstring.timer = 1;
    assert.equal(hamstring.canUse(), false, 'its own cooldown still gates use');
    const action = runReference(fixture).player.spells.hamstring;
    assert.ok(action.totaldmg > 0, 'fixture must deal Hamstring damage');
    assert.ok(action.data.reduce((sum, count) => sum + count, 0) > 0, 'fixture must cast Hamstring');
});
