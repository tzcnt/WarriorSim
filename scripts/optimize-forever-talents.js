#!/usr/bin/env node
'use strict';

// All combat and character construction use the verified production bundle.
// Only candidate generation, scheduling, and analysis run from this checkout.
const fs = require('node:fs');
const path = require('node:path');
const {parseArgs} = require('node:util');
const {createHash} = require('node:crypto');
const {sum, key, domain, neighbors, enumerate, startingBuilds, statistics} = require('./lib/talent-search');
const {searchSeeds} = require('./lib/search-seeds');

function options(args) {
    const {values} = parseArgs({args, options: {
        site: {type: 'string', default: 'https://fleetcode.com/WarriorSim/'},
        out: {type: 'string', default: 'scratch/forever-talents'},
        method: {type: 'string', default: 'local'}, bounds: {type: 'string'},
        'start-from': {type: 'string'},
        preset: {type: 'string'},
        starts: {type: 'string', default: '24'}, beam: {type: 'string', default: '4'},
        iterations: {type: 'string', default: '5000'}, refine: {type: 'string', default: '50000'},
        final: {type: 'string', default: '500000'}, finalists: {type: 'string', default: '8'},
        seed: {type: 'string', default: '20260913'}, threads: {type: 'string', default: '2'},
        rounds: {type: 'string', default: '30'}, limit: {type: 'string', default: '100000'},
        resume: {type: 'boolean', default: false}, help: {type: 'boolean', short: 'h'},
        'talent-actions': {type: 'boolean', default: false},
    }});
    if (values.help) return values;
    for (const name of ['starts', 'beam', 'iterations', 'refine', 'final', 'finalists', 'seed', 'threads', 'rounds', 'limit']) {
        values[name] = Number(values[name]);
        if (!Number.isSafeInteger(values[name]) || values[name] < (name === 'seed' ? 0 : 1)) throw new Error(`Invalid --${name}`);
    }
    if (values.seed > 0xffffffff || values.threads > 64 || values.iterations < 2 || values.refine < 2 || values.final < 2) throw new Error('Invalid seed, threads, or sample size');
    searchSeeds(values.seed, 3, Math.max(values.iterations, values.refine, values.final));
    if (!['local', 'exhaustive'].includes(values.method)) throw new Error('--method must be local or exhaustive');
    if (values.method === 'exhaustive' && !values.bounds) throw new Error('Exhaustive search requires explicit --bounds JSON');
    const url = new URL(values.site);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--site must be HTTP(S)');
    if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) url.pathname += '/';
    values.site = url.href;
    return values;
}

