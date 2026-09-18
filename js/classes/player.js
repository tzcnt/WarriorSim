class Player {
    static getConfig(base) {
        return {
            level: $('input[name="level"]').val(),
            race: $('select[name="race"]').val(),
            aqbooks: $('select[name="aqbooks"]').val() == "Yes",
            reactionmin: parseInt($('input[name="reactionmin"]').val()),
            reactionmax: parseInt($('input[name="reactionmax"]').val()),
            adjacent: parseInt($('input[name="adjacent"]').val()),
            mode: globalThis.mode,
            maxhealth: $('input[name="maxhealth"]').val(),
            spellqueueing: $('select[name="spellqueueing"]').val() == "Yes",
            target: {
                level: parseInt($('input[name="targetlevel"]').val()),
                basearmor: parseInt($('select[name="targetbasearmor"]').val() || $('input[name="targetcustomarmor"]').val()),
                defense: parseInt($('input[name="targetlevel"]').val()) * 5,
                resistance: parseInt($('input[name="targetresistance"]').val()),
                speed: parseFloat($('input[name="targetspeed"]').val()) * 1000,
                mindmg: parseInt($('input[name="targetmindmg"]').val()),
                maxdmg: parseInt($('input[name="targetmaxdmg"]').val()),
                bleedreduction: $('select[name="bleedreduction"]').val(),
                creaturetype: $('select[name="targetcreaturetype"]').val() || 'Other',
            },
        };
    }
    constructor(testItem, testType, enchtype, config) {
        if (!config) config = Player.getConfig();
        this.rage = 0;
        this.level = config.level;
        this.rageconversion = ((0.0091107836 * this.level * this.level) + 3.225598133 * this.level) + 4.2652911;
        if (this.level == 25) this.rageconversion = 82.25;
        if (this.level == 40) this.rageconversion = 140.5;
        this.agipercrit = this.getAgiPerCrit(this.level);
        this.timer = 0;
        this.itemtimer = 0;
        this.stancetimer = 0;
        this.dodgetimer = 0;
        this.extraattacks = 0;
        this.batchedextras = 0;
        this.nextswinghs = false;
        this.nextswingcl = false;
        this.ragecostbonus = 0;
        this.ragecap = 100;
        this.bloodthrilltimer = 0;
        this.logging = config.logging;
        this.race = config.race;
        this.aqbooks = config.aqbooks;
        this.reactionmin = config.reactionmin;
        this.reactionmax = config.reactionmax;
        this.adjacent = config.adjacent;
        this.spelldamage = 0;
        this.target = config.target;
        this.mounted = this.target?.creaturetype === "Mounted";
        this.mode = config.mode;
        this.bleedmod = parseFloat(this.target.bleedreduction);
        this.spellqueueing = config.spellqueueing;
        this.target.misschance = this.getTargetSpellMiss();
        this.target.mitigation = this.getTargetSpellMitigation();
        this.target.binaryresist = this.getTargetSpellBinaryResist();
        this.target.dodge = 0;
        this.base = {
            ap: 0,
            agi: 0,
            str: 0,
            hit: 0,
            crit: 0,
            spellcrit: 0,
            skill_0: this.level * 5,
            skill_1: this.level * 5,
            skill_2: this.level * 5,
            skill_3: this.level * 5,
            skill_4: this.level * 5,
            skill_5: this.level * 5,
            skill_6: this.level * 5,
            skill_7: (this.level < 35 ? 225 : 300),
            skill_10: 0,
            skill_11: 0,
            skill_13: 0,
            skill_20: 0,
            skill_21: 0,
            skill_23: 0,
            haste: 1,
            strmod: 1,
            agimod: 1,
            dmgmod: 1,
            spelldmgmod: 1,
            moddmgdone: 0,
            moddmgtaken: 0,
            apmod: 1,
            baseapmod: 1,
            resist: {
                shadow: 0,
                arcane: 0,
                nature: 0,
                fire: 0,
                frost: 0,
            },
            block: 0,
            defense: 0,
        };
        if (this.mode === 'forever') Object.assign(this.base, {sta: 0, stamod: 1, health: 0});
        if (enchtype == 1) {
            this.testEnch = testItem;
            this.testEnchType = testType;
        }
        else if (enchtype == 2) {
            this.testTempEnch = testItem;
            this.testTempEnchType = testType;
        }
        else if (enchtype == 3) {
            if (testType == 0) {
                this.base.ap += testItem;
            }
            else if (testType == 1) {
                this.base.crit += testItem;
            }
            else if (testType == 2) {
                this.base.hit += testItem;
            }
            else if (testType == 3) {
                this.base.str += testItem;
            }
            else if (testType == 4) {
                this.base.agi += testItem;
            }
        }
        else {
            this.testItem = testItem;
            this.testItemType = testType;
        }
        this.stats = {};
        this.auras = {};
        this.spells = {};
        this.items = [];
        this.addRace();
        this.addTalents();
        this.addGear();
        if (!this.mh) return;
        if (this.mode === 'forever' && this.shield) {
            this.base.dmgmod *= 1 + this.talents.bastion;
            this.base.spelldmgmod *= 1 + this.talents.bastion;
        }
        this.addRacialBonuses();
        this.addSets();
        this.addEnchants();
        this.addTempEnchants();
        this.addBuffs();
        if (this.mode === 'forever') this.resolveHealth(config.maxhealth);
        this.addSpells(testItem);
        this.sortSpells();
        this.setSkills();
        if (this.talents.flurry) this.auras.flurry = new Flurry(this);
        if (this.mode === 'forever' && this.talents.enrage) this.auras.enrage = new Enrage(this);
        const DeepWoundsAura = this.mode === 'forever' ? DeepWounds : OldDeepWounds;
        if (this.talents.deepwounds) this.auras.deepwounds = new DeepWoundsAura(this);
        if (this.adjacent && this.talents.deepwounds) {
            for (let i = 2; i <= (this.adjacent + 1); i++)
                this.auras['deepwounds' + i] = new DeepWoundsAura(this, null, i);
        }

        this.spells.stanceswitch = new StanceSwitch(this);
        if (this.spells.bloodrage) this.auras.bloodrage = new BloodrageAura(this);
        if (this.spells.berserkerrage) this.auras.berserkerrage = new BerserkerRageAura(this);

        this.update();
        if (this.oh)
            this.oh.timer = Math.round(this.oh.speed * 1000 / this.stats.haste / 2);
    }
    initStances() {
        this.stance = this.basestance;
        this.auras.battlestance = new BattleStance(this);
        this.auras.berserkerstance = new BerserkerStance(this);
        this.auras.defensivestance = new DefensiveStance(this);
        if (this.basestance == 'battle') this.auras.battlestance.timer = 1;
        if (this.basestance == 'zerk') this.auras.berserkerstance.timer = 1;
        if (this.basestance == 'def') this.auras.defensivestance.timer = 1;

    }
    addRace() {
        for(let l of levelstats) {
            let raceid;
            if (this.race == "Human" || (this.mode === "forever" && this.race === "Skyborne")) raceid = "1";
            if (this.race == "Orc") raceid = "2";
            if (this.race == "Dwarf") raceid = "3";
            if (this.race == "Night Elf") raceid = "4";
            if (this.race == "Undead") raceid = "5";
            if (this.race == "Tauren") raceid = "6";
            if (this.race == "Gnome") raceid = "7";
            if (this.race == "Troll") raceid = "8";

            // race,class,level,str,agi,sta,inte,spi
            let stats = l.split(",");
            if (stats[0] == raceid && stats[2] == this.level) {
                this.base.aprace = (this.level * 3) - 20;
                this.base.ap += (this.level * 3) - 20;
                this.base.str += parseInt(stats[3]);
                this.base.agi += parseInt(stats[4]);
                if (this.mode === 'forever') this.base.sta += parseInt(stats[5]);
                this.base.skill_0 += this.mode !== "forever" && raceid == "1" ? 5 : 0;
                this.base.skill_1 += this.mode !== "forever" && raceid == "1" ? 5 : 0;
                this.base.skill_2 += 0;
                this.base.skill_3 += this.mode !== "forever" && raceid == "2" ? 5 : 0;
            }
        }
    }
    addRacialBonuses() {
        if (this.mode !== 'forever') return;
        // Weapon racials affect autoattacks and abilities; each hand qualifies independently.
        const specialization = {Human: [WEAPONTYPE.SWORD, 2], Dwarf: [WEAPONTYPE.MACE, 1], Orc: [WEAPONTYPE.AXE, 1]}[this.race];
        for (const weapon of [this.mh, this.oh].filter(Boolean))
            weapon.racialcrit = specialization && weapon.type === specialization[0] ? specialization[1] : 0;
        this.base.spellcrit += Math.max(this.mh.racialcrit, this.oh?.racialcrit || 0);
        if (this.race === 'Tauren') {
            this.base.hit += 1;
            this.target.misschance = Math.max(100, this.target.misschance - 100);
            this.target.binaryresist = this.getTargetSpellBinaryResist();
        }
        if (this.race === 'Gnome') this.ragecap *= 1.05;
        if (this.race === 'Undead') this.auras.touchofthegrave = new TouchOfTheGrave(this);
        if (this.race === 'Skyborne') this.base.haste *= 1.01;
        if ((['Dwarf', 'Troll'].includes(this.race) && this.target.creaturetype === 'Beast') ||
            (this.race === 'Skyborne' && this.target.creaturetype === 'Elemental')) {
            this.base.dmgmod *= 1.05;
            this.base.spelldmgmod *= 1.05;
        }
    }
    resolveHealth(override) {
        // Static maximum health for HP-scaling damage; incoming attacks do not deplete it.
        this.stamina = Math.max(0, Math.floor(this.base.sta * this.base.stamod));
        const staminaHealth = Math.min(this.stamina, 20) + Math.max(this.stamina - 20, 0) * 10;
        this.maxhealth = Math.max(1, Math.round((warriorBaseHealth[this.level] + staminaHealth + this.base.health) *
            (this.race === 'Tauren' ? 1.05 : 1)));
        if (Number.isFinite(Number(override)) && Number(override) > 0) this.maxhealth = Math.max(1, Math.round(Number(override)));
    }
    addTalents() {
        this.talents = this.mode === 'forever' ? {...foreverTalentDefaults} : {};
        for (let tree in talents) {
            for (let talent of talents[tree].t) {
                this.talents = Object.assign(this.talents, talent.aura(talent.c));
            }
        }
        if (this.talents.defense) this.base.defense += this.talents.defense;
        if (this.mode === 'forever') {
            this.ragecap += this.talents.extraragecap;
            this.ragecostbonus = this.talents.focusedrage;
            this.base.hit += this.talents.precision;
            this.target.misschance = Math.max(100, this.target.misschance - this.talents.precision * 100);
            this.target.binaryresist = this.getTargetSpellBinaryResist();
        }
    }
    addGear() {
        for (let type in gear) {
            for (let item of gear[type]) {
                if ((this.testItemType == type && this.testItem == item.id) ||
                    (this.testItemType != type && item.selected)) {
                    for (let prop in this.base) {
                        if (prop == 'haste') {
                            this.base.haste *= (1 + item.haste / 100) || 1;
                        } else {
                            if (typeof item[prop] === 'object') {
                                for (let subprop in item[prop]) {
                                    this.base[prop][subprop] += item[prop][subprop] || 0;
                                }
                            } else {
                                if (item[prop]) {
                                    this.base[prop] += item[prop] || 0;
                                }
                            }
                        }
                    }
                    if (item.skill && item.skill > 0) {
                        let sk = WEAPONTYPE[item.type.replace(' ','').toUpperCase()];
                        this.base['skill_' + sk] += item.skill;
                    }
                    if (item.skills) {
                        Object.keys(item.skills).forEach(key => {
                            this.base['skill_' + key] += item.skills[key];
                        });
                    }

                    if (item.d) this.base.defense += item.d;

                    if (type == "mainhand" || type == "offhand" || type == "twohand")
                        this.addWeapon(item, type);

                    if (item.proc && item.proc.chance && (type == "trinket1" || type == "trinket2")) {
                        let proc = {};
                        proc.chance = item.proc.chance * 100;
                        proc.extra = item.proc.extra;
                        proc.magicdmg = item.proc.dmg;
                        proc.cooldown = item.proc.cooldown;
                        if (item.spell) {
                            this.auras[item.proc.spell.toLowerCase()] = eval('new ' + item.proc.spell + '(this)');
                            proc.spell = this.auras[item.proc.spell.toLowerCase()];
                        }
                        this["trinketproc" + (this.trinketproc1 ? 2 : 1)] = proc;
                    }
                    else if (item.proc && item.proc.chance) {
                        let proc = {}
                        proc.chance = item.proc.chance * 100;
                        if (item.proc.dmg) proc.magicdmg = item.proc.dmg;
                        if (item.proc.spell) {
                            this.auras[item.proc.spell.toLowerCase()] = eval('new ' + item.proc.spell + '(this)');
                            proc.spell = this.auras[item.proc.spell.toLowerCase()];
                        }
                        if (this.attackproc2) console.log("Warning! overlapping attack procs!");
                        if (!this.attackproc1) this.attackproc1 = proc;
                        else this.attackproc2 = proc;
                    }

                    if (item.id == 21189)
                        this.base['moddmgdone'] += 4;
                    if (item.id == 19968)
                        this.base['moddmgdone'] += 2;

                    this.items.push(item.id);
                }
            }
        }
    }
    addWeapon(item, type) {

        let ench, tempench;
        for (let item of enchant[type]) {
            if (item.temp) continue;
            if (this.testEnchType == type && this.testEnch == item.id) ench = item;
            else if (this.testEnchType != type && item.selected) ench = item;
        }
        for (let item of enchant[type]) {
            if (!item.temp) continue;
            if (this.testTempEnchType == type && this.testTempEnch == item.id) tempench = item;
            else if (this.testTempEnchType != type && item.selected) tempench = item;
        }

        if (type == "mainhand")
            this.mh = new Weapon(this, item, ench, tempench, false, false);

        if (type == "offhand" && item.type != "Shield")
            this.oh = new Weapon(this, item, ench, tempench, true, false);

        if (type == "offhand" && item.type == "Shield")
            this.shield = item;

        if (type == "twohand")
            this.mh = new Weapon(this, item, ench, tempench, false, true);

    }
    addEnchants() {
        for (let type in enchant) {
            for (let item of enchant[type]) {
                if (item.temp) continue;
                if ((this.testEnchType == type && this.testEnch == item.id) ||
                    (this.testEnchType != type && item.selected)) {

                    for (let prop in this.base) {
                        if (prop == 'haste') {
                            this.base.haste *= (1 + item.haste / 100) || 1;
                        } else {
                            if (typeof item[prop] === 'object') {
                                for (let subprop in item[prop]) {
                                    this.base[prop][subprop] += item[prop][subprop] || 0;
                                }
                            } else {
                                if (item[prop]) {
                                    this.base[prop] += item[prop] || 0;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    addTempEnchants() {
        for (let type in enchant) {
            for (let item of enchant[type]) {
                if (!item.temp) continue;
                if ((type == "mainhand" || type == "twohand") && this.mh.windfury) continue;
                if ((this.testTempEnchType == type && this.testTempEnch == item.id) ||
                    (this.testTempEnchType != type && item.selected)) {

                    for (let prop in this.base) {
                        if (prop == 'haste') {
                            this.base.haste *= (1 + item.haste / 100) || 1;
                        } else {
                            if (typeof item[prop] === 'object') {
                                for (let subprop in item[prop]) {
                                    this.base[prop][subprop] += item[prop][subprop] || 0;
                                }
                            } else {
                                if (item[prop]) {
                                    this.base[prop] += item[prop] || 0;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    addSets() {
        for (let set of sets) {
            let counter = 0;
            for (let item of set.items)
                if (this.items.includes(item))
                    counter++;
            if (counter == 0)
                continue;
            for (let bonus of set.bonus) {
                if (counter >= bonus.count) {
                    for (let prop in bonus.stats) {
                        if (typeof bonus.stats[prop] === 'object') {
                            for (let subprop in bonus.stats[prop]) {
                                this.base[prop][subprop] += bonus.stats[prop][subprop] || 0;
                            }
                        }
                        else {
                            this.base[prop] += bonus.stats[prop] || 0;
                        }
                    }

                    if (bonus.stats.procchance) {
                        let proc = {}
                        proc.chance = bonus.stats.procchance * 100;
                        if (bonus.stats.magicdmg) proc.magicdmg = bonus.stats.magicdmg;
                        if (bonus.stats.procspell) {
                            this.auras[bonus.stats.procspell.toLowerCase()] = eval('new ' + bonus.stats.procspell + '(this)');
                            proc.spell = this.auras[bonus.stats.procspell.toLowerCase()];
                        } 
                        if (this.attackproc2) console.log("Warning! overlapping attack procs!");
                        if (!this.attackproc1) this.attackproc1 = proc;
                        else this.attackproc2 = proc;
                    }
                    if (bonus.stats.enhancedbs) {
                        this.enhancedbs = true;
                    }
                    if (bonus.stats.whirlwindcost) this.whirlwindcost = bonus.stats.whirlwindcost;
                }
            }
        }
    }
    addBuffs() {
        this.target.basearmorbuffed = this.target.basearmor;
        for (let buff of buffs) {
            if (buff.active && buff.improvedexposed) {
                this.improvedexposed = true;
            }
            if (buff.active && buff.name == "Expose Armor") {
                this.exposed = true;
            }
        }
        for (let buff of buffs) {
            if (buff.active) {
                let ap = 0, str = 0, agi = 0, sta = 0;
                if (buff.name == "Blessing of Might") {
                    let impmight = buffs.filter(s => s.mightmod && s.active)[0];
                    ap = ~~(buff.ap * (impmight ? impmight.mightmod : 1));
                }
                if (buff.name == "Mark of the Wild") {
                    let impmotw = buffs.filter(s => s.motwmod && s.active)[0];
                    str = ~~(buff.str * (impmotw ? impmotw.motwmod : 1));
                    agi = ~~(buff.agi * (impmotw ? impmotw.motwmod : 1));
                    sta = ~~(buff.sta * (impmotw ? impmotw.motwmod : 1));
                }
                if (buff.group == "vaelbuff")
                    this.vaelbuff = true;
                if (buff.group == "dragonbreath")
                    this.dragonbreath = true;
                if (buff.armor) 
                    this.target.basearmorbuffed -= buff.armor + (buff.name == "Expose Armor" && this.improvedexposed ? buff.armor * 0.5 : 0);
                if (buff.name == "Faerie Fire")
                    this.faeriefire = true;
                if (buff.stance) {
                    this.basestance = buff.stance;
                    continue;
                }
                this.base.ap += ap || buff.ap || 0;
                this.base.agi += agi || buff.agi || 0;
                this.base.str += str || buff.str || 0;
                if (this.mode === 'forever') {
                    this.base.sta += sta || buff.sta || 0;
                    this.base.stamod *= (1 + buff.stamod / 100) || 1;
                    this.base.health += buff.health || 0;
                }
                this.base.crit += buff.crit || 0;
                this.base.hit += buff.hit || 0;
                this.base.spellcrit += buff.spellcrit || 0;
                this.base.agimod *= (1 + buff.agimod / 100) || 1;
                this.base.strmod *= (1 + buff.strmod / 100) || 1;
                this.base.dmgmod *= (1 + buff.dmgmod / 100) || 1;
                this.base.spelldmgmod *= (1 + buff.spelldmgmod / 100) || 1;
                this.base.haste *= (1 + buff.haste / 100) || 1;
                this.base.moddmgdone += buff.moddmgdone || 0;
                this.base.moddmgtaken += buff.moddmgtaken || 0;
                this.base.defense += buff.defense || 0;

                if (buff.resist) {
                    let impmotw = buff.name == "Mark of the Wild" && buffs.filter(s => s.motwmod && s.active)[0];
                    if (buff.name == "Mark of the Wild" && buffs.filter(s => s.mrp && s.active)[0]) continue;
                    if ((buff.name == "Mark of the Wild" || buff.mrp) && buffs.filter(s => s.fra && s.active)[0]) continue;
                    this.base.resist.fire += ~~(buff.resist.fire * (impmotw ? impmotw.motwmod : 1) || 0);
                    this.base.resist.frost += ~~(buff.resist.frost * (impmotw ? impmotw.motwmod : 1) || 0);
                    this.base.resist.nature += ~~(buff.resist.nature * (impmotw ? impmotw.motwmod : 1) || 0);
                    this.base.resist.shadow += ~~(buff.resist.shadow * (impmotw ? impmotw.motwmod : 1) || 0);
                }
                
            }
        }
        this.target.basearmorbuffed = Math.max(this.target.basearmorbuffed, 0);
        if (typeof $ !== 'undefined')
            $("#currentarmor").text(this.target.basearmorbuffed);

    }
    addSpells(testItem) {
        this.preporder = [];
        for (let spell of spells) {
            if (spell.mode && spell.mode !== this.mode) continue;
            if (!racialSpellAvailable(spell.id, this.race, this.mode)) continue;
            if (spell.talent && (!this.talents[spell.talent] || this.level < (spell.minlevel || 0))) continue;
            if (this.mode === 'forever') {
                if (this.level < (spell.minlevel || 0) || this.level > (spell.maxlevel || 60)) continue;
                const talent = talentsForever.flatMap(tree => tree.t).find(t => t.n === spell.name);
                if (talent?.enable && !talent.c) continue;
                if (spell.classname === 'SpearingStrike' && !this.mh.twohand) continue;
            }
            if (spell.item && this.items.includes(spell.id) && spell.id == testItem && spell.id == testItem && !spell.timetoendactive && !spell.timetostartactive) {
                spell.timetoendactive = true;
            }
            if (spell.active || (spell.item && this.items.includes(spell.id) && (spell.timetoendactive || spell.timetostartactive))) {
                if (!spell.aura && this.mh.type == WEAPONTYPE.FISHINGPOLE) continue; 
                if (spell.item && !this.items.includes(spell.id)) continue;
                const action = eval(`new ${spell.classname}(this, spell.id)`);
                if (this.mode === 'forever') action.cost = Math.max(0, action.cost || 0);
                if (spell.aura) this.auras[spell.classname.toLowerCase()] = action;
                else this.spells[spell.classname.toLowerCase()] = action;
                this.preporder.push(spell);
            }
        }
        // sort by timetoend to prepare for usestep calculations
        this.preporder.sort((a, b) => { return a.timetoend - b.timetoend; });
    }
    sortSpells() {
        this.normalspells = [];
        this.executespells = [];

        for(let i = 10; i > 0; i--) {
            for(let s in this.spells) {
                if (this.spells[s].priority == i) this.normalspells.push(this.spells[s]);
                if (this.spells[s].expriority == i) this.executespells.push(this.spells[s]);
            }
            for(let a in this.auras) {
                if (this.auras[a].priority == i) this.normalspells.push(this.auras[a]);
                if (this.auras[a].expriority == i) this.executespells.push(this.auras[a]);
            }
        }

        this.normalspells_c = this.normalspells.length;
        this.executespells_c = this.executespells.length;

    }
    setSkills() {
        this.base.skill_0 += this.mh.twohand ? this.base.skill_20 : this.base.skill_10;
        this.base.skill_1 += this.mh.twohand ? this.base.skill_21 : this.base.skill_11;
        this.base.skill_3 += this.mh.twohand ? this.base.skill_23 : this.base.skill_13;
    }
    reset(rage) {
        if (this.auras.eureka) this.auras.eureka.updateCosts(false);
        this.swordspecstep = -1;
        this.mounted = this.target?.creaturetype === "Mounted";
        this.rage = this.mode === 'forever' ? Math.min(rage, this.ragecap) : rage;
        this.bloodthrilltimer = 0;
        this.timer = 0;
        this.itemtimer = 0;
        this.stancetimer = 0;
        this.dodgetimer = 0;
        this.spelldelay = 0;
        this.heroicdelay = 0;
        this.mh.timer = 0;
        this.extraattacks = 0;
        this.batchedextras = 0;
        this.nextswinghs = false;
        this.nextswingcl = false;
        for (let s in this.spells) {
            let spell = this.spells[s];
            spell.timer = 0;
            if (spell.eurekamod !== undefined) spell.eurekamod = 1;
            spell.stacks = 0;
            spell.maxdelay = this.reactionmin;
            if (spell.unqueuetimer !== undefined)
                spell.unqueuetimer = 300 + rng(this.reactionmin, this.reactionmax);
            if (spell.usedrage !== undefined) spell.usedrage = 0;
            if (spell.backupheroic) {
                spell.backupheroic.maxdelay = this.reactionmin;
                spell.backupheroic.unqueuetimer = 300 + rng(this.reactionmin, this.reactionmax);
            }
        }
        for (let s in this.auras) {
            let aura = this.auras[s];
            aura.timer = 0;
            if (aura.eurekamod !== undefined) aura.eurekamod = 1;
            aura.firstuse = true;
            aura.stacks = 0;
            aura.starttimer = 0;
            aura.maxdelay = this.reactionmin;
            if (aura.mintime !== undefined) aura.mintime = 0;
            if (aura.nexttick) aura.nexttick = 0;
            if (aura.saveddmg) aura.saveddmg = 0;
            if (aura.ticksleft) aura.ticksleft = 0;
            if (aura.cooldowntimer) aura.cooldowntimer = 0;
        }
        if (this.trinketproc1 && this.trinketproc1.usestep) this.trinketproc1.usestep = 0;
        if (this.trinketproc2 && this.trinketproc2.usestep) this.trinketproc2.usestep = 0;
        if (this.auras.deepwounds) {
            this.auras.deepwounds.idmg = 0;
        }
        if (this.auras.deepwounds2) {
            this.auras.deepwounds2.idmg = 0;
        }
        if (this.auras.deepwounds3) {
            this.auras.deepwounds3.idmg = 0;
        }
        if (this.auras.deepwounds4) {
            this.auras.deepwounds4.idmg = 0;
        }
        if (this.auras.rend) {
            this.auras.rend.idmg = 0;
        }
        if (this.auras.touchofthegrave) this.auras.touchofthegrave.idmg = 0;
        if (this.auras.sweepingstrikes) this.auras.sweepingstrikes.idmg = 0;
        if (this.spells.fireball) {
            this.spells.fireball.idmg = 0;
        }
        this.initStances();
        this.update();
        if (this.oh)
            this.oh.timer = Math.round(this.oh.speed * 1000 / this.stats.haste / 2);
    }
    update() {
        this.updateAuras();
        this.updateArmorReduction();
        this.mh.glanceChance = this.getGlanceChance(this.mh);
        this.mh.miss = this.getMissChance(this.mh);
        this.mh.dwmiss = this.mh.miss;
        this.mh.dodge = this.getDodgeChance(this.mh);

        if (this.oh) {
            this.mh.dwmiss = this.getDWMissChance(this.mh);
            this.oh.glanceChance = this.getGlanceChance(this.oh);
            this.oh.miss = this.getMissChance(this.oh);
            this.oh.dwmiss = this.getDWMissChance(this.oh);
            if (this.mode === 'forever') {
                this.oh.miss -= this.talents.offhit;
                this.oh.dwmiss -= this.talents.offhit;
            }
            this.oh.dodge = this.getDodgeChance(this.oh);
        }
    }
    updateAuras() {
        for (let prop in this.base)
            this.stats[prop] = this.base[prop];
        for (let name in this.auras) {
            if (this.auras[name].timer) {
                for (let prop in this.auras[name].stats)
                    this.stats[prop] += this.auras[name].stats[prop];
                for (let prop in this.auras[name].mult_stats)
                    this.stats[prop] *= (1 + this.auras[name].mult_stats[prop] / 100);
            }
        }
        this.stats.str = ~~(this.stats.str * this.stats.strmod);
        this.stats.agi = ~~(this.stats.agi * this.stats.agimod);
        this.stats.ap += this.stats.str * 2;
        this.stats.crit += this.stats.agi * this.agipercrit;
        this.crit = this.getCritChance();
        this.stats.block = this.stats.block + ~~(this.stats.str / 20);

        if (this.stats.baseapmod != 1)
            this.stats.ap += ~~((this.base.aprace + this.stats.str * 2) * (this.stats.baseapmod - 1));
        this.stats.ap = ~~(this.stats.ap * this.stats.apmod);
    }
    getAgiPerCrit(level) {
        let table = [0.2500, 0.2381, 0.2381, 0.2273, 0.2174, 0.2083, 0.2083, 0.2000, 0.1923, 0.1923,0.1852, 0.1786, 0.1667, 0.1613, 0.1563, 0.1515, 0.1471, 0.1389, 0.1351, 0.1282,0.1282, 0.1250, 0.1190, 0.1163, 0.1111, 0.1087, 0.1064, 0.1020, 0.1000, 0.0962,0.0943, 0.0926, 0.0893, 0.0877, 0.0847, 0.0833, 0.0820, 0.0794, 0.0781, 0.0758,0.0735, 0.0725, 0.0704, 0.0694, 0.0676, 0.0667, 0.0649, 0.0633, 0.0625, 0.0610,0.0595, 0.0588, 0.0575, 0.0562, 0.0549, 0.0543, 0.0532, 0.0521, 0.0510, 0.0500];
        return table[parseInt(level) - 1];
    }
    getTargetSpellMiss() {
        let resist = 100;
        let diff = this.target.level - this.level;
        if (diff == -2) resist = 200;
        if (diff == -1) resist = 300;
        if (diff == 0) resist = 400;
        if (diff == 1) resist = 500;
        if (diff == 2) resist = 600;
        if (diff == 3) resist = 1700;
        if (diff == 4) resist = 2800;
        if (diff > 4) resist = 2800 + (1100 * (diff - 4));
        return resist;
    }
    getTargetSpellMitigation() {
        return 1 - 15 * (this.target.resistance / (this.level * 100));
    }
    getTargetSpellBinaryResist() {
        return parseInt(10000 - ((10000 - this.target.misschance) * (1 - (this.target.resistance * 0.15 / (this.level * 100)))))
    }
    updateStrength() {
        this.stats.str = this.base.str;
        this.stats.ap = this.base.ap;
        this.stats.apmod = this.base.apmod;
        this.stats.baseapmod = this.base.baseapmod;

        for (let name in this.auras) {
            if (this.auras[name].timer) {
                if (this.auras[name].stats.str)
                    this.stats.str += this.auras[name].stats.str;
                if (this.auras[name].stats.ap)
                    this.stats.ap += this.auras[name].stats.ap;
                if (this.auras[name].mult_stats.apmod)
                    this.stats.apmod *= (1 + this.auras[name].mult_stats.apmod / 100);
                if (this.auras[name].mult_stats.baseapmod)
                    this.stats.baseapmod *= (1 + this.auras[name].mult_stats.baseapmod / 100);
            }
        }
        this.stats.str = ~~(this.stats.str * this.stats.strmod);
        this.stats.ap += this.stats.str * 2;
        this.stats.block = this.base.block + ~~(this.stats.str / 20);

        if (this.stats.baseapmod != 1)
            this.stats.ap += ~~((this.base.aprace + this.stats.str * 2) * (this.stats.baseapmod - 1));
        this.stats.ap = ~~(this.stats.ap * this.stats.apmod);
    }
    updateAP() {
        this.stats.ap = this.base.ap;
        this.stats.apmod = this.base.apmod;
        this.stats.baseapmod = this.base.apmod;
        for (let name in this.auras) {
            if (this.auras[name].timer && this.auras[name].stats.ap) {
                this.stats.ap += this.auras[name].stats.ap;
            }
            if (this.auras[name].timer && this.auras[name].mult_stats.apmod) {
                this.stats.apmod *= (1 + this.auras[name].mult_stats.apmod / 100);
            }
            if (this.auras[name].timer && this.auras[name].mult_stats.baseapmod) {
                this.stats.baseapmod *= (1 + this.auras[name].mult_stats.baseapmod / 100);
            }
        }
        this.stats.ap += this.stats.str * 2;

        if (this.stats.baseapmod != 1)
            this.stats.ap += ~~((this.base.aprace + this.stats.str * 2) * (this.stats.baseapmod - 1));
        this.stats.ap = ~~(this.stats.ap * this.stats.apmod);
    }
    updateHaste() {
        this.stats.haste = this.base.haste;
        if (this.auras.flurry && this.auras.flurry.timer)
            this.stats.haste *= (1 + this.auras.flurry.mult_stats.haste / 100);
        if (this.auras.berserking && this.auras.berserking.timer)
            this.stats.haste *= (1 + this.auras.berserking.mult_stats.haste / 100);
        if (this.auras.empyrean && this.auras.empyrean.timer)
            this.stats.haste *= (1 + this.auras.empyrean.mult_stats.haste / 100);
        if (this.auras.eskhandar && this.auras.eskhandar.timer)
            this.stats.haste *= (1 + this.auras.eskhandar.mult_stats.haste / 100);
        if (this.auras.pummeler && this.auras.pummeler.timer)
            this.stats.haste *= (1 + this.auras.pummeler.mult_stats.haste / 100);
        if (this.auras.spider && this.auras.spider.timer)
            this.stats.haste *= (1 + this.auras.spider.mult_stats.haste / 100);
        if (this.auras.jujuflurry && this.auras.jujuflurry.timer)
            this.stats.haste *= (1 + this.auras.jujuflurry.mult_stats.haste / 100);

    }
    updateHasteDamage() {
        // MOD_ATTACKSPEED works differently than regular haste, lowers dmg
        let mod = 1;
        if (this.auras.jujuflurry && this.auras.jujuflurry.timer)
            mod *= (1 + this.auras.jujuflurry.mult_stats.haste / 100);

        this.mh.mindmg = this.mh.basemindmg / mod;
        this.mh.maxdmg = this.mh.basemaxdmg / mod;
        if (this.oh) {
            this.oh.mindmg = this.oh.basemindmg / mod;
            this.oh.maxdmg = this.oh.basemaxdmg / mod;
        }
    }
    updateBonusDmg() {
        let bonus = 0;
        if (this.auras.zeal && this.auras.zeal.timer)
            bonus += this.auras.zeal.stats.moddmgdone;
        if (this.auras.zandalarian && this.auras.zandalarian.timer)
            bonus += this.auras.zandalarian.stats.moddmgdone;
        this.stats.moddmgdone = this.base.moddmgdone + bonus;
        this.stats.moddmgtaken = this.base.moddmgtaken;
        this.mh.bonusdmg = this.mh.basebonusdmg;
        if (this.oh)
            this.oh.bonusdmg = this.oh.basebonusdmg;
    }
    updateArmorReduction() {
        this.target.armor = this.target.basearmorbuffed;
        if (this.auras.annihilator && this.auras.annihilator.timer)
            this.target.armor = Math.max(this.target.armor - (this.auras.annihilator.stacks * this.auras.annihilator.armor), 0);
        if (this.auras.rivenspike && this.auras.rivenspike.timer)
            this.target.armor = Math.max(this.target.armor - (this.auras.rivenspike.stacks * this.auras.rivenspike.armor), 0);
        if (this.auras.bonereaver && this.auras.bonereaver.timer)
            this.target.armor = Math.max(this.target.armor - (this.auras.bonereaver.stacks * this.auras.bonereaver.armor), 0);
        if (this.auras.swarmguard && this.auras.swarmguard.timer)
            this.target.armor = Math.max(this.target.armor - (this.auras.swarmguard.stacks * this.auras.swarmguard.armor), 0);
        this.armorReduction = this.getArmorReduction();
    }
    updateDmgMod() {
        this.stats.dmgmod = this.base.dmgmod;
        this.stats.spelldmgmod = this.base.spelldmgmod;
        for (let name in this.auras) {
            if (this.auras[name].timer && this.auras[name].mult_stats.dmgmod)
                this.stats.dmgmod *= (1 + this.auras[name].mult_stats.dmgmod / 100);
        }
    }
    getGlanceReduction(weapon) {
        let diff = this.target.defense - this.stats['skill_' + weapon.type];
        let low = Math.max(Math.min(1.3 - 0.05 * diff, 0.91), 0.01);
        let high = Math.max(Math.min(1.2 - 0.03 * diff, 0.99), 0.2);
        return simulationRandom() * (high - low) + low;
    }
    getGlanceChance(weapon) {
        return 10 + Math.max(this.target.defense - Math.min(this.level * 5, this.stats['skill_' + weapon.type]), 0) * 2;
    }
    getMissChance(weapon) {
        let diff = this.target.defense - this.stats['skill_' + weapon.type];
        let miss = 5 + (diff > 10 ? diff * 0.2 : diff * 0.1);
        miss -= (diff > 10 ? this.stats.hit - 1 : this.stats.hit);
        return miss;
    }
    getDWMissChance(weapon) {
        let diff = this.target.defense - this.stats['skill_' + weapon.type];
        let miss = 5 + (diff > 10 ? diff * 0.2 : diff * 0.1);
        miss = miss * 0.8 + 20;
        miss -= (diff > 10 ? this.stats.hit - 1 : this.stats.hit);
        return miss;
    }
    getCritChance() {
        let crit = this.stats.crit + (this.talents.crit || 0) + (this.level - this.target.level) * 1;
        if ((this.target.level - this.level)  >= 3) crit -= 1.8;
        return Math.max(crit, 0);
    }
    getDodgeChance(weapon) {
        return Math.max(5 - this.target.dodge + (this.target.defense - this.stats['skill_' + weapon.type]) * 0.1, 0);
    }
    getArmorReduction() {
        if (isNaN(this.target.armor)) this.target.armor = 0;
        let r = this.target.armor / (this.target.armor + 400 + 85 * this.level);
        return r > 0.75 ? 0.75 : r;
    }
    addRage(dmg, result, weapon, spell) {
        if (!spell || spell instanceof HeroicStrike || spell instanceof Cleave) {
            if (result != RESULT.MISS && result != RESULT.DODGE && this.talents.umbridledwrath && rng10k() < this.talents.umbridledwrath * 100) {
                this.rage += this.mode === 'forever' && weapon.twohand ? 2 : 1;
            }
        }
        if (spell) {
            if (spell instanceof Execute) spell.result = result;
            if (result == RESULT.MISS || result == RESULT.DODGE) {
                this.rage += spell.refund ? spell.cost * 0.8 : 0;
            }
        }
        else if (this.mode === 'forever') {
            if (result != RESULT.MISS && result != RESULT.DODGE) {
                // Base weapon speed in seconds; crits, glances and haste do not change rage per hit.
                this.rage += weapon.speed * (weapon.twohand ? 4.5 : 3.46) *
                    (weapon.offhand ? 0.5 * (1 + this.talents.offragebonus) : 1);
            }
        }
        else {
            if (result == RESULT.DODGE) {
                this.rage += (weapon.avgdmg() / this.rageconversion) * 7.5 * 0.75;
            }
            else if (result != RESULT.MISS) {
                this.rage += (dmg / this.rageconversion) * 7.5;
            }
        }
        if (this.rage > this.ragecap) this.rage = this.ragecap;

    }
    steptimer(a) {
        if (this.timer <= a) {
            this.timer = 0;
            /* start-log */ if (this.logging) this.log('Global CD off'); /* end-log */
            return true;
        }
        else {
            this.timer -= a;
            return false;
        }
    }
    stepitemtimer(a) {
        if (this.itemtimer <= a) {
            this.itemtimer = 0;
            /* start-log */ if (this.logging) this.log('Item CD off'); /* end-log */
            return true;
        }
        else {
            this.itemtimer -= a;
            return false;
        }
    }
    stepstancetimer(a) {
        if (this.stancetimer <= a) {
            this.stancetimer = 0;
            /* start-log */ if (this.logging) this.log('Stance CD off'); /* end-log */
            return true;
        }
        else {
            this.stancetimer -= a;
            return false;
        }
    }
    stepdodgetimer(a) {
        if (this.dodgetimer <= a) {
            this.dodgetimer = 0;
        }
        else {
            this.dodgetimer -= a;
        }
    }
    stepauras(nobleeds) {
        if (this.auras.enrage?.timer) this.auras.enrage.step();
        if (this.auras.sweepingstrikes?.timer) this.auras.sweepingstrikes.step();

        if (this.mh.proc1 && this.mh.proc1.spell && this.mh.proc1.spell.timer) this.mh.proc1.spell.step();
        if (this.mh.proc2 && this.mh.proc2.spell && this.mh.proc2.spell.timer) this.mh.proc2.spell.step();
        if (this.oh && this.oh.proc1 && this.oh.proc1.spell && this.oh.proc1.spell.timer) this.oh.proc1.spell.step();
        if (this.oh && this.oh.proc2 && this.oh.proc2.spell && this.oh.proc2.spell.timer) this.oh.proc2.spell.step();

        if (this.auras.mightyragepotion && this.auras.mightyragepotion.firstuse && this.auras.mightyragepotion.timer) this.auras.mightyragepotion.step();
        if (this.auras.recklessness && this.auras.recklessness.firstuse && this.auras.recklessness.timer) this.auras.recklessness.step();
        if (this.auras.deathwish && this.auras.deathwish.firstuse && this.auras.deathwish.timer) this.auras.deathwish.step();
        if (this.auras.cloudkeeper && this.auras.cloudkeeper.firstuse && this.auras.cloudkeeper.timer) this.auras.cloudkeeper.step();
        if (this.auras.flask && this.auras.flask.firstuse && this.auras.flask.timer) this.auras.flask.step();
        if (this.auras.eluneslight?.timer) this.auras.eluneslight.step();
        if (this.auras.eureka?.timer) this.auras.eureka.step();
        if (this.auras.bloodfury && this.auras.bloodfury.firstuse && this.auras.bloodfury.timer) this.auras.bloodfury.step();
        if (this.auras.berserking && this.auras.berserking.firstuse && this.auras.berserking.timer) this.auras.berserking.step();
        if (this.auras.slayer && this.auras.slayer.firstuse && this.auras.slayer.timer) this.auras.slayer.step();
        if (this.auras.spider && this.auras.spider.firstuse && this.auras.spider.timer) this.auras.spider.step();
        if (this.auras.earthstrike && this.auras.earthstrike.firstuse && this.auras.earthstrike.timer) this.auras.earthstrike.step();
        if (this.auras.pummeler && this.auras.pummeler.firstuse && this.auras.pummeler.timer) this.auras.pummeler.step();
        if (this.auras.swarmguard && this.auras.swarmguard.firstuse && this.auras.swarmguard.timer) this.auras.swarmguard.step();
        if (this.auras.zandalarian && this.auras.zandalarian.firstuse && this.auras.zandalarian.timer) this.auras.zandalarian.step();
        if (this.auras.battleshout && this.auras.battleshout.timer) this.auras.battleshout.step();
        if (this.auras.jujuflurry && this.auras.jujuflurry.timer) this.auras.jujuflurry.step();

        if (this.mh.windfury && this.mh.windfury.timer) this.mh.windfury.step();
        if (this.trinketproc1 && this.trinketproc1.spell && this.trinketproc1.spell.timer) this.trinketproc1.spell.step();
        if (this.trinketproc2 && this.trinketproc2.spell && this.trinketproc2.spell.timer) this.trinketproc2.spell.step();
        if (this.attackproc1 && this.attackproc1.spell && this.attackproc1.spell.timer) this.attackproc1.spell.step();
        if (this.attackproc2 && this.attackproc2.spell && this.attackproc2.spell.timer) this.attackproc2.spell.step();

        if (!nobleeds && this.auras.deepwounds && this.auras.deepwounds.timer) this.auras.deepwounds.step();
        if (!nobleeds && this.auras.rend && this.auras.rend.timer) this.auras.rend.step();
        if (this.auras.berserkerrage && this.auras.berserkerrage.timer) this.auras.berserkerrage.step();

        if (!nobleeds && this.adjacent) {
            if (this.auras.deepwounds2 && this.auras.deepwounds2.timer) this.auras.deepwounds2.step();
            if (this.auras.deepwounds3 && this.auras.deepwounds3.timer) this.auras.deepwounds3.step();
            if (this.auras.deepwounds4 && this.auras.deepwounds4.timer) this.auras.deepwounds4.step();
        }
    }
    endauras() {
        if (this.auras.enrage?.timer) this.auras.enrage.end();
        if (this.auras.sweepingstrikes?.timer) this.auras.sweepingstrikes.end();

        if (this.mh.proc1 && this.mh.proc1.spell && this.mh.proc1.spell.timer) this.mh.proc1.spell.end();
        if (this.mh.proc2 && this.mh.proc2.spell && this.mh.proc2.spell.timer) this.mh.proc2.spell.end();
        if (this.oh && this.oh.proc1 && this.oh.proc1.spell && this.oh.proc1.spell.timer) this.oh.proc1.spell.end();
        if (this.oh && this.oh.proc2 && this.oh.proc2.spell && this.oh.proc2.spell.timer) this.oh.proc2.spell.end();

        if (this.auras.mightyragepotion && this.auras.mightyragepotion.firstuse && this.auras.mightyragepotion.timer) this.auras.mightyragepotion.end();
        if (this.auras.recklessness && this.auras.recklessness.firstuse && this.auras.recklessness.timer) this.auras.recklessness.end();
        if (this.auras.deathwish && this.auras.deathwish.firstuse && this.auras.deathwish.timer) this.auras.deathwish.end();
        if (this.auras.cloudkeeper && this.auras.cloudkeeper.firstuse && this.auras.cloudkeeper.timer) this.auras.cloudkeeper.end();
        if (this.auras.flask && this.auras.flask.firstuse && this.auras.flask.timer) this.auras.flask.end();
        if (this.auras.eluneslight?.timer) this.auras.eluneslight.end();
        if (this.auras.eureka?.timer) this.auras.eureka.end();
        if (this.auras.bloodfury && this.auras.bloodfury.firstuse && this.auras.bloodfury.timer) this.auras.bloodfury.end();
        if (this.auras.berserking && this.auras.berserking.firstuse && this.auras.berserking.timer) this.auras.berserking.end();
        if (this.auras.slayer && this.auras.slayer.firstuse && this.auras.slayer.timer) this.auras.slayer.end();
        if (this.auras.spider && this.auras.spider.firstuse && this.auras.spider.timer) this.auras.spider.end();
        if (this.auras.gabbar && this.auras.gabbar.firstuse && this.auras.gabbar.timer) this.auras.gabbar.end();
        if (this.auras.earthstrike && this.auras.earthstrike.firstuse && this.auras.earthstrike.timer) this.auras.earthstrike.end();
        if (this.auras.pummeler && this.auras.pummeler.firstuse && this.auras.pummeler.timer) this.auras.pummeler.end();
        if (this.auras.swarmguard && this.auras.swarmguard.firstuse && this.auras.swarmguard.timer) this.auras.swarmguard.end();
        if (this.auras.zandalarian && this.auras.zandalarian.firstuse && this.auras.zandalarian.timer) this.auras.zandalarian.end();
        if (this.auras.battleshout && this.auras.battleshout.timer) this.auras.battleshout.end();
        if (this.auras.jujuflurry && this.auras.jujuflurry.timer) this.auras.jujuflurry.end();

        if (this.mh.windfury && this.mh.windfury.timer) this.mh.windfury.end();
        if (this.trinketproc1 && this.trinketproc1.spell && this.trinketproc1.spell.timer) this.trinketproc1.spell.end();
        if (this.trinketproc2 && this.trinketproc2.spell && this.trinketproc2.spell.timer) this.trinketproc2.spell.end();
        if (this.attackproc1 && this.attackproc1.spell && this.attackproc1.spell.timer) this.attackproc1.spell.end();
        if (this.attackproc2 && this.attackproc2.spell && this.attackproc2.spell.timer) this.attackproc2.spell.end();

        if (this.auras.flurry && this.auras.flurry.timer) this.auras.flurry.end();
        if (this.auras.deepwounds && this.auras.deepwounds.timer) this.auras.deepwounds.end();
        if (this.auras.deepwounds2 && this.auras.deepwounds2.timer) this.auras.deepwounds2.end();
        if (this.auras.deepwounds3 && this.auras.deepwounds3.timer) this.auras.deepwounds3.end();
        if (this.auras.deepwounds4 && this.auras.deepwounds4.timer) this.auras.deepwounds4.end();
        if (this.auras.rend && this.auras.rend.timer) this.auras.rend.end();
        if (this.auras.berserkerrage && this.auras.berserkerrage.timer) this.auras.berserkerrage.end();

    }
    rollweapon(weapon) {
        let tmp = 0;
        let roll = rng10k();
        // Only Classic removes the dual-wield miss penalty while a strike is queued.
        tmp += Math.max(this.mode !== 'forever' && this.nextswinghs ? weapon.miss : weapon.dwmiss, 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        tmp += weapon.dodge * 100;
        if (roll < tmp) return RESULT.DODGE;
        tmp += weapon.glanceChance * 100;
        if (roll < tmp) return RESULT.GLANCE;
        tmp += (this.crit + weapon.crit + (this.mode === 'forever' ? weapon.racialcrit || 0 : 0)) * 100;
        if (roll < tmp) return RESULT.CRIT;
        return RESULT.HIT;
    }
    rollmeleespell(spell, weapon) {
        if (!weapon) weapon = this.mh;
        let tmp = 0;
        let roll = rng10k();
        tmp += Math.max(weapon.miss, 0) * 100;
        if (roll < tmp) return RESULT.MISS;
        if (spell.canDodge) {
            tmp += weapon.dodge * 100;
            if (roll < tmp) return RESULT.DODGE;
        }
        if (!spell.weaponspell) {
            roll = rng10k();
            tmp = 0;
        }
        let crit = this.crit + weapon.crit + (this.mode === 'forever' ? weapon.racialcrit || 0 : 0);
        if (spell instanceof Overpower)
            crit += this.talents.overpowercrit;
        tmp += crit * 100;
        if (roll < tmp && !spell.nocrit) return RESULT.CRIT;
        return RESULT.HIT;
    }
    rollmagicspell(spell) {
        let miss = this.target.misschance;
        if (spell.binaryspell) 
            miss = this.target.binaryresist;

        if (rng10k() < miss) 
            return RESULT.MISS;
        if (rng10k() < (this.stats.spellcrit * 100)) 
            return RESULT.CRIT;
        return RESULT.HIT;
    }
    attackmh(weapon, adjacent, damageSoFar) {
        this.stepauras();

        let spell = null;
        let procdmg = 0;
        let result;

        if (this.nextswinghs) {
            this.nextswinghs = false;
            if (this.spells.heroicstrike && this.spells.heroicstrike.cost <= this.rage) {
                result = this.rollmeleespell(this.spells.heroicstrike);
                spell = this.spells.heroicstrike;
                this.rage -= spell.cost;
            }
            else if (this.spells.cleave && this.spells.cleave.cost <= this.rage) {
                result = this.rollmeleespell(this.spells.cleave);
                spell = this.spells.cleave;
                if (adjacent) this.rage -= spell.cost;
            }
            else {
                result = this.rollweapon(weapon);
                /* start-log */ if (this.logging) this.log(`Heroic Strike auto canceled`); /* end-log */
            }
        }
        else {
            result = this.rollweapon(weapon);
        }

        const empowered = spell && !adjacent ? this.beginEureka(spell) : false;
        let dmg = weapon.dmg(spell) * (spell?.eurekamod || 1);
        procdmg = this.procattack(spell, weapon, result, adjacent, damageSoFar);

        if (result == RESULT.DODGE) {
            this.dodgetimer = 5000;
        }
        if (result == RESULT.GLANCE) {
            dmg *= this.getGlanceReduction(weapon);
        }
        if (result == RESULT.CRIT) {
            // Impale increases the critical damage bonus for specials.
            let critmod = 1 + 1 * (1 + (spell ? this.talents.abilitiescrit : 0))
            dmg *= critmod;
            this.proccrit(false, adjacent);
        }

        weapon.use();
        let done = this.dealdamage(dmg, result, weapon, spell, adjacent);
        if (spell) {
            spell.totaldmg += done;
            if (!adjacent) spell.data[result]++;
        }
        else {
            weapon.totaldmg += done;
            weapon.data[result]++;
        }
        weapon.totalprocdmg += procdmg;
        /* start-log */ if (this.logging) this.log(`${spell ? spell.name + ' for' : 'Main hand attack for'} ${~~done} (${Object.keys(RESULT)[result]})${adjacent ? ' (Adjacent)' : ''}`); /* end-log */

        if (spell instanceof Cleave && !adjacent) {
            this.nextswinghs = true;
            done += this.attackmh(weapon, 1, done);
        }
        if (empowered) this.auras.eureka.consume();
        return done + procdmg;
    }
    attackoh(weapon) {
        this.stepauras();

        let procdmg = 0;
        let result;
        result = this.rollweapon(weapon);

        let dmg = weapon.dmg();
        procdmg = this.procattack(null, weapon, result);

        if (result == RESULT.DODGE) {
            this.dodgetimer = 5000;
        }
        if (result == RESULT.GLANCE) {
            dmg *= this.getGlanceReduction(weapon);
        }
        if (result == RESULT.CRIT) {
            let critmod = 1 + 1
            dmg *= critmod;
            this.proccrit(true);
        }

        weapon.use();
        let done = this.dealdamage(dmg, result, weapon);
        weapon.data[result]++;
        weapon.totaldmg += done;
        weapon.totalprocdmg += procdmg;
        /* start-log */ if (this.logging) this.log(`Off hand attack for ${done + procdmg} (${Object.keys(RESULT)[result]})${this.nextswinghs ? ' (HS queued)' : ''}`); /* end-log */
        return done + procdmg;
    }
    beginEureka(spell) {
        const eureka = this.auras.eureka;
        if (!eureka) return false;
        const empowered = !!(eureka?.stacks && eureka.eligible(spell));
        spell.eurekamod = empowered ? 1.1 : 1;
        return empowered;
    }
    cast(spell, delayedheroic, adjacent, damageSoFar) {
        let empowered = false;
        if (!adjacent) {
            this.stepauras();
            // Queued attacks consume a charge when the swing executes, not when queued.
            if (!(spell instanceof HeroicStrike) && !(spell instanceof Cleave)) empowered = this.beginEureka(spell);
            spell.use(delayedheroic);
        }
        if (spell.useonly) {
            if (empowered) this.auras.eureka.consume();
            /* start-log */ if (this.logging) this.log(`${spell.name} used`); /* end-log */
            return 0;
        }
        
        let dmg = spell.dmg() * this.mh.modifier * (spell.eurekamod || 1);
        if (dmg) dmg += this.stats.moddmgtaken;
        let result;
        if (spell.defenseType == DEFENSETYPE.MELEE) 
            result = this.rollmeleespell(spell);
        else if(spell.defenseType == DEFENSETYPE.MAGIC)
            result = this.rollmagicspell(spell);
        else
            result = RESULT.HIT;

        let procdmg = this.procattack(spell, this.mh, result, adjacent, damageSoFar);
        if (spell instanceof SunderArmor) {
            procdmg += this.procattack(spell, this.mh, result, adjacent, damageSoFar);
        }

        if (result == RESULT.MISS) {
            spell.failed();
        }
        else if (result == RESULT.DODGE) {
            spell.failed();
            this.dodgetimer = 5000;
        }
        else if (result == RESULT.CRIT) {
            let critmod;
            if (spell.defenseType == DEFENSETYPE.MAGIC) 
                critmod = 1 + 0.5 * (1 + this.talents.abilitiescrit);
            else
                critmod = 1 + 1 * (1 + this.talents.abilitiescrit);

            dmg *= critmod;
            this.proccrit(false, adjacent);
        }

        let done = this.dealdamage(dmg, result, this.mh, spell, adjacent);
        if (!adjacent) spell.data[result]++;
        spell.totaldmg += done;
        this.mh.totalprocdmg += procdmg;
        if (empowered) this.auras.eureka.consume();
        /* start-log */ if (this.logging) this.log(`${spell.name} for ${~~done} (${Object.keys(RESULT)[result]})${adjacent ? ' (Adjacent)' : ''}.`); /* end-log */
        return done + procdmg;
    }
    castoh(spell, adjacent, damageSoFar) {
        let dmg = spell.dmg(this.oh) * this.oh.modifier * (spell.eurekamod || 1);
        if (dmg) dmg += this.stats.moddmgtaken;
        let result = this.rollmeleespell(spell, this.oh);

        let procdmg = this.procattack(spell, this.oh, result, adjacent, damageSoFar);
        if (result == RESULT.MISS) {
            spell.failed();
        }
        else if (result == RESULT.DODGE) {
            spell.failed();
            this.dodgetimer = 5000;
        }
        else if (result == RESULT.CRIT) {
            let critmod = 1 + 1 * (1 + this.talents.abilitiescrit);
            dmg *= critmod;
            this.proccrit(true, adjacent);
        }

        let done = this.dealdamage(dmg, result, this.oh, spell, adjacent);
        spell.totaldmg += done;
        spell.offhandhit = false;
        this.oh.totalprocdmg += procdmg;
        /* start-log */ if (this.logging) this.log(`${spell.name} (OH) for ${~~done} (${Object.keys(RESULT)[result]})${adjacent ? ' (Adjacent)' : ''}.`); /* end-log */
        return done + procdmg;
    }
    dealdamage(dmg, result, weapon, spell, adjacent) {
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            if(spell == null || spell.school == SCHOOL.PHYSICAL)
              dmg *= (1 - this.weaponArmorReduction(weapon));
            if (!adjacent) this.addRage(dmg, result, weapon, spell);
            if (dmg > 0 && (!spell || spell.defenseType === DEFENSETYPE.MELEE) && this.auras.touchofthegrave)
                this.auras.touchofthegrave.proc();
            if (dmg > 0 && !adjacent && (!spell || spell.defenseType === DEFENSETYPE.MELEE)) {
                if (this.talents.bloodthrill && this.auras.rend?.timer > step && this.auras.rend.stacks && rng10k() < this.talents.bloodthrill * 100)
                    this.bloodthrilltimer = 6000;
                const sweeping = this.auras.sweepingstrikes;
                if (this.adjacent && sweeping?.timer && sweeping.stacks) sweeping.copy(dmg);
            }
            if (spell instanceof SpearingStrike) this.mounted = false;
            return dmg;
        }
        else {
            if (!adjacent) this.addRage(dmg, result, weapon, spell);
            return 0;
        }
    }
    weaponArmorReduction(weapon) {
        if (this.mode !== 'forever' || !this.talents.weaponmasterarp ||
            (weapon.type !== WEAPONTYPE.MACE && weapon.type !== WEAPONTYPE.STAFF)) return this.armorReduction;
        const armor = this.target.armor * (1 - this.talents.weaponmasterarp);
        return Math.min(.75, armor / (armor + 400 + 85 * this.level));
    }
    proccrit(offhand, adjacent) {
        if (this.auras.flurry) this.auras.flurry.use();
        if (this.auras.deepwounds) {
            if (!adjacent) this.auras.deepwounds.use(offhand);
            else this.auras['deepwounds' + (~~rng(1,adjacent) + 1)].use(offhand);
        }
    }
    procattack(spell, weapon, result, adjacent, damageSoFar) {
        let procdmg = 0;
        let extras = 0;
        let batchedextras = 0;
        if (spell instanceof ThunderClap) return 0;
        if (spell instanceof ShieldSlam) {
            if (result != RESULT.MISS && result != RESULT.DODGE) {
                // procs at least windfury - more info needed
                if (weapon.windfury && !this.auras.windfury.timer && !damageSoFar && rng10k() < 2000) {
                    weapon.windfury.use();
                }
            }
            return 0;
        }
        if (result != RESULT.MISS && result != RESULT.DODGE) {
            if (spell instanceof Execute) {
                this.rage = 0;
            }
            if (weapon.proc1 && !weapon.proc1.extra && rng10k() < weapon.proc1.chance && !(weapon.proc1.gcd && this.timer && this.timer < 1500)) {
                if (weapon.proc1.spell) weapon.proc1.spell.use();
                if (weapon.proc1.magicdmg) procdmg += weapon.proc1.chance == 10000 ? weapon.proc1.magicdmg : this.magicproc(weapon.proc1);
                if (weapon.proc1.physdmg) {
                    let dmg = this.physproc(weapon.proc1.physdmg);
                    if (dmg > 0 && weapon.proc1.phantom) dmg += this.phantomproc(weapon)
                    procdmg += dmg
                }
                /* start-log */ if (this.logging) this.log(`${weapon.name} proc ${procdmg ? 'for ' + ~~procdmg : ''}`); /* end-log */
            }
            // Extra attacks roll only once per multi target attack
            if (weapon.proc1 && weapon.proc1.extra && !damageSoFar && rng10k() < weapon.proc1.chance && !(weapon.proc1.gcd && this.timer && this.timer < 1500)) {
                // Multiple extras procs off a non spel will only grant extra attack(s) from one source
                if (spell) this.extraattacks += weapon.proc1.extra;
                else extras = weapon.proc1.extra;
                /* start-log */ if (this.logging) this.log(`${weapon.name} proc ${procdmg ? 'for ' + ~~procdmg : ''}`); /* end-log */
            }
            if (weapon.proc2 && rng10k() < weapon.proc2.chance) {
                if (weapon.proc2.spell) weapon.proc2.spell.use();
                if (weapon.proc2.magicdmg) procdmg += this.magicproc(weapon.proc2);
                /* start-log */ if (this.logging) this.log(`${weapon.name} proc ${procdmg ? 'for ' + ~~procdmg : ''}`); /* end-log */
            }
            if (this.trinketproc1 && !this.trinketproc1.extra && rng10k() < this.trinketproc1.chance) {
                if (this.trinketproc1.magicdmg) procdmg += this.magicproc(this.trinketproc1);
                if (this.trinketproc1.spell) this.trinketproc1.spell.use();
                /* start-log */ if (this.logging) this.log(`Trinket 1 proc`); /* end-log */
            }
            if (this.trinketproc1 && this.trinketproc1.extra && !damageSoFar && rng10k() < this.trinketproc1.chance) {
                if (!this.trinketproc1.cooldown || !this.trinketproc1.usestep || step > this.trinketproc1.usestep) {
                    if (this.trinketproc1.cooldown) this.trinketproc1.usestep = step + this.trinketproc1.cooldown;
                    if (spell) this.batchedextras += this.trinketproc1.extra;
                    else batchedextras = this.trinketproc1.extra;
                    /* start-log */ if (this.logging) this.log(`Trinket 1 proc`); /* end-log */
                }
            }
            if (this.trinketproc2 && !this.trinketproc2.extra  && rng10k() < this.trinketproc2.chance) {
                if (this.trinketproc2.magicdmg) procdmg += this.magicproc(this.trinketproc2);
                if (this.trinketproc2.spell) this.trinketproc2.spell.use();
                /* start-log */ if (this.logging) this.log(`Trinket 2 proc`); /* end-log */
            }
            if (this.trinketproc2 && this.trinketproc2.extra && !damageSoFar && rng10k() < this.trinketproc2.chance) {
                if (!this.trinketproc2.cooldown || !this.trinketproc2.usestep || step > this.trinketproc2.usestep) {
                    if (this.trinketproc2.cooldown) this.trinketproc2.usestep = step + this.trinketproc2.cooldown;
                    if (spell) this.batchedextras += this.trinketproc2.extra;
                    else batchedextras = this.trinketproc2.extra;
                    /* start-log */ if (this.logging) this.log(`Trinket 2 proc`); /* end-log */
                }
            }
            if (this.attackproc1 && rng10k() < this.attackproc1.chance) {
                if (this.attackproc1.magicdmg) { 
                    procdmg += this.attackproc1.chance == 10000 ? this.attackproc1.magicdmg : this.magicproc(this.attackproc1);
                    /* start-log */ if (this.logging) this.log(`Attack proc for ${procdmg}`); /* end-log */
                }
                if (this.attackproc1.spell) this.attackproc1.spell.use();
            }
            if (this.attackproc2 && rng10k() < this.attackproc2.chance) {
                if (this.attackproc2.magicdmg) { 
                    procdmg += this.attackproc2.chance == 10000 ? this.attackproc2.magicdmg : this.magicproc(this.attackproc2);
                    /* start-log */ if (this.logging) this.log(`Attack proc for ${procdmg}`); /* end-log */
                }
                if (this.attackproc2.spell) this.attackproc2.spell.use();
            }
            // Sword spec shouldnt be able to proc itself
            if (this.talents.swordproc && weapon.type == WEAPONTYPE.SWORD && !damageSoFar && this.swordspecstep != step && rng10k() < this.talents.swordproc * 100) {
                this.swordspecstep = step;
                if (spell) this.extraattacks++;
                else extras++;
                /* start-log */ if (this.logging) this.log(`Sword talent proc`); /* end-log */
            }
            if (weapon.windfury && !this.auras.windfury.timer && !damageSoFar && rng10k() < 2000) {
                if (!spell) extras = 0;
                weapon.windfury.use();
            }
            if (this.auras.swarmguard && this.auras.swarmguard.timer && rng10k() < this.auras.swarmguard.chance) {
                this.auras.swarmguard.proc();
            }
            if (this.auras.zandalarian && this.auras.zandalarian.timer) {
                this.auras.zandalarian.proc();
            }
            if (this.dragonbreath && rng10k() < 500) {
                procdmg += this.magicproc({ magicdmg: 60, coeff: 1 });
            }
            if (extras) this.extraattacks += extras;
            if (batchedextras) this.batchedextras += batchedextras;
        }
        if (!spell && this.auras.flurry && this.auras.flurry.stacks)
            this.auras.flurry.proc();
        if (!spell && this.mh.windfury && this.mh.windfury.stacks)
            this.mh.windfury.proc();
        return procdmg;
    }
    phantomproc(weapon) {
        let dmg = 0;
        if (rng10k() < weapon.proc1.chance) {
            dmg += this.physproc(weapon.proc1.physdmg);
            if (dmg > 0) dmg += this.phantomproc(weapon)
        }
        if (weapon.proc2 && rng10k() < weapon.proc2.chance) {
            if (weapon.proc2.spell) weapon.proc2.spell.use();
            if (weapon.proc2.magicdmg) dmg += this.magicproc(weapon.proc2);
            /* start-log */ if (this.logging) this.log(`${weapon.name} proc`); /* end-log */
        }
        return dmg;
    }
    magicproc(proc) {
        let mod = 1;
        let miss = this.target.misschance;
        let dmg = proc.magicdmg;
        if (proc.binaryspell) miss = this.target.binaryresist;
        else mod *= this.target.mitigation;
        if (rng10k() < miss) return 0;
        if (rng10k() < (this.stats.spellcrit * 100)) mod *= 1 + 0.5;
        if (proc.coeff) dmg += this.spelldamage * proc.coeff * (this.mode === 'forever' && this.auras.bloodfury?.timer ? 1.1 : 1);
        return (dmg * mod * this.stats.spelldmgmod);
    }
    physproc(dmg) {
        let tmp = 0;
        let roll = rng10k();
        tmp += Math.max(this.mh.miss, 0) * 100;
        if (roll < tmp) dmg = 0;
        tmp += this.mh.dodge * 100;
        if (roll < tmp) { dmg = 0; }
        roll = rng10k();
        let crit = this.crit + this.mh.crit;
        if (roll < (crit * 100)) dmg *= 1 + 1;
        return dmg * this.stats.dmgmod * this.mh.modifier;
    }
    serializeSimulationSpec(simConfig) {
        const scalarProperties = (value) => {
            const result = {};
            for (const key in value) {
                const property = value[key];
                if (typeof property == 'number') {
                    if (Number.isFinite(property)) result[key] = property;
                }
                else if (typeof property == 'string' || typeof property == 'boolean') {
                    result[key] = property;
                }
            }
            return result;
        };

        const spellKeys = new Map(Object.entries(this.spells).map(([key, value]) => [value, key]));
        const auraEntries = Object.entries(this.auras);
        const stanceDefinitions = [
            ['battlestance', BattleStance],
            ['berserkerstance', BerserkerStance],
            ['defensivestance', DefensiveStance],
        ];
        const existingAuraKeys = new Set(auraEntries.map(([key]) => key));
        for (const [key, Stance] of stanceDefinitions) {
            if (!existingAuraKeys.has(key)) auraEntries.push([key, new Stance(this)]);
        }
        const auraKeys = new Map(auraEntries.map(([key, value]) => [value, key]));

        const reference = (value, context) => {
            if (auraKeys.has(value)) return { spellAura: auraKeys.get(value) };
            if (spellKeys.has(value)) return { spellSpell: spellKeys.get(value) };
            throw new Error(`Cannot serialize ${context}: referenced action is not in player spells or auras`);
        };
        const serializeProc = (proc, context) => {
            if (!proc) return null;
            return {
                props: scalarProperties(proc),
                ...(proc.spell ? reference(proc.spell, context) : {}),
            };
        };
        const serializeWeapon = (weapon, context) => {
            if (!weapon) return null;
            return {
                props: scalarProperties(weapon),
                proc1: serializeProc(weapon.proc1, `${context}.proc1`),
                proc2: serializeProc(weapon.proc2, `${context}.proc2`),
                windfuryAura: weapon.windfury ? auraKeys.get(weapon.windfury) : null,
            };
        };
        const serializeSpell = ([key, spell]) => ({
            key,
            kind: spell.constructor.name,
            props: scalarProperties(spell),
            weapon: this.oh && spell.weapon === this.oh ? 'oh' : 'mh',
            ...(spell.backupheroic ? {
                backupHeroic: {
                    kind: spell.backupheroic.constructor.name,
                    props: scalarProperties(spell.backupheroic),
                },
            } : {}),
        });
        const serializeAura = ([key, aura]) => ({
            key,
            kind: aura.constructor.name,
            props: {
                ...scalarProperties(aura),
                dataLength: aura.data ? aura.data.length : 0,
            },
            stats: scalarProperties(aura.stats || {}),
            multStats: scalarProperties(aura.mult_stats || {}),
        });
        const actionReference = (value, context) => {
            if (spellKeys.has(value)) return { type: 'spell', key: spellKeys.get(value) };
            if (auraKeys.has(value)) return { type: 'aura', key: auraKeys.get(value) };
            throw new Error(`Cannot serialize ${context}: action is not in player spells or auras`);
        };

        const prepOrder = this.preporder.map((descriptor) => {
            const isAura = Boolean(descriptor.aura);
            const key = descriptor.classname.toLowerCase();
            const actions = isAura ? this.auras : this.spells;
            if (!actions[key])
                throw new Error(`Cannot serialize prepOrder: missing ${isAura ? 'aura' : 'spell'} ${key}`);
            return { type: isAura ? 'aura' : 'spell', key };
        });

        return {
            version: 1,
            sim: scalarProperties(simConfig || {}),
            player: {
                props: {
                    ...scalarProperties(this),
                    shield: Boolean(this.shield),
                    batching: Number(simConfig && simConfig.batching) || 0,
                },
                base: scalarProperties(this.base),
                stats: scalarProperties(this.stats),
                target: scalarProperties(this.target),
                talents: scalarProperties(this.talents),
                weapons: {
                    mh: serializeWeapon(this.mh, 'main-hand weapon'),
                    oh: serializeWeapon(this.oh, 'off-hand weapon'),
                },
                spells: Object.entries(this.spells).map(serializeSpell),
                auras: auraEntries.map(serializeAura),
                links: {
                    normalSpells: this.normalspells.map((value) => actionReference(value, 'normalSpells')),
                    executeSpells: this.executespells.map((value) => actionReference(value, 'executeSpells')),
                    prepOrder,
                },
                procs: {
                    trinketproc1: serializeProc(this.trinketproc1, 'trinketproc1'),
                    trinketproc2: serializeProc(this.trinketproc2, 'trinketproc2'),
                    attackproc1: serializeProc(this.attackproc1, 'attackproc1'),
                    attackproc2: serializeProc(this.attackproc2, 'attackproc2'),
                },
            },
        };
    }
    serializeStats() {
        return {
            auras: this.auras,
            spells: this.spells,
            mh: this.mh,
            oh: this.oh,
        };
    }
    log(msg) {
        let color = 'GoldenRod';
        if (msg.indexOf('attack') > 1 || msg.indexOf('Global') > -1) color = 'Gray';
        else if (msg.indexOf('tick') > 1) color = 'Tomato';
        else if (msg.indexOf(' for ') > -1) color = 'DarkOrchid';
        else if (msg.indexOf('applied') > 1 || msg.indexOf('removed') > -1) color = '#17A8B6';
        console.log(`%c ${(step / 1000).toFixed(3).padStart(6,' ')} | ${this.rage.toFixed(2).padStart(6,' ')} | ${msg}`, `color: ${color}`);
    }
    switch(stance) {
        this.stance = stance;
        this.auras.battlestance.timer = 0;
        this.auras.berserkerstance.timer = 0;
        this.auras.defensivestance.timer = 0;
        if (stance == 'battle') this.auras.battlestance.timer = 1;
        if (stance == 'zerk') this.auras.berserkerstance.timer = 1;
        if (stance == 'def') this.auras.defensivestance.timer = 1;
        this.rage = Math.min(this.rage, this.talents.rageretained);
        this.stancetimer = 1000;
        this.updateAuras();
        /* start-log */ if (this.logging) this.log(`Switched to ${stance} stance`); /* end-log */
    }
    isValidStance(stance) {
        return this.stance == stance;
    }
}
