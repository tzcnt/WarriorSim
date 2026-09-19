'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

function setup(mode = 'forever') {
    const engine = createReferenceEngine(mode);
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)', {p: player});
    return {engine, player, fixture, run: source => engine.evaluate(source)};
}
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('all Forever ranks resolve finite values, with client values and neutral removed effects', () => {
    const {run, player} = setup();
    assert.equal(run('talents === talentsForever'), true);
    assert.deepEqual(JSON.parse(run('JSON.stringify(talents.map(t => t.t.length))')), [17,18,18]);
    assert.equal(run('talents.flatMap(tree => tree.t).every(t => Array.from({length: t.m + 1}, (_, r) => Object.values(t.aura(r)).every(Number.isFinite)).every(Boolean))'), true);
    assert.equal(run('talents[0].t[13].aura(5).axecrit'), 5);
    close(run('talents[0].t[13].aura(5).weaponmasterarp'), .15);
    assert.match(run('talents[0].t[13].d[4]'), /ignore\s+15%/);
    assert.match(run('talents[1].t[15].d[1]'), /generate 10 Rage/);
    assert.equal(run('talents[0].t[4].aura(0).rageretained'), 10);
    assert.equal(run('talents[0].t[4].aura(5).rageretained'), 25);
    assert.equal(player.talents.onemod, 0);
    assert.equal(player.talents.impbattleshout, 0);
    assert.equal(run('talents[0].t[2].aura(0).rendmod'), 0);
});

test('Forever default build is legal; prerequisites and lower-row requirements are enforced', () => {
    const {run} = setup();
    assert.equal(run('validTalentBuild(talents, talents.map(t => t.t.map(x => x.c)), 60)'), true);
    assert.equal(run('validTalentBuild(talents, talents.map(t => t.t.map(x => x.c)), 59)'), false);
    assert.equal(run(`(() => { const r = talents.map(t => t.t.map(x => x.c)); r[0][2] = 2; return validTalentBuild(talents, r); })()`), false);
    assert.equal(run(`(() => { const r = talents.map(t => t.t.map(() => 0)); r[0][0] = 3; r[0][1] = 5; r[0][2] = 3; r[0][4] = 4; r[0][10] = 2; return validTalentBuild(talents, r); })()`), true,
        'Impale no longer requires Deep Wounds');
});

test('legacy positional builds migrate by name, refund replacements, and round-trip by key', () => {
    const {run} = setup();
    const result = JSON.parse(run(`JSON.stringify((() => {
        const old = classicTalents.map(tree => ({t: tree.t.map(() => 0)}));
        old[0].t[0] = 3; old[0].t[1] = 5; old[0].t[2] = 3; old[0].t[4] = 5; old[0].t[6] = 2;
        old[0].t[11] = 5; // removed Axe Specialization must not become Bloodthrill
        const migrated = normalizeForeverTalents(old);
        return {migrated, again: normalizeForeverTalents(migrated, FOREVER_TALENT_SCHEMA)};
    })())`));
    assert.deepEqual(result.migrated, result.again);
    assert.equal(result.migrated[0].t[5], 2, 'Overpower moved to its new index');
    assert.equal(result.migrated[0].t[11], 0, 'no points silently assigned to Bloodthrill');
});

test('unlearned active talents cannot be injected through saved rotation settings', () => {
    const {engine, fixture} = setup();
    fixture.talents = [Array(17).fill(0), Array(18).fill(0), Array(18).fill(0)];
    fixture.talentSchema = 'forever-v2';
    fixture.rotation = {23894: {active: true}, 27580: {active: true}, 23925: {active: true},
        'forever:spearing-strike': {active: true}, 'forever:sweeping-strikes': {active: true}};
    const p = createConfiguredPlayer(engine, fixture);
    for (const key of ['bloodthirst','mortalstrike','shieldslam','spearingstrike']) assert.equal(p.spells[key], undefined);
    assert.equal(p.auras.sweepingstrikes, undefined);
});