async function main(args = process.argv.slice(2)) {
    const opt = options(args);
    if (opt.help) {
        console.log(`Usage: node scripts/optimize-forever-talents.js [options]
  --site URL           Verified deployed site (default https://fleetcode.com/WarriorSim/)
  --out DIR            Checkpoints, results, and importable profile (scratch/forever-talents)
  --method local       Multistart beam search, followed by one-point neighborhood refinement
  --method exhaustive Enumerate every legal build inside --bounds FILE
  --bounds FILE       JSON object: talent key -> fixed rank or [minimum, maximum]
  --start-from FILE   Also seed local search with a previous results.json winner
  --preset ID         Load a deployed preset explicitly before measuring
  --starts 24 --beam 4 --rounds 30 --limit 100000
  --iterations 5000 --refine 50000 --final 500000 --finalists 8
  --seed 20260913 --threads 2 --resume --talent-actions
Requires npm ci --prefix compute and npm run --prefix compute install:browser.
Uses a fresh browser profile, the existing rotation (optionally also toggling
talent abilities and scheduling unused talent cooldowns with
--talent-actions), exactly level-9 points,
Bloodthirst, at least 31 Fury, and no Protection. No deployments or profile writes
occur on the site. --resume requires identical production build and configuration.`);
        return;
    }
    const {chromium} = require('../compute/node_modules/playwright');
    fs.mkdirSync(opt.out, {recursive: true});
    const write = (name, value) => {
        const target = path.join(opt.out, name);
        fs.writeFileSync(target + '.tmp', JSON.stringify(value, null, 2) + '\n');
        fs.renameSync(target + '.tmp', target);
    };
    const browser = await chromium.launch({headless: true, executablePath: process.env.COMPUTE_CHROMIUM_PATH || undefined});
    const stop = () => { browser.close().catch(() => {}); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
        const context = await browser.newContext();
        await context.addInitScript(threads => {
            localStorage.setItem('warriorsim.localThreads', String(threads));
            localStorage.setItem('warriorsim.sharedThreads', '2');
        }, opt.threads);
        const page = await context.newPage();
        page.setDefaultTimeout(60000);
        await page.goto(opt.site, {waitUntil: 'domcontentloaded'});
        await page.evaluate(() => simulatorReady);
        await page.waitForFunction(() => typeof sharedCompute !== 'undefined' && sharedCompute?.ready);
        if (opt.preset) await page.evaluate(id => {
            if (!profilePresets.some(preset => preset.id === id)) throw new Error(`Unknown preset: ${id}`);
            SIM.PROFILES.loadPreset(id);
            if (JSON.parse(localStorage[mode + (globalThis.profileid || 0)]).profilename !==
                profilePresets.find(preset => preset.id === id).profile.profilename) {
                throw new Error(`Failed to load preset: ${id}`);
            }
        }, opt.preset);
        const snapshot = await page.evaluate(() => {
            sharedCompute.beginForeground();
            const player = new Player(undefined, undefined, undefined, Player.getConfig());
            if (mode !== 'forever' || !player.mh || (!player.mh.twohand && !player.oh)) {
                throw new Error('Expected a Forever dual-wield or two-handed profile');
            }
            return {
                buildId: SIMULATOR_BUNDLE.buildId, networkThreads: sharedCompute.networkThreads,
                player: Player.getConfig(), sim: Simulation.getConfig(), profile: JSON.parse(localStorage[mode + (globalThis.profileid || 0)]),
                schema: FOREVER_TALENT_SCHEMA,
                trees: talents.map(tree => ({n: tree.n, t: tree.t.map(t => ({n: t.n, key: t.forever.key,
                    m: t.m, y: t.y, r: t.r, c: t.c, status: t.forever.implementationStatus}))})),
                weapons: {mh: player.mh.name, oh: player.oh?.name || null},
                rotation: spells.filter(s => s.active).map(s => ({id: s.id, name: s.name})),
                talentActions: talents.flatMap((tree, i) => tree.t.flatMap((t, j) => {
                    const spell = spells.find(s => s.name === t.n && Number(player.level) >= (s.minlevel || 0) &&
                        Number(player.level) <= (s.maxlevel || 60));
                    const settings = spell?.aura && spell.buff ? (spell.name === 'Death Wish' ?
                        {timetoend: 31, timetoendactive: true, timetostartactive: false} :
                        {timetostart: 0, timetostartactive: true, timetoendactive: false}) : {};
                    return t.enable && spell && (!spell.active ||
                        (spell.aura && spell.buff && !spell.timetostartactive && !spell.timetoendactive)) ?
                        [{i, j, id: spell.id, name: spell.name, settings}] : [];
                })),
                valid: validTalentBuild(talents, talents.map(tree => tree.t.map(t => t.c)), player.level),
            };
        });
        const bounds = opt.bounds ? JSON.parse(fs.readFileSync(opt.bounds, 'utf8')) : {};
        const extraStart = opt['start-from'] ? JSON.parse(fs.readFileSync(opt['start-from'], 'utf8')) : null;
        if (extraStart && (extraStart.buildId !== snapshot.buildId || !Array.isArray(extraStart.winner?.ranks))) {
            throw new Error('--start-from must contain a winner from the same production bundle');
        }
        const space = domain(snapshot.trees, Number(snapshot.player.level) - 9, bounds);
        if (extraStart && !space.accepts(extraStart.winner.ranks)) throw new Error('--start-from winner violates the search constraints');
        const baseline = snapshot.trees.map(tree => tree.t.map(t => t.c));
        const identity = createHash('sha256').update(JSON.stringify({format: 4, buildId: snapshot.buildId,
            profile: snapshot.profile, player: snapshot.player, sim: snapshot.sim, bounds, extraStart: extraStart?.winner.ranks,
            settings: {...opt, out: undefined, resume: undefined, bounds: undefined}})).digest('hex');
        const checkpoint = path.join(opt.out, 'checkpoint.json');
        const state = opt.resume && fs.existsSync(checkpoint) ? JSON.parse(fs.readFileSync(checkpoint, 'utf8')) :
            {identity, snapshot, options: opt, bounds, results: [], stages: []};
        if (state.identity !== identity) throw new Error('Checkpoint differs from deployed bundle/profile/search configuration; use a new --out');
        write('checkpoint.json', state);
        console.log(`Production ${snapshot.buildId}; ${snapshot.networkThreads} other shared threads`);
        console.log(`Baseline ${baseline.map(sum).join('/')} (${sum(baseline.flat())} points, legal=${snapshot.valid}); ${[snapshot.weapons.mh, snapshot.weapons.oh].filter(Boolean).join(' / ')}`);
        const candidateKey = row => `${key(row.ranks)}:${JSON.stringify(row.enabledTalents || [])}`;
        const changes = row => sum(row.ranks.flatMap((tree, i) => tree.map((rank, j) => Math.abs(rank - baseline[i][j]))));
        const compare = (a, b) => Math.abs(b.mean - a.mean) > 1e-6 ? b.mean - a.mean :
            changes(a) - changes(b) || candidateKey(a).localeCompare(candidateKey(b));
        const cache = new Map(state.results.map(r => [`${r.seed}:${r.iterations}:${candidateKey(r)}`, r]));

        // A row is resolved only when launched. Restore that row's talent snapshot at
        // launch, including delayed remote rows, before the site's Player constructor.
        await page.evaluate(({compute, actions}) => {
            globalThis.talentSearch = {completed: [], progress: {}, active: null, error: null,
                remoteIterations: compute?.remoteIterations || 0, localIterations: compute?.localIterations || 0,
                spells: structuredClone(spells), actions};
            const accept = SharedSimulation.prototype.accept;
            SharedSimulation.prototype.accept = function(index, report, local) {
                if (!this.done && this.states[index] !== 'done') {
                    talentSearch[local ? 'localIterations' : 'remoteIterations'] += report.iterations;
                }
                return accept.call(this, index, report, local);
            };
            globalThis.TalentSearchBatch = class extends SimulationRowBatch {
                launch(task, remote) {
                    talents.forEach((tree, i) => tree.t.forEach((t, j) => { t.c = task.params.ranks[i][j]; }));
                    globalThis.spells = structuredClone(talentSearch.spells);
                    for (const spell of spells) if (task.params.enabledTalents.includes(spell.id)) {
                        Object.assign(spell, {active: true}, talentSearch.actions.find(action => action.id === spell.id).settings);
                    }
                    if (!validTalentBuild(talents, task.params.ranks, Number(task.params.player[3].level))) {
                        throw new Error('Production talent validator rejected candidate');
                    }
                    super.launch(task, remote);
                }
            };
        }, {compute: state.compute, actions: snapshot.talentActions});

        async function evaluate(builds, iterations, seed, label) {
            const variants = builds.flatMap(build => {
                if (!Array.isArray(build)) return [build];
                let variants = [{ranks: build, enabledTalents: []}];
                if (opt['talent-actions']) for (const action of snapshot.talentActions) {
                    if (build[action.i][action.j]) variants = variants.flatMap(row => [row,
                        {...row, enabledTalents: [...row.enabledTalents, action.id]}]);
                }
                return variants;
            });
            const unique = [...new Map(variants.map(row => [candidateKey(row), row])).values()];
            const pending = unique.filter(row => !cache.has(`${seed}:${iterations}:${candidateKey(row)}`));
            console.log(`${label}: ${pending.length} new builds × ${iterations.toLocaleString()} fights (${unique.length - pending.length} cached)`);
            const started = Date.now();
            let lastLog = 0;
            if (pending.length) {
                await page.evaluate(({builds, iterations, seed, threads, player, sim}) => {
                    talentSearch.completed = [];
                    talentSearch.error = null;
                    talentSearch.progress = {};
                    const batch = new TalentSearchBatch(threads);
                    talentSearch.active = batch;
                    builds.forEach(({ranks, enabledTalents}, index) => {
                        const runner = batch.createRunner(report => {
                            talentSearch.completed.push({ranks, enabledTalents, seed, report});
                            delete talentSearch.progress[index];
                        }, (count) => { talentSearch.progress[index] = count; }, error => {
                            talentSearch.error = String(error?.stack || error);
                        });
                        runner.start({ranks, enabledTalents, player: [null, null, null, structuredClone(player)],
                            sim: {...sim, iterations, seed, iterationOffset: 0}, fullReport: false});
                    });
                    batch.start();
                }, {builds: pending, iterations, seed, threads: opt.threads, player: snapshot.player, sim: snapshot.sim});
                let completed = 0, lastProgress = Date.now();
                while (completed < pending.length) {
                    await page.waitForTimeout(1000);
                    const progress = await page.evaluate(() => ({
                        results: talentSearch.completed.splice(0), error: talentSearch.error,
                        activeIterations: Object.values(talentSearch.progress).reduce((a, b) => a + b, 0),
                        remoteIterations: talentSearch.remoteIterations, localIterations: talentSearch.localIterations,
                        ready: sharedCompute.ready, networkThreads: sharedCompute.networkThreads,
                    }));
                    if (progress.error) throw new Error(progress.error);
                    for (const result of progress.results) {
                        const record = {...result, ...statistics(result.report), stage: label};
                        cache.set(`${seed}:${iterations}:${candidateKey(record)}`, record);
                        state.results.push(record);
                    }
                    completed += progress.results.length;
                    state.compute = {...progress, results: undefined, error: undefined};
                    if (progress.results.length) { lastProgress = Date.now(); write('checkpoint.json', state); }
                    if (Date.now() - lastLog > 15000 || completed === pending.length) {
                        console.log(`  ${completed}/${pending.length}; ${((Date.now() - started) / 1000).toFixed(0)}s; remote fights ${progress.remoteIterations.toLocaleString()}; connected=${progress.ready}`);
                        lastLog = Date.now();
                    }
                    if (Date.now() - lastProgress > 600000) throw new Error('No completed candidates for ten minutes; checkpoint saved');
                }
            }
            return unique.map(row => cache.get(`${seed}:${iterations}:${candidateKey(row)}`)).sort(compare);
        }

        const allBuilds = new Map();
        const remember = builds => builds.forEach(ranks => allBuilds.set(key(ranks), ranks));
        const initial = opt.method === 'exhaustive' ? enumerate(space, opt.limit) :
            startingBuilds(space, baseline, opt.starts, opt.seed);
        if (extraStart && opt.method === 'local') initial.push(extraStart.winner.ranks);
        remember(initial);
        let ranked = await evaluate(initial, opt.iterations, opt.seed, 'screen');
        if (opt.method === 'local') {
            let beam = ranked.slice(0, opt.beam);
            for (let round = 1; round <= opt.rounds; round++) {
                const candidates = beam.flatMap(row => [row.ranks, ...neighbors(space, row.ranks)]);
                remember(candidates);
                ranked = await evaluate([...allBuilds.values()], opt.iterations, opt.seed, `search-${round}`);
                // Prefer distinct allocations of DPS talents, so filler ties do not consume the beam.
                const signatures = new Set();
                const next = ranked.filter(row => {
                    const signature = snapshot.trees.map((tree, i) => tree.t.map((t, j) =>
                        t.status === 'outside-dps-model' ? 0 : row.ranks[i][j]).join('')).join('/') + JSON.stringify(row.enabledTalents);
                    if (signatures.has(signature)) return false;
                    signatures.add(signature); return true;
                }).slice(0, opt.beam);
                console.log(`  Best ${next[0].ranks.map(sum).join('/')} ${next[0].mean.toFixed(3)} mean DPS ± ${next[0].ci95.toFixed(3)}`);
                if (next.map(candidateKey).join('|') === beam.map(candidateKey).join('|')) break;
                if (round === opt.rounds) throw new Error('Search round limit reached; increase --rounds');
                beam = next;
            }
        }
        state.stages.push({stage: 'screen', candidates: allBuilds.size});
        const [, refineSeed, finalSeed] = searchSeeds(opt.seed, 3, Math.max(opt.iterations, opt.refine, opt.final));
        // Keep statistically plausible contenders, not just the highest noisy screen
        // scores. Always recheck local-search seeds, including a prior known winner.
        const shortlist = ranked.filter((row, index) => index < Math.max(opt.finalists * 4, 32) ||
            ranked[0].mean - row.mean <= 3 * Math.hypot(ranked[0].se, row.se));
        let refined = await evaluate([...shortlist, ...(opt.method === 'local' ? initial : [])],
            opt.refine, refineSeed, 'refine-shortlist');
        let localOptimum = false;
        for (let round = 1; round <= opt.rounds; round++) {
            const previous = refined[0];
            const candidates = [previous.ranks, ...neighbors(space, previous.ranks)];
            remember(candidates);
            const checked = await evaluate(candidates, opt.refine, refineSeed, `refine-neighbors-${round}`);
            refined = [...new Map([...refined, ...checked].map(row => [candidateKey(row), row])).values()].sort(compare);
            if (candidateKey(refined[0]) === candidateKey(previous)) { localOptimum = true; break; }
        }
        if (!localOptimum) throw new Error('Refinement round limit reached; increase --rounds');
        const selected = refined[0];
        // Selection is frozen before independent validation; validation does not re-pick a noisy winner.
        const finalBuilds = [baseline, ...refined.slice(0, opt.finalists).map(row =>
            ({ranks: row.ranks, enabledTalents: row.enabledTalents}))];
        const finals = await evaluate(finalBuilds, opt.final, finalSeed, 'independent-validation');
        const winner = finals.find(row => candidateKey(row) === candidateKey(selected));
        const original = finals.find(row => key(row.ranks) === key(baseline) && !row.enabledTalents.length);
        const talents = snapshot.trees.map((tree, i) => ({n: tree.n, t: selected.ranks[i], keys: tree.t.map(t => t.key)}));
        const profile = structuredClone(snapshot.profile);
        profile.talents = talents;
        profile.talentSchema = snapshot.schema;
        profile.profilename = profile.profilename.replace(/\(\d+\/\d+\/\d+\)/,
            `(${selected.ranks.map(sum).join('/')})`);
        for (const spell of profile.rotation) if (selected.enabledTalents.includes(spell.id)) {
            Object.assign(spell, {active: true}, snapshot.talentActions.find(action => action.id === spell.id).settings);
        }
        // Use the deployed site's exporter for its field whitelist and ordering.
        const imported = await page.evaluate(profile => {
            const index = globalThis.profileid || 0;
            const storageKey = mode + index;
            const previous = localStorage[storageKey];
            const writeText = navigator.clipboard.writeText;
            let exported;
            try {
                localStorage[storageKey] = JSON.stringify(profile);
                navigator.clipboard.writeText = value => { exported = value; return Promise.resolve(); };
                SIM.PROFILES.exportProfile({data: () => index});
                if (!exported) throw new Error('Site exporter did not produce a profile');
                return JSON.parse(atob(exported));
            } finally {
                localStorage[storageKey] = previous;
                navigator.clipboard.writeText = writeText;
            }
        }, profile);
        const result = {created: new Date().toISOString(), site: opt.site, buildId: snapshot.buildId,
            method: opt.method, bounds, candidates: allBuilds.size, localOptimum,
            selection: selected, winner, baseline: original,
            baselineVariants: finals.filter(row => key(row.ranks) === key(baseline)), finalists: finals,
            improvement: {meanDps: winner.mean - original.mean, percent: (winner.mean / original.mean - 1) * 100,
                // Independent-seed estimate; same-seed covariance is unavailable in aggregate reports.
                unpairedCi95: 1.96 * Math.hypot(winner.se, original.se)},
            compute: state.compute, talents, snapshot};
        write('results.json', result);
        write('profile.json', imported);
        write('session.json', profile);
        fs.writeFileSync(path.join(opt.out, 'profile.txt'), Buffer.from(JSON.stringify(imported)).toString('base64') + '\n');
        write('checkpoint.json', state);
        console.log(`Selected ${selected.ranks.map(sum).join('/')}: ${winner.mean.toFixed(3)} ± ${winner.ci95.toFixed(3)} mean DPS; baseline ${original.mean.toFixed(3)} ± ${original.ci95.toFixed(3)}`);
        console.log(`Gain ${result.improvement.meanDps.toFixed(3)} DPS (${result.improvement.percent.toFixed(2)}%); results in ${opt.out}`);
    } finally {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
        await browser.close();
    }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = {options, main};
