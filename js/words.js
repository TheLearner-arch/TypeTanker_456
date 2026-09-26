// TYPE//TANK Word Dictionaries & Exclusion Manager
(function(window) {
    'use strict';

    // Mode 1: Lowercase tactical / military / terminal words
    const MODE_1_WORDS = [
        "radar", "tank", "cannon", "turret", "armor", "laser", "bunker", "target", "vulcan", "ballistic",
        "perimeter", "hull", "vector", "orbital", "recon", "strike", "decoy", "shield", "matrix", "sensor",
        "patrol", "cipher", "convoy", "drone", "flare", "garrison", "intercept", "kinetic", "stealth", "warhead",
        "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet",
        "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango",
        "uniform", "victor", "whiskey", "xray", "yankee", "zulu", "ammo", "blast", "caliber", "deploy",
        "engine", "front", "grid", "hazard", "impact", "junction", "lock", "mortar", "neutral", "outpost",
        "pilot", "quantum", "rocket", "sonar", "tactical", "unit", "velocity", "weapon", "xenon", "yield",
        "zenith", "beacon", "charge", "defend", "engage", "fusion", "gunner", "howitzer", "ignition", "javelin",
        "krypton", "legion", "missile", "nexus", "optics", "plasma", "quarry", "reactor", "squad", "tracer",
        "uprising", "vortex", "watchdog", "crossfire", "battery", "barrage", "commando", "deflector", "emp", "flank",
        "grenade", "heavy", "infantry", "jamming", "kamikaze", "launcher", "minefield", "nightfall", "overlord", "protocol"
    ];

    // Mode 2: Lowercase + Uppercase (Proper nouns, Call signs, Military designations)
    const MODE_2_WORDS = [
        "Viper", "GhostSix", "EchoSeven", "DeltaForce", "AegisV", "IronClad", "WarHawk", "SkyGuard",
        "TitanIV", "CyberNet", "RedDawn", "StormFront", "BlackHawk", "ApexPredator", "NightStalker", "ShadowRun",
        "Vanguard", "Centurion", "Dreadnought", "FireStorm", "Goliath", "HellHound", "Interdictor", "Juggernaut",
        "Kraken", "Leviathan", "Marauder", "Nemesis", "OmegaSquad", "Phantom", "Quicksilver", "Razorback",
        "Scorpion", "Thunderbolt", "UltraMar", "Valkyrie", "Warmonger", "Xenomorph", "YellowJacket", "Zephyr",
        "Spectre", "Overwatch", "Paladin", "Ranger", "Sentinel", "TaskForce", "Valiant", "Warlock",
        "DarkStar", "FrostBite", "GrimReaper", "HawkEye", "IronSight", "LoneWolf", "MoonRaker", "NovaPrime",
        "OdinEye", "Polaris", "QuickDraw", "RogueOne", "SilverFox", "TopGun", "UrbanOps", "Vindicator",
        "WarLock", "ZeusFury", "CrossBow", "BattleAxe", "WarHammer", "BroadSword", "DragonFly", "NightHawk"
    ];

    // Mode 3: Lowercase + Uppercase + Numbers
    const MODE_3_WORDS = [
        "Squad5", "Tank99", "F16Raptor", "B52Strat", "Sector7", "Unit101", "v2.0Alpha", "Grid94",
        "Base08", "Echo12", "Target44", "Area51", "Hangar18", "Route66", "Type90", "M1A2Abrams",
        "T90MS", "Su57Felon", "MiG35", "ApacheAH64", "AC130Gun", "SR71Black", "B2Spirit", "F22Raptor",
        "Zone09", "P47Bolt", "B17Fort", "AK47Tact", "M4A1Carbine", "MP5KSub", "RPK74Heavy", "MG42Gun",
        "PanzerIV", "Tiger101", "Leopard2A7", "Challenger2", "K2Black", "BMP3Track", "BTR82Wheel", "T14Armata",
        "Sub707", "CVN78Ford", "DDG1000", "SSBN730", "Mark48", "AIM120AMRAAM", "AGM88HARM", "BGM109Tom",
        "Squadron9", "Outpost33", "Division88", "Brigade01", "Platoon4", "Fortress77", "Sentry04", "Echo99"
    ];

    // Mode 4: Lowercase + Uppercase + Numbers + Special Characters
    const MODE_4_WORDS = [
        "[tank-01]", "(8+9)", "{cmd-9}", "!alert!", "alpha#3", "turret:v4", "*target*", "&recon&",
        "<lock-on>", "[def-88]", "~sonic~", "+armor+", "$bounty$", "%breach%", "^strike^", "_stealth_",
        "|wall-9|", "\\vulcan/", "[f-16*]", "{sector-7}", "#hazard-9#", "!danger_zone!", "m1a2/v3", "t-90:ms",
        "<su-57>", "(v2.0+)", "[grid#42]", "$kill_zone$", "&escort-1&", "%critical%", "{core-x}", "*flank_09*",
        "[ammo:full]", "!breach-0!", "#code_red#", "(fire-now)", "{sys.halt}", "[ops:alpha]", "<radar*99>", "~emp_blast~",
        "+hull+hp+", "|barrier|", "gunner@1", "=target=", "[sub-lvl3]", "{run-cmd}", "!vulcan_fx!", "#base.101#",
        "(99*2)", "<aim:head>", "{auto_fire}", "[armor-99%]", "$score.x3$", "&squad#5&", "!warning!"
    ];

    // Exclusion and Cooldown Manager for Bonus Targets & Starting Letters
    class WordManager {
        constructor() {
            // Map of startingChar -> cooldown expiration timestamp (ms)
            this.cooldowns = new Map();
            // Set of starting characters currently active as falling red bonus targets
            this.activeBonusLetters = new Set();
            this.cooldownDurationMs = 3000; // 3 seconds exclusion cooldown
        }

        // Register that a red bonus target with starting character has spawned
        registerBonusSpawn(startingChar) {
            if (!startingChar) return;
            this.activeBonusLetters.add(startingChar.toLowerCase());
        }

        // Register that a red bonus target has been resolved (destroyed or reached bottom)
        registerBonusResolved(startingChar) {
            if (!startingChar) return;
            const lower = startingChar.toLowerCase();
            this.activeBonusLetters.delete(lower);
            // Apply cooldown window
            this.cooldowns.set(lower, Date.now() + this.cooldownDurationMs);
        }

        // Check if a starting character is currently excluded
        isCharExcluded(startingChar) {
            if (!startingChar) return false;
            const lower = startingChar.toLowerCase();
            
            // Check if actively falling as a bonus word
            if (this.activeBonusLetters.has(lower)) {
                return true;
            }

            // Check if within post-bonus cooldown window
            const expiry = this.cooldowns.get(lower);
            if (expiry) {
                if (Date.now() < expiry) {
                    return true;
                } else {
                    this.cooldowns.delete(lower);
                }
            }

            return false;
        }

        // Get pool of words based on mode number (1, 2, 3, 4)
        getPoolForMode(mode) {
            switch(parseInt(mode, 10)) {
                case 1:
                    return MODE_1_WORDS;
                case 2:
                    return MODE_2_WORDS;
                case 3:
                    return MODE_3_WORDS;
                case 4:
                    return MODE_4_WORDS;
                default:
                    return MODE_1_WORDS;
            }
        }

        // Get preview samples for a given mode
        getPreviewWords(mode, count = 4) {
            const pool = this.getPoolForMode(mode);
            const samples = [];
            const step = Math.floor(pool.length / count);
            for (let i = 0; i < count; i++) {
                const idx = (i * step + Math.floor(Math.random() * 3)) % pool.length;
                samples.push(pool[idx]);
            }
            return samples;
        }

        // Get a valid word to spawn that does not collide with active or excluded letters
        getSpawnWord(mode, activeScreenWords = [], isBonus = false) {
            const pool = this.getPoolForMode(mode);
            
            // Collect starting letters of all words currently on screen
            const activeFirstLetters = new Set();
            for (const item of activeScreenWords) {
                if (item && item.text && item.text.length > 0) {
                    activeFirstLetters.add(item.text[0].toLowerCase());
                }
            }

            // Filter pool
            const candidates = pool.filter(word => {
                if (!word || word.length === 0) return false;
                const firstChar = word[0].toLowerCase();
                
                // If red bonus word is falling with this letter or in cooldown, suppress
                if (this.isCharExcluded(firstChar)) {
                    return false;
                }

                // If this is to be a red bonus word, avoid letters already falling on screen
                // to make sure target lock on the bonus target is clean!
                if (isBonus && activeFirstLetters.has(firstChar)) {
                    return false;
                }

                return true;
            });

            // If candidates exist, pick one at random
            if (candidates.length > 0) {
                const choice = candidates[Math.floor(Math.random() * candidates.length)];
                return choice;
            }

            // Fallback: pick any word from pool whose starting char isn't actively an excluded bonus
            const fallback = pool.filter(w => !this.isCharExcluded(w[0]?.toLowerCase()));
            if (fallback.length > 0) {
                return fallback[Math.floor(Math.random() * fallback.length)];
            }

            return pool[Math.floor(Math.random() * pool.length)];
        }

        // Reset state on new game
        reset() {
            this.cooldowns.clear();
            this.activeBonusLetters.clear();
        }
    }

    window.TypeTankWords = {
        MODE_1_WORDS,
        MODE_2_WORDS,
        MODE_3_WORDS,
        MODE_4_WORDS,
        WordManager
    };

})(window);
