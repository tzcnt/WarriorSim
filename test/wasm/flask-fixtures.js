'use strict';
const {loadFixtures} = require('./reference-engine');

// Forever-only flasks, keyed by the zone bonus they grant.
const NATURAL_FLASKS = {swiftness: 274276, aggression: 274274, accuracy: 274273, precision: 274275};

function flaskFixtures() {
    return Object.entries(NATURAL_FLASKS).map(([bonus, id]) => {
        const fixture = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        fixture.name = `forever-natural-${bonus}-flask`;
        fixture.sim = {...fixture.sim, iterations: 8};
        fixture.buffsAdd = [...(fixture.buffsAdd || []), id];
        return fixture;
    });
}
module.exports = {NATURAL_FLASKS, flaskFixtures};
