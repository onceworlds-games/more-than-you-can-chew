// Move and Bump: WASD or arrows, or the mouse (your hamster runs toward the cursor; a click bumps), or the platform's
// analog stick and its Bump button (which presses Space).

const KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas, renderer, ow) {
  const held = new Set();
  let presses = 0;
  let mouse = null; // { x, y } in CSS px while mouse-follow is on
  let enabled = false;
  let lastPress = 0;
  const listeners = new Set();

  const onKey = (e, down) => {
    const k = KEYS[e.code];
    if (k) {
      if (down) {
        held.add(e.code);
        mouse = null; // keys take over from the mouse
      } else held.delete(e.code);
      if (enabled) e.preventDefault();
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      if (down && !e.repeat && enabled) {
        presses++;
        lastPress = performance.now();
        e.preventDefault();
      }
    }
    if (down && !e.repeat) for (const f of listeners) f(e);
  };
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!mouse && held.size === 0) mouse = { x: e.clientX, y: e.clientY };
    else if (mouse) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') mouse = null;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || !enabled || e.button !== 0) return;
    mouse = { x: e.clientX, y: e.clientY };
    presses++;
    lastPress = performance.now();
  });

  return {
    setEnabled(v) {
      enabled = !!v;
      if (!enabled) presses = 0;
    },
    get mouseOn() {
      return !!mouse;
    },
    /** Movement for my hamster at (x, y) in the world: { mx, my, dash }. */
    read(me) {
      let mx = 0;
      let my = 0;
      for (const code of held) {
        mx += KEYS[code][0];
        my += KEYS[code][1];
      }
      const stick = ow && ow.controls && ow.controls.touch ? ow.controls.stick : null;
      if (stick && (Math.abs(stick.x) > 0.05 || Math.abs(stick.y) > 0.05)) {
        mx += stick.x;
        my += stick.y;
      }
      if (mx === 0 && my === 0 && mouse && me) {
        const p = renderer.toWorld(mouse.x, mouse.y);
        const dx = p.x - me.x;
        const dy = p.y - me.y;
        const d = Math.hypot(dx, dy);
        if (d > 22) {
          const s = Math.min(1, (d - 22) / 90);
          mx = (dx / d) * s;
          my = (dy / d) * s;
        }
      }
      const l = Math.hypot(mx, my);
      if (l > 1) {
        mx /= l;
        my /= l;
      }
      let dash = false;
      if (presses > 0 && enabled) {
        presses--;
        dash = true;
      }
      return { mx, my, dash };
    },
    /** True once per press since the last call (for menus that listen to Space/Enter themselves). */
    recentPress: () => performance.now() - lastPress < 200,
    onKeyDown(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    clear() {
      presses = 0;
    },
  };
}
