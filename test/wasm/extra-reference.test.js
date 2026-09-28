'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {extraFixtures} = require('./extra-fixtures');
const {armorProcCases} = require('./ability-proc-fixtures');
const {assertNativeReports} = require('./report-assertions');
const {
    createConfiguredPlayer, createReferenceEngine, runReference,
    runPartitioned, loadFixtures, traceAuraLifecycle,
} = require('./reference-engine');

for (const fixture of armorProcCases) {
    test(`${fixture.name}: armor proc stacks reflect only the current aura`, () => {
        const {events} = traceAuraLifecycle(fixture, [fixture.armorProc.key]);
        const expiresBetweenProcs = fixture.name.endsWith('expiry');
        const procsPerFight = expiresBetweenProcs ? 4 : 9;
        const procs = events.filter(event => event.method === 'use');
        assert.equal(procs.length, procsPerFight * fixture.sim.iterations);
        for (let i = 0; i < procs.length; ++i) {
            assert.equal(procs[i].after.stacks,
                expiresBetweenProcs ? 1 : Math.min(i % procsPerFight + 1, 3));
        }
        const expirations = events.filter(event => event.method === 'step' && !event.after.timer);
        assert.equal(expirations.length, expiresBetweenProcs ? 3 * fixture.sim.iterations : 0);
        for (const event of expirations) assert.equal(event.after.stacks, 0);
    });
}

for (const fixture of armorProcCases.filter(value => value.name.endsWith('expiry'))) {
    test(`${fixture.name}: refreshes all stacks and restores armor at expiration`, () => {
        const engine = createReferenceEngine(fixture.mode);
        const player = createConfiguredPlayer(engine, fixture);
        engine.evaluate('step = 0');
        player.reset(0);
        const aura = player.auras[fixture.armorProc.key];
        const duration = fixture.armorProc.duration * 1000;
        const reduction = fixture.armorProc.armor;
        const armor = player.target.armor;
        for (const time of [0, 3000, 6000, 9000]) {
            engine.evaluate('step = time', {time});
            aura.use();
            assert.equal(aura.stacks, Math.min(time / 3000 + 1, 3));
            assert.equal(aura.timer, time + duration);
            assert.equal(player.target.armor, armor - aura.stacks * reduction);
        }
        const expiration = 9000 + duration;
        engine.evaluate('step = expiration - 1', {expiration});
        player.stepauras();
        assert.equal(aura.stacks, 3);
        assert.equal(player.target.armor, armor - 3 * reduction);
        engine.evaluate('step = expiration');
        player.stepauras();
        assert.equal(aura.timer, 0);
        assert.equal(aura.stacks, 0);
        assert.equal(player.target.armor, armor);
        assert.equal(aura.uptime, expiration);
        engine.evaluate('step = expiration + 1000');
        aura.use();
        assert.equal(aura.stacks, 1);
        assert.equal(player.target.armor, armor - reduction);
    });
}

