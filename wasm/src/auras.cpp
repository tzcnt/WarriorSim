#include "engine.hpp"

#include <algorithm>
#include <cmath>

namespace warriorsim {
namespace {

double durationMs(const AuraState& aura) { return aura.props.number("duration"_prop) * 1000.0; }
double cooldownMs(const AuraState& aura) { return aura.props.number("cooldown"_prop) * 1000.0; }
bool active(const AuraState& aura) { return aura.timer != 0; }

void accountRefresh(PlayerState& player, AuraState& aura) {
    if (active(aura)) aura.uptime += player.step - aura.starttimer;
}

void begin(PlayerState& player, AuraState& aura, int precounter = 0) {
    accountRefresh(player, aura);
    aura.timer = player.step + durationMs(aura) - precounter;
    aura.starttimer = player.step - precounter;
}

void setDelay(PlayerState& player, AuraState& aura) {
    aura.maxdelay = player.rng.integer(player.prop("reactionmin"_prop), player.prop("reactionmax"_prop));
}

void expire(PlayerState& player, AuraState& aura, bool firstuse = false) {
    aura.uptime += aura.timer - aura.starttimer;
    aura.timer = 0;
    if (firstuse) aura.firstuse = false;
}

void useWithUpdate(PlayerState& player, AuraState& aura,
                   void (PlayerState::*update)(), int precounter = 0,
                   bool delay = false) {
    begin(player, aura, precounter);
    (player.*update)();
    if (delay) setDelay(player, aura);
}

bool stepWithUpdate(PlayerState& player, AuraState& aura,
                    void (PlayerState::*update)(), bool firstuse = false,
                    bool setCooldown = false) {
    if (player.step < aura.timer) return true;
    expire(player, aura, firstuse);
    if (setCooldown) aura.useStep = aura.starttimer + cooldownMs(aura);
    (player.*update)();
    return false;
}

void useItem(PlayerState& player, AuraState& aura, int precounter,
             void (PlayerState::*update)(), bool delay = false) {
    player.itemtimer = durationMs(aura) - precounter;
    useWithUpdate(player, aura, update, precounter, delay);
}

bool isAlwaysBase(AuraKind kind) {
    switch (kind) {
    case AuraKind::Aura:
    case AuraKind::Destiny:
    case AuraKind::Untamed:
    case AuraKind::Avenger:
        return true;
    default:
        return false;
    }
}

} // namespace

bool auraCanUse(PlayerState& player, AuraState& aura) {
    if (aura.kind == AuraKind::SweepingStrikes) {
        const double cost = aura.props.number("cost"_prop);
        return !aura.timer && (!aura.props.number("gcd"_prop) || !player.timer) && player.prop("adjacent"_prop) > 0 &&
            aura.cooldownTimer <= player.step && player.rage >= cost &&
            (player.isValidStance("battle") || player.talents.number("rageretained"_prop) >= cost);
    }
    const bool ready = !active(aura) && player.step >= aura.useStep;
    switch (aura.kind) {
    case AuraKind::ElunesLight:
    case AuraKind::Eureka:
        return ready && player.step >= aura.cooldownTimer;
    case AuraKind::Recklessness:
        return ready && !player.timer;
    case AuraKind::Cloudkeeper:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::DeathWish:
        return ready && !player.timer && player.rage >= aura.props.number("cost"_prop, 10);
    case AuraKind::MightyRagePotion:
        return aura.firstuse && ready;
    case AuraKind::BloodFury:
        return aura.firstuse && ready && !player.timer;
    case AuraKind::Berserking:
        return aura.firstuse && ready && player.rage >= 5;
    case AuraKind::Pummeler:
    case AuraKind::Flask:
        return aura.firstuse && ready && !player.itemtimer &&
            (aura.kind != AuraKind::Flask || !player.timer);
    case AuraKind::Swarmguard:
        return aura.firstuse && ready;
    case AuraKind::Slayer:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::Spider:
    case AuraKind::Earthstrike:
    case AuraKind::Gabbar:
    case AuraKind::Zandalarian:
        return aura.firstuse && ready && !player.itemtimer;
    case AuraKind::BattleShout:
        return !active(aura) && !player.timer && player.rage >= aura.props.number("cost"_prop);
    case AuraKind::Rend: {
        const double cost = aura.props.number("cost"_prop);
        const bool stance = player.isValidStance("battle") ||
            player.isValidStance("def");
        return !active(aura) && !player.timer && player.rage >= cost &&
            (stance || player.talents.number("rageretained"_prop) >= cost) &&
            (!aura.props.number("maxrage"_prop) || stance || player.rage <= aura.props.number("maxrage"_prop));
    }
    case AuraKind::JujuFlurry:
        return ready;
    default:
        return false;
    }
}

int auraPrep(PlayerState&, AuraState& aura, double duration, double itemdelay) {
    if (aura.props.has("timetostart"_prop)) aura.useStep = aura.props.integer("timetostart"_prop);
    if (!aura.props.has("timetoend"_prop)) return 0;

    const int timeToEnd = aura.props.integer("timetoend"_prop);
    const int auraDuration = static_cast<int>(durationMs(aura));
    if (aura.props.boolean("item"_prop) && !aura.props.boolean("noitemcd"_prop)) {
        aura.useStep = std::max(std::min(duration - timeToEnd,
            duration - itemdelay - auraDuration), 0.0);
        return auraDuration;
    }
    aura.useStep = std::max(duration - timeToEnd, 0.0);
    return 0;
}

void auraRemove(PlayerState& player, AuraState& aura) {
    if (!active(aura)) return;
    aura.uptime += player.step - aura.starttimer;
    aura.timer = 0;
    player.updateAuras();
}

void auraEnd(PlayerState& player, AuraState& aura) {
    if (aura.kind == AuraKind::Eureka) player.updateEurekaCosts(false);
    if (aura.kind == AuraKind::Rend) {
        if (aura.stacks) aura.uptime += player.step - aura.starttimer;
    } else if (active(aura)) {
        aura.uptime += player.step - aura.starttimer;
    }
    aura.timer = 0;
    aura.stacks = 0;
    switch (aura.kind) {
    case AuraKind::Zeal:
        player.updateBonusDmg();
        break;
    case AuraKind::Zandalarian:
        player.updateBonusDmg();
        break;
    case AuraKind::Rend:
        player.updateDmgMod();
        break;
    case AuraKind::JujuFlurry:
        player.updateHasteDamage();
        break;
    default:
        break;
    }
}

void auraUse(PlayerState& player, AuraState& aura, bool prepull, int precounter) {
    if (aura.kind == AuraKind::SweepingStrikes) {
        if (!player.isValidStance("battle")) player.switchStance("battle");
        player.rage -= aura.props.number("cost"_prop);
        if (const double gcd = aura.props.number("gcd"_prop)) player.timer = gcd;
        aura.timer = durationMs(aura) ? player.step + durationMs(aura) : 1;
        aura.stacks = 5;
        aura.starttimer = player.step;
        aura.cooldownTimer = player.step + cooldownMs(aura);
        setDelay(player, aura);
        return;
    }
    const auto basic = [&] {
        begin(player, aura);
        player.updateAuras();
        setDelay(player, aura);
    };
    if (isAlwaysBase(aura.kind)) {
        basic();
        return;
    }

    switch (aura.kind) {
    case AuraKind::Recklessness:
        begin(player, aura);
        player.timer = 1500;
        if (!player.isValidStance("zerk")) player.switchStance("zerk");
        player.updateAuras();
        setDelay(player, aura);
        break;
    case AuraKind::Flurry:
        aura.timer = 1;
        if (!aura.stacks) {
            aura.starttimer = player.step;
            player.updateHaste();
        }
        aura.stacks = 3;
        break;
    case AuraKind::OldDeepWounds:
        accountRefresh(player, aura);
        aura.nexttick = player.step + 3000;
        aura.timer = player.step + durationMs(aura);
        aura.starttimer = player.step;
        break;
    case AuraKind::Crusader:
        useWithUpdate(player, aura, &PlayerState::updateStrength);
        break;
    case AuraKind::Cloudkeeper:
        useItem(player, aura, precounter, &PlayerState::updateAuras, true);
        break;
    case AuraKind::Felstriker:
        useWithUpdate(player, aura, &PlayerState::update);
        break;
    case AuraKind::DeathWish:
        begin(player, aura, precounter);
        player.rage -= aura.props.number("cost"_prop, 10);
        player.timer = 1500;
        player.updateDmgMod();
        setDelay(player, aura);
        break;
    case AuraKind::MightyRagePotion: {
        accountRefresh(player, aura);
        player.rage = std::min(player.rage + static_cast<double>(player.rng.integer(
            aura.props.number("value1"_prop), aura.props.number("value2"_prop))), player.prop("ragecap"_prop, 100));
        aura.timer = player.step + durationMs(aura) - precounter;
        aura.starttimer = player.step - precounter;
        player.updateStrength();
        setDelay(player, aura);
        break;
    }
    case AuraKind::Empyrean:
    case AuraKind::Eskhandar:
    case AuraKind::Pummeler:
        useWithUpdate(player, aura, &PlayerState::updateHaste);
        break;
    case AuraKind::ElunesLight:
        useWithUpdate(player, aura, &PlayerState::updateAuras, 0, true);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        break;
    case AuraKind::Eureka:
        aura.timer = 1;
        aura.stacks = 3;
        aura.starttimer = player.step;
        aura.cooldownTimer = player.step + cooldownMs(aura);
        player.updateEurekaCosts(true);
        setDelay(player, aura);
        break;
    case AuraKind::BloodFury:
        player.timer = 1500;
        useWithUpdate(player, aura, &PlayerState::updateAuras, precounter, true);
        break;
    case AuraKind::Berserking:
        begin(player, aura, precounter);
        player.rage -= 5;
        player.updateHaste();
        setDelay(player, aura);
        break;
    case AuraKind::Zeal:
        if (player.timer && player.timer < 1500) return;
        useWithUpdate(player, aura, &PlayerState::updateBonusDmg);
        break;
    case AuraKind::Annihilator:
        if (player.flag("faeriefire"_prop) ||
            player.rng.tenK() < player.target.props.number("binaryresist"_prop)) return;
        begin(player, aura);
        aura.stacks = std::min(aura.stacks + 1, 3);
        player.updateArmorReduction();
        break;
    case AuraKind::Rivenspike:
    case AuraKind::Bonereaver:
        if (aura.kind == AuraKind::Rivenspike && player.flag("faeriefire"_prop)) return;
        begin(player, aura);
        aura.stacks = std::min(aura.stacks + 1, 3);
        player.updateArmorReduction();
        break;
    case AuraKind::Windfury:
        begin(player, aura);
        aura.timer = player.step + 1500;
        aura.mintime = detail::jsRemainder(player.step, player.prop("batching"_prop, 1));
        aura.stacks = 2;
        player.updateAP();
        ++player.extraattacks;
        break;
    case AuraKind::Swarmguard:
        aura.timer = player.step + durationMs(aura) - precounter;
        aura.starttimer = player.step - precounter;
        aura.stacks = 0;
        break;
    case AuraKind::Flask:
        player.timer = 1500;
        useItem(player, aura, precounter, &PlayerState::updateAuras, true);
        break;
    case AuraKind::Slayer:
    case AuraKind::Earthstrike:
        useItem(player, aura, precounter, &PlayerState::updateAP);
        break;
    case AuraKind::Spider:
        useItem(player, aura, precounter, &PlayerState::updateHaste);
        break;
    case AuraKind::Gabbar:
        aura.stats.set("ap"_prop, aura.props.number("value"_prop));
        useItem(player, aura, precounter, &PlayerState::updateAP);
        break;
    case AuraKind::PrimalBlessing:
        if (aura.cooldownTimer > player.step) return;
        begin(player, aura);
        aura.cooldownTimer = player.step + cooldownMs(aura);
        player.updateAP();
        break;
    case AuraKind::BloodrageAura:
    case AuraKind::BerserkerRageAura:
        begin(player, aura);
        if (aura.kind == AuraKind::BloodrageAura) setDelay(player, aura);
        break;
    case AuraKind::Zandalarian:
        player.itemtimer = durationMs(aura) - precounter;
        begin(player, aura, precounter);
        aura.stats.set("moddmgdone"_prop, 40);
        player.updateBonusDmg();
        break;
    case AuraKind::BattleShout:
        begin(player, aura);
        if (!prepull) {
            player.rage -= aura.props.number("cost"_prop);
            player.timer = 1500;
        }
        player.updateAP();
        setDelay(player, aura);
        break;
    case AuraKind::Rend: {
        const Result result = player.rollMeleeAura(aura, player.mh);
        if (aura.data.size() < 5) aura.data.resize(5);
        ++aura.data[static_cast<std::size_t>(result)];
        if (result == Result::Miss) return;
        if (result == Result::Dodge) {
            player.dodgetimer = 5000;
            return;
        }
        accountRefresh(player, aura);
        aura.nexttick = player.step + 3000;
        aura.timer = player.step + durationMs(aura);
        player.timer = 1500;
        aura.starttimer = player.step;
        aura.stacks = aura.props.integer("value2"_prop);
        if (!player.isValidStance("def") && !player.isValidStance("battle")) {
            player.switchStance("battle");
        }
        player.rage -= aura.props.number("cost"_prop);
        double baseDamage = aura.props.number("value1"_prop);
        const double value2 = aura.props.number("value2"_prop);
        aura.props.set("tickdmg"_prop, baseDamage * player.stats.number("dmgmod"_prop, 1) *
            aura.props.number("dmgmod"_prop, 1) * player.prop("bleedmod"_prop, 1) * aura.props.number("eurekamod"_prop, 1) / value2);
        player.updateDmgMod();
        setDelay(player, aura);
        break;
    }
    case AuraKind::JujuFlurry:
        begin(player, aura, precounter);
        player.updateHasteDamage();
        player.updateHaste();
        break;
    case AuraKind::BattleStance:
    case AuraKind::DefensiveStance:
    case AuraKind::BerserkerStance:
        basic();
        break;
    default:
        basic();
        break;
    }
}

bool auraStep(PlayerState& player, AuraState& aura) {
    if (aura.kind == AuraKind::SweepingStrikes) {
        if (durationMs(aura) && aura.timer && player.step >= aura.timer) {
            expire(player, aura);
            aura.stacks = 0;
        }
        return aura.timer != 0;
    }
    if (aura.kind == AuraKind::Flurry || aura.kind == AuraKind::BattleStance ||
        aura.kind == AuraKind::DefensiveStance ||
        aura.kind == AuraKind::BerserkerStance) return true;

    switch (aura.kind) {
    case AuraKind::OldDeepWounds:
        while (player.step >= aura.nexttick) {
            const double min = player.mh.mindmg + player.mh.bonusdmg +
                player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * player.mh.speed;
            const double max = player.mh.maxdmg + player.mh.bonusdmg +
                player.stats.number("moddmgdone"_prop) + player.stats.number("ap"_prop) / 14.0 * player.mh.speed;
            double damage = (min + max) / 2.0 * player.mh.modifier *
                player.stats.number("dmgmod"_prop, 1) * player.talents.number("deepwounds"_prop) *
                player.prop("bleedmod"_prop, 1) / 4.0;
            // Forever bleed crits benefit from Impale without triggering crit procs.
            if (player.foreverMode && player.rng.tenK() <
                (player.crit + player.mh.crit + player.mh.props.number("racialcrit"_prop)) * 100)
                damage *= 1 + (1 + player.talents.number("abilitiescrit"_prop));
            aura.idmg += damage;
            aura.totaldmg += damage;
            aura.nexttick += 3000;
        }
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            return false;
        }
        return true;
    case AuraKind::Rend:
        while (player.step >= aura.nexttick && aura.stacks) {
            double damage = aura.props.number("tickdmg"_prop);
            // The application cannot crit; each tick rolls independently.
            if (player.foreverMode && player.rng.tenK() <
                (player.crit + player.mh.crit + player.mh.props.number("racialcrit"_prop)) * 100)
                damage *= 1 + (1 + player.talents.number("abilitiescrit"_prop));
            aura.idmg += damage;
            aura.totaldmg += damage;
            aura.nexttick += 3000;
            --aura.stacks;
            if (!aura.stacks) aura.uptime += player.step - aura.starttimer;
        }
        if (player.step >= aura.timer) {
            aura.timer = 0;
            aura.firstuse = false;
            player.updateDmgMod();
            return false;
        }
        return true;
    case AuraKind::Gabbar:
        if (detail::jsRemainder(player.step - aura.starttimer, 2000.0) == 0) {
            aura.stats.set("ap"_prop, aura.stats.number("ap"_prop) + aura.props.number("value"_prop));
            player.updateAP();
        }
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::BloodrageAura:
        if (detail::jsRemainder(player.step - aura.starttimer, 1000.0) == 0) {
            player.rage = std::min(player.rage + aura.props.number("tickrage"_prop, 1), player.prop("ragecap"_prop, 100));
        }
        if (player.step >= aura.timer) {
            expire(player, aura);
            return false;
        }
        return true;
    case AuraKind::Windfury:
        if (player.step >= aura.timer || !aura.stacks) {
            expire(player, aura, true);
            aura.stacks = 0;
            player.updateAP();
            return false;
        }
        return true;
    case AuraKind::Swarmguard:
        if (player.step >= aura.timer) {
            expire(player, aura);
            aura.stacks = 0;
            aura.firstuse = false;
            player.updateArmorReduction();
            return false;
        }
        return true;
    case AuraKind::Recklessness:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, false, true);
    case AuraKind::Crusader:
        return stepWithUpdate(player, aura, &PlayerState::updateStrength);
    case AuraKind::Felstriker:
        return stepWithUpdate(player, aura, &PlayerState::update, true);
    case AuraKind::DeathWish:
        return stepWithUpdate(player, aura, &PlayerState::updateDmgMod, false, true);
    case AuraKind::MightyRagePotion:
        return stepWithUpdate(player, aura, &PlayerState::updateStrength, true);
    case AuraKind::Eureka:
        return true;
    case AuraKind::ElunesLight:
    case AuraKind::BloodFury:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, true);
    case AuraKind::Berserking:
    case AuraKind::Empyrean:
    case AuraKind::Eskhandar:
    case AuraKind::Pummeler:
        return stepWithUpdate(player, aura, &PlayerState::updateHaste, true);
    case AuraKind::Zeal:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg, true);
    case AuraKind::Annihilator:
    case AuraKind::Rivenspike:
    case AuraKind::Bonereaver:
        if (player.step >= aura.timer) aura.stacks = 0;
        return stepWithUpdate(player, aura, &PlayerState::updateArmorReduction, true);
    case AuraKind::Slayer:
    case AuraKind::Earthstrike:
    case AuraKind::Spider:
        return stepWithUpdate(player, aura, &PlayerState::updateAuras, true);
    case AuraKind::Zandalarian:
        return stepWithUpdate(player, aura, &PlayerState::updateBonusDmg, true);
    case AuraKind::BerserkerRageAura:
        if (player.step >= aura.timer) {
            expire(player, aura);
            return false;
        }
        return true;
    case AuraKind::BattleShout:
        return stepWithUpdate(player, aura, &PlayerState::updateAP, true);
    case AuraKind::JujuFlurry:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            aura.useStep = aura.starttimer + cooldownMs(aura);
            player.updateHasteDamage();
            player.updateHaste();
            return false;
        }
        return true;
    default:
        if (player.step >= aura.timer) {
            expire(player, aura, true);
            player.updateAuras();
            return false;
        }
        return true;
    }
}

void auraProc(PlayerState& player, AuraState& aura) {
    switch (aura.kind) {
    case AuraKind::Flurry:
        --aura.stacks;
        if (!aura.stacks) {
            aura.uptime += player.step - aura.starttimer;
            aura.timer = 0;
            player.updateHaste();
        }
        break;
    case AuraKind::Windfury:
        if (aura.stacks < 2) {
            if (player.step < aura.mintime) aura.timer = aura.mintime;
            else (void)auraStep(player, aura);
            aura.stacks = 0;
        } else {
            --aura.stacks;
        }
        break;
    case AuraKind::Swarmguard:
        aura.stacks = std::min(aura.stacks + 1, 6);
        player.updateArmorReduction();
        break;
    case AuraKind::Zandalarian:
        aura.stats.set("moddmgdone"_prop, aura.stats.number("moddmgdone"_prop) - 2);
        player.updateBonusDmg();
        if (aura.stats.number("moddmgdone"_prop) <= 0) {
            aura.timer = player.step;
            (void)auraStep(player, aura);
        }
        break;
    default:
        break;
    }
}

} // namespace warriorsim
