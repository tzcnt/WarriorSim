'use strict';
const {loadFixtures} = require('./reference-engine');

function berserkerRageFixtures() {
    return ['classic', 'forever'].flatMap(mode => [false, true].map(zerkerpriority => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
        fixture.name = `${mode}-berserker-rage-${zerkerpriority ? 'before' : 'after'}-bloodrage`;
        fixture.player.reactionmin = fixture.player.reactionmax = 200;
        fixture.player.spellqueueing = zerkerpriority;
        fixture.sim = {...fixture.sim, timesecsmin: 65, timesecsmax: 65, iterations: 8, startrage: 60};
        fixture.rotation = {
            18499: {active: true, zerkerpriority, maxrageactive: true, maxrage: zerkerpriority ? 0 : 25},
            2687: {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false},
        };
        fixture.mutatePlayer = player => {
            player.talents.berserkerbonus = player.spells.berserkerrage.rage = 10;
        };
        fixture.expect = {auras: ['berserkerrage', 'bloodrage']};
        return fixture;
    }));
}

module.exports = {berserkerRageFixtures};
