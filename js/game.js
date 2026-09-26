// TYPE//TANK Canvas 2D Combat Arena Engine
(function(window) {
    'use strict';

    class Particle {
        constructor(x, y, vx, vy, color, size, life, shape = 'circle') {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.color = color;
            this.size = size;
            this.maxLife = life;
            this.life = life;
            this.shape = shape; // 'circle', 'spark', 'debris'
            this.rotation = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.2;
        }

        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.vx *= 0.96;
            this.vy *= 0.96;
            this.life -= dt;
            this.rotation += this.rotSpeed;
            return this.life > 0;
        }

        draw(ctx) {
            const alpha = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(this.x, this.y);

            if (this.shape === 'spark') {
                ctx.rotate(Math.atan2(this.vy, this.vx));
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size * 2, -this.size * 0.5, this.size * 4, this.size);
            } else if (this.shape === 'debris') {
                ctx.rotate(this.rotation);
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(1, this.size * alpha), 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
            ctx.restore();
        }
    }

    class Bullet {
        constructor(startX, startY, targetX, targetY, targetLetterIdx, color, onHit) {
            this.x = startX;
            this.y = startY;
            this.startX = startX;
            this.startY = startY;
            this.targetX = targetX;
            this.targetY = targetY;
            this.targetLetterIdx = targetLetterIdx;
            this.color = color;
            this.onHit = onHit;
            
            const dx = targetX - startX;
            const dy = targetY - startY;
            const dist = Math.hypot(dx, dy);
            
            this.speed = 1900; // Fast ballistic velocity
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
            this.distRemaining = dist;
            this.trail = [];
            this.isAlive = true;
        }

        update(dt) {
            if (!this.isAlive) return false;

            const step = this.speed * dt;
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 5) this.trail.shift();

            if (step >= this.distRemaining) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.isAlive = false;
                if (this.onHit) this.onHit();
                return false;
            }

            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.distRemaining -= step;
            return true;
        }

        draw(ctx) {
            ctx.save();
            // Glowing tracer trail
            if (this.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                ctx.lineTo(this.x, this.y);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 8;
                ctx.stroke();
            }

            // Bullet projectile head
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.restore();
        }
    }

    class GameEngine {
        constructor(canvas, hudCallbacks) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.hud = hudCallbacks || {};

            this.wordManager = new window.TypeTankWords.WordManager();
            this.audio = window.TypeTankAudio;

            this.isRunning = false;
            this.animationFrameId = null;
            this.lastTime = 0;

            // Combat State
            this.mode = 1;
            this.callsign = 'GUEST-01';
            this.score = 0;
            this.combo = 1;
            this.maxCombo = 1;
            this.totalKeystrokes = 0;
            this.correctKeystrokes = 0;
            this.wordsDestroyed = 0;
            this.hullHealth = 100; // 0 to 100
            this.startTime = 0;
            this.elapsedSeconds = 0;

            // Target Tracking
            this.words = [];
            this.lockedWord = null;
            this.bullets = [];
            this.particles = [];

            // Tank Geometry & Animation
            this.tankX = 0;
            this.tankY = 0;
            this.defenseLineY = 0;
            this.cannonAngle = -Math.PI / 2; // Idle pointing straight up (-90 deg)
            this.targetAngle = -Math.PI / 2;
            this.recoilOffset = 0;
            this.muzzleFlash = 0;

            // Spawning Parameters
            this.spawnTimer = 0;
            this.spawnInterval = 3.2; // seconds
            this.baseWordSpeed = 24; // pixels per sec
            this.bonusSpawnTimer = 0;
            this.bonusInterval = 16; // spawn bonus every ~16 seconds

            // Screen Shake
            this.shakeIntensity = 0;

            // Setup display calibration
            this.resize();
            window.addEventListener('resize', () => this.resize());
        }

        resize() {
            if (!this.canvas) return;
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            this.canvas.width = Math.floor(rect.width * dpr);
            this.canvas.height = Math.floor(rect.height * dpr);

            // Virtual width & height
            this.vWidth = rect.width;
            this.vHeight = rect.height;

            this.ctx.resetTransform?.();
            this.ctx.scale(dpr, dpr);

            // Calibrate tank position
            this.tankX = this.vWidth / 2;
            this.tankY = this.vHeight - 40;
            this.defenseLineY = this.vHeight - 75;
        }

        start(mode = 1, callsign = 'GUEST-01') {
            this.mode = parseInt(mode, 10) || 1;
            this.callsign = callsign || 'GUEST-01';

            this.score = 0;
            this.combo = 1;
            this.maxCombo = 1;
            this.totalKeystrokes = 0;
            this.correctKeystrokes = 0;
            this.wordsDestroyed = 0;
            this.hullHealth = 100;
            this.startTime = performance.now();
            this.elapsedSeconds = 0;

            this.words = [];
            this.lockedWord = null;
            this.bullets = [];
            this.particles = [];
            this.wordManager.reset();

            this.cannonAngle = -Math.PI / 2;
            this.targetAngle = -Math.PI / 2;
            this.recoilOffset = 0;
            this.muzzleFlash = 0;
            this.shakeIntensity = 0;

            this.spawnTimer = 0.8; // Quick first spawn
            this.spawnInterval = 3.2;
            this.baseWordSpeed = 26;
            this.bonusSpawnTimer = 10;

            this.resize();
            this.isRunning = true;
            this.lastTime = performance.now();

            this.updateHud();

            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
            }
            this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
        }

        stop() {
            this.isRunning = false;
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
        }

        // Main 60 FPS Game Loop
        loop(currentTime) {
            if (!this.isRunning) return;

            const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
            this.lastTime = currentTime;

            this.update(dt);
            this.render();

            if (this.isRunning) {
                this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
            }
        }

        update(dt) {
            this.elapsedSeconds = (performance.now() - this.startTime) / 1000;

            // Progressive difficulty scaling
            // Speed increases slowly with elapsed time and words destroyed
            const speedScale = 1 + Math.min(2.5, (this.elapsedSeconds * 0.012) + (this.wordsDestroyed * 0.025));
            const currentWordSpeed = this.baseWordSpeed * speedScale;
            // Spawn interval tightens from 3.2s down to ~1.4s
            const currentSpawnInterval = Math.max(1.3, 3.2 - (this.elapsedSeconds * 0.015) - (this.wordsDestroyed * 0.03));

            // Word Spawning
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnWord(currentWordSpeed, false);
                this.spawnTimer = currentSpawnInterval;
            }

            // Bonus Target Spawning
            this.bonusSpawnTimer -= dt;
            if (this.bonusSpawnTimer <= 0) {
                const hasActiveBonus = this.words.some(w => w.isBonus);
                if (!hasActiveBonus) {
                    this.spawnWord(currentWordSpeed * 1.55, true);
                    this.bonusSpawnTimer = this.bonusInterval + (Math.random() * 6);
                } else {
                    this.bonusSpawnTimer = 6;
                }
            }

            // Screen Shake Decay
            if (this.shakeIntensity > 0) {
                this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 28);
            }

            // Muzzle flash decay & Recoil recovery
            if (this.muzzleFlash > 0) {
                this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 10);
            }
            if (this.recoilOffset > 0) {
                this.recoilOffset = Math.max(0, this.recoilOffset - dt * 45);
            }

            // Cannon rotation update (aim at locked target, or lowest threatening target, or idle)
            let aimTargetX = this.tankX;
            let aimTargetY = 0;

            if (this.lockedWord) {
                aimTargetX = this.lockedWord.targetLetterX || this.lockedWord.x;
                aimTargetY = this.lockedWord.y;
            } else if (this.words.length > 0) {
                // Aim at lowest word
                let lowest = this.words[0];
                for (let i = 1; i < this.words.length; i++) {
                    if (this.words[i].y > lowest.y) lowest = this.words[i];
                }
                aimTargetX = lowest.x;
                aimTargetY = lowest.y;
            }

            const dx = aimTargetX - this.tankX;
            const dy = aimTargetY - (this.tankY - 14);
            this.targetAngle = Math.atan2(dy, dx);
            // Constrain angle to top hemisphere (-175° to -5°)
            this.targetAngle = Math.max(-Math.PI + 0.08, Math.min(-0.08, this.targetAngle));

            // Smooth angular interpolation
            let angleDiff = this.targetAngle - this.cannonAngle;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            this.cannonAngle += angleDiff * Math.min(1, dt * 16);

            // Update Bullets
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                if (!this.bullets[i].update(dt)) {
                    this.bullets.splice(i, 1);
                }
            }

            // Update Particles
            for (let i = this.particles.length - 1; i >= 0; i--) {
                if (!this.particles[i].update(dt)) {
                    this.particles.splice(i, 1);
                }
            }

            // Update Words Position & Check Perimeter Breach
            for (let i = this.words.length - 1; i >= 0; i--) {
                const word = this.words[i];
                word.y += word.speed * dt;

                // Update letter position tracking for bullets and target reticle
                this.updateWordCoordinates(word);

                // Perimeter Breach Check
                if (word.y >= this.defenseLineY) {
                    this.handlePerimeterBreach(word, i);
                }
            }

            // Periodic live HUD update
            this.updateHud();
        }

        spawnWord(speed, isBonus = false) {
            const wordText = this.wordManager.getSpawnWord(this.mode, this.words, isBonus);
            if (!wordText) return;

            // Measure width to keep safely on screen
            this.ctx.font = 'bold 16px "Share Tech Mono", "VT323", monospace';
            const metrics = this.ctx.measureText(wordText);
            const wordWidth = metrics.width + 24; // padding

            const paddingX = 40;
            const minX = paddingX + wordWidth / 2;
            const maxX = Math.max(minX, this.vWidth - paddingX - wordWidth / 2);
            const spawnX = minX + Math.random() * (maxX - minX);

            const wordObj = {
                id: 'w_' + Math.random().toString(36).substring(2, 8),
                text: wordText,
                isBonus: isBonus,
                typedIndex: 0,
                x: spawnX,
                y: -15, // start slightly offscreen top
                speed: speed,
                width: wordWidth,
                height: 28,
                targetLetterX: spawnX,
                targetLetterY: 0
            };

            this.updateWordCoordinates(wordObj);

            if (isBonus) {
                this.wordManager.registerBonusSpawn(wordText[0]);
                this.audio.playBonusSpawn();
            }

            this.words.push(wordObj);
        }

        updateWordCoordinates(word) {
            this.ctx.font = 'bold 16px "Share Tech Mono", "VT323", monospace';
            const fullWidth = this.ctx.measureText(word.text).width;
            const startX = word.x - fullWidth / 2;

            const typedPrefix = word.text.substring(0, word.typedIndex);
            const prefixWidth = this.ctx.measureText(typedPrefix).width;
            const activeChar = word.text[word.typedIndex] || '';
            const charWidth = this.ctx.measureText(activeChar).width;

            // Active character coordinate for bullet targeting
            word.targetLetterX = startX + prefixWidth + (charWidth / 2);
            word.targetLetterY = word.y;
        }

        // Keystroke handler called by master keyboard dispatcher
        handleKeyInput(char) {
            if (!this.isRunning || this.hullHealth <= 0) return;
            if (!char || char.length !== 1) return;

            // In Mode 1 (all lowercase), normalize input so CapsLock or Shift doesn't cause frustrating false misses
            if (this.mode === 1) {
                char = char.toLowerCase();
            }

            this.totalKeystrokes++;

            // 1. If currently NOT locked onto a word:
            if (!this.lockedWord) {
                // Find all words matching this starting character
                const matchingWords = this.words.filter(w => w.text[0] === char);

                if (matchingWords.length > 0) {
                    // LOWEST-FIRST PRIORITY: Sort by Y descending (highest Y = lowest on screen)
                    matchingWords.sort((a, b) => b.y - a.y);
                    this.lockedWord = matchingWords[0];

                    this.processCorrectHit();
                } else {
                    // Mistake / no matching threat
                    this.processMistake();
                }
            } else {
                // 2. Currently locked onto a word
                const expectedChar = this.lockedWord.text[this.lockedWord.typedIndex];
                if (char === expectedChar) {
                    this.processCorrectHit();
                } else {
                    // Typo on active locked target
                    this.processMistake();
                }
            }

            this.updateHud();
        }

        processCorrectHit() {
            const word = this.lockedWord;
            this.correctKeystrokes++;
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }

            const letterIdx = word.typedIndex;
            word.typedIndex++;

            // Spawn ballistic bullet from cannon tip to letter
            this.fireBullet(word, letterIdx);

            // Laser sound
            this.audio.playLaserShot();

            // Check if entire word has been completely typed!
            if (word.typedIndex >= word.text.length) {
                this.eliminateWord(word);
            }
        }

        processMistake() {
            // Combo drops to 1
            this.combo = 1;
            this.audio.playMistake();
        }

        fireBullet(word, letterIdx) {
            // Calculate barrel tip
            const barrelLen = 44 - this.recoilOffset;
            const tipX = this.tankX + Math.cos(this.cannonAngle) * barrelLen;
            const tipY = (this.tankY - 14) + Math.sin(this.cannonAngle) * barrelLen;

            // Recoil kick and muzzle flash
            this.recoilOffset = 10;
            this.muzzleFlash = 1.0;

            // Muzzle flash sparks
            for (let i = 0; i < 5; i++) {
                const spread = (Math.random() - 0.5) * 0.6;
                const spd = 80 + Math.random() * 120;
                const vx = Math.cos(this.cannonAngle + spread) * spd;
                const vy = Math.sin(this.cannonAngle + spread) * spd;
                this.particles.push(new Particle(tipX, tipY, vx, vy, '#00ff66', 2.5, 0.18, 'spark'));
            }

            const bulletColor = word.isBonus ? '#ff3366' : '#00ff66';

            // Create ballistic projectile
            const bullet = new Bullet(
                tipX, tipY,
                word.targetLetterX, word.targetLetterY,
                letterIdx,
                bulletColor,
                () => {
                    // Bullet impact spark callback
                    for (let p = 0; p < 6; p++) {
                        const ang = Math.random() * Math.PI * 2;
                        const spd = 60 + Math.random() * 140;
                        this.particles.push(new Particle(
                            word.targetLetterX, word.targetLetterY,
                            Math.cos(ang) * spd, Math.sin(ang) * spd,
                            bulletColor, 2, 0.22, 'spark'
                        ));
                    }
                }
            );

            this.bullets.push(bullet);
        }

        eliminateWord(word) {
            const isBonus = word.isBonus;
            const wordIdx = this.words.indexOf(word);
            if (wordIdx !== -1) {
                this.words.splice(wordIdx, 1);
            }

            // Release target lock
            if (this.lockedWord === word) {
                this.lockedWord = null;
            }

            this.wordsDestroyed++;

            // Scoring formula: (Base 100 * length * (isBonus ? 3.5 : 1.0)) * comboMultiplier
            const basePoints = word.text.length * (isBonus ? 350 : 100);
            const comboMult = Math.min(10, 1 + Math.floor(this.combo / 4) * 0.25);
            const addedScore = Math.floor(basePoints * comboMult);
            this.score += addedScore;

            // Audio thump/explosion
            this.audio.playWordDestroyed(isBonus);

            // Explosive fragmentation particles
            const particleColor = isBonus ? '#ff2a4b' : '#33ff66';
            const count = isBonus ? 24 : 14;
            for (let i = 0; i < count; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 80 + Math.random() * 220;
                this.particles.push(new Particle(
                    word.x, word.y,
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    particleColor,
                    2 + Math.random() * 3,
                    0.4 + Math.random() * 0.35,
                    i % 2 === 0 ? 'debris' : 'spark'
                ));
            }

            // WordManager bonus resolution & cooldown
            if (isBonus) {
                this.wordManager.registerBonusResolved(word.text[0]);
            }
        }

        handlePerimeterBreach(word, index) {
            // Remove word
            this.words.splice(index, 1);
            if (this.lockedWord === word) {
                this.lockedWord = null;
            }

            const isBonus = word.isBonus;
            if (isBonus) {
                this.wordManager.registerBonusResolved(word.text[0]);
            }

            // Hull Damage: 20% normal, 30% bonus
            const damage = isBonus ? 30 : 20;
            this.hullHealth = Math.max(0, this.hullHealth - damage);

            // Combo resets
            this.combo = 1;

            // Heavy screen shake & alarm audio
            this.shakeIntensity = 16;
            this.audio.playDamageHull();

            // Breach explosion at perimeter
            for (let p = 0; p < 22; p++) {
                const ang = -Math.PI * Math.random(); // upwards blast
                const spd = 90 + Math.random() * 200;
                this.particles.push(new Particle(
                    word.x, this.defenseLineY,
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    '#ff3300', 3 + Math.random() * 3, 0.5, 'debris'
                ));
            }

            // Check destruction
            if (this.hullHealth <= 0) {
                this.triggerGameOver();
            }
        }

        triggerGameOver() {
            this.hullHealth = 0;
            this.isRunning = false;

            // Massive tank destruction explosion
            for (let i = 0; i < 48; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 60 + Math.random() * 300;
                this.particles.push(new Particle(
                    this.tankX, this.tankY,
                    Math.cos(ang) * spd, Math.sin(ang) * spd,
                    i % 2 === 0 ? '#ff1744' : '#ffb000',
                    3 + Math.random() * 4,
                    0.8 + Math.random() * 0.5,
                    'debris'
                ));
            }

            this.audio.playDamageHull();

            // Render final explosion frames before debrief
            setTimeout(() => {
                if (this.hud.onGameOver) {
                    const stats = this.getStats();
                    this.hud.onGameOver(stats);
                }
            }, 900);
        }

        abortSortie() {
            this.stop();
            if (this.hud.onAbort) {
                this.hud.onAbort();
            }
        }

        getStats() {
            const minutes = Math.max(0.05, this.elapsedSeconds / 60);
            const wpm = Math.round((this.correctKeystrokes / 5) / minutes);
            const accuracy = this.totalKeystrokes > 0
                ? Math.round((this.correctKeystrokes / this.totalKeystrokes) * 100)
                : 100;

            return {
                callsign: this.callsign,
                mode: this.mode,
                score: this.score,
                wpm: Math.max(0, wpm),
                accuracy: accuracy,
                wordsDestroyed: this.wordsDestroyed,
                maxCombo: this.maxCombo,
                elapsedSeconds: Math.round(this.elapsedSeconds)
            };
        }

        updateHud() {
            if (!this.hud.onUpdate) return;
            const stats = this.getStats();
            this.hud.onUpdate({
                ...stats,
                combo: this.combo,
                hullHealth: this.hullHealth
            });
        }

        render() {
            const ctx = this.ctx;
            const w = this.vWidth;
            const h = this.vHeight;

            ctx.save();

            // Screen Shake offset
            if (this.shakeIntensity > 0) {
                const ox = (Math.random() - 0.5) * this.shakeIntensity;
                const oy = (Math.random() - 0.5) * this.shakeIntensity;
                ctx.translate(ox, oy);
            }

            // Clear Background
            ctx.fillStyle = '#040804';
            ctx.fillRect(0, 0, w, h);

            // Subtle tactical background radar grid
            this.drawTacticalGrid(ctx, w, h);

            // Draw Perimeter Defense Line
            this.drawPerimeterLine(ctx, w);

            // Draw Falling Words
            this.drawWords(ctx);

            // Draw Bullets
            for (const bullet of this.bullets) {
                bullet.draw(ctx);
            }

            // Draw Particles
            for (const particle of this.particles) {
                particle.draw(ctx);
            }

            // Draw Tank & Turret
            this.drawTank(ctx);

            ctx.restore();
        }

        drawTacticalGrid(ctx, w, h) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.04)';
            ctx.lineWidth = 1;

            const gridSize = 40;
            for (let x = 0; x < w; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Concentric radar sweep rings from bottom tank base
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.05)';
            const r1 = 160, r2 = 320, r3 = 480;
            ctx.beginPath();
            ctx.arc(this.tankX, this.tankY, r1, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.tankX, this.tankY, r2, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.tankX, this.tankY, r3, Math.PI, 0);
            ctx.stroke();

            ctx.restore();
        }

        drawPerimeterLine(ctx, w) {
            ctx.save();
            const y = this.defenseLineY;

            // Hazard perimeter glow
            const isCritical = this.hullHealth < 25;
            const lineColor = isCritical ? 'rgba(255, 42, 75, 0.85)' : 'rgba(0, 255, 65, 0.6)';

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.shadowColor = lineColor;
            ctx.shadowBlur = 8;

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();

            // Hazard warning text tag
            ctx.font = '10px "Share Tech Mono", monospace';
            ctx.fillStyle = lineColor;
            ctx.fillText('+-- DEFENSE PERIMETER --+', 14, y - 6);
            ctx.fillText('+-- CRITICAL BREACH LINE --+', w - 180, y - 6);

            ctx.restore();
        }

        drawWords(ctx) {
            ctx.save();

            for (const word of this.words) {
                const isLocked = (this.lockedWord === word);
                const isBonus = word.isBonus;
                const wx = word.x;
                const wy = word.y;

                ctx.font = 'bold 16px "Share Tech Mono", "VT323", monospace';
                const textWidth = ctx.measureText(word.text).width;
                const boxW = textWidth + 24;
                const boxH = 28;
                const boxX = wx - boxW / 2;
                const boxY = wy - boxH / 2;

                // Box colors
                let borderColor = isBonus ? '#ff2a4b' : '#00ff66';
                let glowColor = isBonus ? 'rgba(255, 42, 75, 0.8)' : 'rgba(0, 255, 65, 0.6)';
                let bgFill = isBonus ? 'rgba(40, 6, 12, 0.88)' : 'rgba(4, 20, 8, 0.88)';

                if (isLocked) {
                    borderColor = isBonus ? '#ff1744' : '#ffffff';
                    glowColor = isBonus ? '#ff1744' : '#00ff66';
                }

                // Draw word tactical card background
                ctx.fillStyle = bgFill;
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = isLocked ? 2 : 1.2;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = isLocked ? 10 : 5;

                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeRect(boxX, boxY, boxW, boxH);

                // Angular bracket corners
                const cLen = 5;
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                // Top-left
                ctx.beginPath();
                ctx.moveTo(boxX, boxY + cLen);
                ctx.lineTo(boxX, boxY);
                ctx.lineTo(boxX + cLen, boxY);
                ctx.stroke();
                // Bottom-right
                ctx.beginPath();
                ctx.moveTo(boxX + boxW - cLen, boxY + boxH);
                ctx.lineTo(boxX + boxW, boxY + boxH);
                ctx.lineTo(boxX + boxW, boxY + boxH - cLen);
                ctx.stroke();

                // If Red Bonus: draw header badge
                if (isBonus) {
                    ctx.font = 'bold 9px "Share Tech Mono", monospace';
                    ctx.fillStyle = '#ff2a4b';
                    ctx.shadowBlur = 6;
                    ctx.shadowColor = '#ff2a4b';
                    ctx.fillText('★ PRIORITY 3.5X ★', boxX, boxY - 5);
                }

                // If locked: draw targeting reticle lock brackets
                if (isLocked) {
                    ctx.save();
                    ctx.strokeStyle = isBonus ? '#ff3366' : '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    const retPad = 6;
                    ctx.strokeRect(boxX - retPad, boxY - retPad, boxW + retPad * 2, boxH + retPad * 2);

                    // Reticle pointer crosshairs
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(wx, boxY - retPad - 6);
                    ctx.lineTo(wx, boxY - retPad);
                    ctx.stroke();
                    ctx.restore();
                }

                // Render characters:
                // 1) Typed letters: 35-40% opacity
                // 2) Active letter: crisp with pulsing cursor
                // 3) Remaining letters: crisp full brightness
                const textStartX = wx - textWidth / 2;
                let currentCursorX = textStartX;
                const textBaselineY = wy + 6;

                for (let i = 0; i < word.text.length; i++) {
                    const char = word.text[i];
                    ctx.font = 'bold 16px "Share Tech Mono", monospace';
                    const charW = ctx.measureText(char).width;

                    if (i < word.typedIndex) {
                        // Already typed: faded ~38% opacity
                        ctx.fillStyle = isBonus ? 'rgba(255, 75, 100, 0.38)' : 'rgba(0, 255, 65, 0.38)';
                        ctx.shadowBlur = 0;
                        ctx.fillText(char, currentCursorX, textBaselineY);
                    } else if (i === word.typedIndex) {
                        // Active next letter to type: bright glowing + cursor underline
                        ctx.fillStyle = isBonus ? '#ffffff' : '#ffffff';
                        ctx.shadowColor = isBonus ? '#ff2a4b' : '#00ff66';
                        ctx.shadowBlur = 12;
                        ctx.fillText(char, currentCursorX, textBaselineY);

                        // Active glowing cursor underline
                        ctx.fillStyle = isBonus ? '#ff2a4b' : '#00ff66';
                        ctx.fillRect(currentCursorX, textBaselineY + 3, charW, 2.5);
                    } else {
                        // Remaining letters: bright green or crimson
                        ctx.fillStyle = isBonus ? '#ff5270' : '#33ff66';
                        ctx.shadowColor = isBonus ? '#ff2a4b' : '#00ff66';
                        ctx.shadowBlur = 6;
                        ctx.fillText(char, currentCursorX, textBaselineY);
                    }

                    currentCursorX += charW;
                }
            }

            ctx.restore();
        }

        drawTank(ctx) {
            ctx.save();
            const tx = this.tankX;
            const ty = this.tankY;

            // 1. Tread Chassis Base
            const baseW = 126;
            const baseH = 26;
            const baseX = tx - baseW / 2;
            const baseY = ty + 4;

            // Base shadow & chassis body
            ctx.fillStyle = '#0a160a';
            ctx.strokeStyle = '#1b5e20';
            ctx.lineWidth = 2;
            ctx.fillRect(baseX, baseY, baseW, baseH);
            ctx.strokeRect(baseX, baseY, baseW, baseH);

            // Tread wheels
            const numWheels = 6;
            const wheelRadius = 8;
            const wheelSpacing = (baseW - 20) / (numWheels - 1);
            for (let i = 0; i < numWheels; i++) {
                const wx = baseX + 10 + i * wheelSpacing;
                const wy = baseY + baseH / 2;
                ctx.beginPath();
                ctx.arc(wx, wy, wheelRadius, 0, Math.PI * 2);
                ctx.fillStyle = '#050a05';
                ctx.strokeStyle = '#33ff66';
                ctx.lineWidth = 1.2;
                ctx.fill();
                ctx.stroke();

                // Axle dot
                ctx.beginPath();
                ctx.arc(wx, wy, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#33ff66';
                ctx.fill();
            }

            // Hazard chevron markings on chassis skirt
            ctx.strokeStyle = 'rgba(255, 176, 0, 0.45)';
            ctx.lineWidth = 1.5;
            for (let x = baseX + 6; x < baseX + baseW - 6; x += 14) {
                ctx.beginPath();
                ctx.moveTo(x, baseY + baseH - 4);
                ctx.lineTo(x + 6, baseY + 4);
                ctx.stroke();
            }

            // 2. Active Cannon Barrel (Rotates across 180° arc)
            ctx.save();
            const pivotX = tx;
            const pivotY = ty - 8;
            ctx.translate(pivotX, pivotY);
            ctx.rotate(this.cannonAngle);

            const barrelLen = 46 - this.recoilOffset;
            const barrelW = 12;

            // Barrel body
            ctx.fillStyle = '#112811';
            ctx.strokeStyle = '#33ff66';
            ctx.lineWidth = 2;
            ctx.fillRect(0, -barrelW / 2, barrelLen, barrelW);
            ctx.strokeRect(0, -barrelW / 2, barrelLen, barrelW);

            // Muzzle brake tip
            ctx.fillStyle = '#1f481f';
            ctx.fillRect(barrelLen - 4, -barrelW / 2 - 2, 6, barrelW + 4);
            ctx.strokeRect(barrelLen - 4, -barrelW / 2 - 2, 6, barrelW + 4);

            // Barrel laser alignment strip
            ctx.strokeStyle = '#00ff66';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(4, 0);
            ctx.lineTo(barrelLen - 4, 0);
            ctx.stroke();

            // Muzzle Flash
            if (this.muzzleFlash > 0) {
                ctx.save();
                ctx.translate(barrelLen + 2, 0);
                const flashSize = 18 * this.muzzleFlash;
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#33ff66';
                ctx.shadowBlur = 18;

                ctx.beginPath();
                ctx.arc(0, 0, flashSize * 0.6, 0, Math.PI * 2);
                ctx.fill();

                // Spikes
                ctx.strokeStyle = '#33ff66';
                ctx.lineWidth = 2;
                for (let a = 0; a < 6; a++) {
                    const ang = (a * Math.PI) / 3;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(ang) * flashSize, Math.sin(ang) * flashSize);
                    ctx.stroke();
                }
                ctx.restore();
            }

            ctx.restore(); // restore from barrel rotation

            // 3. Semicircular Dome Turret with Armor Plates
            const turretRadius = 30;
            ctx.beginPath();
            ctx.arc(tx, ty + 2, turretRadius, Math.PI, 0);
            ctx.fillStyle = '#0d220d';
            ctx.strokeStyle = '#33ff66';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#00ff66';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.stroke();

            // Armor plates segmentation on dome
            ctx.beginPath();
            ctx.arc(tx, ty + 2, turretRadius * 0.6, Math.PI, 0);
            ctx.strokeStyle = '#1b5e20';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Central Optic / Core
            ctx.beginPath();
            ctx.arc(tx, ty - 6, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#003300';
            ctx.strokeStyle = '#33ff66';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Glowing optic lens pupil
            const pulse = (Math.sin(performance.now() * 0.006) + 1) * 0.5;
            ctx.beginPath();
            ctx.arc(tx, ty - 6, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = this.hullHealth < 25 ? '#ff1744' : '#00ff66';
            ctx.shadowColor = this.hullHealth < 25 ? '#ff1744' : '#00ff66';
            ctx.shadowBlur = 8 + pulse * 6;
            ctx.fill();

            ctx.restore();
        }
    }

    window.TypeTankGame = GameEngine;

})(window);
