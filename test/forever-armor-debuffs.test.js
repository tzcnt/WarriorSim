'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

// Highest-rank reductions: Forever values come from client build 1.60.1.70009.
// Curse of Recklessness and Expose Armor are Classic-only.
const EXPECTED = {
    classic: {11597: 2250, 9907: 505, 11717: 640, 11198: 1700},
    forever: {11597: 2250, 9907: 505, 11717: 0, 11198: 0},
};
const CURSE_IDS = [704, 7658, 7659, 11717];

function armorReductions(mode, activeSets) {
    const engine = createReferenceEngine(mode);
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    createConfiguredPlayer(engine, fixture);
    engine.evaluate('buffs.forEach(b => b.active = false)');
    const player = () => engine.createPlayer({...fixture.player, mode});
    const baseline = player().target.basearmorbuffed;
    return activeSets.map(ids => {
        engine.evaluate('buffs.forEach(b => b.active = ids.includes(b.id))', {ids});
        const p = player();
        return {reduction: baseline - p.target.basearmorbuffed, exposed: !!p.exposed, improvedexposed: !!p.improvedexposed};
    });
}

for (const mode of ['classic', 'forever']) {
    test(`${mode}: highest-rank armor debuffs reduce target armor by the mode's values`, () => {
        const ids = Object.keys(EXPECTED[mode]).map(Number);
        const results = armorReductions(mode, ids.map(id => [id]));
        ids.forEach((id, i) => assert.equal(results[i].reduction, EXPECTED[mode][id], `${id}`));
    });
}

test('Expose Armor and Improved Expose Armor apply in Classic only', () => {
    const [classic] = armorReductions('classic', [[11198, 14169]]);
    assert.deepEqual(classic, {reduction: 1700 * 1.5, exposed: true, improvedexposed: true});
    const [forever] = armorReductions('forever', [[11198, 14169]]);
    assert.deepEqual(forever, {reduction: 0, exposed: false, improvedexposed: false});

    const engine = createReferenceEngine('forever');
    const expose = engine.evaluate('buffs.filter(b => b.name.includes("Expose Armor"))');
    assert.equal(expose.length, 6);
    for (const buff of expose) assert.equal(buff.mode, 'classic', `${buff.id}`);
});

test('Curse of Recklessness applies in Classic only', () => {
    const [classic] = armorReductions('classic', [[9907, 11717]]);
    assert.equal(classic.reduction, 505 + 640);
    // A stale Forever profile that still enables the Curse keeps only Faerie Fire.
    const [forever] = armorReductions('forever', [[9907, 11717]]);
    assert.equal(forever.reduction, 505);

    const engine = createReferenceEngine('forever');
    const curses = engine.evaluate('buffs.filter(b => b.name === "Curse of Recklessness")');
    assert.deepEqual([...curses.map(b => b.id)], CURSE_IDS);
    for (const buff of curses) assert.equal(buff.mode, 'classic', `${buff.id}`);
});

function renderBuffs(mode, activeIds) {
    const engine = createReferenceEngine(mode);
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const rows = [];
    const element = {
        0: {outerHTML: ''},
        empty() { return this; }, find() { return this; }, attr() { return this; }, removeClass() { return this; },
        append(value) { rows.push(value); return this; },
    };
    engine.evaluate(`$ = () => element; WEB_DB_URL = ''; localStorage = {[mode + 0]: JSON.stringify({level: '60', aqbooks: 'No'})};
        SIM.UI = {updateSession() {}, updateSidebar() {}}; SIM.SETTINGS.buffs = element;
        buffs.forEach(b => b.active = ids.includes(b.id)); SIM.SETTINGS.buildBuffs();`, {element, ids: activeIds});
    return {html: rows.join(''), active: [...engine.evaluate('buffs.filter(b => b.active).map(b => b.id)')]};
}

test('Forever hides Curse of Recklessness and clears a stale selection', () => {
    const classic = renderBuffs('classic', [9907, 11717]);
    assert.ok(classic.html.includes('data-id="11717"'));
    assert.deepEqual(classic.active, [9907, 11717]);

    const forever = renderBuffs('forever', [9907, 11717]);
    for (const id of CURSE_IDS) assert.ok(!forever.html.includes(`data-id="${id}"`), `${id}`);
    assert.ok(forever.html.includes('data-id="9907"'));
    assert.deepEqual(forever.active, [9907]);
});

test('Forever presets and defaults do not enable Curse of Recklessness', () => {
    for (const file of ['js/data/presets_forever.js', 'js/data/session_forever.js']) {
        const sandbox = {};
        vm.runInNewContext(fs.readFileSync(require.resolve(`../${file}`), 'utf8'), sandbox);
        const profiles = sandbox.profilePresets ? sandbox.profilePresets.map(p => p.profile) : [sandbox.session];
        assert.ok(profiles.length > 0, file);
        for (const profile of profiles) {
            assert.ok(profile.buffs.includes('9907'), `${file} keeps Faerie Fire`);
            for (const id of CURSE_IDS) assert.ok(!profile.buffs.includes(String(id)), `${file} enables ${id}`);
        }
    }
});
