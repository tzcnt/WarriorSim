'use strict';

// Capture before and after with the same checkout-built WASM and preset importer
// used by the UI. Build WASM before each capture; never reuse an old binary.
// node scripts/compare-forever-rage.js capture before|after
// node scripts/compare-forever-rage.js compare
// Add --no-recklessness-elune-16 to either command for the alternative cooldown setup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {Worker, isMainThread, parentPort, workerData} = require('node:worker_threads');
const {createReferenceEngine} = require('../test/wasm/reference-engine');
const {loadNativeModule} = require('../test/wasm/native-engine');
const {searchSeeds} = require('./lib/search-seeds');
const root = path.resolve(__dirname, '..');
const alternativeCooldowns = process.argv.includes('--no-recklessness-elune-16');
const output = path.join(root, 'data/forever/rage-patch-2026-10-01' +
    (alternativeCooldowns ? '-no-recklessness-elune-16' : ''));
const stats = [
    {name: 'agi', stat: 4, amount: 20}, {name: 'str', stat: 3, amount: 20},
    {name: 'ap', stat: 0, amount: 40}, {name: 'crit', stat: 1, amount: 1},
    {name: 'hit', stat: 2, amount: 1}, {name: 'haste', stat: 5, amount: 1},
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const json = name => JSON.parse(fs.readFileSync(path.join(output, name + '.json'), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(value, null, 2) + '\n');

function prepare(preset) {
    const engine = createReferenceEngine('forever');
    for (const file of ['js/profile-validation.js', 'js/profiles.js']) engine.evaluate(read(file));
    engine.evaluate(`
        localStorage = {};
        SIM.UI = {addAlert() {}};
        SIM.PROFILES.buildProfiles = () => {};
        SIM.PROFILES.showIssues = issues => { if (issues.length) throw new Error(JSON.stringify(issues)); };
        if (!SIM.PROFILES.importProfile(JSON.stringify(preset.profile), 1, session)) throw new Error('Import failed');
        saved = JSON.parse(localStorage.forever1);
        saved.mode = 'forever';
        updateGlobals(saved);
        $ = selector => ({val: () => saved[selector.match(/name="([^"]+)"/)[1]],
            text() {return this;}, prop() {return false;}});
    `, {preset});
    assert.deepEqual(JSON.parse(engine.evaluate('JSON.stringify(saved.talents.map(t => t.t))')),
        preset.profile.talents.map(t => t.t), 'Preset talents must survive import');
    const sim = JSON.parse(engine.evaluate('JSON.stringify(Simulation.getConfig())'));
    const variants = [{name: 'base'}, ...stats].map(({name, stat, amount}) => {
        const player = engine.evaluate('new Player(amount, stat, amount === undefined ? undefined : 3, Player.getConfig())', {amount, stat});
        assert.ok(player.mh, 'Preset must equip its weapon');
        assert.equal(player.race, preset.profile.race);
        return {name, spec: player.serializeSimulationSpec(sim)};
    });
    return {sim, variants};
}

function summarize(reports) {
    const sum = field => reports.reduce((total, r) => total + r[field], 0);
    const n = sum('iterations'), s1 = sum('sumdps');
    const variance = Math.max(0, (sum('sumdps2') - s1 * s1 / n) / (n - 1) / n);
    return {iterations: n, dps: sum('totaldmg') / sum('totalduration'), variance,
        error95: 1.96 * Math.sqrt(variance)};
}

async function capture(label) {
    assert.ok(['before', 'after'].includes(label), 'Expected before or after');
    fs.mkdirSync(output, {recursive: true});
    assert.ok(!fs.existsSync(path.join(output, label + '.json')), 'Refusing to overwrite a captured result');
    const catalog = {};
    vm.runInNewContext(read('js/data/presets_forever.js'), catalog);
    const presets = JSON.parse(JSON.stringify(catalog.profilePresets));
    if (alternativeCooldowns) for (const preset of presets) {
        const recklessness = preset.profile.rotation.find(spell => String(spell.id) === '1719');
        const elune = preset.profile.rotation.find(spell => spell.id === 'forever:elunes-light');
        assert.ok(recklessness && elune, 'Preset must contain both cooldowns');
        recklessness.active = false;
        Object.assign(elune, {active: true, timetoend: 16, timetoendactive: true, timetostartactive: false});
    }
    const seeds = searchSeeds(20261001, 3, Math.max(...presets.map(p => +p.profile.simulations)));
    const sourceFiles = execFileSync('git', ['ls-files', 'js', 'wasm/src'], {cwd: root, encoding: 'utf8'}).trim().split('\n');
    const state = {label, alternativeCooldowns, created: new Date().toISOString(),
        revision: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(),
        sourceHashes: Object.fromEntries(sourceFiles.map(file => [file, hash(read(file))])),
        wasmHash: hash(fs.readFileSync(path.join(root, 'wasm/dist/warriorsim.wasm'))),
        seeds, stats, presets, results: []};
    const jobs = presets.map(preset => {
        const {sim, variants} = prepare(preset);
        return {id: preset.id, sim, variants};
    });
    state.results = await Promise.all(jobs.map(async job => {
        const row = {...job, runs: await Promise.all(seeds.map(seed => new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {workerData: {...job, seed}});
            worker.once('message', reports => {
                console.log(`${label} ${job.id} seed ${seed}: ${summarize([reports.base]).dps.toFixed(3)} DPS`);
                resolve({seed, reports});
            });
            worker.once('error', reject);
            worker.once('exit', code => {if (code) reject(new Error(`Worker exited ${code}`));});
        })))};
        row.summary = summarize(row.runs.map(run => run.reports.base));
        row.weights = Object.fromEntries(stats.map(({name, amount}) => {
            const bumped = summarize(row.runs.map(run => run.reports[name]));
            return [name, {weight: (bumped.dps - row.summary.dps) / amount,
                // UI-style independent-sample error estimate; matched seeds induce covariance.
                uiError95: 1.96 * Math.sqrt(bumped.variance + row.summary.variance) / amount}];
        }));
        return row;
    }));
    write(label, state);
}

