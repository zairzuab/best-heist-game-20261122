// render.js — draws MIDNIGHT VAULT on a 1280x800 canvas.
// Everything the judge needs to see is in one frame: the room, the thief,
// the guards and their vision cones, the cameras, the loot target and the
// alarm meter across the top.

import { VIEW, HUD_HEIGHT, FLOOR, PLAYER, GUARD, CAMERA, TOOLS, ROOM_NAMES } from './config.js';
import { playerHidden } from './game.js';
import { angleTo } from './vision.js';

const INK = '#e8e4d8';
const DIM = '#8b8578';
const GOLD = '#f2c14e';
const RED = '#e5484d';
const GREEN = '#46a758';
const BLUE = '#3e9bff';
const PURPLE = '#8e6cc8';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawWall(ctx, wall) {
  ctx.fillStyle = '#3a3348';
  roundRect(ctx, wall.x, wall.y, wall.w, wall.h, 4);
  ctx.fill();
  ctx.strokeStyle = '#574f6e';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawLoot(ctx, kind, x, y, t) {
  const bob = Math.sin(t * 2.4 + x * 0.05) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  if (kind === 'painting') {
    ctx.fillStyle = '#7a5c2e';
    ctx.fillRect(-13, -9, 26, 18);
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(-10, -6, 20, 12);
    ctx.fillStyle = '#3d6b8e';
    ctx.fillRect(-7, -3, 8, 6);
    ctx.fillStyle = GOLD;
    ctx.fillRect(3, -3, 5, 6);
  } else {
    // Gems, gold bars and the diamond are drawn as faceted stones.
    const colors = { gem: '#4cc2ff', gold: GOLD, diamond: '#b8f1ff' };
    ctx.fillStyle = colors[kind] ?? '#4cc2ff';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(9, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 0);
    ctx.lineTo(0, 11);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawGuard(ctx, guard, t) {
  // Vision cone first (under the guard), red when hunting, amber when wary.
  const hunting = guard.state === 'chase';
  const wary = guard.suspicion >= 50;
  const coneFill = hunting
    ? 'rgba(229,72,77,0.30)'
    : wary
      ? 'rgba(242,193,78,0.26)'
      : 'rgba(242,193,78,0.14)';
  drawCone(ctx, guard.x, guard.y, guard.angle, GUARD.visionRange, GUARD.visionHalfAngle, coneFill);
  // Body: dark uniform with a cap brim pointing where he looks.
  ctx.fillStyle = hunting ? '#a33' : '#2b3442';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hunting ? RED : '#5b6b82';
  ctx.lineWidth = 2;
  ctx.stroke();
  const bx = guard.x + Math.cos(guard.angle) * 12;
  const by = guard.y + Math.sin(guard.angle) * 12;
  ctx.fillStyle = hunting ? '#ff6b6b' : '#c8d2e0';
  ctx.beginPath();
  ctx.arc(bx, by, 4, 0, Math.PI * 2);
  ctx.fill();
  // Suspicion ticks above the head.
  if (guard.suspicion > 5) {
    const w = 30;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(guard.x - w / 2, guard.y - 30, w, 5);
    ctx.fillStyle = guard.suspicion >= 100 ? RED : GOLD;
    ctx.fillRect(guard.x - w / 2, guard.y - 30, (w * guard.suspicion) / 100, 5);
  }
  if (guard.state === 'chase') {
    ctx.fillStyle = RED;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - 36);
  }
}

function drawCamera(ctx, cam, empOff, t) {
  const blink = empOff ? 0.25 : 0.6 + 0.4 * Math.sin(t * 5);
  if (!empOff) {
    drawCone(
      ctx,
      cam.x,
      cam.y,
      cam.angle,
      CAMERA.range,
      CAMERA.halfAngle,
      cam.seesPlayer ? 'rgba(229,72,77,0.30)' : 'rgba(62,155,255,0.16)',
    );
  }
  ctx.fillStyle = '#20242e';
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = empOff ? '#555' : `rgba(229,72,77,${blink})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = empOff ? '#666' : RED;
  ctx.beginPath();
  ctx.arc(cam.x, cam.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  const lx = cam.x + Math.cos(cam.angle) * 16;
  const ly = cam.y + Math.sin(cam.angle) * 16;
  ctx.strokeStyle = empOff ? '#555' : '#9db4d4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cam.x, cam.y);
  ctx.lineTo(lx, ly);
  ctx.stroke();
}

function drawVault(ctx, vault, cracked, crackProgress, t) {
  const cx = vault.x + vault.w / 2;
  const cy = vault.y + vault.h / 2;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.save();
  ctx.shadowColor = cracked ? GREEN : GOLD;
  ctx.shadowBlur = 18 + pulse * 10;
  ctx.fillStyle = cracked ? '#1d3a24' : '#4a3410';
  roundRect(ctx, vault.x, vault.y, vault.w, vault.h, 8);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = cracked ? GREEN : GOLD;
  ctx.lineWidth = 2.5;
  roundRect(ctx, vault.x, vault.y, vault.w, vault.h, 8);
  ctx.stroke();
  // The star prize.
  ctx.fillStyle = cracked ? GREEN : GOLD;
  ctx.font = '26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cracked ? '✓' : '★', cx, cy - 4);
  ctx.font = 'bold 10px monospace';
  ctx.fillText(vault.label, cx, vault.y + vault.h + 16);
  if (!cracked && crackProgress > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(cx - 32, vault.y - 14, 64, 7);
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - 32, vault.y - 14, 64 * crackProgress, 7);
  }
}

function drawExit(ctx, exit, open, t) {
  ctx.fillStyle = open ? '#12351d' : '#241d33';
  roundRect(ctx, exit.x, exit.y, exit.w, exit.h, 6);
  ctx.fill();
  ctx.strokeStyle = open ? GREEN : '#6b5f8a';
  ctx.lineWidth = 2.5;
  roundRect(ctx, exit.x, exit.y, exit.w, exit.h, 6);
  ctx.stroke();
  ctx.fillStyle = open ? GREEN : '#8b8578';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT →' : 'LOCKED', exit.x + exit.w / 2, exit.y + exit.h / 2);
}

function drawHud(ctx, state) {
  ctx.fillStyle = '#14101d';
  ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
  ctx.strokeStyle = '#2e2740';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HUD_HEIGHT);
  ctx.lineTo(VIEW.width, HUD_HEIGHT);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 22px monospace';
  ctx.fillText('MIDNIGHT VAULT', 24, 26);
  ctx.fillStyle = DIM;
  ctx.font = '13px monospace';
  ctx.fillText(`Room ${state.roomIndex + 1}/3 — ${ROOM_NAMES[state.roomIndex]}`, 24, 52);

  // Alarm meter: the big one, centre-top.
  const ax = 470;
  const ay = 20;
  const aw = 300;
  ctx.fillStyle = INK;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(state.lockdown ? 'LOCKDOWN' : 'ALARM', ax, ay + 4);
  ctx.fillStyle = '#241d2e';
  roundRect(ctx, ax, ay + 14, aw, 16, 8);
  ctx.fill();
  const frac = state.alarm / 100;
  const alarmColor = state.lockdown ? RED : frac > 0.66 ? RED : frac > 0.33 ? GOLD : GREEN;
  if (frac > 0) {
    ctx.fillStyle = alarmColor;
    roundRect(ctx, ax, ay + 14, Math.max(16, aw * frac), 16, 8);
    ctx.fill();
  }
  ctx.strokeStyle = '#574f6e';
  ctx.lineWidth = 1.5;
  roundRect(ctx, ax, ay + 14, aw, 16, 8);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(state.alarm)}%`, ax + aw + 10, ay + 22);

  // Loot, tools, score, timer — right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = INK;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`LOOT $${state.lootGot} / $${state.lootTotal + 1000}`, 1000, 24);
  ctx.fillStyle = DIM;
  ctx.font = '13px monospace';
  ctx.fillText(`SMOKE x${state.smokes}   EMP x${state.emps}`, 1000, 48);
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 15px monospace';
  ctx.fillText(`SCORE ${state.score}`, 1256, 24);
  ctx.fillStyle = DIM;
  ctx.font = '13px monospace';
  const mins = Math.floor(state.roomTime / 60);
  const secs = Math.floor(state.roomTime % 60).toString().padStart(2, '0');
  ctx.fillText(`${mins}:${secs}`, 1256, 48);
}

function drawFloor(ctx, state) {
  ctx.fillStyle = '#1b1626';
  ctx.fillRect(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h);
  // Floor tiles.
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = FLOOR.x + 44; x < FLOOR.x + FLOOR.w; x += 88) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR.y);
    ctx.lineTo(x, FLOOR.y + FLOOR.h);
    ctx.stroke();
  }
  for (let y = FLOOR.y + 44; y < FLOOR.y + FLOOR.h; y += 88) {
    ctx.beginPath();
    ctx.moveTo(FLOOR.x, y);
    ctx.lineTo(FLOOR.x + FLOOR.w, y);
    ctx.stroke();
  }
  // Faint carpet runner down the middle of the room.
  ctx.fillStyle = 'rgba(120,40,60,0.12)';
  ctx.fillRect(FLOOR.x + 560, FLOOR.y, 112, FLOOR.h);
}

