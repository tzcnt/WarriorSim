'use strict';

const test = require('node:test');
const {extraFixtures} = require('./extra-fixtures');
const {assertNativeReports} = require('./report-assertions');
const {runReference, mergeReports, createReferenceEngine, createConfiguredPlayer, loadFixtures} = require('./reference-engine');
const {loadNativeModule, runNative, createNativeHandle} = require('./native-engine');
const {queuedStrikeFixtures} = require('./queued-strike-fixtures');
let wasmModule;

test.before(async () => { wasmModule = await loadNativeModule(); });

for (const queued of queuedStrikeFixtures().filter(fixture => fixture.mode === 'forever')) {
    for (const execute of [false, true]) test(`${queued.name}: native ignores legacy queue options${execute ? ' during Execute' : ''}`, () => {
        const fixture = execute ? structuredClone(loadFixtures().find(value => value.mode === 'forever')) : queued;
        if (execute) {
            fixture.rotation = queued.rotation;
            fixture.player.adjacent = queued.player.adjacent;
        }
        const engine = createReferenceEngine('forever');
        const player = createConfiguredPlayer(engine, fixture);
        const spec = player.serializeSimulationSpec(fixture.sim);
        for (const spell of spec.player.spells) {
            if (spell.kind === 'HeroicStrike' || spell.kind === 'Cleave') {
                spell.props.unqueue = 1000;
                spell.props.exmacro = true;
            }
        }
        const handle = wasmModule.createEngine(JSON.stringify(spec), fixture.sim.seed);
        try {
            const actual = JSON.parse(wasmModule.runBatch(handle, fixture.sim.iterations, 0, true));
            assertNativeReports(actual, runReference(fixture), queued.name + ' legacy options');
        } finally {
            wasmModule.destroyEngine(handle);
        }
    });
}

for (const fixture of extraFixtures()) {
    test(`${fixture.name}: optimized native complete parity and persistent batches`, () => {
        const expected = runReference(fixture);
        assertNativeReports(runNative(wasmModule, fixture), expected, fixture.name);
        const {handle} = createNativeHandle(wasmModule, fixture);
        const batches = [];
        let offset = 0;
        const partitions = fixture.sim.iterations === 3 ? [1, 2] : [1, 4, fixture.sim.iterations - 5];
        try {
            for (const count of partitions) {
                batches.push(JSON.parse(wasmModule.runBatch(handle, count, offset, true)));
                offset += count;
            }
        } finally {
            wasmModule.destroyEngine(handle);
        }
        assertNativeReports(mergeReports(batches), expected, fixture.name + ' persistent');
    });
}

for (const mode of ['classic', 'forever']) test(`${mode}: deployed worker and actual WASM ABI preserve full reports across batches`, async () => {
    const path = require('node:path');
    const {pathToFileURL} = require('node:url');
    const assert = require('node:assert/strict');
    const {createWorkerHarness} = require('./worker-harness');
    const {createReferenceEngine, createState, loadFixtures} = require('./reference-engine');
    const factory = (await import(pathToFileURL(path.resolve(__dirname, '../../dist/wasm/warriorsim.js')).href)).default;
    const actualModule = await factory();
    const fixture = loadFixtures().find(value => value.mode === mode);
    const engine = createReferenceEngine(mode);
    const sim = {...fixture.sim, iterations: 7, iterationOffset: 13};
    const worker = createWorkerHarness(actualModule);
    await worker.run({
        player: [null, null, null, {...fixture.player, mode}],
        globals: {...createState(engine, fixture), mode},
        sim, fullReport: true, batchSize: 3,
    });
    assert.equal(worker.messages.length, 3, 'two progress messages and one final report');
    assert.equal(worker.messages[0][1], 3);
    assert.equal(worker.messages[1][1], 6);
    const actual = worker.messages[2][1];
    assertNativeReports(actual, runReference(fixture, {sim}), `${mode} actual deployed worker`);
});

for (const mode of ['classic', 'forever']) test(`${mode}: Slam next-auto option has native parity and blocks imminent swings`, () => {
    const assert = require('node:assert/strict');
    const fixture = structuredClone(loadFixtures().find(f => f.mode === mode));
    fixture.rotation = {11605: {active: true, priority: 10, expriority: 10,
        afterswing: false, minrageactive: false, maincdactive: false, nextautoactive: true}};
    fixture.sim = {...fixture.sim, iterations: 3, startrage: 100};
    for (const threshold of [0, 500, 100000]) {
        fixture.rotation[11605].nextauto = threshold;
        const expected = runReference(fixture);
        const actual = runNative(wasmModule, fixture);
        assertNativeReports(actual, expected, `${mode} Slam next-auto ${threshold}`);
        const casts = actual.player.spells.slam.data.reduce((sum, count) => sum + count, 0);
        if (mode === 'forever' && threshold === 100000) assert.equal(casts, 0);
        else assert.ok(casts > 0);
    }
});
