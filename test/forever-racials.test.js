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

test('Ruthless and Savage add crit to autoattacks, abilities and spells with any weapon', () => {
    // Isolate the racial: only the base stance's crit remains.
    const isolate = p => {
        p.base.crit = p.base.spellcrit = p.base.agi = p.talents.crit = 0;
        p.target.level = p.level;
        p.addRacialBonuses(); p.updateAuras();
    };
    const neutral = setup('Night Elf').player;
    isolate(neutral);
    for (const [race, bonus] of [['Human', 2], ['Orc', 1], ['Dwarf', 0], ['Tauren', 0]]) {
        for (const type of [0, 1, 2, 3]) {
            const {player: p, run} = setup(race);
            isolate(p);
            close(p.crit - neutral.crit, bonus);
            close(p.stats.spellcrit - neutral.stats.spellcrit, bonus);
            p.crit -= neutral.crit;
            for (const hand of ['mh', 'oh']) {
                Object.assign(p[hand], {type, crit: 0, miss: 0, dwmiss: 0, dodge: 0, glanceChance: 0});
                if (bonus) {
                    run(`rng10k = () => ${bonus * 100 - 1}`);
                    assert.equal(run(`p.rollmeleespell(p.spells.whirlwind, p.${hand})`), 3);
                    assert.equal(run(`p.rollweapon(p.${hand})`), 3);
                }
                run(`rng10k = () => ${bonus * 100}`);
                assert.equal(run(`p.rollmeleespell(p.spells.whirlwind, p.${hand})`), 0);
                assert.equal(run(`p.rollweapon(p.${hand})`), 0);
            }
        }
    }
    // Classic keeps its weapon skill racials instead.
    assert.equal(setup('Human', 'classic').player.base.crit, setup('Night Elf', 'classic').player.base.crit);
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
        close(sky.stats.haste / human.stats.haste, 1.03);
    }
    assert.match(fs.readFileSync('index.html','utf8'), /value="Skyborne"/);
    assert.doesNotMatch(fs.readFileSync('classic.html','utf8'), /value="Skyborne"/);
});

test('Endurance no longer adds hit; Expansive Mind multiplies the talented rage cap', () => {
    const normal = setup().player;
    const tauren = setup('Tauren').player;
    assert.equal(tauren.base.hit, normal.base.hit);
    assert.equal(tauren.target.misschance, normal.target.misschance);
    assert.equal(tauren.target.binaryresist, normal.target.binaryresist);
    for (const p of [normal, tauren]) p.update();
    assert.equal(tauren.mh.dwmiss, normal.mh.dwmiss);
    assert.equal(tauren.oh.dwmiss, normal.oh.dwmiss);
    const gnome = setup('Gnome').player;
    close(gnome.ragecap, normal.ragecap * 1.05);
    gnome.reset(1000);
    close(gnome.rage, gnome.ragecap);
});