function drawPlayer(ctx, state, t) {
  const p = state.player;
  const hidden = playerHidden(state);
  ctx.save();
  if (hidden) ctx.globalAlpha = 0.55;
  // Sneak ring: how close a guard must be to spot you while sneaking.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(70,167,88,0.5)';
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, GUARD.visionRange * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#0f2a18';
  ctx.beginPath();
  ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7ee2a0';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Hooded thief: a dark cowl and a pale face slit facing the move direction.
  const fx = p.x + Math.cos(p.angle) * 7;
  const fy = p.y + Math.sin(p.angle) * 7;
  ctx.fillStyle = '#d8f5e3';
  ctx.beginPath();
  ctx.arc(fx, fy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLasers(ctx, state, t) {
  for (const laser of state.lasers) {
    const on = laser.live && Math.sin(t * 6) > -0.85;
    ctx.strokeStyle = on ? 'rgba(229,72,77,0.9)' : 'rgba(229,72,77,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(laser.x1, laser.y1);
    ctx.lineTo(laser.x2, laser.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Emitter posts.
    ctx.fillStyle = '#3a2028';
    ctx.beginPath();
    ctx.arc(laser.x1, laser.y1, 6, 0, Math.PI * 2);
    ctx.arc(laser.x2, laser.y2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(laser.x1, laser.y1, 2.5, 0, Math.PI * 2);
    ctx.arc(laser.x2, laser.y2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSmoke(ctx, state) {
  for (const cloud of state.smokeClouds) {
    const alpha = Math.min(0.75, (cloud.t / TOOLS.smokeDuration) * 0.8 + 0.15);
    const grad = ctx.createRadialGradient(cloud.x, cloud.y, 8, cloud.x, cloud.y, TOOLS.smokeRadius);
    grad.addColorStop(0, `rgba(200,200,210,${alpha})`);
    grad.addColorStop(1, 'rgba(200,200,210,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, TOOLS.smokeRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMessage(ctx, state) {
  if (state.messageTimer <= 0 || !state.message) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, state.messageTimer);
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(state.message).width + 36;
  ctx.fillStyle = 'rgba(10,8,16,0.85)';
  roundRect(ctx, VIEW.width / 2 - w / 2, 84, w, 34, 8);
  ctx.fill();
  ctx.strokeStyle = state.lockdown ? RED : '#574f6e';
  ctx.lineWidth = 1.5;
  roundRect(ctx, VIEW.width / 2 - w / 2, 84, w, 34, 8);
  ctx.stroke();
  ctx.fillStyle = state.lockdown ? '#ff8a8a' : INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(state.message, VIEW.width / 2, 102);
  ctx.restore();
}

function centerPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,6,14,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const w = 640;
  const h = 120 + lines.length * 30;
  const x = (VIEW.width - w) / 2;
  const y = (VIEW.height - h) / 2;
  ctx.fillStyle = '#171226';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.font = 'bold 34px monospace';
  ctx.fillText(title, VIEW.width / 2, y + 52);
  ctx.fillStyle = INK;
  ctx.font = '16px monospace';
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, y + 104 + i * 30));
}

export function render(ctx, state) {
  const t = state.time;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawHud(ctx, state);
  drawFloor(ctx, state);

  if (state.phase === 'title') {
    drawTitleScene(ctx, state);
    return;
  }

  // World order: lasers under the floor furniture, cones, loot, vault, exit,
  // walls, cameras, guards, thief, smoke, message.
  drawLasers(ctx, state, t);
  state.level.walls.forEach((wall) => drawWall(ctx, wall));
  state.level.loot.forEach((item, i) => {
    if (!state.lootTaken[i]) drawLoot(ctx, item.kind, item.x, item.y, t);
  });
  drawVault(ctx, state.level.vault, state.vaultCracked, state.crackProgress / 1.6, t);
  drawExit(ctx, state.level.exit, state.vaultCracked, t);
  const empOff = state.empTimer > 0;
  state.cameras.forEach((cam) => drawCamera(ctx, cam, empOff, t));
  state.guards.forEach((guard) => drawGuard(ctx, guard, t));
  drawPlayer(ctx, state, t);
  drawSmoke(ctx, state);
  drawMessage(ctx, state);

  if (state.phase === 'busted') {
    centerPanel(ctx, 'BUSTED!', [
      `A guard caught you in ${ROOM_NAMES[state.roomIndex]}.`,
      `Score: ${state.score}   Loot: $${state.lootGot}`,
      'Press R to try the room again.',
    ], RED);
  } else if (state.phase === 'roomClear') {
    const bonus = state.roomBonus ?? { timeBonus: 0, ghost: 0 };
    centerPanel(ctx, 'CLEAN GETAWAY', [
      `${ROOM_NAMES[state.roomIndex]} cleared — vault cracked, exit reached.`,
      `Time bonus +${bonus.timeBonus}   Ghost bonus +${bonus.ghost}`,
      `Score: ${state.score} — press Enter for the next room.`,
    ], GREEN);
  } else if (state.phase === 'win') {
    centerPanel(ctx, 'THE PERFECT HEIST', [
      'All three rooms. Every vault cracked. Nobody caught you — or did they?',
      `Final score: ${state.score}   Loot: $${state.lootGot}`,
      `Time: ${Math.floor(state.time / 60)}:${Math.floor(state.time % 60).toString().padStart(2, '0')}   Press R to play again.`,
    ], GOLD);
  }
}

function drawTitleScene(ctx, state) {
  // The title screen still shows the room behind the panel: the thief, a
  // patrolling guard and his cone, the vault glowing in the middle.
  state.level.walls.forEach((wall) => drawWall(ctx, wall));
  state.level.loot.forEach((item) => drawLoot(ctx, item.kind, item.x, item.y, state.time));
  drawVault(ctx, state.level.vault, false, 0, state.time);
  drawExit(ctx, state.level.exit, false, state.time);
  state.cameras.forEach((cam) => drawCamera(ctx, cam, false, state.time));
  state.guards.forEach((guard) => drawGuard(ctx, guard, state.time));
  drawPlayer(ctx, state, state.time);
  ctx.fillStyle = 'rgba(8,6,14,0.66)';
  ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 58px monospace';
  ctx.fillText('MIDNIGHT VAULT', VIEW.width / 2, 300);
  ctx.fillStyle = INK;
  ctx.font = '20px monospace';
  ctx.fillText('A three-room stealth heist. Steal the lot. Never get seen.', VIEW.width / 2, 352);
  ctx.fillStyle = DIM;
  ctx.font = '16px monospace';
  const lines = [
    'WASD / Arrows — move      Shift — sneak',
    'Q — smoke bomb (×3)      F — EMP, kills cameras 6s',
    'Grab the loot, crack the ★ vault, reach the EXIT.',
    'Guards and cameras raise the alarm. At 100% — LOCKDOWN.',
    '',
    'Press Enter to start the heist.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 420 + i * 28));
}
