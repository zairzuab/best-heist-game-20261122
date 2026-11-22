// game.js — the heist itself: state, update loop, guards, cameras, alarm, tools.
// Pure logic (no DOM, no canvas): the browser main loop and the headless
// playtest both drive it through createGame() + update().

import {
  PLAYER,
  GUARD,
  CAMERA,
  ALARM,
  TOOLS,
  LOOT_VALUES,
  VAULT_VALUE,
  GHOST_BONUS,
  TIME_BONUS_PER_SECOND,
  ROOM_PAR_SECONDS,
  roomSeed,
  makeRng,
} from './config.js';
import { LEVELS, roomLootTotal } from './levels.js';
import {
  dist,
  clamp,
  angleTo,
  angleDiff,
  hasLineOfSight,
  inVisionCone,
  circleHitsAnyWall,
  segmentsTouch,
} from './vision.js';

export const PHASES = ['title', 'playing', 'roomClear', 'busted', 'win'];

export function createGame(roomIndex = 0) {
  const level = LEVELS[roomIndex];
  const rng = makeRng(roomSeed(roomIndex));
  return {
    phase: 'title',
    roomIndex,
    level,
    time: 0,
    roomTime: 0,
    score: 0,
    lootGot: 0,
    lootTotal: roomLootTotal(level),
    lootTaken: level.loot.map(() => false),
    vaultCracked: false,
    crackProgress: 0,
    alarm: 0,
    lockdown: false,
    lockdownTimer: 0,
    spotted: false, // set true the first time any guard/camera sees the thief
    everSpotted: false,
    smokes: TOOLS.smokeStart,
    emps: TOOLS.empStart,
    smokeClouds: [], // {x, y, t}
    empTimer: 0,
    laserTripped: false,
    laserCooldown: 0,
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      angle: -Math.PI / 2,
      moving: false,
      sneaking: false,
    },
    guards: level.guards.map((g) => ({
      x: g.waypoints[0].x,
      y: g.waypoints[0].y,
      angle: g.angle,
      waypoints: g.waypoints,
      waypointIndex: 1,
      waitTimer: 0,
      suspicion: 0,
      state: 'patrol', // patrol | suspicious | chase | return
      chaseTimer: 0,
      lastSeenX: 0,
      lastSeenY: 0,
      wobble: rng() * Math.PI * 2,
    })),
    cameras: level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      angle: c.baseAngle,
      sweepPhase: rng() * Math.PI * 2,
      seesPlayer: false,
    })),
    lasers: level.lasers.map((l) => ({ ...l, live: true })),
    message: '',
    messageTimer: 0,
    rng,
  };
}

export function startRoom(state) {
  state.phase = 'playing';
  state.message = state.level.intro;
  state.messageTimer = 4;
}

export function nextRoom(state) {
  const carried = state.score;
  const next = createGame(state.roomIndex + 1);
  next.score = carried;
  next.phase = 'playing';
  next.message = next.level.intro;
  next.messageTimer = 4;
  return next;
}

function setMessage(state, text, seconds = 2.5) {
  state.message = text;
  state.messageTimer = seconds;
}

// Is the thief hidden inside a smoke cloud right now?
export function playerHidden(state) {
  for (const cloud of state.smokeClouds) {
    if (dist(state.player.x, state.player.y, cloud.x, cloud.y) < TOOLS.smokeRadius) return true;
  }
  return false;
}

function moveWithWalls(state, entity, dx, dy, radius) {
  // Axis-separated movement so the thief slides along walls instead of sticking.
  const walls = state.level.walls;
  const nx = entity.x + dx;
  if (!circleHitsAnyWall(nx, entity.y, radius, walls)) entity.x = nx;
  const ny = entity.y + dy;
  if (!circleHitsAnyWall(entity.x, ny, radius, walls)) entity.y = ny;
  entity.x = clamp(entity.x, 40, 1240);
  entity.y = clamp(entity.y, 104, 760);
}

