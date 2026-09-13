'use strict';
const os = require('node:os');
const {setTimeout: delay} = require('node:timers/promises');

function configuration(env = process.env) {
    const url = new URL(env.COMPUTE_SITE || 'https://fleetcode.com/WarriorSim/');
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('COMPUTE_SITE must be an HTTP(S) URL');
    if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) url.pathname += '/';
    const defaultThreads = Math.min(64, Math.max(2, Math.floor(os.availableParallelism() * 0.45)));
    const threads = Number(env.COMPUTE_THREADS || defaultThreads);
    if (!Number.isInteger(threads) || threads < 2 || threads > 64) throw new Error('COMPUTE_THREADS must be an integer from 2 to 64');
    return {url: url.href, threads, executablePath: env.COMPUTE_CHROMIUM_PATH || undefined};
}

async function currentBuild(url, signal) {
    const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])});
    if (!response.ok) throw new Error(`Manifest returned HTTP ${response.status}`);
    const manifest = await response.json();
    if (!/^[a-f0-9]{64}$/.test(manifest.buildId)) throw new Error('Manifest has no valid buildId');
    // This is an update hint. The site's loader verifies the complete manifest and
    // every asset before executing anything after navigation.
    return manifest.buildId;
}

async function evaluate(page, callback, argument) {
    let timer;
    try {
        // Playwright's evaluate() has no default timeout. A frozen renderer must
        // not strand an unattended donor indefinitely.
        return await Promise.race([page.evaluate(callback, argument), new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Browser page stopped responding')), 15000);
        })]);
    } finally { clearTimeout(timer); }
}

class ComputeService {
    constructor(config, {log = console.log, pollMs = 1000, checkMs = 60000} = {}) {
        this.config = config;
        this.log = message => log(`[compute] ${message}`);
        this.pollMs = pollMs;
        this.checkMs = checkMs;
    }

    async run(signal) {
        const {chromium} = require('playwright');
        let retryMs = 5000;
        while (!signal.aborted) {
            let browser;
            const close = () => { if (browser) browser.close().catch(() => {}); };
            signal.addEventListener('abort', close, {once: true});
            try {
                browser = await chromium.launch({
                    headless: true, channel: 'chromium', chromiumSandbox: true,
                    executablePath: this.config.executablePath,
                    handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
                    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows'],
                });
                if (signal.aborted) break;
                const context = await browser.newContext({serviceWorkers: 'block'});
                await context.addInitScript(({threads}) => {
                    localStorage.setItem('warriorsim.shareCompute', 'true');
                    localStorage.setItem('warriorsim.sharedThreads', String(threads));
                }, this.config);
                // Tooltips and decorative assets are unnecessary for a donor.
                await context.route('**/*', route => {
                    const request = route.request();
                    if (new URL(request.url()).origin !== new URL(this.config.url).origin ||
                        ['image', 'media', 'font'].includes(request.resourceType())) return route.abort();
                    return route.continue();
                });
                const page = await context.newPage();
                this.page = page;
                page.setDefaultTimeout(60000);
                page.on('crash', () => { this.crashed = true; });
                this.crashed = false;
                let checkRequested = false;
                page.on('websocket', socket => {
                    if (new URL(socket.url()).pathname !== new URL('./compute', this.config.url).pathname) return;
                    // Both close and the next handshake matter: publication can finish
                    // during the outage, after the first version check.
                    socket.on('close', () => { checkRequested = true; });
                    socket.on('framereceived', ({payload}) => {
                        if (typeof payload === 'string' && payload.length < 2048) {
                            try { if (JSON.parse(payload).type === 'ready') checkRequested = true; } catch (_) { /* Not JSON. */ }
                        }
                    });
                });
                await this.load(page);
                let lastCheck = 0, nextCheck = 0, lastSummary = 0, lastReady, lastReconnect = Date.now();
                while (!signal.aborted) {
                    if (this.crashed || page.isClosed() || !browser.isConnected()) throw new Error('Chromium page stopped');
                    const state = await evaluate(page, () => ({
                        buildId: SIMULATOR_BUNDLE.buildId, ready: !!sharedCompute.ready,
                        hasSocket: !!sharedCompute.socket,
                        slots: sharedCompute.slots, active: sharedCompute.active, queued: sharedCompute.waiting.length,
                    }));
                    const now = Date.now();
                    if (state.ready !== lastReady) {
                        this.log(state.ready ? `Connected; sharing ${state.slots} threads, bundle ${state.buildId}` : 'Coordinator disconnected; reconnecting');
                        lastReady = state.ready;
                    }
                    if (state.ready) retryMs = 5000;
                    if (now - lastSummary >= 60000) {
                        this.log(`${state.active} workers active, ${state.queued} chunks queued`);
                        lastSummary = now;
                    }
                    if (now >= nextCheck || (checkRequested && now - lastCheck >= 5000)) {
                        checkRequested = false;
                        lastCheck = now;
                        nextCheck = now + this.checkMs;
                        let buildId;
                        try { buildId = await currentBuild(new URL('./dist/compute-build.json', page.url()), signal); }
                        catch (error) {
                            if (signal.aborted) break;
                            this.log(`Update check failed: ${error.message}; will retry`);
                            nextCheck = now + Math.min(10000, this.checkMs);
                        }
                        if (buildId && buildId !== state.buildId) {
                            this.log(`New bundle ${buildId}; refreshing`);
                            await this.load(page);
                            lastReady = undefined;
                        }
                    }
                    // A 1008 policy close stops automatic reconnect in older bundles.
                    // Retry that connection too, without reloading unchanged assets.
                    if (!state.ready && !state.hasSocket && now - lastReconnect >= 30000) {
                        lastReconnect = now;
                        await evaluate(page, () => sharedCompute.connect());
                    }
                    await delay(this.pollMs, undefined, {signal});
                }
            } catch (error) {
                if (!signal.aborted) this.log(`${error.message}; restarting browser in ${retryMs / 1000}s`);
            } finally {
                signal.removeEventListener('abort', close);
                this.page = undefined;
                if (browser) await browser.close().catch(() => {});
            }
            if (!signal.aborted) {
                await delay(retryMs, undefined, {signal}).catch(() => {});
                retryMs = Math.min(60000, retryMs * 2);
            }
        }
    }

    async load(page) {
        const response = await page.goto(this.config.url, {waitUntil: 'domcontentloaded', timeout: 60000});
        if (!response || !response.ok()) throw new Error(`Site returned HTTP ${response && response.status()}`);
        // waitForFunction also bounds a stalled preload (evaluate(promise) alone
        // has no timeout). Startup errors are retried by the supervisor.
        await evaluate(page, () => {
            globalThis.computeStartup = 'loading';
            if (!globalThis.simulatorReady) { globalThis.computeStartup = 'Missing bundle loader'; return; }
            simulatorReady.then(() => { globalThis.computeStartup = 'ready'; }, error => {
                globalThis.computeStartup = error.message;
            });
        });
        await page.waitForFunction(() => globalThis.computeStartup !== 'loading');
        const startup = await evaluate(page, () => globalThis.computeStartup);
        if (startup !== 'ready') throw new Error(startup);
        await page.waitForFunction(() => typeof sharedCompute !== 'undefined' && sharedCompute.enabled);
        await evaluate(page, threads => {
            sharedCompute.setSlots(threads);
            sharedCompute.publish();
        }, this.config.threads);
    }
}

async function main() {
    const service = new ComputeService(configuration());
    const controller = new AbortController();
    for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => controller.abort());
    await service.run(controller.signal);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {ComputeService, configuration, currentBuild};
