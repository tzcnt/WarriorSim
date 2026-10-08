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
    assert.deepEqual(JSON.parse(run('JSON.stringify(talents.map(t => t.t.length))')), [17,17,18]);
    assert.equal(run('talents.flatMap(tree => tree.t).every(t => Array.from({length: t.m + 1}, (_, r) => Object.values(t.aura(r)).every(Number.isFinite)).every(Boolean))'), true);
    assert.equal(run('talents[0].t[13].aura(5).axecrit'), 5);
    close(run('talents[0].t[13].aura(5).weaponmasterarp'), .15);
    assert.match(run('talents[0].t[13].d[4]'), /ignore\s+15%/);
    assert.match(run("talents[1].t.find(t => t.forever.key === 'fury:improved-berserker-rage').d[1]"), /generate 10 Rage/);
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
    fixture.talents = [Array(17).fill(0), Array(17).fill(0), Array(18).fill(0)];
    fixture.talentSchema = 'forever-v3';
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
        close(run('new Bloodthirst(p, 23894).dmg()'), 450 + bonus);
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

test('Raging Blows and Focused Rage stack on Cleave and Whirlwind without retaining Classic bonus damage', () => {
    const {run, player} = setup();
    player.ragecostbonus = 3;
    player.talents.ragingblows = 0;
    assert.equal(run('new Cleave(p, 20569)').cost, 17);
    assert.equal(run('new Whirlwind(p, 1680)').cost, 22);
    player.talents.ragingblows = 1;
    const cleave = run('new Cleave(p, 20569)');
    assert.equal(cleave.cost, 14);
    assert.equal(cleave.bonus, cleave.value1);
    assert.equal(run('new Whirlwind(p, 1680)').cost, 19);
    assert.match(run("talents[1].t.find(t => t.n === 'Raging Blows').d[0]"), /Cleave and Whirlwind abilities by 3/);
    const classic = setup('classic');
    classic.player.talents.ragingblows = 1;
    assert.equal(classic.run('new Whirlwind(p, 1680)').cost, 25);
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

for (const mode of ['classic', 'forever']) test(`${mode}: Battle Shout starts free and only becomes usable after expiring`, () => {
    const {run, player} = setup(mode);
    player.reset(50);
    player.talents.boomingvoice = 0;
    run('p.auras.battleshout = new BattleShout(p, 11551)');
    const shout = player.auras.battleshout;
    const duration = mode === 'forever' ? 180000 : 120000;
    const initialAP = player.stats.ap;
    run('p.auras.battleshout.use(true)');
    assert.equal(shout.timer, duration);
    assert.equal(player.rage, 50);
    assert.equal(player.timer, 0);
    assert.ok(player.stats.ap > initialAP);
    run(`step = ${duration - 1}; p.auras.battleshout.step()`);
    assert.equal(shout.canUse(), false);
    run(`step = ${duration}; p.auras.battleshout.step()`);
    assert.equal(player.stats.ap, initialAP);
    assert.equal(shout.canUse(), true);
    run('p.auras.battleshout.use()');
    assert.equal(player.rage, 50 - shout.cost);
    assert.equal(player.timer, 1500);
    assert.equal(shout.timer, duration * 2);
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

test('Unbridled Wrath grants 1 Rage with any weapon, and off-hand swing rage does not multiply it', () => {
    const {run, player} = setup();
    player.reset(0); player.ragecap = 1000; player.talents.umbridledwrath = 100;
    run('rng10k = () => 0; p.mh.twohand = true; p.addRage(0, RESULT.HIT, p.mh, null)');
    close(player.rage, 1 + player.mh.speed * 4.5);
    assert.doesNotMatch(run("talents[1].t.find(t => t.n === 'Unbridled Wrath').d[4]"), /two-handed/);
    player.rage = 0;
    const swingRage = player.oh.speed * 3.46 * 0.5;
    run('p.addRage(100, RESULT.HIT, p.oh, null)');
    close(player.rage, 1 + swingRage * 1.5);
    player.rage = 0;
    run('p.addRage(100, RESULT.CRIT, p.oh, null)');
    close(player.rage, 1 + swingRage * 1.5 * 2);
});

test('Unbridled Wrath procs from queued strikes only in Classic', () => {
    for (const [mode, expected] of [['forever', 0], ['classic', 1]]) {
        const {run, player} = setup(mode);
        player.talents.umbridledwrath = 100;
        run('rng10k = () => 0; p.mh.twohand = false');
        for (const expression of ['new HeroicStrike(p, 11567)', 'new Cleave(p, 20569)']) {
            player.rage = 0;
            run(`p.addRage(100, RESULT.HIT, p.mh, ${expression})`);
            assert.equal(player.rage, expected, `${mode} ${expression}`);
        }
    }
});

test('Forever white-hit rage uses base speed and weapon type regardless of damage, haste or glancing; crits double it', () => {
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
                        expected * (hand === 'oh' ? 1 + rank * 0.1 : 1) * (result === 'CRIT' ? 2 : 1));
                }
            }
        }
    }
    player.rage = 999;
    run('p.addRage(100, RESULT.HIT, p.mh, null)');
    assert.equal(player.rage, 1000);
});

