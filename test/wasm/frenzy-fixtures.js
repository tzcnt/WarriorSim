'use strict';
const {loadFixtures} = require('./reference-engine');

function frenzyFixtures() {
    // The potion and elixirs are Forever-only.
    return [false, true].map(fromEnd => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        fixture.name = `forever-major-frenzy-${fromEnd ? 'end' : 'start'}`;
        fixture.sim = {...fixture.sim, timesecsmin: 280, timesecsmax: 280, iterations: 3};
        fixture.rotation = {1251940: {
            active: true, timetostartactive: !fromEnd, timetostart: 0,
            timetoendactive: fromEnd, timetoend: 31,
        }};
        fixture.buffsAdd = [250351, 250350]; // Elixir of the Grizzly and Elixir of Ferocity
        return fixture;
    });
}
module.exports = {frenzyFixtures};
