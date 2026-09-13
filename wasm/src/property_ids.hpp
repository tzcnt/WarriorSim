#pragma once

// Edit the name array, then run node scripts/generate-native-keys.js.
// Keep dynamically accessed properties such as the live weapon skill slots.
#include <array>
#include <cstdint>
#include <string_view>

namespace warriorsim::detail {

inline constexpr std::size_t kDensePropertyCount = 171;
inline constexpr std::array<std::string_view, kDensePropertyCount> kDensePropertyNames = {
    "abilitiescrit",
    "adjacent",
    "agi",
    "agimod",
    "agipercrit",
    "altdreadnaughtfourset",
    "altdreadnaughttwoset",
    "altmightthreeset",
    "alwaysheads",
    "alwaystails",
    "angermanagement",
    "ap",
    "apmod",
    "aprace",
    "armor",
    "armorReduction",
    "arp",
    "arpContribution",
    "baseapmod",
    "basearmor",
    "basearmorbuffed",
    "basebonusdmg",
    "basemaxdmg",
    "basemindmg",
    "basestance",
    "batching",
    "binaryresist",
    "binaryspell",
    "bleedbonus",
    "bleedmod",
    "block",
    "bonus",
    "bonusdmg",
    "canDodge",
    "castspeed",
    "casttime",
    "chance",
    "chargeblock",
    "coeff",
    "cooldown",
    "cost",
    "crit",
    "critdmgbonus",
    "dataLength",
    "deepwounds",
    "defense",
    "defenseType",
    "dmg",
    "dmgmod",
    "dodge",
    "dragonbreath",
    "dumpmod",
    "duration",
    "enrage",
    "exmacro",
    "expertise",
    "exposed",
    "extra",
    "extracritrage",
    "extrarage",
    "faeriefire",
    "gcd",
    "globals",
    "hakkariextra",
    "haste",
    "heroicbonus",
    "hit",
    "homunculi",
    "id",
    "impslam",
    "interval",
    "item",
    "level",
    "macearp",
    "magicdmg",
    "maincd",
    "mainspelldmg",
    "maxdelay",
    "maxdmg",
    "maxrage",
    "mhthreshold",
    "mindmg",
    "minrage",
    "misschance",
    "mitigation",
    "moddmgdone",
    "moddmgtaken",
    "mode",
    "modifier",
    "name",
    "nocrit",
    "noitemcd",
    "normSpeed",
    "offensive",
    "offhand",
    "offhit",
    "overpowercrit",
    "overpowerrend",
    "phantom",
    "physdmg",
    "procblock",
    "rage",
    "rageblock",
    "ragecap",
    "rageconversion",
    "ragemod",
    "rageretained",
    "reactionmax",
    "reactionmin",
    "refund",
    "school",
    "shield",
    "skill_",
    "skill_0",
    "skill_1",
    "skill_10",
    "skill_11",
    "skill_13",
    "skill_2",
    "skill_20",
    "skill_21",
    "skill_23",
    "skill_3",
    "skill_4",
    "skill_5",
    "skill_6",
    "skill_7",
    "slammainreset",
    "speed",
    "spellcrit",
    "spelldamage",
    "spelldmgmod",
    "spellqueueing",
    "stance",
    "str",
    "strmod",
    "swingtimer",
    "swordboard",
    "swordproc",
    "tickdmg",
    "timer",
    "timetoend",
    "timetostart",
    "timeworn",
    "twohand",
    "type",
    "umbridledwrath",
    "unqueue",
    "unqueuetimer",
    "useonly",
    "usestep",
    "vaelbuff",
    "value",
    "value1",
    "value2",
    "wailingextra",
    "weaponspell",
    "zerkerpriority",
    "afterswing",
    "dodgetimeworn",
    "apcoefficient",
    "blockcoefficient",
    "bloodthrill",
    "creaturetype",
    "flatbonus",
    "mounted",
    "offragebonus",
    "ragingblows",
    "swingmode",
    "tickrage",
    "weaponmasterarp",
};

constexpr std::uint64_t propertyHash(std::string_view value) {
    std::uint64_t result = 0xcbf29ce484222325ull;
    for (const unsigned char c : value) { result ^= c; result *= 0x100000001b3ull; }
    return result;
}

constexpr int propertyIndex(std::string_view value) {
    switch (propertyHash(value)) {
    case propertyHash("abilitiescrit"): return value == "abilitiescrit" ? 0 : -1;
    case propertyHash("adjacent"): return value == "adjacent" ? 1 : -1;
    case propertyHash("agi"): return value == "agi" ? 2 : -1;
    case propertyHash("agimod"): return value == "agimod" ? 3 : -1;
    case propertyHash("agipercrit"): return value == "agipercrit" ? 4 : -1;
    case propertyHash("altdreadnaughtfourset"): return value == "altdreadnaughtfourset" ? 5 : -1;
    case propertyHash("altdreadnaughttwoset"): return value == "altdreadnaughttwoset" ? 6 : -1;
    case propertyHash("altmightthreeset"): return value == "altmightthreeset" ? 7 : -1;
    case propertyHash("alwaysheads"): return value == "alwaysheads" ? 8 : -1;
    case propertyHash("alwaystails"): return value == "alwaystails" ? 9 : -1;
    case propertyHash("angermanagement"): return value == "angermanagement" ? 10 : -1;
    case propertyHash("ap"): return value == "ap" ? 11 : -1;
    case propertyHash("apmod"): return value == "apmod" ? 12 : -1;
    case propertyHash("aprace"): return value == "aprace" ? 13 : -1;
    case propertyHash("armor"): return value == "armor" ? 14 : -1;
    case propertyHash("armorReduction"): return value == "armorReduction" ? 15 : -1;
    case propertyHash("arp"): return value == "arp" ? 16 : -1;
    case propertyHash("arpContribution"): return value == "arpContribution" ? 17 : -1;
    case propertyHash("baseapmod"): return value == "baseapmod" ? 18 : -1;
    case propertyHash("basearmor"): return value == "basearmor" ? 19 : -1;
    case propertyHash("basearmorbuffed"): return value == "basearmorbuffed" ? 20 : -1;
    case propertyHash("basebonusdmg"): return value == "basebonusdmg" ? 21 : -1;
    case propertyHash("basemaxdmg"): return value == "basemaxdmg" ? 22 : -1;
    case propertyHash("basemindmg"): return value == "basemindmg" ? 23 : -1;
    case propertyHash("basestance"): return value == "basestance" ? 24 : -1;
    case propertyHash("batching"): return value == "batching" ? 25 : -1;
    case propertyHash("binaryresist"): return value == "binaryresist" ? 26 : -1;
    case propertyHash("binaryspell"): return value == "binaryspell" ? 27 : -1;
    case propertyHash("bleedbonus"): return value == "bleedbonus" ? 28 : -1;
    case propertyHash("bleedmod"): return value == "bleedmod" ? 29 : -1;
    case propertyHash("block"): return value == "block" ? 30 : -1;
    case propertyHash("bonus"): return value == "bonus" ? 31 : -1;
    case propertyHash("bonusdmg"): return value == "bonusdmg" ? 32 : -1;
    case propertyHash("canDodge"): return value == "canDodge" ? 33 : -1;
    case propertyHash("castspeed"): return value == "castspeed" ? 34 : -1;
    case propertyHash("casttime"): return value == "casttime" ? 35 : -1;
    case propertyHash("chance"): return value == "chance" ? 36 : -1;
    case propertyHash("chargeblock"): return value == "chargeblock" ? 37 : -1;
    case propertyHash("coeff"): return value == "coeff" ? 38 : -1;
    case propertyHash("cooldown"): return value == "cooldown" ? 39 : -1;
    case propertyHash("cost"): return value == "cost" ? 40 : -1;
    case propertyHash("crit"): return value == "crit" ? 41 : -1;
    case propertyHash("critdmgbonus"): return value == "critdmgbonus" ? 42 : -1;
    case propertyHash("dataLength"): return value == "dataLength" ? 43 : -1;
    case propertyHash("deepwounds"): return value == "deepwounds" ? 44 : -1;
    case propertyHash("defense"): return value == "defense" ? 45 : -1;
    case propertyHash("defenseType"): return value == "defenseType" ? 46 : -1;
    case propertyHash("dmg"): return value == "dmg" ? 47 : -1;
    case propertyHash("dmgmod"): return value == "dmgmod" ? 48 : -1;
    case propertyHash("dodge"): return value == "dodge" ? 49 : -1;
    case propertyHash("dragonbreath"): return value == "dragonbreath" ? 50 : -1;
    case propertyHash("dumpmod"): return value == "dumpmod" ? 51 : -1;
    case propertyHash("duration"): return value == "duration" ? 52 : -1;
    case propertyHash("enrage"): return value == "enrage" ? 53 : -1;
    case propertyHash("exmacro"): return value == "exmacro" ? 54 : -1;
    case propertyHash("expertise"): return value == "expertise" ? 55 : -1;
    case propertyHash("exposed"): return value == "exposed" ? 56 : -1;
    case propertyHash("extra"): return value == "extra" ? 57 : -1;
    case propertyHash("extracritrage"): return value == "extracritrage" ? 58 : -1;
    case propertyHash("extrarage"): return value == "extrarage" ? 59 : -1;
    case propertyHash("faeriefire"): return value == "faeriefire" ? 60 : -1;
    case propertyHash("gcd"): return value == "gcd" ? 61 : -1;
    case propertyHash("globals"): return value == "globals" ? 62 : -1;
    case propertyHash("hakkariextra"): return value == "hakkariextra" ? 63 : -1;
    case propertyHash("haste"): return value == "haste" ? 64 : -1;
    case propertyHash("heroicbonus"): return value == "heroicbonus" ? 65 : -1;
    case propertyHash("hit"): return value == "hit" ? 66 : -1;
    case propertyHash("homunculi"): return value == "homunculi" ? 67 : -1;
    case propertyHash("id"): return value == "id" ? 68 : -1;
    case propertyHash("impslam"): return value == "impslam" ? 69 : -1;
    case propertyHash("interval"): return value == "interval" ? 70 : -1;
    case propertyHash("item"): return value == "item" ? 71 : -1;
    case propertyHash("level"): return value == "level" ? 72 : -1;
    case propertyHash("macearp"): return value == "macearp" ? 73 : -1;
    case propertyHash("magicdmg"): return value == "magicdmg" ? 74 : -1;
    case propertyHash("maincd"): return value == "maincd" ? 75 : -1;
    case propertyHash("mainspelldmg"): return value == "mainspelldmg" ? 76 : -1;
    case propertyHash("maxdelay"): return value == "maxdelay" ? 77 : -1;
    case propertyHash("maxdmg"): return value == "maxdmg" ? 78 : -1;
    case propertyHash("maxrage"): return value == "maxrage" ? 79 : -1;
    case propertyHash("mhthreshold"): return value == "mhthreshold" ? 80 : -1;
    case propertyHash("mindmg"): return value == "mindmg" ? 81 : -1;
    case propertyHash("minrage"): return value == "minrage" ? 82 : -1;
    case propertyHash("misschance"): return value == "misschance" ? 83 : -1;
    case propertyHash("mitigation"): return value == "mitigation" ? 84 : -1;
    case propertyHash("moddmgdone"): return value == "moddmgdone" ? 85 : -1;
    case propertyHash("moddmgtaken"): return value == "moddmgtaken" ? 86 : -1;
    case propertyHash("mode"): return value == "mode" ? 87 : -1;
    case propertyHash("modifier"): return value == "modifier" ? 88 : -1;
    case propertyHash("name"): return value == "name" ? 89 : -1;
    case propertyHash("nocrit"): return value == "nocrit" ? 90 : -1;
    case propertyHash("noitemcd"): return value == "noitemcd" ? 91 : -1;
    case propertyHash("normSpeed"): return value == "normSpeed" ? 92 : -1;
    case propertyHash("offensive"): return value == "offensive" ? 93 : -1;
    case propertyHash("offhand"): return value == "offhand" ? 94 : -1;
    case propertyHash("offhit"): return value == "offhit" ? 95 : -1;
    case propertyHash("overpowercrit"): return value == "overpowercrit" ? 96 : -1;
    case propertyHash("overpowerrend"): return value == "overpowerrend" ? 97 : -1;
    case propertyHash("phantom"): return value == "phantom" ? 98 : -1;
    case propertyHash("physdmg"): return value == "physdmg" ? 99 : -1;
    case propertyHash("procblock"): return value == "procblock" ? 100 : -1;
    case propertyHash("rage"): return value == "rage" ? 101 : -1;
    case propertyHash("rageblock"): return value == "rageblock" ? 102 : -1;
    case propertyHash("ragecap"): return value == "ragecap" ? 103 : -1;
    case propertyHash("rageconversion"): return value == "rageconversion" ? 104 : -1;
    case propertyHash("ragemod"): return value == "ragemod" ? 105 : -1;
    case propertyHash("rageretained"): return value == "rageretained" ? 106 : -1;
    case propertyHash("reactionmax"): return value == "reactionmax" ? 107 : -1;
    case propertyHash("reactionmin"): return value == "reactionmin" ? 108 : -1;
    case propertyHash("refund"): return value == "refund" ? 109 : -1;
    case propertyHash("school"): return value == "school" ? 110 : -1;
    case propertyHash("shield"): return value == "shield" ? 111 : -1;
    case propertyHash("skill_"): return value == "skill_" ? 112 : -1;
    case propertyHash("skill_0"): return value == "skill_0" ? 113 : -1;
    case propertyHash("skill_1"): return value == "skill_1" ? 114 : -1;
    case propertyHash("skill_10"): return value == "skill_10" ? 115 : -1;
    case propertyHash("skill_11"): return value == "skill_11" ? 116 : -1;
    case propertyHash("skill_13"): return value == "skill_13" ? 117 : -1;
    case propertyHash("skill_2"): return value == "skill_2" ? 118 : -1;
    case propertyHash("skill_20"): return value == "skill_20" ? 119 : -1;
    case propertyHash("skill_21"): return value == "skill_21" ? 120 : -1;
    case propertyHash("skill_23"): return value == "skill_23" ? 121 : -1;
    case propertyHash("skill_3"): return value == "skill_3" ? 122 : -1;
    case propertyHash("skill_4"): return value == "skill_4" ? 123 : -1;
    case propertyHash("skill_5"): return value == "skill_5" ? 124 : -1;
    case propertyHash("skill_6"): return value == "skill_6" ? 125 : -1;
    case propertyHash("skill_7"): return value == "skill_7" ? 126 : -1;
    case propertyHash("slammainreset"): return value == "slammainreset" ? 127 : -1;
    case propertyHash("speed"): return value == "speed" ? 128 : -1;
    case propertyHash("spellcrit"): return value == "spellcrit" ? 129 : -1;
    case propertyHash("spelldamage"): return value == "spelldamage" ? 130 : -1;
    case propertyHash("spelldmgmod"): return value == "spelldmgmod" ? 131 : -1;
    case propertyHash("spellqueueing"): return value == "spellqueueing" ? 132 : -1;
    case propertyHash("stance"): return value == "stance" ? 133 : -1;
    case propertyHash("str"): return value == "str" ? 134 : -1;
    case propertyHash("strmod"): return value == "strmod" ? 135 : -1;
    case propertyHash("swingtimer"): return value == "swingtimer" ? 136 : -1;
    case propertyHash("swordboard"): return value == "swordboard" ? 137 : -1;
    case propertyHash("swordproc"): return value == "swordproc" ? 138 : -1;
    case propertyHash("tickdmg"): return value == "tickdmg" ? 139 : -1;
    case propertyHash("timer"): return value == "timer" ? 140 : -1;
    case propertyHash("timetoend"): return value == "timetoend" ? 141 : -1;
    case propertyHash("timetostart"): return value == "timetostart" ? 142 : -1;
    case propertyHash("timeworn"): return value == "timeworn" ? 143 : -1;
    case propertyHash("twohand"): return value == "twohand" ? 144 : -1;
    case propertyHash("type"): return value == "type" ? 145 : -1;
    case propertyHash("umbridledwrath"): return value == "umbridledwrath" ? 146 : -1;
    case propertyHash("unqueue"): return value == "unqueue" ? 147 : -1;
    case propertyHash("unqueuetimer"): return value == "unqueuetimer" ? 148 : -1;
    case propertyHash("useonly"): return value == "useonly" ? 149 : -1;
    case propertyHash("usestep"): return value == "usestep" ? 150 : -1;
    case propertyHash("vaelbuff"): return value == "vaelbuff" ? 151 : -1;
    case propertyHash("value"): return value == "value" ? 152 : -1;
    case propertyHash("value1"): return value == "value1" ? 153 : -1;
    case propertyHash("value2"): return value == "value2" ? 154 : -1;
    case propertyHash("wailingextra"): return value == "wailingextra" ? 155 : -1;
    case propertyHash("weaponspell"): return value == "weaponspell" ? 156 : -1;
    case propertyHash("zerkerpriority"): return value == "zerkerpriority" ? 157 : -1;
    case propertyHash("afterswing"): return value == "afterswing" ? 158 : -1;
    case propertyHash("dodgetimeworn"): return value == "dodgetimeworn" ? 159 : -1;
    case propertyHash("apcoefficient"): return value == "apcoefficient" ? 160 : -1;
    case propertyHash("blockcoefficient"): return value == "blockcoefficient" ? 161 : -1;
    case propertyHash("bloodthrill"): return value == "bloodthrill" ? 162 : -1;
    case propertyHash("creaturetype"): return value == "creaturetype" ? 163 : -1;
    case propertyHash("flatbonus"): return value == "flatbonus" ? 164 : -1;
    case propertyHash("mounted"): return value == "mounted" ? 165 : -1;
    case propertyHash("offragebonus"): return value == "offragebonus" ? 166 : -1;
    case propertyHash("ragingblows"): return value == "ragingblows" ? 167 : -1;
    case propertyHash("swingmode"): return value == "swingmode" ? 168 : -1;
    case propertyHash("tickrage"): return value == "tickrage" ? 169 : -1;
    case propertyHash("weaponmasterarp"): return value == "weaponmasterarp" ? 170 : -1;
    default: return -1;
    }
}

static_assert([] {
    for (std::size_t i = 0; i < kDensePropertyNames.size(); ++i)
        if (propertyIndex(kDensePropertyNames[i]) != static_cast<int>(i)) return false;
    return true;
}(), "property indices must match array positions");

struct KnownProperty {
    int index;
    template<std::size_t N>
    explicit consteval KnownProperty(const char (&value)[N])
        : index(propertyIndex(std::string_view(value, N - 1))) {
        if (index < 0) throw "unknown native simulation property";
    }
    constexpr explicit KnownProperty(int value) : index(value) {}
};

} // namespace warriorsim::detail

namespace warriorsim {

// A literal property name is resolved by the compiler.  Keeping the slot in a
// distinct type makes it impossible for a hot-path accessor to fall back to a
// runtime string hash/compare by accident.
consteval detail::KnownProperty operator""_prop(const char* value, std::size_t size) {
    const int index = detail::propertyIndex(std::string_view(value, size));
    if (index < 0) throw "unknown native simulation property";
    return detail::KnownProperty{index};
}

} // namespace warriorsim
