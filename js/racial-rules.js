// WoW Forever racial descriptions come from RACIALS-dump.md.
// Unpublished values and combat assumptions are recorded in data/forever/RACIALS.md.
var racialSpellRules = {
    20572: {race: 'Orc', description: 'Increases attack power and spell power by 10% for 15 seconds.'},
    26296: {race: 'Troll', description: 'Increases casting and attack speed by 10% for 10 seconds.'},
    'forever:elunes-light': {race: 'Night Elf', mode: 'forever', description: 'Increases critical strike chance by 10% for 15 seconds. 3-minute cooldown.'},
    'forever:eureka': {race: 'Gnome', mode: 'forever', description: 'Your next three abilities deal 10% more damage and cost 40% less rage. 2-minute cooldown.'},
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
    timetostart: 0, timetostartactive: false, timetoend: 16, timetoendactive: true,
    localDescription: 'Increases critical strike chance by 10% for 15 seconds. 3-minute cooldown.'});
spells.push({id: 'forever:eureka', name: 'Eureka!', classname: 'Eureka',
    iconname: 'inv_misc_enggizmos_20', mode: 'forever', aura: true, buff: true, active: true,
    timetostart: 0, timetostartactive: false, timetoend: 9, timetoendactive: true,
    localDescription: 'Your next three abilities deal 10% more damage and cost 40% less rage. 2-minute cooldown.'});

for (const spell of spells) {
    if (racialSpellRules[spell.id]) racialSpellDefaults[spell.id] = {
        timetostart: 0, timetostartactive: false,
        timetoend: spell.timetoend, timetoendactive: true,
    };
}

var foreverRacialDescriptions = {
    Human: 'Sword Specialization: +2% crit for sword autoattacks and abilities, plus spell crit while a sword is equipped. The Human Spirit: +5% Spirit (outside the DPS model).',
    Dwarf: 'Mace Specialization: +1% crit for mace autoattacks and abilities, plus spell crit while a mace is equipped. Big Game Hunter: +5% damage to Beasts.',
    'Night Elf': 'Elune’s Light: +10% crit for 15 seconds; configure its use in Rotation. Quickness affects dodge and movement, outside the DPS model.',
    Gnome: 'Expansive Mind: +5% maximum rage, including Boundless Rage. Eureka!: empowers your next three abilities; configure its use in Rotation. 40% lower rage costs, 2-minute cooldown.',
    Orc: 'Axe Specialization: +1% crit for axe autoattacks and abilities, plus spell crit while an axe is equipped. Blood Fury: +10% attack/spell power for 15 seconds; configure its use in Rotation.',
    Undead: 'Touch of the Grave: 5% chance per landed melee hit to deal 5% of your maximum HP as magic damage. Assumes no internal cooldown. Health is calculated from your build; use Max Health to override it. Healing is outside the DPS model.',
    Tauren: 'Endurance: +1% hit for autoattacks, abilities and spells. Also increases maximum health by 5%.',
    Troll: 'Beast Slaying: +5% damage to Beasts. Berserking: +10% haste for 10 seconds; configure its use in Rotation.',
    Skyborne: 'Wind Blessed: +1% haste. Elemental Insight: +5% damage to Elementals. Both factions share these bonuses. Base stats provisionally use Human values.',
};
