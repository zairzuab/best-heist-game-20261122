// input.js — keyboard state, with edge-triggered tool keys (Q smoke, F EMP)
// and the action keys (Enter to start/advance, R to retry).

export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    smoke: false, // edge: set true on keydown, consumed by the game step
    emp: false,
    enter: false, // edge
    retry: false, // edge
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sneak',
  ShiftRight: 'sneak',
};

export function attachInput(input) {
  const down = (event) => {
    if (KEYMAP[event.code]) {
      input[KEYMAP[event.code]] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyQ' && !event.repeat) input.smoke = true;
    if (event.code === 'KeyF' && !event.repeat) input.emp = true;
    if (event.code === 'Enter' && !event.repeat) input.enter = true;
    if (event.code === 'KeyR' && !event.repeat) input.retry = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  };
  const up = (event) => {
    if (KEYMAP[event.code]) input[KEYMAP[event.code]] = false;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => {
    for (const key of Object.keys(KEYMAP)) input[KEYMAP[key]] = false;
  });
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
  };
}

// The game consumes edge keys once per step so a held key fires once.
export function consumeEdges(input) {
  const edges = { smoke: input.smoke, emp: input.emp, enter: input.enter, retry: input.retry };
  input.smoke = false;
  input.emp = false;
  input.enter = false;
  input.retry = false;
  return edges;
}
