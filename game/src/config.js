// config.js — tuning constants for MIDNIGHT VAULT, a top-down stealth heist.
// One screen, one room: the thief, the guards, their vision cones, the cameras,
// the loot and the alarm meter are all visible in a single frame.

export const VIEW = { width: 1280, height: 800 };
export const HUD_HEIGHT = 72;
// Playfield is the floor below the HUD bar.
export const FLOOR = { x: 24, y: HUD_HEIGHT + 16, w: 1232, h: 688 };

export const PLAYER = {
  radius: 14,
  walkSpeed: 205, // px per second
  sneakSpeed: 105,
  crackTime: 1.6, // seconds standing at the vault to crack it
  catchRadius: 18,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  chaseSpeed: 165,
  visionRange: 200,
  visionHalfAngle: 0.61, // ~35 degrees each side
  suspicionRise: 70, // per second while the thief is in the cone
  suspicionFall: 26,
  chaseMemory: 3.0, // seconds a guard keeps chasing after losing sight
  sneakRangeFactor: 0.62, // sneaking shrinks how far a guard can spot you
  sneakRiseFactor: 0.55,
};

export const CAMERA = {
  range: 235,
  halfAngle: 0.49, // ~28 degrees each side
  sweepSpeed: 0.55, // radians per second
  alarmRise: 26, // alarm points per second while a camera sees the thief
};

export const ALARM = {
  risePerSecond: 20, // while any guard is suspicious (suspicion >= 50)
  fallPerSecond: 7,
  lockdownAt: 100,
  lockdownDecay: 2.5,
};

export const TOOLS = {
  smokeStart: 3,
  empStart: 2,
  smokeRadius: 95,
  smokeDuration: 5,
  empDuration: 6,
};

export const LOOT_VALUES = { gem: 150, painting: 250, gold: 300, diamond: 500 };
export const VAULT_VALUE = 1000;
export const GHOST_BONUS = 1500; // finishing a room never spotted
export const TIME_BONUS_PER_SECOND = 12; // under the par time

export const ROOM_NAMES = ['The Gallery', 'The Vault Floor', 'The Penthouse'];
export const ROOM_PAR_SECONDS = [75, 95, 110];

// Deterministic seed per room so every run plays the same way.
export function roomSeed(roomIndex) {
  return 0x9e3779b9 + roomIndex * 7919;
}

// mulberry32 — tiny deterministic RNG for guard wobble and sparkle.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const HELP_LINES = [
  'WASD / Arrows — move    Shift — sneak (harder to spot)',
  'Q — smoke bomb    F — EMP (kills cameras for 6s)',
  'Grab every loot, crack the star vault, then slip out the exit.',
  'Seen by a guard or camera? The alarm climbs. At 100% — LOCKDOWN.',
];
