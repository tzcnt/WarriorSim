#!/usr/bin/env node
'use strict';

// Candidate generation is local; character construction and every combat run use
// the deployed site's verified bundle and its shared compute pool.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {parseArgs} = require('node:util');
const {createHash} = require('node:crypto');
const {statistics} = require('./lib/talent-search');
const {searchSeeds} = require('./lib/search-seeds');
const NORMAL = ['Bloodthirst', 'Whirlwind', 'Overpower', 'SunderArmor', 'Hamstring'];
const EXECUTE = ['Execute', ...NORMAL];

function orders(items) {
    const result = [[]];
    for (const item of items) for (const tail of orders(items.filter(other => other !== item))) result.push([item, ...tail]);
    return result;
}
const key = row => JSON.stringify(row);
const unique = rows => [...new Map(rows.map(row => [key(row), row])).values()];
function candidate(normal, execute, heroic = true, hamrage = 50, sunder = true, disabled = []) {
    return {normal, execute, heroic, hamrage: normal.includes('Hamstring') || execute.includes('Hamstring') ? hamrage : 50,
        sunder, disabled: [...new Set(disabled)].sort()};
}
function applyRotation(catalog, row) {
    const result = structuredClone(catalog);
    for (const spell of result) {
        const name = spell.classname;
        if (EXECUTE.includes(name)) {
            const normal = row.normal.indexOf(name), execute = row.execute.indexOf(name);
            spell.active = normal >= 0 || execute >= 0;
            spell.priority = normal < 0 ? 0 : 10 - normal;
            spell.expriority = execute < 0 ? 0 : 10 - execute;
        }
        if (name === 'SunderArmor') Object.assign(spell, {globals: '1', globalsactive: row.sunder});
        if (name === 'Hamstring') Object.assign(spell, {minrage: row.hamrage, minrageactive: true});
        if (name === 'HeroicStrike') spell.active = row.heroic;
        if (row.disabled.includes(name)) spell.active = false;
    }
    return result;
}

