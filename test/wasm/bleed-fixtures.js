'use strict';
const {loadFixtures} = require('./reference-engine');

function bleedFixtures() {
    return ['classic', 'forever'].flatMap(mode => [0, 1, 2].map(impale => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
        fixture.name = `${mode}-bleeds-impale-${impale}`;
        fixture.player.adjacent = 3;
        fixture.playerOverrides = {basestance: 'battle'};
        fixture.sim = {...fixture.sim, timesecsmin: 42, timesecsmax: 45, iterations: 8, startrage: 60};
        fixture.rotation = {
            11567: {active: false}, 25286: {active: false},
            20569: {active: true, minrageactive: true, minrage: 20},
            11574: {active: true, priority: 10, expriority: 10, durationactive: false},
        };
        fixture.mutatePlayer = player => { player.talents.abilitiescrit = impale * .1; };
        fixture.expect = {auras: ['rend', 'deepwounds', 'deepwounds2']};
        return fixture;
    }));
}

module.exports = {bleedFixtures};
