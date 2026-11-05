import { TILE, ROWS, makeLevel } from './levels.js';
import { clamp, approach, sign, dist2, rectsOverlap, TAU } from './util.js';
import { VIEW_W, VIEW_H } from './renderer.js';

const GRAVITY = 2150;
const RUN_SPEED = 340;
const JUMP_V = 700;
const AIR_JUMP_V = 620;
const MAX_FALL = 1050;

export class Player {
  constructor(spawn) {
    this.w = 28;
    this.h = 52;
    this.reset(spawn);
    this.hearts = 3;
    this.blinkOffset = Math.random() * 3;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y - this.h / 2;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumps = 0;
    this.gliding = false;
    this.glideSound = false;
    this.jumpCut = false;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.squash = 0;
    this.animTime = 0;
    this.dead = false;
    this.deathTimer = 0;
    this.deathSpin = 0;
    this.deathFade = 1;
    this.wasGrounded = false;
    this.stepTimer = 0;
    this.dustTimer = 0;
    this.landTimer = 0;
  }

  get box() {
    return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
  }

  attackBox() {
    if (this.punchTimer <= 0) return null;
    const reach = 56;
    return {
      x: this.facing > 0 ? this.x : this.x - reach,
      y: this.y - 30,
      w: reach,
      h: 60,
    };
  }

  update(dt, input, world) {
    const level = world.level;
    this.animTime += dt;
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.squash = approach(this.squash, 0, dt * 3.2);

    if (this.dead) {
      this.deathTimer += dt;
      this.vy += GRAVITY * 0.55 * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      this.deathSpin += dt * 5;
      if (this.deathTimer > 0.55) this.deathFade = Math.max(0, this.deathFade - dt * 1.5);
      return;
    }

    this.wasGrounded = this.grounded;
    const wasOnGround = this.grounded;
    this.grounded = false;

    // Horizontal movement
    const axis = Math.abs(input.axis) > 0.12 ? input.axis : 0;
    const targetSpeed = axis * RUN_SPEED;
    const accel = wasOnGround ? 2800 : 1900;
    if (axis !== 0) {
      this.vx = approach(this.vx, targetSpeed, accel * dt);
      this.facing = sign(axis) || this.facing;
    } else {
      this.vx = approach(this.vx, 0, (wasOnGround ? 3400 : 900) * dt);
    }

    // Jump input buffering
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    if (input.wasPressed('jump')) this.jumpBuffer = 0.14;

    if (this.jumpBuffer > 0) {
      if (wasOnGround || this.coyote > 0) {
        this.vy = -JUMP_V;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumps = 1;
        this.jumpCut = false;
        this.squash = -0.22;
        world.audio.sfx('jump');
        world.dust(this.x, this.y + this.h / 2, 6, this.facing);
      } else if (this.jumps < 2) {
        this.vy = -AIR_JUMP_V;
        this.jumps = 2;
        this.jumpBuffer = 0;
        this.jumpCut = false;
        this.squash = -0.18;
        world.audio.sfx('doubleJump');
        world.burst(this.x, this.y + 8, 8, ['#fff6c4', '#ffd45f', '#ffffff'], 130, 4, 0.4);
      }
    }

    // Variable jump height
    if (!input.isDown('jump') && this.vy < -240 && !this.jumpCut) {
      this.vy *= 0.58;
      this.jumpCut = true;
    }

    // Glide (helicopter hair)
    const canGlide = !this.grounded && this.vy > 40 && input.isDown('jump') && this.jumps > 0;
    this.gliding = canGlide;
    if (canGlide) {
      this.vy = Math.min(this.vy, 145);
      if (!this.glideSound) {
        this.glideSound = true;
        world.audio.sfx('glide');
      }
    } else {
      this.glideSound = false;
    }

    // Punch
    if (input.wasPressed('punch') && this.punchCooldown <= 0) {
      this.punchTimer = 0.2;
      this.punchCooldown = 0.34;
      world.audio.sfx('punch');
    }

    // Gravity
    if (!this.gliding) this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);
    else this.vy = Math.min(this.vy + GRAVITY * 0.35 * dt, 150);

    // Move and collide
    const fallSpeed = this.vy;
    this.x += this.vx * dt;
    this.collideX(level);
    this.y += this.vy * dt;
    this.collideY(level);

