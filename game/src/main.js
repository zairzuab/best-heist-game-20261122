// main.js — boots MIDNIGHT VAULT: fixed-timestep loop, phase transitions,
// screenshot poses (?shot=cover|alarm|stealth|vault) and the title screen.

import { VIEW } from './config.js';
import { createGame, startRoom, nextRoom, update } from './game.js';
import { render } from './render.js';
import { createInput, attachInput, consumeEdges } from './input.js';
import { unlockAudio, playPickup, playSpotted, playCrack, playBusted, playWin } from './audio.js';
import { applyShot } from './shots.js';

const STEP = 1 / 60;

export function boot(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput();
  attachInput(input);
  let state = createGame(0);
  let lastPhase = state.phase;
  let lastLoot = 0;
  let lastSpotted = false;
  let lastVault = false;
  let accumulator = 0;
  let lastTime = performance.now();

  // Screenshot poses: ?shot=cover|alarm|stealth|vault&room=0..2
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    const room = Number(params.get('room') ?? '0') || 0;
    state = createGame(room);
    applyShot(state, shot);
    state.phase = 'playing';
    // Settle the pose for a few fixed steps so cones and patrols read well.
    for (let i = 0; i < 30; i++) update(state, {}, STEP);
    state.phase = 'playing';
    render(ctx, state);
    return { state, input };
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const edges = consumeEdges(input);
      unlockAudioIfNeeded(edges);
      handlePhaseKeys(state, edges);
      const prevPhase = state.phase;
      update(state, { ...input, ...edges }, STEP);
      if (state.phase !== prevPhase) onPhaseChange(state, prevPhase);
      playEventSounds(state);
    }
    render(ctx, state);
    requestAnimationFrame(frame);
  }

  function unlockAudioIfNeeded(edges) {
    if (edges.enter || edges.retry || input.up || input.down || input.left || input.right) {
      unlockAudio();
    }
  }

  function handlePhaseKeys(current, edges) {
    if (current.phase === 'title' && edges.enter) {
      startRoom(current);
    } else if (current.phase === 'roomClear' && edges.enter) {
      state = nextRoom(current);
      lastPhase = state.phase;
      lastLoot = 0;
      lastSpotted = false;
      lastVault = false;
    } else if ((current.phase === 'busted' || current.phase === 'win') && edges.retry) {
      state = createGame(current.phase === 'win' ? 0 : current.roomIndex);
      lastPhase = state.phase;
      lastLoot = 0;
      lastSpotted = false;
      lastVault = false;
      if (current.phase === 'busted') startRoom(state);
    }
  }

  function onPhaseChange(current, prevPhase) {
    if (current.phase === 'busted') playBusted();
    if (current.phase === 'win') playWin();
    if (current.phase === 'roomClear') playCrack();
    void prevPhase;
  }

  function playEventSounds(current) {
    if (current.lootGot !== lastLoot) {
      playPickup();
      lastLoot = current.lootGot;
    }
    if (current.spotted && !lastSpotted) playSpotted();
    lastSpotted = current.spotted;
    if (current.vaultCracked && !lastVault) playCrack();
    lastVault = current.vaultCracked;
    lastPhase = current.phase;
    void lastPhase;
  }

  requestAnimationFrame(frame);
  return { state, input };
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  boot(canvas);
}
