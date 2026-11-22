// levels.js — the three rooms of MIDNIGHT VAULT.
// Each room is a floor plan: walls (cover and sight blockers), guard patrols,
// sweeping cameras, loot, trip lasers (Penthouse) and the star vault.
// Coordinates are canvas pixels; the playfield is x 24..1256, y 88..776.

import { FLOOR } from './config.js';

const F = FLOOR;
// Outer walls, shared by every room: thick border around the floor.
function borderWalls() {
  return [
    { x: F.x, y: F.y, w: F.w, h: 14 },
    { x: F.x, y: F.y + F.h - 14, w: F.w, h: 14 },
    { x: F.x, y: F.y, w: 14, h: F.h },
    { x: F.x + F.w - 14, y: F.y, w: 14, h: F.h },
  ];
}

// A display case / pillar block: solid cover the thief can hide behind.
function block(x, y, w, h) {
  return { x, y, w, h };
}

export const LEVELS = [
  {
    name: 'The Gallery',
    intro: 'Opening night. Two guards, one camera, and the Star Sapphire on its plinth.',
    par: 75,
    playerStart: { x: 90, y: 700 },
    exit: { x: 1150, y: 700, w: 64, h: 56 },
    vault: { x: 610, y: 300, w: 60, h: 60, label: 'STAR SAPPHIRE' },
    walls: [
      ...borderWalls(),
      block(250, 180, 180, 26), // display case row, north-west
      block(560, 180, 180, 26),
      block(870, 180, 180, 26),
      block(250, 560, 180, 26), // display case row, south
      block(870, 560, 180, 26),
      block(560, 420, 170, 26), // central plinth cover
      block(180, 330, 26, 130), // west pillar
      block(1070, 330, 26, 130), // east pillar
    ],
    loot: [
      { x: 340, y: 150, kind: 'painting' },
      { x: 650, y: 150, kind: 'painting' },
      { x: 960, y: 150, kind: 'painting' },
      { x: 340, y: 620, kind: 'gem' },
      { x: 960, y: 620, kind: 'gem' },
      { x: 120, y: 400, kind: 'gem' },
      { x: 1160, y: 400, kind: 'gem' },
    ],
    guards: [
      {
        waypoints: [
          { x: 300, y: 300 },
          { x: 640, y: 300 },
          { x: 980, y: 300 },
          { x: 640, y: 300 },
        ],
        angle: 0,
      },
      {
        waypoints: [
          { x: 980, y: 500 },
          { x: 640, y: 500 },
          { x: 300, y: 500 },
          { x: 640, y: 500 },
        ],
        angle: Math.PI,
      },
    ],
    cameras: [{ x: 640, y: 110, baseAngle: Math.PI / 2, sweep: 0.9 }],
    lasers: [],
  },
  {
    name: 'The Vault Floor',
    intro: 'Gold behind steel. Three guards, two cameras — the vault door is the prize.',
    par: 95,
    playerStart: { x: 90, y: 700 },
    exit: { x: 1150, y: 130, w: 64, h: 56 },
    vault: { x: 610, y: 380, w: 70, h: 70, label: 'GOLD VAULT' },
    walls: [
      ...borderWalls(),
      block(220, 160, 26, 220), // vault-door pillars, west
      block(1030, 160, 26, 220),
      block(220, 480, 26, 220),
      block(1030, 480, 26, 220),
      block(420, 240, 200, 26), // north gold racks
      block(660, 240, 200, 26),
      block(420, 560, 200, 26), // south gold racks
      block(660, 560, 200, 26),
      block(600, 330, 80, 26), // vault antechamber lip
    ],
    loot: [
      { x: 320, y: 150, kind: 'gold' },
      { x: 960, y: 150, kind: 'gold' },
      { x: 320, y: 680, kind: 'gold' },
      { x: 960, y: 680, kind: 'gold' },
      { x: 480, y: 400, kind: 'gem' },
      { x: 800, y: 400, kind: 'gem' },
      { x: 640, y: 150, kind: 'painting' },
      { x: 640, y: 680, kind: 'painting' },
    ],
    guards: [
      {
        waypoints: [
          { x: 350, y: 300 },
          { x: 640, y: 280 },
          { x: 930, y: 300 },
          { x: 640, y: 280 },
        ],
        angle: 0,
      },
      {
        waypoints: [
          { x: 930, y: 520 },
          { x: 640, y: 540 },
          { x: 350, y: 520 },
          { x: 640, y: 540 },
        ],
        angle: Math.PI,
      },
      {
        waypoints: [
          { x: 640, y: 150 },
          { x: 640, y: 650 },
        ],
        angle: Math.PI / 2,
      },
    ],
    cameras: [
      { x: 320, y: 110, baseAngle: Math.PI / 2, sweep: 0.7 },
      { x: 960, y: 750, baseAngle: -Math.PI / 2, sweep: 0.7 },
    ],
    lasers: [],
  },
  {
    name: 'The Penthouse',
    intro: 'The Diamond, behind trip lasers. One wrong step and the whole floor wakes up.',
    par: 110,
    playerStart: { x: 90, y: 130 },
    exit: { x: 1150, y: 700, w: 64, h: 56 },
    vault: { x: 610, y: 380, w: 70, h: 70, label: 'THE DIAMOND' },
    walls: [
      ...borderWalls(),
      block(300, 200, 26, 180), // lounge dividers
      block(950, 200, 26, 180),
      block(300, 480, 26, 180),
      block(950, 480, 26, 180),
      block(480, 180, 320, 26), // penthouse bar
      block(480, 620, 320, 26),
      block(600, 330, 80, 26),
    ],
    loot: [
      { x: 200, y: 150, kind: 'diamond' },
      { x: 1080, y: 150, kind: 'diamond' },
      { x: 200, y: 680, kind: 'gem' },
      { x: 1080, y: 680, kind: 'gem' },
      { x: 400, y: 400, kind: 'painting' },
      { x: 880, y: 400, kind: 'painting' },
      { x: 640, y: 250, kind: 'gold' },
      { x: 640, y: 560, kind: 'gold' },
    ],
    guards: [
      {
        waypoints: [
          { x: 350, y: 280 },
          { x: 930, y: 280 },
          { x: 930, y: 520 },
          { x: 350, y: 520 },
        ],
        angle: 0,
      },
      {
        waypoints: [
          { x: 640, y: 120 },
          { x: 640, y: 700 },
        ],
        angle: Math.PI / 2,
      },
      {
        waypoints: [
          { x: 200, y: 400 },
          { x: 480, y: 400 },
          { x: 200, y: 400 },
        ],
        angle: 0,
      },
    ],
    cameras: [
      { x: 640, y: 110, baseAngle: Math.PI / 2, sweep: 0.8 },
      { x: 120, y: 400, baseAngle: 0, sweep: 0.6 },
    ],
    // Trip lasers: crossing a live beam trips the alarm. Beams run between two posts.
    lasers: [
      { x1: 340, y1: 440, x2: 940, y2: 440 },
      { x1: 340, y1: 340, x2: 940, y2: 340 },
    ],
  },
];

// Total loot value in a room, for the HUD counter.
export function roomLootTotal(level) {
  const values = { gem: 150, painting: 250, gold: 300, diamond: 500 };
  return level.loot.reduce((sum, item) => sum + (values[item.kind] ?? 100), 0);
}