test('confirmed level-60 ability damage values match in both modes', () => {
    const {run, player} = setup();
    player.stats.ap = 1000; player.stats.block = 100; player.stats.dmgmod = 1;
    for (const [level, bonus, shieldBase] of [[40,30,230],[48,37,270],[54,43,310],[60,48,430]]) {
        player.level = level;
        close(run('new Bloodthirst(p, 23894).dmg()'), 350 + bonus);
        close(run(`rng = (min, max) => (min + max) / 2; new ShieldSlam(p, ${[40,48,54,60].indexOf(level) + 23922}).dmg()`), shieldBase + 100);
    }
    assert.equal(run('new Slam(p, 11605).value1'), 87);
    assert.equal(run('new HeroicStrike(p, 11567).bonus'), 138);
    assert.equal(run('new Overpower(p, 11585).value1'), 35);
    assert.equal(run('new MortalStrike(p, 27580).value1'), 160);
    close(run('(() => { const spell = new Execute(p, 20662); spell.usedrage = 10; return spell.dmg(); })()'), 750);
    const classic = setup('classic');
    classic.player.stats.ap = 1000; classic.player.stats.block = 100;
    classic.player.stats.dmgmod = 1;
    close(classic.run('new Bloodthirst(p, 23894).dmg()'), 450);
    assert.equal(classic.run('new Slam(p, 11605).value1'), 87);
    assert.equal(classic.run('new HeroicStrike(p, 11567).bonus'), 138);
    assert.equal(classic.run('new Overpower(p, 11585).value1'), 35);
    assert.equal(classic.run('new MortalStrike(p, 27580).value1'), 160);
    close(classic.run('(() => { const spell = new Execute(p, 20662); spell.usedrage = 10; return spell.dmg(); })()'), 750);
    close(classic.run('rng = (a,b) => (a+b)/2; new ShieldSlam(p,23925).dmg()'), 350 + 200 + 150);
});

test('Cleave cost stacks both talents and Focused Rage without retaining Classic bonus damage', () => {
    const {run, player} = setup();
    player.ragecostbonus = 3;
    player.talents.cleavecost = 3; player.talents.ragingblows = 1;
    const cleave = run('new Cleave(p, 20569)');
    assert.equal(cleave.cost, 12);
    assert.equal(cleave.bonus, cleave.value1);
    player.talents.executecost = 5;
    assert.equal(run('new Execute(p, 20662).cost'), 7);
});

