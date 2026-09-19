'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const {decodeProfile, upsertSource} = require('../scripts/upsert-forever-profile');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/upsert-forever-profile.js');
const source = fs.readFileSync(path.join(root, 'js/data/presets_forever.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function catalog(source) {
    const context = {};
    vm.runInNewContext(source, context);
    return plain(context.profilePresets);
}

function browserExport(mode = 'forever') {
    let exported;
    const context = vm.createContext({mode, localStorage: {}, btoa, atob,
        navigator: {clipboard: {writeText: text => { exported = text; }}}});
    for (const file of [`js/data/${mode === 'forever' ? 'gear_forever' : 'gear'}.js`, 'js/data/enchants.js', 'js/data/buffs.js',
        'js/data/spells.js', 'js/data/talents.js', 'js/data/talents_forever.js',
        'js/talent-rules.js', 'js/racial-rules.js', `js/data/${mode === 'forever' ? 'session_forever' : 'session'}.js`, 'js/profile-validation.js', 'js/profiles.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    }
    vm.runInContext(`
        SIM.UI = {addAlert() {}};
        SIM.PROFILES.buildProfiles = () => {};
        SIM.PROFILES.showIssues = issues => { globalThis.profileIssues = issues; };
        localStorage[mode + '0'] = JSON.stringify(session);
        SIM.PROFILES.exportProfile({data: () => 0});
    `, context);
    return {context, exported, profile: JSON.parse(atob(exported))};
}

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'warriorsim-profile-'));
    t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
    const target = path.join(directory, 'presets.js');
    fs.writeFileSync(target, source);
    const run = (args, input) => spawnSync(process.execPath, [script, '--presets', target, ...args],
        {cwd: directory, input, encoding: 'utf8'});
    return {directory, target, run};
}

test('decodes real browser exports, wrapped base64, JSON, and both export encodings', () => {
    const {exported, profile} = browserExport();
    assert.deepEqual(decodeProfile(exported), profile);
    assert.deepEqual(decodeProfile(' \n' + exported.match(/.{1,60}/g).join('\r\n') + '\n'), profile);
    assert.deepEqual(decodeProfile(' \n' + JSON.stringify(profile, null, 2)), profile);
    profile.profilename = 'Café';
    assert.deepEqual(decodeProfile(btoa(JSON.stringify(profile))), profile);
    profile.profilename = '武器 ⚔️';
    assert.deepEqual(decodeProfile(Buffer.from(JSON.stringify(profile)).toString('base64')), profile);
});

for (const mode of ['forever', 'classic']) test(`${mode}: fresh exports include active flags and older exports still import`, () => {
    const {context, profile} = browserExport(mode);
    const selected = JSON.parse(context.localStorage[mode + '0']).rotation.filter(spell => spell.active);
    assert.ok(profile.rotation.length > 0);
    assert.deepEqual(profile.rotation.map(spell => spell.id), selected.map(spell => spell.id));
    assert.ok(profile.rotation.every(spell => spell.active === true));
    context.imported = profile;
    assert.equal(vm.runInContext('SIM.PROFILES.importProfile(JSON.stringify(imported), 1, session)', context), true);
    assert.ok(!context.profileIssues.some(issue => issue.code === 'legacy-active'));
    const current = JSON.parse(context.localStorage[mode + '1']);

    for (const spell of profile.rotation) delete spell.active;
    assert.equal(vm.runInContext('SIM.PROFILES.importProfile(JSON.stringify(imported), 2, session)', context), true);
    assert.ok(context.profileIssues.some(issue => issue.code === 'legacy-active'));
    assert.deepEqual(JSON.parse(context.localStorage[mode + '2']), current,
        'older exports enable exactly the same abilities and retain the same settings');
});

