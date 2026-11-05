export const TILE = 48;
export const ROWS = 18;

export const THEMES = {
  jungle: {
    key: 'jungle',
    name: 'Jibberish Jungle',
    skyTop: '#116573',
    skyMid: '#37ad93',
    skyBottom: '#c9efa2',
    sun: { x: 0.76, y: 0.2, r: 90, color: '#fff2ad', glow: 'rgba(255,242,173,0.55)' },
    cloud: ['#e8fff0', '#c2eed8', '#a4dcc4'],
    far: ['#23897a', '#2f9d84'],
    mid: ['#1c7563', '#228a70'],
    near: ['#0d4a40', '#11564a'],
    fog: 'rgba(151, 232, 192, 0.16)',
    dirt: ['#714628', '#75492a', '#6d4326'],
    grass: ['#8fe05a', '#5cbb3f', '#3c8f2c'],
    accent: '#ffd45f',
    flower: ['#ff8d7a', '#ffe07a', '#f7f0c6', '#b98cff'],
    water: '#2fb7a8',
    hazard: '#ff6b4a',
    ambient: 'pollen',
    ambientColor: 'rgba(255, 240, 170, 0.85)',
    card: ['#2e9d7d', '#0e4c40', '#072a24'],
    icon: '🌿',
    music: 'jungle',
  },
  desert: {
    key: 'desert',
    name: 'Desert of Dijiridoos',
    skyTop: '#3a2159',
    skyMid: '#b8576c',
    skyBottom: '#ffc46b',
    sun: { x: 0.3, y: 0.36, r: 118, color: '#fff1c4', glow: 'rgba(255,196,107,0.55)' },
    cloud: ['#ffd9a8', '#f2a37c', '#c46a6d'],
    far: ['#8a4a63', '#a65a6a'],
    mid: ['#6e3a52', '#8c4a58'],
    near: ['#45243b', '#572b40'],
    fog: 'rgba(255, 176, 120, 0.14)',
    dirt: ['#bb7941', '#be7c44', '#b6743e'],
    grass: ['#ffd07a', '#f0a94f', '#c77d2e'],
    accent: '#ffb347',
    flower: ['#ffd36e', '#ff8f5e', '#f7e6b8'],
    water: '#3f8fa8',
    hazard: '#ff5a3c',
    ambient: 'sand',
    ambientColor: 'rgba(255, 218, 160, 0.7)',
    card: ['#e08a4c', '#8a3c4e', '#2c1830'],
    icon: '🏜️',
    music: 'desert',
  },
  sea: {
    key: 'sea',
    name: 'Sea of Serendipity',
    skyTop: '#083b57',
    skyMid: '#1f8fa3',
    skyBottom: '#a9f0dc',
    sun: { x: 0.68, y: 0.18, r: 84, color: '#fff6d6', glow: 'rgba(255,246,214,0.6)' },
    cloud: ['#d9fff4', '#a8eadf', '#7fcfc8'],
    far: ['#1a7d8a', '#299aa0'],
    mid: ['#12636f', '#1a7f85'],
    near: ['#0a3f4c', '#0d4f5b'],
    fog: 'rgba(120, 240, 220, 0.16)',
    dirt: ['#3f6f7c', '#42737f', '#3d6b78'],
    grass: ['#7ff0c8', '#3ec4a3', '#25967d'],
    accent: '#7ff0e0',
    flower: ['#ff9fd6', '#ffd0e8', '#c4fbff', '#ffcf6e'],
    water: '#1fb9c9',
    hazard: '#ff6b4a',
    ambient: 'bubbles',
    ambientColor: 'rgba(190, 255, 250, 0.7)',
    card: ['#3cc9c0', '#176b7d', '#062e3c'],
    icon: '🌊',
    music: 'sea',
  },
  dark: {
    key: 'dark',
    name: 'Land of the Livid Dead',
    skyTop: '#0a0716',
    skyMid: '#2a1240',
    skyBottom: '#6b1f47',
    sun: { x: 0.62, y: 0.2, r: 100, color: '#ffb1c8', glow: 'rgba(255,90,120,0.4)' },
    cloud: ['#4a1d4f', '#672a56', '#3a163e'],
    far: ['#33143f', '#46204c'],
    mid: ['#26102f', '#34163c'],
    near: ['#160a1f', '#1e0d28'],
    fog: 'rgba(200, 90, 160, 0.12)',
    dirt: ['#3d2e48', '#40304b', '#3a2b45'],
    grass: ['#a05fc4', '#74409a', '#512a70'],
    accent: '#ff7aa8',
    flower: ['#ff6b9d', '#b98cff', '#ffd36e'],
    water: '#ff5a3c',
    hazard: '#ff4a3c',
    ambient: 'embers',
    ambientColor: 'rgba(255, 120, 90, 0.8)',
    card: ['#7b3c8f', '#3a1748', '#120818'],
    icon: '💀',
    music: 'dark',
  },
};

