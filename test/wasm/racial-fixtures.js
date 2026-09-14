'use strict';
const {loadFixtures} = require('./reference-engine');
const {foreverFixtures} = require('./forever-fixtures');

function racialFixtures() {
    const fixtures = ['Human','Dwarf','Night Elf','Gnome','Orc','Undead','Tauren','Troll','Skyborne'].map(race => {
        const f = structuredClone(loadFixtures().find(f => f.mode === 'forever'));
        f.name = 'forever-racial-' + race.toLowerCase().replace(' ', '-');
        f.player.race = race;
        f.player.target.creaturetype = race === 'Skyborne' ? 'Elemental' : 'Beast';
        f.sim = {...f.sim, timesecsmin: 195, timesecsmax: 200, iterations: 8, startrage: 100};
        f.player.adjacent = 2;
        f.rotation = {
            20572: {active: true, timetostartactive: true, timetostart: 0},
            26296: {active: true, timetostartactive: true, timetostart: 0, haste: 99},
            'forever:elunes-light': {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false},
            'forever:eureka': {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false},
        };
        delete f.expect;
        const key = {Orc: 'bloodfury', Troll: 'berserking', 'Night Elf': 'eluneslight', Gnome: 'eureka', Undead: 'touchofthegrave'}[race];
        if (key) f.expect = {auras: [key]};
        return f;
    });
    for (const hp of [6000, 12000]) {
        const undead = structuredClone(fixtures.find(f => f.player.race === 'Undead'));
        undead.name = 'forever-racial-undead-' + hp + '-hp';
        undead.player.maxhealth = hp;
        fixtures.push(undead);
    }
    const rend = foreverFixtures()[0];
    rend.name = 'forever-racial-gnome-rend-slam-sweeping';
    rend.player.race = 'Gnome';
    rend.rotation['forever:eureka'] = {active: true, timetostartactive: true, timetostart: 0, timetoendactive: false};
    fixtures.push(rend);
    const cleave = structuredClone(fixtures.find(f => f.player.race === 'Gnome'));
    cleave.name = 'forever-racial-gnome-cleave';
    cleave.rotation[11567] = cleave.rotation[25286] = {active: false};
    cleave.rotation[20569] = {active: true, minrageactive: true, minrage: 40};
    fixtures.push(cleave);
    return fixtures;
}
module.exports = {racialFixtures};
