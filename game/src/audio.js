// audio.js — tiny WebAudio bleeps, synthesized in code (no audio files).
// Everything is guarded: no AudioContext until the first user gesture.

let ctx = null;
let muted = false;

function ensureCtx() {
  if (ctx) return ctx;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const ac = ensureCtx();
  if (ac && ac.state === 'suspended') void ac.resume();
}

function blip(freq, duration, type = 'sine', gain = 0.05) {
  if (muted) return;
  const ac = ensureCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, ac.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + duration);
  } catch {
    // Audio is decoration; a failure must never break the game.
  }
}

export function playPickup() {
  blip(880, 0.12, 'sine', 0.06);
  setTimeout(() => blip(1318, 0.14, 'sine', 0.05), 70);
}

export function playSpotted() {
  blip(220, 0.25, 'square', 0.05);
  setTimeout(() => blip(165, 0.3, 'square', 0.05), 120);
}

export function playCrack() {
  [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.06), i * 90));
}

export function playBusted() {
  [330, 247, 165].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.05), i * 140));
}

export function playWin() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.06), i * 110));
}

export function toggleMute() {
  muted = !muted;
  return muted;
}
