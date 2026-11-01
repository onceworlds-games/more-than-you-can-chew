// Every sound, synthesized: munches, the overstuffed strain, POP, bank chimes, bumps, the hand, the golden seed, the cat,
// biscuit crunches and stingers. Starts on the player's first tap (Play).

import { createMusic } from './music.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let music = null;
  let noiseBuf = null;
  let strain = null;
  let purr = null;
  let muted = false;
  const last = new Map();

  function ensure() {
    if (ctx) return ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    sfx = ctx.createGain();
    sfx.gain.value = 0.85;
    sfx.connect(master);
    music = createMusic(ctx, master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const ok = () => ctx && ctx.state === 'running' && !muted;
  // Don't stack the same sound more than every `gap` seconds.
  const gate = (name, gap) => {
    const t = ctx.currentTime;
    if ((last.get(name) ?? -1) > t - gap) return false;
    last.set(name, t);
    return true;
  };

  function tone(t, type, f0, f1, len, vol, dest = sfx, attack = 0.005) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + len);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  function hiss(t, len, type, f0, f1, vol, q = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + len);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f).connect(g).connect(sfx);
    s.start(t, Math.random() * 0.6);
    s.stop(t + len + 0.02);
  }

  function marimba(t, f, vol = 0.22, len = 0.45) {
    tone(t, 'sine', f, f, len, vol, sfx, 0.003);
    tone(t, 'sine', f * 4, f * 4, len * 0.22, vol * 0.25, sfx, 0.002);
  }
  const note = (semi) => 349.23 * 2 ** (semi / 12); // from F4

  function bell(t, f, vol = 0.15) {
    for (const [m, v, d] of [
      [1, 1, 1.4],
      [2.76, 0.4, 0.7],
      [5.4, 0.2, 0.35],
    ])
      tone(t, 'sine', f * m, f * m, d, vol * v, sfx, 0.002);
  }

  const sounds = {
    munch({ size = 2, fill = 0 } = {}) {
      if (!gate('munch', 0.035)) return;
      const t = ctx.currentTime;
      const big = size >= 18;
      hiss(t, big ? 0.09 : 0.05, 'bandpass', big ? 1400 : 2600, big ? 900 : 1800, big ? 0.5 : 0.35, 1.2);
      hiss(t + 0.045, 0.04, 'bandpass', 2200, 1600, 0.2, 1.5);
      const f = Math.max(240, 820 - fill * 4.2) * (1 + Math.random() * 0.06);
      tone(t, 'triangle', f, f * 0.8, 0.09, 0.16);
      if (size >= 30) tone(t + 0.08, 'sine', 320, 120, 0.22, 0.3);
    },
    pop() {
      const t = ctx.currentTime;
      hiss(t, 0.05, 'highpass', 3000, 3000, 0.9);
      tone(t, 'sine', 150, 40, 0.35, 0.8);
      hiss(t + 0.02, 0.35, 'bandpass', 500, 4000, 0.5, 0.8);
      for (let i = 0; i < 6; i++) hiss(t + 0.45 + i * 0.05 + Math.random() * 0.04, 0.03, 'bandpass', 1800 + Math.random() * 800, 1500, 0.15, 2);
      tone(t + 0.3, 'sine', 1300, 380, 0.7, 0.12);
    },
    bank({ n = 1, worth = 0, fill = 0 } = {}) {
      const t = ctx.currentTime;
      const steps = Math.min(10, Math.max(1, n));
      for (let i = 0; i < steps; i++) marimba(t + i * 0.055, note(PENTA[i % PENTA.length]), 0.18);
      if (worth >= 60) bell(t + steps * 0.055, note(24), 0.14);
      if (fill > 100) for (const s of [0, 4, 7, 12]) marimba(t + steps * 0.055 + 0.08, note(s + 12), 0.1, 0.8);
    },
    dash() {
      if (!gate('dash', 0.08)) return;
      hiss(ctx.currentTime, 0.2, 'bandpass', 600, 2400, 0.35, 0.9);
    },
    hit() {
      const t = ctx.currentTime;
      tone(t, 'sine', 170, 60, 0.18, 0.6);
      hiss(t, 0.06, 'lowpass', 900, 400, 0.4);
      tone(t + 0.02, 'sine', 1500, 2000, 0.08, 0.1);
    },
    swat() {
      const t = ctx.currentTime;
      hiss(t, 0.12, 'lowpass', 2500, 500, 0.8);
      tone(t, 'sine', 110, 45, 0.25, 0.6);
    },
    swish() {
      if (!gate('swish', 0.5)) return;
      hiss(ctx.currentTime, 1.1, 'bandpass', 300, 1800, 0.2, 0.7);
    },
    toss() {
      if (!gate('toss', 0.6)) return;
      hiss(ctx.currentTime, 0.6, 'bandpass', 250, 900, 0.18, 0.6);
    },
    land() {
      if (!gate('land', 0.06)) return;
      tone(ctx.currentTime, 'sine', 220 + Math.random() * 60, 90, 0.08, 0.18);
    },
    golden() {
      if (!gate('golden', 1)) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 8; i++) tone(t + i * 0.07, 'sine', note(24 + PENTA[i]), note(24 + PENTA[i]), 0.4, 0.06, sfx, 0.01);
    },
    lost() {
      const t = ctx.currentTime;
      hiss(t, 0.5, 'lowpass', 1800, 200, 0.35);
      tone(t + 0.05, 'triangle', 420, 210, 0.5, 0.12);
    },
    crunch() {
      const t = ctx.currentTime;
      hiss(t, 0.07, 'bandpass', 2800, 1600, 0.55, 1.4);
      hiss(t + 0.03, 0.05, 'bandpass', 1900, 1200, 0.35, 1.6);
      hiss(t + 0.07, 0.04, 'bandpass', 3200, 2400, 0.2, 2);
    },
    tick() {
      hiss(ctx.currentTime, 0.04, 'bandpass', 2400, 2400, 0.25, 3);
    },
    soft() {
      hiss(ctx.currentTime, 0.05, 'bandpass', 2200, 1500, 0.3, 1.4);
    },
    count({ n = 3 } = {}) {
      marimba(ctx.currentTime, note(n === 1 ? 7 : n === 2 ? 4 : 0), 0.3, 0.6);
    },
    eat() {
      const t = ctx.currentTime;
      [0, 4, 7, 12, 16].forEach((s, i) => marimba(t + i * 0.05, note(s + 12), 0.25, 0.5));
    },
    buzzer() {
      bell(ctx.currentTime, note(0), 0.22);
      bell(ctx.currentTime + 0.18, note(-5), 0.18);
    },
    fanfare() {
      const t = ctx.currentTime;
      const seq = [0, 4, 7, 12, 7, 12, 16, 19];
      seq.forEach((s, i) => marimba(t + i * 0.12, note(s), 0.26, 0.6));
      [0, -5, -3, -1].forEach((s, i) => tone(t + i * 0.24, 'triangle', note(s - 24), note(s - 24), 0.3, 0.3));
      bell(t + seq.length * 0.12, note(24), 0.18);
    },
    cat() {
      // A low purr as the cat wakes.
      if (purr) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 160;
      const am = ctx.createGain();
      am.gain.value = 0;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 24;
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth).connect(am.gain);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.7, t + 0.8);
      g.gain.linearRampToValueAtTime(0, t + 3.2);
      s.connect(lp).connect(am).connect(g).connect(sfx);
      s.start(t);
      lfo.start(t);
      s.stop(t + 3.3);
      lfo.stop(t + 3.3);
      purr = s;
      s.onended = () => {
        purr = null;
      };
    },
  };

  return {
    /** Starts the AudioContext (call from a tap or key in the game). */
    unlock() {
      const c = ensure();
      if (c && c.state !== 'running') c.resume().catch(() => {});
      return !!c;
    },
    get ready() {
      return ok();
    },
    play(name, opts) {
      if (!ok() || !sounds[name]) return;
      try {
        sounds[name](opts);
      } catch {
        /* sound is never worth an error */
      }
    },
    /** The overstuffed whine: level 0 (off) to 1 (about to pop). */
    strain(level) {
      if (!ctx || ctx.state !== 'running') return;
      if (!strain && level > 0 && !muted) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 7;
        const depth = ctx.createGain();
        depth.gain.value = 40;
        lfo.connect(depth).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(bp).connect(g).connect(sfx);
        o.start();
        lfo.start();
        strain = { o, bp, g, lfo, level: 0 };
      }
      if (!strain) return;
      const t = ctx.currentTime;
      const f = 1100 + level * 900;
      strain.o.frequency.setTargetAtTime(f, t, 0.05);
      strain.bp.frequency.setTargetAtTime(f, t, 0.05);
      strain.lfo.frequency.setTargetAtTime(7 + level * 6, t, 0.1);
      strain.g.gain.setTargetAtTime(level > 0 && !muted ? 0.035 + level * 0.05 : 0, t, 0.06);
      strain.level = level;
    },
    music(mode) {
      if (!music) return;
      music.set(ctx ? mode : 'off');
    },
    get musicMode() {
      return music ? music.mode : 'off';
    },
    duck(on) {
      if (music) music.duck(on);
    },
    suspend(on) {
      if (!ctx) return;
      if (on) ctx.suspend().catch(() => {});
      else ctx.resume().catch(() => {});
    },
    setMuted(v) {
      muted = !!v;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },
  };
}
