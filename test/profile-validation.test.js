'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {report} = require('../js/profile-validation');
const {profileContext} = require('../scripts/lib/profile-context');

function fixture(mode = 'forever') {
    const context = profileContext(mode);
    const profile = JSON.parse(JSON.stringify(context.base));
    for (const [slot, items] of Object.entries(profile.gear)) {
        const selected = items.find(item => item.selected);
        if (selected) profile.gear[slot] = selected.id;
        else delete profile.gear[slot];
    }
    for (const [slot, items] of Object.entries(profile.enchant)) profile.enchant[slot] = items.filter(item => item.selected).map(item => item.id);
    return {context, profile};
}

test('Forever presets use known buff IDs and enable Battle Shout as an ability', () => {
    const sandbox = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/data/presets_forever.js'), 'utf8'), sandbox);
    const context = profileContext('forever');
    assert.ok(sandbox.profilePresets.length > 0);
    for (const {id, profile} of sandbox.profilePresets) {
        const issues = report(profile, context).filter(issue =>
            issue.code === 'unknown-buff' || issue.code === 'unknown-spell');
        assert.deepEqual(issues, [], id);
        assert.ok(profile.rotation.some(spell => String(spell.id) === '11551' && spell.active === true), id);
    }
});

test('current fully specified Forever profiles need no changes and reporting is read-only', () => {
    const {context, profile} = fixture();
    const before = JSON.stringify(profile), base = JSON.stringify(context.base);
    assert.deepEqual(report(profile, context), []);
    assert.equal(JSON.stringify(profile), before);
    assert.equal(JSON.stringify(context.base), base);
    assert.deepEqual(report(context.base, {...context, format: 'session'}), []);
});

test('catalog warnings cover unknown gear, enchants, slots, buffs, and abilities', () => {
    const {context, profile} = fixture();
    profile.gear.head = 999999999;
    profile.gear.obsolete = 123;
    profile.enchant.head = [999999999];
    profile.enchant.obsolete = [123];
    profile.buffs.push('obsolete:buff');
    profile.rotation.push({id: 'obsolete:ability', active: true});
    const issues = report(profile, context);
    for (const code of ['unknown-gear', 'unknown-enchant', 'unknown-slot', 'unknown-buff', 'unknown-spell']) {
        assert.ok(issues.some(issue => issue.code === code), code);
    }
    assert.equal(issues.filter(issue => issue.code === 'unknown-slot').length, 2);
    assert.ok(issues.every(issue => issue.path && issue.message));
});

test('Forever reports actual talent migrations and refunds, including unsupported schemas', () => {
    const {context, profile} = fixture();
    const old = context.classicTalents.map(tree => ({t: tree.t.map(() => 0)}));
    old[0].t[0] = 999;
    old[0].t[6] = 2; // Improved Overpower moved in Forever.
    old[0].t[11] = 5; // Axe Specialization was removed.
    profile.talents = old;
    delete profile.talentSchema;
    const before = JSON.stringify(profile);
    const issues = report(profile, context);
    assert.ok(issues.some(issue => issue.code === 'talent-migration'));
    assert.ok(issues.some(issue => issue.code === 'talent-moved' && issue.message.includes('Overpower')));
    assert.ok(issues.some(issue => issue.code === 'talent-removed' && issue.message.includes('Axe Specialization')));
    const normalized = context.normalizeTalents(old, undefined, profile.level);
    assert.ok(issues.some(issue => issue.code === 'talent-ranks' && issue.message.includes(`999 ranks become ${normalized[0].t[0]}`)));
    assert.equal(JSON.stringify(profile), before);

    profile.talentSchema = 'forever-v999';
    assert.ok(report(profile, context).some(issue => issue.code === 'schema' && issue.message.includes('forever-v999')));
    profile.talents = fixture().profile.talents;
    profile.talents[0].keys[0] = 'arms:removed-talent';
    assert.ok(report(profile, context).some(issue => issue.code === 'talent-removed'));
});

test('missing active flags and missing options report the loader-specific fallback values', () => {
    const {context, profile} = fixture();
    const spell = profile.rotation.find(spell => spell.id == 11567);
    delete spell.active;
    delete spell.minrage;
    delete profile.reactionmin;
    context.base.rotation.find(spell => spell.id == 11567).minrage = 77;
    context.base.reactionmin = '123';
    context.baseLabel = 'the current profile';
    const issues = report(profile, context);
    assert.ok(issues.some(issue => issue.code === 'legacy-active' && issue.message.includes('Heroic Strike')));
    assert.ok(issues.some(issue => issue.code === 'defaults' && issue.message.includes('reactionmin="123"')));
    assert.ok(issues.some(issue => issue.code === 'rotation-defaults' && issue.message.includes('the current profile: minrage=77')));
    context.baseLabel = 'preset defaults';
    assert.ok(report(profile, context).some(issue => issue.code === 'rotation-defaults' && issue.message.includes('preset defaults')));
});

test('mode, race, level, and invalid settings are advisory, including illegal ability selections', () => {
    const {context, profile} = fixture();
    profile.mode = 'classic';
    profile.race = 'Unknown';
    profile.level = 'banana';
    profile.executeperc = '120';
    profile.timesecsmin = '500';
    profile.rotation.find(spell => spell.id == 11567).minrage = 'NaN';
    const issues = report(profile, context);
    for (const code of ['mode', 'race', 'setting', 'rotation-setting']) assert.ok(issues.some(issue => issue.code === code), code);
    const clean = fixture();
    const mortal = clean.profile.rotation.find(spell => spell.name === 'Mortal Strike');
    mortal.active = true;
    assert.ok(report(clean.profile, clean.context).some(issue => issue.code === 'unlearned-spell'));
    assert.ok(report(profile, profileContext('classic')).some(issue => issue.code === 'schema'));
});

test('malformed fields produce advisory findings without throwing', () => {
    const {context, profile} = fixture();
    for (const input of [null, [], {}, {...profile, talents: [null], buffs: {}, gear: null,
        rotation: [null, {}, {id: 11567, active: 'yes'}], enchant: null}]) {
        assert.ok(report(input, context).some(issue => issue.code === 'structure'));
    }
});

test('saved sessions report dropped IDs and fallback settings without export-only notices', () => {
    const context = profileContext();
    const saved = JSON.parse(JSON.stringify(context.base));
    saved.gear.head = [{id: 999999999, selected: true}];
    delete saved.level;
    const issues = report(saved, {...context, format: 'session'});
    assert.ok(issues.some(issue => issue.code === 'unknown-gear'));
    assert.ok(issues.some(issue => issue.code === 'defaults' && issue.message.includes('level="60"')));
    assert.ok(!issues.some(issue => ['legacy-active', 'rotation-defaults'].includes(issue.code)));
});
