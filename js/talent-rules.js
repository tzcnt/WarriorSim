// Runtime integration for the captured Forever catalog. Game IDs remain unknown;
// local keys identify talents/actions and are also used in saved builds.
var classicTalents = talents;
var FOREVER_TALENT_SCHEMA = 'forever-v1';
var foreverTalentDefaults = {};
for (const tree of classicTalents)
    for (const talent of tree.t)
        for (const key of Object.keys(talent.aura(0))) foreverTalentDefaults[key] = 0;

(function () {
    const linear = (key, multiplier = 1) => rank => ({[key]: rank * multiplier});
    const effects = {
        'arms:improved-rend': linear('rendmod', 12),
        'arms:improved-tactical-mastery': rank => ({rageretained: 10 + 3 * rank}),
        'arms:spearing-strike': linear('spearingstrike'),
        'arms:bloodthrill': linear('bloodthrill', 2),
        'arms:weaponmaster': rank => ({axecrit: rank, polearmcrit: rank, swordproc: rank, weaponmasterarp: rank * .03}),
        'arms:improved-slam': linear('impslam'),
        'fury:booming-voice': linear('shoutradius', 10),
        'fury:iron-will': linear('stunfearduration', 3),
        'fury:unbridled-wrath': linear('umbridledwrath', 12),
        'fury:improved-cleave': linear('cleavecost'),
        'fury:boundless-rage': linear('extraragecap', 10),
        'fury:dual-wield-specialization': rank => ({offmod: rank * .05, offragebonus: rank * .20, offhit: rank * 2}),
        'fury:raging-blows': linear('ragingblows'),
        'fury:enrage': linear('enrage', 2),
        'fury:improved-execute': linear('executecost', 3),
        'fury:precision': linear('precision'),
        'fury:improved-berserker-rage': rank => ({berserkerbonus: rank * 5, snareremoval: rank * 50}),
        'fury:flurry': linear('flurry', 5),
        'protection:shield-specialization': rank => ({block: rank, blockragechance: rank * 20, blockrage: 5}),
        'protection:anticipation': linear('defense', 4),
        'protection:improved-bloodrage': linear('bloodragemod', .25),
        'protection:improved-thunder-clap': linear('impthunderclap', 2),
        'protection:master-of-defense': linear('avoidragechance', 50),
        'protection:improved-revenge': linear('revengedmg', 20),
        'protection:defiance': linear('shieldthreat', 5),
        'protection:improved-disarm': linear('disarmcd', 7),
        'protection:vanguard': linear('vanguard'),
        'protection:improved-shield-wall': linear('shieldwallcd', 330),
        'protection:vitality': linear('vitality', .02),
        'protection:focused-rage': linear('focusedrage'),
        'protection:bastion': linear('bastion', .02),
    };
    const unsupported = new Set(['Deflection', 'Improved Charge', 'Booming Voice',
        'Iron Will', 'Piercing Howl', 'Blood Craze', 'Improved Intercept',
        'Improved Hamstring', 'Shield Specialization', 'Anticipation', 'Toughness',
        'Last Stand', 'Master of Defense', 'Improved Revenge', 'Defiance',
        'Improved Disarm', 'Vanguard', 'Improved Shield Wall', 'Concussion Blow',
        'Improved Shield Bash']);
    const classicByName = new Map(classicTalents.flatMap(tree => tree.t.map(t => [t.n, t])));
    for (const tree of talentsForever) {
        for (const talent of tree.t) {
            const original = classicByName.get(talent.forever.classic?.renamed || talent.n);
            talent.aura = effects[talent.forever.key] || original?.aura;
            if (!talent.aura) throw new Error(`Missing Forever talent handler: ${talent.n}`);
            if (original?.enable) talent.enable = original.enable;
            if (talent.n === 'Spearing Strike') talent.enable = 'forever:spearing-strike';
            if (talent.n === 'Sweeping Strikes') talent.enable = 'forever:sweeping-strikes';
            talent.forever.implementationStatus = unsupported.has(talent.n) ? 'outside-dps-model' : 'implemented';
        }
    }
    spells.push({id: 'forever:spearing-strike', name: 'Spearing Strike', classname: 'SpearingStrike',
        iconname: 'ability_warrior_savageblow', minlevel: 25, mode: 'forever',
        active: false, priority: 6, expriority: 4, minrage: 15, minrageactive: false,
        localDescription: 'Deals 40% normalized weapon damage, or 120% against Giants, Dragonkin and mounted targets. 15 Rage. 20 sec cooldown.'});
    spells.push({id: 'forever:sweeping-strikes', name: 'Sweeping Strikes', classname: 'SweepingStrikes',
        iconname: 'ability_rogue_slicedice', minlevel: 30, mode: 'forever', aura: true,
        active: false, priority: 9, expriority: 9,
        localDescription: 'Your next 5 melee attacks strike an additional nearby opponent. 30 Rage. 30 sec cooldown. Requires Battle Stance.'});
})();

