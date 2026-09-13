'use strict';

const {loadFixtures} = require('./reference-engine');
const {foreverFixtures} = require('./forever-fixtures');
const {sweepingFixtures} = require('./sweeping-fixtures');
const {queuedStrikeFixtures} = require('./queued-strike-fixtures');
const {
    bloodrageCases, stanceCases, aliasCases, orderedProcs,
} = require('./ability-proc-fixtures');

function extraFixtures() {
    const fixtures = loadFixtures();
    const base = name => structuredClone(fixtures.find(fixture => fixture.name === name));

    const phantom = base('classic-dw-fury');
    phantom.name = 'classic-recursive-physical-phantom';
    phantom.weaponOverrides = {mh: {proc1: {chance: 3500, physdmg: 120, phantom: true}}};
    phantom.player.target.basearmor = 12000;

    const suppression = base('classic-dw-fury');
    suppression.name = 'classic-target-six-levels-higher';
    suppression.player.target.level = 66;
    suppression.player.target.defense = 330;

    const long = base('classic-dw-fury');
    long.name = 'classic-long-on-use-orc';
    long.player.race = 'Orc';
    long.sim = {...long.sim, timesecsmin: 190, timesecsmax: 191, iterations: 3};
    long.gear = {trinket1: [20130], trinket2: []};
    long.rotation = {
        20572: {active: true, timetostartactive: true, timetostart: 0},
        20130: {timetostartactive: true, timetostart: 0},
    };

    const trinkets = base('classic-dw-fury');
    trinkets.name = 'classic-long-slayer-spider';
    trinkets.sim = {...trinkets.sim, timesecsmin: 190, timesecsmax: 191, iterations: 3};
    trinkets.gear = {trinket1: [23041], trinket2: [22954]};
    trinkets.rotation = {
        23041: {timetostartactive: true, timetostart: 0},
        22954: {timetostartactive: true, timetostart: 0},
    };

    const earthstrike = structuredClone(trinkets);
    earthstrike.name = 'classic-long-earthstrike';
    earthstrike.gear = {trinket1: [21180], trinket2: []};
    earthstrike.rotation = {21180: {timetostartactive: true, timetostart: 0}};

    const priority = base('classic-dw-fury');
    priority.name = 'classic-stable-action-priorities';
    priority.rotation = {
        23894: {active: true, priority: 7, expriority: 4},
        1680: {active: true, priority: 7, expriority: 4},
        20662: {active: true, priority: 5, expriority: 10},
    };

    const clocks = base('classic-dw-fury');
    clocks.name = 'classic-fractional-periodic-clocks';
    clocks.sim = {...clocks.sim, timesecsmin: 12, timesecsmax: 12, iterations: 8};
    clocks.player.target = {...clocks.player.target, speed: 1250.5, mindmg: 90, maxdmg: 90};
    clocks.rotation = {2687: {active: true, timetostartactive: true, timetostart: 0}};

    const gabbar = base('classic-dw-fury');
    gabbar.name = 'classic-vael-prepull-gabbar-clocks';
    gabbar.sim = {...gabbar.sim, timesecsmin: 22, timesecsmax: 22, iterations: 8};
    gabbar.gear = {trinket1: [23570], trinket2: []};
    gabbar.buffsAdd = [23513];
    gabbar.rotation = {23570: {active: true, timetostartactive: true, timetostart: -1}};

    const hamstring = base('classic-dw-fury');
    hamstring.name = 'classic-hamstring-inherited-eligibility';
    hamstring.sim = {...hamstring.sim, timesecsmin: 16, timesecsmax: 16, iterations: 6, startrage: 100};
    hamstring.rotation = {
        7373: {active: true, priority: 10, expriority: 10, minrageactive: false,
            maincdactive: true, maincd: 999, durationactive: true, duration: 4},
    };

    const swordResets = ['classic', 'forever'].map(mode => {
        const fixture = base('classic-dw-fury');
        fixture.name = `${mode}-sword-proc-fight-reset`;
        fixture.mode = mode;
        fixture.buffs = [];
        delete fixture.buffsAdd;
        delete fixture.expect;
        fixture.sim = {...fixture.sim, timesecsmin: 1, timesecsmax: 1, iterations: 8};
        fixture.mutatePlayer = player => {
            // Force one opening sword proc per fight. Its extra swing must not
            // proc again at that timestamp, but the next fight must be eligible.
            player.talents.swordproc = 100;
            player.base.hit = 100;
            player.target.dodge = 100;
            player.oh = null;
            Object.assign(player.mh, {type: 1, speed: 10, proc1: null, proc2: null, windfury: null});
            player.trinketproc1 = player.trinketproc2 = null;
            player.attackproc1 = player.attackproc2 = null;
            player.spells = {stanceswitch: player.spells.stanceswitch};
            player.auras = {};
            player.preporder = [];
            player.sortSpells();
        };
        return fixture;
    });

    return [
        phantom, suppression, long, trinkets,
        earthstrike, priority, clocks, gabbar, hamstring, ...bloodrageCases, ...stanceCases,
        ...aliasCases, orderedProcs, ...foreverFixtures(), ...swordResets, ...sweepingFixtures(), ...queuedStrikeFixtures(),
    ];
}

module.exports = {extraFixtures};
