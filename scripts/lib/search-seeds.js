'use strict';

// The engine seeds fight i as seed + i * 0x9e3779b9 (mod 2^32).
// Adding that constant to a base seed merely shifts the same fight sequence by
// one. Reserve disjoint blocks of 2^28 fight seeds for separate search stages.
const STRIDE = 0x10000000;
function searchSeeds(seed, count = 5, maxIterations = STRIDE) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff ||
        !Number.isInteger(count) || count < 1 || count > 16 ||
        !Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > STRIDE) {
        throw new Error('Invalid seed partition');
    }
    return Array.from({length: count}, (_, stage) => (seed + Math.imul(stage * STRIDE, 0x9e3779b9)) >>> 0);
}
module.exports = {searchSeeds};