    if (this.grounded) {
      this.coyote = 0.1;
      this.jumps = 0;
      this.jumpCut = false;
      if (!this.wasGrounded) {
        const impact = Math.min(1, Math.abs(fallSpeed) / 700 + 0.15);
        if (fallSpeed > 280) {
          this.squash = 0.22 * impact;
          world.audio.sfx('land');
          world.dust(this.x, this.y + this.h / 2, 8, 0);
          world.camera.shake = Math.max(world.camera.shake, 2.5 * impact);
        }
        this.vy = 0;
      }
    }

    // Running dust
    if (this.grounded && Math.abs(this.vx) > 180) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.1;
        world.dust(this.x - this.facing * 10, this.y + this.h / 2, 1, -this.facing);
      }
    }

    // Hazards
    this.checkHazards(level, world);

    // Fell out of the world
    if (this.y - this.h / 2 > level.worldHeight + 60) {
      world.killPlayer('fall');
    }
  }

  collideX(level) {
    const halfW = this.w / 2;
    const halfH = this.h / 2;
    const yTop = this.y - halfH + 5;
    const yBottom = this.y + halfH - 5;
    const samples = [yTop, (yTop + yBottom) / 2, yBottom];
    if (this.vx > 0) {
      const tx = Math.floor((this.x + halfW) / TILE);
      for (const sy of samples) {
        const ty = Math.floor(sy / TILE);
        if (solid(level, tx, ty)) {
          this.x = tx * TILE - halfW - 0.01;
          this.vx = 0;
          break;
        }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor((this.x - halfW) / TILE);
      for (const sy of samples) {
        const ty = Math.floor(sy / TILE);
        if (solid(level, tx, ty)) {
          this.x = (tx + 1) * TILE + halfW + 0.01;
          this.vx = 0;
          break;
        }
      }
    }
  }

  collideY(level) {
    const halfW = this.w / 2;
    const halfH = this.h / 2;
    const xLeft = this.x - halfW + 4;
    const xRight = this.x + halfW - 4;
    const samples = [xLeft, this.x, xRight];
    if (this.vy >= 0) {
      const ty = Math.floor((this.y + halfH) / TILE);
      for (const sx of samples) {
        const tx = Math.floor(sx / TILE);
        if (solid(level, tx, ty)) {
          this.y = ty * TILE - halfH - 0.01;
          this.vy = 0;
          this.grounded = true;
          break;
        }
      }
    } else {
      const ty = Math.floor((this.y - halfH) / TILE);
      for (const sx of samples) {
        const tx = Math.floor(sx / TILE);
        if (solid(level, tx, ty)) {
          this.y = (ty + 1) * TILE + halfH + 0.01;
          this.vy = 0;
          break;
        }
      }
    }
  }

  checkHazards(level, world) {
    const box = this.box;
    const x0 = Math.floor((box.x + 5) / TILE);
    const x1 = Math.floor((box.x + box.w - 5) / TILE);
    const y0 = Math.floor((box.y + 5) / TILE);
    const y1 = Math.floor((box.y + box.h - 3) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.rows) continue;
        const h = level.hazards[ty * level.width + tx];
        if (!h) continue;
        if (h === 2) {
          const spike = { x: tx * TILE + 2, y: ty * TILE + 14, w: TILE - 4, h: TILE - 14 };
          if (rectsOverlap(box, spike)) this.hurt(tx * TILE + TILE / 2, world, true);
        } else if (h === 3 || h === 4) {
          world.killPlayer(h === 3 ? 'water' : 'lava');
          return;
        }
      }
    }
  }

  hurt(sourceX, world, fromSpike = false) {
    if (this.invuln > 0 || this.dead) return;
    this.hearts -= 1;
    this.invuln = 1.5;
    this.hurtFlash = 0.35;
    this.squash = 0.25;
    const dir = this.x < sourceX ? -1 : 1;
    this.vx = dir * (fromSpike ? 240 : 300);
    this.vy = fromSpike ? -360 : -300;
    world.audio.sfx('hurt');
    world.camera.shake = 12;
    world.hitstop = 0.055;
    world.burst(this.x, this.y, 12, ['#ff8a7a', '#ffd45f', '#ffffff'], 220, 5, 0.55);
    world.events.push({ type: 'hurt' });
    if (this.hearts <= 0) world.killPlayer('hearts');
  }
}

