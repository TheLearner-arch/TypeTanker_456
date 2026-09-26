// TYPE//TANK Application Controller & State Machine
(function(window) {
    'use strict';

    // Application States
    const STATES = {
        LOGIN: 'LOGIN',
        SETTINGS: 'SETTINGS',
        INSTRUCTIONS: 'INSTRUCTIONS',
        GAME: 'GAME',
        RESULT: 'RESULT',
        RECORDS: 'RECORDS'
    };

    class ConfettiEffect {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.particles = [];
            this.animId = null;
            this.isActive = false;

            this.colors = ['#00ff66', '#ff2a4b', '#ffb000', '#00e5ff', '#ffffff', '#e040fb'];
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }

        resize() {
            if (!this.canvas) return;
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            this.canvas.width = Math.floor(rect.width * dpr);
            this.canvas.height = Math.floor(rect.height * dpr);
            this.ctx.resetTransform?.();
            this.ctx.scale(dpr, dpr);
            this.width = rect.width;
            this.height = rect.height;
        }

        start(durationMs = 4000) {
            this.resize();
            this.canvas.style.display = 'block';
            this.particles = [];
            this.isActive = true;

            const count = 120;
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * this.width,
                    y: -20 - Math.random() * 200,
                    w: 6 + Math.random() * 8,
                    h: 4 + Math.random() * 6,
                    vx: (Math.random() - 0.5) * 80,
                    vy: 120 + Math.random() * 220,
                    rotation: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 8,
                    color: this.colors[Math.floor(Math.random() * this.colors.length)],
                    opacity: 1
                });
            }

            const startTime = performance.now();
            let lastTime = startTime;

            const loop = (now) => {
                if (!this.isActive) return;
                const dt = Math.min((now - lastTime) / 1000, 0.1);
                lastTime = now;

                this.ctx.clearRect(0, 0, this.width, this.height);

                let aliveCount = 0;
                for (const p of this.particles) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.rotation += p.rotSpeed * dt;

                    if (now - startTime > durationMs - 1000) {
                        p.opacity = Math.max(0, p.opacity - dt);
                    }

                    if (p.y < this.height + 50 && p.opacity > 0) {
                        aliveCount++;
                        this.ctx.save();
                        this.ctx.globalAlpha = p.opacity;
                        this.ctx.translate(p.x, p.y);
                        this.ctx.rotate(p.rotation);
                        this.ctx.fillStyle = p.color;
                        this.ctx.shadowColor = p.color;
                        this.ctx.shadowBlur = 6;
                        this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                        this.ctx.restore();
                    }
                }

                if (aliveCount > 0 && now - startTime < durationMs) {
                    this.animId = requestAnimationFrame(loop);
                } else {
                    this.stop();
                }
            };

            if (this.animId) cancelAnimationFrame(this.animId);
            this.animId = requestAnimationFrame(loop);
        }

        stop() {
            this.isActive = false;
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
            if (this.canvas) {
                this.canvas.style.display = 'none';
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }

    class AppController {
        constructor() {
            this.currentState = STATES.LOGIN;
            this.previousState = STATES.LOGIN;

            this.storage = window.TypeTankStorage;
            this.audio = window.TypeTankAudio;
            this.wordManager = new window.TypeTankWords.WordManager();

            this.currentMode = this.storage.getArsenalMode();
            this.currentCallsign = this.storage.getCallsign();
            this.aspectRatio = this.storage.getAspectRatio();
            this.isCrt = this.storage.isCrtEnabled();

            this.purgeConfirmStep = false;
            this.currentFilter = 'ALL';

            this._initElements();
            this._initGameEngine();
            this._initConfetti();
            this._setupEventListeners();
            this._setupKeyboardDispatcher();

            // Apply persistent preferences
            this.applyAspectRatio(this.aspectRatio);
            this.applyCrtState(this.isCrt);
            this.applyAudioState(this.audio.getMuted());
            this.updateHeaderCallsign(this.currentCallsign);

            // Start in Login or go to Settings if callsign exists
            if (this.currentCallsign && this.currentCallsign !== 'GUEST-01') {
                this.elCallsignInput.value = this.currentCallsign;
            } else {
                this.elCallsignInput.value = 'OPERATOR';
            }

            this.setScreen(STATES.LOGIN);
        }

        _initElements() {
            // Cabinet Frame & Header
            this.elCabinetFrame = document.getElementById('cabinet-frame');
            this.elHeaderCallsign = document.getElementById('header-callsign-display');
            this.btnHdrCallsign = document.getElementById('btn-hdr-callsign');
            this.btnHdrCrt = document.getElementById('btn-hdr-crt');
            this.btnHdrAudio = document.getElementById('btn-hdr-audio');
            this.btnHdrAspect = document.getElementById('btn-hdr-aspect');
            this.btnHdrRecords = document.getElementById('btn-hdr-records');

            // Screens
            this.screens = {
                [STATES.LOGIN]: document.getElementById('screen-login'),
                [STATES.SETTINGS]: document.getElementById('screen-settings'),
                [STATES.INSTRUCTIONS]: document.getElementById('screen-instructions'),
                [STATES.GAME]: document.getElementById('screen-game'),
                [STATES.RESULT]: document.getElementById('screen-result'),
                [STATES.RECORDS]: document.getElementById('screen-records')
            };

            // Login Screen Elements
            this.elCallsignInput = document.getElementById('callsign-input-field');
            this.btnLoginConfirm = document.getElementById('btn-login-confirm');

            // Settings Screen Elements
            this.modeCards = document.querySelectorAll('.mode-card');
            this.chkUpper = document.getElementById('matrix-chk-upper');
            this.chkNumbers = document.getElementById('matrix-chk-numbers');
            this.chkSpecials = document.getElementById('matrix-chk-specials');
            this.itemUpper = document.getElementById('matrix-item-upper');
            this.itemNumbers = document.getElementById('matrix-item-numbers');
            this.itemSpecials = document.getElementById('matrix-item-specials');
            this.btnAspectAuto = document.getElementById('btn-aspect-auto');
            this.btnAspect169 = document.getElementById('btn-aspect-169');
            this.btnAspect43 = document.getElementById('btn-aspect-43');
            this.elPreviewChips = document.getElementById('settings-preview-chips');
            this.btnSettingsBack = document.getElementById('btn-settings-back');
            this.btnSettingsProceed = document.getElementById('btn-settings-proceed');

            // Instructions Screen Elements
            this.btnEngage = document.getElementById('btn-engage-battlefield');
            this.btnInstructionsBack = document.getElementById('btn-instructions-back');

            // Game HUD Elements
            this.hudCallsign = document.getElementById('hud-val-callsign');
            this.hudMode = document.getElementById('hud-val-mode');
            this.hudScore = document.getElementById('hud-val-score');
            this.hudCombo = document.getElementById('hud-val-combo');
            this.hudWpm = document.getElementById('hud-val-wpm');
            this.hudAcc = document.getElementById('hud-val-acc');
            this.hudHullFill = document.getElementById('hud-hull-fill');
            this.hudHullVal = document.getElementById('hud-val-hull');
            this.btnGameAbort = document.getElementById('btn-game-abort');
            this.canvasGame = document.getElementById('combat-canvas');

            // Result Screen Elements
            this.bannerCelebration = document.getElementById('record-celebration-banner');
            this.resScore = document.getElementById('result-val-score');
            this.resWpm = document.getElementById('result-val-wpm');
            this.resAcc = document.getElementById('result-val-accuracy');
            this.resWords = document.getElementById('result-val-words');
            this.resCombo = document.getElementById('result-val-combo');
            this.resMode = document.getElementById('result-val-mode');
            this.resPbDisplay = document.getElementById('result-pb-display');
            this.resPbDelta = document.getElementById('result-pb-delta');
            this.btnResultPlayAgain = document.getElementById('btn-result-play-again');
            this.btnResultRecords = document.getElementById('btn-result-records');
            this.btnResultSettings = document.getElementById('btn-result-settings');
            this.btnResultMain = document.getElementById('btn-result-main');

            // Records Screen Elements
            this.recBestScore = document.getElementById('overview-val-best-score');
            this.recPeakWpm = document.getElementById('overview-val-peak-wpm');
            this.recPeakAcc = document.getElementById('overview-val-peak-acc');
            this.recTotalWords = document.getElementById('overview-val-total-words');
            this.recTotalSorties = document.getElementById('overview-val-total-sorties');
            this.btnPurgeLogs = document.getElementById('btn-purge-logs');
            this.filterButtons = document.querySelectorAll('.logs-filter-group .retro-btn');
            this.logsTbody = document.getElementById('flight-logs-tbody');
            this.btnRecordsBack = document.getElementById('btn-records-back');

            // Confetti Canvas
            this.canvasConfetti = document.getElementById('confetti-canvas');
        }

        _initGameEngine() {
            this.gameEngine = new window.TypeTankGame(this.canvasGame, {
                onUpdate: (stats) => this.onGameUpdate(stats),
                onGameOver: (stats) => this.onGameOver(stats),
                onAbort: () => this.onGameAbort()
            });
        }

        _initConfetti() {
            this.confetti = new ConfettiEffect(this.canvasConfetti);
        }

        // ======================================================================
        // Screen Navigation & State Machine
        // ======================================================================
        setScreen(newState) {
            if (this.currentState === STATES.GAME && newState !== STATES.GAME) {
                this.gameEngine.stop();
            }

            this.previousState = this.currentState;
            this.currentState = newState;

            // Update DOM active screens
            for (const key in this.screens) {
                if (this.screens[key]) {
                    this.screens[key].classList.toggle('active', key === newState);
                }
            }

            // Screen-specific activation hooks
            switch (newState) {
                case STATES.LOGIN:
                    setTimeout(() => {
                        this.elCallsignInput.focus();
                        this.elCallsignInput.select();
                    }, 50);
                    break;
                case STATES.SETTINGS:
                    this.syncSettingsUI();
                    break;
                case STATES.INSTRUCTIONS:
                    // Ready to engage
                    break;
                case STATES.GAME:
                    this.startGameSortie();
                    break;
                case STATES.RESULT:
                    // Rendered in onGameOver
                    break;
                case STATES.RECORDS:
                    this.refreshRecordsScreen();
                    break;
            }

            // Play tactile UI click
            this.audio.playUIClick();
        }

        // ======================================================================
        // Aspect Ratio, CRT, Audio, and Callsign Handling
        // ======================================================================
        applyAspectRatio(ratio) {
            this.aspectRatio = this.storage.setAspectRatio(ratio);

            this.elCabinetFrame.classList.remove('aspect-auto', 'aspect-16-9', 'aspect-4-3');
            if (this.aspectRatio === '16:9') {
                this.elCabinetFrame.classList.add('aspect-16-9');
                this.btnHdrAspect.textContent = '[ASPECT: 16:9]';
            } else if (this.aspectRatio === '4:3') {
                this.elCabinetFrame.classList.add('aspect-4-3');
                this.btnHdrAspect.textContent = '[ASPECT: 4:3]';
            } else {
                this.elCabinetFrame.classList.add('aspect-auto');
                this.btnHdrAspect.textContent = '[ASPECT: AUTO]';
            }

            // Update Settings Aspect buttons
            this.btnAspectAuto.classList.toggle('active', this.aspectRatio === 'auto');
            this.btnAspect169.classList.toggle('active', this.aspectRatio === '16:9');
            this.btnAspect43.classList.toggle('active', this.aspectRatio === '4:3');

            // Trigger canvas resize
            if (this.gameEngine) {
                setTimeout(() => {
                    this.gameEngine.resize();
                    if (this.confetti) this.confetti.resize();
                }, 50);
            }
        }

        cycleAspectRatio() {
            let next = 'auto';
            if (this.aspectRatio === 'auto') next = '16:9';
            else if (this.aspectRatio === '16:9') next = '4:3';
            else next = 'auto';
            this.applyAspectRatio(next);
        }

        applyCrtState(enabled) {
            this.isCrt = enabled;
            this.storage.setCrtEnabled(enabled);
            document.body.classList.toggle('crt-enabled', enabled);
            document.body.classList.toggle('crt-disabled', !enabled);
            this.btnHdrCrt.textContent = enabled ? '[CRT: ON]' : '[CRT: OFF]';
            this.btnHdrCrt.classList.toggle('active', enabled);
        }

        toggleCrt() {
            this.applyCrtState(!this.isCrt);
        }

        applyAudioState(isMuted) {
            this.audio.setMuted(isMuted);
            this.btnHdrAudio.textContent = isMuted ? '[SND: OFF]' : '[SND: ON]';
            this.btnHdrAudio.classList.toggle('active', !isMuted);
        }

        toggleAudio() {
            const muted = this.audio.toggleMute();
            this.applyAudioState(muted);
        }

        updateHeaderCallsign(name) {
            const clean = this.storage.setCallsign(name);
            this.currentCallsign = clean;
            this.elHeaderCallsign.textContent = clean;
            this.hudCallsign.textContent = clean;
        }

        // ======================================================================
        // Settings & Arsenal Modes Bi-Directional Synchronization
        // ======================================================================
        selectArsenalMode(modeNum) {
            const m = Math.max(1, Math.min(4, parseInt(modeNum, 10) || 1));
            this.currentMode = this.storage.setArsenalMode(m);
            this.syncSettingsUI();
        }

        syncSettingsUI() {
            const m = this.currentMode;

            // Highlight active mode card
            this.modeCards.forEach(card => {
                const cardMode = parseInt(card.getAttribute('data-mode'), 10);
                card.classList.toggle('active', cardMode === m);
            });

            // Update granular matrix toggles according to mode
            // Mode 1: Lowercase only
            // Mode 2: Lowercase + Uppercase
            // Mode 3: Lowercase + Uppercase + Numbers
            // Mode 4: Lowercase + Uppercase + Numbers + Specials
            const hasUpper = m >= 2;
            const hasNums = m >= 3;
            const hasSpecials = m >= 4;

            this.chkUpper.classList.toggle('checked', hasUpper);
            this.chkNumbers.classList.toggle('checked', hasNums);
            this.chkSpecials.classList.toggle('checked', hasSpecials);

            // Update dynamic preview chips
            this.updatePreviewChips();
        }

        onMatrixToggle(type) {
            let m = this.currentMode;
            if (type === 'specials') {
                m = (m === 4) ? 3 : 4;
            } else if (type === 'numbers') {
                m = (m >= 3) ? 2 : 3;
            } else if (type === 'upper') {
                m = (m >= 2) ? 1 : 2;
            }
            this.selectArsenalMode(m);
        }

        updatePreviewChips() {
            const samples = this.wordManager.getPreviewWords(this.currentMode, 5);
            this.elPreviewChips.innerHTML = '';
            samples.forEach(sample => {
                const chip = document.createElement('span');
                chip.className = 'preview-chip';
                chip.textContent = sample;
                this.elPreviewChips.appendChild(chip);
            });
        }

        // ======================================================================
        // Game Execution & HUD Callbacks
        // ======================================================================
        startGameSortie() {
            const modeName = this.storage.getModeName(this.currentMode);
            this.hudMode.textContent = modeName;
            this.hudCallsign.textContent = this.currentCallsign;

            this.gameEngine.start(this.currentMode, this.currentCallsign);
        }

        onGameUpdate(stats) {
            // 6-digit zero-padded score
            this.hudScore.textContent = stats.score.toString().padStart(6, '0');
            this.hudCombo.textContent = `x${stats.combo}`;
            this.hudWpm.textContent = stats.wpm;
            this.hudAcc.textContent = `${stats.accuracy}%`;

            // Hull integrity bar
            const hp = Math.max(0, Math.min(100, stats.hullHealth));
            this.hudHullFill.style.width = `${hp}%`;
            this.hudHullVal.textContent = `${hp}%`;

            this.hudHullFill.classList.remove('warning', 'critical');
            if (hp <= 25) {
                this.hudHullFill.classList.add('critical');
            } else if (hp <= 50) {
                this.hudHullFill.classList.add('warning');
            }
        }

        onGameOver(stats) {
            // Save results to storage and inspect PB
            const outcome = this.storage.saveSortieResult(stats);

            // Populate Result Screen
            this.resScore.textContent = stats.score.toString().padStart(6, '0');
            this.resWpm.textContent = stats.wpm;
            this.resAcc.textContent = `${stats.accuracy}%`;
            this.resWords.textContent = stats.wordsDestroyed;
            this.resCombo.textContent = `x${stats.maxCombo}`;
            this.resMode.textContent = this.storage.getModeName(stats.mode);

            // Previous PB & Delta
            this.resPbDisplay.textContent = `${outcome.prevPb.score} PTS (${outcome.prevPb.wpm} WPM)`;

            if (outcome.isNewPb) {
                this.bannerCelebration.classList.add('active');
                this.bannerCelebration.textContent = '★ NEW OPERATOR RECORD SURPASSED! ★';
                this.resPbDelta.style.color = '#00ff66';
                this.resPbDelta.textContent = `★ NEW RECORD ESTABLISHED! (+${outcome.scoreDelta} PTS)`;

                // Fanfare & Confetti celebration
                this.audio.playFanfare();
                this.confetti.start(4500);
            } else {
                this.bannerCelebration.classList.remove('active');
                this.resPbDelta.style.color = '#ffb000';
                this.resPbDelta.textContent = `+${outcome.scoreDelta} PTS / +${outcome.wpmDelta} WPM TO SURPASS PB`;
            }

            this.setScreen(STATES.RESULT);
        }

        onGameAbort() {
            this.setScreen(STATES.INSTRUCTIONS);
        }

        // ======================================================================
        // Records Screen Logic
        // ======================================================================
        refreshRecordsScreen() {
            const stats = this.storage.getLifetimeStats();

            this.recBestScore.textContent = stats.bestScore;
            this.recPeakWpm.textContent = stats.maxWpm;
            this.recPeakAcc.textContent = `${stats.peakAccuracy}%`;
            this.recTotalWords.textContent = stats.totalWordsDestroyed;
            this.recTotalSorties.textContent = stats.totalSorties;

            // Mode Bests Quad
            for (let m = 1; m <= 4; m++) {
                const pb = stats.modeBests[m] || { score: 0, wpm: 0 };
                const el = document.getElementById(`mode-best-${m}-stats`);
                if (el) {
                    el.textContent = `${pb.score} PTS / ${pb.wpm} WPM`;
                }
            }

            // Populate Flight Log Table
            this.renderFlightLogTable(this.currentFilter);
        }

        renderFlightLogTable(filter = 'ALL') {
            this.currentFilter = filter;
            const logs = this.storage.getFlightLogs(filter);

            // Update filter buttons
            this.filterButtons.forEach(btn => {
                const f = btn.getAttribute('data-filter');
                btn.classList.toggle('active', f === filter);
            });

            this.logsTbody.innerHTML = '';
            if (logs.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--white-dim); padding: 16px;">NO COMBAT SORTIES LOGGED FOR SELECTED FILTER</td>`;
                this.logsTbody.appendChild(tr);
                return;
            }

            logs.forEach(log => {
                const tr = document.createElement('tr');
                const pbTag = log.isPb ? `<span class="pb-indicator">★ PB</span>` : '';
                tr.innerHTML = `
                    <td>${log.dateStr}</td>
                    <td><span style="color: var(--amber);">${log.modeName}</span></td>
                    <td style="font-family: var(--font-arcade); font-size: 10px;">${log.score.toString().padStart(6, '0')}${pbTag}</td>
                    <td>${log.wpm}</td>
                    <td>${log.accuracy}%</td>
                    <td>x${log.maxCombo}</td>
                    <td>${log.wordsDestroyed}</td>
                `;
                this.logsTbody.appendChild(tr);
            });
        }

        // ======================================================================
        // Event Listeners
        // ======================================================================
        _setupEventListeners() {
            // Header Controls
            this.btnHdrCallsign.addEventListener('click', () => {
                this.setScreen(STATES.LOGIN);
            });
            this.btnHdrCrt.addEventListener('click', () => {
                this.toggleCrt();
                this.audio.playUIClick();
            });
            this.btnHdrAudio.addEventListener('click', () => {
                this.toggleAudio();
                this.audio.playUIClick();
            });
            this.btnHdrAspect.addEventListener('click', () => {
                this.cycleAspectRatio();
                this.audio.playUIClick();
            });
            this.btnHdrRecords.addEventListener('click', () => {
                this.setScreen(STATES.RECORDS);
            });

            // Login Screen
            this.btnLoginConfirm.addEventListener('click', () => {
                this.confirmCallsign();
            });
            this.elCallsignInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.confirmCallsign();
                }
            });

            // Settings Screen Mode Cards
            this.modeCards.forEach(card => {
                card.addEventListener('click', () => {
                    const m = card.getAttribute('data-mode');
                    this.selectArsenalMode(m);
                    this.audio.playUIClick();
                });
            });

            // Settings Matrix Toggles
            this.itemUpper.addEventListener('click', () => {
                this.onMatrixToggle('upper');
                this.audio.playUIClick();
            });
            this.itemNumbers.addEventListener('click', () => {
                this.onMatrixToggle('numbers');
                this.audio.playUIClick();
            });
            this.itemSpecials.addEventListener('click', () => {
                this.onMatrixToggle('specials');
                this.audio.playUIClick();
            });

            // Settings Aspect Ratio Buttons
            this.btnAspectAuto.addEventListener('click', () => {
                this.applyAspectRatio('auto');
                this.audio.playUIClick();
            });
            this.btnAspect169.addEventListener('click', () => {
                this.applyAspectRatio('16:9');
                this.audio.playUIClick();
            });
            this.btnAspect43.addEventListener('click', () => {
                this.applyAspectRatio('4:3');
                this.audio.playUIClick();
            });

            // Settings Navigation
            this.btnSettingsBack.addEventListener('click', () => {
                this.setScreen(STATES.LOGIN);
            });
            this.btnSettingsProceed.addEventListener('click', () => {
                this.setScreen(STATES.INSTRUCTIONS);
            });

            // Instructions Screen Navigation
            this.btnEngage.addEventListener('click', () => {
                this.setScreen(STATES.GAME);
            });
            this.btnInstructionsBack.addEventListener('click', () => {
                this.setScreen(STATES.SETTINGS);
            });

            // Game Abort Button
            this.btnGameAbort.addEventListener('click', () => {
                this.gameEngine.abortSortie();
            });

            // Result Screen Navigation
            this.btnResultPlayAgain.addEventListener('click', () => {
                this.confetti.stop();
                this.setScreen(STATES.GAME);
            });
            this.btnResultRecords.addEventListener('click', () => {
                this.confetti.stop();
                this.setScreen(STATES.RECORDS);
            });
            this.btnResultSettings.addEventListener('click', () => {
                this.confetti.stop();
                this.setScreen(STATES.SETTINGS);
            });
            this.btnResultMain.addEventListener('click', () => {
                this.confetti.stop();
                this.setScreen(STATES.INSTRUCTIONS);
            });

            // Records Filter Buttons
            this.filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const f = btn.getAttribute('data-filter');
                    this.renderFlightLogTable(f);
                    this.audio.playUIClick();
                });
            });

            // Purge Logs Button with DOS confirmation
            this.btnPurgeLogs.addEventListener('click', () => {
                if (!this.purgeConfirmStep) {
                    this.purgeConfirmStep = true;
                    this.btnPurgeLogs.textContent = '[CONFIRM PURGE? (CLICK)]';
                    this.btnPurgeLogs.style.background = '#881828';
                    setTimeout(() => {
                        this.purgeConfirmStep = false;
                        this.btnPurgeLogs.textContent = '[PURGE LOGS]';
                        this.btnPurgeLogs.style.background = '';
                    }, 4000);
                } else {
                    this.storage.purgeFlightLogs();
                    this.purgeConfirmStep = false;
                    this.btnPurgeLogs.textContent = '[PURGED]';
                    this.btnPurgeLogs.style.background = '';
                    this.refreshRecordsScreen();
                    setTimeout(() => {
                        this.btnPurgeLogs.textContent = '[PURGE LOGS]';
                    }, 1500);
                }
            });

            this.btnRecordsBack.addEventListener('click', () => {
                this.setScreen(this.previousState === STATES.RESULT ? STATES.RESULT : STATES.SETTINGS);
            });
        }

        confirmCallsign() {
            const raw = this.elCallsignInput.value.trim().toUpperCase() || 'OPERATOR';
            this.updateHeaderCallsign(raw);
            this.setScreen(STATES.SETTINGS);
        }

        // ======================================================================
        // Global Keyboard Dispatcher
        // ======================================================================
        _setupKeyboardDispatcher() {
            window.addEventListener('keydown', (e) => {
                // Ignore key events handled inside input fields except Enter
                if (document.activeElement === this.elCallsignInput) {
                    return;
                }

                // 1. GAME ARENA KEYBOARD ROUTING
                if (this.currentState === STATES.GAME) {
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.gameEngine.abortSortie();
                        return;
                    }

                    // Forward real-time single character typing to game engine
                    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                        e.preventDefault();
                        this.gameEngine.handleKeyInput(e.key);
                    }
                    return;
                }

                // 2. MENU & FLOW KEYBOARD ROUTING
                if (e.key === ' ' || e.key === 'Enter') {
                    // Prevent page scroll on spacebar
                    e.preventDefault();

                    switch (this.currentState) {
                        case STATES.LOGIN:
                            this.confirmCallsign();
                            break;
                        case STATES.SETTINGS:
                            this.setScreen(STATES.INSTRUCTIONS);
                            break;
                        case STATES.INSTRUCTIONS:
                            this.setScreen(STATES.GAME);
                            break;
                        case STATES.RESULT:
                            this.confetti.stop();
                            this.setScreen(STATES.GAME);
                            break;
                        case STATES.RECORDS:
                            this.setScreen(this.previousState === STATES.RESULT ? STATES.RESULT : STATES.SETTINGS);
                            break;
                    }
                    return;
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    switch (this.currentState) {
                        case STATES.SETTINGS:
                            this.setScreen(STATES.LOGIN);
                            break;
                        case STATES.INSTRUCTIONS:
                            this.setScreen(STATES.SETTINGS);
                            break;
                        case STATES.RESULT:
                            this.confetti.stop();
                            this.setScreen(STATES.INSTRUCTIONS);
                            break;
                        case STATES.RECORDS:
                            this.setScreen(this.previousState === STATES.RESULT ? STATES.RESULT : STATES.SETTINGS);
                            break;
                    }
                    return;
                }

                // Hotkey 'R' on Result screen opens Records
                if ((e.key === 'r' || e.key === 'R') && this.currentState === STATES.RESULT) {
                    e.preventDefault();
                    this.confetti.stop();
                    this.setScreen(STATES.RECORDS);
                    return;
                }

                // Hotkey 'S' on Result screen opens Settings
                if ((e.key === 's' || e.key === 'S') && this.currentState === STATES.RESULT) {
                    e.preventDefault();
                    this.confetti.stop();
                    this.setScreen(STATES.SETTINGS);
                    return;
                }

                // Hotkeys 1-4 on Settings to pick mode
                if (this.currentState === STATES.SETTINGS && ['1', '2', '3', '4'].includes(e.key)) {
                    e.preventDefault();
                    this.selectArsenalMode(e.key);
                    this.audio.playUIClick();
                    return;
                }
            });
        }
    }

    // Initialize application on DOMContentLoaded
    window.addEventListener('DOMContentLoaded', () => {
        window.TypeTankApp = new AppController();
    });

})(window);
