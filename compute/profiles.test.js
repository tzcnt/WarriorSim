'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {once} = require('node:events');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');
const recorded = JSON.parse(fs.readFileSync(path.join(root, 'data/forever/dual-wield-talents-result.json')));

test('Forever preset creates independent profiles, survives edits/deletion/reload, and stays out of Classic', async t => {
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
        '.css': 'text/css', '.wasm': 'application/wasm'};
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404).end(); return;
        }
        res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
        fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({headless: true});
    t.after(() => browser.close());
    const context = await browser.newContext();
    await context.addInitScript(() => {
        localStorage.setItem('warriorsim.shareCompute', 'false');
        localStorage.setItem('warriorsim.localThreads', '1');
    });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const ready = async mode => {
        await page.goto(`${origin}/${mode === 'forever' ? 'index' : 'classic'}.html`);
        await page.waitForFunction(() => typeof SIM !== 'undefined' && SIM.PROFILES?.container?.find('.profile').length > 0);
    };
    await ready('forever');
    const preset = page.locator('.presets [data-preset="forever-dual-wield-fury"]');
    assert.equal(await preset.count(), 1);

    // Load an unrelated personal build, including a rotation option the preset omits.
    const personal = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.forever0);
        Object.assign(saved, {profilename: 'My personal build', race: 'Orc', timesecsmin: '120', timesecsmax: '180',
            targetcreaturetype: 'Dragonkin', maxhealth: '9999'});
        const dw = saved.rotation.find(s => s.name === 'Death Wish');
        dw.timetostart = 99;
        const potion = saved.rotation.find(s => s.name === 'Mighty Rage Potion');
        potion.timetostart = 45;
        potion.timetostartactive = true;
        localStorage.forever0 = JSON.stringify(saved);
        SIM.PROFILES.loadProfile(SIM.PROFILES.container.find('[data-index="0"]'));
        return localStorage.forever0;
    });
    const open = async () => {
        if (!await page.locator('section.profiles').evaluate(el => el.classList.contains('active'))) {
            await page.locator('.js-profiles').click();
        }
        await preset.waitFor({state: 'visible'});
    };
    await open();
    await preset.click();
    const loaded = await page.evaluate(() => ({
        selected: globalThis.profileid, personal: localStorage.forever0,
        saved: JSON.parse(localStorage.forever1), config: Player.getConfig(),
        ranks: talentSelection().map(tree => tree.t),
        valid: validTalentBuild(talents, talentSelection().map(tree => tree.t), 60),
        template: JSON.stringify(profilePresets[0]),
    }));
    assert.equal(loaded.selected, 1);
    assert.equal(loaded.personal, personal, 'using a preset does not overwrite the personal profile');
    assert.equal(loaded.saved.profilename, 'Dual Wield Fury (13/38/0)');
    assert.deepEqual(loaded.ranks, recorded.winner.talents);
    assert.deepEqual(loaded.config, recorded.configuration.player);
    assert.equal(loaded.valid, true);
    const dw = loaded.saved.rotation.find(s => s.name === 'Death Wish');
    assert.equal(dw.timetostartactive, false);
    assert.equal(dw.timetoendactive, true);
    assert.equal(dw.timetoend, 31);
    const scheduled = await page.evaluate(() => {
        const player = new Player(undefined, undefined, undefined, Player.getConfig());
        return [50000, 60000, 20000].map(duration => {
            player.auras.deathwish.prep(duration, 0);
            return player.auras.deathwish.usestep;
        });
    });
    assert.deepEqual(scheduled, [19000, 29000, 0], 'Death Wish follows fight end and clamps short fights to the pull');
    assert.equal(loaded.saved.rotation.find(s => s.name === 'Mighty Rage Potion').timetostartactive, false);
    assert.equal(loaded.saved.rotation.find(s => s.name === 'Spearing Strike').active, false);
    for (const [slot, id] of Object.entries(recorded.configuration.profile.gear)) {
        assert.deepEqual(loaded.saved.gear[slot].filter(item => item.selected).map(item => item.id), [id]);
    }

    await page.evaluate(() => {
        const saved = JSON.parse(localStorage.forever1);
        saved.profilename = 'Edited copy'; saved.talents[0].t[0] = 0;
        localStorage.forever1 = JSON.stringify(saved);
        SIM.PROFILES.loadProfile(SIM.PROFILES.container.find('[data-index="1"]'));
    });
    await open();
    await preset.click();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.forever2).talents.map(tree => tree.t)), recorded.winner.talents);
    assert.equal(await page.evaluate(() => JSON.stringify(profilePresets[0])), loaded.template);
    await open();
    await page.locator('.profile[data-index="2"] .delete-profile').click();
    assert.equal(await preset.count(), 1, 'deleting a copy does not remove the preset');

    await ready('forever');
    assert.equal(await preset.count(), 1);
    assert.equal(await page.locator('.profile').count(), 2);
    await open();
    await preset.click();
    assert.equal(await page.evaluate(() => globalThis.profileid), 2);
    assert.deepEqual(await page.evaluate(() => talentSelection().map(tree => tree.t)), recorded.winner.talents);

    await ready('classic');
    assert.equal(await page.locator('[data-preset]').count(), 0);
    assert.equal(await page.locator('.profile').count(), 1);
    assert.deepEqual(errors, []);
});