async function main() {
    const {values: opt} = parseArgs({options: {
        site: {type: 'string', default: 'https://fleetcode.com/WarriorSim/'},
        preset: {type: 'string', default: 'js/data/presets_forever.js'},
        out: {type: 'string', default: 'scratch/forever-abilities'},
        iterations: {type: 'string', default: '10000'}, refine: {type: 'string', default: '100000'},
        final: {type: 'string', default: '1000000'}, seed: {type: 'string', default: '20260915'},
        rounds: {type: 'string', default: '4'}, resume: {type: 'boolean', default: false},
        smoke: {type: 'boolean', default: false}, help: {type: 'boolean', short: 'h'},
    }});
    if (opt.help) {
        console.log('Usage: node scripts/optimize-forever-abilities.js [--site URL] [--preset FILE] [--out DIR] [--resume]\n' +
            '  --iterations 10000 --refine 100000 --final 1000000 --seed 20260915 --rounds 4\n' +
            '  --smoke runs just the controlled baseline comparisons. Requires compute Playwright.\n' +
            'Searches ordered subsets in each phase, Heroic Strike on/off and Hamstring rage thresholds.\n' +
            'Writes results and an importable profile; does not edit the preset or deploy.');
        return;
    }
    for (const name of ['iterations', 'refine', 'final', 'seed', 'rounds']) {
        opt[name] = Number(opt[name]);
        if (!Number.isSafeInteger(opt[name]) || opt[name] < (name === 'seed' ? 0 : 1)) throw new Error(`Invalid --${name}`);
    }
    if (opt.seed > 0xffffffff || ['iterations', 'refine', 'final'].some(name => opt[name] < 2 || opt[name] > 16384000)) throw new Error('Invalid seed or sample size');
    const site = new URL(opt.site);
    if (!['https:', 'http:'].includes(site.protocol)) throw new Error('--site must be HTTP(S)');
    if (!site.pathname.endsWith('/') && !site.pathname.endsWith('.html')) site.pathname += '/';
    opt.site = site.href;
    const catalog = {};
    let preset;
    if (opt.preset.endsWith('.json')) {
        const input = JSON.parse(fs.readFileSync(opt.preset, 'utf8'));
        preset = input.preset || input;
    } else {
        vm.runInNewContext(fs.readFileSync(opt.preset, 'utf8'), catalog);
        preset = JSON.parse(JSON.stringify(catalog.profilePresets.find(row => row.id === 'forever-dual-wield-fury')));
    }
    assert(preset?.profile?.rotation, '--preset must contain the Forever dual-wield preset or a recorded result');
    fs.mkdirSync(opt.out, {recursive: true});
    const write = (name, value) => {
        const filename = path.join(opt.out, name);
        fs.writeFileSync(filename + '.tmp', JSON.stringify(value, null, 2) + '\n');
        fs.renameSync(filename + '.tmp', filename);
    };
    const {chromium} = require('../compute/node_modules/playwright');
    const browser = await chromium.launch({headless: true, executablePath: process.env.COMPUTE_CHROMIUM_PATH || undefined});
    const stop = () => { browser.close().catch(() => {}); };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    try {
        const context = await browser.newContext();
        await context.addInitScript(() => {
            localStorage.setItem('warriorsim.localThreads', '2');
            localStorage.setItem('warriorsim.sharedThreads', '2');
        });
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        await page.goto(opt.site, {waitUntil: 'domcontentloaded'});
        await page.evaluate(() => simulatorReady);
        await page.waitForFunction(() => typeof SIM !== 'undefined' && SIM.PROFILES?.container?.find('.profile').length > 0 &&
            typeof sharedCompute !== 'undefined' && sharedCompute?.ready);
        const snapshot = await page.evaluate(preset => {
            sharedCompute.beginForeground();
            SIM.PROFILES.importProfile(JSON.stringify(preset.profile), 1, session);
            SIM.PROFILES.loadProfile(SIM.PROFILES.container.find('[data-index="1"]'));
            setSimulationSeed(0);
            const player = new Player(undefined, undefined, undefined, Player.getConfig());
            if (mode !== 'forever' || !player.oh || player.mh.twohand) throw new Error('Expected Forever dual wield');
            const ranks = talentSelection().map(tree => tree.t);
            if (!validTalentBuild(talents, ranks, player.level)) throw new Error('Invalid talents');
            return {buildId: SIMULATOR_BUNDLE.buildId, networkThreads: sharedCompute.networkThreads,
                player: Player.getConfig(), sim: Simulation.getConfig(), ranks,
                spec: player.serializeSimulationSpec(Simulation.getConfig()),
                spells: structuredClone(spells.filter(spell =>
                    (!spell.mode || spell.mode === mode) && racialSpellAvailable(spell.id, player.race, mode) &&
                    player.level >= (spell.minlevel || 0) && player.level <= (spell.maxlevel || 60) &&
                    (typeof spell.aq === 'undefined' || spell.aq === player.aqbooks))),
                buffs: buffs.filter(buff => buff.active).map(buff => ({id: buff.id, name: buff.name})),
                weapons: {mh: player.mh.name, oh: player.oh.name},
                normal: player.normalspells.map(spell => spell.constructor.name).filter(name => name !== 'Execute'),
                execute: player.executespells.map(spell => spell.constructor.name),
                saved: JSON.parse(localStorage.forever1)};
        }, preset);
        assert.deepEqual(snapshot.ranks, preset.profile.talents.map(tree => tree.t));
        assert.equal(snapshot.player.race, preset.profile.race);
        for (const id of ['11597', '9907', '11717']) assert(snapshot.buffs.some(buff => String(buff.id) === id), `Missing debuff ${id}`);
        assert.equal(snapshot.spells.some(spell => spell.classname === 'BattleShout' && spell.active),
            preset.profile.rotation.some(spell => spell.classname === 'BattleShout' && spell.active !== false));
        const identity = createHash('sha256').update(JSON.stringify({format: 2, buildId: snapshot.buildId, preset,
            options: {...opt, resume: undefined, out: undefined}})).digest('hex');
        const checkpoint = path.join(opt.out, 'checkpoint.json');
        const state = opt.resume && fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) :
            {created: new Date().toISOString(), identity, options: opt, preset, snapshot, results: [], stages: [], compute: {remoteIterations: 0, localIterations: 0}};
        assert.equal(state.identity, identity, 'Resume requires the same deployed bundle, input preset and options');
        const cache = new Map(state.results.map(row => [`${row.seed}:${row.iterations}:${row.fullReport}:${key(row.candidate)}`, row]));
        write('checkpoint.json', state);
        console.log(`Production ${snapshot.buildId}; ${snapshot.networkThreads} other shared threads; ${snapshot.player.race}; ${snapshot.weapons.mh} / ${snapshot.weapons.oh}`);
        console.log(`Normal: ${snapshot.normal.join(' > ')}; Execute: ${snapshot.execute.join(' > ')}`);
        // Restore each row immediately before its synchronous spec construction.
        // Fixed construction RNG prevents irrelevant random Heroic Strike queue
        // timers from changing specs; combat RNG is still seeded independently.
        await page.evaluate(({source, baseline, compute}) => {
            globalThis.applyAbilityRotation = (0, eval)(`(${source})`);
            globalThis.EXECUTE = ['Execute', 'Bloodthirst', 'Whirlwind', 'Overpower', 'SunderArmor', 'Hamstring'];
            globalThis.abilitySearch = {baseline, completed: [], error: null, ...compute};
            const accept = SharedSimulation.prototype.accept;
            SharedSimulation.prototype.accept = function(index, report, local) {
                if (!this.done && this.states[index] !== 'done') abilitySearch[local ? 'localIterations' : 'remoteIterations'] += report.iterations;
                return accept.call(this, index, report, local);
            };
            globalThis.AbilitySearchBatch = class extends SimulationRowBatch {
                launch(task, remote) {
                    globalThis.spells = applyAbilityRotation(abilitySearch.baseline, task.params.candidate);
                    setSimulationSeed(0);
                    super.launch(task, remote);
                }
            };
        }, {source: applyRotation.toString(), baseline: snapshot.spells, compute: state.compute});
        const compare = (a, b) => Math.abs(b.mean - a.mean) > 1e-8 ? b.mean - a.mean :
            a.candidate.disabled.length - b.candidate.disabled.length ||
            (a.candidate.normal.length + a.candidate.execute.length) - (b.candidate.normal.length + b.candidate.execute.length) ||
            key(a.candidate).localeCompare(key(b.candidate));
        async function evaluate(rows, iterations, seed, label, fullReport = false) {
            const candidates = unique(rows);
            const cacheKey = row => `${seed}:${iterations}:${fullReport}:${key(row)}`;
            const pending = candidates.filter(row => !cache.has(cacheKey(row)));
            console.log(`${label}: ${pending.length} new candidates x ${iterations} fights`);
            if (pending.length) {
                await page.evaluate(({rows, iterations, seed, fullReport, player, sim}) => {
                    abilitySearch.completed = []; abilitySearch.error = null;
                    const batch = new AbilitySearchBatch(2);
                    abilitySearch.batch = batch;
                    for (const candidate of rows) {
                        const runner = batch.createRunner(report => abilitySearch.completed.push({candidate, report}), () => {},
                            error => { abilitySearch.error = String(error?.stack || error); });
                        runner.start({candidate, player: [null, null, null, structuredClone(player)],
                            sim: {...sim, seed, iterations, iterationOffset: 0}, fullReport});
                    }
                    batch.start();
                }, {rows: pending, iterations, seed, fullReport, player: snapshot.player, sim: snapshot.sim});
                let completed = 0, lastProgress = Date.now(), lastLog = 0;
                while (completed < pending.length) {
                    await page.waitForTimeout(1000);
                    const progress = await page.evaluate(() => ({results: abilitySearch.completed.splice(0), error: abilitySearch.error,
                        remoteIterations: abilitySearch.remoteIterations, localIterations: abilitySearch.localIterations,
                        ready: sharedCompute.ready, networkThreads: sharedCompute.networkThreads}));
                    if (progress.error) throw new Error(progress.error);
                    for (const result of progress.results) {
                        const record = {...result, seed, fullReport, ...statistics(result.report), stage: label};
                        cache.set(cacheKey(record.candidate), record); state.results.push(record);
                    }
                    completed += progress.results.length;
                    state.compute = {remoteIterations: progress.remoteIterations, localIterations: progress.localIterations};
                    if (progress.results.length) { lastProgress = Date.now(); write('checkpoint.json', state); }
                    if (Date.now() - lastLog >= 15000 || completed === pending.length) {
                        console.log(`  ${completed}/${pending.length}; remote ${progress.remoteIterations.toLocaleString()}; pool ${progress.networkThreads}; connected=${progress.ready}`);
                        lastLog = Date.now();
                    }
                    if (Date.now() - lastProgress > 600000) throw new Error('No completed candidates in ten minutes; checkpoint saved');
                }
            }
            const ranked = candidates.map(row => cache.get(cacheKey(row))).sort(compare);
            console.log(`  Best ${ranked[0].mean.toFixed(3)} +/- ${ranked[0].ci95.toFixed(3)}: ${key(ranked[0].candidate)}`);
            return ranked;
        }
        const [seed, refineSeed, ...finalSeeds] = searchSeeds(opt.seed, 5, Math.max(opt.iterations, opt.refine, opt.final));
        const baseline = candidate(snapshot.normal, snapshot.execute,
            snapshot.spells.some(spell => spell.classname === 'HeroicStrike' && spell.active),
            Number(snapshot.spells.find(spell => spell.classname === 'Hamstring')?.minrage || 50));
        const resolvedBaseline = await page.evaluate(({row, player, sim}) => {
            globalThis.spells = applyAbilityRotation(abilitySearch.baseline, row);
            setSimulationSeed(0);
            return resolveSharedSimulationSpec({player: [null, null, null, structuredClone(player)], sim});
        }, {row: baseline, player: snapshot.player, sim: snapshot.sim});
        const comparable = spec => {
            const copy = structuredClone(spec);
            // Priority numbers only express ordering. Execute cannot be used
            // before the Execute phase, so omit its inert normal-phase entry.
            for (const action of [...copy.player.spells, ...copy.player.auras]) {
                delete action.props.priority; delete action.props.expriority;
            }
            copy.player.links.normalSpells = copy.player.links.normalSpells.filter(action => action.key !== 'execute');
            copy.player.props.normalspells_c = copy.player.links.normalSpells.length;
            // This search always starts by enabling the requested one-use cap.
            const sunder = copy.player.spells.find(spell => spell.kind === 'SunderArmor');
            if (sunder) delete sunder.props.globals;
            return copy;
        };
        assert.deepEqual(comparable(resolvedBaseline), comparable(snapshot.spec), 'Candidate baseline must match the imported preset');
        const original = {...baseline, sunder: false};
        const lowHam = candidate([...baseline.normal.filter(name => name !== 'Hamstring'), 'Hamstring'], baseline.execute, baseline.heroic);
        const controls = [original, baseline, lowHam];
        const active = snapshot.spells.filter(spell => spell.active).map(spell => spell.classname);
        function ablations(row) {
            return [...new Set([...active, 'Hamstring'])].map(name => name === 'HeroicStrike' ? {...row, heroic: !row.heroic} :
                EXECUTE.includes(name) ? candidate(row.normal.filter(s => s !== name), row.execute.filter(s => s !== name), row.heroic, row.hamrage, row.sunder, row.disabled) :
                {...row, disabled: row.disabled.includes(name) ? row.disabled.filter(value => value !== name) : [...row.disabled, name].sort()});
        }
        await evaluate([...controls, ...ablations(baseline)], opt.refine, refineSeed, 'controlled-changes');
        if (opt.smoke) { write('results.json', state); return; }
        state.stages = [];
        async function search(rows, label) {
            const ranked = await evaluate(rows, opt.iterations, seed, label + '-screen');
            const contenders = ranked.filter((row, index) => index < 24 || ranked[0].mean - row.mean <= 3 * Math.hypot(ranked[0].se, row.se));
            const refined = await evaluate(contenders.map(row => row.candidate), opt.refine, refineSeed, label + '-refine');
            state.stages.push({label, candidates: ranked.length, refined: refined.length, winner: refined[0]});
            write('checkpoint.json', state);
            return refined;
        }
        let selected = baseline, finalists = [], converged = false;
        for (let round = 1; round <= opt.rounds; round++) {
            const before = key(selected);
            const normal = orders(NORMAL).flatMap(order => [true, false].flatMap(heroic =>
                (order.includes('Hamstring') || selected.execute.includes('Hamstring') ? [...new Set([10, 30, 50, 70, selected.hamrage])] : [50]).map(rage =>
                    candidate(order, selected.execute, heroic, rage, true, selected.disabled))));
            const normalResults = await search([...normal, selected], `normal-${round}`);
            selected = normalResults[0].candidate;
            const execute = orders(EXECUTE).map(order => candidate(selected.normal, order, selected.heroic, selected.hamrage, true, selected.disabled));
            const executeResults = await search([...execute, selected], `execute-${round}`);
            selected = executeResults[0].candidate;
            const tuned = await search([selected, ...Array.from({length: 10}, (_, i) =>
                candidate(selected.normal, selected.execute, selected.heroic, 10 + i * 10, true, selected.disabled)), ...ablations(selected)], `tune-${round}`);
            selected = tuned[0].candidate;
            finalists = [...normalResults.slice(0, 4), ...executeResults.slice(0, 4), ...tuned.slice(0, 4)].map(row => row.candidate);
            if (key(selected) === before) { converged = true; break; }
        }
        if (!converged) throw new Error('Search has not converged; raise --rounds with a new output directory');
        // Freeze the selection before three independent final seeds. Include a
        // no-Hamstring comparison and ablations so marginal choices are reviewable.
        const phaseAblations = selected.execute.map(name => candidate(selected.normal,
            selected.execute.filter(value => value !== name), selected.heroic, selected.hamrage, true, selected.disabled));
        const sunderOnce = candidate([...selected.normal.filter(name => name !== 'SunderArmor').slice(0, 2),
            'SunderArmor', ...selected.normal.filter(name => name !== 'SunderArmor').slice(2)], selected.execute,
            selected.heroic, selected.hamrage, true, selected.disabled);
        const validations = unique([...controls, selected, ...finalists, ...ablations(selected), ...phaseAblations,
            sunderOnce, candidate(selected.normal, selected.execute, selected.heroic, 50, true, selected.disabled)]);
        const finals = [];
        for (const finalSeed of finalSeeds) finals.push(...await evaluate(validations, opt.final, finalSeed, 'independent-validation', true));
        const aggregate = row => {
            const records = finals.filter(record => key(record.candidate) === key(row));
            const report = Object.fromEntries(['iterations', 'sumdps', 'sumdps2', 'totaldmg', 'totalduration'].map(name =>
                [name, records.reduce((sum, record) => sum + record.report[name], 0)]));
            return {candidate: row, ...statistics(report), report, seeds: records.map(record => ({seed: record.seed, mean: record.mean, ci95: record.ci95}))};
        };
        const winner = aggregate(selected), originalResult = aggregate(original), baselineResult = aggregate(baseline);
        const profile = structuredClone(preset.profile);
        // Only emit the correct rank, matching the imported preset's level/AQ settings.
        profile.rotation = applyRotation(snapshot.spells, selected).filter(spell => spell.active);
        const specs = await page.evaluate(({rows, player, sim}) => rows.map(candidate => {
            globalThis.spells = applyAbilityRotation(abilitySearch.baseline, candidate);
            setSimulationSeed(0);
            return {candidate, spec: resolveSharedSimulationSpec({player: [null, null, null, structuredClone(player)], sim})};
        }), {rows: [original, baseline, selected], player: snapshot.player, sim: {...snapshot.sim, seed: finalSeeds[0], iterations: opt.final, iterationOffset: 0}});
        const result = {created: state.created, completed: new Date().toISOString(), site: opt.site, buildId: snapshot.buildId,
            options: opt, preset, snapshot, converged, stages: state.stages, compute: state.compute,
            candidates: unique(state.results.map(row => row.candidate)).length, winner, original: originalResult, baseline: baselineResult,
            comparisons: validations.map(aggregate), finalSeeds, finals, specs,
            improvement: {meanDps: winner.mean - originalResult.mean, percent: (winner.mean / originalResult.mean - 1) * 100,
                unpairedCi95: 1.96 * Math.hypot(winner.se, originalResult.se)}};
        write('results.json', result); write('profile.json', profile);
        fs.writeFileSync(path.join(opt.out, 'profile.txt'), Buffer.from(JSON.stringify(profile)).toString('base64') + '\n');
        console.log(`Selected ${winner.mean.toFixed(3)} +/- ${winner.ci95.toFixed(3)}; original ${originalResult.mean.toFixed(3)}; gain ${result.improvement.meanDps.toFixed(3)} DPS (${result.improvement.percent.toFixed(2)}%)`);
    } finally {
        process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
        await browser.close();
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {orders, candidate, applyRotation};