test('CLI inserts a browser export that the site can load with matching selections', t => {
    const {target, run} = fixture(t);
    const {context, exported, profile} = browserExport();
    const result = run(['--id', 'forever-new-build'], exported);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Inserted forever-new-build/);
    assert.doesNotMatch(result.stderr, /omit active/);
    const updatedSource = fs.readFileSync(target, 'utf8');
    assert.ok(updatedSource.startsWith(source.slice(0, source.indexOf('var profilePresets'))));
    const updated = catalog(updatedSource);
    assert.deepEqual(updated.slice(0, -1), catalog(source));
    assert.deepEqual(updated.at(-1), {id: 'forever-new-build', description: profile.profilename, profile});

    context.imported = updated.at(-1).profile;
    assert.equal(vm.runInContext('SIM.PROFILES.importProfile(JSON.stringify(imported), 1, session)', context), true);
    const saved = JSON.parse(context.localStorage.forever1);
    assert.equal(saved.profilename, profile.profilename);
    assert.deepEqual(saved.talents, profile.talents);
    assert.deepEqual(saved.buffs, profile.buffs);
    assert.deepEqual(saved.gear, Object.fromEntries(Object.entries(profile.gear).map(([slot, id]) =>
        [slot, [{id, selected: true}]])));
    assert.deepEqual(saved.enchant, Object.fromEntries(Object.entries(profile.enchant).map(([slot, ids]) =>
        [slot, ids.map(id => ({id, selected: true}))])));
    assert.deepEqual(saved.rotation.filter(spell => spell.active).map(spell => String(spell.id)).sort(),
        profile.rotation.map(spell => String(spell.id)).sort());
    for (const spell of profile.rotation) {
        const loaded = saved.rotation.find(row => row.id == spell.id);
        for (const [key, value] of Object.entries(spell)) assert.deepEqual(loaded[key], value);
    }
});

test('CLI updates by ID, replaces the full profile, preserves metadata, and is idempotent', t => {
    const {directory, target, run} = fixture(t);
    const originals = catalog(source);
    originals[0].notes = 'Keep this metadata';
    fs.writeFileSync(target, `// Keep this header\nvar profilePresets = ${JSON.stringify(originals, null, 4)};\n`);
    const {profile} = browserExport();
    profile.profilename = 'Renamed build';
    profile.gear = {twohand: 17076};
    profile.rotation = [profile.rotation[0]];
    const input = path.join(directory, 'profile.json');
    fs.writeFileSync(input, JSON.stringify(profile));
    const args = ['--id', originals[0].id, '--input', input];
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Updated forever-dual-wield-fury/);
    const updated = catalog(fs.readFileSync(target, 'utf8'));
    assert.equal(updated.length, originals.length);
    assert.deepEqual(updated[0], {...originals[0], profile});
    assert.deepEqual(updated.slice(1), originals.slice(1));
    const before = fs.readFileSync(target, 'utf8');
    assert.match(run(args).stdout, /Unchanged/);
    assert.equal(fs.readFileSync(target, 'utf8'), before);
    assert.equal(run([...args, '--description', 'Updated description']).status, 0);
    assert.equal(catalog(fs.readFileSync(target, 'utf8'))[0].description, 'Updated description');
});

test('dry run prints a usable catalog and never changes the destination', t => {
    const {target, run} = fixture(t);
    const {exported} = browserExport();
    const result = run(['--id', 'forever-preview', '--description', 'Preview', '--dry-run'], exported);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(catalog(result.stdout).at(-1).description, 'Preview');
    assert.equal(fs.readFileSync(target, 'utf8'), source);
});

test('compatibility issues are identical in the CLI and browser, and neither blocks an import', t => {
    const {target, run} = fixture(t);
    const {context, profile} = browserExport();
    profile.gear.head = 999999999;
    profile.enchant.head = [999999999];
    profile.buffs.push('obsolete:buff');
    profile.rotation.push({id: 'obsolete:ability'});
    profile.talents[0].t[0] = 999;
    profile.talentSchema = 'forever-v999';
    const result = run(['--id', 'forever-advisory'], JSON.stringify(profile));
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(catalog(fs.readFileSync(target, 'utf8')).at(-1).profile, profile,
        'upsert preserves the supplied profile instead of applying proposed migrations');
    context.imported = profile;
    assert.equal(vm.runInContext('SIM.PROFILES.importProfile(JSON.stringify(imported), 1, session)', context), true);
    for (const issue of context.profileIssues) assert.ok(result.stderr.includes(`- ${issue.message}\n`), issue.message);
    assert.equal(result.stderr.split('\n').filter(line => line.startsWith('- ')).length, context.profileIssues.length);
    const saved = JSON.parse(context.localStorage.forever1);
    assert.equal(saved.talents[0].t[0], 3);
    assert.equal(saved.rotation.some(spell => spell.id === 'obsolete:ability'), false);
    const preview = run(['--id', 'forever-advisory', '--dry-run'], JSON.stringify(profile));
    assert.equal(preview.status, 0);
    assert.match(preview.stderr, /compatibility notes/);
    assert.deepEqual(catalog(preview.stdout).at(-1).profile, profile);
});

