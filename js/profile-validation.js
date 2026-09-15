// Advisory compatibility checks shared by the browser and profile maintenance tools.
// The report never modifies the supplied profile or the catalogs.
var ProfileValidation = (() => {
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const list = value => Array.isArray(value) ? value : [];
    const display = value => JSON.stringify(value);
    const rotationOptions = ['duration', 'durationactive', 'timetoend', 'timetoendactive',
        'timetostart', 'timetostartactive', 'haste', 'minrage', 'minrageactive', 'maxrage',
        'maxrageactive', 'maincd', 'maincdactive', 'unqueue', 'unqueueactive', 'exmacro',
        'globals', 'globalsactive', 'afterswing', 'zerkerpriority', 'swingtimeractive',
        'swingtimer', 'priority', 'expriority'];
    const settings = ['profilename', 'level', 'race', 'simulations', 'timesecsmin', 'timesecsmax',
        'executeperc', 'startrage', 'targetlevel', 'targetbasearmor', 'targetcustomarmor',
        'targetresistance', 'targetspeed', 'targetmindmg', 'targetmaxdmg', 'adjacent',
        'aqbooks', 'reactionmin', 'reactionmax', 'batching', 'bleedreduction', 'spellqueueing',
        'maxhealth', 'targetcreaturetype'];

    function report(profile, context) {
        const issues = [];
        const add = (code, path, message) => issues.push({code, path, message});
        if (!object(profile)) {
            add('structure', 'profile', 'The profile must be an object. The loader may be unable to import it.');
            return issues;
        }
        const {mode, base = {}, baseLabel = 'defaults', gear = {}, enchant = {}, buffs = [],
            spells = [], talents = [], classicTalents = [], talentSchema, normalizeTalents,
            racialSpellAvailable, format = 'export'} = context;
        const saved = format === 'session';
        const value = field => typeof profile[field] === 'string' ? profile[field] : base[field];
        const level = value('level') || 60;
        if (profile.mode && profile.mode !== mode) {
            add('mode', 'mode', `Profile mode ${display(profile.mode)} differs from ${mode}; the loader uses ${mode} rules.`);
        }
        if (mode !== 'forever' && String(profile.talentSchema || '').startsWith('forever-')) {
            add('schema', 'talentSchema', 'Forever talents are being loaded in Classic. Classic reads ranks by position and does not migrate Forever talents.');
        }

        const missing = settings.filter(field => profile[field] === undefined && typeof base[field] === 'string');
        if (!saved && missing.length) add('defaults', 'settings',
            `Missing settings inherit ${baseLabel}: ${missing.map(field => `${field}=${display(base[field])}`).join(', ')}.`);
        if (saved) {
            const fallback = ['level', 'targetlevel', 'profilename'].filter(field => !profile[field] && base[field] !== undefined);
            if (mode === 'forever' && profile.maxhealth === undefined) fallback.push('maxhealth');
            if (fallback.length) add('defaults', 'settings', `Missing settings use ${baseLabel}: ${fallback.map(field => `${field}=${display(base[field] ?? '')}`).join(', ')}.`);
        }
        const races = ['Human', 'Orc', 'Dwarf', 'Night Elf', 'Undead', 'Tauren', 'Gnome', 'Troll'];
        if (mode === 'forever') races.push('Skyborne');
        if (value('race') !== undefined && !races.includes(value('race'))) {
            add('race', 'race', `Unknown race ${display(value('race'))} for ${mode}; choose a supported race.`);
        }
        const ranges = {level: [1, 60], targetlevel: [1, Infinity], simulations: [1, Infinity],
            timesecsmin: [0, Infinity], timesecsmax: [0, Infinity], executeperc: [0, 100],
            startrage: [0, Infinity], adjacent: [0, Infinity], reactionmin: [0, Infinity],
            reactionmax: [0, Infinity], targetresistance: [0, Infinity], targetspeed: [0, Infinity],
            targetmindmg: [0, Infinity], targetmaxdmg: [0, Infinity], bleedreduction: [0, 1]};
        for (const [field, [min, max]] of Object.entries(ranges)) {
            if (profile[field] === undefined) continue;
            const number = Number(profile[field]);
            if (profile[field] === '' || !Number.isFinite(number) || number < min || number > max ||
                (['level', 'targetlevel', 'simulations', 'adjacent'].includes(field) && !Number.isInteger(number))) {
                add('setting', field, `Invalid ${field}=${display(profile[field])}; review this setting before simulating.`);
            }
        }
        for (const [min, max] of [['timesecsmin', 'timesecsmax'], ['reactionmin', 'reactionmax'], ['targetmindmg', 'targetmaxdmg']]) {
            if (Number(value(min)) > Number(value(max))) add('setting', min, `${min} exceeds ${max}; review these settings before simulating.`);
        }

        const trees = list(profile.talents);
        let normalizedTalents = trees;
        if (trees.length !== 3 || trees.some(tree => !object(tree) || !Array.isArray(tree.t))) {
            add('structure', 'talents', 'Talents do not contain three rank arrays; the loader may reset talents or fail to load this profile.');
        } else if (mode === 'forever' && normalizeTalents) {
            if (profile.talentSchema && profile.talentSchema !== talentSchema) add('schema', 'talentSchema',
                `Unknown talent schema ${display(profile.talentSchema)}. The loader attempts migration and labels the result ${talentSchema}.`);
            const legacy = profile.talentSchema !== talentSchema && trees.some(tree => tree.t.some((rank, j) => rank && !tree.keys?.[j]));
            if (legacy) add('talent-migration', 'talents', 'Legacy positional talents are mapped through Classic talent names into the current Forever tree. Removed talents are refunded.');
            const normalized = normalizeTalents(trees, profile.talentSchema, level);
            normalizedTalents = normalized;
            const targets = talents.flatMap((tree, i) => tree.t.map((talent, j) => ({talent, i, j})));
            trees.forEach((tree, i) => tree.t.forEach((rank, j) => {
                if (rank === 0) return;
                const key = tree.keys?.[j] || (profile.talentSchema === talentSchema ? talents[i]?.t[j]?.forever.key : classicTalents[i]?.t[j]?.n);
                const target = targets.find(({talent}) => talent.forever.key === key || (talent.forever.classic?.renamed || talent.n) === key);
                const field = `talents[${i}].t[${j}]`;
                if (!target) {
                    add('talent-removed', field, `Talent ${display(key || `${i + 1}:${j + 1}`)} is no longer recognized; its ${display(rank)} ranks are refunded.`);
                    return;
                }
                if (target.i !== i || target.j !== j) add('talent-moved', field,
                    `${target.talent.n} is mapped from tree ${i + 1}, position ${j + 1} to tree ${target.i + 1}, position ${target.j + 1}.`);
                const next = normalized[target.i].t[target.j];
                if (rank !== next) add('talent-ranks', field,
                    `${target.talent.n}: ${display(rank)} ranks become ${next} after enforcing rank limits, prerequisites, and the level's talent point budget.`);
            }));
        }

        for (const [kind, catalog] of [['gear', gear], ['enchant', enchant]]) {
            if (!object(profile[kind])) {
                add('structure', kind, `${kind} is missing or malformed; the loader may use defaults, leave slots empty, or fail to load it.`);
                continue;
            }
            for (const [slot, selection] of Object.entries(profile[kind])) {
                const ids = saved ? list(selection).filter(item => item?.selected).map(item => item.id) : kind === 'gear' ? [selection] : list(selection);
                if (!ids.length) continue;
                if (kind === 'gear' && slot === 'custom') {
                    add('gear-slot', `${kind}.${slot}`, 'Custom gear is omitted by the profile loader.');
                    continue;
                }
                if (!Array.isArray(catalog[slot])) {
                    add('unknown-slot', `${kind}.${slot}`, `Unknown ${kind} slot ${display(slot)}; it cannot be applied by the current loader.`);
                    continue;
                }
                for (const id of ids) {
                    const item = catalog[slot].find(item => String(item.id) === String(id));
                    if (!item) add(`unknown-${kind}`, `${kind}.${slot}`,
                        `Unknown ${kind} ID ${display(id)} in ${slot}; it will be ignored when the profile is loaded.`);
                    else if (item.r > Number(level)) add('item-level', `${kind}.${slot}`,
                        `${item.name || id} in ${slot} requires level ${item.r}, above this profile's level ${level}.`);
                }
            }
        }
        if (!Array.isArray(profile.buffs)) add('structure', 'buffs', 'Buffs are missing or malformed; the loader may use defaults or fail to load them.');
        for (const id of list(profile.buffs)) {
            // Existing sessions include a null placeholder from the buff heading.
            if (id !== null && !buffs.some(buff => String(buff.id) === String(id))) add('unknown-buff', 'buffs',
                `Unknown buff ID ${display(id)}; it will be ignored when the profile is loaded.`);
        }

        if (!Array.isArray(profile.rotation)) add('structure', 'rotation', 'Rotation is missing or malformed; the loader may use defaults or fail to import it.');
        const legacySpells = [], seen = new Set();
        for (const entry of list(profile.rotation)) {
            if (!object(entry) || entry.id === undefined) {
                add('structure', 'rotation', 'A rotation entry has no ability ID; it cannot be matched to a current ability.');
                continue;
            }
            const field = `rotation[${entry.id}]`;
            if (seen.has(String(entry.id))) add('duplicate-spell', field, `Duplicate ability ID ${display(entry.id)}; importing an export uses the first matching entry.`);
            seen.add(String(entry.id));
            const spell = spells.find(spell => String(spell.id) === String(entry.id));
            if (!spell) {
                add('unknown-spell', field, `Unknown ability ID ${display(entry.id)}; it will be ignored by the current sim.`);
                continue;
            }
            const name = spell.name || entry.id;
            if (!saved && entry.active === undefined) legacySpells.push(name);
            if (entry.active !== undefined && typeof entry.active !== 'boolean') add('rotation-setting', `${field}.active`,
                `${name}: active=${display(entry.active)} is not a boolean; the import treats every value except false as enabled.`);
            if (saved ? entry.active : entry.active !== false) {
                if ((spell.mode && spell.mode !== mode) || (racialSpellAvailable && !racialSpellAvailable(spell.id, value('race'), mode)) ||
                    Number(level) < (spell.minlevel || 0) || Number(level) > (spell.maxlevel || 60)) {
                    add('unavailable-spell', field, `${name} is unavailable for this mode, race, or level; it will not be used.`);
                }
                talents.forEach((tree, i) => tree.t.forEach((talent, j) => {
                    if (talent.n === spell.name && talent.enable && !normalizedTalents[i]?.t?.[j]) {
                        add('unlearned-spell', field, `${name} requires an unlearned talent; it will not be used.`);
                    }
                }));
                if ((spell.aq === false && value('aqbooks') === 'Yes') || (spell.aq && value('aqbooks') === 'No')) {
                    add('unavailable-spell', field, `${name} does not match the AQ books setting; the rotation UI disables this rank.`);
                }
            }
            if (!saved) {
                const fallback = list(base.rotation).find(row => String(row.id) === String(entry.id)) || spell;
                const inherited = rotationOptions.filter(key => entry[key] === undefined && fallback[key] !== undefined);
                if (inherited.length) add('rotation-defaults', field,
                    `${name} inherits missing options from ${list(base.rotation).some(row => String(row.id) === String(entry.id)) ? baseLabel : 'the ability catalog'}: ${inherited.map(key => `${key}=${display(fallback[key])}`).join(', ')}.`);
            }
            for (const key of rotationOptions) {
                if (entry[key] === undefined) continue;
                const boolean = key.endsWith('active') || ['exmacro', 'afterswing', 'zerkerpriority'].includes(key);
                if (boolean ? typeof entry[key] !== 'boolean' : !['string', 'number'].includes(typeof entry[key]) || !Number.isFinite(Number(entry[key]))) {
                    add('rotation-setting', `${field}.${key}`, `${name}: invalid ${key}=${display(entry[key])}; review this option before simulating.`);
                }
            }
        }
        if (legacySpells.length) add('legacy-active', 'rotation',
            `These rotation entries omit active and are treated as enabled for legacy compatibility: ${legacySpells.join(', ')}.`);
        return issues;
    }

    return {report};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ProfileValidation;
