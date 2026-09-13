'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {once} = require('node:events');
const {createHash} = require('node:crypto');
const {setTimeout: delay} = require('node:timers/promises');
const {ComputeService, configuration, currentBuild} = require('./index');
const {createServer} = require('../server');
const {WebSocket} = require('../server/node_modules/ws');
const P = require('../js/compute-protocol');
const {createConfiguredPlayer, createReferenceEngine, loadFixtures} = require('../test/wasm/reference-engine');

async function until(check, timeout = 30000) {
    const started = Date.now();
    while (!await check()) {
        if (Date.now() - started > timeout) throw new Error('Timed out waiting for service state');
        await delay(50);
    }
}

test('configuration normalizes site directories and validates explicit CPU limits', t => {
    assert.equal(configuration({}).url, 'https://fleetcode.com/WarriorSim/');
    assert.equal(configuration({COMPUTE_SITE: 'https://sim.test/WarriorSim'}).url, 'https://sim.test/WarriorSim/');
    assert.equal(configuration({COMPUTE_SITE: 'http://localhost/classic.html'}).url, 'http://localhost/classic.html');
    assert.equal(configuration({COMPUTE_THREADS: '8'}).threads, 8);
    assert.ok(configuration({}).threads >= 2 && configuration({}).threads <= 64);
    for (const value of ['0', '1', '65', '2.5', 'oops']) assert.throws(() => configuration({COMPUTE_THREADS: value}), /COMPUTE_THREADS/);
    assert.throws(() => configuration({COMPUTE_SITE: 'file:///tmp/index.html'}), /HTTP/);
    const hardware = t.mock.method(os, 'availableParallelism');
    for (const [logicalCPUs, expected] of [[1, 2], [8, 3], [64, 28], [128, 57], [256, 64]]) {
        hardware.mock.mockImplementation(() => logicalCPUs);
        assert.equal(configuration({}).threads, expected, `${logicalCPUs} logical CPUs`);
        assert.equal(configuration({COMPUTE_THREADS: '8'}).threads, 8, 'explicit limits override the default');
    }
});

// Hold deployment bytes in memory: rollout tests never modify the shared checkout.
async function site(t) {
    const root = path.resolve(__dirname, '..');
    const assets = new Map();
    function read(directory) {
        for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes: true})) {
            const relative = `${directory}/${entry.name}`;
            if (entry.isDirectory()) read(relative);
            else assets.set('/WarriorSim/' + relative, fs.readFileSync(path.join(root, relative)));
        }
    }
    read('dist/js');
    read('dist/wasm');
    let manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/compute-build.json')));
    const originalBuild = manifest.buildId;
    let manifestStatus = 200, port = 0, app, navigations = 0, manifestRequests = 0;
    const origins = [];
    async function start() {
        app = createServer({origins});
        const original = app.server.listeners('request')[0];
        app.server.removeListener('request', original);
        app.server.on('request', (req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            if (req.url === '/WarriorSim/') {
                navigations++;
                res.setHeader('Content-Type', 'text/html');
                res.end(`<html><head><script>var mode = 'classic';</script></head><body>
                    <input type="checkbox" id="share-compute"><span id="share-compute-status"></span>
                    <script src="dist/js/bundle-loader.min.js"></script>
                    <script>simulatorReady.then(() => initSharedCompute(64));</script></body></html>`);
            } else if (req.url === '/WarriorSim/dist/compute-build.json') {
                manifestRequests++;
                res.writeHead(manifestStatus, {'Content-Type': 'application/json'});
                res.end(JSON.stringify(manifest));
            } else if (assets.has(req.url)) {
                res.setHeader('Content-Type', req.url.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
                res.end(assets.get(req.url));
            } else original(req, res);
        });
        // Mirror the reverse proxy's /WarriorSim/compute -> /compute mapping.
        app.server.prependListener('upgrade', req => {
            if (req.url === '/WarriorSim/compute') req.url = '/compute';
        });
        app.server.listen(port, '127.0.0.1');
        await once(app.server, 'listening');
        port = app.server.address().port;
        origins[0] = `http://127.0.0.1:${port}`;
    }
    await start();
    t.after(() => app.close());
    return {
        url: `${origins[0]}/WarriorSim/`, originalBuild,
        get app() { return app; },
        get buildId() { return manifest.buildId; },
        get navigations() { return navigations; },
        get manifestRequests() { return manifestRequests; },
        set manifestStatus(value) { manifestStatus = value; },
        restart: async () => { await app.close(); await start(); },
        deploy({corrupt = false} = {}) {
            const file = 'js/compute-worker.min.js';
            const key = '/WarriorSim/dist/' + file;
            assets.set(key, Buffer.concat([assets.get(key), Buffer.from('\n// test rollout\n')]));
            const descriptor = {format: manifest.format, protocol: manifest.protocol, specVersion: manifest.specVersion,
                entrypoints: manifest.entrypoints, files: manifest.files.map(value => value.path === file ?
                    {...value, sha256: createHash('sha256').update(assets.get(key)).digest('hex')} : value)};
            manifest = {buildId: createHash('sha256').update(JSON.stringify(descriptor)).digest('hex'), ...descriptor};
            if (corrupt) assets.set(key, Buffer.concat([assets.get(key), Buffer.from('\n// incomplete upload\n')]));
        },
    };
}