test('invalid inputs fail without modifying the catalog', t => {
    const {target, run} = fixture(t);
    const {profile, context} = browserExport();
    const invalid = ['', 'garbage', 'eyJ!9', Buffer.from('{broken').toString('base64'), '{}',
        context.localStorage.forever0,
        JSON.stringify({...profile, gear: {mainhand: [{id: 17068, selected: true}]}}),
        JSON.stringify({...profile, enchant: {mainhand: 20034}}),
        JSON.stringify({...profile, rotation: [{minrage: 40}]}),
        JSON.stringify({...profile, rotation: [{id: 123}, {id: '123'}]}),
        JSON.stringify({...profile, talents: [{t: []}]}),
        JSON.stringify({...profile, profilename: ''})];
    for (const input of invalid) {
        const result = run(['--id', 'forever-invalid'], input);
        assert.notEqual(result.status, 0, input);
        assert.match(result.stderr, /Error:/);
        assert.equal(fs.readFileSync(target, 'utf8'), source);
    }
    for (const args of [[], ['--id', 'bad id'], ['--id', 'forever-ok', '--input', 'missing.txt']]) {
        assert.notEqual(run(args, JSON.stringify(profile)).status, 0);
        assert.equal(fs.readFileSync(target, 'utf8'), source);
    }
});

test('rejects malformed catalogs and duplicate IDs without writing or executing their source', t => {
    const {target, run} = fixture(t);
    const {exported} = browserExport();
    const first = catalog(source)[0];
    for (const invalid of ['var profilePresets = [broken];',
        `var profilePresets = ${JSON.stringify([first, first])};`,
        'var profilePresets = []; throw new Error("executed");']) {
        fs.writeFileSync(target, invalid);
        const result = run(['--id', first.id], exported);
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.stderr, /Error: executed/);
        assert.equal(fs.readFileSync(target, 'utf8'), invalid);
    }
});

test('preserves CRLF catalogs and supports disabled spell settings in JSON', () => {
    const {profile} = browserExport();
    profile.rotation[0].active = false;
    const crlf = source.replace(/\n/g, '\r\n');
    const result = upsertSource(crlf, decodeProfile(JSON.stringify(profile)), 'forever-crlf');
    assert.doesNotMatch(result.source, /(?<!\r)\n/);
    assert.deepEqual(catalog(result.source).at(-1).profile, profile);
});

test('default destination is resolved from the script, independent of the working directory', t => {
    const {directory} = fixture(t);
    const {exported} = browserExport();
    const result = spawnSync(process.execPath, [script, '--id', 'forever-default-path', '--dry-run'],
        {cwd: directory, input: exported, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.equal(catalog(result.stdout).length, catalog(source).length + 1);
    assert.equal(fs.readFileSync(path.join(root, 'js/data/presets_forever.js'), 'utf8'), source);
});

test('Slam next-auto settings survive browser profile export and import', () => {
    const {context} = browserExport();
    let exported;
    context.navigator.clipboard.writeText = text => { exported = text; };
    vm.runInContext(`
        const saved = JSON.parse(localStorage.forever0);
        Object.assign(saved.rotation.find(s => s.id === 11605),
            {active: true, nextauto: 650, nextautoactive: true});
        localStorage.forever0 = JSON.stringify(saved);
        SIM.PROFILES.exportProfile({data: () => 0});
    `, context);
    context.imported = JSON.parse(atob(exported));
    const slam = context.imported.rotation.find(s => s.id === 11605);
    assert.equal(slam.nextauto, 650);
    assert.equal(slam.nextautoactive, true);
    assert.equal(vm.runInContext('SIM.PROFILES.importProfile(JSON.stringify(imported), 1, session)', context), true);
    const restored = JSON.parse(context.localStorage.forever1).rotation.find(s => s.id === 11605);
    assert.equal(restored.nextauto, 650);
    assert.equal(restored.nextautoactive, true);
});