test('Dual Wield Specialization raises off-hand rage by 10% per rank, and special-attack crits add no rage', () => {
    const {run, player} = setup();
    const dws = "talents[1].t.find(t => t.forever.key === 'fury:dual-wield-specialization')";
    assert.deepEqual([0,1,2,3,4,5].map(rank => Math.round(run(`${dws}.aura(${rank}).offragebonus`) * 100)), [0,10,20,30,40,50]);
    assert.match(run(`${dws}.d[4]`), /Rage generated by your off-hand attacks by 50%/);
    player.talents.umbridledwrath = 0;
    for (const result of ['HIT', 'CRIT']) {
        player.rage = 0;
        run(`p.addRage(500, RESULT.${result}, p.mh, p.spells.bloodthirst || new Bloodthirst(p, 23894))`);
        assert.equal(player.rage, 0, result);
    }
});

test('off-hand hit applies to both swing tables without modifying the main hand', () => {
    const {player} = setup();
    player.talents.offhit = 0; player.update();
    const before = [player.mh.miss, player.mh.dwmiss, player.oh.miss, player.oh.dwmiss];
    player.talents.offhit = 10; player.update();
    assert.deepEqual([player.mh.miss, player.mh.dwmiss], before.slice(0,2));
    close(player.oh.miss, before[2] - 10); close(player.oh.dwmiss, before[3] - 10);
});