test('Improved Bloodrage scales the initial gain and all ten fractional ticks', () => {
    const {run, player} = setup();
    player.reset(0);
    player.talents.bloodragemod = .25;
    run('p.auras.bloodrage = new BloodrageAura(p); new Bloodrage(p,2687).use()');
    close(player.rage, 12.5);
    for (let i = 1; i <= 10; i++) run(`step = ${i * 1000}; p.auras.bloodrage.step()`);
    close(player.rage, 25);
    assert.equal(player.auras.bloodrage.timer, 0);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Battle Shout refreshes still cost rage and a GCD with a queued strike`, () => {
    const {run, player} = setup(mode);
    player.reset(50);
    run('p.auras.battleshout = new BattleShout(p, 11551); p.auras.battleshout.use(true)');
    assert.equal(player.rage, 50);
    assert.equal(player.timer, 0);
    run('p.cast(p.auras.battleshout, new HeroicStrike(p, 11567))');
    assert.equal(player.rage, 50 - player.auras.battleshout.cost);
    assert.equal(player.timer, 1500);
});

test('all active rage generators respect the raised cap, including refunds and reset', () => {
    const {run, player} = setup();
    // This test invokes Berserker Rage even when the default rotation disables it.
    run('p.auras.berserkerrage = new BerserkerRageAura(p)');
    player.ragecap = 130;
    for (const expression of ['new Bloodrage(p,2687)', 'new BerserkerRage(p,18499)',
        'new RagePotion(p,6613)', 'new GrilekFury(p,0)']) {
        player.reset(129);
        run(`constAction = ${expression}; constAction.rage = 20; constAction.value1 = constAction.value2 = 20; p.stance = 'zerk'; constAction.use()`);
        assert.equal(player.rage, 130, expression);
    }
    player.reset(200);
    assert.equal(player.rage, 130);
    player.rage = 129;
    run('p.addRage(0, RESULT.MISS, p.mh, {cost: 10, refund: true})');
    assert.equal(player.rage, 130);
});

test('two-handed Unbridled Wrath and off-hand swing rage do not multiply flat procs', () => {
    const {run, player} = setup();
    player.reset(0); player.ragecap = 1000; player.talents.umbridledwrath = 100;
    run('rng10k = () => 0; p.mh.twohand = true; p.addRage(0, RESULT.HIT, p.mh, null)');
    close(player.rage, 2 + player.mh.speed * 4.5);
    player.rage = 0;
    const swingRage = player.oh.speed * 3.46 * 0.5;
    run('p.addRage(100, RESULT.HIT, p.oh, null)');
    close(player.rage, 1 + swingRage * 2);
});

test('Forever white-hit rage uses base speed and weapon type regardless of damage, haste or hit quality', () => {
    const {run, player} = setup();
    player.talents.umbridledwrath = 0;
    player.stats.haste = 2;
    player.ragecap = 1000;
    for (const [hand, twohand, speed, expected] of [
        ['mh', true, 3.6, 16.2], ['mh', false, 2, 6.92], ['oh', false, 2, 3.46],
    ]) {
        Object.assign(player[hand], {twohand, speed});
        for (const rank of [0, 3, 5]) {
            player.talents.offragebonus = run(`talents[1].t.find(t => t.n === 'Dual Wield Specialization').aura(${rank}).offragebonus`);
            for (const result of ['HIT', 'CRIT', 'GLANCE', 'MISS', 'DODGE']) {
                for (const damage of [0, 100, 2000]) {
                    player.rage = 0;
                    run(`p.addRage(${damage}, RESULT.${result}, p.${hand}, null)`);
                    close(player.rage, ['MISS', 'DODGE'].includes(result) ? 0 :
                        expected * (hand === 'oh' ? 1 + rank * 0.2 : 1));
                }
            }
        }
    }
    player.rage = 999;
    run('p.addRage(100, RESULT.HIT, p.mh, null)');
    assert.equal(player.rage, 1000);
});

test('off-hand hit applies to both swing tables without modifying the main hand', () => {
    const {player} = setup();
    player.talents.offhit = 0; player.update();
    const before = [player.mh.miss, player.mh.dwmiss, player.oh.miss, player.oh.dwmiss];
    player.talents.offhit = 10; player.update();
    assert.deepEqual([player.mh.miss, player.mh.dwmiss], before.slice(0,2));
    close(player.oh.miss, before[2] - 10); close(player.oh.dwmiss, before[3] - 10);
});

test('Whirlwind uses each hand independently and charges rage once', () => {
    const {run, player} = setup();
    player.reset(100); player.stats.ap = player.stats.moddmgdone = player.stats.moddmgtaken = 0;
    player.stats.dmgmod = 1; player.target.armor = player.armorReduction = 0;
    Object.assign(player.mh, {mindmg: 100, maxdmg: 100, bonusdmg: 0, modifier: 1});
    Object.assign(player.oh, {mindmg: 400, maxdmg: 400, bonusdmg: 0, modifier: .5});
    run('p.procattack = () => 0; p.rollmeleespell = () => RESULT.HIT; p.stance = "zerk";');
    const spell = player.spells.whirlwind;
    close(run('p.cast(p.spells.whirlwind)'), 100);
    close(run('p.castoh(p.spells.whirlwind)'), 200);
    assert.equal(player.rage, 100 - spell.cost);
    assert.equal(spell.timer, 10000);
});

test('Weaponmaster bypass affects qualifying hands after debuffs', () => {
    const {player} = setup();
    player.target.armor = 5000; player.talents.weaponmasterarp = .15;
    player.mh.type = 0; player.oh.type = 1;
    close(player.weaponArmorReduction(player.mh), 4250 / (4250 + 400 + 85 * 60));
    close(player.weaponArmorReduction(player.oh), player.armorReduction);
    player.mh.type = 6;
    close(player.weaponArmorReduction(player.mh), 4250 / (4250 + 400 + 85 * 60));
});

test('Bloodthrill requires landed melee damage and current Rend; consumes independently of dodge expiry', () => {
    const {run, player} = setup();
    player.reset(100); player.talents.bloodthrill = 10;
    run('rng10k = () => 0; p.auras.rend = {timer: 10000, stacks: 3};');
    run('p.dealdamage(100, RESULT.MISS, p.mh, null, false)');
    assert.equal(player.bloodthrilltimer, 0);
    run('p.dealdamage(100, RESULT.HIT, p.mh, null, true)');
    assert.equal(player.bloodthrilltimer, 0);
    run('p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(player.bloodthrilltimer, 6000);
    player.dodgetimer = 5000; player.stepdodgetimer(5000);
    assert.equal(player.bloodthrilltimer, 6000);
    player.stance = 'battle'; player.timer = player.spells.overpower.timer = 0;
    assert.equal(player.spells.overpower.canUse(), true);
    player.spells.overpower.use();
    assert.equal(player.bloodthrilltimer, 0);
    run('step = 10000; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(player.bloodthrilltimer, 0);
});

test('Spearing Strike applies its conditional multiplier and dismounts on a landed hit', () => {
    const {run, player} = setup();
    player.stats.ap = player.stats.moddmgdone = 0; player.stats.dmgmod = 1;
    Object.assign(player.mh, {mindmg: 100, maxdmg: 100, bonusdmg: 0});
    player.target.creaturetype = 'Other';
    close(run('spear = new SpearingStrike(p, "forever:spearing-strike"); spear.dmg()'), 40);
    for (const type of ['Giant','Dragonkin']) { player.target.creaturetype = type; close(run('spear.dmg()'), 120); }
    player.target.creaturetype = 'Mounted'; player.reset(100);
    player.stats.ap = player.stats.moddmgdone = 0; player.stats.dmgmod = 1; player.mh.bonusdmg = 0;
    close(run('spear.dmg()'), 120);
    run('p.dealdamage(100, RESULT.HIT, p.mh, spear, false)');
    assert.equal(player.mounted, false); close(run('spear.dmg()'), 40);
});

test('Sweeping Strikes copies five hits without producing extra rage or proc rolls', () => {
    const {run, player} = setup();
    player.reset(100); player.stance = 'battle'; player.adjacent = 1;
    run('p.auras.sweepingstrikes = new SweepingStrikes(p, "forever:sweeping-strikes"); p.auras.sweepingstrikes.use();');
    for (let i = 0; i < 6; i++) player.auras.sweepingstrikes.stacks && player.auras.sweepingstrikes.copy(100);
    assert.equal(player.auras.sweepingstrikes.totaldmg, 500);
    assert.equal(player.auras.sweepingstrikes.timer, 0);
    assert.equal(player.rage, 70);
    assert.equal(player.auras.sweepingstrikes.canUse(), false);
    run('step = 30000; p.timer = 0');
    assert.equal(player.auras.sweepingstrikes.canUse(), true);
});

for (const [mode, ranks, cast, firstSwing] of [['classic',0,1500,3500], ['forever',0,1500,2000], ['forever',1,1250,1250], ['forever',2,1000,1000]]) {
    test(`${mode} Slam ${ranks}: cast/GCD and first swing at ${firstSwing}ms`, () => {
        const {engine, player, run, fixture} = setup(mode);
        Object.assign(player.talents, {impslam: ranks, umbridledwrath: 0, angermanagement: 0});
        run('p.spells = {stanceswitch: p.spells.stanceswitch, slam: new Slam(p,11605)}; p.spells.slam.priority = 10; p.spells.slam.expriority = 10; p.spells.slam.minrage = 0; p.spells.slam.maincd = 0; p.spells.slam.afterswing = false; p.preporder = []; p.auras = {}; p.oh = null; p.target.speed = 100000; p.target.mindmg = p.target.maxdmg = 0; p.sortSpells();');
        const slam = player.spells.slam;
        assert.equal(slam.casttime, cast);
        assert.equal(slam.gcd, mode === 'classic' ? 1500 : cast);
        assert.equal(slam.cooldown, mode === 'forever' ? 15 : 0);
        run(`events = []; const originalReset = p.reset.bind(p); p.reset = rage => {
            originalReset(rage); p.stats.haste = 1; p.mh.speed = 2; p.mh.timer = 500;
            p.mh.proc1 = p.mh.proc2 = p.mh.windfury = undefined;
        };
        const originalUse = p.spells.slam.use.bind(p.spells.slam);
        p.spells.slam.use = () => { events.push(['slam',step]); originalUse(); p.rage = 0; p.spells.slam.timer = 99999; };
        const originalAttack = p.attackmh.bind(p);
        p.attackmh = (...args) => { events.push(['swing',step]); return originalAttack(...args); };`);
        const simulation = engine.createSimulation(player, {...fixture.sim, iterations: 1, timesecsmin: 5, timesecsmax: 5, startrage: 100});
        player.reactionmin = player.reactionmax = 0; slam.maxdelay = 0;
        simulation.startSync();
        const events = JSON.parse(run('JSON.stringify(events)'));
        assert.equal(events.find(e => e[0] === 'slam')[1], cast);
        assert.equal(events.find(e => e[0] === 'swing')[1], firstSwing);
    });
}

for (const [mode, ranks] of [['classic',0], ['forever',0], ['forever',1], ['forever',2]]) {
    test(`${mode} Slam ${ranks}: repeated casts respect the mode's cooldown`, () => {
        const {engine, player, run, fixture} = setup(mode);
        player.talents.impslam = ranks;
        run(`p.spells = {stanceswitch: p.spells.stanceswitch, slam: new Slam(p,11605)};
            Object.assign(p.spells.slam, {priority: 10, expriority: 10, minrage: 0, maincd: 0, afterswing: false});
            p.preporder = []; p.auras = {}; p.sortSpells();
            for (const weapon of [p.mh, p.oh].filter(Boolean)) weapon.proc1 = weapon.proc2 = weapon.windfury = null;
            p.trinketproc1 = p.trinketproc2 = p.attackproc1 = p.attackproc2 = null;
            p.reactionmin = p.reactionmax = 0;
            p.target.speed = 1000; p.target.mindmg = p.target.maxdmg = 10000;
            completions = [];
            const originalUse = p.spells.slam.use.bind(p.spells.slam);
            p.spells.slam.use = () => { completions.push(step); originalUse(); };`);
        const sim = {...fixture.sim, iterations: 1, timesecsmin: 40, timesecsmax: 40, startrage: 100};
        const spec = player.serializeSimulationSpec(sim);
        assert.equal(spec.player.spells.find(s => s.key === 'slam').props.cooldown, mode === 'forever' ? 15 : 0);
        engine.createSimulation(player, sim).startSync();
        const completions = JSON.parse(run('JSON.stringify(completions)'));
        const casttime = player.spells.slam.casttime;
        assert.ok(completions.length >= 3);
        assert.deepEqual(completions.slice(0,3), mode === 'forever' ?
            [casttime, 15000 + 2 * casttime, 30000 + 3 * casttime] :
            [casttime, 2 * casttime, 3 * casttime]);
        if (mode === 'forever') assert.equal(completions.length, 3);
    });
}