class LevelBuilder {
  constructor(id, theme, width) {
    this.id = id;
    this.theme = theme;
    this.width = width;
    this.grid = new Uint8Array(width * ROWS);
    this.hazards = new Uint8Array(width * ROWS);
    this.lums = [];
    this.cages = [];
    this.hearts = [];
    this.springs = [];
    this.enemies = [];
    this.checkpoints = [];
    this.signs = [];
    this.props = [];
    this.spawn = { x: 3 * TILE, y: 14 * TILE };
    this.goal = null;
    this.boss = null;
    this.bossTriggerX = null;
    this.arena = null;
    this.waterTop = null;
    this.waterBodies = [];
    this._checkpointCounter = 0;
  }

  solid(x0, y0, x1, y1) {
    for (let y = Math.max(0, y0); y <= Math.min(ROWS - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(this.width - 1, x1); x++) {
        this.grid[y * this.width + x] = 1;
      }
    }
    return this;
  }

  ground(x0, x1, top = 15) {
    return this.solid(x0, top, x1, ROWS - 1);
  }

  platform(x0, row, len = 4) {
    return this.solid(x0, row, x0 + len - 1, row + 1);
  }

  pit(x0, x1) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < this.width) this.grid[y * this.width + x] = 0;
      }
    }
    return this;
  }

  water(x0, x1, topRow) {
    this.pit(x0, x1);
    for (let y = topRow; y < ROWS; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < this.width) this.hazards[y * this.width + x] = 3;
      }
    }
    if (this.waterTop === null || topRow < this.waterTop) this.waterTop = topRow;
    this.waterBodies.push({ x0, x1, topRow, type: 'water' });
    return this;
  }

  lava(x0, x1, topRow) {
    this.pit(x0, x1);
    for (let y = topRow; y < ROWS; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x >= 0 && x < this.width) this.hazards[y * this.width + x] = 4;
      }
    }
    this.waterBodies.push({ x0, x1, topRow, type: 'lava' });
    return this;
  }

  spikes(x, count, row = 14) {
    for (let i = 0; i < count; i++) {
      const tx = x + i;
      if (tx >= 0 && tx < this.width && row >= 0 && row < ROWS) {
        this.hazards[row * this.width + tx] = 2;
      }
    }
    return this;
  }

  lum(tx, ty, size = 1) {
    this.lums.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, size });
    return this;
  }

  lumLine(x0, ty, count, step = 1) {
    for (let i = 0; i < count; i++) this.lum(x0 + i * step, ty);
    return this;
  }

  lumArc(x0, ty, count, spread = 1, height = 2, step = 1) {
    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1);
      const y = ty - Math.sin(t * Math.PI) * height;
      this.lum(x0 + i * step, y);
    }
    return this;
  }

  lumRing(cx, cy, count, radius = 1.6) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.lums.push({ x: (cx + Math.cos(a) * radius) * TILE + TILE / 2, y: (cy + Math.sin(a) * radius) * TILE + TILE / 2, size: 1 });
    }
    return this;
  }

  cage(tx, ty) {
    this.cages.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, freed: false, bob: Math.random() * 6 });
    return this;
  }

  heart(tx, ty) {
    this.hearts.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, taken: false });
    return this;
  }

  spring(tx, row) {
    this.springs.push({ x: tx * TILE + TILE / 2, y: row * TILE, power: 1120, squash: 0 });
    return this;
  }

  enemy(type, tx, row) {
    this.enemies.push({ type, x: tx * TILE + TILE / 2, y: row * TILE, spawnX: tx * TILE + TILE / 2, spawnY: row * TILE });
    return this;
  }

  checkpoint(tx, row) {
    this.checkpoints.push({ x: tx * TILE + TILE / 2, y: row * TILE, active: false, id: this._checkpointCounter++, ring: 0 });
    return this;
  }

  sign(tx, row, text, icon = '') {
    this.signs.push({ x: tx * TILE + TILE / 2, y: row * TILE, text, icon });
    return this;
  }

  prop(type, tx, row, scale = 1, flip = false) {
    this.props.push({ type, x: tx * TILE, y: row * TILE, scale, flip });
    return this;
  }

  spawnAt(tx, row) {
    this.spawn = { x: tx * TILE + TILE / 2, y: row * TILE };
    return this;
  }

  goalAt(tx, row) {
    this.goal = { x: tx * TILE + TILE / 2, y: row * TILE };
    return this;
  }

  bossAt(tx, row, arenaX0, arenaX1) {
    this.boss = { x: tx * TILE, y: row * TILE };
    this.arena = { x0: arenaX0 * TILE, x1: arenaX1 * TILE };
    return this;
  }

  triggerAt(tx) {
    this.bossTriggerX = tx * TILE;
    return this;
  }

  build() {
    return {
      id: this.id,
      theme: this.theme,
      width: this.width,
      rows: ROWS,
      tile: TILE,
      grid: this.grid,
      hazards: this.hazards,
      lums: this.lums,
      cages: this.cages,
      hearts: this.hearts,
      springs: this.springs,
      enemies: this.enemies,
      checkpoints: this.checkpoints,
      signs: this.signs,
      props: this.props,
      spawn: this.spawn,
      goal: this.goal,
      boss: this.boss,
      bossTriggerX: this.bossTriggerX,
      arena: this.arena,
      waterTop: this.waterTop,
      waterBodies: this.waterBodies,
      worldWidth: this.width * TILE,
      worldHeight: ROWS * TILE,
      totalLums: this.lums.length,
      totalCages: this.cages.length,
    };
  }
}

