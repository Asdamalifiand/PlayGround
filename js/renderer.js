import { TILE, THEMES } from './levels.js';
import { TAU, clamp, mulberry32, roundRect, starPath, formatTime } from './util.js';
import { drawPlayer, drawEnemy, drawBoss, drawLum, drawCage, drawHeart, drawSpring, drawCheckpoint, drawGoal, drawSign, drawProp, drawProjectile } from './art.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;
const LAYER_W = 1920;
const LAYER_H = 720;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.theme = THEMES.jungle;
    this.level = null;
    this.layers = null;
    this.camera = { x: 0, y: 0, shakeX: 0, shakeY: 0 };
    this.time = 0;
    this.flash = 0;
    this.vignette = this._buildVignette();
    this._menuLums = Array.from({ length: 7 }, (_, i) => ({ x: 0, y: 0, phase: i * 1.7, size: 1 }));
  }

  _buildVignette() {
    const c = makeCanvas(VIEW_W, VIEW_H);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(2,10,8,0.12)');
    g.addColorStop(1, 'rgba(2,8,6,0.4)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return c;
  }

  setLevel(level) {
    this.level = level;
    this.theme = THEMES[level.theme] || THEMES.jungle;
    this.layers = this._buildLayers(this.theme);
    this.camera.x = 0;
    this.camera.y = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Background generation                                               */
  /* ------------------------------------------------------------------ */
  _buildLayers(theme) {
    const rng = mulberry32(theme.key.length * 9173 + theme.key.charCodeAt(0) * 31);
    return {
      clouds: this._layer((ctx) => this._paintClouds(ctx, theme, rng)),
      far: this._layer((ctx) => this._paintFar(ctx, theme, rng)),
      mid: this._layer((ctx) => this._paintMid(ctx, theme, rng)),
      near: this._layer((ctx) => this._paintNear(ctx, theme, rng)),
      fore: this._layer((ctx) => this._paintForeground(ctx, theme, rng)),
    };
  }

  _layer(paint) {
    const c = makeCanvas(LAYER_W, LAYER_H);
    const ctx = c.getContext('2d');
    paint(ctx);
    return c;
  }

  _paintClouds(ctx, theme, rng) {
    const count = theme.key === 'dark' ? 7 : 9;
    for (let i = 0; i < count; i++) {
      const x = rng() * LAYER_W;
      const y = 60 + rng() * 230;
      const s = 0.7 + rng() * 1.5;
      const color = theme.cloud[i % theme.cloud.length];
      this._cloud(ctx, x, y, s, color, 0.42 + rng() * 0.25);
      this._cloud(ctx, x - LAYER_W, y, s, color, 0.42 + rng() * 0.25);
      this._cloud(ctx, x + LAYER_W, y, s, color, 0.42 + rng() * 0.25);
    }
  }

  _cloud(ctx, x, y, s, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const blobs = [
      [0, 0, 62, 26], [34, -12, 48, 24], [-38, -4, 44, 20], [14, 10, 62, 20], [-12, -16, 36, 22],
    ];
    for (const [bx, by, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x + bx * s, y + by * s, rx * s, ry * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _paintFar(ctx, theme, rng) {
    const W = LAYER_W, H = LAYER_H;
    const layers = [
      { base: 470, amp: 42, color: theme.far[0], alpha: 0.55, freq: 2 },
      { base: 520, amp: 58, color: theme.far[1], alpha: 0.72, freq: 3 },
      { base: 570, amp: 36, color: theme.mid[0], alpha: 0.9, freq: 5 },
    ];
    for (const l of layers) {
      const g = ctx.createLinearGradient(0, l.base - 100, 0, H);
      g.addColorStop(0, l.color);
      g.addColorStop(1, theme.near[0]);
      ctx.globalAlpha = l.alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const t = (x / W) * TAU;
        const y = l.base
          - Math.sin(t * l.freq + 0.4) * l.amp
          - Math.sin(t * (l.freq * 2.7) + 2.1) * l.amp * 0.35
          - Math.sin(t * (l.freq * 5.3) + 0.9) * l.amp * 0.14;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // haze
    const haze = ctx.createLinearGradient(0, 380, 0, 650);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(0.7, theme.fog);
    haze.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, W, H);

    if (theme.key === 'jungle') {
      // distant canopy puffs along ridge
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = theme.far[1];
      for (let i = 0; i < 34; i++) {
        const x = rng() * W;
        const y = 430 + Math.sin((x / W) * TAU * 3) * 40 + rng() * 60;
        ctx.beginPath();
        ctx.arc(x, y, 18 + rng() * 34, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (theme.key === 'desert') {
      // pyramids
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = theme.far[0];
      for (const [x, w, h] of [[300, 170, 150], [950, 240, 190], [1550, 130, 110]]) {
        ctx.beginPath();
        ctx.moveTo(x, 620);
        ctx.lineTo(x + w / 2, 620 - h);
        ctx.lineTo(x + w, 620);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,170,0.12)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, 620 - h);
        ctx.lineTo(x + w * 0.35, 620);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (theme.key === 'sea') {
      // far islands
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = theme.far[0];
      for (let i = 0; i < 5; i++) {
        const x = 120 + i * 380 + rng() * 80;
        const w = 120 + rng() * 100;
        ctx.beginPath();
        ctx.ellipse(x, 600, w, 26, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 30, 600);
        ctx.quadraticCurveTo(x, 540 - rng() * 30, x + 30, 600);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (theme.key === 'dark') {
      // jagged spires
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = theme.far[0];
      for (let i = 0; i < 12; i++) {
        const x = rng() * W;
        const w = 40 + rng() * 80;
        const h = 90 + rng() * 150;
        ctx.beginPath();
        ctx.moveTo(x - w, 640);
        ctx.lineTo(x, 640 - h);
        ctx.lineTo(x + w, 640);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  _paintMid(ctx, theme, rng) {
    const W = LAYER_W, H = LAYER_H;
    const [c0, c1] = theme.mid;
    ctx.globalAlpha = 0.9;
    if (theme.key === 'jungle') {
      for (let i = 0; i < 9; i++) {
        const x = (i / 9) * W + rng() * 100;
        const h = 260 + rng() * 150;
        this._wrap(ctx, x, (px) => {
          ctx.strokeStyle = theme.near[1];
          ctx.lineWidth = 26;
          ctx.beginPath();
          ctx.moveTo(px, 720);
          ctx.bezierCurveTo(px - 12, 620, px + 18, 560, px - 4, 720 - h);
          ctx.stroke();
          for (let j = 0; j < 5; j++) {
            const cx = px + (rng() - 0.5) * 120;
            const cy = 720 - h + (rng() - 0.5) * 90;
            const g = ctx.createRadialGradient(cx - 10, cy - 10, 4, cx, cy, 58);
            g.addColorStop(0, c1);
            g.addColorStop(1, c0);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, 42 + rng() * 26, 0, TAU);
            ctx.fill();
          }
        });
      }
    } else if (theme.key === 'desert') {
      for (let i = 0; i < 7; i++) {
        const x = rng() * W;
        this._wrap(ctx, x, (px) => {
          // rock arch
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.moveTo(px - 90, 720);
          ctx.lineTo(px - 70, 430);
          ctx.quadraticCurveTo(px, 340, px + 70, 430);
          ctx.lineTo(px + 90, 720);
          ctx.lineTo(px + 50, 720);
          ctx.lineTo(px + 44, 470);
          ctx.quadraticCurveTo(px, 410, px - 44, 470);
          ctx.lineTo(px - 50, 720);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.ellipse(px, 370, 100, 34, 0, 0, TAU);
          ctx.fill();
        });
      }
    } else if (theme.key === 'sea') {
      for (let i = 0; i < 8; i++) {
        const x = rng() * W;
        this._wrap(ctx, x, (px) => {
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.moveTo(px - 60, 720);
          ctx.quadraticCurveTo(px - 30, 500, px - 12, 430);
          ctx.quadraticCurveTo(px, 400, px + 14, 430);
          ctx.quadraticCurveTo(px + 30, 500, px + 70, 720);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.ellipse(px + 4, 410, 30, 20, 0.2, 0, TAU);
          ctx.fill();
          // hanging vines
          ctx.strokeStyle = c1;
          ctx.lineWidth = 3;
          for (let j = -2; j <= 2; j++) {
            ctx.beginPath();
            ctx.moveTo(px + j * 14, 460);
            ctx.quadraticCurveTo(px + j * 20, 520, px + j * 12, 580);
            ctx.stroke();
          }
        });
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const x = rng() * W;
        this._wrap(ctx, x, (px) => {
          // ruined tower
          const w = 60 + rng() * 50;
          const h = 220 + rng() * 160;
          ctx.fillStyle = c0;
          ctx.beginPath();
          ctx.moveTo(px - w / 2, 720);
          ctx.lineTo(px - w / 2, 720 - h);
          ctx.lineTo(px - w / 4, 720 - h - 40);
          ctx.lineTo(px + w / 2, 720 - h + 10);
          ctx.lineTo(px + w / 2, 720);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = c1;
          ctx.beginPath();
          ctx.moveTo(px - w / 2, 720 - h);
          ctx.lineTo(px - w / 4, 720 - h - 40);
          ctx.lineTo(px + w / 2, 720 - h + 10);
          ctx.lineTo(px + w / 2, 720 - h + 26);
          ctx.lineTo(px - w / 2, 720 - h + 18);
          ctx.closePath();
          ctx.fill();
          // windows
          ctx.fillStyle = 'rgba(255,120,170,0.5)';
          for (let j = 0; j < 4; j++) {
            ctx.beginPath();
            ctx.ellipse(px + (rng() - 0.5) * w * 0.4, 720 - h + 60 + j * 44, 5, 10, 0, 0, TAU);
            ctx.fill();
          }
        });
      }
    }
    ctx.globalAlpha = 1;
    // ground haze
    const g = ctx.createLinearGradient(0, 560, 0, 720);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(3,10,8,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  _paintNear(ctx, theme, rng) {
    const W = LAYER_W;
    const base = 640;
    const g = ctx.createLinearGradient(0, base - 80, 0, 720);
    g.addColorStop(0, theme.near[0]);
    g.addColorStop(1, theme.near[1]);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(0, 720);
    for (let x = 0; x <= W; x += 10) {
      const t = (x / W) * TAU;
      const y = base - Math.sin(t * 4 + 0.6) * 34 - Math.sin(t * 9 + 1.4) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, 720);
    ctx.closePath();
    ctx.fill();
    // silhouette shrubs / rocks
    for (let i = 0; i < 16; i++) {
      const x = rng() * W;
      this._wrap(ctx, x, (px) => {
        const r = 22 + rng() * 42;
        ctx.fillStyle = theme.near[1];
        ctx.beginPath();
        ctx.ellipse(px, base + 10 - rng() * 20, r, r * 0.5, 0, 0, TAU);
        ctx.fill();
      });
    }
    ctx.globalAlpha = 1;
  }

  _paintForeground(ctx, theme, rng) {
    const W = LAYER_W;
    ctx.globalAlpha = 0.9;
    const color = theme.near[0];
    // top corner leaves
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? 0 : W;
      const dir = side === 0 ? 1 : -1;
      for (let i = 0; i < 6; i++) {
        const lx = x + dir * (30 + i * 52 + rng() * 20);
        const ly = -10 + i * 14 + rng() * 18;
        const rot = dir * (0.5 + i * 0.18);
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(rot);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 70, 22, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-60, 0);
        ctx.lineTo(60, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    // side fronds (kept at the very edges so they frame the action)
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -30 : W + 30;
      const dir = side === 0 ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const ly = 560 + i * 60 + rng() * 20;
        ctx.save();
        ctx.translate(x + dir * (20 + i * 18), ly);
        ctx.rotate(dir * (0.3 + i * 0.25));
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 80, 24, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  _wrap(ctx, x, draw) {
    draw(x);
    if (x < 200) draw(x + LAYER_W);
    if (x > LAYER_W - 200) draw(x - LAYER_W);
  }

  /* ------------------------------------------------------------------ */
  /* Scene                                                               */
  /* ------------------------------------------------------------------ */
  draw(world, time) {
    const ctx = this.ctx;
    this.time = time;
    const cam = world ? world.camera : this.camera;
    this.camera = cam;
    ctx.save();
    this._drawSky(ctx);
    this._drawLayer(ctx, this.layers.clouds, 0.05, 0.03);
    this._drawLayer(ctx, this.layers.far, 0.14, 0.07);
    this._drawLayer(ctx, this.layers.mid, 0.32, 0.12);
    this._drawLayer(ctx, this.layers.near, 0.55, 0.2);
    ctx.restore();

    if (world) {
      ctx.save();
      const sx = cam.shakeX || 0, sy = cam.shakeY || 0;
      ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
      this._drawWater(ctx, world, time);
      this._drawProps(ctx, world, time);
      this._drawTerrain(ctx, world, time);
      this._drawHazards(ctx, world, time);
      this._drawSigns(ctx, world, time);
      this._drawCheckpoints(ctx, world, time);
      this._drawSprings(ctx, world, time);
      this._drawPickups(ctx, world, time);
      this._drawEnemies(ctx, world, time);
      if (world.boss && !world.boss.defeated) drawBoss(ctx, world.boss, time);
      this._drawShockwaves(ctx, world, time);
      this._drawProjectiles(ctx, world, time);
      this._drawParticles(ctx, world, time);
      if (world.player) drawPlayer(ctx, world.player, time);
      if (world.goal) drawGoal(ctx, world.goal, time);
      this._drawFloatingTexts(ctx, world, time);
      ctx.restore();
      ctx.save();
      this._drawLayer(ctx, this.layers.fore, 1.18, 0.35);
      ctx.restore();
      this._drawAmbient(ctx, world, time);
      this._drawHUD(ctx, world, time);
      if (world.flash > 0) {
        ctx.fillStyle = `rgba(255, 250, 230, ${clamp(world.flash, 0, 1)})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      if (world.fade > 0) {
        ctx.fillStyle = `rgba(2, 7, 6, ${clamp(world.fade, 0, 1)})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
    }
    ctx.drawImage(this.vignette, 0, 0);
  }

  _drawSky(ctx) {
    const t = this.theme;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, t.skyTop);
    g.addColorStop(0.52, t.skyMid);
    g.addColorStop(1, t.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // stars for dark theme
    if (t.key === 'dark') {
      ctx.save();
      const rng = mulberry32(99);
      for (let i = 0; i < 90; i++) {
        const x = rng() * VIEW_W;
        const y = rng() * 340;
        const a = 0.25 + rng() * 0.65;
        ctx.globalAlpha = a * (0.6 + Math.sin(this.time * 2 + i) * 0.4);
        ctx.fillStyle = '#fff4e0';
        ctx.beginPath();
        ctx.arc(x, y, rng() * 1.4 + 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // sun / moon
    const sun = t.sun;
    const sx = sun.x * VIEW_W - this.camera.x * 0.02;
    const sy = sun.y * VIEW_H - this.camera.y * 0.02;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(sx, sy, sun.r * 0.2, sx, sy, sun.r * 3.4);
    glow.addColorStop(0, sun.glow);
    glow.addColorStop(0.4, sun.glow.replace(/[\d.]+\)$/, '0.12)'));
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, sun.r * 3.4, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    const disc = ctx.createRadialGradient(sx - sun.r * 0.25, sy - sun.r * 0.25, 4, sx, sy, sun.r);
    disc.addColorStop(0, '#fffdf0');
    disc.addColorStop(0.55, sun.color);
    disc.addColorStop(1, t.key === 'dark' ? '#ffb1c8' : '#ffd88a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, sun.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  _drawLayer(ctx, layer, factor, yFactor = 0.05) {
    if (!layer) return;
    const offset = -(((this.camera.x || 0) * factor) % LAYER_W);
    const y = -((this.camera.y || 0) * yFactor);
    ctx.drawImage(layer, offset, y);
    ctx.drawImage(layer, offset + LAYER_W, y);
    if (offset > -0.5) ctx.drawImage(layer, offset - LAYER_W, y);
  }

  /* ------------------------------------------------------------------ */
  /* World rendering                                                     */
  /* ------------------------------------------------------------------ */
  _drawWater(ctx, world, time) {
    const bodies = world.level.waterBodies || [];
    for (const body of bodies) {
      const x = body.x0 * TILE;
      const w = (body.x1 - body.x0 + 1) * TILE;
      const top = body.topRow * TILE;
      const bottom = world.level.worldHeight + 40;
      const isLava = body.type === 'lava';
      const deep = isLava ? '#4a0d10' : '#053c4c';
      const mid = isLava ? '#b62d12' : '#0b6c7c';
      const bright = isLava ? '#ff8a2e' : '#35c9cf';
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top - 4, w, bottom - top + 4);
      ctx.clip();
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, bright);
      g.addColorStop(0.18, mid);
      g.addColorStop(1, deep);
      ctx.fillStyle = g;
      ctx.fillRect(x, top - 4, w, bottom - top + 4);

      // animated surface
      const surfaceY = top + Math.sin(time * 2.2 + x * 0.01) * 3;
      ctx.beginPath();
      ctx.moveTo(x, surfaceY + 6);
      for (let px = 0; px <= w; px += 12) {
        const wy = surfaceY + Math.sin(time * 2.4 + (x + px) * 0.022) * 4 + Math.sin(time * 1.1 + (x + px) * 0.008) * 3;
        ctx.lineTo(x + px, wy);
      }
      ctx.lineTo(x + w, bottom);
      ctx.lineTo(x, bottom);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, surfaceY - 8, 0, surfaceY + 46);
      sg.addColorStop(0, isLava ? 'rgba(255, 220, 120, 0.9)' : 'rgba(190, 255, 250, 0.8)');
      sg.addColorStop(0.25, isLava ? 'rgba(255, 120, 40, 0.65)' : 'rgba(70, 220, 215, 0.55)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.fill();
      // foam line
      ctx.strokeStyle = isLava ? 'rgba(255,220,150,0.9)' : 'rgba(210,255,250,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let px = 0; px <= w; px += 12) {
        const wy = surfaceY + Math.sin(time * 2.4 + (x + px) * 0.022) * 4 + Math.sin(time * 1.1 + (x + px) * 0.008) * 3;
        if (px === 0) ctx.moveTo(x + px, wy); else ctx.lineTo(x + px, wy);
      }
      ctx.stroke();
      // highlights / bubbles
      const rng = mulberry32(body.x0 * 31 + body.topRow);
      for (let i = 0; i < 14; i++) {
        const bx = x + rng() * w;
        const by = top + 12 + ((time * (isLava ? 40 : 24) + i * 53) % (bottom - top - 20));
        ctx.globalAlpha = 0.18 + (i % 4) * 0.08;
        ctx.fillStyle = isLava ? '#ffcf7a' : '#d6fffa';
        ctx.beginPath();
        ctx.ellipse(bx, by, 3 + (i % 3) * 2, 1.6 + (i % 2), 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (isLava) {
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, top, 0, top + 140);
        lg.addColorStop(0, 'rgba(255,110,40,0.3)');
        lg.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(x, top - 60, w, 200);
      }
      ctx.restore();
    }
  }

  _drawProps(ctx, world, time) {
    for (const prop of world.level.props) {
      if (!this._visible(prop.x, prop.y, 320, 360)) continue;
      drawProp(ctx, prop, this.theme, time);
    }
  }

  _drawTerrain(ctx, world, time) {
    const level = world.level;
    const cam = world.camera;
    const T = TILE;
    const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
    const x1 = Math.min(level.width - 1, Math.ceil((cam.x + VIEW_W) / T) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
    const y1 = Math.min(level.rows - 1, Math.ceil((cam.y + VIEW_H) / T) + 1);
    const t = this.theme;

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this._solid(level, tx, ty)) continue;
        const x = tx * T, y = ty * T;
        const hash = (tx * 73856093 ^ ty * 19349663) >>> 0;
        const shade = (hash % 3);
        const above = this._solid(level, tx, ty - 1);
        const left = this._solid(level, tx - 1, ty);
        const right = this._solid(level, tx + 1, ty);
        const below = this._solid(level, tx, ty + 1);

        // dirt body
        ctx.fillStyle = t.dirt[shade];
        ctx.fillRect(x - 0.5, y - 0.5, T + 1, T + 1);
        // low-frequency strata: broad soft bands instead of a per-tile checker
        const strata = ((Math.floor(tx / 4) * 37 + Math.floor(ty / 2) * 71) % 7);
        if (strata < 2) {
          ctx.fillStyle = 'rgba(0,0,0,0.055)';
          ctx.fillRect(x, y + 6 + strata * 10, T, 18);
        } else if (strata === 2) {
          ctx.fillStyle = 'rgba(255,255,255,0.035)';
          ctx.fillRect(x, y + 10, T, 14);
        }
        // soft clumps to break up the grid
        if (hash % 7 === 0) {
          const cx = x + 10 + (hash % 26);
          const cy = y + 14 + (hash % 24);
          const cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
          cg.addColorStop(0, 'rgba(0,0,0,0.10)');
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.arc(cx, cy, 15, 0, TAU);
          ctx.fill();
        }
        // pebbles
        if (hash % 11 === 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.beginPath();
          ctx.ellipse(x + 12 + (hash % 20), y + 18 + (hash % 16), 5, 3, 0.4, 0, TAU);
          ctx.fill();
        }
        if (hash % 17 === 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.09)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + 8, y + 20);
          ctx.quadraticCurveTo(x + 20, y + 34, x + 16, y + 46);
          ctx.stroke();
        }

        // grass top
        if (!above) {
          const g = ctx.createLinearGradient(0, y - 3, 0, y + 16);
          g.addColorStop(0, t.grass[0]);
          g.addColorStop(0.55, t.grass[1]);
          g.addColorStop(1, t.grass[2]);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x - 1, y + 14);
          ctx.lineTo(x - 1, y + 3);
          ctx.quadraticCurveTo(x + T * 0.5, y - 5, x + T + 1, y + 3);
          ctx.lineTo(x + T + 1, y + 14);
          ctx.closePath();
          ctx.fill();
          // bright lip
          ctx.fillStyle = 'rgba(255,255,255,0.28)';
          ctx.beginPath();
          ctx.ellipse(x + T / 2, y + 3, T * 0.42, 3, 0, 0, TAU);
          ctx.fill();
          // blades
          ctx.strokeStyle = t.grass[0];
          ctx.lineWidth = 2;
          const rng = mulberry32(hash);
          const blades = 2 + (hash % 3);
          for (let i = 0; i < blades; i++) {
            const bx = x + 8 + rng() * (T - 16);
            const bh = 5 + rng() * 10;
            ctx.beginPath();
            ctx.moveTo(bx, y + 2);
            ctx.quadraticCurveTo(bx + 2, y - bh * 0.6, bx + (rng() - 0.5) * 7, y - bh);
            ctx.stroke();
          }
          // flowers / pebbles on top
          if (hash % 9 === 0) {
            const fx = x + 12 + (hash % 22);
            const fc = t.flower[hash % t.flower.length];
            ctx.fillStyle = fc;
            for (let k = 0; k < 5; k++) {
              const a = (k / 5) * TAU;
              ctx.beginPath();
              ctx.ellipse(fx + Math.cos(a) * 4, y - 2 + Math.sin(a) * 4, 2.6, 1.7, a, 0, TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#ffe7a3';
            ctx.beginPath(); ctx.arc(fx, y - 2, 1.8, 0, TAU); ctx.fill();
          }
        }

        // exposed side shading
        if (!left) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x, y + 12, 5, T - 12);
        }
        if (!right) {
          ctx.fillStyle = 'rgba(0,0,0,0.22)';
          ctx.fillRect(x + T - 5, y + 12, 5, T - 12);
        }
        if (!below) {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.ellipse(x + T / 2, y + T, T * 0.48, 6, 0, 0, Math.PI);
          ctx.fill();
          // hanging roots
          if (hash % 5 === 0) {
            ctx.strokeStyle = t.dirt[2];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + T / 2, y + T);
            ctx.quadraticCurveTo(x + T / 2 + 4, y + T + 10, x + T / 2 + 1, y + T + 18 + (hash % 8));
            ctx.stroke();
          }
        }
        // vines from grass edges
        if (!above && (!left || !right) && hash % 4 === 0) {
          const vx = !left ? x + 4 : x + T - 4;
          ctx.strokeStyle = t.grass[2];
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(vx, y + 8);
          ctx.bezierCurveTo(vx - 6, y + 24, vx + 7, y + 40, vx - 2, y + 58 + (hash % 20));
          ctx.stroke();
          ctx.fillStyle = t.grass[1];
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(vx + (i % 2 ? 4 : -4), y + 22 + i * 12, 5, 2.4, i % 2 ? 0.5 : -0.5, 0, TAU);
            ctx.fill();
          }
        }
      }
    }
  }

  _drawHazards(ctx, world, time) {
    const level = world.level;
    const cam = world.camera;
    const x0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const x1 = Math.min(level.width - 1, Math.ceil((cam.x + VIEW_W) / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const y1 = Math.min(level.rows - 1, Math.ceil((cam.y + VIEW_H) / TILE) + 1);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const h = level.hazards[ty * level.width + tx];
        if (h !== 2) continue;
        const x = tx * TILE, y = ty * TILE;
        // spikes
        ctx.save();
        const base = y + TILE;
        const spikes = 3;
        for (let i = 0; i < spikes; i++) {
          const sx = x + (i + 0.5) * (TILE / spikes);
          const sw = TILE / spikes * 0.38;
          const g = ctx.createLinearGradient(sx, base, sx, base - 34);
          g.addColorStop(0, '#5b5f6e');
          g.addColorStop(0.6, '#c3ccda');
          g.addColorStop(1, '#fff6dd');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(sx - sw, base);
          ctx.lineTo(sx, base - 34);
          ctx.lineTo(sx + sw, base);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = 'rgba(30,20,30,0.55)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x, base - 4, TILE, 4);
        ctx.restore();
      }
    }
  }

  _drawSigns(ctx, world, time) {
    for (const s of world.level.signs) {
      if (!this._visible(s.x, s.y, 160, 200)) continue;
      drawSign(ctx, s);
    }
  }

  _drawCheckpoints(ctx, world, time) {
    for (const c of world.level.checkpoints) {
      if (!this._visible(c.x, c.y, 160, 220)) continue;
      drawCheckpoint(ctx, c, this.theme, time);
    }
  }

  _drawSprings(ctx, world, time) {
    for (const s of world.level.springs) {
      if (!this._visible(s.x, s.y, 120, 140)) continue;
      drawSpring(ctx, s, this.theme, time);
    }
  }

  _drawPickups(ctx, world, time) {
    for (const l of world.level.lums) {
      if (l.taken) continue;
      if (!this._visible(l.x, l.y, 60, 60)) continue;
      drawLum(ctx, l, time);
    }
    for (const h of world.level.hearts) {
      if (h.taken) continue;
      if (!this._visible(h.x, h.y, 70, 70)) continue;
      drawHeart(ctx, h, time);
    }
    for (const c of world.level.cages) {
      if (c.freed) continue;
      if (!this._visible(c.x, c.y, 120, 140)) continue;
      drawCage(ctx, c, time);
    }
  }

  _drawEnemies(ctx, world, time) {
    for (const e of world.enemies) {
      if (!e.alive && e.deathTimer <= 0) continue;
      if (!this._visible(e.x, e.y, 140, 160)) continue;
      drawEnemy(ctx, e, time);
    }
  }

  _drawShockwaves(ctx, world, time) {
    for (const s of world.shockwaves) {
      const a = clamp(s.life / 1.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = 'rgba(255, 140, 190, 0.85)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 22, 9, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 220, 160, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, 34, 13, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawProjectiles(ctx, world, time) {
    for (const p of world.projectiles) {
      if (!this._visible(p.x, p.y, 60, 60)) continue;
      drawProjectile(ctx, p, time);
    }
  }

  _drawParticles(ctx, world, time) {
    for (const p of world.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * (p.alpha ?? 1);
      ctx.translate(p.x, p.y);
      if (p.rot) ctx.rotate(p.rot);
      if (p.shape === 'circle') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.4 + a * 0.8), 0, TAU);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.fillStyle = p.color;
        starPath(ctx, 0, 0, 4, p.size * (0.5 + a), p.size * 0.32, p.rot || 0);
        ctx.fill();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.4 - a), 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  _drawFloatingTexts(ctx, world, time) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 15px "Trebuchet MS", sans-serif';
    for (const f of world.floaters) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = f.color || '#fff3c4';
      ctx.strokeStyle = 'rgba(20,8,4,0.75)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  _drawAmbient(ctx, world, time) {
    const t = this.theme;
    const cam = world.camera;
    const type = t.ambient;
    ctx.save();
    for (let i = 0; i < 34; i++) {
      const seed = i * 97.13;
      let x = (seed * 7.3 + time * (type === 'sand' ? 26 : 8) + cam.x * 0.05) % (VIEW_W + 120) - 60;
      let y;
      if (type === 'bubbles') {
        y = VIEW_H - ((time * 22 + seed * 5.7) % (VIEW_H + 100));
        x += Math.sin(time * 1.4 + i) * 18;
      } else if (type === 'embers') {
        y = VIEW_H - ((time * 26 + seed * 4.1) % (VIEW_H + 100));
        x += Math.sin(time * 2 + i * 1.3) * 22;
      } else if (type === 'sand') {
        y = 80 + ((seed * 13.7 + Math.sin(time + i) * 30) % (VIEW_H - 100));
      } else {
        y = 70 + ((seed * 11.3 - time * 10) % (VIEW_H - 80) + (VIEW_H - 80)) % (VIEW_H - 80);
        x += Math.sin(time * 1.1 + i) * 14;
      }
      const size = type === 'embers' ? 1.6 + (i % 3) * 0.8 : type === 'bubbles' ? 2 + (i % 3) : 1.2 + (i % 3) * 0.6;
      const alpha = 0.25 + (i % 5) * 0.08;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = type === 'embers' ? 'rgba(255,140,80,0.9)' : t.ambientColor;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
      if (type === 'pollen' || type === 'bubbles') {
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */
  _drawHUD(ctx, world, time) {
    const p = world.player;
    ctx.save();
    // top-left panel
    const panelX = 20, panelY = 18;
    ctx.fillStyle = 'rgba(5, 17, 14, 0.45)';
    ctx.strokeStyle = 'rgba(255, 232, 176, 0.18)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, panelX, panelY, 188, 74, 16);
    ctx.fill();
    ctx.stroke();

    // hearts
    for (let i = 0; i < 3; i++) {
      const hx = panelX + 24 + i * 30;
      const hy = panelY + 25;
      const filled = i < p.hearts;
      this._heartIcon(ctx, hx, hy, 11, filled, time, i);
    }
    // lums
    ctx.save();
    ctx.translate(panelX + 22, panelY + 54);
    const lg = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
    lg.addColorStop(0, '#fffbe0');
    lg.addColorStop(0.6, '#ffd45f');
    lg.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd45f';
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff6d8';
    ctx.font = '800 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${world.stats.lums}`, panelX + 38, panelY + 54);
    ctx.fillStyle = 'rgba(255,246,216,0.55)';
    ctx.font = '700 10px "Trebuchet MS", sans-serif';
    ctx.fillText(`/ ${world.level.totalLums}`, panelX + 38 + ctx.measureText(`${world.stats.lums}`).width + 14, panelY + 55);

    // cages
    ctx.save();
    ctx.translate(panelX + 126, panelY + 54);
    ctx.strokeStyle = '#c2ccda';
    ctx.lineWidth = 1.8;
    roundRect(ctx, -7, -8, 14, 16, 3);
    ctx.stroke();
    for (let i = -3; i <= 3; i += 3) {
      ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#fff6d8';
    ctx.font = '800 14px "Trebuchet MS", sans-serif';
    ctx.fillText(`${world.stats.cages} / ${world.level.totalCages}`, panelX + 142, panelY + 54);

    // level label top-center
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5, 17, 14, 0.4)';
    roundRect(ctx, VIEW_W / 2 - 150, 16, 300, 46, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,232,176,0.14)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,246,216,0.55)';
    ctx.font = '800 9px "Trebuchet MS", sans-serif';
    ctx.fillText('WORLD ' + world.level.id, VIEW_W / 2, 31);
    ctx.fillStyle = '#fff3c4';
    ctx.font = '800 15px "Trebuchet MS", sans-serif';
    ctx.fillText(this.theme.name.toUpperCase(), VIEW_W / 2, 49);
    ctx.fillStyle = 'rgba(255,246,216,0.5)';
    ctx.font = '700 9px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(world.timer), VIEW_W / 2 + 132, 31);

    // boss bar
    if (world.boss && world.boss.active && !world.boss.defeated) {
      const bw = 360;
      const bx = VIEW_W / 2 - bw / 2;
      const by = 76;
      ctx.fillStyle = 'rgba(5, 10, 14, 0.65)';
      roundRect(ctx, bx, by, bw, 18, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 140, 190, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const ratio = clamp(world.boss.hp / world.boss.maxHp, 0, 1);
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      g.addColorStop(0, '#ff6b9d');
      g.addColorStop(1, '#b95cff');
      ctx.fillStyle = g;
      roundRect(ctx, bx + 3, by + 3, (bw - 6) * ratio, 12, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,246,0.9)';
      ctx.font = '800 9px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE LIVID KING', VIEW_W / 2, by + 31);
    }

    // low-heart vignette
    if (p.hearts === 1 && !p.dead) {
      const a = 0.12 + Math.sin(time * 4) * 0.05;
      const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.32, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
      vg.addColorStop(0, 'rgba(255,0,50,0)');
      vg.addColorStop(1, `rgba(255,20,60,${a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  }

  _heartIcon(ctx, x, y, r, filled, time, i) {
    ctx.save();
    ctx.translate(x, y);
    const beat = filled ? 1 + Math.sin(time * 4 + i) * 0.04 : 1;
    ctx.scale(beat, beat);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 1.1, -r * 1.4, -r * 0.18, -r * 1.1);
    ctx.bezierCurveTo(r * 0.3, -r * 1.0, 0, -r * 0.6, 0, -r * 0.6);
    ctx.bezierCurveTo(0, -r * 0.6, -r * 0.3, -r * 1.0, r * 0.18, -r * 1.1);
    ctx.bezierCurveTo(r * 1.1, -r * 1.4, r * 1.5, -r * 0.2, 0, r * 0.9);
    ctx.closePath();
    if (filled) {
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#ff9ab2');
      g.addColorStop(0.5, '#ff5c86');
      g.addColorStop(1, '#c92a58');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,10,30,0.8)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, -r * 0.45, r * 0.22, r * 0.14, -0.5, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,232,176,0.3)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ */
  /* Menu backdrop                                                       */
  /* ------------------------------------------------------------------ */
  drawMenu(time, themeKey = 'jungle') {
    if (!this.layers || this.theme.key !== themeKey) {
      this.theme = THEMES[themeKey] || THEMES.jungle;
      this.layers = this._buildLayers(this.theme);
    }
    this.time = time;
    const ctx = this.ctx;
    this.camera.x = 340 + Math.sin(time * 0.045) * 120;
    this.camera.y = 60;
    ctx.save();
    this._drawSky(ctx);
    this._drawLayer(ctx, this.layers.clouds, 0.05, 0.03);
    this._drawLayer(ctx, this.layers.far, 0.14, 0.07);
    this._drawLayer(ctx, this.layers.mid, 0.32, 0.12);
    this._drawLayer(ctx, this.layers.near, 0.55, 0.2);
    ctx.restore();

    // hill foreground
    ctx.save();
    const hillY = 620;
    const g = ctx.createLinearGradient(0, hillY, 0, VIEW_H);
    g.addColorStop(0, '#144d3e');
    g.addColorStop(1, '#08251f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H);
    ctx.lineTo(0, hillY + 40);
    ctx.bezierCurveTo(280, hillY - 80, 520, hillY + 20, 760, hillY - 20);
    ctx.bezierCurveTo(980, hillY - 55, 1150, hillY + 30, VIEW_W, hillY + 10);
    ctx.lineTo(VIEW_W, VIEW_H);
    ctx.closePath();
    ctx.fill();
    // grass lip
    ctx.strokeStyle = '#3d9d63';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, hillY + 40);
    ctx.bezierCurveTo(280, hillY - 80, 520, hillY + 20, 760, hillY - 20);
    ctx.bezierCurveTo(980, hillY - 55, 1150, hillY + 30, VIEW_W, hillY + 10);
    ctx.stroke();
    ctx.restore();

    // floating lums
    for (let i = 0; i < this._menuLums.length; i++) {
      const l = this._menuLums[i];
      const baseX = 700 + (i - 3) * 78;
      const x = baseX + Math.sin(time * 0.7 + i * 1.7) * 24;
      const y = 300 + Math.sin(time * 1.1 + i * 1.3) * 26 + (i % 3) * 36;
      drawLum(ctx, { x, y }, time);
    }

    // hero mascot
    const dummy = {
      x: 196, y: hillY - 6, w: 28, h: 54, vx: 0, vy: 0, grounded: true, facing: 1,
      gliding: false, punchTimer: 0, invuln: 0, dead: false, squash: 0,
      animTime: time, blinkOffset: 1.3, hearts: 3,
    };
    ctx.save();
    ctx.translate(196, hillY - 2);
    ctx.scale(1.7, 1.7);
    drawPlayer(ctx, { ...dummy, x: 0, y: -27 }, time);
    ctx.restore();

    // foreground leaves
    ctx.save();
    this.camera.x = 340 + Math.sin(time * 0.045) * 120;
    this._drawLayer(ctx, this.layers.fore, 1.18, 0.35);
    ctx.restore();

    // warm light overlay
    const warm = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
    warm.addColorStop(0, 'rgba(255,200,100,0.05)');
    warm.addColorStop(0.5, 'rgba(0,0,0,0)');
    warm.addColorStop(1, 'rgba(10,40,80,0.12)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.drawImage(this.vignette, 0, 0);
  }

  _visible(x, y, padX = 0, padY = 0) {
    const c = this.camera;
    return x + padX > c.x && x - padX < c.x + VIEW_W && y + padY > c.y && y - padY < c.y + VIEW_H;
  }

  _solid(level, tx, ty) {
    if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.rows) return false;
    return level.grid[ty * level.width + tx] === 1;
  }
}
