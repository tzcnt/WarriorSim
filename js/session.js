// Saved-session form of exported profiles. The first preset is the first-visit
// session, so js/data/presets_<mode>.js holds the only copy of the defaults.

// Applies an export to a copy of baseSession; spells missing from both come from the catalog.
function expandProfile(minified, baseSession) {
    let storage = JSON.parse(JSON.stringify(baseSession));
    for(let prop in minified) {
        if (typeof minified[prop] == 'string') storage[prop] = minified[prop];
    }
    storage.buffs = minified.buffs;
    storage.talents = minified.talents;
    if ((typeof mode !== 'undefined' ? mode : 'classic') === 'forever') {
        storage.talents = normalizeForeverTalents(minified.talents, minified.talentSchema, storage.level || 60);
        storage.talentSchema = FOREVER_TALENT_SCHEMA;
    }

    storage.gear = {};
    for (let type in minified.gear) {
        if (type == 'custom') continue;
        storage.gear[type] = [{id: minified.gear[type], selected: true}];
    }
    for (let spell of spells) {
        if (!storage.rotation.filter(s => s.id == spell.id).length) {
            storage.rotation.push({...spell});
        }
    }
    for (let spell of storage.rotation) {
        let newspell = minified.rotation.filter(s => currentId(s.id) == spell.id)[0];
        if (newspell) {
            // Legacy exports omit active; presets can retain disabled spell settings.
            spell.active = newspell.active !== false;
            if (typeof newspell.duration !== 'undefined') spell.duration = newspell.duration;
            if (typeof newspell.durationactive !== 'undefined') spell.durationactive = newspell.durationactive;
            if (typeof newspell.timetoend !== 'undefined') spell.timetoend = newspell.timetoend;
            if (typeof newspell.timetoendactive !== 'undefined') spell.timetoendactive = newspell.timetoendactive;
            if (typeof newspell.timetostart !== 'undefined') spell.timetostart = newspell.timetostart;
            if (typeof newspell.timetostartactive !== 'undefined') spell.timetostartactive = newspell.timetostartactive;

            if (typeof newspell.haste !== 'undefined') spell.haste = newspell.haste;

            if (typeof newspell.minrage !== 'undefined') spell.minrage = newspell.minrage;
            if (typeof newspell.minrageactive !== 'undefined') spell.minrageactive = newspell.minrageactive;
            if (typeof newspell.maxrage !== 'undefined') spell.maxrage = newspell.maxrage;
            if (typeof newspell.maxrageactive !== 'undefined') spell.maxrageactive = newspell.maxrageactive;
            if (typeof newspell.maincd !== 'undefined') spell.maincd = newspell.maincd;
            if (typeof newspell.maincdactive !== 'undefined') spell.maincdactive = newspell.maincdactive;

            if (typeof newspell.unqueue !== 'undefined') spell.unqueue = newspell.unqueue;
            if (typeof newspell.unqueueactive !== 'undefined') spell.unqueueactive = newspell.unqueueactive;
            if (typeof newspell.exmacro !== 'undefined') spell.exmacro = newspell.exmacro;
            if (typeof newspell.globals !== 'undefined') spell.globals = newspell.globals;
            if (typeof newspell.globalsactive !== 'undefined') spell.globalsactive = newspell.globalsactive;
            if (typeof newspell.nextauto !== 'undefined') spell.nextauto = newspell.nextauto;
            if (typeof newspell.nextautoactive !== 'undefined') spell.nextautoactive = newspell.nextautoactive;
            if (typeof newspell.afterswing !== 'undefined') spell.afterswing = newspell.afterswing;

            if (typeof newspell.zerkerpriority !== 'undefined') spell.zerkerpriority = newspell.zerkerpriority;
            if (typeof newspell.swingtimeractive !== 'undefined') spell.swingtimeractive = newspell.swingtimeractive;
            if (typeof newspell.swingtimer !== 'undefined') spell.swingtimer = newspell.swingtimer;
            if (typeof newspell.priority !== 'undefined') spell.priority = newspell.priority;
            if (typeof newspell.expriority !== 'undefined') spell.expriority = newspell.expriority;
        }
        else {
            spell.active = false;
        }
    }
    storage.enchant = {};
    for (let type in minified.enchant) {
        storage.enchant[type] = [];
        for (let e of minified.enchant[type])
            storage.enchant[type].push({id: e, selected: true});
    }
    return storage;
}

// Expanded at load, before updateGlobals customizes the spell catalog.
var session = expandProfile(profilePresets[0].profile, {
    // Exports omit the gear filters: list every source and phase, with no resistance gear.
    sources: ['quest', 'crafting', 'dungeon', 'onyxia', 'mc', 'bwl', 'zg', 'aq20', 'aq40', 'naxx', 'worldboss', 'pvp', 'other'],
    phases: ['1', '2', '3', '4', '5', '6'],
    resistance: {shadow: false, arcane: false, nature: false, fire: false, frost: false},
    rotation: [],
});
