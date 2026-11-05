import { TAU, clamp, circle, roundRect, starPath, easeOutBack } from './util.js';

const OUTLINE = '#2c1710';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
export function drawPlayer(ctx, p, time) {
  const x = p.x, y = p.y + p.h / 2; // feet
  const dead = p.dead;
  const hurt = p.invuln > 0 && !dead;
  ctx.save();
  ctx.translate(x, y);

  // contact shadow
  if (!dead) {
    ctx.save();
    ctx.globalAlpha = p.grounded ? 0.26 : 0.13;
    ctx.fillStyle = '#04110c';
    ctx.beginPath();
    ctx.ellipse(0, 1, 25, 7, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  if (dead) {
    ctx.rotate(p.deathSpin);
    ctx.globalAlpha = clamp(p.deathFade, 0, 1);
  } else if (hurt) {
    ctx.globalAlpha = 0.55 + Math.sin(time * 45) * 0.35;
  }

  const run = clamp(Math.abs(p.vx) / 340, 0, 1);
  const phase = p.animTime * (7 + run * 7);
  const bob = p.grounded ? Math.sin(phase * 2) * 1.2 * run : 0;
  const breathe = p.grounded ? Math.sin(time * 2.2) * 1.1 : 0;
  const lean = clamp(p.vx / 420, -1, 1) * 0.09;
  const squash = p.squash || 0;

  ctx.scale(p.facing, 1);
  ctx.rotate(lean);
  ctx.translate(0, bob + breathe);
  ctx.scale(1 + squash * 0.55, 1 - squash * 0.7);

  const outline = OUTLINE;
  const lw = 2.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // ---- back scarf ----
  const scarfWave = Math.sin(time * 8 + run * 5) * 5;
  ctx.save();
  ctx.translate(-12, -47);
  ctx.rotate(-0.35 - run * 0.5);
  ctx.fillStyle = '#39c7ad';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-20, -6 + scarfWave, -30 - run * 9, 3 + scarfWave);
  ctx.quadraticCurveTo(-18, 7, 0, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // ---- back glove ----
  const swing = Math.sin(phase) * 7 * run;
  const air = !p.grounded;
  const gloveBackX = -22 - swing * 0.5;
  const gloveBackY = air ? -38 : -33 + Math.cos(phase) * 3;
  drawGlove(ctx, gloveBackX, gloveBackY, 0.82);

  // ---- feet ----
  let f1x = -11, f1y = -7, f2x = 11, f2y = -7;
  let f1r = 0, f2r = 0;
  if (p.grounded) {
    f1x += Math.sin(phase) * 9 * run;
    f2x += Math.sin(phase + Math.PI) * 9 * run;
    f1y -= Math.max(0, Math.sin(phase + Math.PI / 2)) * 7 * run;
    f2y -= Math.max(0, Math.sin(phase + Math.PI * 1.5)) * 7 * run;
    f1r = Math.sin(phase) * 0.25 * run;
    f2r = Math.sin(phase + Math.PI) * 0.25 * run;
  } else if (p.gliding) {
    f1x = -14 + Math.sin(time * 9) * 2;
    f2x = 14 + Math.cos(time * 9) * 2;
    f1y = -5; f2y = -8;
    f1r = 0.3; f2r = -0.3;
  } else {
    f1x = -9; f2x = 12;
    f1y = -12 - Math.min(6, Math.abs(p.vy) * 0.01);
    f2y = -9;
    f1r = -0.5; f2r = 0.3;
  }
  drawShoe(ctx, f1x, f1y, f1r, 0.95);
  drawShoe(ctx, f2x, f2y, f2r, 0.95);

  // ---- body ----
  const bodyGrad = ctx.createLinearGradient(0, -56, 0, -12);
  bodyGrad.addColorStop(0, '#ff9a70');
  bodyGrad.addColorStop(0.55, '#f0623f');
  bodyGrad.addColorStop(1, '#b5301c');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(-15, -52);
  ctx.bezierCurveTo(-21, -46, -20, -25, -15, -16);
  ctx.bezierCurveTo(-8, -11, 8, -11, 15, -16);
  ctx.bezierCurveTo(20, -25, 21, -46, 15, -52);
  ctx.bezierCurveTo(8, -57, -8, -57, -15, -52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // chest circle
  ctx.fillStyle = '#fff8e6';
  ctx.beginPath();
  ctx.ellipse(0, -33, 10.5, 11.5, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = '#7d2a18';
  ctx.stroke();
  ctx.fillStyle = '#ff7a5c';
  ctx.beginPath();
  ctx.ellipse(0, -33, 4.6, 5.2, 0, 0, TAU);
  ctx.fill();

  // hood collar
  ctx.fillStyle = '#a52b18';
  ctx.beginPath();
  ctx.ellipse(0, -52, 15, 5.5, 0, 0, TAU);
  ctx.fill();

  // ---- head ----
  const headY = -69;
  ctx.fillStyle = '#f8e5bd';
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.ellipse(0, headY, 19, 19.5, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // cheek
  ctx.fillStyle = 'rgba(255, 130, 105, 0.5)';
  ctx.beginPath();
  ctx.ellipse(10, headY + 6, 4.6, 3, 0, 0, TAU);
  ctx.fill();

  // hair tuft
  drawHair(ctx, time, p, headY);

  // eyes
  const blinkCycle = (time + p.blinkOffset) % 4.1;
  const blink = blinkCycle > 3.92 ? clamp((blinkCycle - 3.92) / 0.1, 0, 1) : 0;
  const eyeY = headY - 1;
  ctx.fillStyle = '#fffdf5';
  ctx.strokeStyle = '#4a2c22';
  ctx.lineWidth = 1.4;
  for (const ex of [-6.5, 6.5]) {
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 4.6, 5.8 * (1 - blink * 0.9), 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (blink < 0.7) {
    ctx.fillStyle = '#223a32';
    ctx.beginPath();
    ctx.arc(2.6, eyeY + 0.6, 2.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8.6, eyeY + 0.6, 2.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(3.4, eyeY - 0.4, 0.9, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9.4, eyeY - 0.4, 0.9, 0, TAU);
    ctx.fill();
  }

  // smile
  ctx.strokeStyle = '#8a3a26';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (p.punchTimer > 0) {
    ctx.ellipse(5, headY + 8, 3.2, 2.6, 0, 0, TAU);
    ctx.fillStyle = '#7a2c1c';
    ctx.fill();
  } else {
    ctx.arc(5, headY + 7, 4.2, 0.15, Math.PI - 0.4);
    ctx.stroke();
  }

  // ---- front glove ----
  let fx, fy, fistScale = 1;
  if (p.punchTimer > 0) {
    const t = 1 - p.punchTimer / 0.2;
    const ext = Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 22;
    fx = 25 + ext;
    fy = -41;
    fistScale = 1.28;
    // speed lines
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(19 + i * 4, -50 + i * 8);
      ctx.lineTo(30 + i * 5 + ext * 0.5, -50 + i * 8);
      ctx.stroke();
    }
  } else {
    fx = 23 + Math.sin(phase + Math.PI) * 6 * run;
    fy = -34 + Math.cos(phase + Math.PI) * 3 * run;
    if (air) fy = -40;
  }
  drawGlove(ctx, fx, fy, fistScale);

  // gliding propeller hair
  if (p.gliding) {
    ctx.save();
    ctx.translate(0, headY - 22);
    const spin = time * 32;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i++) {
      ctx.rotate((TAU / 3));
      ctx.fillStyle = i % 2 ? 'rgba(255, 220, 110, 0.9)' : 'rgba(255, 246, 200, 0.75)';
      ctx.beginPath();
      ctx.ellipse(12, 0, 12, 3.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.arc(0, 0, 15 + Math.sin(spin) * 1.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawHair(ctx, time, p, headY) {
  const sway = Math.sin(time * 3 + (p.blinkOffset || 0)) * 2;
  ctx.fillStyle = '#f2b53e';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, headY - 14);
  ctx.bezierCurveTo(-14, headY - 30, 2, headY - 30, 2, headY - 22);
  ctx.bezierCurveTo(10, headY - 31, 18, headY - 22, 12, headY - 15);
  ctx.bezierCurveTo(5, headY - 19, -4, headY - 18, -10, headY - 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.ellipse(-2 + sway * 0.2, headY - 21, 6, 3.4, -0.3, 0, TAU);
  ctx.fill();
}

function drawGlove(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.5, 8, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f4d9ae';
  ctx.beginPath();
  ctx.ellipse(2.4, 2.2, 3.2, 2.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawShoe(ctx, x, y, rot, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  const g = ctx.createLinearGradient(0, -8, 0, 6);
  g.addColorStop(0, '#ffe796');
  g.addColorStop(1, '#eaa42c');
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 6.6, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-2, -2.4, 5, 2, -0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Enemies                                                             */
/* ------------------------------------------------------------------ */
export function drawEnemy(ctx, e, time) {
  if (!e.alive && e.deathTimer <= 0) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.hitFlash > 0) {
    ctx.globalCompositeOperation = 'source-over';
  }
  if (!e.alive) {
    const t = 1 - clamp(e.deathTimer / 0.5, 0, 1);
    ctx.globalAlpha = 1 - t;
    ctx.translate(0, t * 10);
    ctx.scale(1 + t * 0.5, 1 - t * 0.7);
  }
  const flash = e.hitFlash > 0;
  if (e.type === 'walker') drawWalker(ctx, e, time, flash);
  else if (e.type === 'flyer') drawFlyer(ctx, e, time, flash);
  else if (e.type === 'spitter') drawSpitter(ctx, e, time, flash);
  ctx.restore();
}

function drawWalker(ctx, e, time, flash) {
  const dir = e.dir || 1;
  const bob = Math.sin(e.animTime * 9) * 1.5;
  const body = flash ? '#ffffff' : '#5b2a72';
  const bodyDark = flash ? '#ffffff' : '#331544';
  const g = ctx.createLinearGradient(0, -42, 0, 0);
  g.addColorStop(0, flash ? '#fff' : '#7b3d96');
  g.addColorStop(0.6, body);
  g.addColorStop(1, bodyDark);
  // feet
  ctx.fillStyle = '#2a1338';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  for (const fx of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(fx + Math.sin(e.animTime * 9 + (fx > 0 ? Math.PI : 0)) * 3, -3, 8, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // body blob
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-19, -12 + bob);
  ctx.bezierCurveTo(-25, -34 + bob, -12, -45 + bob, 0, -45 + bob);
  ctx.bezierCurveTo(12, -45 + bob, 25, -34 + bob, 19, -12 + bob);
  ctx.bezierCurveTo(11, -5 + bob, -11, -5 + bob, -19, -12 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // horns
  ctx.fillStyle = '#f3c14f';
  ctx.beginPath();
  ctx.moveTo(-12, -41 + bob); ctx.lineTo(-16, -53 + bob); ctx.lineTo(-5, -44 + bob); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -41 + bob); ctx.lineTo(16, -53 + bob); ctx.lineTo(5, -44 + bob); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = '#ffe466';
  ctx.strokeStyle = '#24102e';
  ctx.lineWidth = 1.5;
  for (const ex of [-7, 7]) {
    ctx.beginPath();
    ctx.ellipse(ex, -30 + bob, 5.5, 6.5, 0, 0, TAU);
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#1a0a20';
  ctx.beginPath();
  ctx.arc(-7 + dir * 1.5, -29 + bob, 2.4, 0, TAU);
  ctx.arc(7 + dir * 1.5, -29 + bob, 2.4, 0, TAU);
  ctx.fill();
  // mouth
  ctx.strokeStyle = '#24102e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -20 + bob, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // teeth
  ctx.fillStyle = '#fff7df';
  ctx.beginPath();
  ctx.moveTo(-4, -19 + bob); ctx.lineTo(-1, -14 + bob); ctx.lineTo(2, -19 + bob); ctx.closePath();
  ctx.fill();
}

function drawFlyer(ctx, e, time, flash) {
  const flap = Math.sin(e.animTime * 16);
  const dir = e.dir || 1;
  ctx.save();
  ctx.scale(dir, 1);
  // wings
  ctx.fillStyle = flash ? '#fff' : '#6e2c86';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(flap * 0.35);
    ctx.beginPath();
    ctx.moveTo(10, -18);
    ctx.quadraticCurveTo(34, -34, 40, -10);
    ctx.quadraticCurveTo(28, -8, 30, 2);
    ctx.quadraticCurveTo(22, -2, 14, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  // body
  const g = ctx.createLinearGradient(0, -26, 0, 6);
  g.addColorStop(0, flash ? '#fff' : '#8a47a4');
  g.addColorStop(1, flash ? '#fff' : '#3d1a50');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -12, 15, 16, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // ears
  ctx.fillStyle = '#f3c14f';
  ctx.beginPath();
  ctx.moveTo(-9, -25); ctx.lineTo(-13, -38); ctx.lineTo(-3, -27); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, -25); ctx.lineTo(13, -38); ctx.lineTo(3, -27); ctx.closePath(); ctx.fill();
  // eyes
  ctx.fillStyle = '#ffe466';
  for (const ex of [-5, 5]) {
    ctx.beginPath(); ctx.ellipse(ex, -14, 4.2, 5, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#1a0a20';
  ctx.beginPath();
  ctx.arc(-4.5, -13, 2, 0, TAU); ctx.arc(5.5, -13, 2, 0, TAU); ctx.fill();
  // fangs
  ctx.fillStyle = '#fff7df';
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-1, 4); ctx.lineTo(2, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSpitter(ctx, e, time, flash) {
  const pulse = Math.sin(e.animTime * 3) * 1.2;
  ctx.save();
  // stem
  ctx.strokeStyle = '#2f5c34';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.quadraticCurveTo(-2, -18, 0, -28);
  ctx.stroke();
  // leaves
  ctx.fillStyle = '#4f9a4b';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 1.8;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.ellipse(14, -12, 12, 5, -0.5, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // bulb
  const g = ctx.createRadialGradient(-6, -44, 3, 0, -38, 24);
  g.addColorStop(0, flash ? '#fff' : '#ff9a7c');
  g.addColorStop(1, flash ? '#fff' : '#b7323a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -38 + pulse, 19, 18, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // mouth
  ctx.fillStyle = '#40101c';
  ctx.beginPath();
  ctx.ellipse(0, -34 + pulse, 8, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff2cf';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 - 2, -38 + pulse);
    ctx.lineTo(i * 5, -33 + pulse);
    ctx.lineTo(i * 5 + 2, -38 + pulse);
    ctx.closePath(); ctx.fill();
  }
  // eyes
  ctx.fillStyle = '#ffe466';
  ctx.beginPath(); ctx.ellipse(-7, -47 + pulse, 3.6, 4.2, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -47 + pulse, 3.6, 4.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#231019';
  ctx.beginPath(); ctx.arc(-6.5, -46 + pulse, 1.7, 0, TAU); ctx.arc(7.5, -46 + pulse, 1.7, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawProjectile(ctx, pr, time) {
  ctx.save();
  ctx.translate(pr.x, pr.y);
  const r = pr.r || 9;
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, 'rgba(255,120,150,0.95)');
  g.addColorStop(0.55, 'rgba(180,40,100,0.55)');
  g.addColorStop(1, 'rgba(120,20,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd9e6';
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.2, r * 0.38, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,140,170,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-pr.vx * 0.05, -pr.vy * 0.05);
  ctx.lineTo(-pr.vx * 0.11, -pr.vy * 0.11);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Pickups & props                                                     */
/* ------------------------------------------------------------------ */
export function drawLum(ctx, l, time) {
  const bob = Math.sin(time * 2.4 + l.x * 0.01) * 3;
  const x = l.x, y = l.y + bob;
  const pulse = 0.85 + Math.sin(time * 4 + l.x * 0.02) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 26 * pulse);
  glow.addColorStop(0, 'rgba(255,255,220,0.95)');
  glow.addColorStop(0.28, 'rgba(255,226,120,0.65)');
  glow.addColorStop(0.62, 'rgba(255,180,50,0.2)');
  glow.addColorStop(1, 'rgba(255,160,30,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // wings
  const flap = Math.sin(time * 14 + l.x * 0.03) * 0.5;
  ctx.fillStyle = 'rgba(255, 248, 205, 0.9)';
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.ellipse(8, -2, 6, 3.4, -0.45, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // core
  const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 9);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.5, '#ffdd6d');
  g.addColorStop(1, '#f3a222');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 9, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,240,0.85)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // face
  ctx.fillStyle = '#5a3a10';
  ctx.beginPath();
  ctx.arc(-2.3, -1, 0.9, 0, TAU);
  ctx.arc(2.3, -1, 0.9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#7a5418';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, 1.4, 2.1, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // sparkle
  ctx.strokeStyle = 'rgba(255,255,230,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(9, -9); ctx.lineTo(11, -9); ctx.moveTo(10, -10); ctx.lineTo(10, -8);
  ctx.stroke();
  ctx.restore();
}

export function drawCage(ctx, cage, time) {
  const bob = Math.sin(time * 1.8 + cage.bob) * 2.5;
  ctx.save();
  ctx.translate(cage.x, cage.y + bob);
  if (cage.freed) ctx.globalAlpha = 0.35;
  // glow
  if (!cage.freed) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 42);
    g.addColorStop(0, 'rgba(255,180,220,0.35)');
    g.addColorStop(1, 'rgba(255,120,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 42, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // chain
  ctx.strokeStyle = '#8b93a3';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, -38 - i * 6, 3.2, 4.4, 0, 0, TAU);
    ctx.stroke();
  }
  // creature inside
  if (!cage.freed) {
    const w = Math.sin(time * 3 + cage.bob) * 2;
    ctx.fillStyle = '#ff8fbe';
    ctx.beginPath(); ctx.ellipse(0, 5, 13, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd0e4';
    ctx.beginPath(); ctx.ellipse(0, 10, 8, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3d1226';
    ctx.beginPath(); ctx.arc(-4, 3, 2, 0, TAU); ctx.arc(4, 3, 2, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3d1226'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 7, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    // ears
    ctx.fillStyle = '#ff8fbe';
    ctx.beginPath(); ctx.ellipse(-9, -5 + w, 4, 6, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9, -5 + w, 4, 6, 0.4, 0, TAU); ctx.fill();
  }
  // cage frame
  ctx.strokeStyle = '#9aa6b8';
  ctx.lineWidth = 3;
  ctx.fillStyle = 'rgba(160,180,200,0.08)';
  roundRect(ctx, -20, -24, 40, 46, 7);
  ctx.fill();
  ctx.stroke();
  // bars
  ctx.strokeStyle = '#c2ccda';
  ctx.lineWidth = 2.2;
  for (let i = -12; i <= 12; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, -22); ctx.lineTo(i, 20); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
  // top & bottom
  ctx.fillStyle = '#7c8798';
  roundRect(ctx, -23, -30, 46, 9, 4); ctx.fill();
  roundRect(ctx, -23, 19, 46, 8, 4); ctx.fill();
  // lock
  if (!cage.freed) {
    ctx.fillStyle = '#ffd45f';
    ctx.strokeStyle = '#7a5418';
    ctx.lineWidth = 1.5;
    roundRect(ctx, -6, 5, 12, 11, 3);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7a5418';
    ctx.beginPath(); ctx.arc(0, 4, 3.4, Math.PI, 0); ctx.stroke();
  } else {
    ctx.strokeStyle = '#8fe05a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-14, -20); ctx.lineTo(-22, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, -20); ctx.lineTo(22, -28); ctx.stroke();
  }
  ctx.restore();
}

export function drawHeart(ctx, h, time) {
  const bob = Math.sin(time * 3 + h.x * 0.02) * 3;
  ctx.save();
  ctx.translate(h.x, h.y + bob);
  const s = 1 + Math.sin(time * 5) * 0.05;
  ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
  g.addColorStop(0, 'rgba(255,120,150,0.4)');
  g.addColorStop(1, 'rgba(255,60,110,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ff5c86';
  ctx.strokeStyle = '#7c1738';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-16, -2, -12, -15, -2, -12);
  ctx.bezierCurveTo(3, -11, 0, -7, 0, -7);
  ctx.bezierCurveTo(0, -7, -3, -11, 2, -12);
  ctx.bezierCurveTo(12, -15, 16, -2, 0, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath(); ctx.ellipse(-5, -6, 3, 2, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawSpring(ctx, s, theme, time) {
  const squash = s.squash || 0;
  const h = 18 * (1 - squash * 0.6);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, TAU); ctx.fill();
  // base
  ctx.fillStyle = theme.dirt[2];
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, -20, -8, 40, 8, 4);
  ctx.fill(); ctx.stroke();
  // stem
  ctx.fillStyle = theme.grass[2];
  roundRect(ctx, -7, -h, 14, h, 5);
  ctx.fill();
  // cap
  const g = ctx.createLinearGradient(0, -h - 14, 0, -h + 4);
  g.addColorStop(0, theme.grass[0]);
  g.addColorStop(1, theme.grass[1]);
  ctx.fillStyle = g;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, -h - 4, 27, 14, 0, Math.PI, TAU);
  ctx.lineTo(27, -h + 2);
  ctx.quadraticCurveTo(0, -h + 14, -27, -h + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // spots
  ctx.fillStyle = theme.flower[1] || '#ffd36e';
  for (const [sx, sy, r] of [[-12, -h - 7, 3], [8, -h - 10, 2.4], [2, -h - 3, 2]]) {
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }
  // arrow hint
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -h - 24); ctx.lineTo(0, -h - 16);
  ctx.moveTo(-4, -h - 20); ctx.lineTo(0, -h - 24); ctx.lineTo(4, -h - 20);
  ctx.stroke();
  ctx.restore();
}

export function drawCheckpoint(ctx, cp, theme, time) {
  ctx.save();
  ctx.translate(cp.x, cp.y);
  // post
  ctx.fillStyle = '#6d4326';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, -4, -66, 8, 66, 3);
  ctx.fill(); ctx.stroke();
  // arm
  ctx.fillStyle = '#7d4d2b';
  roundRect(ctx, -4, -64, 26, 7, 3);
  ctx.fill(); ctx.stroke();
  // bell
  const swing = cp.active ? Math.sin(time * 3) * 0.08 : 0;
  ctx.save();
  ctx.translate(22, -59);
  ctx.rotate(swing);
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 4); ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, 0, 22);
  if (cp.active) {
    g.addColorStop(0, '#fff6b8');
    g.addColorStop(1, '#ffc23e');
  } else {
    g.addColorStop(0, '#c7b98e');
    g.addColorStop(1, '#7e7255');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-8, 18);
  ctx.quadraticCurveTo(-9, 4, 0, 3);
  ctx.quadraticCurveTo(9, 4, 8, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 19, 2.6, 0, TAU); ctx.fillStyle = '#5b3a1e'; ctx.fill();
  if (cp.active) {
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 12, 1, 0, 12, 30);
    glow.addColorStop(0, 'rgba(255,220,110,0.4)');
    glow.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 12, 30, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // active ring
  if (cp.active && cp.ring > 0) {
    ctx.strokeStyle = `rgba(255, 226, 120, ${cp.ring * 0.7})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(22, -45, (1 - cp.ring) * 60, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGoal(ctx, goal, time) {
  const bob = Math.sin(time * 2) * 4;
  ctx.save();
  ctx.translate(goal.x, goal.y);
  // ground glow
  ctx.globalCompositeOperation = 'lighter';
  const floor = ctx.createRadialGradient(0, 0, 2, 0, 0, 80);
  floor.addColorStop(0, 'rgba(120,255,220,0.5)');
  floor.addColorStop(1, 'rgba(40,200,180,0)');
  ctx.fillStyle = floor;
  ctx.beginPath(); ctx.ellipse(0, 0, 80, 24, 0, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // pillars
  ctx.fillStyle = '#4a2e1d';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    roundRect(ctx, s * 42 - 6, -72, 12, 72, 4);
    ctx.fill(); ctx.stroke();
  }
  // portal
  ctx.save();
  ctx.translate(0, -72 + bob);
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 44);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.3, 'rgba(140,255,225,0.85)');
  g.addColorStop(0.7, 'rgba(50,210,190,0.35)');
  g.addColorStop(1, 'rgba(30,160,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 44, 54, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(190,255,240,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 44, 0, 0, TAU); ctx.stroke();
  // swirl
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = time * 1.6 + i * 2.1;
    ctx.beginPath();
    ctx.arc(0, 0, 22, a, a + 1.6);
    ctx.stroke();
  }
  // sparkles
  for (let i = 0; i < 5; i++) {
    const a = time * 0.8 + i * 1.26;
    const r = 30 + Math.sin(time * 2 + i) * 8;
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r * 1.2;
    ctx.fillStyle = 'rgba(255,255,240,0.85)';
    starPath(ctx, sx, sy, 4, 3, 1.1, a);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}

export function drawSign(ctx, sign) {
  ctx.save();
  ctx.translate(sign.x, sign.y);
  ctx.fillStyle = '#6b4226';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 2;
  roundRect(ctx, -3, -42, 6, 42, 2);
  ctx.fill(); ctx.stroke();
  const w = Math.max(54, sign.text.length * 8 + 18);
  ctx.fillStyle = '#e8cf9a';
  ctx.strokeStyle = '#5b3a1e';
  ctx.lineWidth = 2.4;
  roundRect(ctx, -w / 2, -68, w, 28, 5);
  ctx.fill(); ctx.stroke();
  // wood grain
  ctx.strokeStyle = 'rgba(120,80,40,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, -62 + i * 6);
    ctx.lineTo(w / 2 - 6, -62 + i * 6);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a2a12';
  ctx.font = '800 9px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign.text, 0, -53);
  // little icon
  if (sign.icon) {
    ctx.font = '11px "Trebuchet MS", sans-serif';
    ctx.fillText(sign.icon === 'jump' ? '⤒' : sign.icon === 'punch' ? '✊' : sign.icon === 'move' ? '→' : sign.icon === 'spring' ? '⇧' : sign.icon === 'water' ? '≈' : '☠', 0, -68);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Scenery props                                                       */
/* ------------------------------------------------------------------ */
export function drawProp(ctx, prop, theme, time) {
  const sway = Math.sin(time * 0.9 + prop.x * 0.01) * 0.02;
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.scale(prop.flip ? -prop.scale : prop.scale, prop.scale);
  ctx.rotate(sway);
  switch (prop.type) {
    case 'tree': drawTree(ctx, theme, time); break;
    case 'fern': drawFern(ctx, theme); break;
    case 'rock': drawRock(ctx, theme); break;
    case 'mushroom': drawMushroom(ctx, theme); break;
    case 'ruin': drawRuin(ctx, theme); break;
    case 'cactus': drawCactus(ctx, theme); break;
    case 'skull': drawSkull(ctx); break;
    case 'coral': drawCoral(ctx, theme, time); break;
    case 'kelp': drawKelp(ctx, theme, time); break;
    case 'deadTree': drawDeadTree(ctx, theme); break;
    case 'crystal': drawCrystal(ctx, time); break;
    default: break;
  }
  ctx.restore();
}

function drawTree(ctx, theme, time) {
  ctx.strokeStyle = '#4a2a16';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-4, -40, 8, -80, -2, -130);
  ctx.stroke();
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 9;
  ctx.stroke();
  // canopy
  const c = theme.mid;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + time * 0.01;
    const cx = Math.cos(a) * 38;
    const cy = -140 + Math.sin(a) * 24;
    const r = 30 + (i % 3) * 8;
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 2, cx, cy, r);
    g.addColorStop(0, c[1]);
    g.addColorStop(1, c[0]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(-16, -156, 34, 0, TAU); ctx.fill();
}

function drawFern(ctx, theme) {
  ctx.strokeStyle = theme.grass[2];
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.rotate(i * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(i * 8, -26, i * 14, -52);
    ctx.stroke();
    ctx.fillStyle = theme.grass[1];
    for (let j = 0; j < 4; j++) {
      const t = j / 4;
      const lx = i * 10 * t;
      const ly = -14 - 34 * t;
      ctx.beginPath();
      ctx.ellipse(lx + (i >= 0 ? 6 : -6), ly, 8, 3.4, i * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawRock(ctx, theme) {
  const g = ctx.createLinearGradient(0, -30, 0, 0);
  g.addColorStop(0, theme.dirt[1]);
  g.addColorStop(1, theme.dirt[2]);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(20,10,5,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(-18, -20);
  ctx.lineTo(-2, -28);
  ctx.lineTo(16, -22);
  ctx.lineTo(26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(-2, -24); ctx.lineTo(8, -20); ctx.stroke();
}

function drawMushroom(ctx, theme) {
  ctx.fillStyle = '#f4e7c8';
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 2;
  roundRect(ctx, -5, -24, 10, 24, 4);
  ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(0, -42, 0, -20);
  g.addColorStop(0, theme.flower[0]);
  g.addColorStop(1, theme.flower[1]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -25, 20, 13, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const [x, y, r] of [[-8, -30, 2.5], [4, -34, 2], [10, -28, 1.8]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}

function drawRuin(ctx, theme) {
  ctx.fillStyle = '#a89a7c';
  ctx.strokeStyle = 'rgba(40,25,10,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, -18, -70, 14, 70, 2); ctx.fill(); ctx.stroke();
  roundRect(ctx, 8, -46, 12, 46, 2); ctx.fill(); ctx.stroke();
  roundRect(ctx, -20, -78, 42, 12, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = theme.grass[1];
  ctx.beginPath(); ctx.ellipse(-10, -72, 9, 4, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(14, -47, 7, 3, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,20,0.3)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(-15, -60 + i * 13); ctx.lineTo(-7, -62 + i * 13); ctx.stroke();
  }
}

function drawCactus(ctx, theme) {
  const g = ctx.createLinearGradient(-10, 0, 14, 0);
  g.addColorStop(0, '#3f8f4a');
  g.addColorStop(0.5, '#64b85f');
  g.addColorStop(1, '#2c6b38');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#1d4426';
  ctx.lineWidth = 2;
  roundRect(ctx, -10, -64, 20, 64, 10);
  ctx.fill(); ctx.stroke();
  // arms
  ctx.beginPath();
  ctx.moveTo(-9, -40);
  ctx.quadraticCurveTo(-26, -40, -26, -54);
  ctx.lineTo(-20, -54);
  ctx.quadraticCurveTo(-20, -47, -9, -48);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9, -30);
  ctx.quadraticCurveTo(28, -30, 28, -46);
  ctx.lineTo(22, -46);
  ctx.quadraticCurveTo(22, -38, 9, -38);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // spines
  ctx.strokeStyle = 'rgba(255,240,180,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const y = -10 - i * 9;
    ctx.beginPath(); ctx.moveTo(-9, y); ctx.lineTo(-14, y - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, y - 3); ctx.lineTo(14, y - 5); ctx.stroke();
  }
  ctx.fillStyle = '#ffd36e';
  ctx.beginPath(); ctx.arc(0, -66, 5, 0, TAU); ctx.fill();
}

function drawSkull(ctx) {
  ctx.fillStyle = '#e8dcc0';
  ctx.strokeStyle = '#5b4a32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -16, 16, 15, 0, 0, TAU);
  ctx.fill(); ctx.stroke();
  roundRect(ctx, -9, -6, 18, 10, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3b2c1c';
  ctx.beginPath(); ctx.ellipse(-6, -18, 4.2, 4.8, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6, -18, 4.2, 4.8, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-2.5, -8); ctx.lineTo(2.5, -8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3b2c1c'; ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * 4, -3); ctx.lineTo(i * 4, 1); ctx.stroke();
  }
}

function drawCoral(ctx, theme, time) {
  const sway = Math.sin(time * 1.4) * 0.04;
  ctx.save();
  ctx.rotate(sway);
  ctx.strokeStyle = '#ff7fa8';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(-2, -24, 0, -42);
  ctx.stroke();
  ctx.strokeStyle = '#ff9fbe';
  ctx.lineWidth = 5;
  for (const [dx, dy] of [[-14, -30], [14, -34], [-8, -52], [10, -56]]) {
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(dx * 0.5, -40, dx, dy);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd36e';
  for (const [x, y] of [[-14, -30], [14, -34], [-8, -52], [10, -56], [0, -44]]) {
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawKelp(ctx, theme, time) {
  ctx.strokeStyle = '#2fa87a';
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const ph = time * 1.2 + i * 1.7;
    ctx.lineWidth = 5 - Math.abs(i);
    ctx.beginPath();
    ctx.moveTo(i * 5, 0);
    ctx.bezierCurveTo(i * 5 + Math.sin(ph) * 10, -30, i * 5 - Math.sin(ph) * 12, -60, i * 5 + Math.sin(ph + 1) * 8, -90);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(120,255,200,0.5)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.sin(time + i) * 10, -20 - i * 20, 7, 3, 0.4, 0, TAU);
    ctx.fill();
  }
}

function drawDeadTree(ctx, theme) {
  ctx.strokeStyle = '#1b0d22';
  ctx.lineCap = 'round';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-6, -40, 10, -70, -4, -120);
  ctx.stroke();
  ctx.lineWidth = 6;
  const branches = [[-4, -70, -34, -92], [-2, -84, 26, -104], [0, -52, 26, -66], [-3, -96, -22, -126]];
  for (const [x0, y0, x1, y1] of branches) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 8, (y0 + y1) / 2, x1, y1); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,90,120,0.5)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.arc(-20 + i * 12, -110 + (i % 2) * 8, 2.2, 0, TAU); ctx.fill();
  }
}

function drawCrystal(ctx, time) {
  const glow = 0.6 + Math.sin(time * 2.4) * 0.2;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, -18, 2, 0, -18, 34);
  g.addColorStop(0, `rgba(190,120,255,${0.35 * glow})`);
  g.addColorStop(1, 'rgba(120,40,220,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -18, 34, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const cg = ctx.createLinearGradient(0, -40, 0, 0);
  cg.addColorStop(0, '#e2c6ff');
  cg.addColorStop(0.5, '#a66bff');
  cg.addColorStop(1, '#5b2a9a');
  ctx.fillStyle = cg;
  ctx.strokeStyle = '#2a1240';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -42); ctx.lineTo(12, -14); ctx.lineTo(6, 0); ctx.lineTo(-8, 0); ctx.lineTo(-13, -15); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(4, -14); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
}

/* ------------------------------------------------------------------ */
/* Boss                                                                */
/* ------------------------------------------------------------------ */
export function drawBoss(ctx, boss, time) {
  if (!boss) return;
  const x = boss.x, y = boss.y;
  const hurt = boss.hitFlash > 0;
  ctx.save();
  ctx.translate(x, y);
  const scale = boss.scale || 1;
  ctx.scale(scale, scale);

  // aura
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(0, -40, 10, 0, -40, 140);
  aura.addColorStop(0, boss.vulnerable ? 'rgba(255,150,190,0.35)' : 'rgba(120,40,160,0.28)');
  aura.addColorStop(1, 'rgba(40,10,60,0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(0, -40, 140, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // cape / body
  const bodyGrad = ctx.createLinearGradient(0, -160, 0, 40);
  bodyGrad.addColorStop(0, hurt ? '#ffffff' : '#6b2a8a');
  bodyGrad.addColorStop(0.5, hurt ? '#ffffff' : '#3a1450');
  bodyGrad.addColorStop(1, hurt ? '#ffffff' : '#160820');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#0d0412';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-28, -118);
  ctx.bezierCurveTo(-90, -70, -78, 10, -46, 34);
  ctx.bezierCurveTo(-18, 52, 18, 52, 46, 34);
  ctx.bezierCurveTo(78, 10, 90, -70, 28, -118);
  ctx.bezierCurveTo(10, -132, -10, -132, -28, -118);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // cape tips
  ctx.fillStyle = hurt ? '#fff' : '#2a0f3d';
  for (let i = -2; i <= 2; i++) {
    const sway = Math.sin(time * 2 + i) * 6;
    ctx.beginPath();
    ctx.moveTo(i * 30, 26);
    ctx.quadraticCurveTo(i * 36 + sway, 48, i * 24 + sway, 64);
    ctx.quadraticCurveTo(i * 20 + sway * 0.5, 44, i * 18, 30);
    ctx.closePath();
    ctx.fill();
  }

  // hands
  for (const s of [-1, 1]) {
    const hx = s * 82 + Math.sin(time * 1.6 + s) * 5;
    const hy = -58 + Math.cos(time * 1.6 + s) * 6;
    ctx.fillStyle = hurt ? '#fff' : '#2a0f3d';
    ctx.strokeStyle = '#0d0412';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hx, hy, 18, 22, s * 0.2, 0, TAU);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c9a3e8';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i * 7, hy + 10);
      ctx.lineTo(hx + i * 11, hy + 26);
      ctx.stroke();
    }
  }

  // face
  const faceGrad = ctx.createRadialGradient(0, -104, 4, 0, -104, 44);
  faceGrad.addColorStop(0, hurt ? '#fff' : '#7a3a99');
  faceGrad.addColorStop(1, hurt ? '#fff' : '#240b33');
  ctx.fillStyle = faceGrad;
  ctx.beginPath();
  ctx.ellipse(0, -104, 40, 38, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#0d0412';
  ctx.lineWidth = 3;
  ctx.stroke();

  // eyes
  const eyeGlow = boss.vulnerable ? '#ffd36e' : '#ff5a86';
  ctx.fillStyle = eyeGlow;
  ctx.shadowColor = eyeGlow;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(-15, -108, 8, 11, 0.1, 0, TAU);
  ctx.ellipse(15, -108, 8, 11, -0.1, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a061f';
  ctx.beginPath();
  ctx.ellipse(-14, -107, 3, 5, 0, 0, TAU);
  ctx.ellipse(16, -107, 3, 5, 0, 0, TAU);
  ctx.fill();

  // crown
  ctx.fillStyle = '#ffd45f';
  ctx.strokeStyle = '#7a4a08';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-30, -132);
  ctx.lineTo(-34, -158);
  ctx.lineTo(-18, -146);
  ctx.lineTo(-8, -166);
  ctx.lineTo(2, -146);
  ctx.lineTo(16, -164);
  ctx.lineTo(22, -144);
  ctx.lineTo(36, -154);
  ctx.lineTo(30, -130);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff7aa8';
  ctx.beginPath(); ctx.arc(0, -141, 4, 0, TAU); ctx.fill();

  // weak point
  if (boss.vulnerable) {
    const pulse = 0.75 + Math.sin(time * 8) * 0.25;
    ctx.globalCompositeOperation = 'lighter';
    const wg = ctx.createRadialGradient(0, -42, 2, 0, -42, 36 * pulse);
    wg.addColorStop(0, 'rgba(255,255,220,0.95)');
    wg.addColorStop(0.4, 'rgba(255,170,90,0.55)');
    wg.addColorStop(1, 'rgba(255,100,40,0)');
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(0, -42, 36 * pulse, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe7a3';
    ctx.beginPath(); ctx.arc(0, -42, 10, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -42, 16, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