function updatePlayer(state, input, dt) {
  const p = state.player;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = dx !== 0 || dy !== 0;
  p.sneaking = !!input.sneak;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const speed = p.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    p.angle = Math.atan2(dy, dx);
    moveWithWalls(state, p, dx * speed * dt, dy * speed * dt, PLAYER.radius);
  }

  // Tools: edge-triggered by the input layer.
  if (input.smoke && state.smokes > 0) {
    state.smokes -= 1;
    state.smokeClouds.push({ x: p.x, y: p.y, t: TOOLS.smokeDuration });
    setMessage(state, 'Smoke out — they cannot see through it.');
  }
  if (input.emp && state.emps > 0 && state.empTimer <= 0) {
    state.emps -= 1;
    state.empTimer = TOOLS.empDuration;
    setMessage(state, 'EMP burst — cameras dead for 6 seconds.');
  }
  state.smokeClouds = state.smokeClouds.filter((c) => (c.t -= dt) > 0);
  if (state.empTimer > 0) state.empTimer -= dt;

  // Loot: walking over it pockets it.
  state.level.loot.forEach((item, i) => {
    if (state.lootTaken[i]) return;
    if (dist(p.x, p.y, item.x, item.y) < 30) {
      state.lootTaken[i] = true;
      const value = LOOT_VALUES[item.kind] ?? 100;
      state.score += value;
      state.lootGot += value;
      setMessage(state, `+${value} — ${item.kind} pocketed.`);
    }
  });

  // The star vault: stand in its glow to crack it.
  const v = state.level.vault;
  const vaultCx = v.x + v.w / 2;
  const vaultCy = v.y + v.h / 2;
  if (!state.vaultCracked && dist(p.x, p.y, vaultCx, vaultCy) < 80) {
    state.crackProgress += dt;
    if (state.crackProgress >= PLAYER.crackTime) {
      state.vaultCracked = true;
      state.score += VAULT_VALUE;
      state.lootGot += VAULT_VALUE;
      setMessage(state, `${v.label} CRACKED — get to the exit!`, 3.5);
    }
  } else {
    state.crackProgress = Math.max(0, state.crackProgress - dt * 2);
  }

  // Exit opens once the vault is cracked.
  const e = state.level.exit;
  if (state.vaultCracked && p.x > e.x - 6 && p.x < e.x + e.w + 6 && p.y > e.y - 6 && p.y < e.y + e.h + 6) {
    const timeBonus = Math.max(
      0,
      Math.round((ROOM_PAR_SECONDS[state.roomIndex] - state.roomTime) * TIME_BONUS_PER_SECOND),
    );
    const ghost = state.everSpotted ? 0 : GHOST_BONUS;
    state.score += timeBonus + ghost;
    state.roomBonus = { timeBonus, ghost };
    state.phase = state.roomIndex >= LEVELS.length - 1 ? 'win' : 'roomClear';
  }
}

function updateGuards(state, dt) {
  const p = state.player;
  const hidden = playerHidden(state);
  for (const g of state.guards) {
    const range = GUARD.visionRange * (p.sneaking ? GUARD.sneakRangeFactor : 1);
    const rise = GUARD.suspicionRise * (p.sneaking ? GUARD.sneakRiseFactor : 1);
    const sees =
      !hidden &&
      inVisionCone(g, p, range, GUARD.visionHalfAngle, state.level.walls);
    if (sees) {
      g.suspicion = clamp(g.suspicion + rise * dt, 0, 100);
      g.lastSeenX = p.x;
      g.lastSeenY = p.y;
      g.chaseTimer = GUARD.chaseMemory;
      if (!state.spotted) {
        state.spotted = true;
        state.everSpotted = true;
        setMessage(state, 'SPOTTED! Break line of sight!');
      }
    } else {
      g.suspicion = clamp(g.suspicion - GUARD.suspicionFall * dt, 0, 100);
      if (g.chaseTimer > 0) g.chaseTimer -= dt;
    }

    if (state.lockdown) {
      g.state = 'chase';
      g.lastSeenX = p.x;
      g.lastSeenY = p.y;
    } else if (sees && g.suspicion >= 100) {
      g.state = 'chase';
    } else if (g.state === 'chase') {
      // Keep hunting while the trail is fresh or the guard is still sure;
      // only give up once both the memory and the suspicion have faded.
      if (g.chaseTimer <= 0 && g.suspicion < 50) g.state = 'return';
    } else if (g.suspicion >= 50) {
      g.state = 'suspicious';
    } else if (g.state === 'suspicious' && g.suspicion <= 5) {
      g.state = 'patrol';
    }

    // Movement by state.
    if (g.state === 'chase') {
      const targetX = state.lockdown ? p.x : g.lastSeenX;
      const targetY = state.lockdown ? p.y : g.lastSeenY;
      const d = dist(g.x, g.y, targetX, targetY);
      if (d > 4) {
        const step = (GUARD.chaseSpeed * dt) / d;
        const nx = g.x + (targetX - g.x) * step;
        const ny = g.y + (targetY - g.y) * step;
        moveWithWalls(state, g, nx - g.x, ny - g.y, GUARD.radius);
        g.angle = angleTo(g.x, g.y, targetX, targetY);
      }
      if (!state.lockdown && d < 8) g.state = 'return';
    } else if (g.state === 'return') {
      const home = g.waypoints[g.waypointIndex];
      const d = dist(g.x, g.y, home.x, home.y);
      if (d < 10) {
        g.state = 'patrol';
      } else {
        const step = (GUARD.patrolSpeed * dt) / d;
        const nx = g.x + (home.x - g.x) * step;
        const ny = g.y + (home.y - g.y) * step;
        moveWithWalls(state, g, nx - g.x, ny - g.y, GUARD.radius);
        g.angle = angleTo(g.x, g.y, home.x, home.y);
      }
    } else {
      // Patrol: walk the waypoint loop, pausing and looking around at each stop.
      const target = g.waypoints[g.waypointIndex];
      const d = dist(g.x, g.y, target.x, target.y);
      if (g.waitTimer > 0) {
        g.waitTimer -= dt;
        // Scan: slow head turn while waiting.
        g.angle += Math.sin(state.time * 1.4 + g.wobble) * 0.35 * dt;
      } else if (d < 8) {
        g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
        g.waitTimer = 1.2;
      } else {
        const step = (GUARD.patrolSpeed * dt) / d;
        const nx = g.x + (target.x - g.x) * step;
        const ny = g.y + (target.y - g.y) * step;
        moveWithWalls(state, g, nx - g.x, ny - g.y, GUARD.radius);
        g.angle = angleTo(g.x, g.y, target.x, target.y);
      }
    }

    // Caught: a chasing guard reaches the thief.
    if (g.state === 'chase' && dist(g.x, g.y, p.x, p.y) < PLAYER.catchRadius + 4) {
      state.phase = 'busted';
      state.bustedBy = 'guard';
      return;
    }
  }
}