/* ------------------------------------------------------------------ */
/* 1. Jibberish Jungle                                                 */
/* ------------------------------------------------------------------ */
function buildJungle() {
  const b = new LevelBuilder(1, 'jungle', 214);
  b.spawnAt(3, 15);

  b.ground(0, 29);
  b.lumLine(6, 14, 5);
  b.sign(4, 15, 'MOVE', 'move');
  b.enemy('walker', 18, 15);
  b.sign(15, 15, 'JUMP', 'jump');
  b.lumArc(24, 13, 5, 1, 2);
  b.prop('tree', 9, 15, 1.1, true);
  b.prop('fern', 13, 15, 0.9);
  b.prop('rock', 26, 15, 0.8);

  b.pit(30, 33);
  b.lumArc(29, 12, 5, 1, 2.5);
  b.ground(34, 62);
  b.platform(36, 12, 5);
  b.lumLine(37, 11, 3);
  b.heart(40, 11);
  b.spring(44, 15);
  b.lumArc(44, 9, 5, 1, 3);
  b.sign(47, 15, 'BOUNCE', 'spring');
  b.checkpoint(50, 15);
  b.enemy('walker', 54, 15);
  b.enemy('flyer', 57, 10);
  b.platform(58, 11, 4);
  b.cage(60, 8);
  b.prop('fern', 55, 15, 1.1, true);
  b.prop('tree', 61, 15, 0.9);

  b.pit(63, 66);
  b.lumArc(62, 12, 5, 1, 2);
  b.ground(67, 95);
  b.platform(68, 12, 4);
  b.lumLine(69, 11, 2);
  b.platform(73, 10, 4);
  b.lumLine(74, 9, 2);
  b.platform(78, 8, 5);
  b.lumLine(79, 7, 3);
  b.cage(80, 5);
  b.enemy('flyer', 76, 7);
  b.spikes(86, 3);
  b.enemy('walker', 91, 15);
  b.checkpoint(92, 15);
  b.sign(84, 15, 'PUNCH', 'punch');
  b.prop('tree', 89, 15, 1.2, true);
  b.prop('mushroom', 94, 15, 0.9);

  b.pit(96, 101);
  b.platform(98, 13, 2);
  b.lumArc(95, 12, 5, 1, 2);
  b.ground(102, 122);
  b.enemy('spitter', 108, 15);
  b.enemy('walker', 113, 15);
  b.heart(112, 14);
  b.checkpoint(116, 15);
  b.ground(118, 122, 12);
  b.lumLine(118, 11, 4);
  b.prop('ruin', 105, 15, 1);
  b.prop('fern', 120, 12, 0.9, true);

  b.pit(123, 133);
  b.platform(127, 14, 3);
  b.lumArc(122, 10, 7, 1, 3);
  b.ground(134, 151);
  b.checkpoint(138, 15);
  b.enemy('flyer', 141, 9);
  b.enemy('walker', 146, 15);
  b.prop('tree', 143, 15, 1.3);
  b.prop('rock', 149, 15, 1);

  b.ground(152, 179);
  b.spikes(153, 3);
  b.platform(156, 12, 4);
  b.platform(161, 10, 4);
  b.platform(166, 8, 4);
  b.lumLine(157, 11, 2);
  b.lumLine(162, 9, 2);
  b.lumLine(167, 7, 2);
  b.cage(167, 5);
  b.enemy('flyer', 163, 6);
  b.enemy('spitter', 175, 15);
  b.heart(171, 14);
  b.prop('mushroom', 158, 15, 1.1);
  b.prop('fern', 173, 15, 0.8);

  b.pit(180, 183);
  b.lumArc(179, 12, 5, 1, 2);
  b.ground(184, 213);
  b.spikes(189, 3);
  b.enemy('walker', 195, 15);
  b.enemy('flyer', 200, 10);
  b.lumLine(198, 14, 5);
  b.goalAt(206, 15);
  b.prop('tree', 192, 15, 1.4, true);
  b.prop('ruin', 202, 15, 1.1);
  b.prop('fern', 209, 15, 0.9);

  return b.build();
}

