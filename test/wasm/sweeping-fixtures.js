'use strict';
const {loadFixtures} = require('./reference-engine');

function sweepingFixtures() {
    const cleave = structuredClone(loadFixtures().find(f => f.name === 'classic-adjacent-cleave'));
    cleave.name = 'classic-sweeping-strikes-cleave';
    delete cleave.expect;
    cleave.talents = [[3,5,3,0,5,0,2,1,1,0,0,0,1,0,0,0,0,0], Array(17).fill(0), Array(17).fill(0)];
    cleave.player.adjacent = 2;
    cleave.player.target = {...cleave.player.target, speed: 1000, mindmg: 1500, maxdmg: 1500};
    cleave.playerOverrides = {basestance: 'battle'};
    cleave.sim = {...cleave.sim, timesecsmin: 45, timesecsmax: 45, startrage: 100, iterations: 8};
    cleave.rotation = {
        12292: {active: true},
        23894: {active: false}, 1680: {active: false}, 20662: {active: false},
        18499: {active: false}, 11597: {active: false},
        7373: {active: true, priority: 5, expriority: 5, minrageactive: false},
        20569: {active: true, minrageactive: false},
    };

    const expiry = structuredClone(cleave);
    expiry.name = 'classic-sweeping-strikes-unused-charges-expire';
    expiry.player.target.speed = 0;
    expiry.sim.timesecsmin = expiry.sim.timesecsmax = 25;
    expiry.mutatePlayer = player => {
        // No attacks after activation: expiration must still happen on time.
        player.oh = null;
        Object.assign(player.mh, {speed: 40, proc1: null, proc2: null, windfury: null});
        player.trinketproc1 = player.trinketproc2 = null;
        player.attackproc1 = player.attackproc2 = null;
        player.spells = {stanceswitch: player.spells.stanceswitch};
        player.auras = {sweepingstrikes: player.auras.sweepingstrikes};
        player.preporder = [];
        player.sortSpells();
    };

    const single = structuredClone(cleave);
    single.name = 'classic-sweeping-strikes-no-adjacent-target';
    single.player.adjacent = 0;
    single.rotation[20569].active = false;
    return [cleave, expiry, single];
}

module.exports = {sweepingFixtures};
