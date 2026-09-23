#include "engine.hpp"

#include <algorithm>
#include <cmath>
#include <string>

namespace warriorsim {
namespace {

double trunc32(double value) {
    return detail::jsToInt32(value);
}

bool isQueuedStrike(const SpellState* spell) {
    return spell && (spell->kind == SpellKind::HeroicStrike || spell->kind == SpellKind::Cleave);
}

bool isPhysical(const SpellState* spell) {
    return !spell || spell->props.integer("school"_prop, static_cast<int>(School::Physical)) ==
                         static_cast<int>(School::Physical);
}

double weaponDamage(PlayerState& player, WeaponState& weapon, const SpellState* heroic) {
    double damage = player.rng.integer(weapon.mindmg + weapon.bonusdmg,
                                       weapon.maxdmg + weapon.bonusdmg) +
                    (player.stats.number("ap"_prop) / 14.0) * weapon.speed +
                    player.stats.number("moddmgdone"_prop);
    if (heroic) damage += heroic->props.number("bonus"_prop, heroic->props.number("value1"_prop));
    return damage * weapon.modifier * player.stats.number("dmgmod"_prop, 1) +
           player.stats.number("moddmgtaken"_prop);
}

double averageWeaponDamage(const PlayerState& player, const WeaponState& weapon) {
    double damage = ((weapon.mindmg + weapon.bonusdmg + weapon.maxdmg + weapon.bonusdmg) / 2.0) +
                    (player.stats.number("ap"_prop) / 14.0) * weapon.normSpeed +
                    player.stats.number("moddmgdone"_prop);
    damage = damage * weapon.modifier * player.stats.number("dmgmod"_prop, 1) +
             player.stats.number("moddmgtaken"_prop);
    return damage * (1 - player.weaponArmorReduction(weapon));
}

void useWeapon(PlayerState& player, WeaponState& weapon) {
    // Math.round is floor(x + .5) for the non-negative swing timers used here.
    weapon.timer = std::floor(weapon.speed * 1000.0 / player.stats.number("haste"_prop, 1) + 0.5);
    if (!weapon.offhand) {
        if (auto* slam = player.spell("slam"_action); slam && slam->props.boolean("afterswing"_prop)) {
            slam->props.set("mhthreshold"_prop, weapon.timer - 1000);
        }
    }
}

void addActiveStats(PropertyBag& destination, const PropertyBag& delta) {
    for (const std::uint16_t index : delta.denseNumberSlots) {
        const auto i = static_cast<std::size_t>(index);
        const double current = destination.denseNumberPresent.test(i) ? destination.denseNumbers[i] : 0;
        destination.denseNumbers[i] = current + delta.denseNumbers[i];
        destination.denseNumberPresent.set(i);
        destination.denseNumberFromString.reset(i);
    }
    for (const auto& [key, value] : delta.numbers)
        destination.set(key, destination.number(key) + value);
}

void applyActiveMultipliers(PropertyBag& destination, const PropertyBag& multiplier) {
    for (const std::uint16_t index : multiplier.denseNumberSlots) {
        const auto i = static_cast<std::size_t>(index);
        const double current = destination.denseNumberPresent.test(i) ? destination.denseNumbers[i] : 0;
        destination.denseNumbers[i] = current * (1 + multiplier.denseNumbers[i] / 100.0);
        destination.denseNumberPresent.set(i);
        destination.denseNumberFromString.reset(i);
    }
    for (const auto& [key, value] : multiplier.numbers)
        destination.set(key, destination.number(key) * (1 + value / 100.0));
}

bool active(const PlayerState& player, detail::KnownAction key) {
    const auto* value = player.aura(key);
    return value && value->timer != 0;
}

double auraStat(const PlayerState& player, detail::KnownAction key, detail::KnownProperty stat) {
    const auto* value = player.aura(key);
    return value && value->timer ? value->stats.number(stat) : 0;
}

double auraMult(const PlayerState& player, detail::KnownAction key, detail::KnownProperty stat) {
    const auto* value = player.aura(key);
    return value && value->timer ? value->multStats.number(stat) : 0;
}

void activateProcReference(PlayerState& player, ProcState& proc) {
    if (proc.spellAura != kNoRef) auraUse(player, player.auras[static_cast<std::size_t>(proc.spellAura)]);
    if (proc.spellSpell != kNoRef) spellUse(player, player.spells[static_cast<std::size_t>(proc.spellSpell)]);
}

} // namespace

void PlayerState::reset(double startingRage) {
    updateEurekaCosts(false);
    swordspecstep = -1;
    rage = foreverMode ? std::min(startingRage, prop("ragecap"_prop, 100)) : startingRage;
    bloodthrilltimer = 0;
    props.set("mounted"_prop, target.props.string("creaturetype"_prop) == "Mounted");
    timer = itemtimer = stancetimer = dodgetimer = 0;
    spelldelay = heroicdelay = 0;
    mh.timer = 0;
    extraattacks = batchedextras = 0;
    nextswinghs = nextswingcl = false;
    for (auto& value : spells) {
        value.timer = 0;
        if (value.props.has("eurekamod"_prop)) value.props.set("eurekamod"_prop, 1);
        value.stacks = 0;
        value.usedrage = 0;
        value.maxdelay = props.number("reactionmin"_prop);
        if (value.props.has("unqueuetimer"_prop))
            value.props.set("unqueuetimer"_prop, 300 + rng.integer(props.number("reactionmin"_prop), props.number("reactionmax"_prop)));
        if (value.backupHeroic) {
            value.backupHeroic->timer = 0;
            value.backupHeroic->stacks = 0;
            value.backupHeroic->maxdelay = props.number("reactionmin"_prop);
            value.backupHeroic->props.set("unqueuetimer"_prop, 300 + rng.integer(props.number("reactionmin"_prop), props.number("reactionmax"_prop)));
        }
    }
    for (auto& value : auras) {
        value.timer = 0;
        if (value.props.has("eurekamod"_prop)) value.props.set("eurekamod"_prop, 1);
        value.firstuse = true;
        value.stacks = 0;
        value.starttimer = 0;
        value.maxdelay = props.number("reactionmin"_prop);
        value.mintime = 0;
        value.nexttick = 0;
        value.savedDamage = 0;
        value.ticksleft = 0;
        value.cooldownTimer = 0;
        if (value.kind == AuraKind::SweepingStrikes || value.kind == AuraKind::DeepWounds || value.kind == AuraKind::OldDeepWounds ||
            value.kind == AuraKind::Rend || value.kind == AuraKind::TouchOfTheGrave) value.idmg = 0;
    }
    if (trinketproc1 && trinketproc1->useStep) trinketproc1->useStep = 0;
    if (trinketproc2 && trinketproc2->useStep) trinketproc2->useStep = 0;
    if (auto* value = spell("fireball"_action)) value->idmg = 0;

    stance = props.string("basestance"_prop, "battle");
    if (auto* value = aura("battlestance"_action)) value->timer = stance == "battle" ? 1 : 0;
    if (auto* value = aura("berserkerstance"_action)) value->timer = stance == "zerk" ? 1 : 0;
    if (auto* value = aura("defensivestance"_action)) value->timer = stance == "def" ? 1 : 0;
    update();
    if (oh) oh->timer = std::floor(oh->speed * 1000.0 / stats.number("haste"_prop, 1) / 2.0 + 0.5);
}

void PlayerState::update() {
    updateAuras();
    updateArmorReduction();
    mh.skill = stats.number("skill_" + std::to_string(mh.type));
    mh.glanceChance = glanceChance(mh);
    mh.miss = missChance(mh);
    mh.dwmiss = mh.miss;
    mh.dodge = dodgeChance(mh);
    mh.effectiveCrit = effectiveCrit(mh);
    if (oh) {
        oh->skill = stats.number("skill_" + std::to_string(oh->type));
        mh.dwmiss = dwMissChance(mh);
        oh->glanceChance = glanceChance(*oh);
        oh->miss = missChance(*oh);
        oh->dwmiss = dwMissChance(*oh);
        if (foreverMode) {
            oh->miss -= talents.number("offhit"_prop);
            oh->dwmiss -= talents.number("offhit"_prop);
        }
        oh->dodge = dodgeChance(*oh);
        oh->effectiveCrit = effectiveCrit(*oh);
    }
}

void PlayerState::updateAuras() {
    stats = base;
    for (const auto& value : auras) {
        if (!value.timer) continue;
        addActiveStats(stats, value.stats);
        applyActiveMultipliers(stats, value.multStats);
    }
    stats.set("str"_prop, trunc32(stats.number("str"_prop) * stats.number("strmod"_prop, 1)));
    stats.set("agi"_prop, trunc32(stats.number("agi"_prop) * stats.number("agimod"_prop, 1)));
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    stats.set("crit"_prop, stats.number("crit"_prop) + stats.number("agi"_prop) * props.number("agipercrit"_prop));
    crit = critChance();
    stats.set("block"_prop, stats.number("block"_prop) + trunc32(stats.number("str"_prop) / 20));
    if (stats.number("baseapmod"_prop, 1) != 1) {
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    }
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateStrength() {
    stats.set("str"_prop, base.number("str"_prop));
    stats.set("ap"_prop, base.number("ap"_prop));
    stats.set("apmod"_prop, base.number("apmod"_prop, 1));
    stats.set("baseapmod"_prop, base.number("baseapmod"_prop, 1));
    for (const auto& value : auras) {
        if (!value.timer) continue;
        stats.set("str"_prop, stats.number("str"_prop) + value.stats.number("str"_prop));
        stats.set("ap"_prop, stats.number("ap"_prop) + value.stats.number("ap"_prop));
        if (value.multStats.number("apmod"_prop))
            stats.set("apmod"_prop, stats.number("apmod"_prop) * (1 + value.multStats.number("apmod"_prop) / 100));
        if (value.multStats.number("baseapmod"_prop))
            stats.set("baseapmod"_prop, stats.number("baseapmod"_prop) * (1 + value.multStats.number("baseapmod"_prop) / 100));
    }
    stats.set("str"_prop, trunc32(stats.number("str"_prop) * stats.number("strmod"_prop, 1)));
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    stats.set("block"_prop, base.number("block"_prop) + trunc32(stats.number("str"_prop) / 20));
    if (stats.number("baseapmod"_prop, 1) != 1)
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateAP() {
    stats.set("ap"_prop, base.number("ap"_prop));
    stats.set("apmod"_prop, base.number("apmod"_prop, 1));
    // Existing JS initializes this from base.apmod (not base.baseapmod).
    stats.set("baseapmod"_prop, base.number("apmod"_prop, 1));
    for (const auto& value : auras) {
        if (!value.timer) continue;
        stats.set("ap"_prop, stats.number("ap"_prop) + value.stats.number("ap"_prop));
        if (value.multStats.number("apmod"_prop))
            stats.set("apmod"_prop, stats.number("apmod"_prop) * (1 + value.multStats.number("apmod"_prop) / 100));
        if (value.multStats.number("baseapmod"_prop))
            stats.set("baseapmod"_prop, stats.number("baseapmod"_prop) * (1 + value.multStats.number("baseapmod"_prop) / 100));
    }
    stats.set("ap"_prop, stats.number("ap"_prop) + stats.number("str"_prop) * 2);
    if (stats.number("baseapmod"_prop, 1) != 1)
        stats.set("ap"_prop, stats.number("ap"_prop) + trunc32((base.number("aprace"_prop) + stats.number("str"_prop) * 2) *
                                                       (stats.number("baseapmod"_prop, 1) - 1)));
    stats.set("ap"_prop, trunc32(stats.number("ap"_prop) * stats.number("apmod"_prop, 1)));
}

void PlayerState::updateHaste() {
    stats.set("haste"_prop, base.number("haste"_prop, 1));
    const auto apply = [this](detail::KnownAction key) {
        const auto* value = aura(key);
        if (!value || !value->timer) return;
        const double multiplier = 1 + value->multStats.number("haste"_prop) / 100;
        stats.set("haste"_prop, stats.number("haste"_prop) * multiplier);
    };
    // Preserve the source's literal order.  Besides intentionally excluding
    // unrelated auras, it fixes the exact floating-point event times for Slam.
    apply("flurry"_action);
    apply("berserking"_action);
    apply("empyrean"_action);
    apply("eskhandar"_action);
    apply("pummeler"_action);
    apply("spider"_action);
    apply("jujuflurry"_action);
}

void PlayerState::updateHasteDamage() {
    double mod = 1;
    if (active(*this, "jujuflurry"_action))
        mod *= 1 + auraMult(*this, "jujuflurry"_action, "haste"_prop) / 100;
    mh.mindmg = mh.baseMindmg / mod;
    mh.maxdmg = mh.baseMaxdmg / mod;
    if (oh) { oh->mindmg = oh->baseMindmg / mod; oh->maxdmg = oh->baseMaxdmg / mod; }
}

void PlayerState::updateBonusDmg() {
    double bonus = 0;
    constexpr detail::KnownAction bonusKeys[] = {"zeal"_action, "zandalarian"_action};
    for (const auto key : bonusKeys) bonus += auraStat(*this, key, "moddmgdone"_prop);
    stats.set("moddmgdone"_prop, base.number("moddmgdone"_prop) + bonus);
    stats.set("moddmgtaken"_prop, base.number("moddmgtaken"_prop));
    mh.bonusdmg = mh.baseBonusdmg;
    if (oh) oh->bonusdmg = oh->baseBonusdmg;
}

void PlayerState::updateArmorReduction() {
    target.armor = target.props.number("basearmorbuffed"_prop);
    const auto subtractStacked = [this](detail::KnownAction key) {
        if (const auto* value = aura(key); value && value->timer)
            target.armor = std::max(target.armor - value->stacks * value->props.number("armor"_prop), 0.0);
    };
    subtractStacked("annihilator"_action);
    subtractStacked("rivenspike"_action);
    subtractStacked("bonereaver"_action);
    subtractStacked("swarmguard"_action);
    armorReduction = getArmorReduction();
}

void PlayerState::updateDmgMod() {
    stats.set("dmgmod"_prop, base.number("dmgmod"_prop, 1));
    stats.set("spelldmgmod"_prop, base.number("spelldmgmod"_prop, 1));
    for (const auto& value : auras) if (value.timer && value.multStats.number("dmgmod"_prop))
        stats.set("dmgmod"_prop, stats.number("dmgmod"_prop) * (1 + value.multStats.number("dmgmod"_prop) / 100));
}

double PlayerState::glanceReduction(const WeaponState& weapon) {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    const double low = std::clamp(1.3 - 0.05 * diff, 0.01, 0.91);
    const double high = std::clamp(1.2 - 0.03 * diff, 0.2, 0.99);
    return rng.next() * (high - low) + low;
}

double PlayerState::glanceChance(const WeaponState& weapon) const {
    return 10 + std::max(target.props.number("defense"_prop) -
        std::min(props.number("level"_prop) * 5, weapon.skill), 0.0) * 2;
}

double PlayerState::missChance(const WeaponState& weapon) const {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    return 5 + (diff > 10 ? diff * .2 : diff * .1) - (diff > 10 ? stats.number("hit"_prop) - 1 : stats.number("hit"_prop));
}

double PlayerState::dwMissChance(const WeaponState& weapon) const {
    const double diff = target.props.number("defense"_prop) - weapon.skill;
    double miss = 5 + (diff > 10 ? diff * .2 : diff * .1);
    miss = miss * .8 + 20;
    return miss - (diff > 10 ? stats.number("hit"_prop) - 1 : stats.number("hit"_prop));
}

double PlayerState::critChance() const {
    return std::max(stats.number("crit"_prop) + talents.number("crit"_prop) +
                    (props.number("level"_prop) - target.props.number("level"_prop)) -
                    (target.props.number("level"_prop) - props.number("level"_prop) >= 3 ? 1.8 : 0), 0.0);
}

double PlayerState::effectiveCrit(const WeaponState& weapon) const {
    return std::max(0.0, crit + weapon.crit + (foreverMode ? weapon.props.number("racialcrit"_prop) : 0) +
        (weapon.skill - target.props.number("defense"_prop)) * .04 +
        (baseStance == "zerk" ? 3 : 0));
}

double PlayerState::dodgeChance(const WeaponState& weapon) const {
    return std::max(5 - target.props.number("dodge"_prop) +
                    (target.props.number("defense"_prop) - weapon.skill) * .1, 0.0);
}

double PlayerState::getArmorReduction() const {
    const double armor = std::isnan(target.armor) ? 0 : target.armor;
    return std::min(armor / (armor + 400 + 85 * props.number("level"_prop)), .75);
}

bool PlayerState::stepTimer(double amount) {
    if (timer <= amount) { timer = 0; return true; }
    timer -= amount; return false;
}
bool PlayerState::stepItemTimer(double amount) {
    if (itemtimer <= amount) { itemtimer = 0; return true; }
    itemtimer -= amount; return false;
}
bool PlayerState::stepStanceTimer(double amount) {
    if (stancetimer <= amount) { stancetimer = 0; return true; }
    stancetimer -= amount; return false;
}
void PlayerState::stepDodgeTimer(double amount) {
    if (dodgetimer <= amount) dodgetimer = 0; else dodgetimer -= amount;
}

void PlayerState::stepAuras(bool noBleeds) {
    for (const auto& entry : configured.stepAuras) {
        if (entry.skipWhenNoBleeds && noBleeds) continue;
        if (entry.requireAdjacent && !prop("adjacent"_prop)) continue;
        auto& value = auras[static_cast<std::size_t>(entry.index)];
        if (value.timer && (!entry.requireFirstUse || value.firstuse))
            (void)auraStep(*this, value);
    }
}

void PlayerState::endAuras() {
    for (const auto& entry : configured.endAuras) {
        auto& value = auras[static_cast<std::size_t>(entry.index)];
        if (value.timer && (!entry.requireFirstUse || value.firstuse))
            auraEnd(*this, value);
    }
}

Result PlayerState::rollWeapon(WeaponState& weapon) {
    double tmp = 0;
    const int roll = rng.tenK();
    double miss = weapon.dwmiss;
    // Only Classic removes the dual-wield miss penalty while a strike is queued.
    if (!foreverMode && nextswinghs) miss = weapon.miss;
    tmp += std::max(miss, 0.0) * 100;
    if (roll < tmp) return Result::Miss;
    tmp += weapon.dodge * 100; if (roll < tmp) return Result::Dodge;
    tmp += weapon.glanceChance * 100; if (roll < tmp) return Result::Glance;
    tmp += (crit + weapon.crit + (foreverMode ? weapon.props.number("racialcrit"_prop) : 0)) * 100;
    if (roll < tmp) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMeleeSpell(SpellState& value, WeaponState& weapon) {
    double tmp = std::max(weapon.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) return Result::Miss;
    if (value.props.boolean("canDodge"_prop, true)) {
        tmp += weapon.dodge * 100;
        if (roll < tmp) return Result::Dodge;
    }
    if (!value.props.boolean("weaponspell"_prop, true)) { roll = rng.tenK(); tmp = 0; }
    double valueCrit = crit + weapon.crit + (foreverMode ? weapon.props.number("racialcrit"_prop) : 0);
    if (value.kind == SpellKind::Overpower) valueCrit += talents.number("overpowercrit"_prop);
    tmp += valueCrit * 100;
    if (roll < tmp && !value.props.boolean("nocrit"_prop)) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMeleeAura(AuraState& value, WeaponState& weapon) {
    double tmp = std::max(weapon.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) return Result::Miss;
    if (value.props.boolean("canDodge"_prop, true)) {
        tmp += weapon.dodge * 100;
        if (roll < tmp) return Result::Dodge;
    }
    // Aura's base class does not define weaponspell. Rend therefore follows
    // JavaScript's `!undefined` branch and consumes a separate crit-table roll.
    if (!value.props.boolean("weaponspell"_prop)) { roll = rng.tenK(); tmp = 0; }
    tmp += (crit + weapon.crit + (foreverMode ? weapon.props.number("racialcrit"_prop) : 0)) * 100;
    if (roll < tmp && !value.props.boolean("nocrit"_prop)) return Result::Crit;
    return Result::Hit;
}

Result PlayerState::rollMagicSpell(SpellState& value) {
    double miss = value.props.boolean("binaryspell"_prop) ? target.props.number("binaryresist"_prop) : target.props.number("misschance"_prop);
    if (rng.tenK() < miss) return Result::Miss;
    if (rng.tenK() < stats.number("spellcrit"_prop) * 100) return Result::Crit;
    return Result::Hit;
}

void PlayerState::addRage(double dmg, Result result, WeaponState& weapon, const SpellState* ability) {
    if (!ability || isQueuedStrike(ability)) {
        if (result != Result::Miss && result != Result::Dodge && talents.number("umbridledwrath"_prop) &&
            rng.tenK() < talents.number("umbridledwrath"_prop) * 100) {
            rage += 1;
            if (foreverMode && weapon.twohand) rage += 1;
        }
    }
    if (ability) {
        if (ability->kind == SpellKind::Execute)
            const_cast<SpellState*>(ability)->lastResult = result;
        if (result == Result::Miss || result == Result::Dodge) {
            rage += ability->props.boolean("refund"_prop, true) ? ability->props.number("cost"_prop) * .8 : 0;
        }
    } else if (foreverMode) {
        // Base weapon speed in seconds; crits, glances and haste do not change rage per hit.
        if (result != Result::Miss && result != Result::Dodge)
            rage += weapon.speed * (weapon.twohand ? 4.5 : 3.46) *
                (weapon.offhand ? .5 * (1 + talents.number("offragebonus"_prop)) : 1);
    } else {
        if (result == Result::Dodge)
            rage += (averageWeaponDamage(*this, weapon) / props.number("rageconversion"_prop)) * 7.5 * .75;
        else if (result != Result::Miss)
            rage += (dmg / props.number("rageconversion"_prop)) * 7.5;
    }
    rage = std::min(rage, props.number("ragecap"_prop, 100));

}

namespace {
bool eurekaEligible(const SpellState& ability) {
    return ability.kind != SpellKind::StanceSwitch && ability.kind != SpellKind::RagePotion &&
        ability.kind != SpellKind::Fireball && ability.kind != SpellKind::GrilekFury && ability.kind != SpellKind::Spell;
}
bool eurekaEligible(const AuraState& ability) {
    return ability.kind == AuraKind::Rend || ability.kind == AuraKind::BattleShout ||
        ability.kind == AuraKind::DeathWish || ability.kind == AuraKind::Recklessness || ability.kind == AuraKind::SweepingStrikes;
}
}

void PlayerState::updateEurekaCosts(bool active) {
    const auto* eureka = aura("eureka"_action);
    if (!eureka) return;
    const auto update = [&](auto& ability) {
        if (!eurekaEligible(ability)) return;
        if (active && ability.props.number("cost"_prop)) {
            ability.props.set("eurekabasecost"_prop, ability.props.number("cost"_prop));
            ability.props.set("cost"_prop, ability.props.number("cost"_prop) * (1 - eureka->props.number("costreduction"_prop)));
        } else if (!active && ability.props.has("eurekabasecost"_prop)) {
            ability.props.set("cost"_prop, ability.props.number("eurekabasecost"_prop));
        }
    };
    for (auto& ability : spells) update(ability);
    for (auto& ability : auras) update(ability);
}

bool PlayerState::beginEureka(SpellState& ability) {
    const auto* eureka = aura("eureka"_action);
    if (!eureka) return false;
    const bool empowered = eureka && eureka->stacks && eurekaEligible(ability);
    ability.props.set("eurekamod"_prop, empowered ? 1.1 : 1);
    return empowered;
}

void PlayerState::consumeEureka() {
    if (auto* eureka = aura("eureka"_action); eureka && eureka->stacks && !--eureka->stacks) {
        auraEnd(*this, *eureka);
    }
}

void PlayerState::castRacialAffectedAura(AuraState& ability) {
    stepAuras();
    const auto* eureka = aura("eureka"_action);
    const bool empowered = eureka && eureka->stacks && eurekaEligible(ability);
    ability.props.set("eurekamod"_prop, empowered ? 1.1 : 1);
    auraUse(*this, ability);
    if (empowered) consumeEureka();
}

double PlayerState::attackMh(WeaponState& weapon, int adjacent, double damageSoFar) {
    stepAuras();
    SpellState* ability = nullptr;
    Result result;
    if (nextswinghs) {
        nextswinghs = false;
        auto* heroic = spell("heroicstrike"_action);
        auto* cleave = spell("cleave"_action);
        if (heroic && heroic->props.number("cost"_prop) <= rage) {
            result = rollMeleeSpell(*heroic, mh);
            ability = heroic;
            rage -= ability->props.number("cost"_prop);
        } else if (cleave && cleave->props.number("cost"_prop) <= rage) {
            result = rollMeleeSpell(*cleave, mh);
            ability = cleave;
            if (adjacent) rage -= ability->props.number("cost"_prop);
        } else result = rollWeapon(weapon);
    } else result = rollWeapon(weapon);

    const bool empowered = ability && !adjacent ? beginEureka(*ability) : false;
    double dmg = weaponDamage(*this, weapon, ability) * (ability ? ability->props.number("eurekamod"_prop, 1) : 1);
    const double procDmg = procAttack(ability, weapon, result, adjacent, damageSoFar);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Glance) dmg *= glanceReduction(weapon);
    if (result == Result::Crit) {
        const double abilityBonus = ability ? talents.number("abilitiescrit"_prop) : 0;
        dmg *= 1 + (1 + abilityBonus);
        procCrit(false, adjacent);
    }
    useWeapon(*this, weapon);
    double done = dealDamage(dmg, result, weapon, ability, adjacent != 0);
    const auto index = static_cast<std::size_t>(result);
    if (ability) {
        ability->totaldmg += done;
        if (!adjacent) ++ability->data[index];
    } else {
        weapon.totaldmg += done;
        ++weapon.data[index];
    }
    weapon.totalprocdmg += procDmg;
    if (ability && ability->kind == SpellKind::Cleave && !adjacent) {
        nextswinghs = true;
        done += attackMh(weapon, 1, done);
    }
    if (empowered) consumeEureka();
    return done + procDmg;
}

double PlayerState::attackOh(WeaponState& weapon) {
    stepAuras();
    const Result result = rollWeapon(weapon);
    double dmg = weaponDamage(*this, weapon, nullptr);
    const double procDmg = procAttack(nullptr, weapon, result, 0, 0);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Glance) dmg *= glanceReduction(weapon);
    if (result == Result::Crit) {
        dmg *= 2;
        procCrit(true, 0);
    }
    useWeapon(*this, weapon);
    const double done = dealDamage(dmg, result, weapon, nullptr, false);
    ++weapon.data[static_cast<std::size_t>(result)];
    weapon.totaldmg += done;
    weapon.totalprocdmg += procDmg;
    return done + procDmg;
}

double PlayerState::cast(SpellState& ability, SpellState* delayedHeroic, int adjacent,
                         double damageSoFar) {
    bool empowered = false;
    if (!adjacent) {
        stepAuras();
        if (!isQueuedStrike(&ability)) empowered = beginEureka(ability);
        spellUse(*this, ability, delayedHeroic);
    }
    if (ability.props.boolean("useonly"_prop)) {
        if (empowered) consumeEureka();
        return 0;
    }
    double dmg = spellDamage(*this, ability) * mh.modifier * ability.props.number("eurekamod"_prop, 1);
    if (dmg) dmg += stats.number("moddmgtaken"_prop);
    Result result = Result::Hit;
    const int defenseType = ability.props.integer("defenseType"_prop, 2);
    if (defenseType == 2) result = rollMeleeSpell(ability, mh);
    else if (defenseType == 1) result = rollMagicSpell(ability);
    double procDmg = procAttack(&ability, mh, result, adjacent, damageSoFar);
    if (ability.kind == SpellKind::SunderArmor)
        procDmg += procAttack(&ability, mh, result, adjacent, damageSoFar);
    if (result == Result::Miss || result == Result::Dodge) {
        if (ability.kind == SpellKind::SunderArmor) --ability.stacks;
        if (result == Result::Dodge) dodgetimer = 5000;
    } else if (result == Result::Crit) {
        if (defenseType == 1)
            dmg *= 1 + .5 * (1 + talents.number("abilitiescrit"_prop));
        else
            dmg *= 1 + (1 + talents.number("abilitiescrit"_prop));
        procCrit(false, adjacent);
    }
    const double done = dealDamage(dmg, result, mh, &ability, adjacent != 0);
    if (!adjacent) ++ability.data[static_cast<std::size_t>(result)];
    ability.totaldmg += done;
    mh.totalprocdmg += procDmg;
    if (empowered) consumeEureka();
    (void)delayedHeroic; // consumed by Execute's spellUse implementation.
    return done + procDmg;
}

double PlayerState::castOh(SpellState& ability, int adjacent, double damageSoFar) {
    if (!oh) return 0;
    double dmg = spellDamage(*this, ability, &*oh) * oh->modifier * ability.props.number("eurekamod"_prop, 1);
    if (dmg) dmg += stats.number("moddmgtaken"_prop);
    const Result result = rollMeleeSpell(ability, *oh);
    const double procDmg = procAttack(&ability, *oh, result, adjacent, damageSoFar);
    if (result == Result::Dodge) dodgetimer = 5000;
    if (result == Result::Crit) {
        dmg *= 1 + (1 + talents.number("abilitiescrit"_prop));
        procCrit(true, adjacent);
    }
    const double done = dealDamage(dmg, result, *oh, &ability, adjacent != 0);
    ability.totaldmg += done;
    ability.offhandhit = false;
    oh->totalprocdmg += procDmg;
    return done + procDmg;
}

double PlayerState::weaponArmorReduction(const WeaponState& weapon) const {
    if (!foreverMode || !talents.number("weaponmasterarp"_prop) || (weapon.type != 0 && weapon.type != 6)) return armorReduction;
    const double armor = target.armor * (1 - talents.number("weaponmasterarp"_prop));
    return std::min(.75, armor / (armor + 400 + 85 * props.number("level"_prop)));
}

double PlayerState::dealDamage(double dmg, Result result, WeaponState& weapon,
                               SpellState* ability, bool adjacent) {
    const bool landed = result != Result::Miss && result != Result::Dodge;
    if (landed && isPhysical(ability)) dmg *= 1 - weaponArmorReduction(weapon);
    if (!adjacent) {
        addRage(dmg, result, weapon, ability);
    }
    if (landed && dmg > 0) {
        if (auto* grave = aura("touchofthegrave"_action); grave && step >= grave->cooldownTimer && rng.tenK() < grave->props.number("chance"_prop)) {
            grave->cooldownTimer = step + grave->props.number("cooldown"_prop) * 1000;
            ProcState proc;
            proc.magicDamage = prop("maxhealth"_prop) * grave->props.number("healthcoeff"_prop);
            const double damage = magicProc(proc);
            grave->idmg += damage;
            grave->totaldmg += damage;
        }
    }
    if (landed && dmg > 0 && !adjacent && (!ability || ability->props.integer("defenseType"_prop, 2) == 2)) {
        if (const auto* rend = aura("rend"_action); talents.number("bloodthrill"_prop) && rend && rend->timer > step && rend->stacks &&
            rng.tenK() < talents.number("bloodthrill"_prop) * 100) bloodthrilltimer = 6000;
        if (auto* sweeping = aura("sweepingstrikes"_action); prop("adjacent"_prop) && sweeping && sweeping->timer && sweeping->stacks) {
            sweeping->idmg += dmg;
            sweeping->totaldmg += dmg;
            if (!--sweeping->stacks) auraEnd(*this, *sweeping);
        }
    }
    if (landed && ability && ability->kind == SpellKind::SpearingStrike) props.set("mounted"_prop, false);
    return landed ? dmg : 0;
}

void PlayerState::procCrit(bool offhand, int adjacent) {
    if (auto* value = aura("flurry"_action)) auraUse(*this, *value);
    if (auto* value = aura("deepwounds"_action)) {
        if (!adjacent) auraUse(*this, *value, offhand);
        else {
            const auto index = rng.integer(1, adjacent) + 1;
            if (auto* other = aura("deepwounds" + std::to_string(index))) auraUse(*this, *other, offhand);
        }
    }
}

double PlayerState::magicProc(const ProcState& proc) {
    double mod = 1;
    double miss = target.props.number("misschance"_prop);
    double dmg = proc.magicDamage;
    if (proc.binarySpell) miss = target.props.number("binaryresist"_prop);
    else mod *= target.props.number("mitigation"_prop, 1);
    if (rng.tenK() < miss) return 0;
    if (rng.tenK() < stats.number("spellcrit"_prop) * 100)
        mod *= 1 + .5;
    if (proc.coefficient) {
        const auto* fury = aura("bloodfury"_action);
        dmg += props.number("spelldamage"_prop) * proc.coefficient * (foreverMode && fury && fury->timer ? 1.1 : 1);
    }
    return dmg * mod * stats.number("spelldmgmod"_prop, 1);
}

double PlayerState::physProc(double dmg) {
    double tmp = std::max(mh.miss, 0.0) * 100;
    int roll = rng.tenK();
    if (roll < tmp) dmg = 0;
    tmp += mh.dodge * 100;
    if (roll < tmp) dmg = 0;
    roll = rng.tenK();
    if (roll < (crit + mh.crit) * 100) dmg *= 2;
    return dmg * stats.number("dmgmod"_prop, 1) * mh.modifier;
}

double PlayerState::phantomProc(WeaponState& weapon) {
    if (!weapon.proc1) return 0;
    double dmg = 0;
    if (rng.tenK() < weapon.proc1->chance) {
        dmg += physProc(weapon.proc1->physicalDamage);
        if (dmg > 0) dmg += phantomProc(weapon);
    }
    if (weapon.proc2 && rng.tenK() < weapon.proc2->chance) {
        activateProcReference(*this, *weapon.proc2);
        if (weapon.proc2->magicDamage) dmg += magicProc(*weapon.proc2);
    }
    return dmg;
}

double PlayerState::procAttack(SpellState* ability, WeaponState& weapon, Result result,
                               int adjacent, double damageSoFar) {
    if (ability && ability->kind == SpellKind::ThunderClap) return 0;
    if (ability && ability->kind == SpellKind::ShieldSlam) {
        if (result != Result::Miss && result != Result::Dodge) {
            if (weapon.windfuryAura != kNoRef && !auras[weapon.windfuryAura].timer && !damageSoFar && rng.tenK() < 2000)
                auraUse(*this, auras[weapon.windfuryAura]);
        }
        return 0;
    }
    double procDmg = 0;
    int extras = 0;
    int batched = 0;
    if (result != Result::Miss && result != Result::Dodge) {
        if (ability && ability->kind == SpellKind::Execute) {
            rage = 0;
        }
        const auto weaponDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance) || (proc.gcd && timer && timer < 1500)) return;
            activateProcReference(*this, proc);
            if (proc.magicDamage)
                procDmg += proc.chance == 10000 ? proc.magicDamage : magicProc(proc);
            if (proc.physicalDamage) {
                double dmg = physProc(proc.physicalDamage);
                if (dmg > 0 && proc.phantom) dmg += phantomProc(weapon);
                procDmg += dmg;
            }
        };
        const auto weaponExtraProc = [&](ProcState& proc) {
            if (damageSoFar || !(rng.tenK() < proc.chance) ||
                (proc.gcd && timer && timer < 1500)) return;
            if (ability) extraattacks += proc.extraCount;
            else extras = proc.extraCount;
        };
        const auto trinketDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance)) return;
            if (proc.magicDamage) procDmg += magicProc(proc);
            activateProcReference(*this, proc);
        };
        const auto trinketExtraProc = [&](ProcState& proc) {
            if (damageSoFar || !(rng.tenK() < proc.chance)) return;
            if (!proc.cooldown || !proc.useStep || step > proc.useStep) {
                if (proc.cooldown) proc.useStep = step + proc.cooldown;
                if (ability) batchedextras += proc.extraCount;
                else batched = proc.extraCount;
            }
        };
        const auto attackDamageProc = [&](ProcState& proc) {
            if (!(rng.tenK() < proc.chance)) return;
            if (proc.magicDamage)
                procDmg += proc.chance == 10000 ? proc.magicDamage : magicProc(proc);
            activateProcReference(*this, proc);
        };

        for (const auto& entry : weapon.procPlan) {
            switch (entry.stage) {
            case ProcStage::WeaponProc1Damage:
                weaponDamageProc(*weapon.proc1);
                break;
            case ProcStage::WeaponProc1Extra:
                weaponExtraProc(*weapon.proc1);
                break;
            case ProcStage::WeaponProc2:
                if (rng.tenK() < weapon.proc2->chance) {
                    activateProcReference(*this, *weapon.proc2);
                    if (weapon.proc2->magicDamage) procDmg += magicProc(*weapon.proc2);
                }
                break;
            case ProcStage::TrinketProc1Damage:
                trinketDamageProc(*trinketproc1);
                break;
            case ProcStage::TrinketProc1Extra:
                trinketExtraProc(*trinketproc1);
                break;
            case ProcStage::TrinketProc2Damage:
                trinketDamageProc(*trinketproc2);
                break;
            case ProcStage::TrinketProc2Extra:
                trinketExtraProc(*trinketproc2);
                break;
            case ProcStage::AttackProc1Damage:
                if (attackproc1) attackDamageProc(*attackproc1);
                break;
            case ProcStage::AttackProc2Damage:
                if (attackproc2) attackDamageProc(*attackproc2);
                break;
            case ProcStage::SwordSpec:
                if (!damageSoFar && swordspecstep != step && rng.tenK() < entry.chance) {
                    swordspecstep = step;
                    ability ? ++extraattacks : ++extras;
                }
                break;
            case ProcStage::Windfury: {
                auto& windfury = auras[static_cast<std::size_t>(entry.action)];
                if (!windfury.timer && !damageSoFar && rng.tenK() < 2000) {
                    if (!ability) extras = 0;
                    auraUse(*this, windfury);
                }
                break;
            }
            case ProcStage::Swarmguard: {
                auto& value = auras[static_cast<std::size_t>(entry.action)];
                if (value.timer && rng.tenK() < entry.chance) auraProc(*this, value);
                break;
            }
            case ProcStage::Zandalarian: {
                auto& value = auras[static_cast<std::size_t>(entry.action)];
                if (value.timer) auraProc(*this, value);
                break;
            }
            case ProcStage::Dragonbreath:
                if (rng.tenK() < 500) {
                    ProcState dragon;
                    dragon.props.set("magicdmg"_prop, 60);
                    dragon.props.set("coeff"_prop, 1);
                    dragon.loadScalars();
                    procDmg += magicProc(dragon);
                }
                break;
            }
        }
        extraattacks += extras;
        batchedextras += batched;
    }
    if (!ability) {
        if (configured.procTailFlurry != kNoRef) {
            auto& value = auras[static_cast<std::size_t>(configured.procTailFlurry)];
            if (value.stacks) auraProc(*this, value);
        }
        if (mh.windfuryAura != kNoRef && auras[mh.windfuryAura].stacks) auraProc(*this, auras[mh.windfuryAura]);
    }
    return procDmg;
}

void PlayerState::switchStance(std::string_view value) {
    stance = std::string(value);
    if (auto* auraValue = aura("battlestance"_action)) auraValue->timer = 0;
    if (auto* auraValue = aura("berserkerstance"_action)) auraValue->timer = 0;
    if (auto* auraValue = aura("defensivestance"_action)) auraValue->timer = 0;
    const auto stanceKey = detail::stanceAuraAction(stance);
    if (auto* auraValue = stanceKey ? aura(*stanceKey) : aura(std::string_view{})) auraValue->timer = 1;
    rage = std::min(rage, talents.number("rageretained"_prop));
    stancetimer = 1000;
    updateAuras();
}

bool PlayerState::isValidStance(std::string_view value) const {
    return stance == value;
}

} // namespace warriorsim
