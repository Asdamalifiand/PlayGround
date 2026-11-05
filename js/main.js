import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { Renderer, VIEW_W, VIEW_H } from './renderer.js';
import { World } from './world.js';
import { LEVELS, THEMES } from './levels.js';
import { clamp, formatTime, store } from './util.js';

const MEDAL_RANK = { none: 0, bronze: 1, silver: 2, gold: 3 };

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.input = new Input();
    this.input.attachTouchUI();
    this.audio = new AudioManager();
    this.save = this.loadSave();
    this.world = null;
    this.levelIndex = 0;
    this.state = 'title';
    this.time = 0;
    this.last = performance.now();
    this.rotateDismissed = false;
    this.rotateBlocking = false;
    this.toastTimer = null;
    this.transitioning = false;
    this.acc = 0;

    this.el = {
      app: document.getElementById('app'),
      screens: [...document.querySelectorAll('.screen')],
      toast: document.getElementById('toast'),
      rotate: document.getElementById('rotate-hint'),
      levelGrid: document.getElementById('level-grid'),
      progressSummary: document.getElementById('progress-summary'),
      continueLabel: document.getElementById('continue-label'),
      saveNote: document.getElementById('save-note'),
      pauseStats: document.getElementById('pause-stats'),
      pauseSoundLabel: document.getElementById('pause-sound-label'),
      resultsEyebrow: document.getElementById('results-eyebrow'),
      resultsTitle: document.getElementById('results-title'),
      resultsMedal: document.getElementById('results-medal'),
      resultLums: document.getElementById('result-lums'),
      resultCages: document.getElementById('result-cages'),
      resultTime: document.getElementById('result-time'),
      resultsBest: document.getElementById('results-best'),
      btnNext: document.getElementById('btn-next'),
      deadCopy: document.getElementById('dead-copy'),
      victoryTotals: document.getElementById('victory-totals'),
    };

    this.bindUI();
    this.buildLevelCards();
    this.updateTitle();
    this.syncSoundUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    document.addEventListener('pointerdown', () => this.unlockAudio(), { once: true, passive: true });
    document.addEventListener('keydown', () => this.unlockAudio(), { once: true });

    // Dev/deep-link convenience: ?level=2&play=1
    const params = new URLSearchParams(location.search);
    const lvl = parseInt(params.get('level') || '', 10);
    if (lvl >= 1 && lvl <= LEVELS.length) {
      if (params.get('play') === '1') {
        setTimeout(() => this.startLevel(lvl - 1), 60);
      } else if (params.get('screen') === 'levels') {
        this.showLevels();
      }
    } else if (params.get('screen') === 'levels') {
      this.showLevels();
    }

    window.__lumTide = {
      game: this,
      startLevel: (i) => this.startLevel(i),
      getWorld: () => this.world,
      getState: () => this.state,
    };

    this.setState('title');
    requestAnimationFrame((t) => this.loop(t));
  }

  loadSave() {
    const raw = store.load() || {};
    return {
      unlocked: clamp(parseInt(raw.unlocked, 10) || 1, 1, LEVELS.length),
      levels: raw.levels && typeof raw.levels === 'object' ? raw.levels : {},
      muted: !!raw.muted,
      victory: !!raw.victory,
      totals: raw.totals || {},
    };
  }

  persist() {
    this.save.muted = this.audio.muted;
    store.save(this.save);
  }

  unlockAudio() {
    const wasLocked = !this.audio.unlocked;
    this.audio.unlock();
    if (wasLocked && this.state === 'title') this.audio.startMusic('title');
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */
  loop(t) {
    const dt = clamp((t - this.last) / 1000, 0, 0.033);
    this.last = t;
    this.time += dt;
    this.input.update();

    if (this.input.wasPressed('mute')) this.toggleSound();
    if (this.input.wasPressed('restart') && (this.state === 'playing' || this.state === 'paused' || this.state === 'dead')) {
      this.restartLevel();
    }

    this.updateRotateHint();

    switch (this.state) {
      case 'playing': {
        if (this.input.wasPressed('pause')) {
          this.pauseGame();
        } else if (!this.rotateBlocking) {
          this.acc = (this.acc || 0) + dt;
          const step = 1 / 60;
          let steps = 0;
          while (this.acc >= step && steps < 4 && this.state === 'playing') {
            this.world.update(step, this.input);
            this.input.pressed.clear();
            this.acc -= step;
            steps++;
            this.drainEvents();
          }
          if (steps >= 4) this.acc = 0;
        }
        break;
      }
      case 'paused': {
        if (this.input.wasPressed('pause')) this.resumeGame();
        break;
      }
      case 'title': {
        if (this.input.wasPressed('confirm') || this.input.wasPressed('jump')) this.continueGame();
        break;
      }
      case 'levels':
      case 'howto': {
        if (this.input.wasPressed('pause') || this.input.wasPressed('confirm')) this.showTitle();
        break;
      }
      case 'results': {
        if (this.input.wasPressed('confirm')) this.nextLevel();
        break;
      }
      case 'dead': {
        if (this.input.wasPressed('confirm') || this.input.wasPressed('jump')) this.retryLevel();
        break;
      }
      default: break;
    }

    // Render
    if (this.state === 'title' || this.state === 'levels' || this.state === 'howto' || this.state === 'victory') {
      this.renderer.drawMenu(this.time, 'jungle');
    } else if (this.world) {
      this.renderer.draw(this.world, this.time);
    } else {
      this.renderer.drawMenu(this.time, 'jungle');
    }

    this.input.clearFrame();
    requestAnimationFrame((tt) => this.loop(tt));
  }

  drainEvents() {
    if (!this.world) return;
    const events = this.world.events.splice(0);
    for (const e of events) {
      switch (e.type) {
        case 'dead':
          this.showDead();
          break;
        case 'complete':
          this.showResults();
          break;
        case 'cage':
          this.toast(`ELECTOON FREED · ${e.count} / ${this.world.level.totalCages}`);
          break;
        case 'checkpoint':
          this.toast('CHECKPOINT SAVED');
          break;
        case 'bossDown':
          this.toast('THE LIVID KING IS DEFEATED');
          break;
        case 'bossStart':
          this.toast('THE LIVID KING AWAKENS');
          break;
        default:
          break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Screens                                                             */
  /* ------------------------------------------------------------------ */
  setState(state) {
    this.state = state;
    this.el.app.dataset.state = state;
    const map = {
      title: 'screen-title',
      levels: 'screen-levels',
      howto: 'screen-howto',
      paused: 'screen-pause',
      results: 'screen-results',
      dead: 'screen-dead',
      victory: 'screen-victory',
      playing: null,
    };
    const active = map[state];
    for (const s of this.el.screens) s.classList.toggle('is-active', s.id === active);
    this.input.resetJoystick();
  }

  showTitle() {
    this.world = null;
    this.setState('title');
    this.updateTitle();
    this.audio.startMusic('title');
    this.audio.pauseMusic(false);
    this.audio.unlock();
  }

  showLevels() {
    this.world = null;
    this.buildLevelCards();
    this.setState('levels');
    this.audio.startMusic('title');
    this.audio.pauseMusic(false);
  }

  showHowTo() {
    this.world = null;
    this.setState('howto');
    this.audio.startMusic('title');
  }

  startLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;
    if (index + 1 > this.save.unlocked) return;
    this.audio.unlock();
    this.levelIndex = index;
    this.world = new World(index, this.audio);
    this.renderer.setLevel(this.world.level);
    this.setState('playing');
    const theme = THEMES[this.world.level.theme];
    this.audio.startMusic(theme.music);
    this.audio.pauseMusic(false);
    this.rotateDismissed = false;
    this.acc = 0;
    this.toast(`WORLD ${this.world.level.id} · ${theme.name.toUpperCase()}`, 2000);
    this.tryLockOrientation();
  }

  restartLevel() {
    this.startLevel(this.levelIndex);
    this.toast('LEVEL RESTARTED', 1000);
  }

  pauseGame() {
    if (!this.world || this.world.state === 'complete') return;
    this.setState('paused');
    this.audio.pauseMusic(true);
    this.updatePauseStats();
  }

  resumeGame() {
    this.setState('playing');
    this.audio.pauseMusic(false);
    this.audio.startMusic(THEMES[this.world.level.theme].music);
  }

  updatePauseStats() {
    if (!this.world) return;
    this.el.pauseStats.innerHTML = `
      <span>LUMS<b>${this.world.stats.lums} / ${this.world.level.totalLums}</b></span>
      <span>ELECTOONS<b>${this.world.stats.cages} / ${this.world.level.totalCages}</b></span>
      <span>TIME<b>${formatTime(this.world.timer)}</b></span>
    `;
  }

  showDead() {
    this.setState('dead');
    this.audio.pauseMusic(true);
    const hasCheckpoint = this.world && this.world.level.checkpoints.some((c) => c.active);
    this.el.deadCopy.textContent = hasCheckpoint
      ? 'The last bell will ring you back. Your Lums are safe.'
      : 'Back to the start of the world. Your Lums are safe.';
  }

  retryLevel() {
    if (!this.world) {
      this.startLevel(this.levelIndex);
      return;
    }
    this.world.events.length = 0;
    this.world.respawn();
    this.setState('playing');
    this.audio.pauseMusic(false);
    this.audio.startMusic(THEMES[this.world.level.theme].music);
    this.toast('TRY AGAIN', 900);
  }

  showResults() {
    if (!this.world) return;
    const w = this.world;
    const lums = w.stats.lums;
    const total = w.level.totalLums;
    const cages = w.stats.cages;
    const totalCages = w.level.totalCages;
    const time = w.timer;
    const medal = computeMedal(lums, total, cages, totalCages);
    const prev = this.save.levels[this.levelIndex] || {};
    const prevRank = MEDAL_RANK[prev.medal] || 0;
    const newBestLums = lums > (prev.lums || 0);
    const newBestCages = cages > (prev.cages || 0);

    this.save.levels[this.levelIndex] = {
      lums: Math.max(prev.lums || 0, lums),
      total,
      cages: Math.max(prev.cages || 0, cages),
      totalCages,
      time: prev.time ? Math.min(prev.time, time) : time,
      medal: MEDAL_RANK[medal] >= prevRank ? medal : prev.medal,
    };
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    if (this.levelIndex === LEVELS.length - 1) this.save.victory = true;
    this.persist();

    const theme = THEMES[w.level.theme];
    this.el.resultsEyebrow.textContent = this.levelIndex === LEVELS.length - 1 ? 'THE LUM TIDE IS RESTORED' : 'WORLD CLEARED';
    this.el.resultsTitle.textContent = theme.name;
    this.el.resultLums.textContent = `${lums} / ${total}`;
    this.el.resultCages.textContent = `${cages} / ${totalCages}`;
    this.el.resultTime.textContent = formatTime(time);
    this.el.resultsMedal.className = `medal ${medal}`;
    this.el.resultsMedal.innerHTML = `<span class="medal-star">★</span><span class="medal-name">${medal.toUpperCase()}</span>`;
    const notes = [];
    if (newBestLums) notes.push('NEW BEST LUMS');
    if (newBestCages) notes.push('NEW BEST ELECTOONS');
    if (!notes.length) notes.push('BEST RUN KEPT');
    this.el.resultsBest.textContent = notes.join(' · ');
    this.el.btnNext.textContent = this.levelIndex === LEVELS.length - 1 ? 'FINISH ADVENTURE' : 'NEXT WORLD';

    this.setState('results');
    this.audio.pauseMusic(true);
    this.audio.sfx('unlock');
  }

  nextLevel() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.showVictory();
    } else {
      this.startLevel(this.levelIndex + 1);
    }
  }

  showVictory() {
    this.save.victory = true;
    this.persist();
    let lums = 0, cages = 0, gold = 0, time = 0;
    for (let i = 0; i < LEVELS.length; i++) {
      const l = this.save.levels[i];
      if (!l) continue;
      lums += l.lums || 0;
      cages += l.cages || 0;
      time += l.time || 0;
      if (l.medal === 'gold') gold++;
    }
    this.el.victoryTotals.innerHTML = `
      <div>LUMS<b>${lums}</b></div>
      <div>ELECTOONS<b>${cages} / ${LEVELS.reduce((n, l) => n + l.totalCages, 0)}</b></div>
      <div>GOLD MEDALS<b>${gold} / ${LEVELS.length}</b></div>
      <div>TOTAL TIME<b>${formatTime(time)}</b></div>
    `;
    this.setState('victory');
    this.audio.startMusic('title');
    this.audio.pauseMusic(false);
    this.audio.sfx('goal');
  }

  continueGame() {
    this.audio.unlock();
    let index = clamp(this.save.unlocked - 1, 0, LEVELS.length - 1);
    // If the last unlocked world is already cleared, start the next one when available.
    if (this.save.levels[index] && index < LEVELS.length - 1) index += 1;
    this.startLevel(index);
  }

  /* ------------------------------------------------------------------ */
  /* UI                                                                  */
  /* ------------------------------------------------------------------ */
  bindUI() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        this.audio.unlock();
        this.audio.sfx('click');
        this.handleAction(btn.dataset.action);
        return;
      }
      const card = e.target.closest('.level-card');
      if (card && !card.disabled) {
        this.audio.unlock();
        this.audio.sfx('select');
        this.startLevel(parseInt(card.dataset.level, 10));
      }
    });

    document.getElementById('btn-pause')?.addEventListener('click', () => {
      if (this.state === 'playing') this.pauseGame();
    });
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());
    document.getElementById('btn-play-portrait')?.addEventListener('click', () => {
      this.rotateDismissed = true;
      this.el.rotate.classList.remove('show');
      this.rotateBlocking = false;
    });

    // Stop context menus on long-press controls.
    for (const id of ['joystick', 'btn-jump', 'btn-punch']) {
      document.getElementById(id)?.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  handleAction(action) {
    switch (action) {
      case 'continue': this.continueGame(); break;
      case 'levels': this.showLevels(); break;
      case 'howto': this.showHowTo(); break;
      case 'back-title': this.showTitle(); break;
      case 'resume': this.resumeGame(); break;
      case 'restart': this.restartLevel(); break;
      case 'levels-from-pause':
      case 'levels-from-results':
      case 'levels-from-dead':
      case 'levels-from-victory':
        this.showLevels();
        break;
      case 'retry': this.retryLevel(); break;
      case 'next-level': this.nextLevel(); break;
      case 'toggle-sound': this.toggleSound(); break;
      default: break;
    }
  }

  toggleSound() {
    const muted = this.audio.toggleMuted();
    this.syncSoundUI();
    this.persist();
    this.toast(muted ? 'SOUND OFF' : 'SOUND ON', 900);
  }

  syncSoundUI() {
    document.body.classList.toggle('muted', this.audio.muted);
    if (this.el.pauseSoundLabel) this.el.pauseSoundLabel.textContent = this.audio.muted ? 'OFF' : 'ON';
  }

  updateTitle() {
    const unlocked = clamp(this.save.unlocked, 1, LEVELS.length);
    if (unlocked > 1) {
      this.el.continueLabel.textContent = `CONTINUE · WORLD ${unlocked}`;
      this.el.saveNote.textContent = `ADVENTURE IN PROGRESS · ${this.countLums()} LUMS GATHERED`;
    } else {
      this.el.continueLabel.textContent = 'NEW ADVENTURE';
      this.el.saveNote.textContent = '4 WORLDS · 3 ELECTOONS EACH';
    }
  }

  countLums() {
    return Object.values(this.save.levels).reduce((n, l) => n + (l.lums || 0), 0);
  }

  buildLevelCards() {
    if (!this.el.levelGrid) return;
    const totalLums = LEVELS.reduce((n, l) => n + l.totalLums, 0);
    this.el.progressSummary.textContent = `${this.countLums()} / ${totalLums} LUMS GATHERED`;
    this.el.levelGrid.innerHTML = '';
    LEVELS.forEach((level, i) => {
      const theme = THEMES[level.theme];
      const unlocked = i < this.save.unlocked;
      const best = this.save.levels[i];
      const card = document.createElement('button');
      card.className = `level-card${unlocked ? '' : ' locked'}`;
      card.dataset.level = String(i);
      card.disabled = !unlocked;
      card.style.setProperty('--a', theme.card[0]);
      card.style.setProperty('--b', theme.card[1]);
      card.style.setProperty('--c', theme.card[2]);
      const medal = best?.medal || 'none';
      card.innerHTML = `
        <div class="card-top">
          <span class="card-num">${i + 1}</span>
          <span class="card-lock">${unlocked ? '' : '🔒'}</span>
        </div>
        <div class="card-art">${theme.icon}</div>
        <div class="card-body">
          <div class="card-world">${unlocked ? `WORLD ${i + 1}` : 'LOCKED'}</div>
          <div class="card-name">${theme.name}</div>
          <div class="card-stats">
            <span class="card-stat">✦ ${best ? best.lums : 0}</span>
            <span class="card-stat">🧚 ${best ? best.cages : 0}</span>
            <span class="card-medal ${medal}">${medal === 'none' ? '' : '★'}</span>
          </div>
        </div>
      `;
      this.el.levelGrid.appendChild(card);
    });
  }

  resize() {
    const vw = window.visualViewport?.width || window.innerWidth;
    const vh = window.visualViewport?.height || window.innerHeight;
    const scale = Math.min(vw / VIEW_W, vh / VIEW_H);
    this.canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    this.canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    this.updateRotateHint();
  }

  updateRotateHint() {
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    if (!portrait) this.rotateDismissed = false;
    const show = this.input.touchDevice && portrait && !this.rotateDismissed && this.state === 'playing';
    this.rotateBlocking = show;
    this.el.rotate.classList.toggle('show', show);
  }

  async tryLockOrientation() {
    if (!this.input.touchDevice) return;
    try {
      if (screen.orientation?.lock) {
        await screen.orientation.lock('landscape');
      }
    } catch {
      /* Orientation lock needs fullscreen on most browsers; ignore. */
    }
  }

  toast(text, duration = 1600) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), duration);
  }
}

function computeMedal(lums, total, cages, totalCages) {
  const ratio = total > 0 ? lums / total : 1;
  if (cages >= totalCages && ratio >= 0.85) return 'gold';
  if (ratio >= 0.6 || cages >= totalCages) return 'silver';
  return 'bronze';
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => new Game());
} else {
  new Game();
}