for (const fixture of extraFixtures()) {
    test(`${fixture.name}: JavaScript reproducibility and partitions`, () => {
        const expected = runReference(fixture);
        if (fixture.name.endsWith('sword-proc-fight-reset')) {
            assert.equal(expected.player.mh.data.reduce((sum, count) => sum + count, 0),
                fixture.sim.iterations * 2, 'each fight gets one opening swing and exactly one sword extra attack');
        }
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
            if (/^classic-long-(slayer-spider|earthstrike)$/.test(fixture.name) && expected.player.auras[key]) {
                assert.equal(expected.player.auras[key].uptime, 2 * duration * fixture.sim.iterations,
                    `${key} must expire and be reused after its 2-minute cooldown in a long fight`);
            }
        }
        if (fixture.name === 'classic-long-on-use-orc') {
            assert.equal(expected.player.auras.bloodfury.uptime, 2 * 15000 * fixture.sim.iterations);
            assert.equal(expected.player.auras.flask.uptime, 60000 * fixture.sim.iterations,
                'the 6-minute Diamond Flask cooldown allows one use');
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

function traceCasts(fixture, keys) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    const casts = Object.fromEntries(keys.map(key => [key, []]));
    for (const key of keys) {
        const action = player.spells[key] || player.auras[key];
        const use = action.use;
        action.use = function(...args) {
            casts[key].push(engine.evaluate('step'));
            return use.apply(this, args);
        };
    }
    engine.createSimulation(player, fixture.sim).startSync();
    return casts;
}

// Cooldown, scheduled final use, and how late that final use may start in 300 second
// fights. Off-GCD uses, including Forever's Blood Fury and Berserking, wait only for
// reaction time. Classic Blood Fury can also wait for the GCD, and Death Wish for the
// GCD and 10 rage, for example while Execute spends it. Kiss of the Spider takes the
// last 15 seconds, so Slayer's Crest is scheduled to end first.
const endSchedules = {
    'classic-long-end-schedule': {
        slayer: [120000, 265000, 1000],
        spider: [120000, 285000, 1000],
        bloodfury: [120000, 282000, 2000],
        mightyragepotion: [120000, 279000, 1000],
        bloodrage: [60000, 265000, 1000],
        deathwish: [180000, 269000, 5000],
    },
    'forever-racial-night-elf-end-schedule': {eluneslight: [180000, 269000, 1000], deathwish: [180000, 269000, 5000]},
    'forever-racial-gnome-end-schedule': {eureka: [120000, 290000, 1000], deathwish: [180000, 269000, 5000]},
    'forever-racial-orc-end-schedule': {bloodfury: [120000, 282000, 1000], deathwish: [180000, 269000, 5000]},
    'forever-racial-troll-end-schedule': {berserking: [180000, 287000, 1000], deathwish: [180000, 269000, 5000]},
};

for (const [name, schedules] of Object.entries(endSchedules)) test(`${name}: end-of-fight schedules count back whole cooldowns to the earliest first use`, () => {
    const fixture = extraFixtures().find(value => value.name === name);
    const casts = traceCasts(fixture, Object.keys(schedules));
    for (const [key, [cooldown, last, late]] of Object.entries(schedules)) {
        const uses = Math.floor(last / (cooldown + 2000)) + 1;
        const first = last % (cooldown + 2000);
        assert.equal(casts[key].length, uses * fixture.sim.iterations, key);
        for (let i = 0; i < casts[key].length; i += uses) {
            assert.ok(casts[key][i] >= first && casts[key][i] < first + 2000, `${key} first use at ${casts[key][i]}`);
            for (let j = i + 1; j < i + uses; ++j)
                assert.ok(casts[key][j] - casts[key][j - 1] >= cooldown, `${key} is reused on cooldown`);
            // Delays in earlier uses must not leave it on cooldown at the scheduled final use.
            assert.ok(casts[key][i + uses - 2] + cooldown <= last, `${key} is ready for its final use`);
            assert.ok(casts[key][i + uses - 1] >= last && casts[key][i + uses - 1] < last + late,
                `${key} final use at ${casts[key][i + uses - 1]}`);
        }
    }
});

function traceFights(fixture, actions) {
    const engine = createReferenceEngine(fixture.mode);
    const player = createConfiguredPlayer(engine, fixture);
    const fights = [];
    const reset = player.reset;
    player.reset = function(...args) {
        fights.push([]);
        return reset.apply(this, args);
    };
    for (const [action, name] of actions(player)) {
        const use = action.use;
        action.use = function(...args) {
            fights[fights.length - 1].push([engine.evaluate('step'), name]);
            return use.apply(this, args);
        };
    }
    engine.createSimulation(player, fixture.sim).startSync();
    return fights;
}

for (const name of Object.keys(endSchedules).filter(value => endSchedules[value].deathwish)) {
    test(`${name}: once Death Wish is due, no other GCD ability goes before it`, () => {
        const [cooldown, last] = endSchedules[name].deathwish;
        const first = last % (cooldown + 2000);
        // Slam's traced use is its cast completion, which can follow a cast started earlier.
        const fights = traceFights(extraFixtures().find(value => value.name === name), player => [
            [player.auras.deathwish, 'deathwish'],
            ...[...new Set([...player.normalspells, ...player.executespells])]
                .filter(action => action.constructor.name !== 'Slam').map(action => [action, action.name]),
        ]);
        for (const events of fights) {
            const casts = events.filter(([, action]) => action === 'deathwish').map(([time]) => time);
            assert.equal(casts.length, 2);
            for (const [due, cast] of [[first, casts[0]], [last, casts[1]]]) {
                const before = events.filter(([time, action]) => action !== 'deathwish' && time >= due && time < cast);
                assert.deepEqual(before, [], `Death Wish due at ${due} and cast at ${cast}`);
            }
        }
    });
}

test('start-of-fight schedules reuse items as soon as their cooldowns end', () => {
    const fixture = extraFixtures().find(value => value.name === 'classic-long-grilek-swarmguard');
    const casts = traceCasts(fixture, ['grilekfury', 'swarmguard']);
    for (const key of ['grilekfury', 'swarmguard']) {
        assert.equal(casts[key].length, 2 * fixture.sim.iterations, key);
        for (let i = 0; i < casts[key].length; i += 2) {
            assert.ok(casts[key][i] < 1000, `${key} first use at ${casts[key][i]}`);
            assert.ok(casts[key][i + 1] - casts[key][i] >= 180000 && casts[key][i + 1] - casts[key][i] < 181000,
                `${key} reused ${casts[key][i + 1] - casts[key][i]} ms later`);
        }
    }
});

test('end-of-fight schedules count back with 2 seconds of slop and hold the final use', () => {
    const engine = createReferenceEngine('classic');
    const schedule = (duration, timetoend, cooldown) => ({...engine.evaluate(
        '(() => { const action = {cooldown}; scheduleBeforeEnd(action, duration - timetoend); return action; })()',
        {duration, timetoend, cooldown})});
    const nextUse = (action, ready) => engine.evaluate('nextUseStep(action, ready)', {action, ready});
    // 2:30 with a 2 minute cooldown, 15 seconds before the end: once near the start.
    assert.deepEqual(schedule(150000, 15000, 120), {cooldown: 120, endstep: 135000, usestep: 13000});
    // 5:00: first used 4:19 before the end. The second use is ready as soon as the
    // cooldown ends; the third waits for 4:45 because no later use could fit before it.
    const action = schedule(300000, 15000, 120);
    assert.equal(300000 - action.usestep, 259000);
    assert.equal(nextUse(action, 161000), 161000);
    assert.equal(nextUse(action, 281000), 285000);
    // A late use and uses after the scheduled time are not held.
    assert.equal(nextUse(action, 286000), 286000);
    // Without a cooldown, or with a schedule before the pull, it is used once at that time.
    assert.deepEqual(schedule(300000, 15000, 0), {cooldown: 0, endstep: 285000, usestep: 285000});
    assert.deepEqual(schedule(10000, 15000, 120), {cooldown: 120, endstep: 0, usestep: 0});
    // Start-of-fight schedules have no end time to hold for.
    assert.equal(nextUse({cooldown: 120}, 125000), 125000);
});

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

for (const mode of ['classic', 'forever']) {
    test(`${mode}: Imperial Plate grants its Classic four-piece DPS bonus`, () => {
        const fixture = loadFixtures().find(value => value.mode === mode);
        const player = createConfiguredPlayer(createReferenceEngine(mode), fixture);
        player.items = [12424, 12426, 12425];
        player.base = {ap: 0, hit: 0, str: 0};
        player.addSets();
        assert.deepEqual(player.base, {ap: 0, hit: 0, str: 0});
        player.items.push(12422);
        player.addSets();
        assert.deepEqual(player.base, {ap: 28, hit: 0, str: 0});
    });
}
