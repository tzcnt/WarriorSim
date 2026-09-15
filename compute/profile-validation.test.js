'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {once} = require('node:events');
const {chromium} = require('playwright');

const root = path.resolve(__dirname, '..');

test('profile notes display after import, dismiss with OK, and use the shared findings in both tabs', async t => {
    const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
        '.css': 'text/css', '.wasm': 'application/wasm'};
    const server = http.createServer((req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const file = path.resolve(root, '.' + pathname);
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

    for (const mode of ['forever', 'classic']) {
        const context = await browser.newContext({viewport: {width: 390, height: 720}});
        await context.addInitScript(() => {
            localStorage.setItem('warriorsim.shareCompute', 'false');
            localStorage.setItem('warriorsim.localThreads', '1');
        });
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/${mode === 'forever' ? 'index' : 'classic'}.html`);
        await page.waitForFunction(() => typeof SIM !== 'undefined' && SIM.PROFILES?.container?.find('.profile').length > 0);
        assert.equal(await page.locator('dialog[open]').count(), 0, 'first-visit defaults need no import notice');
        const exported = await page.evaluate(() => {
            let copied;
            Object.defineProperty(navigator, 'clipboard', {value: {writeText: text => { copied = text; }}, configurable: true});
            SIM.PROFILES.exportProfile({data: () => 0});
            const profile = JSON.parse(atob(copied));
            const exportedActive = profile.rotation.map(spell => spell.active);
            profile.profilename = 'Compatibility test';
            profile.gear.head = 999999999;
            profile.enchant.head = [999999999];
            profile.buffs.push('obsolete:buff');
            profile.rotation.push({id: '<img src=x onerror="globalThis.issueMarkupExecuted=true">'});
            delete profile.reactionmin;
            if (mode === 'forever') {
                profile.talents[0].t[0] = 999;
                profile.talentSchema = 'forever-v999';
            }
            const base = JSON.parse(localStorage[mode + '0']);
            const expected = ProfileValidation.report(profile, SIM.PROFILES.validationContext(base, 'the current profile'));
            return {text: btoa(JSON.stringify(profile)), expected, exportedActive};
        });
        assert.ok(exported.exportedActive.length > 0 && exported.exportedActive.every(active => active === true),
            'the built exporter explicitly enables every exported ability');
        // Use the real paste event. Opening the notification must not interrupt it.
        await page.evaluate(() => {
            SIM.PROFILES.modal.addClass('open');
            SIM.PROFILES.textarea.focus();
        });
        await page.locator('.import-modal textarea').fill(exported.text);
        const dialog = page.getByRole('dialog', {name: 'Profile compatibility notes'});
        await dialog.waitFor({state: 'visible'});
        const stored = await page.evaluate(() => JSON.parse(localStorage[mode + '1']));
        assert.equal(stored.profilename, 'Compatibility test', 'the profile is saved before OK is clicked');
        if (mode === 'forever') assert.equal(stored.talents[0].t[0], 3);
        assert.deepEqual(await dialog.locator('li').allTextContents(), exported.expected.map(issue => issue.message));
        assert.equal(await dialog.locator('img').count(), 0, 'messages render as plain text');
        assert.equal(await page.evaluate(() => !!globalThis.issueMarkupExecuted), false);
        assert.equal(await page.locator('.import-modal').evaluate(el => el.classList.contains('open')), false);
        const bounds = await dialog.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.width <= 390 && bounds.height <= 720, 'dialog fits a mobile viewport');
        assert.equal(await dialog.getByRole('button', {name: 'OK', exact: true}).evaluate(el => el === document.activeElement), true);
        await dialog.getByRole('button', {name: 'OK', exact: true}).click();
        assert.equal(await page.locator('dialog[open]').count(), 0);

        // Check persisted profiles on a later visit, before normalization erases evidence.
        await page.evaluate(() => {
            const saved = JSON.parse(localStorage[mode + '0']);
            saved.gear.head = [{id: 999999999, selected: true}];
            if (mode === 'forever') saved.talents[0].t[0] = 999;
            localStorage[mode + '0'] = JSON.stringify(saved);
        });
        await page.reload();
        await dialog.waitFor({state: 'visible'});
        assert.match(await dialog.innerText(), /Unknown gear ID 999999999/);
        if (mode === 'forever') assert.match(await dialog.innerText(), /999 ranks become 3/);
        await dialog.getByRole('button', {name: 'OK', exact: true}).click();

        if (mode === 'forever') {
            // A preset uses defaults and loads immediately while its notice stays open.
            const preset = await page.evaluate(() => {
                SIM.PROFILES.loadPreset(profilePresets[0].id);
                return {index: globalThis.profileid, name: profilePresets[0].profile.profilename,
                    saved: JSON.parse(localStorage[mode + globalThis.profileid])};
            });
            assert.equal(preset.saved.profilename, preset.name);
            await dialog.waitFor({state: 'visible'});
            assert.equal(await page.evaluate(() => globalThis.profileid), preset.index);
            await dialog.getByRole('button', {name: 'OK', exact: true}).click();
        }
        assert.deepEqual(errors, [], mode);
        await context.close();
    }
});