function compare() {
    const before = json('before'), after = json('after');
    assert.deepEqual(after.presets, before.presets);
    assert.deepEqual(after.seeds, before.seeds);
    assert.deepEqual(after.stats, before.stats);
    assert.equal(after.alternativeCooldowns, before.alternativeCooldowns);
    const rows = before.results.flatMap(b => {
        const a = after.results.find(row => row.id === b.id);
        assert.deepEqual(a.sim, b.sim);
        return ['dps', ...stats.map(s => s.name)].map(metric => {
            const old = metric === 'dps' ? b.summary.dps : b.weights[metric].weight;
            const next = metric === 'dps' ? a.summary.dps : a.weights[metric].weight;
            return {preset: b.id, metric, before: old, after: next, delta: next - old,
                percent: old ? (next / old - 1) * 100 : null};
        });
    });
    write('comparison', {method: 'Three independent 50,000-fight runs per preset and variant; same seeds before/after and across variants. DPS = total damage / total duration. Weights = DPS change per stat unit using UI increments. Crit/hit/haste units are percentage points. ' +
        (alternativeCooldowns ? 'All three presets have Recklessness disabled and Elune\'s Light scheduled 16 seconds before fight end; all other settings unchanged.' : 'Presets and rotations unchanged.'), rows});
    const keys = Object.keys(rows[0]);
    fs.writeFileSync(path.join(output, 'comparison.csv'), [keys.join(','), ...rows.map(row => keys.map(k => row[k]).join(','))].join('\n') + '\n');
    console.table(rows);
}

async function runWorker() {
    const native = await loadNativeModule();
    const {sim, variants, seed} = workerData;
    const reports = {};
    for (const {name, spec} of variants) {
        const handle = native.createEngine(JSON.stringify(spec), seed);
        try { reports[name] = JSON.parse(native.runBatch(handle, sim.iterations, 0, false)); }
        finally { native.destroyEngine(handle); }
    }
    parentPort.postMessage(reports);
}

if (!isMainThread) runWorker().catch(error => {throw error;});
else if (process.argv[2] === 'capture') capture(process.argv[3]).catch(error => {console.error(error); process.exitCode = 1;});
else if (process.argv[2] === 'compare') compare();
else throw new Error('Usage: node scripts/compare-forever-rage.js capture before|after OR compare');