function solid(level, tx, ty) {
  if (tx < 0 || tx >= level.width || ty < 0 || ty >= level.rows) return false;
  return level.grid[ty * level.width + tx] === 1;
}

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */
function makeEnemy(def) {
  const e = {
    ...def,
    alive: true,
    deathTimer: 0,
    hitFlash: 0,
    animTime: Math.random() * 8,
    dir: Math.random() < 0.5 ? -1 : 1,
    vy: 0,
    vx: 0,
    grounded: false,
    cooldown: 1 + Math.random(),
  };
  if (def.type === 'walker') { e.w = 40; e.h = 46; }
  else if (def.type === 'flyer') { e.w = 44; e.h = 34; }
  else { e.w = 40; e.h = 58; }
  return e;
}

function updateEnemy(e, dt, world) {
  e.animTime += dt;
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  if (!e.alive) {
    e.deathTimer -= dt;
    return;
  }
  const p = world.player;
  const level = world.level;
  if (e.type === 'walker') {
    e.vy += GRAVITY * dt;
    e.vx = e.dir * 78;
    e.x += e.vx * dt;
    // wall collision
    const halfW = e.w / 2;
    const tx = Math.floor((e.x + sign(e.dir) * halfW) / TILE);
    const ty = Math.floor((e.y - e.h / 2) / TILE);
    if (solid(level, tx, ty)) {
      e.x -= e.vx * dt;
      e.dir *= -1;
    }
    e.y += e.vy * dt;
    const tyFeet = Math.floor(e.y / TILE);
    const txL = Math.floor((e.x - halfW + 6) / TILE);
    const txR = Math.floor((e.x + halfW - 6) / TILE);
    if (e.vy >= 0 && (solid(level, txL, tyFeet) || solid(level, txR, tyFeet))) {
      e.y = tyFeet * TILE;
      e.vy = 0;
      e.grounded = true;
      // ledge check
      const aheadX = e.x + e.dir * (halfW + 8);
      const aheadTy = Math.floor((e.y + 8) / TILE);
      if (!solid(level, Math.floor(aheadX / TILE), aheadTy)) e.dir *= -1;
    } else {
      e.grounded = false;
    }
    if (e.y > level.worldHeight + 100) e.alive = false;
  } else if (e.type === 'flyer') {
    e.x = e.spawnX + Math.sin(e.animTime * 0.9) * 105;
    e.y = e.spawnY - 34 + Math.sin(e.animTime * 2.1) * 16;
    e.dir = Math.cos(e.animTime * 0.9) >= 0 ? 1 : -1;
  } else if (e.type === 'spitter') {
    e.cooldown -= dt;
    const dx = p.x - e.x;
    const dy = (p.y - 6) - (e.y - 44);
    const d = Math.hypot(dx, dy);
    if (d < 560 && e.cooldown <= 0 && !p.dead) {
      e.cooldown = 2.1 + Math.random() * 0.6;
      const speed = 290;
      const vx = (dx / d) * speed;
      const vy = (dy / d) * speed - 40;
      world.projectiles.push({
        x: e.x, y: e.y - 44, vx, vy, r: 9, life: 4, gravity: 160, owner: 'enemy',
      });
      world.audio.sfx('hit');
      world.burst(e.x, e.y - 44, 5, ['#ff9a7c', '#b7323a'], 90, 3, 0.35);
    }
  }
}

function enemyBox(e) {
  if (e.type === 'flyer') return { x: e.x - e.w / 2, y: e.y - e.h / 2 - 10, w: e.w, h: e.h + 10 };
  return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
}

/* ------------------------------------------------------------------ */
/* Boss                                                                */
/* ------------------------------------------------------------------ */
class Boss {
  constructor(def, arena) {
    this.x = def.x;
    this.y = def.y;
    this.baseX = def.x;
    this.baseY = def.y;
    this.arena = arena;
    this.maxHp = 3;
    this.hp = 3;
    this.scale = 1.08;
    this.active = false;
    this.started = false;
    this.defeated = false;
    this.dying = false;
    this.state = 'idle';
    this.stateTime = 0;
    this.attackTimer = 1.5;
    this.hitFlash = 0;
    this.vulnerable = false;
    this.introTimer = 0;
    this.deathTimer = 0;
    this.centerX = (arena.x0 + arena.x1) / 2;
  }

