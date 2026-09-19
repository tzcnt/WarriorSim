'use strict';
const {loadFixtures} = require('./reference-engine');

function frenzyFixtures() {
    return ['classic', 'forever'].flatMap(mode => [false, true].map(fromEnd => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
        fixture.name = `${mode}-major-frenzy-${fromEnd ? 'end' : 'start'}`;
        fixture.sim = {...fixture.sim, timesecsmin: 280, timesecsmax: 280, iterations: 3};
        fixture.rotation = {'major-frenzy-potion': {
            active: true, timetostartactive: !fromEnd, timetostart: 0,
            timetoendactive: fromEnd, timetoend: 31,
        }};
        fixture.buffsAdd = ['elixir-of-the-grizzly', 'elixir-of-ferocity'];
        return fixture;
    }));
}
module.exports = {frenzyFixtures};