/* ------------------------------------------------------------------ */
/* 2. Desert of Dijiridoos                                             */
/* ------------------------------------------------------------------ */
function buildDesert() {
  const b = new LevelBuilder(2, 'desert', 202);
  b.spawnAt(3, 15);

  b.ground(0, 20);
  b.sign(4, 15, 'SPRING!', 'spring');
  b.spring(9, 15);
  b.lumArc(9, 8, 6, 1, 3.5);
  b.enemy('walker', 15, 15);
  b.prop('cactus', 6, 15, 1);
  b.prop('ruin', 18, 15, 0.9);

  b.pit(21, 26);
  b.platform(22, 12, 3);
  b.lumArc(20, 11, 5, 1, 2.5);
  b.ground(27, 49);
  b.spikes(31, 4);
  b.platform(29, 11, 6);
  b.lumLine(30, 10, 4);
  b.enemy('flyer', 36, 9);
  b.enemy('spitter', 42, 15);
  b.checkpoint(45, 15);
  b.platform(41, 12, 4);
  b.cage(43, 9);
  b.prop('cactus', 34, 15, 1.2);
  b.prop('skull', 47, 15, 0.9);

  b.pit(50, 57);
  b.platform(52, 13, 2);
  b.platform(55, 11, 2);
  b.lumArc(49, 10, 6, 1, 2);
  b.ground(58, 81);
  b.spikes(62, 3);
  b.platform(60, 12, 5);
  b.platform(66, 10, 4);
  b.lumLine(67, 9, 2);
  b.enemy('flyer', 70, 8);
  b.enemy('walker', 75, 15);
  b.checkpoint(72, 15);
  b.heart(69, 9);
  b.prop('ruin', 64, 15, 1.2, true);
  b.prop('cactus', 78, 15, 0.9);

  b.pit(82, 94);
  b.spring(81, 15);
  b.platform(85, 12, 3);
  b.platform(90, 10, 3);
  b.lumArc(81, 8, 7, 1, 3);
  b.ground(95, 122);
  b.enemy('spitter', 100, 15);
  b.enemy('walker', 106, 15);
  b.spikes(110, 3);
  b.checkpoint(115, 15);
  b.platform(111, 12, 4);
  b.cage(113, 8);
  b.prop('skull', 104, 15, 1.1);
  b.prop('cactus', 119, 15, 1.3);

  b.pit(123, 133);
  b.platform(125, 13, 2);
  b.platform(129, 11, 2);
  b.platform(132, 13, 2);
  b.lumArc(122, 10, 7, 1, 2.5);
  b.ground(134, 154);
  b.platform(136, 12, 4);
  b.platform(141, 9, 4);
  b.platform(146, 6, 4);
  b.lumLine(137, 11, 2);
  b.lumLine(142, 8, 2);
  b.lumLine(147, 5, 2);
  b.cage(148, 3);
  b.enemy('flyer', 144, 6);
  b.checkpoint(139, 15);
  b.prop('ruin', 150, 15, 1.1);

  b.pit(155, 166);
  b.spring(154, 15);
  b.platform(158, 12, 3);
  b.platform(163, 10, 3);
  b.lumArc(154, 8, 8, 1, 3);
  b.ground(167, 201);
  b.spikes(171, 4);
  b.platform(169, 11, 6);
  b.enemy('spitter', 180, 15);
  b.enemy('walker', 185, 15);
  b.heart(177, 14);
  b.lumLine(188, 14, 6);
  b.goalAt(195, 15);
  b.prop('cactus', 175, 15, 1.4, true);
  b.prop('ruin', 191, 15, 1.3);
  b.prop('skull', 198, 15, 1);

  return b.build();
}