test('headless donor runs real WASM, survives restarts, and refreshes only for new deployments', {timeout: 90000}, async t => {
    const host = await site(t);
    const controller = new AbortController();
    const logs = [];
    const service = new ComputeService(configuration({COMPUTE_SITE: host.url, COMPUTE_THREADS: '2'}),
        {log: value => logs.push(value), pollMs: 100, checkMs: 60000});
    const running = service.run(controller.signal);
    t.after(async () => { controller.abort(); await running; });
    const connected = buildId => host.app.coordinator.groups.get(buildId)?.threads === 2;
    await until(() => connected(host.originalBuild));

    const ownerUrl = new URL('./compute', host.url);
    ownerUrl.protocol = 'ws:';
    const owner = new WebSocket(ownerUrl, {origin: new URL(host.url).origin});
    owner.on('error', () => {});
    await once(owner, 'open');
    let reply = once(owner, 'message');
    owner.send(JSON.stringify({type: 'hello', protocol: P.version, buildId: host.originalBuild, share: true, slots: 2, busy: true}));
    assert.equal(JSON.parse((await reply)[0]).type, 'ready');
    const fixture = loadFixtures().find(value => value.name === 'classic-dw-fury');
    const player = createConfiguredPlayer(createReferenceEngine('classic'), fixture);
    const job = {id: 'headless-test', spec: player.serializeSimulationSpec(fixture.sim), seed: 42,
        iterations: 128, offset: 0, chunkSize: 128, fullReport: true};
    assert.ok(P.job(job));
    const result = new Promise(resolve => owner.on('message', data => {
        const message = JSON.parse(data);
        if (message.type === 'result') resolve(message);
    }));
    owner.send(JSON.stringify({type: 'submit', buildId: host.originalBuild, job, claimed: [], cancelled: []}));
    const report = (await result).report;
    assert.ok(P.report(report, job, 0));
    assert.equal(report.iterations, 128);
    assert.ok(report.totaldmg > 0);
    owner.close();
    await until(() => connected(host.originalBuild));

    const navigations = host.navigations;
    await host.restart();
    await until(() => connected(host.originalBuild));
    await delay(5500); // Allow the coalesced disconnect/reconnect version check.
    assert.equal(host.navigations, navigations, 'a coordinator restart with the same bundle only reconnects');

    host.manifestStatus = 503;
    const checked = host.manifestRequests;
    await host.restart();
    await until(() => host.manifestRequests > checked && connected(host.originalBuild));
    assert.equal(host.navigations, navigations, 'a failed version check preserves the loaded bundle');
    host.manifestStatus = 200;

    host.deploy();
    await host.restart();
    await until(() => connected(host.buildId));
    assert.equal(host.navigations, navigations + 1);
    assert.ok(logs.some(value => value.includes('New bundle')));

    // Static-only deployments are caught by the fallback timer.
    service.checkMs = 500;
    await until(() => logs.some(value => value.includes(`bundle ${host.buildId}`)));
    // Wake the monitor once; its following deadline uses the shorter test interval.
    await host.restart();
    await until(() => connected(host.buildId));
    await delay(5500);
    host.deploy();
    await until(() => connected(host.buildId));
    assert.equal(host.navigations, navigations + 2);

    host.deploy({corrupt: true});
    await until(() => logs.some(value => value.includes('Bundle asset hash mismatch')));
    assert.equal(host.app.coordinator.groups.has(host.buildId), false, 'an incomplete upload never joins the new pool');
    host.deploy();
    await until(() => connected(host.buildId));

    // A browser failure is also supervised, and shutdown releases all donors.
    const beforeCrash = host.navigations;
    await service.page.close();
    await until(() => host.navigations === beforeCrash + 1 && connected(host.buildId));
    controller.abort();
    await running;
    await until(() => host.app.coordinator.clients.size === 0);
});

test('manifest checks reject unavailable endpoints and support cancellation', async t => {
    const host = await site(t);
    const url = new URL('./dist/compute-build.json', host.url);
    const controller = new AbortController();
    assert.equal(await currentBuild(url, controller.signal), host.originalBuild);
    host.manifestStatus = 503;
    await assert.rejects(currentBuild(url, controller.signal), /HTTP 503/);
    controller.abort();
    await assert.rejects(currentBuild(url, controller.signal), {name: 'AbortError'});
});
