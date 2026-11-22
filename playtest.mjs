// playtest.mjs — headless logic playtest for MIDNIGHT VAULT.
// Drives the pure game logic in Node (no browser): movement, walls, guard
// patrols and vision, cameras, alarm, lockdown, loot, vault cracking, the
// win path, and determinism. Exits non-zero on the first failure.
//
// Usage: node playtest.mjs

import { createGame, startRoom, nextRoom, update, stateHash, playerHidden } from './game/src/game.js';
import { LEVELS } from './game/src/levels.js';
import { inVisionCone, hasLineOfSight, circleHitsAnyWall } from './game/src/vision.js';

const STEP = 1 / 60;
let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

function drive(state, keys, seconds) {
  const frames = Math.round(seconds / STEP);
  for (let i = 0; i < frames; i++) {
    update(state, keys, STEP);
    if (state.phase !== 'playing') break;
  }
  return state;
}

function fresh(room = 0) {
  const s = createGame(room);
  startRoom(s);
  return s;
}

// 1. The thief moves, and walls stop them.
{
  const s = fresh();
  const x0 = s.player.x;
  drive(s, { right: true }, 1);
  check('player moves right', s.player.x > x0 + 100, `x ${x0} -> ${s.player.x}`);
  const s2 = fresh();
  s2.player.x = 60;
  s2.player.y = 300;
  drive(s2, { left: true }, 1);
  check('west wall blocks the thief', s2.player.x >= 40, `x=${s2.player.x}`);
  check('a point inside a wall collides', circleHitsAnyWall(30, 300, 14, s.level.walls) !== null);
  check('open floor does not collide', circleHitsAnyWall(640, 480, 14, s.level.walls) === null);
}

// 2. Sneak is slower than walking.
{
  const a = fresh();
  drive(a, { right: true }, 1);
  const b = fresh();
  drive(b, { right: true, sneak: true }, 1);
  check('sneaking is slower', b.player.x < a.player.x, `walk ${a.player.x} sneak ${b.player.x}`);
}

// 3. Guards patrol: they move between waypoints.
{
  const s = fresh();
  const g = s.guards[0];
  const x0 = g.x;
  const y0 = g.y;
  drive(s, {}, 3);
  check('guard patrols', Math.hypot(g.x - x0, g.y - y0) > 30, `moved ${Math.hypot(g.x - x0, g.y - y0).toFixed(1)}px`);
}

// 4. Vision cone: a guard sees the thief standing in front of him.
{
  const s = fresh();
  const g = s.guards[0];
  s.player.x = g.x + 100;
  s.player.y = g.y;
  g.angle = 0;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  drive(s, {}, 0.5);
  check('guard spots thief in cone', g.suspicion > 20, `suspicion=${g.suspicion.toFixed(1)}`);
}

// 5. A wall between guard and thief blocks the sight line.
{
  const s = fresh(1);
  const wall = s.level.walls.find((w) => w.w > 100 && w.h < 40);
  const g = s.guards[0];
  g.x = wall.x + wall.w / 2;
  g.y = wall.y - 60;
  g.angle = Math.PI / 2;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  s.player.x = g.x;
  s.player.y = wall.y + wall.h + 60;
  const seen = inVisionCone(g, s.player, 200, 0.61, s.level.walls);
  check('wall blocks vision cone', seen === false);
  check('line of sight is blocked', hasLineOfSight(g.x, g.y, s.player.x, s.player.y, s.level.walls) === false);
}

// 6. Suspicion decays once the thief breaks line of sight.
{
  const s = fresh();
  const g = s.guards[0];
  s.player.x = g.x + 100;
  s.player.y = g.y;
  g.angle = 0;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  drive(s, {}, 0.5);
  const peak = g.suspicion;
  s.player.x = 90;
  s.player.y = 700;
  drive(s, {}, 2);
  check('suspicion decays out of sight', g.suspicion < peak - 20, `${peak.toFixed(1)} -> ${g.suspicion.toFixed(1)}`);
}

// 7. A spotted thief raises the alarm; it falls again when hidden.
{
  const s = fresh();
  const g = s.guards[0];
  s.player.x = g.x + 80;
  s.player.y = g.y;
  g.angle = 0;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  drive(s, {}, 1.5);
  check('alarm climbs while seen', s.alarm > 15, `alarm=${s.alarm.toFixed(1)}`);
  const peak = s.alarm;
  s.player.x = 90;
  s.player.y = 700;
  drive(s, {}, 10);
  check('alarm falls when hidden', s.alarm < peak - 5 && s.alarm < 8, `peak=${peak.toFixed(1)} alarm=${s.alarm.toFixed(1)}`);
}

// 8. Alarm at 100 means LOCKDOWN and every guard chases.
{
  const s = fresh();
  s.alarm = 99;
  const g = s.guards[0];
  s.player.x = g.x + 80;
  s.player.y = g.y;
  g.angle = 0;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  drive(s, {}, 1.5);
  check('lockdown triggers at 100 alarm', s.lockdown === true, `alarm=${s.alarm.toFixed(1)}`);
  check('lockdown sends guards chasing', s.guards.every((guard) => guard.state === 'chase'));
}

