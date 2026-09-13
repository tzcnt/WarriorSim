'use strict';

// Action names come from native literals. The property array is the curated
// input list: edit that array, then run this script to rebuild counts/indices.
// Properties accessed dynamically must stay dense when they are still produced
// by JavaScript, even if no _prop literal uses them (notably weapon skills).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, '../wasm/src');
const check = process.argv.includes('--check');
assert.ok(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: node scripts/generate-native-keys.js [--check]');
const sources = fs.readdirSync(sourceRoot)
    .filter(file => /\.(cpp|hpp)$/.test(file))
    .map(file => fs.readFileSync(path.join(sourceRoot, file), 'utf8')).join('\n');
const literals = suffix => new Set([...sources.matchAll(new RegExp(`"([^"\\n]+)"_${suffix}\\b`, 'g'))].map(match => match[1]));

for (const [file, array, count, hash, index, suffix] of [
    ['action_keys.hpp', 'kActionKeyNames', 'kActionKeyCount', 'actionKeyHash', 'actionKeyIndex', 'action'],
    ['property_ids.hpp', 'kDensePropertyNames', 'kDensePropertyCount', 'propertyHash', 'propertyIndex', 'prop'],
]) {
    const filename = path.join(sourceRoot, file);
    const source = fs.readFileSync(filename, 'utf8');
    const arrayPattern = new RegExp(`(${array} = \\{)\\n[\\s\\S]*?\\n};`);
    const arraySource = source.match(arrayPattern);
    assert.ok(arraySource, `${file}: missing name array`);
    const names = suffix === 'action' ? [...literals(suffix)].sort() :
        [...arraySource[0].matchAll(/"([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length, `${file}: duplicate names`);
    for (const name of literals(suffix)) assert.ok(names.includes(name), `${file}: missing literal ${name}`);
    const hashes = names.map(name => {
        let value = 0xcbf29ce484222325n;
        for (const byte of Buffer.from(name)) value = BigInt.asUintN(64, (value ^ BigInt(byte)) * 0x100000001b3n);
        return value;
    });
    assert.equal(new Set(hashes).size, hashes.length, `${file}: hash collision`);

    let output = source
        .replace(new RegExp(`(${count} = )\\d+`), `$1${names.length}`)
        .replace(arrayPattern, (_, declaration) => `${declaration}\n${names.map(name => `    "${name}",`).join('\n')}\n};`);
    const casesPattern = new RegExp(`(    switch \\(${hash}\\(value\\)\\) \\{\\n)[\\s\\S]*?(    default: return -1;)`);
    assert.ok(casesPattern.test(output), `${file}: missing index switch`);
    output = output.replace(casesPattern, (_, declaration, fallback) => declaration +
        names.map((name, position) => `    case ${hash}("${name}"): return value == "${name}" ? ${position} : -1;\n`).join('') + fallback);

    // Verify the emitted mapping independently of the array emitter.
    const cases = [...output.matchAll(new RegExp(`case ${hash}\\("([^"]+)"\\): return value == "([^"]+)" \\? (\\d+) : -1;`, 'g'))];
    assert.equal(cases.length, names.length, `${file}: wrong case count`);
    cases.forEach(([_, name, guard, position], i) => {
        assert.equal(name, names[i]);
        assert.equal(guard, name);
        assert.equal(Number(position), i);
    });
    if (check) assert.equal(source, output, `${file} is stale; run node scripts/generate-native-keys.js`);
    else fs.writeFileSync(filename, output);
    console.log(`${file}: ${names.length} names, all indices verified (${index})`);
}
