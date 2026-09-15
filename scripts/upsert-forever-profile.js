#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline/promises');
const {parseArgs} = require('node:util');
const ProfileValidation = require('../js/profile-validation');
const {profileContext} = require('./lib/profile-context');

const defaultPresets = path.resolve(__dirname, '../js/data/presets_forever.js');
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = value => (typeof value === 'string' && value.trim().length > 0) ||
    (Number.isSafeInteger(value) && value > 0);

function decodeProfile(input) {
    let json = input.trim();
    if (!json) throw new Error('No profile supplied. Paste the site export or use --input FILE.');
    if (!json.startsWith('{')) {
        const encoded = json.replace(/\s/g, '');
        const bytes = Buffer.from(encoded, 'base64');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
            bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) {
            throw new Error('Invalid profile export: expected base64 or a JSON object.');
        }
        // The site uses btoa (Latin-1); search scripts also emit UTF-8 base64.
        try { json = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
        catch { json = bytes.toString('latin1'); }
    }
    let profile;
    try { profile = JSON.parse(json); }
    catch { throw new Error('Invalid profile export: could not parse its JSON.'); }
    validateProfile(profile);
    return profile;
}

function validateProfile(profile) {
    const requireField = (valid, field) => {
        if (!valid) throw new Error(`Invalid profile: ${field}. Use the site's Export action, not a full localStorage session.`);
    };
    requireField(isObject(profile), 'expected an object');
    for (const field of ['profilename', 'level', 'race']) {
        requireField(typeof profile[field] === 'string' && profile[field].trim(), `missing ${field}`);
    }
    requireField(Array.isArray(profile.buffs) && profile.buffs.every(id => id === null || isId(id)), 'buffs must be an array of IDs');
    requireField(Array.isArray(profile.talents) && profile.talents.length === 3 && profile.talents.every(tree =>
        isObject(tree) && Array.isArray(tree.t) && tree.t.every(rank => Number.isInteger(rank) && rank >= 0) &&
        (tree.keys === undefined || (Array.isArray(tree.keys) && tree.keys.length === tree.t.length &&
            tree.keys.every(key => typeof key === 'string')))), 'talents must contain three rank arrays');
    requireField(isObject(profile.gear) && Object.values(profile.gear).every(isId), 'gear must map slots to item IDs');
    requireField(isObject(profile.enchant) && Object.values(profile.enchant).every(ids =>
        Array.isArray(ids) && ids.every(isId)), 'enchant must map slots to arrays of IDs');
    requireField(Array.isArray(profile.rotation) && profile.rotation.every(spell =>
        isObject(spell) && isId(spell.id) && (spell.active === undefined || typeof spell.active === 'boolean')),
    'rotation must be an array of spells with IDs');
    requireField(new Set(profile.rotation.map(spell => String(spell.id))).size === profile.rotation.length,
        'rotation contains duplicate spell IDs');
}

function upsertSource(source, profile, id, description) {
    // This catalog is a JSON array in a JavaScript declaration. Parse it as data
    // so neither an export nor the destination file can execute code in the CLI.
    const match = source.match(/^((?:\s|\/\/[^\r\n]*(?:\r?\n|$))*var\s+profilePresets\s*=\s*)(\[[\s\S]*\])(\s*;\s*)$/);
    if (!match) throw new Error('Expected a var profilePresets = [JSON]; catalog.');
    let presets;
    try { presets = JSON.parse(match[2]); }
    catch { throw new Error('The preset catalog does not contain a valid JSON array.'); }
    const ids = new Set();
    for (const preset of presets) {
        if (!isObject(preset) || typeof preset.id !== 'string' || !isObject(preset.profile)) {
            throw new Error('The preset catalog contains an invalid entry.');
        }
        if (ids.has(preset.id)) throw new Error(`The preset catalog contains duplicate ID: ${preset.id}`);
        ids.add(preset.id);
    }
    const index = presets.findIndex(preset => preset.id === id);
    const existing = index < 0 ? undefined : presets[index];
    const preset = {...existing, id, description: description ?? existing?.description ?? profile.profilename, profile};
    if (index < 0) presets.push(preset);
    else presets[index] = preset;
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const updated = match[1] + JSON.stringify(presets, null, 4).replace(/\n/g, newline) + match[3];
    return {source: updated, action: updated === source ? 'Unchanged' : index < 0 ? 'Inserted' : 'Updated'};
}

async function readInput(file) {
    if (file !== '-') return fs.readFileSync(file, 'utf8');
    if (process.stdin.isTTY) {
        const prompt = readline.createInterface({input: process.stdin, output: process.stderr});
        try { return await prompt.question('Paste the exported profile, then press Enter: '); }
        finally { prompt.close(); }
    }
    process.stdin.setEncoding('utf8');
    let input = '';
    for await (const chunk of process.stdin) input += chunk;
    return input;
}

async function main(args = process.argv.slice(2)) {
    const {values} = parseArgs({args, options: {
        id: {type: 'string'}, description: {type: 'string'},
        input: {type: 'string', short: 'i', default: '-'},
        presets: {type: 'string', default: defaultPresets},
        'dry-run': {type: 'boolean', default: false},
        help: {type: 'boolean', short: 'h'},
    }});
    if (values.help) {
        console.log(`Usage: npm run profile:upsert -- --id PRESET_ID [options]

On the WoW Forever site, open Profiles and click the profile's Export icon.
Run this command and paste the copied text, or read an export saved to a file.

  --id ID              Stable preset ID: update a match, otherwise append
  --input, -i FILE      Read base64 or JSON from FILE (default: paste / stdin)
  --description TEXT   Set description (default: keep existing, or profile name)
  --presets FILE       Destination (default: js/data/presets_forever.js)
  --dry-run            Print the proposed catalog to stdout without writing
  --help, -h           Show this help

Examples:
  npm run profile:upsert -- --id forever-dual-wield-fury
  npm run profile:upsert -- --id forever-my-build --input profile.txt
  Get-Clipboard | node scripts/upsert-forever-profile.js --id forever-my-build

The profile is replaced in full. Omitted rotation spells remain disabled when
the site loads the preset. Compatibility notes are printed to stderr without
blocking the upsert, including during --dry-run. Rebuild the browser assets to
use the updated file.`);
        return;
    }
    if (!values.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.id)) {
        throw new Error('--id is required and must use lowercase letters, digits, and single hyphens (e.g. forever-my-build).');
    }
    const profile = decodeProfile(await readInput(values.input));
    const issues = ProfileValidation.report(profile, profileContext());
    if (issues.length) {
        console.error('Profile compatibility notes (upsert will continue):');
        for (const issue of issues) console.error(`- ${issue.message}`);
    }
    const target = path.resolve(values.presets);
    const original = fs.readFileSync(target, 'utf8');
    const result = upsertSource(original, profile, values.id, values.description);
    if (values['dry-run']) {
        process.stdout.write(result.source);
        return;
    }
    if (result.source !== original) {
        const temporary = fs.mkdtempSync(path.join(path.dirname(target), '.profile-upsert-'));
        try {
            const file = path.join(temporary, 'presets.js');
            fs.writeFileSync(file, result.source, {mode: fs.statSync(target).mode});
            fs.renameSync(file, target);
        } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
    }
    console.log(`${result.action} ${values.id} (${profile.profilename}) in ${target}`);
}

if (require.main === module) main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
});

module.exports = {decodeProfile, upsertSource};