test('Forever talent tooltips use local descriptions and never null game IDs', () => {
    const {engine, run} = setup();
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const attributes = {}, anchor = {removeClass() {return this;}, attr(k,v) {attributes[k] = v; return this;}};
    const div = {attr(k,v) {attributes[k] = v; return this;}, find() {return anchor;}};
    engine.evaluate('SIM.SETTINGS.updateTalentTooltip(div, talents[0].t[13])', {div});
    assert.equal(attributes.href, '#');
    assert.match(attributes.title, /Weaponmaster/);
    assert.doesNotMatch(attributes.href, /null/);
});


test('client rank scaling matches the corrected non-linear values', () => {
    const {run} = setup();
    for (const [key, field, values] of [
        ['arms:improved-rend', 'rendmod', [0,12,23,35]],
        ['fury:improved-execute', 'executecost', [0,3,5]],
        ['protection:improved-disarm', 'disarmcd', [0,7,13,20]],
    ]) for (const [rank, value] of values.entries()) {
        assert.equal(run(`talents.flatMap(t => t.t).find(t => t.forever.key === '${key}').aura(${rank}).${field}`), value);
    }
});

test('v1 keyed and positional Protection builds refund Vitality without shifting ranks', () => {
    const {run} = setup();
    const result = JSON.parse(run(`JSON.stringify((() => {
        const old = talents.map(tree => ({t: tree.t.map(() => 0), keys: tree.t.map(t => t.forever.key)}));
        old[2].t = [5,5,2,5,3,0,2,0,0,3,0,0,0,1,0,5,3,5,1];
        old[2].keys.splice(15, 0, 'protection:vitality');
        const keyed = normalizeForeverTalents(old, 'forever-v1');
        old.forEach(t => delete t.keys);
        return {keyed, positional: normalizeForeverTalents(old, 'forever-v1')};
    })())`));
    assert.deepEqual(result.keyed, result.positional);
    assert.deepEqual(result.keyed[2].t, [5,5,2,5,3,0,2,0,0,3,0,0,0,1,0,3,5,1]);
    assert.ok(!result.keyed[2].keys.includes('protection:vitality'));
});

