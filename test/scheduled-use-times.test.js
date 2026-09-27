'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const {createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./wasm/reference-engine');

// Loads the rotation details UI with just enough DOM to capture the use-time list.
function setup(mode) {
    const engine = createReferenceEngine(mode);
    const player = createConfiguredPlayer(engine, structuredClone(loadFixtures().find(value => value.mode === mode)));
    engine.evaluate(fs.readFileSync(require.resolve('../js/settings.js'), 'utf8'));
    const element = () => ({
        rows: [],
        empty() { this.rows.length = 0; return this; },
        append(value) { this.rows.push(...(typeof value === 'string' ? [value] : value.rows)); return this; },
    });
    const list = element();
    const fight = {};
    let cooldown = 0;
    const details = {find: () => list, data: () => cooldown, hasClass: () => false};
    engine.evaluate(`
        $ = () => element();
        Player = function() { return player; };
        SIM.SETTINGS.rotation = {find: () => details};
        SIM.SETTINGS.fight = {find: selector => ({val: () => fight[/name="(\\w+)"/.exec(selector)[1]]})};
    `, {element, player, details, fight});
    const spell = id => engine.evaluate('spells.find(value => value.id == id)', {id});
    return {
        cooldown: id => engine.evaluate('SIM.SETTINGS.scheduledCooldown(spell)', {spell: spell(id)}),
        useTimes(id, schedule, min, max = min) {
            Object.assign(fight, {timesecsmin: String(min), timesecsmax: String(max)});
            const value = Object.assign(spell(id), {timetostartactive: false, timetoendactive: false}, schedule);
            cooldown = engine.evaluate('SIM.SETTINGS.scheduledCooldown(spell)', {spell: value});
            engine.evaluate('SIM.SETTINGS.buildUseTimes(spell)', {spell: value});
            return list.rows.map(row => row.replace(/<[^>]+>/g, ''));
        },
        format: seconds => engine.evaluate('SIM.SETTINGS.formatUseTime(seconds)', {seconds}),
    };
}

for (const mode of ['classic', 'forever']) {
    test(`${mode}: an end-of-fight schedule lists the earlier uses counted back from it`, () => {
        const ui = setup(mode);
        assert.equal(ui.cooldown(17528), 120, 'Mighty Rage Potion');
        assert.deepEqual(ui.useTimes(17528, {timetoendactive: true, timetoend: 16}, 300), [
            'Additional use times:',
            'Use 2 minutes, 18 seconds from the end of the fight',
            'Use 4 minutes, 20 seconds from the end of the fight',
        ]);
    });

    test(`${mode}: a start-of-fight schedule lists every later cooldown`, () => {
        const ui = setup(mode);
        assert.deepEqual(ui.useTimes(17528, {timetostartactive: true, timetostart: 0}, 300), [
            'Additional use times:',
            'Use 2 minutes from the start of the fight',
            'Use 4 minutes from the start of the fight',
        ]);
    });

    test(`${mode}: uses that only fit the longer fights say so`, () => {
        const ui = setup(mode);
        assert.deepEqual(ui.useTimes(17528, {timetoendactive: true, timetoend: 16}, 200, 300), [
            'Additional use times:',
            'Use 2 minutes, 18 seconds from the end of the fight',
            'Use 4 minutes, 20 seconds from the end of the fight (only in fights of 4 minutes, 20 seconds or longer)',
        ]);
    });

    test(`${mode}: there is no list without an enabled schedule or another use in the fight`, () => {
        const ui = setup(mode);
        assert.deepEqual(ui.useTimes(17528, {}, 300), []);
        assert.equal(ui.cooldown(12328), 180, 'Death Wish');
        assert.deepEqual(ui.useTimes(12328, {timetoendactive: true, timetoend: 31}, 60), []);
    });
}

test('use times read naturally', () => {
    const ui = setup('classic');
    assert.equal(ui.format(45), '45 seconds');
    assert.equal(ui.format(60), '1 minute');
    assert.equal(ui.format(61), '1 minute, 1 second');
    assert.equal(ui.format(138), '2 minutes, 18 seconds');
});