  start(world) {
    if (this.started) return;
    this.started = true;
    this.active = true;
    this.state = 'intro';
    this.stateTime = 0;
    world.audio.sfx('bossRoar');
    world.camera.shake = 24;
    world.events.push({ type: 'bossStart' });
    world.burst(this.x, this.y - 60, 30, ['#b95cff', '#ff6b9d', '#2a0f3d'], 320, 8, 1.1);
  }

  update(dt, world) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (!this.active) return;
    if (this.defeated) return;
    const p = world.player;
    this.stateTime += dt;
    if (this.state === 'dying') {
      this.deathTimer -= dt;
      this.y += dt * 20;
      if (Math.random() < dt * 10) {
        const ex = this.x + (Math.random() - 0.5) * 180;
        const ey = this.y - Math.random() * 160;
        world.burst(ex, ey, 8, ['#ffd45f', '#ff6b9d', '#b95cff', '#ffffff'], 260, 7, 0.8);
        world.audio.sfx('explode');
        world.camera.shake = Math.max(world.camera.shake, 10);
      }
      if (this.deathTimer <= 0) {
        this.defeated = true;
        this.active = false;
        world.burst(this.x, this.y - 60, 60, ['#ffd45f', '#ff6b9d', '#b95cff', '#ffffff'], 420, 10, 1.6);
        world.flash = 0.7;
        world.camera.shake = 26;
        world.audio.sfx('goal');
        world.spawnGoal();
        world.bossDefeated = true;
        world.events.push({ type: 'bossDown' });
      }
      return;
    }

    switch (this.state) {
      case 'intro': {
        this.x = this.centerX + Math.sin(this.stateTime * 1.4) * 100;
        this.y = this.baseY + Math.sin(this.stateTime * 2) * 10;
        if (this.stateTime > 1.15) this.toHover();
        break;
      }
      case 'hover': {
        this.x = this.centerX + Math.sin(this.stateTime * 0.75) * 235;
        this.y = this.baseY + Math.sin(this.stateTime * 1.5) * 18;
        this.vulnerable = false;
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          this.attackTimer = this.hp <= 1 ? 1.25 : 1.8;
          this.shoot(world);
        }
        if (this.stateTime > (this.hp <= 1 ? 4.4 : 5.6)) {
          this.state = 'dive';
          this.stateTime = 0;
          this.diveTargetX = p.x;
          world.audio.sfx('bossRoar');
          world.camera.shake = 8;
        }
        break;
      }
      case 'dive': {
        if (this.stateTime < 0.6) {
          this.x = this.centerX + Math.sin(this.stateTime * 0.75) * 235;
          this.y = this.baseY + Math.sin(this.stateTime * 1.5) * 18;
          world.camera.shake = Math.max(world.camera.shake, 5);
        } else {
          this.x = approach(this.x, this.diveTargetX, 900 * dt);
          this.y = approach(this.y, 700, 1500 * dt);
          if (this.y >= 698) {
            this.slam(world);
          }
        }
        break;
      }
      case 'stunned': {
        this.vulnerable = true;
        this.y = 700 + Math.sin(this.stateTime * 18) * 1.5;
        if (this.stateTime > 2.6) {
          this.vulnerable = false;
          this.state = 'hover';
          this.stateTime = 0;
          this.attackTimer = 1.2;
          world.audio.sfx('bossRoar');
          world.camera.shake = 8;
        }
        break;
      }
      case 'hurt': {
        this.vulnerable = false;
        this.y = approach(this.y, this.baseY - 20, 900 * dt);
        if (this.stateTime > 0.85) {
          this.state = 'hover';
          this.stateTime = 0;
          this.attackTimer = 1.0;
        }
        break;
      }
      default: break;
    }

    // Contact damage
    if (!p.dead && this.state !== 'stunned' && this.state !== 'hurt') {
      const body = { x: this.x - 70, y: this.y - 170, w: 140, h: 220 };
      if (rectsOverlap(p.box, body)) p.hurt(this.x, world);
    }
  }

  toHover() {
    this.state = 'hover';
    this.stateTime = 0;
    this.attackTimer = 1.2;
  }

  shoot(world) {
    const p = world.player;
    const from = { x: this.x, y: this.y - 55 };
    const count = this.hp <= 1 ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.24;
      const dx = p.x - from.x;
      const dy = (p.y - 8) - from.y;
      const base = Math.atan2(dy, dx) + spread;
      const speed = 300;
      world.projectiles.push({
        x: from.x, y: from.y,
        vx: Math.cos(base) * speed,
        vy: Math.sin(base) * speed,
        r: 10, life: 4.5, gravity: 60, owner: 'boss',
      });
    }
    world.audio.sfx('hit');
    world.burst(from.x, from.y, 10, ['#ff6b9d', '#b95cff'], 120, 4, 0.5);
  }

  slam(world) {
    this.state = 'stunned';
    this.stateTime = 0;
    this.vulnerable = true;
    this.y = 700;
    world.camera.shake = 24;
    world.hitstop = 0.06;
    world.audio.sfx('explode');
    world.burst(this.x, 712, 34, ['#ff6b9d', '#b95cff', '#ffd45f', '#2a0f3d'], 420, 8, 1);
    world.shockwaves.push({ x: this.x, y: 716, dir: -1, speed: 560, life: 1.5, hit: false });
    world.shockwaves.push({ x: this.x, y: 716, dir: 1, speed: 560, life: 1.5, hit: false });
    world.events.push({ type: 'bossSlam' });
  }

  hit(world, sourceX) {
    if (!this.vulnerable || this.dying || this.defeated) return;
    this.hp -= 1;
    this.hitFlash = 0.35;
    this.vulnerable = false;
    world.audio.sfx('bossHit');
    world.hitstop = 0.09;
    world.camera.shake = 18;
    world.flash = 0.25;
    world.burst(this.x, this.y - 50, 26, ['#ffd45f', '#ff6b9d', '#ffffff'], 320, 7, 0.9);
    world.events.push({ type: 'bossHit', hp: this.hp });
    if (this.hp <= 0) {
      this.state = 'dying';
      this.stateTime = 0;
      this.deathTimer = 2.6;
      this.dying = true;
      this.vulnerable = false;
      world.audio.sfx('bossRoar');
    } else {
      this.state = 'hurt';
      this.stateTime = 0;
      this.x += (this.x < sourceX ? -1 : 1) * 20;
    }
  }
}

