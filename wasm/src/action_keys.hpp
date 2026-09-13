#pragma once

// Regenerate counts and indices with node scripts/generate-native-keys.js.
#include <array>
#include <cstdint>
#include <string_view>

namespace warriorsim::detail {

inline constexpr std::size_t kActionKeyCount = 74;
inline constexpr std::array<std::string_view, kActionKeyCount> kActionKeyNames = {
    "annihilator",
    "battleshout",
    "battlestance",
    "berserkerrage",
    "berserkerstance",
    "berserking",
    "blademasterfury",
    "bloodfury",
    "bloodrage",
    "bloodthirst",
    "bonereaver",
    "cleave",
    "cloudkeeper",
    "coinflip",
    "consumedrage",
    "deathwish",
    "deepwounds",
    "deepwounds2",
    "deepwounds3",
    "deepwounds4",
    "defensivestance",
    "demontaintedblood",
    "earthstrike",
    "empyrean",
    "enrage",
    "eskhandar",
    "execute",
    "fireball",
    "flask",
    "flurry",
    "gabbar",
    "gneurological",
    "grilekfury",
    "grilekguard",
    "gunaxe",
    "gyromaticacceleration",
    "hamstring",
    "heroicstrike",
    "jujuflurry",
    "magmadarsreturn",
    "mightyragepotion",
    "moonstalkerfury",
    "mortalstrike",
    "obsidianhaste",
    "obsidianstrength",
    "overpower",
    "pummeler",
    "ragepotion",
    "recklessness",
    "relentlessstrength",
    "rend",
    "rivenspike",
    "roarguardian",
    "shieldslam",
    "singleminded",
    "slam",
    "slayer",
    "spearingstrike",
    "spider",
    "stanceswitch",
    "sunderarmor",
    "swarmguard",
    "sweepingstrikes",
    "themoltencore",
    "thunderclap",
    "victoryrush",
    "voidmadness",
    "voodoofrenzy",
    "weaponbleedmh",
    "weaponbleedoh",
    "whirlwind",
    "wrathwray",
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
    case actionKeyHash("blademasterfury"): return value == "blademasterfury" ? 6 : -1;
    case actionKeyHash("bloodfury"): return value == "bloodfury" ? 7 : -1;
    case actionKeyHash("bloodrage"): return value == "bloodrage" ? 8 : -1;
    case actionKeyHash("bloodthirst"): return value == "bloodthirst" ? 9 : -1;
    case actionKeyHash("bonereaver"): return value == "bonereaver" ? 10 : -1;
    case actionKeyHash("cleave"): return value == "cleave" ? 11 : -1;
    case actionKeyHash("cloudkeeper"): return value == "cloudkeeper" ? 12 : -1;
    case actionKeyHash("coinflip"): return value == "coinflip" ? 13 : -1;
    case actionKeyHash("consumedrage"): return value == "consumedrage" ? 14 : -1;
    case actionKeyHash("deathwish"): return value == "deathwish" ? 15 : -1;
    case actionKeyHash("deepwounds"): return value == "deepwounds" ? 16 : -1;
    case actionKeyHash("deepwounds2"): return value == "deepwounds2" ? 17 : -1;
    case actionKeyHash("deepwounds3"): return value == "deepwounds3" ? 18 : -1;
    case actionKeyHash("deepwounds4"): return value == "deepwounds4" ? 19 : -1;
    case actionKeyHash("defensivestance"): return value == "defensivestance" ? 20 : -1;
    case actionKeyHash("demontaintedblood"): return value == "demontaintedblood" ? 21 : -1;
    case actionKeyHash("earthstrike"): return value == "earthstrike" ? 22 : -1;
    case actionKeyHash("empyrean"): return value == "empyrean" ? 23 : -1;
    case actionKeyHash("enrage"): return value == "enrage" ? 24 : -1;
    case actionKeyHash("eskhandar"): return value == "eskhandar" ? 25 : -1;
    case actionKeyHash("execute"): return value == "execute" ? 26 : -1;
    case actionKeyHash("fireball"): return value == "fireball" ? 27 : -1;
    case actionKeyHash("flask"): return value == "flask" ? 28 : -1;
    case actionKeyHash("flurry"): return value == "flurry" ? 29 : -1;
    case actionKeyHash("gabbar"): return value == "gabbar" ? 30 : -1;
    case actionKeyHash("gneurological"): return value == "gneurological" ? 31 : -1;
    case actionKeyHash("grilekfury"): return value == "grilekfury" ? 32 : -1;
    case actionKeyHash("grilekguard"): return value == "grilekguard" ? 33 : -1;
    case actionKeyHash("gunaxe"): return value == "gunaxe" ? 34 : -1;
    case actionKeyHash("gyromaticacceleration"): return value == "gyromaticacceleration" ? 35 : -1;
    case actionKeyHash("hamstring"): return value == "hamstring" ? 36 : -1;
    case actionKeyHash("heroicstrike"): return value == "heroicstrike" ? 37 : -1;
    case actionKeyHash("jujuflurry"): return value == "jujuflurry" ? 38 : -1;
    case actionKeyHash("magmadarsreturn"): return value == "magmadarsreturn" ? 39 : -1;
    case actionKeyHash("mightyragepotion"): return value == "mightyragepotion" ? 40 : -1;
    case actionKeyHash("moonstalkerfury"): return value == "moonstalkerfury" ? 41 : -1;
    case actionKeyHash("mortalstrike"): return value == "mortalstrike" ? 42 : -1;
    case actionKeyHash("obsidianhaste"): return value == "obsidianhaste" ? 43 : -1;
    case actionKeyHash("obsidianstrength"): return value == "obsidianstrength" ? 44 : -1;
    case actionKeyHash("overpower"): return value == "overpower" ? 45 : -1;
    case actionKeyHash("pummeler"): return value == "pummeler" ? 46 : -1;
    case actionKeyHash("ragepotion"): return value == "ragepotion" ? 47 : -1;
    case actionKeyHash("recklessness"): return value == "recklessness" ? 48 : -1;
    case actionKeyHash("relentlessstrength"): return value == "relentlessstrength" ? 49 : -1;
    case actionKeyHash("rend"): return value == "rend" ? 50 : -1;
    case actionKeyHash("rivenspike"): return value == "rivenspike" ? 51 : -1;
    case actionKeyHash("roarguardian"): return value == "roarguardian" ? 52 : -1;
    case actionKeyHash("shieldslam"): return value == "shieldslam" ? 53 : -1;
    case actionKeyHash("singleminded"): return value == "singleminded" ? 54 : -1;
    case actionKeyHash("slam"): return value == "slam" ? 55 : -1;
    case actionKeyHash("slayer"): return value == "slayer" ? 56 : -1;
    case actionKeyHash("spearingstrike"): return value == "spearingstrike" ? 57 : -1;
    case actionKeyHash("spider"): return value == "spider" ? 58 : -1;
    case actionKeyHash("stanceswitch"): return value == "stanceswitch" ? 59 : -1;
    case actionKeyHash("sunderarmor"): return value == "sunderarmor" ? 60 : -1;
    case actionKeyHash("swarmguard"): return value == "swarmguard" ? 61 : -1;
    case actionKeyHash("sweepingstrikes"): return value == "sweepingstrikes" ? 62 : -1;
    case actionKeyHash("themoltencore"): return value == "themoltencore" ? 63 : -1;
    case actionKeyHash("thunderclap"): return value == "thunderclap" ? 64 : -1;
    case actionKeyHash("victoryrush"): return value == "victoryrush" ? 65 : -1;
    case actionKeyHash("voidmadness"): return value == "voidmadness" ? 66 : -1;
    case actionKeyHash("voodoofrenzy"): return value == "voodoofrenzy" ? 67 : -1;
    case actionKeyHash("weaponbleedmh"): return value == "weaponbleedmh" ? 68 : -1;
    case actionKeyHash("weaponbleedoh"): return value == "weaponbleedoh" ? 69 : -1;
    case actionKeyHash("whirlwind"): return value == "whirlwind" ? 70 : -1;
    case actionKeyHash("wrathwray"): return value == "wrathwray" ? 71 : -1;
    case actionKeyHash("zandalarian"): return value == "zandalarian" ? 72 : -1;
    case actionKeyHash("zeal"): return value == "zeal" ? 73 : -1;
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
