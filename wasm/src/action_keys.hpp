#pragma once

// Regenerate counts and indices with node scripts/generate-native-keys.js.
#include <array>
#include <cstdint>
#include <string_view>

namespace warriorsim::detail {

inline constexpr std::size_t kActionKeyCount = 55;
inline constexpr std::array<std::string_view, kActionKeyCount> kActionKeyNames = {
    "annihilator",
    "battleshout",
    "battlestance",
    "berserkerrage",
    "berserkerstance",
    "berserking",
    "bloodfury",
    "bloodrage",
    "bloodthirst",
    "bonereaver",
    "cleave",
    "cloudkeeper",
    "deathwish",
    "deepwounds",
    "deepwounds2",
    "deepwounds3",
    "deepwounds4",
    "defensivestance",
    "earthstrike",
    "eluneslight",
    "empyrean",
    "enrage",
    "eskhandar",
    "eureka",
    "execute",
    "fireball",
    "flask",
    "flurry",
    "gabbar",
    "grilekfury",
    "hamstring",
    "heroicstrike",
    "jujuflurry",
    "mightyragepotion",
    "mortalstrike",
    "overpower",
    "pummeler",
    "ragepotion",
    "recklessness",
    "rend",
    "rivenspike",
    "shieldslam",
    "slam",
    "slayer",
    "spearingstrike",
    "spider",
    "stanceswitch",
    "sunderarmor",
    "swarmguard",
    "sweepingstrikes",
    "thunderclap",
    "touchofthegrave",
    "whirlwind",
    "zandalarian",
    "zeal",
};

constexpr std::uint64_t actionKeyHash(std::string_view value) {
    std::uint64_t result = 0xcbf29ce484222325ull;
    for (const unsigned char c : value) { result ^= c; result *= 0x100000001b3ull; }
    return result;
}

constexpr int actionKeyIndex(std::string_view value) {
    switch (actionKeyHash(value)) {
    case actionKeyHash("annihilator"): return value == "annihilator" ? 0 : -1;
    case actionKeyHash("battleshout"): return value == "battleshout" ? 1 : -1;
    case actionKeyHash("battlestance"): return value == "battlestance" ? 2 : -1;
    case actionKeyHash("berserkerrage"): return value == "berserkerrage" ? 3 : -1;
    case actionKeyHash("berserkerstance"): return value == "berserkerstance" ? 4 : -1;
    case actionKeyHash("berserking"): return value == "berserking" ? 5 : -1;
    case actionKeyHash("bloodfury"): return value == "bloodfury" ? 6 : -1;
    case actionKeyHash("bloodrage"): return value == "bloodrage" ? 7 : -1;
    case actionKeyHash("bloodthirst"): return value == "bloodthirst" ? 8 : -1;
    case actionKeyHash("bonereaver"): return value == "bonereaver" ? 9 : -1;
    case actionKeyHash("cleave"): return value == "cleave" ? 10 : -1;
    case actionKeyHash("cloudkeeper"): return value == "cloudkeeper" ? 11 : -1;
    case actionKeyHash("deathwish"): return value == "deathwish" ? 12 : -1;
    case actionKeyHash("deepwounds"): return value == "deepwounds" ? 13 : -1;
    case actionKeyHash("deepwounds2"): return value == "deepwounds2" ? 14 : -1;
    case actionKeyHash("deepwounds3"): return value == "deepwounds3" ? 15 : -1;
    case actionKeyHash("deepwounds4"): return value == "deepwounds4" ? 16 : -1;
    case actionKeyHash("defensivestance"): return value == "defensivestance" ? 17 : -1;
    case actionKeyHash("earthstrike"): return value == "earthstrike" ? 18 : -1;
    case actionKeyHash("eluneslight"): return value == "eluneslight" ? 19 : -1;
    case actionKeyHash("empyrean"): return value == "empyrean" ? 20 : -1;
    case actionKeyHash("enrage"): return value == "enrage" ? 21 : -1;
    case actionKeyHash("eskhandar"): return value == "eskhandar" ? 22 : -1;
    case actionKeyHash("eureka"): return value == "eureka" ? 23 : -1;
    case actionKeyHash("execute"): return value == "execute" ? 24 : -1;
    case actionKeyHash("fireball"): return value == "fireball" ? 25 : -1;
    case actionKeyHash("flask"): return value == "flask" ? 26 : -1;
    case actionKeyHash("flurry"): return value == "flurry" ? 27 : -1;
    case actionKeyHash("gabbar"): return value == "gabbar" ? 28 : -1;
    case actionKeyHash("grilekfury"): return value == "grilekfury" ? 29 : -1;
    case actionKeyHash("hamstring"): return value == "hamstring" ? 30 : -1;
    case actionKeyHash("heroicstrike"): return value == "heroicstrike" ? 31 : -1;
    case actionKeyHash("jujuflurry"): return value == "jujuflurry" ? 32 : -1;
    case actionKeyHash("mightyragepotion"): return value == "mightyragepotion" ? 33 : -1;
    case actionKeyHash("mortalstrike"): return value == "mortalstrike" ? 34 : -1;
    case actionKeyHash("overpower"): return value == "overpower" ? 35 : -1;
    case actionKeyHash("pummeler"): return value == "pummeler" ? 36 : -1;
    case actionKeyHash("ragepotion"): return value == "ragepotion" ? 37 : -1;
    case actionKeyHash("recklessness"): return value == "recklessness" ? 38 : -1;
    case actionKeyHash("rend"): return value == "rend" ? 39 : -1;
    case actionKeyHash("rivenspike"): return value == "rivenspike" ? 40 : -1;
    case actionKeyHash("shieldslam"): return value == "shieldslam" ? 41 : -1;
    case actionKeyHash("slam"): return value == "slam" ? 42 : -1;
    case actionKeyHash("slayer"): return value == "slayer" ? 43 : -1;
    case actionKeyHash("spearingstrike"): return value == "spearingstrike" ? 44 : -1;
    case actionKeyHash("spider"): return value == "spider" ? 45 : -1;
    case actionKeyHash("stanceswitch"): return value == "stanceswitch" ? 46 : -1;
    case actionKeyHash("sunderarmor"): return value == "sunderarmor" ? 47 : -1;
    case actionKeyHash("swarmguard"): return value == "swarmguard" ? 48 : -1;
    case actionKeyHash("sweepingstrikes"): return value == "sweepingstrikes" ? 49 : -1;
    case actionKeyHash("thunderclap"): return value == "thunderclap" ? 50 : -1;
    case actionKeyHash("touchofthegrave"): return value == "touchofthegrave" ? 51 : -1;
    case actionKeyHash("whirlwind"): return value == "whirlwind" ? 52 : -1;
    case actionKeyHash("zandalarian"): return value == "zandalarian" ? 53 : -1;
    case actionKeyHash("zeal"): return value == "zeal" ? 54 : -1;
    default: return -1;
    }
}

static_assert([] {
    for (std::size_t i = 0; i < kActionKeyNames.size(); ++i)
        if (actionKeyIndex(kActionKeyNames[i]) != static_cast<int>(i)) return false;
    return true;
}(), "action key indices must match array positions");

struct KnownAction {
    int index;
    explicit constexpr KnownAction(std::string_view value) : index(actionKeyIndex(value)) {}
    template<std::size_t N>
    explicit consteval KnownAction(const char (&value)[N]) : index(actionKeyIndex(std::string_view(value, N - 1))) {
        if (index < 0) throw "unknown native simulation action";
    }
};

} // namespace warriorsim::detail

namespace warriorsim {

consteval detail::KnownAction operator""_action(const char* value, std::size_t size) {
    const auto key = detail::KnownAction{std::string_view(value, size)};
    if (key.index < 0) throw "unknown native simulation action";
    return key;
}

} // namespace warriorsim
