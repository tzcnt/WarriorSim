function getGlobalsDelta() {
    const _gear = {};
    for (const type in gear) {
        if (type == 'custom') continue;
        _gear[type] = gear[type].map((item) => {
            return {
                id: item.id,
                dps: item.dps,
                selected: item.selected,
                hidden: item.hidden,
            }
        });
    }
    const _enchant = {};
    for (const type in enchant) {
        _enchant[type] = enchant[type].map((item) => {
            return {
                id: item.id,
                dps: item.dps,
                selected: item.selected,
                hidden: item.hidden,
            }
        });
    }
    return {
        talents: talents.map((tree) => {
            return {
                t: tree.t.map((talent) => talent.c),
                ...(globalThis.mode === 'forever' ? {keys: tree.t.map(t => t.forever.key)} : {}),
            };
        }),
        buffs: buffs
            .filter((buff) => buff.active)
            .map((buff) => buff.id),
        rotation: spells,
        gear: _gear,
        enchant: _enchant,
        mode: globalThis.mode,
        talentSchema: globalThis.mode === 'forever' ? FOREVER_TALENT_SCHEMA : undefined,
    }
}

function updateGlobals(params) {
    if (typeof selectTalentRules === 'function') selectTalentRules(params.mode || (typeof mode !== 'undefined' ? mode : 'classic'));
    const selected = typeof talentsForever !== 'undefined' && talents === talentsForever ?
        normalizeForeverTalents(params.talents, params.talentSchema, params.level || 60) : params.talents;
    for (let tree in talents)
        for (let index in talents[tree].t)
            talents[tree].t[index].c = selected?.[tree]?.t[index] || 0;

    for (let j of buffs) j.active = false;
    for (let i of params.buffs)
        for (let j of buffs)
            if (i == j.id) j.active = true;

    for (let i of params.rotation)
        for (let j of spells)
            if (i.id == j.id)
                for (let prop in i)
                    if (prop != 'minlevel' && prop != 'maxlevel' && prop != 'iconname')
                        j[prop] = i[prop];

    for (let type in gear)
        for (let j of gear[type])
            if (j.selected) j.selected = false;

    for (let type in params.gear)
        for (let i of params.gear[type])
            if (gear[type])
                for (let j of gear[type]) {
                    if (i.id == j.id) {
                        j.dps = i.dps;
                        j.selected = i.selected;
                        j.hidden = i.hidden;
                    }
                }

    for (let type in enchant)
        for (let j of enchant[type])
            if (j.selected) j.selected = false;

    for (let type in params.enchant)
        for (let i of params.enchant[type])
            for (let j of enchant[type])
                if (i.id == j.id) {
                    j.dps = i.dps;
                    j.selected = i.selected;
                    j.hidden = i.hidden;
                }

    for (let type in params.resistances) {
        if (params.resistances[type]) {
            $('.resistances-list.hidden').removeClass('hidden');
            $(".js-toggle[data-id='resistances-list']").addClass('active');
            $(".resistances[data-id='"+type+"-resist']").click()
        }
    }

    delete gear["custom"];
}
