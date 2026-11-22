// shots.js — deterministic screenshot poses, driven by ?shot=...&room=N.
// Each pose stages the game so the screenshot shows the whole heist at a
// glance: room, thief, guards with cones, cameras, loot, vault, alarm meter.
// No randomness: the same query always stages the same frame.

import { startRoom, update } from './game.js';

const STEP = 1 / 60;

// Drive the thief along a scripted path: list of {keys, seconds}.
function drive(state, script) {
  for (const step of script) {
    const frames = Math.round(step.seconds / STEP);
    for (let i = 0; i < frames; i++) {
      update(state, step.keys, STEP);
      if (state.phase !== 'playing') return;
    }
  }
}

export function applyShot(state, shot) {
  startRoom(state);
  if (shot === 'cover') {
    // Title-room energy: thief mid-floor, guard cone sweeping across the vault.
    drive(state, [
      { keys: { right: true, down: true }, seconds: 1.1 },
      { keys: { right: true }, seconds: 0.9 },
      { keys: {}, seconds: 0.4 },
    ]);
  } else if (shot === 'alarm') {
    // Walk straight into a guard's cone so the alarm is climbing hard.
    state.player.x = 560;
    state.player.y = 300;
    state.player.angle = 0;
    drive(state, [{ keys: {}, seconds: 1.6 }]);
    // A camera also has the thief: alarm well up, not yet lockdown.
    state.alarm = Math.max(state.alarm, 62);
  } else if (shot === 'stealth') {
    // Sneaking behind cover with a smoke cloud up, guard cone passing by.
    state.player.x = 470;
    state.player.y = 470;
    drive(state, [
      { keys: { sneak: true, up: true }, seconds: 0.7 },
      { keys: { smoke: true }, seconds: 0.1 },
      { keys: { sneak: true, left: true }, seconds: 0.8 },
      { keys: {}, seconds: 0.5 },
    ]);
  } else if (shot === 'vault') {
    // Standing at the star vault, cracking it, exit glowing open.
    const v = state.level.vault;
    state.player.x = v.x + v.w / 2;
    state.player.y = v.y + v.h + 46;
    drive(state, [{ keys: {}, seconds: 1.7 }]);
    // The drive above may already have cracked the vault (1.6s to crack);
    // pin the pose to exactly one vault payout so the HUD reads $1000.
    state.vaultCracked = true;
    state.score = 1000;
    state.lootGot = 1000;
    state.crackProgress = 0;
  }
  // Freeze the message banner for clean screenshots, except the alarm pose
  // where the warning is part of the story.
  if (shot !== 'alarm') {
    state.message = '';
    state.messageTimer = 0;
  }
}

export const SHOTS = [
  { name: '1-cover.png', query: '?shot=cover&room=0' },
  { name: '2-alarm.png', query: '?shot=alarm&room=1' },
  { name: '3-stealth.png', query: '?shot=stealth&room=2' },
  { name: '4-vault.png', query: '?shot=vault&room=0' },
];
