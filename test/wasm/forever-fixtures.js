'use strict';
const {loadFixtures} = require('./reference-engine');

function foreverFixtures() {
    const base = () => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        fixture.sim = {...fixture.sim, timesecsmin: 42, timesecsmax: 45, iterations: 8, startrage: 60};
        fixture.talentSchema = 'forever-v2';
        delete fixture.expect;
        return fixture;
    };
    const arms = base();
    arms.name = 'forever-arms-slam-bloodthrill-sweeping-spearing';
    arms.talents = [
        [3,5,3,0,5,2,1,3,1,3,2,5,1,5,2,0,1],
        [0,5,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0], Array(18).fill(0),
    ];
    arms.gear = {mainhand: [], offhand: [], twohand: [19334]};
    arms.player.adjacent = 2;
    arms.player.target.creaturetype = 'Dragonkin';
    arms.player.target.speed = 2000;
    arms.player.target.mindmg = arms.player.target.maxdmg = 200;
    arms.playerOverrides = {basestance: 'battle'};
    arms.rotation = {
        11567: {active: false}, 25286: {active: false}, 11597: {active: false},
        1680: {active: false}, 18499: {active: false},
        27580: {active: true, priority: 8, expriority: 3},
        11574: {active: true, priority: 10, expriority: 1, durationactive: false},
        11605: {active: true, priority: 4, expriority: 1, minrageactive: false, afterswing: false},
        'forever:spearing-strike': {active: true},
        'forever:sweeping-strikes': {active: true},
    };
    arms.expect = {spells: ['spearingstrike', 'slam', 'mortalstrike'], auras: ['sweepingstrikes', 'rend']};

    const pause = structuredClone(arms);
    pause.name = 'forever-untalented-slam-pauses';
    pause.talents[0][14] = 0;
    pause.player.adjacent = 0;
    pause.player.target.creaturetype = 'Mounted';
    pause.rotation['forever:sweeping-strikes'].active = false;
    delete pause.expect;

    const mace = structuredClone(arms);
    mace.name = 'forever-mixed-mace-sword-armor-bypass';
    delete mace.gear;
    mace.expect.spells = ['slam', 'mortalstrike'];
    mace.weaponOverrides = {mh: {type: 0}, oh: {type: 1}};
    mace.player.target.basearmor = 9000;

    const fury = base();
    fury.name = 'forever-offhand-whirlwind-cleave-enrage';
    fury.player.adjacent = 3;
    fury.player.target = {...fury.player.target, speed: 2000, mindmg: 250, maxdmg: 350};
    fury.rotation = {11567: {active: false}, 25286: {active: false}, 20569: {active: true, minrageactive: true, minrage: 40}};
    fury.expect = {spells: ['whirlwind', 'cleave'], auras: ['enrage']};

    const shield = base();
    shield.name = 'forever-shield-bastion-focused-bloodrage';
    shield.talents = [Array(17).fill(0),
        [0,5,0,5,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [5,5,2,5,3,0,2,0,0,3,0,0,0,1,0,3,5,1]];
    shield.itemsAdd = [{slot: 'offhand', item: {id: 9000001, name: 'Test Shield', type: 'Shield', block: 60}}];
    shield.gear = {offhand: [9000001]};
    shield.playerOverrides = {basestance: 'def'};
    shield.rotation = {11597: {active: false}, 18499: {active: false}, 23925: {active: true, priority: 10, expriority: 10},
        2687: {active: true, timetostartactive: true, timetostart: 0}};
    shield.expect = {spells: ['shieldslam'], auras: ['bloodrage']};

    const cap = base();
    cap.name = 'forever-130-rage-passive-and-active-sources';
    cap.talents = [[3,0,3,0,5,0,1,3,0,0,2,0,0,0,0,0,0],
        [0,5,0,5,3,0,0,3,5,1,5,0,0,1,0,0,5,1], Array(18).fill(0)];
    cap.sim.startrage = 130;
    cap.buffsAdd = [...(cap.buffsAdd || []), 23513];
    cap.rotation = {2687: {active: true, timetostartactive: true, timetostart: 0},
        17528: {active: true, timetostartactive: true, timetostart: 0}};
    return [arms, pause, mace, fury, shield, cap];
}
module.exports = {foreverFixtures};