function selectTalentRules(gameMode) {
    talents = gameMode === 'forever' ? talentsForever : classicTalents;
}
if (typeof mode !== 'undefined') selectTalentRules(mode);

function talentSelection(treeData = talents) {
    return treeData.map(tree => ({n: tree.n, t: tree.t.map(t => t.c),
        ...(treeData === talentsForever ? {keys: tree.t.map(t => t.forever.key)} : {})}));
}

// A build can only spend points in a row after investing in lower rows.
function validTalentBuild(treeData, ranks, level = 60) {
    let total = 0;
    for (let i = 0; i < treeData.length; i++) {
        const tree = treeData[i];
        for (let j = 0; j < tree.t.length; j++) {
            const talent = tree.t[j], count = ranks[i]?.[j] || 0;
            if (!Number.isInteger(count) || count < 0 || count > talent.m) return false;
            total += count;
            if (!count) continue;
            const lower = tree.t.reduce((sum, t, k) => sum + (t.y < talent.y ? ranks[i][k] || 0 : 0), 0);
            if (lower < talent.y * 5 || (talent.r && (ranks[i][talent.r[0]] || 0) < talent.r[1])) return false;
        }
    }
    return total <= Math.max(0, Number(level) - 9);
}

function normalizeForeverTalents(saved, schema, level = 60) {
    const counts = new Map();
    const current = schema === FOREVER_TALENT_SCHEMA;
    for (let i = 0; i < (saved || []).length; i++) {
        const tree = saved[i];
        for (let j = 0; j < (tree.t || []).length; j++) {
            const key = tree.keys?.[j] || (current ? talentsForever[i]?.t[j]?.forever.key : classicTalents[i]?.t[j]?.n);
            if (key) counts.set(key, Math.max(0, Math.floor(Number(tree.t[j]) || 0)));
        }
    }
    const ranks = talentsForever.map(tree => tree.t.map(t => Math.min(t.m,
        counts.get(t.forever.key) ?? counts.get(t.forever.classic?.renamed || t.n) ?? 0)));
    // Refund invalid descendants after moves/rank reductions; never assign replaced talents.
    let changed;
    do {
        changed = false;
        for (let i = 0; i < talentsForever.length; i++) {
            const tree = talentsForever[i];
            for (let j = tree.t.length - 1; j >= 0; j--) {
                const t = tree.t[j];
                const lower = tree.t.reduce((sum, parent, k) => sum + (parent.y < t.y ? ranks[i][k] : 0), 0);
                if (ranks[i][j] && (lower < t.y * 5 || (t.r && ranks[i][t.r[0]] < t.r[1]))) {
                    ranks[i][j] = 0; changed = true;
                }
            }
        }
        let excess = ranks.flat().reduce((a, b) => a + b, 0) - Math.max(0, Number(level) - 9);
        for (let i = ranks.length - 1; i >= 0 && excess > 0; i--)
            for (let j = ranks[i].length - 1; j >= 0 && excess > 0; j--) {
                const refund = Math.min(excess, ranks[i][j]);
                ranks[i][j] -= refund; excess -= refund; changed ||= refund > 0;
            }
    } while (changed);
    return talentsForever.map((tree, i) => ({n: tree.n, t: ranks[i], keys: tree.t.map(t => t.forever.key)}));
}