/* ------------------------------------------------------------------ */
/* World                                                               */
/* ------------------------------------------------------------------ */
export class World {
  constructor(levelIndex, audio) {
    this.levelIndex = levelIndex;
    this.level = makeLevel(levelIndex);
    this.audio = audio;
    this.player = new Player(this.level.spawn);
    this.spawnPoint = { ...this.level.spawn };
    this.enemies = this.level.enemies.map(makeEnemy);
    this.projectiles = [];
    this.shockwaves = [];
    this.particles = [];
    this.floaters = [];
    this.events = [];
    this.stats = { lums: 0, cages: 0, deaths: 0 };
    this.timer = 0;
    this.time = 0;
    this.state = 'play';
    this.goal = this.level.goal ? { ...this.level.goal } : null;
    this.boss = this.level.boss ? new Boss(this.level.boss, this.level.arena) : null;
    this.bossTriggered = false;
    this.bossDefeated = false;
    this.camera = { x: 0, y: 0, shake: 0, shakeX: 0, shakeY: 0 };
    this.fade = 1;
    this.flash = 0;
    this.hitstop = 0;
    this.completeTimer = 0;
    this.deadTimer = 0;
    this.completed = false;
    this.deathCounted = false;
    this.snapCamera();
  }

  snapCamera() {
    const p = this.player;
    this.camera.x = clamp(p.x - VIEW_W / 2, 0, this.level.worldWidth - VIEW_W);
    this.camera.y = clamp(p.y - VIEW_H * 0.58, 0, this.level.worldHeight - VIEW_H - 54);
  }