test('Earth Fury and Endurance add 2 points to every critical strike damage bonus', () => {
    for (const race of ['Human', 'Orc', 'Night Elf', 'Gnome', 'Undead', 'Troll', 'Skyborne'])
        assert.equal(setup(race).player.critbonus, 0, race);
    for (const race of ['Dwarf', 'Tauren']) assert.equal(setup(race, 'classic').player.critbonus, 0);
    for (const race of ['Dwarf', 'Tauren']) {
        const {player: p, run} = setup(race);
        assert.equal(p.critbonus, .02);
        // Every roll crits, every damage roll is the maximum, and nothing else varies.
        run(`p.procattack = () => 0; p.proccrit = () => {}; p.armorReduction = 0;
            rng10k = () => 0; rng = (min, max) => max;`);
        for (const hand of ['mh', 'oh']) Object.assign(p[hand], {miss: 0, dwmiss: 0, dodge: 0, glanceChance: 0});
        Object.assign(p.target, {misschance: 0, mitigation: 1});
        p.stats.spellcrit = 5;
        p.talents.abilitiescrit = .2;
        const rend = p.auras.rend;
        // Each hit's crit multiplier without the racial: Impale 2/2 adds .2 to ability crits.
        const hits = {
            white: [2, () => p.attackmh(p.mh)],
            offhand: [2, () => p.attackoh(p.oh)],
            ability: [2.2, () => p.cast(p.spells.bloodthirst)],
            offhandAbility: [2.2, () => p.castoh(p.spells.whirlwind)],
            spell: [1.5, () => p.magicproc({magicdmg: 100})],
            physical: [2, () => p.physproc(100)],
            rendTick: [2.2, () => {
                const before = rend.idmg;
                Object.assign(rend, {stacks: 1, nexttick: 0, timer: 1e9});
                rend.step();
                return rend.idmg - before;
            }],
        };
        for (const [name, [multiplier, hit]] of Object.entries(hits)) {
            p.critbonus = 0;
            const base = hit();
            p.critbonus = .02;
            const boosted = hit();
            assert.ok(base > 0, `${race} ${name} deals damage`);
            close(boosted / base, (multiplier + .02) / multiplier);
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

test('Forever Blood Fury has a 3-minute cooldown; Classic keeps 2 minutes', () => {
    for (const [mode, seconds] of [['forever', 180], ['classic', 120]]) {
        const {player: p, run} = setup('Orc', mode);
        const fury = p.auras.bloodfury;
        assert.equal(fury.cooldown, seconds);
        fury.prep(600000); fury.use();
        run('step = 15000; p.auras.bloodfury.step()');
        p.timer = 0;
        run(`step = ${seconds * 1000 - 1}`); assert.equal(fury.canUse(), false);
        run(`step = ${seconds * 1000}`); assert.equal(fury.canUse(), true);
    }
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

for (const mode of ['classic', 'forever']) test(`${mode}: Blood Fury's GCD and Berserking's rage cost match the selected rules`, () => {
    const forever = mode === 'forever';
    const {player: orc} = setup('Orc', mode);
    const fury = orc.auras.bloodfury;
    fury.prep(60000);
    orc.timer = 1000;
    assert.equal(fury.canUse(), forever, 'only Classic Blood Fury waits for the GCD');
    fury.use();
    assert.equal(orc.timer, forever ? 1000 : 1500, 'only Classic Blood Fury triggers the GCD');

    const {player: troll, engine, fixture} = setup('Troll', mode);
    const zerk = troll.auras.berserking;
    zerk.prep(60000);
    troll.rage = 4;
    assert.equal(zerk.canUse(), forever, 'only Classic Berserking needs 5 rage');
    assert.equal(engine.createSimulation(troll, fixture.sim).reservedRage(), forever ? 0 : 5,
        'only Classic reserves rage for a due Berserking');
    troll.timer = 1000;
    troll.rage = 50;
    zerk.use();
    assert.equal(troll.rage, forever ? 50 : 45);
    assert.equal(troll.timer, 1000, 'Berserking never triggers the GCD');
});

for (const mode of ['classic', 'forever']) test(`${mode}: combat uses Blood Fury and Berserking ${mode === 'forever' ? 'during' : 'after'} the GCD`, () => {
    for (const [race, key] of [['Orc', 'bloodfury'], ['Troll', 'berserking']]) {
        const {player: p, engine, fixture} = setup(race, mode);
        const aura = p.auras[key];
        // Due mid-rotation, where GCD abilities often have the GCD running.
        aura.timetostart = 5000;
        const casts = [];
        const use = aura.use;
        aura.use = function(...args) {
            const before = p.timer;
            use.apply(this, args);
            casts.push([before, p.timer]);
        };
        engine.createSimulation(p, fixture.sim).startSync();
        assert.equal(casts.length, fixture.sim.iterations, `${key} is used once per fight`);
        assert.equal(casts.some(([before]) => before > 0), mode === 'forever', `${key} is used during the GCD`);
        const gcd = mode === 'classic' && key === 'bloodfury';
        for (const [before, after] of casts) assert.equal(after, gcd ? 1500 : before, `${key} GCD`);
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

test('Eureka empowers every cast for exactly 8 seconds, refunds discounted costs, and resets cleanly', () => {
    const {player: p, run} = eurekaSetup();
    const eureka = p.auras.eureka;
    const bt = p.spells.bloodthirst, baseCost = bt.eurekabasecost;
    assert.equal(eureka.timer, 8000);
    close(bt.cost, baseCost * .9);
    const expected = bt.dmg() * p.mh.modifier * 1.1 + p.stats.moddmgtaken;
    for (let i = 0; i < 5; i++) close(p.cast(bt), expected);
    assert.equal(eureka.timer, 8000, 'casts do not consume Eureka!');
    p.rage = 100;
    run('p.rollmeleespell = () => RESULT.DODGE');
    assert.equal(p.cast(bt), 0);
    close(p.rage, 100 - baseCost * .9 * .2);
    run('p.rollmeleespell = () => RESULT.HIT; step = 7999');
    close(p.cast(bt), expected);
    close(bt.cost, baseCost * .9);
    run('step = 8000');
    const plain = p.cast(bt);
    assert.equal(bt.eurekamod, 1);
    close(plain, bt.dmg() * p.mh.modifier + p.stats.moddmgtaken);
    assert.equal(eureka.timer, 0);
    assert.equal(eureka.uptime, 8000);
    close(bt.cost, baseCost);
    run('step = 9000'); eureka.cooldowntimer = 0; eureka.use();
    p.reset(100);
    close(bt.cost, baseCost);
    assert.equal(eureka.timer, 0);
});

test('Eureka does not discount or empower Rend, a periodic ability', () => {
    const {player: p, run} = eurekaSetup();
    const rend = p.auras.rend, cost = rend.cost;
    assert.equal(rend.eurekabasecost, undefined);
    assert.equal(p.cast(rend), 0);
    assert.equal(rend.eurekamod, 1);
    run('rng10k = () => 9999');
    const tick = () => {
        const before = rend.idmg;
        Object.assign(rend, {stacks: 1, nexttick: 0, timer: 1e9});
        rend.step();
        return rend.idmg - before;
    };
    const empowered = tick();
    p.auras.eureka.end();
    close(rend.cost, cost);
    assert.ok(empowered > 0);
    close(empowered, tick());
});

test('Eureka applies at queued swing execution and to every Whirlwind hit', () => {
    const {player: p, run} = eurekaSetup();
    p.cast(p.spells.heroicstrike);
    p.attackmh(p.mh);
    assert.equal(p.spells.heroicstrike.eurekamod, 1.1);
    p.nextswinghs = false;
    const ww = p.spells.whirlwind;
    p.cast(ww);
    assert.equal(ww.eurekamod, 1.1);
    p.castoh(ww);
    p.cast(ww, null, 1);
    assert.equal(ww.eurekamod, 1.1);
    // A strike queued during Eureka! swings after it expires at full cost and damage.
    const hs = p.spells.heroicstrike, cost = hs.eurekabasecost;
    close(hs.cost, cost * .9);
    p.cast(hs);
    run('step = 8000');
    p.rage = 100;
    p.attackmh(p.mh);
    assert.equal(hs.eurekamod, 1);
    close(hs.cost, cost);
    close(p.rage, 100 - cost);
    p.cast(ww);
    assert.equal(ww.eurekamod, 1);
});

test('Eureka expires exactly at 8 seconds during combat, before any later rage check', () => {
    const {player: p, engine, fixture} = setup('Gnome');
    const eureka = p.auras.eureka;
    const expirations = [];
    const stepAura = eureka.step;
    eureka.step = function() {
        const active = this.timer;
        stepAura.call(this);
        if (active && !this.timer) expirations.push([engine.evaluate('step'), this.starttimer]);
    };
    engine.createSimulation(p, fixture.sim).startSync();
    assert.ok(expirations.length >= fixture.sim.iterations);
    for (const [at, start] of expirations) assert.equal(at, start + 8000);
});

test('Touch of the Grave has a 20% chance, scales with HP and shares a 25 second cooldown', () => {
    const {player: p, run} = setup('Undead');
    const grave = p.auras.touchofthegrave;
    p.maxhealth = 6000;
    assert.equal(grave.chance, 2000);
    assert.equal(grave.cooldown, 25);
    run('rng10k = () => 1999; p.magicproc = proc => proc.magicdmg;');
    for (const result of ['MISS', 'DODGE']) run(`p.dealdamage(100, RESULT.${result}, p.mh, null, false)`);
    run('p.dealdamage(0, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 0);
    run('p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 300);
    run('p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 300, 'simultaneous off-hand hit shares the cooldown');
    run('step = 24999; p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 300);
    run('step = 25000; p.dealdamage(100, RESULT.HIT, p.oh, null, false)');
    assert.equal(grave.totaldmg, 600, 'off-hand can proc at exactly 25 seconds');
    run('step = 50000; rng10k = () => 2000; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
    assert.equal(grave.totaldmg, 600, 'roll 2000 is outside the 20% proc range');
    p.maxhealth = 12000;
    run('rng10k = () => 1999; p.dealdamage(100, RESULT.HIT, p.mh, null, false)');
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
    run('rng10k = () => 1999');
    for (const reduction of [0, .25, .5, .75]) {
        p.armorReduction = reduction;
        for (const defense of ['MELEE', 'MAGIC']) {
            const before = p.auras.touchofthegrave.totaldmg;
            run(`step += 25000; p.dealdamage(100, RESULT.MISS, p.mh,
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

test('Eureka becomes usable again at exactly two minutes and re-applies the 10% discount', () => {
    const {player: p, run} = eurekaSetup();
    p.auras.eureka.prep(200000);
    const bt = p.spells.bloodthirst, cost = bt.eurekabasecost;
    run('step = 8000; p.auras.eureka.step()');
    close(bt.cost, cost);
    run('step = 119999'); assert.equal(p.auras.eureka.canUse(), false);
    run('step = 120000'); assert.equal(p.auras.eureka.canUse(), true);
    p.auras.eureka.use();
    close(bt.cost, cost * .9);
    assert.equal(p.auras.eureka.timer, 128000);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Berserking details and tooltips match the selected rules`, () => {
    const {engine, run} = setup('Troll', mode);
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const rows = [];
    const element = {
        find() { return this; }, data() { return this; }, empty() { return this; },
        append(value) { if (typeof value === 'string') rows.push(value); return this; },
        css() { return this; }, height() { return 0; }, hasClass() { return false; }, val() { return ''; },
    };
    engine.evaluate('$ = () => element; setTimeout = () => {}; SIM.SETTINGS.rotation = SIM.SETTINGS.fight = element;', {element});
    run('SIM.SETTINGS.buildSpellDetails(spells.find(s => s.id == 26296), element)');
    assert.equal(rows.join('').includes('name="haste"'), mode === 'classic');
    const description = run(`racialSpellDescription(spells.find(s => s.id == 26296), '${mode}')`);
    if (mode === 'forever') assert.match(description, /10% for 10 seconds/);
    else assert.equal(description, undefined);
});

test('saved racial tooltips cannot restore the old provisional values', () => {
    const {run} = setup('Gnome');
    const eureka = run("racialSpellDescription({id: 'forever:eureka', localDescription: 'Your next three abilities'}, 'forever')");
    assert.match(eureka, /For 8 seconds/);
    assert.match(eureka, /10% less rage/);
    assert.match(eureka, /2-minute cooldown/);
    assert.doesNotMatch(eureka, /next three|Provisional/);
    assert.match(run("racialSpellDescription({id: 'forever:elunes-light'}, 'forever')"), /3-minute cooldown/);
    assert.match(run("racialSpellDescription({id: 20572, localDescription: 'Old'}, 'forever')"), /3-minute cooldown/);
    const descriptions = run('JSON.stringify(foreverRacialDescriptions)');
    assert.doesNotMatch(descriptions, /Specialization|\+1% hit|\+1% haste|5% chance|1 second/);
});
