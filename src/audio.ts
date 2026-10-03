    /* Original procedural menu score, local battlefield music, and battlefield sound. */
    'use strict';
    const BATTLE_MUSIC_URLS = [
      './audio/music-ratchet-theory.mp3',
      './audio/music-last-light-relay.mp3',
      './audio/music-breach-protocol.mp3',
      './audio/music-black-channel.mp3',
      './audio/music-sporewake.mp3',
      './audio/music-rootmind.mp3'
    ];
    const BATTLE_MUSIC_GAP = 10;
    const INFANTRY_SHOT_URL = './audio/sfx-infantry-shot.wav';
    const INFANTRY_SHOT_POOL_SIZE = 5;
    type MusicMode = 'menu' | 'battle' | 'silent';
    type VoiceKind = 'dialogue' | 'selection';
    const VOICE_GAIN: Record<VoiceKind, number> = { dialogue: .75, selection: .25 };
    interface VoicePlayback { id: VoiceLineId; kind: VoiceKind; suspended: boolean; attempt: number; }
    interface Window { webkitAudioContext?: typeof AudioContext; }
    class MeridianAudio {
      settings: MeridianSettings;
      ctx: AudioContext | null;
      master: GainNode | null;
      musicGain: GainNode | null;
      menuGain: GainNode | null;
      effectsGain: GainNode | null;
      battleTrack: HTMLAudioElement | null;
      infantryShots: HTMLAudioElement[];
      infantryShotIndex: number;
      battleTrackIndex: number;
      battleGapRemaining: number | null;
      battleGapUntil: number | null;
      battlePlayPending: boolean;
      battlePlayFailed: boolean;
      musicMode: MusicMode;
      nextChord: number;
      chord: number;
      lastShot: number;
      started: boolean;
      noiseBuffer?: AudioBuffer;
      voiceTrack: HTMLAudioElement | null = null;
      activeVoice: VoicePlayback | null = null;
      lastSelectionLine: VoiceLineId | null = null;
      selectionNextAt = 0;
      constructor(settings: MeridianSettings, private voiceRandom: () => number = Math.random) {
        this.settings = settings;
        this.ctx = null;
        this.master = null;
        this.musicGain = null;
        this.menuGain = null;
        this.effectsGain = null;
        this.battleTrack = null;
        this.infantryShots = [];
        this.infantryShotIndex = 0;
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
          this.createInfantryShots();
          this.createVoiceTrack();
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
          console.warn('Audio unavailable:', e instanceof Error ? e.message : String(e));
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
          (track as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
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
          console.warn('Battle music unavailable:', error instanceof Error ? error.message : String(error));
        }
      }
      createInfantryShots() {
        if (this.infantryShots.length || typeof Audio !== 'function') return;
        try {
          for (let i = 0; i < INFANTRY_SHOT_POOL_SIZE; i++) {
            const shot = new Audio(INFANTRY_SHOT_URL);
            shot.preload = 'auto';
            (shot as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
            this.infantryShots.push(shot);
          }
        } catch (error) {
          this.infantryShots = [];
          console.warn('Infantry shot unavailable:', error instanceof Error ? error.message : String(error));
        }
      }
      playInfantryShot() {
        if (!this.infantryShots.length) return;
        const shot = this.infantryShots[this.infantryShotIndex++ % this.infantryShots.length];
        try {
          shot.currentTime = 0;
          const playing = shot.play();
          if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        } catch (_) {}
      }
      createVoiceTrack() {
        if (this.voiceTrack || typeof Audio !== 'function') return;
        try {
          const track = new Audio();
          track.preload = 'metadata';
          (track as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
          track.addEventListener('ended', () => {
            if (track.ended && this.activeVoice) this.stopVoice();
          });
          track.addEventListener('error', () => {
            if (track.error && this.activeVoice) this.voiceFailed(this.activeVoice);
          });
          this.voiceTrack = track;
        } catch (error) {
          console.warn('Speech unavailable:', error instanceof Error ? error.message : String(error));
        }
      }
      voiceFailed(playback: VoicePlayback) {
        // An interrupted request can reject after a newer line has already begun.
        if (this.activeVoice !== playback) return;
        console.warn(`Speech unavailable: ${playback.id}`);
        this.stopVoice();
      }
      startVoice(playback: VoicePlayback) {
        const track = this.voiceTrack;
        if (!track || this.activeVoice !== playback || playback.suspended) return;
        const attempt = ++playback.attempt;
        try {
          const playing = track.play();
          if (playing && typeof playing.catch === 'function')
            playing.catch(() => { if (playback.attempt === attempt) this.voiceFailed(playback); });
        } catch (_) { this.voiceFailed(playback); }
      }
      playVoice(id: VoiceLineId, kind: VoiceKind = 'dialogue'): boolean {
        const line = voiceLine(id), track = this.voiceTrack;
        if (!line.audio || !track || !this.ctx || !this.settings.sfx || this.settings.volume <= 0 || this.musicMode === 'menu') return false;
        if (kind === 'selection' && (this.musicMode !== 'battle' || this.activeVoice?.kind === 'dialogue')) return false;
        this.stopVoice();
        const playback: VoicePlayback = { id, kind, suspended: this.musicMode === 'silent', attempt: 0 };
        this.activeVoice = playback;
        try {
          track.src = line.audio;
          track.currentTime = 0;
          this.syncVoiceVolume();
          this.syncBattleTrack();
          this.startVoice(playback);
          return this.activeVoice === playback;
        } catch (_) {
          this.voiceFailed(playback);
          return false;
        }
      }
      selectionVoice(units: readonly Pick<UnitEntity, 'type'>[], group = false): boolean {
        if (!units.length) return false;
        let pool = [...new Set(units.flatMap(e => SELECTION_VOICE_LINES[e.type] || []))];
        // HUD group buttons always get one random response, even for unvoiced unit types.
        if (!pool.length && group) pool = [...new Set(Object.values(SELECTION_VOICE_LINES).flatMap(lines => lines || []))];
        if (!pool.length || !this.ctx || !this.voiceTrack || !this.settings.sfx || this.settings.volume <= 0) return false;
        // Suppressed responses are handled, not replaced by a flood of selection beeps.
        if (this.activeVoice?.kind === 'dialogue' || this.ctx.currentTime < this.selectionNextAt) return true;
        if (pool.length > 1) pool = pool.filter(id => id !== this.lastSelectionLine);
        const id = pool[Math.min(pool.length - 1, Math.floor(this.voiceRandom() * pool.length))];
        if (!this.playVoice(id, 'selection')) return false;
        this.lastSelectionLine = id;
        this.selectionNextAt = this.ctx.currentTime + .35;
        return true;
      }
      isVoiceActive(id: VoiceLineId): boolean { return this.activeVoice?.id === id; }
      stopVoice(kind?: VoiceKind) {
        if (!this.activeVoice || (kind && this.activeVoice.kind !== kind)) return;
        this.activeVoice = null;
        this.voiceTrack?.pause();
        try { if (this.voiceTrack) this.voiceTrack.currentTime = 0; } catch (_) {}
        this.syncBattleTrack();
      }
      syncVoiceVolume() {
        if (this.voiceTrack) this.voiceTrack.volume = this.settings.sfx
          ? Math.max(0, Math.min(1, this.settings.volume)) * VOICE_GAIN[this.activeVoice?.kind || 'dialogue']
          : 0;
      }
      syncVoiceMode() {
        const playback = this.activeVoice;
        if (!playback) return;
        if (this.musicMode === 'menu' || !this.settings.sfx || this.settings.volume <= 0) {
          this.stopVoice();
        } else if (this.musicMode === 'silent') {
          if (playback.kind === 'selection') this.stopVoice();
          else { playback.suspended = true; playback.attempt++; this.voiceTrack?.pause(); }
        } else if (playback.suspended) {
          playback.suspended = false;
          this.startVoice(playback);
        }
      }
      resetBattleMusic() {
        this.stopVoice();
        this.lastSelectionLine = null;
        this.selectionNextAt = 0;
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
        track.volume = this.settings.music ? Math.max(0, Math.min(1, this.settings.volume)) * 0.1 *
          (this.activeVoice?.kind === 'dialogue' && !this.activeVoice.suspended ? .35 : 1) : 0;
        // Audio-clock seconds, never simulation time or game-speed-scaled dt.
        let now = this.ctx!.currentTime;
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
          console.warn('Battle music unavailable:', error instanceof Error ? error.message : String(error));
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
      setMode(mode: MusicMode) {
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
        this.syncVoiceMode();
        this.syncBattleTrack();
      }
      updateSettings() {
        if (!this.ctx) return;
        this.master!.gain.setTargetAtTime(this.settings.volume, this.ctx.currentTime, 0.08);
        this.musicGain!.gain.setTargetAtTime(this.settings.music ? 1 : 0, this.ctx.currentTime, 0.15);
        this.menuGain!.gain.setTargetAtTime(
          this.musicMode === 'menu' && this.settings.music ? 1 : 0,
          this.ctx.currentTime,
          0.12
        );
        this.effectsGain!.gain.setTargetAtTime(this.settings.sfx ? 1 : 0, this.ctx.currentTime, 0.05);
        const infantryShotVolume = this.settings.sfx
          ? Math.max(0, Math.min(1, this.settings.volume)) * 0.16
          : 0;
        for (const shot of this.infantryShots) shot.volume = infantryShotVolume;
        this.syncVoiceVolume();
        this.syncVoiceMode();
        this.syncBattleTrack();
      }
      tone(freq: number, duration = 0.1, volume = 0.12, type: OscillatorType = 'sine', dest: AudioNode | null = null, delay = 0, endFreq: number | null = null) {
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
        g.connect(dest || this.effectsGain!);
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
        g.connect(this.effectsGain!);
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
      sound(type: string, heavy = false) {
        if (!this.ctx || !this.settings.sfx) return;
        let t = this.ctx.currentTime;
        if (type === 'shot') {
          if (t - this.lastShot < (heavy ? 0.15 : 0.085)) return;
          this.lastShot = t;
          if (!heavy) {
            this.playInfantryShot();
            return;
          }
          this.tone(100, 0.19, 0.22, 'sawtooth', null, 0, 38);
          this.noise(0.21, 0.18, 800);
        } else if (type === 'explosion') {
          this.tone(heavy ? 65 : 110, heavy ? 0.5 : 0.25, heavy ? 0.3 : 0.17, 'sine', null, 0, 24);
          this.noise(heavy ? 0.6 : 0.3, heavy ? 0.23 : 0.13, 1500);
        } else if (type === 'order') {
          this.tone(500, 0.05, 0.075, 'sine');
          this.tone(710, 0.07, 0.065, 'sine', null, 0.055);
        } else if (type === 'pickup') {
          // Short cargo-latch click followed by an ascending confirmation chime.
          this.tone(160, 0.04, 0.045, 'triangle', null, 0, 80);
          this.tone(660, 0.12, 0.065, 'sine', null, 0.045);
          this.tone(990, 0.2, 0.05, 'sine', null, 0.12);
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
        } else if (type === 'victory') {
          [220, 261.63, 330, 440, 659.25].forEach((f, i) =>
            this.tone(f, 2.3, 0.1, 'sine', null, i * 0.22)
          );
        } else if (type === 'defeat') {
          [164.81, 146.83, 110, 82.4].forEach((f, i) => this.tone(f, 2, 0.11, 'sine', null, i * 0.28));
        }
      }
    }
