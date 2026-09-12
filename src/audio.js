    /* Original procedural menu score, local battlefield music, and battlefield sound. */
    'use strict';
    const BATTLE_MUSIC_URLS = [
      './audio/music-ratchet-theory.mp3',
      './audio/music-breach-protocol.mp3',
      './audio/music-black-channel.mp3'
    ];
    const BATTLE_MUSIC_GAP = 10;
    class MeridianAudio {
      constructor(settings) {
        this.settings = settings;
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.menuGain = null;
        this.effectsGain = null;
        this.battleTrack = null;
        this.battleTrackIndex = 0;
        this.battleGapRemaining = BATTLE_MUSIC_GAP;
        this.battleGapUntil = null;
        this.battlePlayPending = false;
        this.battlePlayFailed = false;
        this.musicMode = 'menu';
        this.nextChord = 0;
        this.chord = 0;
        this.lastShot = -10;
        this.started = false;
      }
      unlock() {
        if (this.ctx) {
          if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
          this.battlePlayFailed = false;
          this.syncBattleTrack();
          return;
        }
        try {
          let C = window.AudioContext || window.webkitAudioContext;
          if (!C) return;
          this.ctx = new C();
          let c = this.ctx;
          this.master = c.createGain();
          this.master.gain.value = this.settings.volume;
          let compressor = c.createDynamicsCompressor();
          compressor.threshold.value = -20;
          compressor.knee.value = 24;
          compressor.ratio.value = 5;
          compressor.attack.value = 0.004;
          compressor.release.value = 0.3;
          this.master.connect(compressor);
          compressor.connect(c.destination);
          this.musicGain = c.createGain();
          this.menuGain = c.createGain();
          this.effectsGain = c.createGain();
          this.menuGain.connect(this.musicGain);
          this.musicGain.connect(this.master);
          this.effectsGain.connect(this.master);
          this.createBattleTrack();
          this.updateSettings();
          this.noiseBuffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
          let arr = this.noiseBuffer.getChannelData(0),
            last = 0;
          for (let i = 0; i < arr.length; i++) {
            last = (last + Math.random() * 0.04 - 0.02) / 1.01;
            arr[i] = last * 3;
          }
          this.started = true;
          this.nextChord = c.currentTime + 0.1;
          this.sound('select');
        } catch (e) {
          console.warn('Audio unavailable:', e.message);
        }
      }
      createBattleTrack() {
        if (this.battleTrack || typeof Audio !== 'function') return;
        try {
          let track = new Audio(BATTLE_MUSIC_URLS[this.battleTrackIndex]);
          track.loop = false;
          track.addEventListener('ended', () => {
            if (!track.ended || this.battleGapRemaining !== null) return;
            this.battleGapRemaining = BATTLE_MUSIC_GAP;
            this.battleGapUntil = null;
            this.syncBattleTrack();
          });
          track.preload = 'auto';
          track.playsInline = true;
          track.addEventListener(
            'error',
            () => {
              this.battlePlayFailed = true;
              console.warn('Battle music unavailable.');
            },
            { once: true }
          );
          this.battleTrack = track;
        } catch (error) {
          this.battlePlayFailed = true;
          console.warn('Battle music unavailable:', error.message);
        }
      }
      resetBattleMusic() {
        this.battleGapRemaining = BATTLE_MUSIC_GAP;
        this.battleGapUntil = null;
        this.battlePlayFailed = false;
        if (this.battleTrack) {
          this.battleTrack.pause();
          if (this.battleTrackIndex !== 0) this.battleTrack.src = BATTLE_MUSIC_URLS[0];
          try {
            this.battleTrack.currentTime = 0;
          } catch (_) {}
        }
        this.battleTrackIndex = 0;
      }
      syncBattleTrack() {
        let track = this.battleTrack;
        if (!track) return;
        track.volume = this.settings.music ? Math.max(0, Math.min(1, this.settings.volume)) * 0.1 : 0;
        // Audio-clock seconds, never simulation time or game-speed-scaled dt.
        let now = this.ctx.currentTime;
        if (this.musicMode !== 'battle' || !this.settings.music) {
          if (this.battleGapUntil !== null) {
            this.battleGapRemaining = Math.max(0, this.battleGapUntil - now);
            this.battleGapUntil = null;
          }
          track.pause();
          return;
        }
        if (this.battleGapRemaining !== null) {
          if (this.battleGapUntil === null) this.battleGapUntil = now + this.battleGapRemaining;
          if (now < this.battleGapUntil) return;
          this.battleGapRemaining = null;
          this.battleGapUntil = null;
          // The initial delay keeps track 1; only a finished track advances.
          if (track.ended) {
            this.battleTrackIndex = (this.battleTrackIndex + 1) % BATTLE_MUSIC_URLS.length;
            track.src = BATTLE_MUSIC_URLS[this.battleTrackIndex];
          }
          this.battlePlayFailed = false;
        }
        // The media clock can reach ended before its queued event is delivered.
        // Do not restart this file in that frame; the event starts the gap.
        if (track.ended || !track.paused || this.battlePlayPending || this.battlePlayFailed) return;
        let playing;
        try {
          playing = track.play();
        } catch (error) {
          this.battlePlayFailed = true;
          console.warn('Battle music unavailable:', error.message);
          return;
        }
        if (playing && typeof playing.catch === 'function') {
          this.battlePlayPending = true;
          playing
            .catch(error => {
              if (error?.name !== 'AbortError') {
                this.battlePlayFailed = true;
                console.warn('Battle music unavailable:', error.message);
              }
            })
            .finally(() => (this.battlePlayPending = false));
        }
      }
      setMode(mode) {
        if (!['menu', 'battle', 'silent'].includes(mode)) return;
        let changed = mode !== this.musicMode;
        this.musicMode = mode;
        if (changed && mode === 'battle') this.battlePlayFailed = false;
        if (this.ctx && this.menuGain)
          this.menuGain.gain.setTargetAtTime(
            mode === 'menu' && this.settings.music ? 1 : 0,
            this.ctx.currentTime,
            0.12
          );
        if (changed && mode !== 'battle' && this.battleTrack) {
          this.battleTrack.pause();
          if (mode === 'menu') this.resetBattleMusic();
        }
        this.syncBattleTrack();
      }
      updateSettings() {
        if (!this.ctx) return;
        this.master.gain.setTargetAtTime(this.settings.volume, this.ctx.currentTime, 0.08);
        this.musicGain.gain.setTargetAtTime(this.settings.music ? 1 : 0, this.ctx.currentTime, 0.15);
        this.menuGain.gain.setTargetAtTime(
          this.musicMode === 'menu' && this.settings.music ? 1 : 0,
          this.ctx.currentTime,
          0.12
        );
        this.effectsGain.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, this.ctx.currentTime, 0.05);
        this.syncBattleTrack();
      }
      tone(freq, duration = 0.1, volume = 0.12, type = 'sine', dest = null, delay = 0, endFreq = null) {
        if (!this.ctx) return;
        let c = this.ctx,
          t = c.currentTime + delay,
          o = c.createOscillator(),
          g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(15, endFreq), t + duration);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(
          Math.max(0.0002, volume),
          t + Math.min(0.035, duration * 0.15)
        );
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g);
        g.connect(dest || this.effectsGain);
        o.start(t);
        o.stop(t + duration + 0.03);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
      }
      noise(duration = 0.25, volume = 0.12, freq = 900) {
        if (!this.ctx || !this.noiseBuffer) return;
        let c = this.ctx,
          t = c.currentTime,
          src = c.createBufferSource(),
          f = c.createBiquadFilter(),
          g = c.createGain();
        src.buffer = this.noiseBuffer;
        f.type = 'lowpass';
        f.frequency.value = freq;
        g.gain.setValueAtTime(volume, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(f);
        f.connect(g);
        g.connect(this.effectsGain);
        src.start();
        src.stop(t + duration);
        src.onended = () => {
          src.disconnect();
          f.disconnect();
          g.disconnect();
        };
      }
      update(mode = this.musicMode) {
        if (mode !== this.musicMode) this.setMode(mode);
        if (this.musicMode === 'battle') this.syncBattleTrack();
        if (!this.ctx || !this.settings.music || this.musicMode !== 'menu' || this.ctx.state !== 'running') return;
        let now = this.ctx.currentTime;
        if (now < this.nextChord) return;
        let roots = [55, 65.406, 49, 58.27, 55, 73.416, 65.406, 49],
          root = roots[this.chord++ % roots.length];
        this.nextChord = now + 6.4;
        this.tone(root, 9, 0.13, 'sine', this.menuGain);
        this.tone(root * 2, 7.5, 0.035, 'triangle', this.menuGain, 0.6);
        this.tone(root * 2.997, 7, 0.025, 'sine', this.menuGain, 1.1);
        this.tone(root * 2.3784, 7, 0.035, 'sine', this.menuGain, 2.5);
        if (this.chord % 2 === 0) {
          this.tone(root * 8, 2.3, 0.018, 'sine', this.menuGain, 3.4);
          this.tone(root * 6, 2.8, 0.02, 'sine', this.menuGain, 4.8);
        }
      }
      sound(type, heavy = false) {
        if (!this.ctx || !this.settings.sfx) return;
        let t = this.ctx.currentTime;
        if (type === 'shot') {
          if (t - this.lastShot < (heavy ? 0.15 : 0.085)) return;
          this.lastShot = t;
          this.tone(
            heavy ? 100 : 230,
            heavy ? 0.19 : 0.07,
            heavy ? 0.22 : 0.1,
            'sawtooth',
            null,
            0,
            heavy ? 38 : 70
          );
          this.noise(heavy ? 0.21 : 0.06, heavy ? 0.18 : 0.07, heavy ? 800 : 2400);
        } else if (type === 'explosion') {
          this.tone(heavy ? 65 : 110, heavy ? 0.5 : 0.25, heavy ? 0.3 : 0.17, 'sine', null, 0, 24);
          this.noise(heavy ? 0.6 : 0.3, heavy ? 0.23 : 0.13, 1500);
        } else if (type === 'order') {
          this.tone(500, 0.05, 0.075, 'sine');
          this.tone(710, 0.07, 0.065, 'sine', null, 0.055);
        } else if (type === 'select') {
          this.tone(680, 0.05, 0.05, 'sine');
        } else if (type === 'complete' || type === 'research' || type === 'trained') {
          this.tone(420, 0.16, 0.08, 'sine');
          this.tone(630, 0.2, 0.065, 'sine', null, 0.13);
        } else if (type === 'radio') {
          this.noise(0.13, 0.06, 2100);
          this.tone(900, 0.045, 0.025, 'sine');
        } else if (type === 'scan' || type === 'heal') {
          this.tone(180, 0.7, 0.12, 'sine', null, 0, 1100);
        } else if (type === 'wave') {
          this.tone(165, 0.5, 0.09, 'triangle');
          this.tone(155, 0.5, 0.055, 'sine', null, 0.08);
          this.tone(130, 0.5, 0.09, 'triangle', null, 0.6);
        } else if (type === 'victory') {
          [220, 261.63, 330, 440, 659.25].forEach((f, i) =>
            this.tone(f, 2.3, 0.1, 'sine', null, i * 0.22)
          );
        } else if (type === 'defeat') {
          [164.81, 146.83, 110, 82.4].forEach((f, i) => this.tone(f, 2, 0.11, 'sine', null, i * 0.28));
        }
      }
    }
