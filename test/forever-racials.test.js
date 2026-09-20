'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

function setup(race = 'Human', mode = 'forever', creaturetype = 'Other') {
    const engine = createReferenceEngine(mode);
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    fixture.player.race = race;
    fixture.player.target.creaturetype = creaturetype;
    fixture.rotation = {20572: {active: true, timetostartactive: true, timetostart: 0},
        26296: {active: true, haste: 99, timetostartactive: true, timetostart: 0},
        'forever:elunes-light': {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false},
        'forever:eureka': {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false}};
    const player = createConfiguredPlayer(engine, fixture);
    engine.evaluate('step = 0; setSimulationSeed(123)', {p: player});
    player.reset(100);
    return {player, engine, fixture, run: code => engine.evaluate(code)};
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

for (const mode of ['classic', 'forever']) test(`${mode}: selecting a race enables its racial with the default end schedule`, () => {
    const {engine, fixture, run} = setup('Human', mode);
    const cases = [['Orc', 20572, 'bloodfury', 18], ['Troll', 26296, 'berserking', 13]];
    if (mode === 'forever') cases.push(['Night Elf', 'forever:elunes-light', 'eluneslight', 31], ['Gnome', 'forever:eureka', 'eureka', 10]);
    const otherSpells = run('JSON.stringify(spells.filter(s => !racialSpellRules[s.id]))');
    for (const [race, id, key, seconds] of cases) {
        engine.evaluate('selectRacialSpells(race, mode)', {race});
        const player = engine.createPlayer({...fixture.player, race, mode});
        const aura = player.auras[key];
        assert.ok(aura, `${race}: racial enabled`);
        assert.equal(aura.timetoend, seconds * 1000);
        assert.equal(aura.timetostart, undefined);
        aura.prep(60000);
        assert.equal(aura.usestep, (60 - seconds) * 1000);
        assert.equal(run('spells.filter(s => racialSpellRules[s.id] && s.active).length'), 1);

        // A later race selection restores defaults even after manual edits or disabling.
        engine.evaluate(`Object.assign(spells.find(s => s.id == id), {
            active: false, timetoend: 99, timetoendactive: false, timetostart: 7, timetostartactive: true
        }); selectRacialSpells('Human', mode);`, {id});
        assert.equal(run('spells.filter(s => racialSpellRules[s.id] && s.active).length'), 0);
        engine.evaluate('selectRacialSpells(race, mode)');
        const restored = engine.createPlayer({...fixture.player, race, mode}).auras[key];
        assert.ok(restored);
        assert.equal(restored.timetoend, seconds * 1000);
        assert.equal(restored.timetostart, undefined);
    }
    assert.equal(run('JSON.stringify(spells.filter(s => !racialSpellRules[s.id]))'), otherSpells);
    if (mode === 'classic') {
        run("selectRacialSpells('Gnome', mode)");
        assert.equal(run('spells.filter(s => racialSpellRules[s.id] && s.active).length'), 0);
    }
});

test('Forever replaces Human/Orc skill racials; Classic retains them', () => {
    for (const [race, skill] of [['Human', 'skill_1'], ['Orc', 'skill_3']]) {
        const {player: forever} = setup(race);
        const {player: neutral} = setup('Night Elf');
        assert.equal(forever.base[skill], neutral.base[skill]);
        const {player: classic} = setup(race, 'classic');
        const {player: classicNeutral} = setup('Night Elf', 'classic');
        assert.equal(classic.base[skill], classicNeutral.base[skill] + 5);
    }
});

test('weapon specialization adds crit to qualifying autoattacks and specials in either hand', () => {
    for (const [race, type, bonus] of [['Human',1,2], ['Dwarf',0,1], ['Orc',3,1]]) {
        for (const [mh, oh] of [[true, false], [false, true], [true, true], [false, false]]) {
            const {player: p, run} = setup(race);
            for (const [hand, qualifies] of [['mh', mh], ['oh', oh]])
                Object.assign(p[hand], {type: qualifies ? type : 2, crit: 0, miss: 0, dwmiss: 0, dodge: 0, glanceChance: 0});
            p.base.spellcrit = 0; p.addRacialBonuses(); p.crit = 0;
            assert.equal(p.base.spellcrit, mh || oh ? bonus : 0);
            for (const [hand, qualifies] of [['mh', mh], ['oh', oh]]) {
                assert.equal(p[hand].racialcrit, qualifies ? bonus : 0);
                run(`rng10k = () => ${bonus * 100 - 1}`);
                assert.equal(run(`p.rollmeleespell(p.spells.whirlwind, p.${hand})`), qualifies ? 3 : 0);
                assert.equal(run(`p.rollweapon(p.${hand})`), qualifies ? 3 : 0);
                run(`rng10k = () => ${bonus * 100}`);
                assert.equal(run(`p.rollmeleespell(p.spells.whirlwind, p.${hand})`), 0);
                assert.equal(run(`p.rollweapon(p.${hand})`), 0);
            }
        }
    }
});

test('creature damage bonuses affect physical and magical damage only on matching targets', () => {
    for (const [race, type] of [['Dwarf','Beast'], ['Troll','Beast'], ['Skyborne','Elemental']]) {
        const base = setup(race).player;
        const matching = setup(race, 'forever', type).player;
        close(matching.base.dmgmod / base.base.dmgmod, 1.05);
        close(matching.base.spelldmgmod / base.base.spelldmgmod, 1.05);
        const wrong = setup(race, 'forever', type === 'Beast' ? 'Elemental' : 'Beast').player;
        close(wrong.base.dmgmod, base.base.dmgmod);
    }
    close(setup('Troll', 'classic', 'Beast').player.base.dmgmod, setup('Troll', 'classic').player.base.dmgmod);
});

test('Skyborne has finite level-appropriate stats and multiplicative haste', () => {
    for (const level of [1,25,40,60]) {
        const {engine, fixture} = setup();
        fixture.player.level = level;
        const human = createConfiguredPlayer(engine, fixture);
        fixture.player.race = 'Skyborne';
        const sky = createConfiguredPlayer(engine, fixture);
        assert.equal(sky.base.str, human.base.str);
        assert.equal(sky.base.agi, human.base.agi);
        assert.equal(sky.base.aprace, level * 3 - 20);
        close(sky.stats.haste / human.stats.haste, 1.01);
    }
    assert.match(fs.readFileSync('index.html','utf8'), /value="Skyborne"/);
    assert.doesNotMatch(fs.readFileSync('classic.html','utf8'), /value="Skyborne"/);
});

test('Endurance adds melee and spell hit; Expansive Mind multiplies the talented rage cap', () => {
    const normal = setup().player;
    const tauren = setup('Tauren').player;
    assert.equal(tauren.base.hit, normal.base.hit + 1);
    assert.equal(tauren.target.misschance, normal.target.misschance - 100);
    const gnome = setup('Gnome').player;
    close(gnome.ragecap, normal.ragecap * 1.05);
    gnome.reset(1000);
    close(gnome.rage, gnome.ragecap);
});

test('Endurance reduces autoattack misses by one point for single weapons and both dual-wield hands', () => {
    for (const dualWield of [false, true]) {
        const normal = setup('Human');
        const tauren = setup('Tauren');
        const gearHit = normal.player.base.hit;
        for (const {player: p} of [normal, tauren]) {
            p.base.hit -= gearHit;
            if (!dualWield) p.oh = null;
            p.update();
        }
        for (const hand of dualWield ? ['mh', 'oh'] : ['mh']) {
            const normalMiss = normal.player[hand].dwmiss;
            const taurenMiss = tauren.player[hand].dwmiss;
            close(taurenMiss, normalMiss - 1);
            assert.ok(taurenMiss > 0);
            const roll = Math.ceil(taurenMiss * 100);
            normal.run(`rng10k = () => ${roll}`);
            tauren.run(`rng10k = () => ${roll}`);
            assert.equal(normal.run(`p.rollweapon(p.${hand})`), 1);
            assert.notEqual(tauren.run(`p.rollweapon(p.${hand})`), 1);
            tauren.run(`rng10k = () => ${roll - 1}`);
            assert.equal(tauren.run(`p.rollweapon(p.${hand})`), 1);
        }
    }
});

test('saved rotation data cannot grant another race’s active abilities', () => {
    for (const race of ['Human','Dwarf','Gnome','Night Elf','Orc','Troll','Undead','Tauren','Skyborne']) {
        const {player: p} = setup(race);
        for (const [key, owner] of [['bloodfury','Orc'],['berserking','Troll'],['eluneslight','Night Elf'],['eureka','Gnome']])
            assert.equal(!!p.auras[key], race === owner, `${race}: ${key}`);
    }
    const {player: p} = setup('Gnome', 'classic');
    assert.equal(p.auras.eureka, undefined);
    assert.equal(p.ragecap, 100);
});

test('Blood Fury multiplies total AP, survives AP/Strength refreshes, and expires', () => {
    const {player: p, run} = setup('Orc');
    p.base.ap = 1000; p.base.str = 100; p.base.strmod = p.base.apmod = 1;
    p.updateAuras(); const ap = p.stats.ap;
    p.auras.bloodfury.use();
    assert.equal(p.stats.ap, Math.trunc(ap * 1.1));
    p.updateStrength(); assert.equal(p.stats.ap, Math.trunc(ap * 1.1));
    p.updateAP(); assert.equal(p.stats.ap, Math.trunc(ap * 1.1));
    run('step = 15000; p.auras.bloodfury.step()');
    assert.equal(p.stats.ap, ap);
    assert.equal(p.auras.bloodfury.uptime, 15000);
});

test('Forever Berserking ignores legacy haste settings while Classic preserves them', () => {
    for (const mode of ['classic','forever']) {
        const {player: p, run} = setup('Troll', mode);
        const haste = p.stats.haste;
        p.auras.berserking.use();
        close(p.stats.haste / haste, mode === 'forever' ? 1.1 : 1.99);
        run('step = 10000; p.auras.berserking.step()');
        close(p.stats.haste, haste);
    }
});

test('Elune’s Light grants both crit stats, expires, reuses and resets', () => {
    const {player: p, run} = setup('Night Elf');
    const crit = p.stats.crit, spellcrit = p.stats.spellcrit;
    p.auras.eluneslight.prep(200000); p.auras.eluneslight.use();
    close(p.stats.crit, crit + 10); close(p.stats.spellcrit, spellcrit + 10);
    run('step = 15000; p.auras.eluneslight.step()');
    close(p.stats.crit, crit); close(p.stats.spellcrit, spellcrit);
    assert.equal(p.auras.eluneslight.canUse(), false);
    run('step = 180000'); assert.equal(p.auras.eluneslight.canUse(), true);
    p.auras.eluneslight.use();
    run('step = 0; p.reset(100)');
    assert.equal(p.auras.eluneslight.canUse(), true);
    close(p.stats.crit, crit);
});

function eurekaSetup() {
    const state = setup('Gnome');
    const {player: p, run} = state;
    run('p.procattack = () => 0; p.rollmeleespell = () => RESULT.HIT; p.armorReduction = 0; p.target.armor = 0;');
    p.auras.eureka.use();
    return state;
}

test('Eureka empowers exactly three casts, refunds discounted costs, and resets cleanly', () => {
    const {player: p, run} = eurekaSetup();
    const bt = p.spells.bloodthirst, baseCost = bt.eurekabasecost;
    close(bt.cost, baseCost * .6);
    const expected = bt.dmg() * p.mh.modifier * 1.1 + p.stats.moddmgtaken;
    close(p.cast(bt), expected);
    assert.equal(p.auras.eureka.stacks, 2);
    p.rage = 100;
    run('p.rollmeleespell = () => RESULT.DODGE');
    assert.equal(p.cast(bt), 0);
    close(p.rage, 100 - baseCost * .6 * .2);
    assert.equal(p.auras.eureka.stacks, 1);
    run('p.rollmeleespell = () => RESULT.HIT');
    close(p.cast(bt), expected);
    assert.equal(p.auras.eureka.stacks, 0);
    close(bt.cost, baseCost);
    p.auras.eureka.use();
    p.reset(100);
    close(bt.cost, baseCost);
    assert.equal(p.auras.eureka.stacks, 0);
});

test('Eureka consumes at queued swing execution and once for all Whirlwind hits', () => {
    const {player: p} = eurekaSetup();
    p.cast(p.spells.heroicstrike);
    assert.equal(p.auras.eureka.stacks, 3);
    p.attackmh(p.mh);
    assert.equal(p.auras.eureka.stacks, 2);
    p.auras.eureka.stacks = 1;
    p.nextswinghs = false;
    const ww = p.spells.whirlwind;
    p.cast(ww);
    assert.equal(p.auras.eureka.stacks, 0);
    assert.equal(ww.eurekamod, 1.1);
    p.castoh(ww);
    p.cast(ww, null, 1);
    assert.equal(ww.eurekamod, 1.1);
    assert.equal(p.auras.eureka.stacks, 0);
    p.cast(ww);
    assert.equal(ww.eurekamod, 1);
});

test('Touch of the Grave has a 5% chance, scales with HP and shares a 1 second cooldown', () => {
    const {player: p, run} = setup('Undead');
    const grave = p.auras.touchofthegrave;
    p.maxhealth = 6000;
    assert.equal(grave.chance, 500);
    assert.equal(grave.cooldown, 1);
    run('rng10k = () => 499; p.magicproc = proc => proc.magicdmg;');
    for (const result of ['MISS', 'DODGE']) run(`p.dealdamage(100, RESULT.${result}, p.mh, null, false)`);
    run('p.dealdamage(0, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 0);
    run('p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 300);
    run('p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 300, 'simultaneous off-hand hit shares the cooldown');
    run('step = 999; p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 300);
    run('step = 1000; p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 600, 'off-hand can proc at exactly 1 second');
    run('step = 2000; rng10k = () => 500; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 600, 'roll 500 is outside the 5% proc range');
    p.maxhealth = 12000;
    run('rng10k = () => 499; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 1200);
    run('step = 0; p.reset(100)');
    assert.equal(grave.idmg, 0);
    run('p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.idmg, 600);
    assert.equal(grave.totaldmg, 1800);
});

test('Touch of the Grave checks melee and magic ability hits and ignores armor', () => {
    const {player: p, run} = setup('Undead');
    p.maxhealth = 6000;
    p.target.misschance = 0;
    p.target.mitigation = 1;
    p.stats.spellcrit = 0;
    p.stats.spelldmgmod = 1;
    p.talents.weaponmasterarp = 0;
    run('rng10k = () => 499');
    for (const reduction of [0, .25, .5, .75]) {
        p.armorReduction = reduction;
        for (const defense of ['MELEE', 'MAGIC']) {
            const before = p.auras.touchofthegrave.totaldmg;
            run(`step += 1000; p.dealdamage(100, RESULT.MISS, p.mh,
                {defenseType: DEFENSETYPE.${defense}, school: SCHOOL.PHYSICAL}, false)`);
            assert.equal(p.auras.touchofthegrave.totaldmg, before);
            run(`p.dealdamage(100, RESULT.HIT, p.mh,
                {defenseType: DEFENSETYPE.${defense}, school: SCHOOL.PHYSICAL}, false)`);
            assert.equal(p.auras.touchofthegrave.totaldmg - before, 300);
            run('p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
            assert.equal(p.auras.touchofthegrave.totaldmg - before, 300,
                'ability proc also puts autoattacks on cooldown');
        }
    }
});

test('maximum HP uses race, gear, enchants and selected buffs; an override is serialized', () => {
    const {engine, fixture} = setup('Undead');
    fixture.buffs = []; delete fixture.buffsAdd;
    const normal = createConfiguredPlayer(engine, fixture);
    assert.equal(normal.base.stamod, 1);
    const sumStamina = engine.evaluate(`(() => {
        const race = levelstats.find(row => row.startsWith('5,1,60,')).split(',');
        const items = Object.values(gear).flat().filter(item => item.selected);
        const enchants = Object.values(enchant).flat().filter(item => item.selected && !item.temp);
        return Number(race[5]) + [...items, ...enchants].reduce((sum, item) => sum + (item.sta || 0), 0);
    })()`);
    assert.equal(normal.stamina, sumStamina);
    assert.equal(normal.maxhealth, 1689 + 20 + (sumStamina - 20) * 10);
    // Compare an item with identical offensive stats and 40 additional Stamina.
    const item = engine.evaluate('JSON.parse(JSON.stringify(gear.head.find(item => item.selected)))');
    fixture.itemsAdd = [{slot: 'head', item: {...item, id: 9000501, sta: (item.sta || 0) + 40}}];
    fixture.gear = {head: [9000501]};
    const extra = createConfiguredPlayer(engine, fixture);
    assert.equal(extra.maxhealth, normal.maxhealth + 400);
    fixture.buffs = [20217, 24425, 22818, 9885, 17055, 15366, 16609, 13510];
    const buffed = createConfiguredPlayer(engine, fixture);
    assert.equal(buffed.stamina, Math.floor((extra.base.sta + 16 + 15) * 1.1 * 1.15 * 1.15));
    assert.equal(buffed.maxhealth, 1689 + 20 + (buffed.stamina - 20) * 10 + 1500);
    fixture.player.maxhealth = '7500';
    const override = createConfiguredPlayer(engine, fixture);
    assert.equal(override.maxhealth, 7500);
    assert.equal(override.serializeSimulationSpec(fixture.sim).player.props.maxhealth, 7500);
    for (const invalid of ['', 'bad', '0', '-1', 'Infinity']) {
        fixture.player.maxhealth = invalid;
        assert.equal(createConfiguredPlayer(engine, fixture).maxhealth, buffed.maxhealth);
    }
});

test('health includes Endurance, excludes removed Vitality, and uses Human base Stamina for Skyborne', () => {
    const {player: p, run} = setup('Tauren');
    const normal = p.maxhealth;
    p.race = 'Undead'; p.resolveHealth();
    assert.equal(normal, Math.round(p.maxhealth * 1.05));
    p.base.stamod = 1;
    assert.equal(run('talents[2].t.some(t => t.n === "Vitality")'), false);
    run('p.addTalents(); p.resolveHealth()');
    close(p.base.stamod, 1);
    assert.equal(p.stamina, Math.floor(p.base.sta));
    assert.equal(setup('Skyborne').player.stamina, setup('Human').player.stamina);
});

test('Eureka becomes usable again at exactly two minutes and re-applies the 40% discount', () => {
    const {player: p, run} = eurekaSetup();
    p.auras.eureka.prep(200000);
    const bt = p.spells.bloodthirst, cost = bt.eurekabasecost;
    for (let i = 0; i < 3; i++) { p.rage = 100; p.cast(bt); }
    run('step = 119999'); assert.equal(p.auras.eureka.canUse(), false);
    run('step = 120000'); assert.equal(p.auras.eureka.canUse(), true);
    p.auras.eureka.use();
    close(bt.cost, cost * .6);
    assert.equal(p.auras.eureka.stacks, 3);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Berserking details and tooltips match the selected rules`, () => {
    const {engine, run} = setup('Troll', mode);
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const rows = [];
    const element = {
        find() { return this; }, data() { return this; }, empty() { return this; },
        append(value) { if (typeof value === 'string') rows.push(value); return this; },
        css() { return this; }, height() { return 0; },
    };
    engine.evaluate('$ = () => element; setTimeout = () => {}; SIM.SETTINGS.rotation = element;', {element});
    run('SIM.SETTINGS.buildSpellDetails(spells.find(s => s.id == 26296), element)');
    assert.equal(rows.join('').includes('name="haste"'), mode === 'classic');
    const description = run(`racialSpellDescription(spells.find(s => s.id == 26296), '${mode}')`);
    if (mode === 'forever') assert.match(description, /10% for 10 seconds/);
    else assert.equal(description, undefined);
});

test('saved racial tooltips cannot restore the old provisional values', () => {
    const {run} = setup('Gnome');
    const eureka = run("racialSpellDescription({id: 'forever:eureka', localDescription: 'Old: 10% and 3 minutes'}, 'forever')");
    assert.match(eureka, /40% less rage/);
    assert.match(eureka, /2-minute cooldown/);
    assert.doesNotMatch(eureka, /Provisional/);
    assert.match(run("racialSpellDescription({id: 'forever:elunes-light'}, 'forever')"), /3-minute cooldown/);
});
