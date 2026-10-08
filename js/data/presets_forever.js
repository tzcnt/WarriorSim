// Permanent profile snapshots, independent of saved profiles and future default changes.
// Talents since the October 2026 rework: data/forever/README.md#october-2026-presets.
// Earlier talents: data/forever/dual-wield-talents-result.json. Abilities: data/forever/DUAL_WIELD_ABILITIES.md.
// Two-handed Fury: data/forever/TWO_HANDED_FURY.md.
// Two-handed Arms: data/forever/TWO_HANDED_ARMS.md.
var profilePresets = [
    {
        "id": "forever-dual-wield-fury",
        "description": "DW Fury P1 - Level 60 Night Elf",
        "profile": {
            "level": "60",
            "race": "Night Elf",
            "simulations": "100000",
            "timesecsmin": "50",
            "timesecsmax": "60",
            "executeperc": "20",
            "startrage": "0",
            "targetlevel": "63",
            "targetbasearmor": "3731",
            "targetcustomarmor": "",
            "targetresistance": "24",
            "targetspeed": "0",
            "targetmindmg": "200",
            "targetmaxdmg": "300",
            "adjacent": "0",
            "aqbooks": "No",
            "reactionmin": "200",
            "reactionmax": "300",
            "batching": "10",
            "bleedreduction": "1",
            "spellqueueing": "Yes",
            "talentSchema": "forever-v3",
            "maxhealth": "",
            "targetcreaturetype": "Other",
            "profilename": "Dual Wield Fury (19/32/0)",
            "buffs": [
                null,
                "17007",
                "9885",
                "20217",
                "19838",
                "10614",
                "10442",
                "250351",
                "12451",
                "12460",
                "13928",
                "11371",
                "11597",
                "9907",
                "2458"
            ],
            "talents": [
                {
                    "n": "Arms",
                    "t": [
                        3,
                        0,
                        3,
                        0,
                        5,
                        2,
                        1,
                        3,
                        0,
                        0,
                        2,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "arms:improved-heroic-strike",
                        "arms:deflection",
                        "arms:improved-rend",
                        "arms:improved-charge",
                        "arms:improved-tactical-mastery",
                        "arms:improved-overpower",
                        "arms:anger-management",
                        "arms:deep-wounds",
                        "arms:spearing-strike",
                        "arms:two-handed-weapon-specialization",
                        "arms:impale",
                        "arms:bloodthrill",
                        "arms:sweeping-strikes",
                        "arms:weaponmaster",
                        "arms:improved-slam",
                        "arms:improved-hamstring",
                        "arms:mortal-strike"
                    ]
                },
                {
                    "n": "Fury",
                    "t": [
                        0,
                        5,
                        1,
                        5,
                        3,
                        1,
                        0,
                        5,
                        1,
                        0,
                        2,
                        2,
                        1,
                        0,
                        5,
                        0,
                        1
                    ],
                    "keys": [
                        "fury:booming-voice",
                        "fury:cruelty",
                        "fury:lingering-rage",
                        "fury:unbridled-wrath",
                        "fury:furious-precision",
                        "fury:piercing-howl",
                        "fury:blood-craze",
                        "fury:dual-wield-specialization",
                        "fury:raging-blows",
                        "fury:enrage",
                        "fury:improved-execute",
                        "fury:improved-berserker-rage",
                        "fury:death-wish",
                        "fury:improved-intercept",
                        "fury:flurry",
                        "fury:gore-drinker",
                        "fury:bloodthirst"
                    ]
                },
                {
                    "n": "Protection",
                    "t": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "protection:improved-bloodrage",
                        "protection:shield-specialization",
                        "protection:iron-will",
                        "protection:anticipation",
                        "protection:improved-revenge",
                        "protection:improved-thunder-clap",
                        "protection:last-stand",
                        "protection:master-of-defense",
                        "protection:improved-disarm",
                        "protection:defiance",
                        "protection:improved-sunder-armor",
                        "protection:vanguard",
                        "protection:improved-shield-bash",
                        "protection:improved-shield-wall",
                        "protection:concussion-blow",
                        "protection:focused-rage",
                        "protection:bastion",
                        "protection:shield-slam"
                    ]
                }
            ],
            "gear": {
                "head": 12640,
                "neck": 18404,
                "shoulder": 12927,
                "back": 13340,
                "chest": 11726,
                "wrist": 12936,
                "hands": 15063,
                "waist": 13959,
                "legs": 15062,
                "feet": 14616,
                "finger1": 17713,
                "finger2": 12548,
                "trinket1": 11815,
                "trinket2": 13965,
                "ranged": 18323,
                "mainhand": 12940,
                "offhand": 12939
            },
            "rotation": [
                {
                    "id": 11574,
                    "active": true,
                    "duration": 16,
                    "durationactive": true,
                    "maxrage": "45",
                    "maxrageactive": true,
                    "priority": "5",
                    "expriority": "0"
                },
                {
                    "id": "11567",
                    "active": true,
                    "minrage": "45",
                    "minrageactive": true,
                    "maincd": "2",
                    "maincdactive": false,
                    "unqueue": 15,
                    "unqueueactive": false,
                    "exmacro": true
                },
                {
                    "id": "11551",
                    "active": true
                },
                {
                    "id": "2687",
                    "active": true,
                    "timetoend": 35,
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": true
                },
                {
                    "id": "11597",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": 50,
                    "minrageactive": false,
                    "globals": "1",
                    "globalsactive": true,
                    "priority": 10,
                    "expriority": 0
                },
                {
                    "id": "11585",
                    "active": true,
                    "maxrage": "55",
                    "maxrageactive": true,
                    "maincd": 2,
                    "maincdactive": false,
                    "priority": "5",
                    "expriority": "1"
                },
                {
                    "id": "7373",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": "10",
                    "minrageactive": true,
                    "priority": "2",
                    "expriority": 0
                },
                {
                    "id": "20662",
                    "active": true,
                    "minrage": 50,
                    "minrageactive": false,
                    "swingtimeractive": false,
                    "swingtimer": 2.5,
                    "priority": 8,
                    "expriority": 8
                },
                {
                    "id": 18499,
                    "active": true,
                    "maxrage": "25",
                    "maxrageactive": true,
                    "zerkerpriority": false
                },
                {
                    "id": "1680",
                    "active": true,
                    "minrage": "50",
                    "minrageactive": false,
                    "maxrage": "30",
                    "maxrageactive": false,
                    "maincd": "2",
                    "maincdactive": false,
                    "priority": 7,
                    "expriority": 0
                },
                {
                    "id": "23894",
                    "active": true,
                    "minrage": 30,
                    "minrageactive": false,
                    "priority": 9,
                    "expriority": "0"
                },
                {
                    "id": "1719",
                    "active": true,
                    "timetoend": 16,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "12328",
                    "active": true,
                    "timetoend": 31,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "17528",
                    "active": true,
                    "timetoend": "21",
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": 16322,
                    "active": true,
                    "timetoend": "16",
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "forever:elunes-light",
                    "active": true,
                    "timetoend": 31,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                }
            ],
            "enchant": {
                "mainhand": [
                    18262,
                    20034
                ],
                "offhand": [
                    18262,
                    20034
                ],
                "head": [
                    18329
                ],
                "neck": [
                    "neck-strength"
                ],
                "back": [
                    "back-agility"
                ],
                "chest": [
                    13941
                ],
                "wrist": [
                    20010
                ],
                "hands": [
                    "hands-superior-strength"
                ],
                "legs": [
                    18329
                ],
                "feet": [
                    13890
                ]
            }
        }
    },
    {
        "id": "forever-two-handed-fury",
        "description": "2H Fury P1 - Level 60 Night Elf",
        "profile": {
            "level": "60",
            "race": "Night Elf",
            "simulations": "100000",
            "timesecsmin": "50",
            "timesecsmax": "60",
            "executeperc": "20",
            "startrage": "0",
            "targetlevel": "63",
            "targetbasearmor": "3731",
            "targetcustomarmor": "",
            "targetresistance": "24",
            "targetspeed": "0",
            "targetmindmg": "200",
            "targetmaxdmg": "300",
            "adjacent": "0",
            "aqbooks": "No",
            "reactionmin": "200",
            "reactionmax": "300",
            "batching": "10",
            "bleedreduction": "1",
            "spellqueueing": "Yes",
            "talentSchema": "forever-v3",
            "maxhealth": "",
            "targetcreaturetype": "Other",
            "profilename": "Two-Handed Fury (20/31/0)",
            "buffs": [
                null,
                "17007",
                "9885",
                "20217",
                "19838",
                "10614",
                "10442",
                "250351",
                "12451",
                "12460",
                "13928",
                "11371",
                "11597",
                "9907",
                "2458"
            ],
            "talents": [
                {
                    "n": "Arms",
                    "t": [
                        2,
                        0,
                        3,
                        0,
                        5,
                        2,
                        0,
                        3,
                        0,
                        3,
                        2,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "arms:improved-heroic-strike",
                        "arms:deflection",
                        "arms:improved-rend",
                        "arms:improved-charge",
                        "arms:improved-tactical-mastery",
                        "arms:improved-overpower",
                        "arms:anger-management",
                        "arms:deep-wounds",
                        "arms:spearing-strike",
                        "arms:two-handed-weapon-specialization",
                        "arms:impale",
                        "arms:bloodthrill",
                        "arms:sweeping-strikes",
                        "arms:weaponmaster",
                        "arms:improved-slam",
                        "arms:improved-hamstring",
                        "arms:mortal-strike"
                    ]
                },
                {
                    "n": "Fury",
                    "t": [
                        5,
                        5,
                        0,
                        5,
                        0,
                        0,
                        0,
                        0,
                        1,
                        5,
                        2,
                        1,
                        1,
                        0,
                        5,
                        0,
                        1
                    ],
                    "keys": [
                        "fury:booming-voice",
                        "fury:cruelty",
                        "fury:lingering-rage",
                        "fury:unbridled-wrath",
                        "fury:furious-precision",
                        "fury:piercing-howl",
                        "fury:blood-craze",
                        "fury:dual-wield-specialization",
                        "fury:raging-blows",
                        "fury:enrage",
                        "fury:improved-execute",
                        "fury:improved-berserker-rage",
                        "fury:death-wish",
                        "fury:improved-intercept",
                        "fury:flurry",
                        "fury:gore-drinker",
                        "fury:bloodthirst"
                    ]
                },
                {
                    "n": "Protection",
                    "t": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "protection:improved-bloodrage",
                        "protection:shield-specialization",
                        "protection:iron-will",
                        "protection:anticipation",
                        "protection:improved-revenge",
                        "protection:improved-thunder-clap",
                        "protection:last-stand",
                        "protection:master-of-defense",
                        "protection:improved-disarm",
                        "protection:defiance",
                        "protection:improved-sunder-armor",
                        "protection:vanguard",
                        "protection:improved-shield-bash",
                        "protection:improved-shield-wall",
                        "protection:concussion-blow",
                        "protection:focused-rage",
                        "protection:bastion",
                        "protection:shield-slam"
                    ]
                }
            ],
            "gear": {
                "head": 12640,
                "neck": 18404,
                "shoulder": 12927,
                "back": 13340,
                "chest": 11726,
                "wrist": 13400,
                "hands": 15063,
                "waist": 13959,
                "legs": 15062,
                "feet": 14616,
                "finger1": 13098,
                "finger2": 12548,
                "trinket1": 11815,
                "trinket2": 13965,
                "ranged": 18323,
                "twohand": 12784
            },
            "rotation": [
                {
                    "id": 11574,
                    "active": true,
                    "duration": 16,
                    "durationactive": true,
                    "maxrage": "25",
                    "maxrageactive": true,
                    "priority": "5",
                    "expriority": "0"
                },
                {
                    "id": "11551",
                    "active": true
                },
                {
                    "id": "2687",
                    "active": true,
                    "timetoend": 35,
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": true
                },
                {
                    "id": "11597",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": 50,
                    "minrageactive": false,
                    "globals": "1",
                    "globalsactive": true,
                    "priority": 10,
                    "expriority": 0
                },
                {
                    "id": "11585",
                    "active": true,
                    "maxrage": "70",
                    "maxrageactive": true,
                    "maincd": 2,
                    "maincdactive": false,
                    "priority": "8",
                    "expriority": "3"
                },
                {
                    "id": "7373",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": "18",
                    "minrageactive": true,
                    "priority": 2,
                    "expriority": 0
                },
                {
                    "id": "20662",
                    "active": true,
                    "minrage": 50,
                    "minrageactive": false,
                    "swingtimeractive": false,
                    "swingtimer": 2.5,
                    "priority": 8,
                    "expriority": 8
                },
                {
                    "id": 18499,
                    "active": true,
                    "maxrage": "25",
                    "maxrageactive": true,
                    "zerkerpriority": false
                },
                {
                    "id": "1680",
                    "active": true,
                    "minrage": "50",
                    "minrageactive": false,
                    "maxrage": "50",
                    "maxrageactive": true,
                    "maincd": "1",
                    "maincdactive": false,
                    "priority": 7,
                    "expriority": 0
                },
                {
                    "id": "23894",
                    "active": true,
                    "minrage": 30,
                    "minrageactive": false,
                    "priority": 9,
                    "expriority": "0"
                },
                {
                    "id": "1719",
                    "active": true,
                    "timetoend": 16,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "12328",
                    "active": true,
                    "timetoend": 31,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "17528",
                    "active": true,
                    "timetoend": "21",
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": 16322,
                    "active": true,
                    "timetoend": "16",
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "forever:elunes-light",
                    "active": true,
                    "timetoend": 31,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                }
            ],
            "enchant": {
                "twohand": [
                    18262,
                    20034
                ],
                "head": [
                    11645
                ],
                "neck": [
                    "neck-strength"
                ],
                "back": [
                    "back-agility"
                ],
                "chest": [
                    13941
                ],
                "wrist": [
                    20010
                ],
                "hands": [
                    "hands-superior-strength"
                ],
                "legs": [
                    11645
                ],
                "feet": [
                    13890
                ]
            }
        }
    },
    {
        "id": "forever-two-handed-arms",
        "description": "2H Arms P1 - Level 60 Night Elf",
        "profile": {
            "level": "60",
            "race": "Night Elf",
            "simulations": "1000000",
            "timesecsmin": "50",
            "timesecsmax": "60",
            "executeperc": "20",
            "startrage": "0",
            "targetlevel": "63",
            "targetbasearmor": "3731",
            "targetcustomarmor": "",
            "targetresistance": "24",
            "targetspeed": "0",
            "targetmindmg": "200",
            "targetmaxdmg": "300",
            "adjacent": "0",
            "aqbooks": "No",
            "reactionmin": "200",
            "reactionmax": "300",
            "batching": "10",
            "bleedreduction": "1",
            "spellqueueing": "Yes",
            "talentSchema": "forever-v3",
            "maxhealth": "",
            "targetcreaturetype": "Other",
            "profilename": "Two-Handed Arms (35/16/0)",
            "buffs": [
                null,
                "17007",
                "9885",
                "20217",
                "19838",
                "10614",
                "10442",
                "250351",
                "12451",
                "12460",
                "13928",
                "11371",
                "11597",
                "9907",
                "2458"
            ],
            "talents": [
                {
                    "n": "Arms",
                    "t": [
                        0,
                        2,
                        3,
                        0,
                        5,
                        2,
                        1,
                        3,
                        0,
                        3,
                        2,
                        5,
                        1,
                        5,
                        2,
                        0,
                        1
                    ],
                    "keys": [
                        "arms:improved-heroic-strike",
                        "arms:deflection",
                        "arms:improved-rend",
                        "arms:improved-charge",
                        "arms:improved-tactical-mastery",
                        "arms:improved-overpower",
                        "arms:anger-management",
                        "arms:deep-wounds",
                        "arms:spearing-strike",
                        "arms:two-handed-weapon-specialization",
                        "arms:impale",
                        "arms:bloodthrill",
                        "arms:sweeping-strikes",
                        "arms:weaponmaster",
                        "arms:improved-slam",
                        "arms:improved-hamstring",
                        "arms:mortal-strike"
                    ]
                },
                {
                    "n": "Fury",
                    "t": [
                        5,
                        5,
                        0,
                        5,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        1,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "fury:booming-voice",
                        "fury:cruelty",
                        "fury:lingering-rage",
                        "fury:unbridled-wrath",
                        "fury:furious-precision",
                        "fury:piercing-howl",
                        "fury:blood-craze",
                        "fury:dual-wield-specialization",
                        "fury:raging-blows",
                        "fury:enrage",
                        "fury:improved-execute",
                        "fury:improved-berserker-rage",
                        "fury:death-wish",
                        "fury:improved-intercept",
                        "fury:flurry",
                        "fury:gore-drinker",
                        "fury:bloodthirst"
                    ]
                },
                {
                    "n": "Protection",
                    "t": [
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0
                    ],
                    "keys": [
                        "protection:improved-bloodrage",
                        "protection:shield-specialization",
                        "protection:iron-will",
                        "protection:anticipation",
                        "protection:improved-revenge",
                        "protection:improved-thunder-clap",
                        "protection:last-stand",
                        "protection:master-of-defense",
                        "protection:improved-disarm",
                        "protection:defiance",
                        "protection:improved-sunder-armor",
                        "protection:vanguard",
                        "protection:improved-shield-bash",
                        "protection:improved-shield-wall",
                        "protection:concussion-blow",
                        "protection:focused-rage",
                        "protection:bastion",
                        "protection:shield-slam"
                    ]
                }
            ],
            "gear": {
                "head": 12640,
                "neck": 18404,
                "shoulder": 12927,
                "back": 13340,
                "chest": 11726,
                "wrist": 13400,
                "hands": 15063,
                "waist": 13959,
                "legs": 15062,
                "feet": 14616,
                "finger1": 13098,
                "finger2": 12548,
                "trinket1": 11815,
                "trinket2": 13965,
                "ranged": 18323,
                "twohand": 12784
            },
            "rotation": [
                {
                    "id": 11574,
                    "active": true,
                    "duration": 16,
                    "durationactive": true,
                    "maxrage": "70",
                    "maxrageactive": false,
                    "priority": "5",
                    "expriority": "0"
                },
                {
                    "id": "11551",
                    "active": true
                },
                {
                    "id": "2687",
                    "active": true,
                    "timetoend": 35,
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": true
                },
                {
                    "id": "11597",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": 50,
                    "minrageactive": false,
                    "globals": "1",
                    "globalsactive": true,
                    "priority": 10,
                    "expriority": 0
                },
                {
                    "id": "11585",
                    "active": true,
                    "maxrage": "50",
                    "maxrageactive": true,
                    "maincd": 2,
                    "maincdactive": false,
                    "priority": "8",
                    "expriority": "3"
                },
                {
                    "id": "7373",
                    "active": true,
                    "duration": 15,
                    "durationactive": false,
                    "minrage": "15",
                    "minrageactive": false,
                    "priority": "1",
                    "expriority": 0
                },
                {
                    "id": "20662",
                    "active": true,
                    "minrage": 50,
                    "minrageactive": false,
                    "swingtimeractive": false,
                    "swingtimer": 2.5,
                    "priority": 8,
                    "expriority": "8"
                },
                {
                    "id": "1680",
                    "active": true,
                    "minrage": "50",
                    "minrageactive": false,
                    "maxrage": "70",
                    "maxrageactive": true,
                    "maincd": "2",
                    "maincdactive": false,
                    "priority": 7,
                    "expriority": 0
                },
                {
                    "id": "27580",
                    "active": true,
                    "minrage": 30,
                    "minrageactive": false,
                    "priority": 9,
                    "expriority": "9"
                },
                {
                    "id": "1719",
                    "active": true,
                    "timetoend": 16,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "17528",
                    "active": true,
                    "timetoend": "21",
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": 11605,
                    "active": true,
                    "minrage": "10",
                    "minrageactive": false,
                    "maincd": "1",
                    "maincdactive": false,
                    "nextauto": "900",
                    "nextautoactive": true,
                    "afterswing": false,
                    "priority": "8",
                    "expriority": "0"
                },
                {
                    "id": 16322,
                    "active": true,
                    "timetoend": "16",
                    "timetoendactive": false,
                    "timetostart": 0,
                    "timetostartactive": false
                },
                {
                    "id": "forever:elunes-light",
                    "active": true,
                    "timetoend": 31,
                    "timetoendactive": true,
                    "timetostart": 0,
                    "timetostartactive": false
                }
            ],
            "enchant": {
                "twohand": [
                    18262,
                    20034
                ],
                "head": [
                    11645
                ],
                "neck": [
                    "neck-strength"
                ],
                "back": [
                    "back-agility"
                ],
                "chest": [
                    13941
                ],
                "wrist": [
                    20010
                ],
                "hands": [
                    "hands-superior-strength"
                ],
                "legs": [
                    11645
                ],
                "feet": [
                    13890
                ]
            }
        }
    }
];
