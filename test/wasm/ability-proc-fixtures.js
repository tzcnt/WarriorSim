'use strict';

const configuredFixtures = require('./fixtures.json');
const dualWield = configuredFixtures.find(value => value.name === 'classic-dw-fury');
const adjacentCleave = configuredFixtures.find(value => value.name === 'classic-adjacent-cleave');

function copy(value) {
    return JSON.parse(JSON.stringify(value));
}

function bounded(base, name, seed, iterations = 6) {
    const fixture = copy(base);
    fixture.name = name;
    fixture.sim = {
        ...fixture.sim,
        timesecsmin: 16,
        timesecsmax: 16,
        iterations,
        seed,
    };
    return fixture;
}

function bloodrage(name, seed, schedule, mutatePlayer) {
    const fixture = bounded(dualWield, name, seed);
    fixture.rotation = {
        2687: {
            active: true,
            timetostartactive: false,
            timetoendactive: false,
            ...schedule,
        },
    };
    fixture.mutatePlayer = mutatePlayer;
    return fixture;
}

const bloodrageCases = [
    bloodrage('classic-bloodrage-start-schedule', 0xB1000001, {
        timetostartactive: true,
        timetostart: 3,
    }),
    bloodrage('classic-bloodrage-end-schedule', 0xB1000002, {
        timetoendactive: true,
        timetoend: 12,
    }),
    bloodrage('classic-bloodrage-explicit-step', 0xB1000003, {}, player => {
        player.spells.bloodrage.usestep = 4500;
    }),
    bloodrage('classic-bloodrage-unscheduled', 0xB1000004, {}, player => {
        delete player.spells.bloodrage.usestep;
    }),
];

const stanceCases = ['classic', 'forever'].map(mode => {
    const fixture = bounded(dualWield, `${mode}-overpower-stance-switch`, 0x57A00001, 8);
    fixture.mode = mode;
    fixture.sim.startrage = 100;
    fixture.rotation = {
        11585: {active: true, priority: 10, expriority: 10, maxrageactive: false, maincdactive: false},
    };
    fixture.mutatePlayer = player => {
        player.talents.rageretained = 25;
        // Make dodges frequent enough to exercise Battle Stance and the return
        // to Berserker Stance during the same simulation in both engines.
        player.base.skill_0 = 225;
        player.base.skill_1 = 225;
        player.update();
    };
    return fixture;
});

function aliasCase(key, seed) {
    const fixture = bounded(dualWield, `classic-${key}-supported-kind-alias`, seed, 3);
    fixture.mutatePlayer = (player, engine) => {
        const alias = engine.createSpell(player, 'GrilekFury');
        alias.usestep = 0;
        player.spells[key] = alias;
    };
    return fixture;
}

const aliasCases = [
    aliasCase('bloodrage', 0xA11A5001),
    aliasCase('stanceswitch', 0xA11A5003),
];

const armorProcs = [
    {key: 'bonereaver', slot: 'twohand', id: 17076, duration: 10, armor: 700},
    {key: 'annihilator', slot: 'mainhand', id: 12798, duration: 45, armor: 200},
    {key: 'rivenspike', slot: 'mainhand', id: 13286, duration: 30, armor: 200},
];

const armorProcCases = armorProcs.flatMap(proc => ['classic', 'forever'].flatMap(mode => [false, true].map(expires => {
    const speed = expires ? proc.duration + 1 : 4;
    const fixture = bounded(dualWield, `${mode}-${proc.key}-${expires ? 'expiry' : 'refresh'}`, 0xB0E00001, 8);
    fixture.armorProc = proc;
    fixture.mode = mode;
    fixture.gear = {mainhand: [], offhand: [], twohand: [], [proc.slot]: [proc.id]};
    fixture.buffs = [];
    delete fixture.buffsAdd;
    fixture.player.target.basearmor = 4000;
    fixture.sim.timesecsmin = fixture.sim.timesecsmax = expires ? 3 * speed + 1 : 34;
    fixture.expect = {auras: [proc.key]};
    fixture.mutatePlayer = player => {
        // Guaranteed procs on isolated swings exercise either full expiration
        // between procs or repeated refreshes at the three-stack cap.
        player.basestance = 'battle';
        player.base.hit = 100;
        player.base.haste = 1;
        player.target.dodge = 100;
        player.target.binaryresist = 0;
        player.faeriefire = false;
        player.talents.swordproc = 0;
        player.mh.speed = speed;
        player.mh.proc1.chance = 10000;
        player.mh.proc2 = player.mh.windfury = null;
        player.trinketproc1 = player.trinketproc2 = null;
        player.attackproc1 = player.attackproc2 = null;
        player.spells = {stanceswitch: player.spells.stanceswitch};
        player.auras = {[proc.key]: player.auras[proc.key]};
        player.preporder = [];
        player.sortSpells();
    };
    return fixture;
})));

const orderedProcs = bounded(adjacentCleave, 'classic-ordered-multi-procs', 0xC01DF00D, 12);
orderedProcs.mutatePlayer = (player, engine) => {
    player.faeriefire = false; // Let each Annihilator activation roll spell resistance.
    const weaponArmor = engine.createAura(player, 'Annihilator');
    const trinketArmor = engine.createAura(player, 'Annihilator');
    const attackArmor = engine.createAura(player, 'Annihilator');
    player.auras.procweaponarmor = weaponArmor;
    player.auras.proctrinketarmor = trinketArmor;
    player.auras.procattackarmor = attackArmor;

    // The zero-chance slots are intentional: JavaScript still consumes their
    // trigger rolls before the later random procs in this chain.
    player.mh.proc1 = {chance: 10000, magicdmg: 11, spell: weaponArmor};
    player.mh.proc2 = {chance: 0, magicdmg: 13};
    player.oh.proc1 = {chance: 0, extra: 1};
    player.oh.proc2 = {chance: 10000, magicdmg: 5};
    player.trinketproc1 = {chance: 6500, magicdmg: 17, spell: trinketArmor};
    player.trinketproc2 = {chance: 3500, extra: 1, cooldown: 2300, usestep: 0};
    player.attackproc1 = {chance: 10000, magicdmg: 19, spell: attackArmor};
    player.attackproc2 = {chance: 2600, extra: 1};
    player.base.hit -= 10;
    player.update();
};

module.exports = {
    aliasCases,
    armorProcCases,
    bloodrageCases,
    orderedProcs,
    stanceCases,
};