// 9. A chasing guard that reaches the thief busts the heist.
{
  const s = fresh();
  const g = s.guards[0];
  g.state = 'chase';
  g.suspicion = 100;
  g.lastSeenX = s.player.x;
  g.lastSeenY = s.player.y;
  g.x = s.player.x + 60;
  g.y = s.player.y;
  drive(s, {}, 1);
  check('caught by a guard ends the run', s.phase === 'busted', `phase=${s.phase}`);
}

// 10. Smoke hides the thief from a guard's cone.
{
  const s = fresh();
  const g = s.guards[0];
  s.player.x = g.x + 100;
  s.player.y = g.y;
  g.angle = 0;
  g.waypoints = [{ x: g.x, y: g.y }];
  g.waypointIndex = 0;
  update(s, { smoke: true }, STEP);
  check('smoke bomb is spent', s.smokes === 2);
  check('thief hidden inside smoke', playerHidden(s));
  const before = g.suspicion;
  drive(s, {}, 1);
  check('smoke blocks suspicion', g.suspicion <= before + 1, `suspicion=${g.suspicion.toFixed(1)}`);
}

// 11. EMP switches the cameras off.
{
  const s = fresh();
  update(s, { emp: true }, STEP);
  check('EMP is spent', s.emps === 1);
  check('EMP timer runs', s.empTimer > 5);
  drive(s, {}, 1);
  check('cameras blind during EMP', s.cameras.every((c) => c.seesPlayer === false));
}

// 12. Loot is pocketed by walking over it.
{
  const s = fresh();
  const item = s.level.loot[0];
  s.player.x = item.x;
  s.player.y = item.y;
  const before = s.score;
  drive(s, {}, 0.1);
  check('loot is collected', s.lootTaken[0] === true && s.score > before, `score ${before} -> ${s.score}`);
}

// 13. The vault cracks after standing in its glow, then the exit opens.
{
  const s = fresh();
  const v = s.level.vault;
  s.player.x = v.x + v.w / 2;
  s.player.y = v.y + v.h + 40;
  drive(s, {}, 2);
  check('vault cracks', s.vaultCracked === true, `progress=${s.crackProgress.toFixed(2)}`);
  check('vault pays 1000', s.score >= 1000);
  const e = s.level.exit;
  s.player.x = e.x + e.w / 2;
  s.player.y = e.y + e.h / 2;
  drive(s, {}, 0.1);
  check('exit ends the room', s.phase === 'roomClear', `phase=${s.phase}`);
}

// 14. Trip lasers trip the alarm (Penthouse).
{
  const s = fresh(2);
  check('penthouse has trip lasers', s.lasers.length === 2);
  const laser = s.lasers[0];
  s.player.x = (laser.x1 + laser.x2) / 2;
  s.player.y = laser.y1 - 30;
  const before = s.alarm;
  drive(s, { down: true }, 0.5);
  check('crossing a laser trips the alarm', s.alarm > before + 20, `${before} -> ${s.alarm.toFixed(1)}`);
}

// 15. The full win path: crack the vault and exit in all three rooms.
{
  let s = fresh();
  for (let room = 0; room < 3; room++) {
    const v = s.level.vault;
    s.player.x = v.x + v.w / 2;
    s.player.y = v.y + v.h + 40;
    drive(s, {}, 2);
    const e = s.level.exit;
    s.player.x = e.x + e.w / 2;
    s.player.y = e.y + e.h / 2;
    drive(s, {}, 0.1);
    if (room < 2) {
      check(`room ${room + 1} clears`, s.phase === 'roomClear', `phase=${s.phase}`);
      s = nextRoom(s);
    } else {
      check('room 3 wins the heist', s.phase === 'win', `phase=${s.phase}`);
    }
  }
  check('win path scores', s.score > 3000, `score=${s.score}`);
}

// 16. Determinism: the same scripted run hashes the same twice.
{
  function runScript() {
    const s = fresh();
    drive(s, { right: true, down: true }, 1.5);
    drive(s, { right: true }, 1);
    drive(s, { down: true, sneak: true }, 1);
    drive(s, {}, 2);
    return stateHash(s);
  }
  const h1 = runScript();
  const h2 = runScript();
  check('identical runs hash identically', h1 === h2, `${h1} vs ${h2}`);
}

// 17. Every level has a vault, an exit, loot and at least one guard.
{
  LEVELS.forEach((level, i) => {
    check(
      `room ${i + 1} is complete`,
      level.loot.length >= 6 && level.guards.length >= 2 && level.cameras.length >= 1 && !!level.vault && !!level.exit,
      `${level.name}: loot ${level.loot.length}, guards ${level.guards.length}, cameras ${level.cameras.length}`,
    );
  });
}

// 18. Guards never walk through walls on patrol (sampled).
{
  const s = fresh(1);
  let throughWall = false;
  for (let i = 0; i < 60 * 20; i++) {
    update(s, {}, STEP);
    for (const g of s.guards) {
      if (circleHitsAnyWall(g.x, g.y, 12, s.level.walls)) throughWall = true;
    }
    if (s.phase !== 'playing') break;
  }
  check('guards stay out of walls (20s patrol)', !throughWall);
}

console.log(`\nplaytest: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
