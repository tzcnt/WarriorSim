// WoW Forever racial descriptions come from RACIALS-dump.md and the 2026-10-15 racial patch notes.
// Unpublished values and combat assumptions are recorded in data/forever/RACIALS.md.
var racialSpellRules = {
    20572: {race: 'Orc', description: 'Increases attack power and spell power by 10% for 15 seconds. 3-minute cooldown.'},
    26296: {race: 'Troll', description: 'Increases casting and attack speed by 10% for 10 seconds.'},
    'forever:elunes-light': {race: 'Night Elf', mode: 'forever', description: 'Increases critical strike chance by 10% for 15 seconds. 3-minute cooldown.'},
    'forever:eureka': {race: 'Gnome', mode: 'forever', description: 'For 8 seconds, your abilities deal 10% more damage and cost 10% less rage. 2-minute cooldown.'},
};

function racialSpellAvailable(id, race, gameMode) {
    const racial = racialSpellRules[id];
    return !racial || (racial.race === race && (!racial.mode || racial.mode === gameMode));
}

function racialSpellDescription(spell, gameMode) {
    return (gameMode === 'forever' && racialSpellRules[spell.id]?.description) || spell.localDescription;
}

// Capture the catalog defaults before saved rotation settings can replace them.
var racialSpellDefaults = {};

function selectRacialSpells(race, gameMode) {
    for (const spell of spells) {
        if (!racialSpellRules[spell.id]) continue;
        spell.active = racialSpellAvailable(spell.id, race, gameMode);
        if (spell.active) Object.assign(spell, racialSpellDefaults[spell.id]);
    }
}

spells.push({id: 'forever:elunes-light', name: 'Elune’s Light', classname: 'ElunesLight',
    iconname: 'spell_holy_elunesgrace', mode: 'forever', aura: true, buff: true, active: true,
    timetostart: 0, timetostartactive: false, timetoend: 31, timetoendactive: true,
    localDescription: 'Increases critical strike chance by 10% for 15 seconds. 3-minute cooldown.'});
spells.push({id: 'forever:eureka', name: 'Eureka!', classname: 'Eureka',
    iconname: 'inv_misc_enggizmos_20', mode: 'forever', aura: true, buff: true, active: true,
    timetostart: 0, timetostartactive: false, timetoend: 10, timetoendactive: true,
    localDescription: 'For 8 seconds, your abilities deal 10% more damage and cost 10% less rage. 2-minute cooldown.'});

for (const spell of spells) {
    if (racialSpellRules[spell.id]) racialSpellDefaults[spell.id] = {
        timetostart: 0, timetostartactive: false,
        timetoend: spell.timetoend, timetoendactive: true,
    };
}

var foreverRacialDescriptions = {
    Human: 'Ruthless: +2% crit for autoattacks, abilities and spells. The Human Spirit: +5% Spirit (outside the DPS model).',
    Dwarf: 'Earth Fury: +2% critical strike damage bonus (2.02× crits, 2.22× with Impale 2/2). Big Game Hunter: +5% damage to Beasts. Healing is outside the DPS model.',
    'Night Elf': 'Elune’s Light: +10% crit for 15 seconds; configure its use in Rotation. Quickness affects dodge and movement, outside the DPS model.',
    Gnome: 'Expansive Mind: +5% maximum rage. Eureka!: for 8 seconds, your abilities deal 10% more damage and cost 10% less rage; 2-minute cooldown. Configure its use in Rotation.',
    Orc: 'Savage: +1% crit for autoattacks, abilities and spells. Blood Fury: +10% attack/spell power for 15 seconds, 3-minute cooldown; configure its use in Rotation.',
    Undead: 'Touch of the Grave: 20% chance per landed damaging main-hand, off-hand, or special ability hit to deal 5% of your maximum HP as magic damage. Shares a 25 second internal cooldown across all hits. Health is calculated from your build; use Max Health to override it. Healing is outside the DPS model.',
    Tauren: 'Endurance: +2% critical strike damage bonus (2.02× crits, 2.22× with Impale 2/2). Also increases maximum health by 5%. Healing is outside the DPS model.',
    Troll: 'Beast Slaying: +5% damage to Beasts. Berserking: +10% haste for 10 seconds; configure its use in Rotation.',
    Skyborne: 'Wind Blessed: +3% haste. Elemental Insight: +5% damage to Elementals. Both factions share these bonuses. Base stats provisionally use Human values.',
};
