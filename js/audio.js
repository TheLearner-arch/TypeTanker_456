// TYPE//TANK Web Audio API Procedural Synthesizer
(function(window) {
    'use strict';

    class SoundSynthesizer {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.isMuted = false;
            this.isUnlocked = false;

            // Load saved mute setting
            try {
                const savedMute = localStorage.getItem('typetank_audio_muted');
                this.isMuted = savedMute === 'true';
            } catch (e) {
                this.isMuted = false;
            }

            // Setup auto-unlock on first user interaction
            this._setupUnlockListeners();
        }

        _initContext() {
            if (this.ctx) return;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) {
                console.warn('Web Audio API not supported in this browser.');
                return;
            }
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
        }

        _setupUnlockListeners() {
            const unlockHandler = () => {
                this._initContext();
                if (this.ctx && this.ctx.state === 'suspended') {
                    this.ctx.resume().then(() => {
                        this.isUnlocked = true;
                    });
                } else if (this.ctx) {
                    this.isUnlocked = true;
                }
                // Remove listeners once active
                if (this.isUnlocked) {
                    window.removeEventListener('keydown', unlockHandler);
                    window.removeEventListener('pointerdown', unlockHandler);
                    window.removeEventListener('click', unlockHandler);
                }
            };

            window.addEventListener('keydown', unlockHandler, { passive: true });
            window.addEventListener('pointerdown', unlockHandler, { passive: true });
            window.addEventListener('click', unlockHandler, { passive: true });
        }

        // Ensure context is running before synthesizing
        _ensureActive() {
            this._initContext();
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return this.ctx && !this.isMuted;
        }

        // Toggle mute state
        toggleMute() {
            this.setMuted(!this.isMuted);
            return this.isMuted;
        }

        setMuted(muted) {
            this.isMuted = !!muted;
            try {
                localStorage.setItem('typetank_audio_muted', this.isMuted ? 'true' : 'false');
            } catch (e) {}

            if (this.masterGain && this.ctx) {
                this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
            }
        }

        getMuted() {
            return this.isMuted;
        }

        // 1. High-frequency laser shot for normal keystrokes
        playLaserShot() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            // Rapid pitch drop
            osc.frequency.setValueAtTime(980, t);
            osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);

            // Punchy snappy envelope
            gain.gain.setValueAtTime(0.28, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t);
            osc.stop(t + 0.07);
        }

        // 2. Heavy metallic thump / explosion on word elimination
        playWordDestroyed(isBonus = false) {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            const duration = isBonus ? 0.45 : 0.3;

            // Low frequency punch
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = isBonus ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(isBonus ? 190 : 140, t);
            osc.frequency.exponentialRampToValueAtTime(28, t + duration);

            oscGain.gain.setValueAtTime(isBonus ? 0.6 : 0.45, t);
            oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(oscGain);
            oscGain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + duration);

            // Metallic noise layer
            const bufferSize = Math.floor(ctx.sampleRate * duration);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;

            // Bandpass filter for metallic sizzle
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(isBonus ? 1600 : 900, t);
            filter.frequency.exponentialRampToValueAtTime(180, t + duration);
            filter.Q.setValueAtTime(3.5, t);

            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(isBonus ? 0.35 : 0.22, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            whiteNoise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.masterGain);

            whiteNoise.start(t);
            whiteNoise.stop(t + duration);
        }

        // 3. High-pitched dual-tone chime on red bonus word spawn
        playBonusSpawn() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            // Tone 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(987.77, t); // B5
            gain1.gain.setValueAtTime(0.3, t);
            gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            osc1.connect(gain1);
            gain1.connect(this.masterGain);
            osc1.start(t);
            osc1.stop(t + 0.1);

            // Tone 2 (higher 5th)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(1479.98, t + 0.08); // F#6
            gain2.gain.setValueAtTime(0.001, t);
            gain2.gain.setValueAtTime(0.35, t + 0.08);
            gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(t + 0.08);
            osc2.stop(t + 0.25);
        }

        // 4. Low crunch / screen shake buzz on damage impact
        playDamageHull() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;
            const duration = 0.35;

            // Harsh distorted buzz
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(68, t);
            osc.frequency.linearRampToValueAtTime(32, t + duration);

            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t);
            osc.stop(t + duration);

            // Crunch noise
            const bufferSize = Math.floor(ctx.sampleRate * 0.2);
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.3, t);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

            noise.connect(nGain);
            nGain.connect(this.masterGain);
            noise.start(t);
            noise.stop(t + 0.2);
        }

        // 5. Multi-tone triumphant fanfare for new records
        playFanfare() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            // 8-bit triumphant victory notes: C5, E5, G5, high C6
            const notes = [
                { f: 523.25, start: 0.00, dur: 0.12 }, // C5
                { f: 659.25, start: 0.12, dur: 0.12 }, // E5
                { f: 783.99, start: 0.24, dur: 0.14 }, // G5
                { f: 1046.50, start: 0.38, dur: 0.45 }, // C6
                { f: 783.99, start: 0.42, dur: 0.40 }   // G5 harmony
            ];

            notes.forEach(note => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'square';
                osc.frequency.setValueAtTime(note.f, t + note.start);

                gain.gain.setValueAtTime(0.001, t);
                gain.gain.setValueAtTime(0.24, t + note.start);
                gain.gain.exponentialRampToValueAtTime(0.001, t + note.start + note.dur);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(t + note.start);
                osc.stop(t + note.start + note.dur + 0.02);
            });
        }

        // 6. Soft retro terminal click on UI buttons and menus
        playUIClick() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(800, t + 0.018);

            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.018);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t);
            osc.stop(t + 0.02);
        }

        // Typing mistake tactile buzz
        playMistake() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, t);

            gain.gain.setValueAtTime(0.18, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t);
            osc.stop(t + 0.05);
        }

        // Critical Hull warning klaxon
        playAlarm() {
            if (!this._ensureActive()) return;
            const ctx = this.ctx;
            const t = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, t);
            osc.frequency.setValueAtTime(660, t + 0.08);

            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(t);
            osc.stop(t + 0.18);
        }
    }

    window.TypeTankAudio = new SoundSynthesizer();

})(window);