test('Spearing Strike requires an equipped two-handed weapon', () => {
    const {engine, fixture} = setup();
    fixture.talentSchema = 'forever-v2';
    fixture.talents = [[3,5,3,0,5,0,0,0,1,0,0,0,0,0,0,0,0], Array(18).fill(0), Array(18).fill(0)];
    fixture.rotation = {'forever:spearing-strike': {active: true}};
    assert.equal(createConfiguredPlayer(engine, fixture).spells.spearingstrike, undefined);
    fixture.gear = {mainhand: [], offhand: [], twohand: [19334]};
    assert.ok(createConfiguredPlayer(engine, fixture).spells.spearingstrike);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Slam next-MH-auto threshold ignores off-hand and checks the exact boundary`, () => {
    const {run, player} = setup(mode);
    run(`Object.assign(spells.find(s => s.id === 11605), {nextauto: 500, nextautoactive: true});
        p.spells.slam = new Slam(p, 11605);
        Object.assign(p.spells.slam, {minrage: 0, maincd: 0});`);
    const slam = player.spells.slam;
    player.timer = 0;
    player.rage = 100;
    for (const [mh, oh] of [[499, 900], [900, 499], [500, 0], [500, 500], [501, 501], [0, 0]]) {
        player.mh.timer = mh;
        player.oh.timer = oh;
        assert.equal(slam.canUse(), mode === 'classic' || mh >= 500);
    }
    player.oh = null;
    player.mh.timer = 499;
    assert.equal(slam.canUse(), mode === 'classic');
    player.mh.timer = 500;
    assert.equal(slam.canUse(), true);
    assert.equal(player.serializeSimulationSpec({}).player.spells.find(s => s.key === 'slam').props.nextauto,
        mode === 'forever' ? 500 : 0);
    run('spells.find(s => s.id === 11605).nextautoactive = false; p.spells.slam = new Slam(p, 11605)');
    assert.equal(player.spells.slam.nextauto, 0);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Slam next-auto option visibility for every rank`, () => {
    const {engine, run} = setup(mode);
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const rows = [];
    const element = {
        find() { return this; }, data() { return this; }, empty() { return this; },
        append(value) { if (typeof value === 'string') rows.push(value); return this; },
        css() { return this; }, height() { return 0; },
    };
    engine.evaluate('$ = () => element; setTimeout = () => {}; SIM.SETTINGS.rotation = element;', {element});
    for (const id of [1464, 8820, 11604, 11605]) {
        rows.length = 0;
        run(`SIM.SETTINGS.buildSpellDetails(spells.find(s => s.id === ${id}), element)`);
        assert.equal(rows.join('').includes('name="nextauto"'), mode === 'forever');
        assert.equal(rows.join('').includes('Do not use if next MH auto is ready'), mode === 'forever');
    }
});