/* ------------------------------------------------------------------ */
/* 3. Sea of Serendipity                                               */
/* ------------------------------------------------------------------ */
function buildSea() {
  const b = new LevelBuilder(3, 'sea', 208);
  b.spawnAt(3, 15);

  b.ground(0, 24);
  b.sign(4, 15, 'MIND THE TIDE', 'water');
  b.enemy('walker', 12, 15);
  b.lumLine(7, 14, 5);
  b.prop('coral', 5, 15, 1);
  b.prop('kelp', 18, 15, 1.1, true);

  b.water(25, 34, 15);
  b.platform(27, 12, 3);
  b.platform(32, 10, 3);
  b.lumArc(24, 9, 7, 1, 3);
  b.spring(24, 15);
  b.prop('coral', 31, 12, 0.8);

  b.ground(35, 54);
  b.spikes(39, 3);
  b.platform(37, 12, 6);
  b.lumLine(38, 11, 4);
  b.enemy('flyer', 45, 8);
  b.checkpoint(49, 15);
  b.cage(39, 9);
  b.prop('kelp', 42, 15, 1.2);
  b.prop('rock', 52, 15, 0.9);

  b.water(55, 69, 15);
  b.platform(57, 12, 3);
  b.platform(62, 10, 3);
  b.platform(66, 12, 3);
  b.spring(54, 15);
  b.lumArc(55, 8, 8, 1, 3);
  b.cage(63, 7);
  b.prop('coral', 60, 10, 1.1);

  b.ground(70, 96);
  b.enemy('spitter', 76, 15);
  b.enemy('walker', 82, 15);
  b.spikes(87, 4);
  b.platform(85, 11, 6);
  b.checkpoint(91, 15);
  b.heart(79, 14);
  b.prop('kelp', 73, 15, 1.3, true);
  b.prop('ruin', 94, 15, 0.9);

  b.water(97, 112, 15);
  b.platform(99, 13, 2);
  b.platform(103, 11, 2);
  b.platform(107, 9, 3);
  b.spring(96, 15);
  b.lumArc(97, 7, 8, 1, 3);
  b.enemy('flyer', 105, 6);
  b.prop('coral', 109, 9, 1.2);

  b.ground(113, 136);
  b.platform(115, 12, 4);
  b.platform(120, 9, 4);
  b.platform(125, 6, 4);
  b.lumLine(116, 11, 2);
  b.lumLine(121, 8, 2);
  b.lumLine(126, 5, 2);
  b.cage(127, 3);
  b.enemy('flyer', 123, 5);
  b.checkpoint(118, 15);
  b.prop('kelp', 132, 15, 1.4);
  b.prop('coral', 134, 15, 1);

  b.water(137, 152, 15);
  b.platform(139, 12, 3);
  b.platform(144, 10, 3);
  b.platform(149, 12, 3);
  b.spring(136, 15);
  b.lumArc(137, 8, 8, 1, 3);
  b.prop('coral', 146, 10, 1.1);

  b.ground(153, 174);
  b.enemy('spitter', 160, 15);
  b.enemy('walker', 166, 15);
  b.spikes(169, 3);
  b.checkpoint(157, 15);
  b.heart(163, 14);
  b.prop('kelp', 155, 15, 1.2, true);
  b.prop('ruin', 172, 15, 1);

  b.water(175, 185, 15);
  b.platform(177, 12, 3);
  b.platform(182, 10, 3);
  b.lumArc(175, 8, 7, 1, 3);
  b.enemy('flyer', 181, 6);

  b.ground(186, 207);
  b.enemy('walker', 192, 15);
  b.lumLine(194, 14, 5);
  b.goalAt(200, 15);
  b.prop('coral', 189, 15, 1.3, true);
  b.prop('kelp', 197, 15, 1.1);
  b.prop('ruin', 204, 15, 1.1);

  return b.build();
}

