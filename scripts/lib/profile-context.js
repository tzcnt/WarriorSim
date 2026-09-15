'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load only the checkout's trusted catalogs and migration rules, never input code.
function profileContext(mode = 'forever') {
    const context = vm.createContext({mode});
    for (const file of [`data/${mode === 'forever' ? 'gear_forever' : 'gear'}`, 'data/enchants',
        'data/buffs', 'data/spells', 'data/talents', 'data/talents_forever', 'talent-rules',
        'racial-rules', `data/${mode === 'forever' ? 'session_forever' : 'session'}`]) {
        const filename = path.resolve(__dirname, '../../js', file + '.js');
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
    }
    return {mode, base: context.session, baseLabel: 'preset defaults', gear: context.gear,
        enchant: context.enchant, buffs: context.buffs, spells: context.spells,
        talents: context.talents, classicTalents: context.classicTalents,
        talentSchema: context.FOREVER_TALENT_SCHEMA, normalizeTalents: context.normalizeForeverTalents,
        racialSpellAvailable: context.racialSpellAvailable};
}

module.exports = {profileContext};
