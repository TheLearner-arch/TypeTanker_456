// TYPE//TANK Local Storage & Records Engine
(function(window) {
    'use strict';

    const KEYS = {
        CALLSIGN: 'typetank_callsign',
        ASPECT_RATIO: 'typetank_aspect_ratio',
        CRT_ENABLED: 'typetank_crt_enabled',
        AUDIO_MUTED: 'typetank_audio_muted',
        ARSENAL_MODE: 'typetank_arsenal_mode',
        FLIGHT_LOGS: 'typetank_flight_logs',
        PERSONAL_BESTS: 'typetank_personal_bests'
    };

    const MODE_NAMES = {
        1: 'MODE 1 [ALPHA]',
        2: 'MODE 2 [BRAVO]',
        3: 'MODE 3 [CHARLIE]',
        4: 'MODE 4 [DELTA]'
    };

    const StorageEngine = {
        // --- Callsign ---
        getCallsign() {
            try {
                return (localStorage.getItem(KEYS.CALLSIGN) || '').trim() || 'GUEST-01';
            } catch (e) {
                return 'GUEST-01';
            }
        },

        setCallsign(callsign) {
            try {
                const cleaned = (callsign || 'GUEST-01').trim().toUpperCase().slice(0, 12);
                localStorage.setItem(KEYS.CALLSIGN, cleaned);
                return cleaned;
            } catch (e) {
                return 'GUEST-01';
            }
        },

        // --- Aspect Ratio ---
        getAspectRatio() {
            try {
                const val = localStorage.getItem(KEYS.ASPECT_RATIO);
                if (val === '16:9' || val === '4:3' || val === 'auto') return val;
                return 'auto';
            } catch (e) {
                return 'auto';
            }
        },

        setAspectRatio(ratio) {
            try {
                const val = (ratio === '16:9' || ratio === '4:3') ? ratio : 'auto';
                localStorage.setItem(KEYS.ASPECT_RATIO, val);
                return val;
            } catch (e) {
                return 'auto';
            }
        },

        // --- CRT Scanlines ---
        isCrtEnabled() {
            try {
                const val = localStorage.getItem(KEYS.CRT_ENABLED);
                return val === null ? true : val === 'true';
            } catch (e) {
                return true;
            }
        },

        setCrtEnabled(enabled) {
            try {
                localStorage.setItem(KEYS.CRT_ENABLED, enabled ? 'true' : 'false');
            } catch (e) {}
        },

        // --- Arsenal Mode (1, 2, 3, 4) ---
        getArsenalMode() {
            try {
                const val = parseInt(localStorage.getItem(KEYS.ARSENAL_MODE), 10);
                if (val >= 1 && val <= 4) return val;
                return 1;
            } catch (e) {
                return 1;
            }
        },

        setArsenalMode(mode) {
            try {
                const m = Math.max(1, Math.min(4, parseInt(mode, 10) || 1));
                localStorage.setItem(KEYS.ARSENAL_MODE, m.toString());
                return m;
            } catch (e) {
                return 1;
            }
        },

        getModeName(mode) {
            return MODE_NAMES[mode] || `MODE ${mode}`;
        },

        // --- Personal Bests per Mode ---
        getPersonalBests() {
            try {
                const data = localStorage.getItem(KEYS.PERSONAL_BESTS);
                if (data) {
                    return JSON.parse(data);
                }
            } catch (e) {}
            return {
                1: { score: 0, wpm: 0, date: null },
                2: { score: 0, wpm: 0, date: null },
                3: { score: 0, wpm: 0, date: null },
                4: { score: 0, wpm: 0, date: null }
            };
        },

        getPersonalBest(mode) {
            const all = this.getPersonalBests();
            return all[mode] || { score: 0, wpm: 0, date: null };
        },

        // --- Save Sortie Result & Check PB ---
        saveSortieResult(stats) {
            const mode = parseInt(stats.mode, 10) || 1;
            const pbMap = this.getPersonalBests();
            const prevPb = pbMap[mode] || { score: 0, wpm: 0, date: null };

            const isNewPb = stats.score > prevPb.score || (stats.score === prevPb.score && stats.wpm > prevPb.wpm && stats.score > 0);

            if (isNewPb) {
                pbMap[mode] = {
                    score: stats.score,
                    wpm: stats.wpm,
                    accuracy: stats.accuracy,
                    date: Date.now()
                };
                try {
                    localStorage.setItem(KEYS.PERSONAL_BESTS, JSON.stringify(pbMap));
                } catch (e) {}
            }

            // Create flight log entry
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const logEntry = {
                id: 'FL-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
                timestamp: Date.now(),
                dateStr: dateStr,
                callsign: stats.callsign || this.getCallsign(),
                mode: mode,
                modeName: this.getModeName(mode),
                score: stats.score,
                wpm: stats.wpm,
                accuracy: stats.accuracy,
                wordsDestroyed: stats.wordsDestroyed,
                maxCombo: stats.maxCombo,
                elapsedSeconds: stats.elapsedSeconds || 0,
                isPb: isNewPb
            };

            // Prepend to flight logs
            let logs = [];
            try {
                const raw = localStorage.getItem(KEYS.FLIGHT_LOGS);
                if (raw) logs = JSON.parse(raw);
                if (!Array.isArray(logs)) logs = [];
            } catch (e) {
                logs = [];
            }

            logs.unshift(logEntry);
            if (logs.length > 80) logs.pop(); // Cap history length

            try {
                localStorage.setItem(KEYS.FLIGHT_LOGS, JSON.stringify(logs));
            } catch (e) {}

            const scoreDelta = isNewPb ? (stats.score - prevPb.score) : (prevPb.score - stats.score);
            const wpmDelta = isNewPb ? (stats.wpm - prevPb.wpm) : (prevPb.wpm - stats.wpm);

            return {
                isNewPb,
                prevPb,
                currentPb: pbMap[mode],
                scoreDelta: Math.max(0, scoreDelta),
                wpmDelta: Math.max(0, wpmDelta),
                entry: logEntry
            };
        },

        // --- Get Filtered Flight Logs ---
        getFlightLogs(modeFilter = 'ALL') {
            try {
                const raw = localStorage.getItem(KEYS.FLIGHT_LOGS);
                if (!raw) return [];
                const logs = JSON.parse(raw);
                if (!Array.isArray(logs)) return [];

                if (modeFilter === 'ALL' || !modeFilter) {
                    return logs;
                }
                const m = parseInt(modeFilter, 10);
                return logs.filter(l => l.mode === m);
            } catch (e) {
                return [];
            }
        },

        // --- Lifetime Operator Stats ---
        getLifetimeStats() {
            const logs = this.getFlightLogs('ALL');
            const pbMap = this.getPersonalBests();

            let bestScore = 0;
            let maxWpm = 0;
            let peakAccuracy = 0;
            let totalWords = 0;

            for (const log of logs) {
                if (log.score > bestScore) bestScore = log.score;
                if (log.wpm > maxWpm) maxWpm = log.wpm;
                if (log.accuracy > peakAccuracy) peakAccuracy = log.accuracy;
                totalWords += (log.wordsDestroyed || 0);
            }

            // Also check PB map in case logs were cleared or updated
            for (let m = 1; m <= 4; m++) {
                if (pbMap[m] && pbMap[m].score > bestScore) bestScore = pbMap[m].score;
                if (pbMap[m] && pbMap[m].wpm > maxWpm) maxWpm = pbMap[m].wpm;
            }

            return {
                bestScore,
                maxWpm,
                peakAccuracy: Math.round(peakAccuracy),
                totalWordsDestroyed: totalWords,
                totalSorties: logs.length,
                modeBests: pbMap
            };
        },

        // --- Purge Logs ---
        purgeFlightLogs() {
            try {
                localStorage.removeItem(KEYS.FLIGHT_LOGS);
                localStorage.setItem(KEYS.PERSONAL_BESTS, JSON.stringify({
                    1: { score: 0, wpm: 0, date: null },
                    2: { score: 0, wpm: 0, date: null },
                    3: { score: 0, wpm: 0, date: null },
                    4: { score: 0, wpm: 0, date: null }
                }));
                return true;
            } catch (e) {
                return false;
            }
        }
    };

    window.TypeTankStorage = StorageEngine;

})(window);