/* ------------------------------------------------------------------ */
/* 4. Land of the Livid Dead (with boss)                               */
/* ------------------------------------------------------------------ */
function buildDark() {
  const b = new LevelBuilder(4, 'dark', 192);
  b.spawnAt(3, 15);

  b.ground(0, 18);
  b.sign(4, 15, 'THE LUM TIDE', 'skull');
  b.enemy('walker', 11, 15);
  b.lumLine(7, 14, 4);
  b.prop('deadTree', 5, 15, 1.1);
  b.prop('crystal', 15, 15, 0.9);

  b.lava(19, 28, 15);
  b.platform(21, 12, 3);
  b.platform(25, 10, 3);
  b.lumArc(18, 9, 7, 1, 3);
  b.prop('crystal', 24, 10, 1);

  b.ground(29, 50);
  b.spikes(33, 4);
  b.platform(31, 11, 6);
  b.enemy('flyer', 39, 8);
  b.enemy('spitter', 45, 15);
  b.checkpoint(41, 15);
  b.prop('deadTree', 36, 15, 1.2, true);
  b.prop('crystal', 48, 15, 0.8);

  b.lava(51, 62, 15);
  b.platform(53, 13, 2);
  b.platform(57, 11, 2);
  b.platform(60, 13, 2);
  b.spring(50, 15);
  b.lumArc(51, 9, 7, 1, 3);
  b.cage(58, 8);
  b.prop('crystal', 59, 13, 1.1);

  b.ground(63, 88);
  b.enemy('walker', 69, 15);
  b.enemy('walker', 75, 15);
  b.spikes(79, 3);
  b.platform(77, 12, 5);
  b.checkpoint(83, 15);
  b.cage(79, 9);
  b.heart(71, 14);
  b.prop('deadTree', 66, 15, 1.3);
  b.prop('ruin', 86, 15, 0.9);

  b.lava(89, 100, 15);
  b.platform(91, 13, 2);
  b.platform(95, 11, 2);
  b.platform(98, 13, 2);
  b.enemy('flyer', 96, 7);
  b.lumArc(89, 9, 7, 1, 3);
  b.prop('crystal', 97, 13, 1.2);

  b.ground(101, 128);
  b.platform(103, 12, 4);
  b.platform(108, 9, 4);
  b.platform(113, 6, 4);
  b.lumLine(104, 11, 2);
  b.lumLine(109, 8, 2);
  b.lumLine(114, 5, 2);
  b.cage(115, 3);
  b.enemy('spitter', 122, 15);
  b.checkpoint(106, 15);
  b.enemy('flyer', 118, 8);
  b.prop('deadTree', 125, 15, 1.4, true);

  b.lava(129, 140, 15);
  b.platform(131, 12, 3);
  b.platform(136, 10, 3);
  b.lumArc(129, 8, 7, 1, 3);
  b.prop('crystal', 138, 10, 1);

  b.ground(141, 191, 15);
  b.spikes(144, 3);
  b.enemy('walker', 148, 15);
  b.heart(146, 14);
  b.prop('deadTree', 143, 15, 1.2);
  b.prop('ruin', 151, 15, 1);

  // Boss arena
  b.bossAt(176, 10, 159, 190);
  b.triggerAt(163);
  b.checkpoint(162, 15);

  return b.build();
}

export const LEVELS = [buildJungle(), buildDesert(), buildSea(), buildDark()];

export function makeLevel(index) {
  const src = LEVELS[index];
  if (!src) return null;
  // Clone mutable state so retries start clean.
  return {
    ...src,
    lums: src.lums.map((l) => ({ ...l, taken: false })),
    cages: src.cages.map((c) => ({ ...c, freed: false })),
    hearts: src.hearts.map((h) => ({ ...h, taken: false })),
    springs: src.springs.map((s) => ({ ...s, squash: 0 })),
    enemies: src.enemies.map((e) => ({ ...e })),
    checkpoints: src.checkpoints.map((c) => ({ ...c, active: false, ring: 0 })),
  };
}