  update(dt, input) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.fade = approach(this.fade, 0, dt * 2.2);

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.updateParticles(dt * 0.25);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'complete') {
      this.completeTimer -= dt;
      this.updateParticles(dt);
      this.updateCamera(dt);
      if (this.completeTimer <= 0 && !this.completed) {
        this.completed = true;
        this.events.push({ type: 'complete' });
      }
      return;
    }

    if (this.state === 'dead') {
      this.updateParticles(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.state === 'play' || this.state === 'boss') {
      this.timer += dt;
    }

    this.player.update(dt, input, this);

    if (this.player.dead) {
      this.deadTimer += dt;
      if (this.deadTimer > 1.6 && !this.deathCounted) {
        this.deathCounted = true;
        this.stats.deaths++;
        this.state = 'dead';
        this.events.push({ type: 'dead' });
      }
    }

    if (!this.player.dead) {
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateShockwaves(dt);
      this.updatePickups(dt);
      this.updateSprings(dt);
      this.updateCheckpoints(dt);
      this.updateBoss(dt);
      this.checkGoal();
    } else {
      this.updateProjectiles(dt);
    }

    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateCamera(dt);
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      updateEnemy(e, dt, this);
      if (!e.alive) continue;
      const p = this.player;
      const ebox = enemyBox(e);
      const atk = p.attackBox();
      if (atk && rectsOverlap(atk, ebox)) {
        this.killEnemy(e, 'punch');
        this.hitstop = 0.045;
        this.camera.shake = 6;
        this.audio.sfx('hit');
        this.burst(e.x, e.y - e.h / 2, 14, ['#b95cff', '#ff6b9d', '#ffe07a'], 240, 5, 0.7);
        continue;
      }
      if (rectsOverlap(p.box, ebox)) {
        const pBottom = p.y + p.h / 2;
        const enemyTop = ebox.y;
        if (p.vy > 90 && pBottom < enemyTop + 30) {
          this.killEnemy(e, 'stomp');
          p.vy = -470;
          p.jumps = 1;
          p.squash = -0.2;
          this.audio.sfx('hit');
          this.burst(e.x, e.y - e.h / 2, 14, ['#b95cff', '#ff6b9d', '#ffe07a'], 240, 5, 0.7);
          this.camera.shake = 6;
        } else {
          p.hurt(e.x, this);
        }
      }
    }
  }

  killEnemy(e, how) {
    if (!e.alive) return;
    e.alive = false;
    e.deathTimer = 0.45;
    this.burst(e.x, e.y - e.h / 2, 16, ['#b95cff', '#ff6b9d', '#ffe07a', '#ffffff'], 220, 5, 0.7);
    this.floaters.push({ x: e.x, y: e.y - e.h - 10, text: how === 'stomp' ? 'STOMP!' : 'POW!', life: 0.7, maxLife: 0.7, color: '#ffe07a' });
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.vy += (pr.gravity || 0) * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      let remove = pr.life <= 0;
      if (pr.x < -50 || pr.x > this.level.worldWidth + 50 || pr.y > this.level.worldHeight + 50) remove = true;
      if (!remove) {
        const tx = Math.floor(pr.x / TILE);
        const ty = Math.floor(pr.y / TILE);
        if (solid(this.level, tx, ty)) {
          remove = true;
          this.burst(pr.x, pr.y, 6, ['#ff6b9d', '#b95cff'], 100, 3, 0.4);
        }
      }
      if (!remove && !p.dead) {
        const atk = p.attackBox();
        const pb = { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
        if (atk && rectsOverlap(atk, pb)) {
          remove = true;
          this.audio.sfx('punch');
          this.burst(pr.x, pr.y, 10, ['#ffd45f', '#ffffff'], 160, 4, 0.5);
        } else if (rectsOverlap(p.box, pb)) {
          remove = true;
          p.hurt(pr.x - pr.vx, this);
        }
      }
      if (remove) {
        this.burst(pr.x, pr.y, 4, ['#ff6b9d', '#b95cff'], 80, 3, 0.3);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateShockwaves(dt) {
    const p = this.player;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      s.x += s.dir * s.speed * dt;
      if (!s.hit && !p.dead && p.grounded && Math.abs(p.x - s.x) < 36 && p.y + p.h / 2 > s.y - 20) {
        s.hit = true;
        p.hurt(s.x - s.dir * 20, this);
      }
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    if (p.dead) return;
    for (const l of this.level.lums) {
      if (l.taken) continue;
      if (dist2(p.x, p.y, l.x, l.y) < 36 * 36) {
        l.taken = true;
        this.stats.lums++;
        this.audio.sfx('coin');
        this.burst(l.x, l.y, 7, ['#fff6c4', '#ffd45f', '#ffffff'], 140, 3, 0.5);
      }
    }
    for (const h of this.level.hearts) {
      if (h.taken) continue;
      if (dist2(p.x, p.y, h.x, h.y) < 42 * 42) {
        h.taken = true;
        if (p.hearts < 3) {
          p.hearts++;
          this.audio.sfx('heart');
          this.floaters.push({ x: h.x, y: h.y - 20, text: '+1 HEART', life: 1, maxLife: 1, color: '#ff9ab2' });
        } else {
          this.floaters.push({ x: h.x, y: h.y - 20, text: 'HEALTH FULL', life: 0.8, maxLife: 0.8, color: '#ff9ab2' });
        }
        this.burst(h.x, h.y, 12, ['#ff9ab2', '#ff5c86', '#ffffff'], 160, 4, 0.6);
      }
    }
    for (const c of this.level.cages) {
      if (c.freed) continue;
      if (dist2(p.x, p.y, c.x, c.y) < 56 * 56) {
        c.freed = true;
        this.stats.cages++;
        this.audio.sfx('cage');
        this.flash = Math.max(this.flash, 0.18);
        this.burst(c.x, c.y, 30, ['#ff8fbe', '#ffd45f', '#ffffff', '#b98cff'], 260, 6, 1);
        this.floaters.push({ x: c.x, y: c.y - 50, text: 'ELECT00N FREED!', life: 1.4, maxLife: 1.4, color: '#ffb3d0' });
        this.events.push({ type: 'cage', count: this.stats.cages });
      }
    }
    if (this.goal && !p.dead) {
      const goalBox = { x: this.goal.x - 46, y: this.goal.y - 120, w: 92, h: 130 };
      if (rectsOverlap(p.box, goalBox)) this.finishLevel();
    }
  }

  updateSprings(dt) {
    const p = this.player;
    for (const s of this.level.springs) {
      s.squash = Math.max(0, (s.squash || 0) - dt * 3);
      if (p.dead) continue;
      const feet = p.y + p.h / 2;
      if (p.vy >= 0 && Math.abs(p.x - s.x) < 30 && feet > s.y - 24 && feet < s.y + 10) {
        p.vy = -s.power;
        p.jumps = 0;
        p.squash = -0.35;
        s.squash = 0.8;
        this.audio.sfx('spring');
        this.camera.shake = 4;
        this.burst(s.x, s.y - 20, 12, ['#8fe05a', '#ffd45f', '#ffffff'], 180, 4, 0.6);
      }
    }
  }

  updateCheckpoints(dt) {
    const p = this.player;
    for (const c of this.level.checkpoints) {
      c.ring = Math.max(0, (c.ring || 0) - dt * 1.4);
      if (c.active || p.dead) continue;
      if (dist2(p.x, p.y, c.x, c.y - 30) < 70 * 70) {
        c.active = true;
        c.ring = 1;
        this.spawnPoint = { x: c.x, y: c.y };
        p.hearts = 3;
        this.audio.sfx('checkpoint');
        this.flash = Math.max(this.flash, 0.12);
        this.burst(c.x + 22, c.y - 50, 22, ['#ffd45f', '#fff6c4', '#ffffff'], 200, 5, 0.9);
        this.floaters.push({ x: c.x, y: c.y - 90, text: 'CHECKPOINT', life: 1.2, maxLife: 1.2, color: '#ffe07a' });
        this.events.push({ type: 'checkpoint' });
      }
    }
  }

  updateBoss(dt) {
    if (!this.boss) return;
    if (!this.bossTriggered && !this.bossDefeated && this.player.x > this.level.bossTriggerX) {
      this.bossTriggered = true;
      this.state = 'boss';
      this.boss.start(this);
    }
    if (this.bossTriggered) {
      this.boss.update(dt, this);
      // player attack vs boss weak point
      const p = this.player;
      if (this.boss.vulnerable && !p.dead) {
        const weak = { x: this.boss.x - 58, y: this.boss.y - 115, w: 116, h: 100 };
        const atk = p.attackBox();
        if (atk && rectsOverlap(atk, weak)) {
          this.boss.hit(this, p.x);
        } else if (p.vy > 60 && rectsOverlap(p.box, weak)) {
          this.boss.hit(this, p.x);
          p.vy = -520;
          p.jumps = 1;
          p.squash = -0.25;
        }
      }
    }
  }

  spawnGoal() {
    const arena = this.level.arena;
    this.goal = { x: arena.x1 - 3 * TILE, y: 15 * TILE };
    this.floaters.push({ x: this.goal.x, y: this.goal.y - 140, text: 'THE WAY IS OPEN', life: 2, maxLife: 2, color: '#ffe07a' });
  }

  checkGoal() {
    if (!this.goal || this.player.dead) return;
    const goalBox = { x: this.goal.x - 46, y: this.goal.y - 120, w: 92, h: 130 };
    if (rectsOverlap(this.player.box, goalBox)) this.finishLevel();
  }

  finishLevel() {
    if (this.state === 'complete') return;
    this.state = 'complete';
    this.completeTimer = 1.6;
    this.player.vx = 0;
    this.audio.sfx('goal');
    this.flash = 0.35;
    this.burst(this.goal.x, this.goal.y - 60, 40, ['#8cffe1', '#ffffff', '#ffd45f'], 320, 8, 1.2);
    this.events.push({ type: 'goal' });
  }

  killPlayer(cause) {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.deathTimer = 0;
    p.deathSpin = 0;
    p.deathFade = 1;
    p.vy = -520;
    p.vx = 0;
    this.deadTimer = 0;
    this.deathCounted = false;
    this.camera.shake = 16;
    this.audio.sfx(cause === 'water' ? 'splash' : cause === 'lava' ? 'hurt' : 'death');
    this.burst(p.x, p.y, 26, cause === 'water' ? ['#8cffe1', '#ffffff', '#35c9cf'] : ['#ff8a7a', '#ffd45f', '#ffffff'], 260, 6, 1);
    this.events.push({ type: 'death', cause });
  }

  respawn() {
    this.player.reset(this.spawnPoint);
    this.player.hearts = 3;
    this.player.invuln = 1.5;
    this.state = 'play';
    this.deadTimer = 0;
    this.deathCounted = false;
    this.projectiles.length = 0;
    this.shockwaves.length = 0;
    this.fade = 0.8;
    this.bossTriggered = false;
    if (this.boss && !this.bossDefeated) {
      this.boss = new Boss(this.level.boss, this.level.arena);
      this.goal = this.level.goal ? { ...this.level.goal } : null;
    }
    for (const e of this.enemies) {
      e.alive = true;
      e.deathTimer = 0;
      e.x = e.spawnX;
      e.y = e.spawnY;
      e.vy = 0;
      e.cooldown = 1 + Math.random();
      e.dir = Math.random() < 0.5 ? -1 : 1;
    }
    this.snapCamera();
  }

  updateCamera(dt) {
    const p = this.player;
    let targetX;
    let targetY;
    if (this.state === 'boss' && this.boss && this.boss.active) {
      const arena = this.level.arena;
      targetX = clamp(p.x - VIEW_W / 2 + p.facing * 40, arena.x0, Math.max(arena.x0, arena.x1 - VIEW_W));
      targetY = clamp(p.y - VIEW_H * 0.58, 0, this.level.worldHeight - VIEW_H - 54);
      p.x = clamp(p.x, arena.x0 + 30, arena.x1 - 30);
    } else {
      targetX = p.x - VIEW_W / 2 + p.facing * 75;
      targetY = p.y - VIEW_H * 0.58;
    }
    targetX = clamp(targetX, 0, this.level.worldWidth - VIEW_W);
    targetY = clamp(targetY, 0, this.level.worldHeight - VIEW_H - 54);
    const k = 1 - Math.exp(-dt * 6.5);
    this.camera.x += (targetX - this.camera.x) * k;
    this.camera.y += (targetY - this.camera.y) * k;
    this.camera.shake = Math.max(0, this.camera.shake - dt * 40);
    const s = this.camera.shake;
    this.camera.shakeX = (Math.random() * 2 - 1) * s;
    this.camera.shakeY = (Math.random() * 2 - 1) * s * 0.7;
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
  }

  updateFloaters(dt) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= dt * 26;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  dust(x, y, count, dir) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 4,
        vx: Math.cos(a) * (20 + Math.random() * 50) - (dir || 0) * 30,
        vy: -Math.random() * 40 - 10,
        gravity: 120,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 3 + Math.random() * 4,
        color: 'rgba(220, 210, 180, 0.55)',
        shape: 'circle',
        alpha: 0.6,
      });
    }
  }

  burst(x, y, count, colors, speed, size, life) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.25 + Math.random() * 0.75);
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - speed * 0.12,
        gravity: 260,
        life: life * (0.5 + Math.random() * 0.6),
        maxLife: life,
        size: size * (0.5 + Math.random() * 0.9),
        color,
        shape: Math.random() < 0.5 ? 'star' : 'circle',
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 12,
        alpha: 0.95,
      });
    }
  }
}