function updateCameras(state, dt) {
  const p = state.player;
  const hidden = playerHidden(state);
  const empOff = state.empTimer > 0;
  for (const cam of state.cameras) {
    cam.angle = cam.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed + cam.sweepPhase) * cam.sweep;
    cam.seesPlayer =
      !empOff &&
      !hidden &&
      inVisionCone(cam, p, CAMERA.range, CAMERA.halfAngle, state.level.walls);
    if (cam.seesPlayer && !state.spotted) {
      state.spotted = true;
      state.everSpotted = true;
      setMessage(state, 'Camera has you! Move!');
    }
  }
}

function updateLasers(state, dt, prevX, prevY) {
  if (state.laserCooldown > 0) state.laserCooldown -= dt;
  const p = state.player;
  for (const laser of state.lasers) {
    if (!laser.live || state.laserCooldown > 0) continue;
    // Trip when the thief's step crosses the beam.
    if (segmentsTouch(prevX, prevY, p.x, p.y, laser.x1, laser.y1, laser.x2, laser.y2)) {
      state.alarm = clamp(state.alarm + 45, 0, 100);
      state.laserTripped = true;
      state.laserCooldown = 2;
      state.everSpotted = true;
      setMessage(state, 'TRIP LASER! The alarm screams.', 3);
    }
  }
}

function updateAlarm(state, dt) {
  const anySuspicious = state.guards.some((g) => g.suspicion >= 50);
  const anyCamera = state.cameras.some((c) => c.seesPlayer);
  if (state.lockdown) {
    state.alarm = clamp(state.alarm - ALARM.lockdownDecay * dt, 0, 100);
    if (state.alarm < 60) {
      state.lockdown = false;
      setMessage(state, 'Lockdown lifted — but they are still hunting.');
    }
    return;
  }
  let delta = -ALARM.fallPerSecond;
  if (anySuspicious) delta = ALARM.risePerSecond;
  if (anyCamera) delta += CAMERA.alarmRise;
  state.alarm = clamp(state.alarm + delta * dt, 0, 100);
  if (state.alarm >= ALARM.lockdownAt) {
    state.lockdown = true;
    state.lockdownTimer = 0;
    setMessage(state, 'LOCKDOWN! Every guard is coming for you.', 3.5);
  }
}

// One fixed step. Input: {up,down,left,right,sneak,smoke,emp} (smoke/emp are edges).
export function update(state, input, dt) {
  if (state.phase !== 'playing') return state;
  const prevX = state.player.x;
  const prevY = state.player.y;
  state.time += dt;
  state.roomTime += dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.lockdown) state.lockdownTimer += dt;

  updatePlayer(state, input, dt);
  if (state.phase !== 'playing') return state;
  updateGuards(state, dt);
  if (state.phase !== 'playing') return state;
  updateCameras(state, dt);
  updateLasers(state, dt, prevX, prevY);
  updateAlarm(state, dt);
  return state;
}

// Deterministic fingerprint of the whole state, for the playtest.
export function stateHash(state) {
  const parts = [
    state.phase,
    Math.round(state.player.x * 100),
    Math.round(state.player.y * 100),
    Math.round(state.alarm * 100),
    state.score,
    state.lootGot,
    state.vaultCracked ? 1 : 0,
    ...state.guards.map((g) => `${Math.round(g.x * 10)},${Math.round(g.y * 10)},${Math.round(g.suspicion)}`),
    ...state.cameras.map((c) => Math.round(c.angle * 1000)),
  ];
  let hash = 5381;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash;
}
