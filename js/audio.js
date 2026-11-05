import { store } from './util.js';

const THEMES = {
  jungle: {
    tempo: 104, root: 50, scale: [0, 2, 4, 7, 9, 12, 14, 16],
    chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [2, 5, 9]],
    lead: [0, 4, 2, 4, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 4, 0],
    timbre: 'triangle', bass: 'sine', shaker: true, pad: false,
  },
  desert: {
    tempo: 96, root: 52, scale: [0, 1, 4, 5, 7, 8, 11, 12],
    chords: [[0, 4, 7], [1, 5, 8], [-2, 1, 5], [0, 4, 7]],
    lead: [0, 4, 7, 4, 1, 5, 8, 5, 0, 4, 7, 11, 8, 5, 4, 1],
    timbre: 'sawtooth', bass: 'triangle', shaker: true, pad: true,
  },
  sea: {
    tempo: 100, root: 57, scale: [0, 2, 4, 6, 7, 9, 11, 12],
    chords: [[0, 4, 7], [-2, 2, 5], [-4, 0, 4], [-2, 2, 7]],
    lead: [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2],
    timbre: 'sine', bass: 'sine', shaker: false, pad: true,
  },
  dark: {
    tempo: 88, root: 48, scale: [0, 1, 3, 5, 7, 8, 10, 12],
    chords: [[0, 3, 7], [-1, 3, 6], [-3, 0, 4], [-1, 3, 7]],
    lead: [0, 3, 7, 6, 3, 0, 7, 3, 0, 3, 10, 8, 7, 3, 1, 0],
    timbre: 'sawtooth', bass: 'sine', shaker: true, pad: true,
  },
  title: {
    tempo: 98, root: 53, scale: [0, 2, 4, 7, 9, 12, 14, 16],
    chords: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [2, 5, 9]],
    lead: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 9, 12, 9, 7, 4],
    timbre: 'triangle', bass: 'sine', shaker: false, pad: true,
  },
};

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.theme = null;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.stepDur = 0.14;
    this.volume = 0.8;
    this.musicVolume = 0.13;
    this.unlocked = false;
    const saved = store.load();
    this.muted = !!(saved && saved.muted);
    document.body.classList.toggle('muted', this.muted);
  }

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
      this.noiseBuffer = this._makeNoise();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  unlock() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.unlocked = true;
  }

  _makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last * 1.8;
    }
    return buf;
  }

  setMuted(muted) {
    this.muted = !!muted;
    document.body.classList.toggle('muted', this.muted);
    if (this.master && this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.03);
    }
    const saved = store.load() || {};
    saved.muted = this.muted;
    store.save(saved);
    return this.muted;
  }

  toggleMuted() { return this.setMuted(!this.muted); }

  startMusic(themeId = 'title') {
    if (!this.init()) return;
    if (!THEMES[themeId]) themeId = 'title';
    if (this.theme === themeId && this.timer) return;
    this.stopMusic();
    this.theme = themeId;
    this.cfg = THEMES[themeId];
    this.stepDur = 60 / this.cfg.tempo / 4;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._schedule(), 55);
    this._schedule();
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.theme = null;
  }

  pauseMusic(paused) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(paused ? 0.02 : this.musicVolume, t, 0.12);
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const horizon = this.ctx.currentTime + 0.2;
    let guard = 0;
    while (this.nextTime < horizon && guard++ < 64) {
      this._playStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  _playStep(step, when) {
    const cfg = this.cfg;
    if (!cfg) return;
    const bar = Math.floor(step / 16) % 4;
    const beat = step % 16;
    const chord = cfg.chords[bar];
    // Bass on the first and third beat of each bar.
    if (beat === 0 || beat === 8) {
      this._tone(midiToFreq(cfg.root - 12 + chord[0]), when, 0.42, cfg.bass, 0.11, 0.01, 0.3);
    }
    if (beat === 4) {
      this._tone(midiToFreq(cfg.root - 12 + chord[1]), when, 0.3, cfg.bass, 0.07, 0.01, 0.25);
    }
    // Soft chord pad each bar.
    if (cfg.pad && beat === 0) {
      for (const n of chord) {
        this._tone(midiToFreq(cfg.root + n), when, 1.6, 'sine', 0.022, 0.12, 0.9);
      }
    }
    // Melody.
    const idx = step % cfg.lead.length;
    const note = cfg.lead[idx];
    if (beat % 2 === 0 && note !== null) {
      const octave = beat >= 12 ? 12 : 0;
      this._tone(midiToFreq(cfg.root + note + octave), when, this.stepDur * 1.8, cfg.timbre, 0.045, 0.006, 0.16);
    }
    // Shaker / percussion.
    if (cfg.shaker && (beat === 2 || beat === 6 || beat === 10 || beat === 14)) {
      this._noise(when, 0.035, 0.035, 4200, 0.04);
    }
    if (beat === 0) this._noise(when, 0.09, 0.02, 220, 0.035);
  }

  _tone(freq, when, dur, type, gain, attack = 0.005, release = 0.1) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + release);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(when);
    o.stop(when + dur + release + 0.02);
  }

  _noise(when, dur, gain, cutoff = 2000, filterQ = 1) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cutoff;
    f.Q.value = filterQ;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(when, Math.random() * 0.4);
    src.stop(when + dur + 0.02);
  }

  // ---------------- sound effects ----------------
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + 0.001;
    const S = this.sfxGain;
    const tone = (freq, dur, type = 'sine', gain = 0.5, slideTo = null, delay = 0) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      const start = t + delay;
      o.frequency.setValueAtTime(freq, start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(S);
      o.start(start);
      o.stop(start + dur + 0.02);
    };
    const noise = (dur, gain, cutoff, delay = 0, type = 'bandpass') => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = cutoff;
      const g = this.ctx.createGain();
      const start = t + delay;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f); f.connect(g); g.connect(S);
      src.start(start, Math.random() * 0.3);
      src.stop(start + dur + 0.02);
    };

    switch (name) {
      case 'jump':
        tone(300, 0.18, 'sine', 0.32, 620);
        noise(0.06, 0.08, 900);
        break;
      case 'doubleJump':
        tone(420, 0.22, 'triangle', 0.26, 900);
        noise(0.09, 0.06, 1600);
        break;
      case 'glide':
        noise(0.28, 0.1, 1100);
        tone(220, 0.25, 'sine', 0.08, 320);
        break;
      case 'land':
        noise(0.07, 0.14, 240);
        break;
      case 'punch':
        noise(0.08, 0.28, 700);
        tone(140, 0.1, 'square', 0.12, 60);
        break;
      case 'hit':
        noise(0.14, 0.3, 380);
        tone(180, 0.18, 'sawtooth', 0.18, 70);
        break;
      case 'coin':
        tone(1046, 0.1, 'sine', 0.16, 1568);
        tone(1568, 0.16, 'sine', 0.12, 2093, 0.05);
        break;
      case 'heart':
        tone(660, 0.12, 'sine', 0.2, 990);
        tone(990, 0.2, 'sine', 0.16, 1320, 0.08);
        break;
      case 'hurt':
        tone(420, 0.35, 'sawtooth', 0.3, 90);
        noise(0.2, 0.16, 600);
        break;
      case 'death':
        tone(380, 0.6, 'triangle', 0.3, 70);
        tone(190, 0.8, 'sine', 0.2, 50, 0.08);
        break;
      case 'spring':
        tone(180, 0.32, 'sine', 0.34, 760);
        tone(360, 0.2, 'triangle', 0.14, 900, 0.04);
        break;
      case 'checkpoint':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.18, f * 1.01, i * 0.07));
        break;
      case 'cage':
        [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, 'triangle', 0.16, f, i * 0.06));
        noise(0.18, 0.12, 2400);
        break;
      case 'goal':
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 'sine', 0.18, f * 1.005, i * 0.09));
        break;
      case 'bossHit':
        noise(0.25, 0.34, 220);
        tone(90, 0.4, 'sawtooth', 0.3, 40);
        break;
      case 'bossRoar':
        tone(70, 0.9, 'sawtooth', 0.26, 45);
        noise(0.8, 0.16, 180);
        break;
      case 'explode':
        noise(0.5, 0.3, 300);
        tone(120, 0.5, 'sawtooth', 0.2, 40);
        break;
      case 'splash':
        noise(0.35, 0.22, 1400, 0, 'lowpass');
        break;
      case 'click':
        tone(720, 0.06, 'sine', 0.14, 880);
        break;
      case 'select':
        tone(520, 0.09, 'triangle', 0.16, 780);
        tone(780, 0.12, 'triangle', 0.12, 1040, 0.05);
        break;
      case 'unlock':
        [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.45, 'triangle', 0.14, f, i * 0.08));
        break;
      default:
        break;
    }
  }
}
