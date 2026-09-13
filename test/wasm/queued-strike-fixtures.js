'use strict';

const {loadFixtures} = require('./reference-engine');

function queuedStrikeFixtures() {
    return ['classic', 'forever'].flatMap(mode => ['heroicstrike', 'cleave'].map(key => {
        const fixture = structuredClone(loadFixtures().find(value => value.mode === mode));
        fixture.name = `${mode}-${key}-saved-unqueue`;
        fixture.buffs = [];
        delete fixture.buffsAdd;
        delete fixture.expect;
        fixture.playerOverrides = {basestance: 'zerk'};
        fixture.player.adjacent = key === 'cleave' ? 1 : 0;
        fixture.sim = {...fixture.sim, timesecsmin: 6, timesecsmax: 6,
            iterations: 8, startrage: 100, executeperc: 0};
        const options = {active: true, minrageactive: false, maincdactive: false,
            unqueueactive: true, unqueue: 1000, exmacro: true};
        fixture.rotation = {
            11567: {active: false},
            25286: {...options, active: key === 'heroicstrike'},
            20569: {...options, active: key === 'cleave'},
        };
        fixture.mutatePlayer = player => {
            // Only white swings and the queued strike: Classic always cancels
            // below this threshold; Forever must ignore the saved option.
            player.spells = {stanceswitch: player.spells.stanceswitch, [key]: player.spells[key]};
            player.auras = {};
            player.preporder = [];
            for (const talent of Object.keys(player.talents)) player.talents[talent] = 0;
            for (const weapon of [player.mh, player.oh]) {
                weapon.proc1 = weapon.proc2 = weapon.windfury = null;
                weapon.speed = 2;
            }
            player.trinketproc1 = player.trinketproc2 = player.attackproc1 = player.attackproc2 = null;
            player.sortSpells();
        };
        return fixture;
    }));
}

module.exports = {queuedStrikeFixtures};