test('Whirlwind always uses each hand independently and charges rage once', () => {
    const {run, player} = setup();
    player.reset(100); player.stats.ap = player.stats.moddmgdone = player.stats.moddmgtaken = 0;
    player.stats.dmgmod = 1; player.target.armor = player.armorReduction = 0;
    Object.assign(player.mh, {mindmg: 100, maxdmg: 100, bonusdmg: 0, modifier: 1});
    Object.assign(player.oh, {mindmg: 400, maxdmg: 400, bonusdmg: 0, modifier: .5});
    run('p.procattack = () => 0; p.rollmeleespell = () => RESULT.HIT; p.stance = "zerk";');
    player.talents.ragingblows = 0;
    const spell = player.spells.whirlwind;
    close(run('p.cast(p.spells.whirlwind)'), 100);
    assert.equal(spell.offhandhit, true, 'Forever Whirlwind strikes with both weapons without Raging Blows');
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

test('Bloodthrill rolls 4% per rank and only from main-hand hits, including queued strikes', () => {
    const {run, player} = setup();
    assert.deepEqual([0,1,2,3,4,5].map(rank =>
        run(`talents[0].t.find(t => t.forever.key === 'arms:bloodthrill').aura(${rank}).bloodthrill`)), [0,4,8,12,16,20]);
    assert.match(run("talents[0].t.find(t => t.n === 'Bloodthrill').d[4]"), /Main Hand melee attacks .* 20% chance/);
    player.reset(100); player.talents.bloodthrill = 20;
    run('p.auras.rend = {timer: 10000, stacks: 3}; ww = new Whirlwind(p, 1680)');
    run('rng10k = () => 2000; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(player.bloodthrilltimer, 0, 'roll at the 20% threshold fails');
    run('rng10k = () => 1999');
    for (const spell of ['null', 'ww']) {
        run(`p.dealdamage(100, RESULT.HIT, p.oh, ${spell}, false)`);
        assert.equal(player.bloodthrilltimer, 0, `off-hand ${spell}`);
    }
    for (const spell of ['null', 'new HeroicStrike(p, 11567)', 'new Cleave(p, 20569)', 'ww']) {
        player.bloodthrilltimer = 0;
        run(`p.dealdamage(100, RESULT.HIT, p.mh, ${spell}, false)`);
        assert.equal(player.bloodthrilltimer, 6000, `main-hand ${spell}`);
    }
});

test('October rework positions and prerequisites; saved builds lose Bastion without 25 lower points', () => {
    const {run} = setup();
    const layout = JSON.parse(run(`JSON.stringify(Object.fromEntries(talents.flatMap(tree => tree.t.map(t =>
        [t.forever.key, [t.y + 1, t.x + 1, t.r ? tree.t[t.r[0]].forever.key : null]]))))`));
    assert.deepEqual(layout['fury:lingering-rage'], [2, 2, null]);
    assert.deepEqual(layout['fury:furious-precision'], [3, 1, null]);
    assert.deepEqual(layout['fury:improved-berserker-rage'], [5, 1, null]);
    assert.deepEqual(layout['fury:flurry'], [6, 2, 'fury:death-wish']);
    assert.deepEqual(layout['fury:gore-drinker'], [6, 3, 'fury:enrage']);
    assert.deepEqual(layout['fury:bloodthirst'], [7, 2, null]);
    assert.deepEqual(layout['protection:improved-bloodrage'], [1, 1, null]);
    assert.deepEqual(layout['protection:iron-will'], [1, 3, null]);
    assert.deepEqual(layout['protection:last-stand'], [3, 1, null]);
    assert.deepEqual(layout['protection:focused-rage'], [5, 3, null]);
    assert.deepEqual(layout['protection:bastion'], [6, 3, null]);
    for (const key of ['fury:iron-will', 'fury:improved-cleave', 'fury:boundless-rage', 'fury:precision', 'protection:toughness'])
        assert.equal(layout[key], undefined, key);
    const build = ranks => JSON.stringify(JSON.parse(run('JSON.stringify(talents.map(tree => tree.t.map(t => t.forever.key)))'))
        .map(keys => keys.map(key => ranks[key] || 0)));
    const valid = ranks => run(`validTalentBuild(talents, ${build(ranks)})`);
    // 20 points in rows 1-4 open row 5 but not row 6.
    const base = {'protection:improved-bloodrage': 2, 'protection:shield-specialization': 5, 'protection:anticipation': 5,
        'protection:improved-thunder-clap': 3, 'protection:improved-sunder-armor': 3, 'protection:defiance': 2};
    assert.equal(valid({...base, 'protection:focused-rage': 3}), true, 'Focused Rage needs 20 points');
    assert.equal(valid({...base, 'protection:bastion': 1}), false, 'Bastion needs 25 points');
    assert.equal(valid({...base, 'protection:iron-will': 2, 'protection:focused-rage': 3, 'protection:bastion': 5}), true);
    const saved = JSON.parse(run(`JSON.stringify(normalizeForeverTalents(${build({...base, 'protection:bastion': 5})}
        .map((t, i) => ({t, keys: talents[i].t.map(x => x.forever.key)})), FOREVER_TALENT_SCHEMA))`));
    assert.deepEqual(saved, JSON.parse(run(`JSON.stringify(normalizeForeverTalents(${build(base)}
        .map((t, i) => ({t, keys: talents[i].t.map(x => x.forever.key)})), FOREVER_TALENT_SCHEMA))`)), 'Bastion is refunded');
    // Flurry now hangs from Death Wish; Bloodthirst needs only 30 points.
    const fury = {'fury:booming-voice': 2, 'fury:cruelty': 5, 'fury:unbridled-wrath': 5, 'fury:furious-precision': 3,
        'fury:dual-wield-specialization': 5, 'fury:enrage': 5, 'fury:improved-execute': 2, 'fury:improved-berserker-rage': 2};
    assert.equal(valid({...fury, 'fury:flurry': 1}), false);
    assert.equal(valid({...fury, 'fury:death-wish': 1, 'fury:flurry': 5, 'fury:bloodthirst': 1}), true);
    assert.equal(valid({...fury, 'fury:improved-intercept': 2, 'fury:gore-drinker': 2, 'fury:bloodthirst': 1}), true);
});

test('removed talents leave no effects; the rage cap is 100 and Precision no longer adds hit', () => {
    const {run, player} = setup();
    for (const key of ['extraragecap', 'precision', 'cleavecost'])
        assert.equal(run(`talents.flatMap(t => t.t).some(t => Object.hasOwn(t.aura(t.m), '${key}'))`), false, key);
    assert.equal(player.ragecap, 100);
    const furious = "talents[1].t.find(t => t.forever.key === 'fury:furious-precision')";
    assert.deepEqual([0,1,2,3].map(rank => run(`${furious}.aura(${rank}).offhit`)), [0,4,7,10]);
    assert.match(run(`${furious}.d[2]`), /off-hand attacks by 10%/);
    assert.equal(run("talents[1].t.find(t => t.forever.key === 'fury:dual-wield-specialization').aura(5).offhit"), undefined);
    assert.equal(run("talents.flatMap(t => t.t).filter(t => ['Lingering Rage', 'Gore Drinker', 'Iron Will'].includes(t.n)).every(t => t.forever.implementationStatus === 'outside-dps-model')"), true);
    assert.equal(run("talents[1].t.find(t => t.n === 'Booming Voice').forever.implementationStatus"), 'implemented');
});

test('Booming Voice reduces Battle Shout rage cost by 5% per rank in Forever only', () => {
    for (const rank of [0, 1, 5]) {
        const {run, player} = setup();
        Object.assign(player.talents, run(`talents[1].t.find(t => t.n === 'Booming Voice').aura(${rank})`));
        close(run('new BattleShout(p, 11551).cost'), 10 * (1 - rank * .05));
    }
    const classic = setup('classic');
    classic.player.talents.shoutcost = 25;
    assert.equal(classic.run('new BattleShout(p, 11551).cost'), 10 - classic.player.talents.boomingvoice * 2);
});

test('Improved Slam tooltips reduce the cooldown by 3 seconds at both ranks', () => {
    const {run} = setup();
    const d = JSON.parse(run("JSON.stringify(talents[0].t.find(t => t.n === 'Improved Slam').d)"));
    assert.match(d[0], /cast time of your Slam ability by 0\.25 sec.*cooldown is reduced by 3\.0 sec/);
    assert.match(d[1], /cast time of your Slam ability by 0\.50 sec.*cooldown is reduced by 3\.0 sec/);
});

test('Spearing Strike applies its conditional multiplier and no longer dismounts', () => {
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
    assert.equal(player.mounted, true); close(run('spear.dmg()'), 120);
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

for (const [mode, ranks, cast, firstSwing] of [['classic',0,1500,3500], ['forever',0,1500,3500], ['forever',1,1250,1250], ['forever',2,1000,1000]]) {
    test(`${mode} Slam ${ranks}: cast/GCD and first swing at ${firstSwing}ms`, () => {
        const {engine, player, run, fixture} = setup(mode);
        Object.assign(player.talents, {impslam: ranks, umbridledwrath: 0, angermanagement: 0});
        run('p.spells = {stanceswitch: p.spells.stanceswitch, slam: new Slam(p,11605)}; p.spells.slam.priority = 10; p.spells.slam.expriority = 10; p.spells.slam.minrage = 0; p.spells.slam.maincd = 0; p.spells.slam.afterswing = false; p.preporder = []; p.auras = {}; p.oh = null; p.target.speed = 100000; p.target.mindmg = p.target.maxdmg = 0; p.sortSpells();');
        const slam = player.spells.slam;
        assert.equal(slam.casttime, cast);
        assert.equal(slam.gcd, mode === 'classic' ? 1500 : cast);
        assert.equal(slam.cooldown, mode === 'forever' ? (ranks ? 15 : 18) : 0);
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
        const sim = {...fixture.sim, iterations: 1, timesecsmin: 45, timesecsmax: 45, startrage: 100};
        const spec = player.serializeSimulationSpec(sim);
        const cooldown = mode === 'forever' ? (ranks ? 15 : 18) : 0;
        assert.equal(spec.player.spells.find(s => s.key === 'slam').props.cooldown, cooldown);
        engine.createSimulation(player, sim).startSync();
        const completions = JSON.parse(run('JSON.stringify(completions)'));
        const casttime = player.spells.slam.casttime;
        assert.ok(completions.length >= 3);
        assert.deepEqual(completions.slice(0,3),
            [casttime, cooldown * 1000 + 2 * casttime, 2 * cooldown * 1000 + 3 * casttime]);
        if (mode === 'forever') assert.equal(completions.length, 3);
    });
}

test('Forever talent tooltips use local descriptions and never null game IDs', () => {
    const {engine} = setup();
    engine.evaluate(fs.readFileSync(require.resolve('../js/tooltip.js'), 'utf8'));
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const tooltip = key => {
        const attributes = {}, anchor = {removeClass() {return this;}, attr(k,v) {attributes[k] = v; return this;}};
        const div = {attr(k,v) {attributes[k] = v; return this;}, find() {return anchor;}};
        engine.evaluate('SIM.SETTINGS.updateTalentTooltip(div, talents.flatMap(tree => tree.t).find(t => t.forever.key === key))', {div, key});
        return attributes;
    };
    const weaponmaster = tooltip('arms:weaponmaster');
    assert.equal(weaponmaster.href, '#');
    assert.doesNotMatch(weaponmaster.href, /null/);
    assert.match(weaponmaster['data-tooltip'], /^<div class="name">Weaponmaster<\/div><div>Rank 0\/\d<\/div><div class="q">/);
    assert.match(weaponmaster['aria-label'], /^Weaponmaster\nRank 0\/\d\n/);

    // Costs follow Wowhead's layout: cost | range, then cast time | cooldown.
    assert.ok(tooltip('arms:spearing-strike')['data-tooltip'].includes('<div class="columns"><span>15 Rage</span><span>Melee Range</span></div>' +
        '<div class="columns"><span>Instant</span><span>20 sec cooldown</span></div>' +
        '<div>Requires Battle Stance</div>'));
    const html = content => engine.evaluate('SIM.TOOLTIP.html(content)', {content});
    assert.equal(html({name: 'A', cost: 'Instant; 3 min cooldown'}),
        '<div class="name">A</div><div class="columns"><span>Instant</span><span>3 min cooldown</span></div>');
    assert.equal(html({name: 'A', cost: '10 Rage; Instant'}), '<div class="name">A</div><div>10 Rage</div><div>Instant</div>');
    assert.equal(html({name: '<A & "B">', description: 'x', next: 'y'}),
        '<div class="name">&lt;A &amp; &quot;B&quot;&gt;</div><div class="q">x</div><div class="next">Next rank:</div><div class="q">y</div>');
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
        const old = FOREVER_LEGACY_TALENT_KEYS['forever-v1'].map(keys => ({t: keys.map(() => 0), keys: [...keys]}));
        old[2].t = [5,5,2,5,3,0,2,0,0,3,0,0,0,1,0,5,3,5,1];
        const keyed = normalizeForeverTalents(old, 'forever-v1');
        old.forEach(t => delete t.keys);
        return {keyed, positional: normalizeForeverTalents(old, 'forever-v1')};
    })())`));
    assert.deepEqual(result.keyed, result.positional);
    // Toughness and Vitality are refunded, which leaves Bastion and Shield Slam short of their rows.
    assert.deepEqual(result.keyed[2].t, [2,5,0,5,0,3,0,2,0,0,3,0,0,0,1,3,0,0]);
    assert.ok(!result.keyed[2].keys.includes('protection:vitality'));
});

test('v2 keyed and positional builds migrate by talent, refunding removed and stranded points', () => {
    const {run} = setup();
    const result = JSON.parse(run(`JSON.stringify((() => {
        const old = FOREVER_LEGACY_TALENT_KEYS['forever-v2'].map(keys => ({t: keys.map(() => 0), keys: [...keys]}));
        // The previous Dual Wield Fury preset: 13/38/0.
        old[0].t = [2,0,3,0,3,2,0,3,0,0,0,0,0,0,0,0,0];
        old[1].t = [0,5,0,5,2,0,0,3,5,1,5,2,3,1,0,0,5,1];
        old[2].t[2] = 2; old[2].t[3] = 5; // Improved Bloodrage moves; Toughness is gone
        const keyed = normalizeForeverTalents(old, 'forever-v2');
        old.forEach(t => delete t.keys);
        const named = (trees, i) => Object.fromEntries(trees[i].keys.map((k, j) => [k, trees[i].t[j]]).filter(([, r]) => r));
        return {keyed, positional: normalizeForeverTalents(old, 'forever-v2'), fury: named(keyed, 1), protection: named(keyed, 2)};
    })())`));
    assert.deepEqual(result.keyed, result.positional);
    // Cruelty and Unbridled Wrath keep only 10 points below row 4, so rows 4-7 are refunded.
    assert.deepEqual(result.fury, {'fury:cruelty': 5, 'fury:unbridled-wrath': 5});
    assert.deepEqual(result.protection, {'protection:improved-bloodrage': 2});
    assert.deepEqual(result.keyed[0].t, [2,0,3,0,3,2,0,3,0,0,0,0,0,0,0,0,0]);
    // Iron Will moved trees and is refunded rather than moved.
    const ironWill = JSON.parse(run(`JSON.stringify(normalizeForeverTalents([{t: [], keys: []},
        {t: [3], keys: ['fury:iron-will']}, {t: [], keys: []}], 'forever-v2'))`));
    assert.equal(ironWill.flatMap(tree => tree.t).reduce((a, b) => a + b), 0);
});

test('Spearing Strike works with any melee weapon and requires Battle Stance', () => {
    const {engine, fixture} = setup();
    fixture.talentSchema = 'forever-v3';
    fixture.talents = [[3,5,3,0,5,0,0,0,1,0,0,0,0,0,0,0,0], Array(17).fill(0), Array(18).fill(0)];
    fixture.rotation = {'forever:spearing-strike': {active: true, maxrage: 20, maxrageactive: true}};
    const p = createConfiguredPlayer(engine, fixture);
    const spear = p.spells.spearingstrike;
    assert.ok(spear && p.oh, 'dual wield learns Spearing Strike');
    p.reset(30); p.timer = 0;
    p.stance = 'zerk'; p.talents.rageretained = 10;
    assert.equal(spear.canUse(), false, 'Tactical Mastery cannot retain the cost');
    p.talents.rageretained = 25;
    assert.equal(spear.canUse(), false, 'above the stance-switch rage limit');
    p.rage = 20;
    assert.equal(spear.canUse(), true);
    spear.use();
    assert.equal(p.stance, 'battle');
    assert.equal(spear.timer, 20000);
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
        css() { return this; }, height() { return 0; }, hasClass() { return false; }, val() { return ''; },
    };
    engine.evaluate('$ = () => element; setTimeout = () => {}; SIM.SETTINGS.rotation = SIM.SETTINGS.fight = element;', {element});
    for (const id of [1464, 8820, 11604, 11605]) {
        rows.length = 0;
        run(`SIM.SETTINGS.buildSpellDetails(spells.find(s => s.id === ${id}), element)`);
        assert.equal(rows.join('').includes('name="nextauto"'), mode === 'forever');
        assert.equal(rows.join('').includes('Do not use if next MH auto is ready'), mode === 'forever');
    }
});
