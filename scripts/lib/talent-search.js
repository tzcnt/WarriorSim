'use strict';

const sum = values => values.reduce((a, b) => a + b, 0);
const key = ranks => ranks.map(tree => tree.join('')).join('/');

function valid(trees, ranks, points = 51, complete = true) {
    if (ranks.length !== trees.length) return false;
    let total = 0;
    for (let i = 0; i < trees.length; i++) {
        if (ranks[i].length !== trees[i].t.length) return false;
        for (let j = 0; j < trees[i].t.length; j++) {
            const t = trees[i].t[j], rank = ranks[i][j];
            if (!Number.isInteger(rank) || rank < 0 || rank > t.m) return false;
            total += rank;
            if (!rank) continue;
            const lower = sum(trees[i].t.map((other, k) => other.y < t.y ? ranks[i][k] : 0));
            if (lower < t.y * 5 || (t.r && ranks[i][t.r[0]] < t.r[1])) return false;
        }
    }
    return complete ? total === points : total <= points;
}

function domain(trees, points = 51, bounds = {}, specialization = 'fury') {
    if (!['fury', 'arms'].includes(specialization)) throw new Error('Unknown specialization');
    const primaryName = specialization === 'arms' ? 'Arms' : 'Fury';
    const capstoneKey = specialization === 'arms' ? 'arms:mortal-strike' : 'fury:bloodthirst';
    const primary = trees.findIndex(tree => tree.n === primaryName);
    const capstone = trees[primary].t.findIndex(t => t.key === capstoneKey);
    const known = new Set(trees.flatMap(tree => tree.t.map(t => t.key)));
    for (const name of Object.keys(bounds)) if (!known.has(name)) throw new Error(`Unknown talent: ${name}`);
    const ranges = trees.map(tree => tree.t.map(t => {
        let range = tree.n === 'Protection' || t.y * 5 >= points - 31 ? [0, 0] : [0, t.m];
        // The primary tree can spend all points; the other tree has at most points - 31.
        if (tree.n === primaryName) range = [0, t.m];
        if (t.key === capstoneKey) range = [1, 1];
        if (bounds[t.key] !== undefined) range = typeof bounds[t.key] === 'number' ?
            [bounds[t.key], bounds[t.key]] : bounds[t.key];
        if (!Array.isArray(range) || range.length !== 2 ||
            !range.every(Number.isInteger) || range[0] < 0 || range[1] > t.m || range[0] > range[1]) {
            throw new Error(`Invalid bounds for ${t.key}`);
        }
        return range;
    }));
    const accepts = ranks => valid(trees, ranks, points) && sum(ranks[primary]) >= 31 &&
        ranks[primary][capstone] === 1 && trees.every((tree, i) => tree.n !== 'Protection' || !sum(ranks[i])) &&
        ranges.every((tree, i) => tree.every(([lo, hi], j) => ranks[i][j] >= lo && ranks[i][j] <= hi));
    return {trees, ranges, points, accepts, primary, capstone};
}

function neighbors(space, ranks) {
    const positions = space.trees.flatMap((tree, i) => tree.t.map((_, j) => [i, j]));
    const result = [];
    for (const [fromTree, from] of positions) {
        if (ranks[fromTree][from] <= space.ranges[fromTree][from][0]) continue;
        for (const [toTree, to] of positions) {
            if ((fromTree === toTree && from === to) || ranks[toTree][to] >= space.ranges[toTree][to][1]) continue;
            const next = ranks.map(tree => tree.slice());
            next[fromTree][from]--;
            next[toTree][to]++;
            if (space.accepts(next)) result.push(next);
        }
    }
    return result;
}

function enumerate(space, limit = 100000) {
    const positions = space.trees.flatMap((tree, i) => tree.t.map((t, j) => ({i, j, t})));
    const ranks = space.trees.map(tree => tree.t.map(() => 0));
    const remainingMin = Array(positions.length + 1).fill(0), remainingMax = remainingMin.slice();
    for (let k = positions.length - 1; k >= 0; k--) {
        const {i, j} = positions[k], [lo, hi] = space.ranges[i][j];
        remainingMin[k] = remainingMin[k + 1] + lo;
        remainingMax[k] = remainingMax[k + 1] + hi;
    }
    const results = [];
    function visit(k, used) {
        if (used + remainingMin[k] > space.points || used + remainingMax[k] < space.points) return;
        if (k === positions.length) {
            if (space.accepts(ranks)) results.push(ranks.map(tree => tree.slice()));
            if (results.length > limit) throw new Error(`Exhaustive space exceeds ${limit} builds; tighten --bounds`);
            return;
        }
        const {i, j, t} = positions[k], [lo, hi] = space.ranges[i][j];
        const lower = sum(space.trees[i].t.map((other, n) => other.y < t.y ? ranks[i][n] : 0));
        const unlocked = lower >= t.y * 5 && (!t.r || ranks[i][t.r[0]] >= t.r[1]);
        for (let rank = lo; rank <= Math.min(hi, unlocked ? hi : 0); rank++) {
            ranks[i][j] = rank;
            visit(k + 1, used + rank);
        }
        ranks[i][j] = 0;
    }
    visit(0, 0);
    return results;
}

function random(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function startingBuilds(space, baseline, count, seed) {
    const rng = random(seed), builds = new Map();
    if (space.accepts(baseline)) builds.set(key(baseline), baseline);
    // Independent legal fills can cross prerequisite barriers that one-point moves cannot.
    const {primary, capstone} = space;
    for (let attempt = 0; builds.size < count && attempt < count * 100; attempt++) {
        const ranks = space.trees.map(tree => tree.t.map(() => 0));
        const weights = space.trees.map(tree => tree.t.map(t =>
            (t.status === 'outside-dps-model' ? .05 : 1) * Math.exp(rng() * 4)));
        const add = onlyPrimary => {
            const choices = [];
            space.trees.forEach((tree, i) => tree.t.forEach((t, j) => {
                if ((onlyPrimary && i !== primary) || (i === primary && j === capstone) || ranks[i][j] >= space.ranges[i][j][1]) return;
                ranks[i][j]++;
                if (valid(space.trees, ranks, space.points, false)) choices.push({i, j, weight: weights[i][j]});
                ranks[i][j]--;
            }));
            if (!choices.length) return false;
            let roll = rng() * sum(choices.map(c => c.weight));
            const choice = choices.find(c => (roll -= c.weight) <= 0) || choices.at(-1);
            ranks[choice.i][choice.j]++;
            return true;
        };
        for (let n = 0; n < 30; n++) if (!add(true)) break;
        ranks[primary][capstone] = 1;
        if (!valid(space.trees, ranks, space.points, false)) continue;
        while (sum(ranks.flat()) < space.points && add(false)) { /* Fill remaining points. */ }
        if (space.accepts(ranks)) builds.set(key(ranks), ranks);
    }
    if (!builds.size) throw new Error('No starting builds satisfy the bounds; use --method exhaustive');
    return [...builds.values()];
}

function statistics(report) {
    const n = report.iterations, mean = report.sumdps / n;
    const se = Math.sqrt(Math.max(0, report.sumdps2 - report.sumdps ** 2 / n) / (n - 1) / n);
    return {iterations: n, dps: report.totaldmg / report.totalduration, mean, se, ci95: 1.96 * se};
}

module.exports = {sum, key, valid, domain, neighbors, enumerate, random, startingBuilds, statistics};
