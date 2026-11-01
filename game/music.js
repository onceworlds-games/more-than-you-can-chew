// A small picnic band: plucked upright bass (swung), marimba, brushed snare and a shaker; a cowbell when the cat wakes.
// Menu 90 BPM, play 112, the last 30 s up a tone at 132.

const PROG = [
  // F, Dm, Bb, C (semitones from F)
  { root: 0, tones: [0, 4, 7] },
  { root: -3, tones: [0, 3, 7] },
  { root: 5, tones: [0, 4, 7] },
  { root: 7, tones: [0, 4, 7] },
];
const BASE = 87.31; // F2
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
// A melody in eighth-note steps (null = rest), indexes into PENTA, two bars long.
const MELODY = [
  [4, null, 5, 4, 2, null, 3, null, 4, null, null, 2, 1, null, 0, null],
  [2, null, 3, 4, 5, null, 4, null, 2, 3, null, 1, 0, null, null, null],
  [5, null, 6, 5, 4, null, 2, null, 3, null, 4, null, 2, null, null, null],
  [1, 2, 3, null, 4, null, 7, null, 6, null, 5, 4, 3, null, 2, null],
];

const freq = (semi) => BASE * 2 ** (semi / 12);

export function createMusic(ctx, out) {
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };

  let mode = 'off';
  let bpm = 90;
  let shift = 0;
  let step = 0; // eighth notes
  let next = 0;
  let timer = null;
  let level = 0;

  function bass(t, f, len) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(lp).connect(g).connect(bus);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  function marimba(t, f, vol = 0.18, len = 0.5) {
    for (const [mul, v, d] of [
      [1, 1, len],
      [4, 0.25, len * 0.25],
      [10, 0.06, 0.05],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mul;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0008, t + d);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + d + 0.05);
    }
  }

  function hiss(t, len, type, f, vol, q = 1) {
    const s = ctx.createBufferSource();
    s.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = f;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(bp).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  }

  function cowbell(t) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 3;
    for (const f of [540, 800]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      o.connect(bp);
      o.start(t);
      o.stop(t + 0.3);
    }
    bp.connect(g).connect(bus);
  }

  function schedule(t) {
    const eighth = 60 / bpm / 2;
    const swing = step % 2 === 1 ? eighth * 0.18 : 0;
    const at = t + swing;
    const bar = Math.floor(step / 8) % PROG.length;
    const beat = step % 8;
    const ch = PROG[bar];
    const root = ch.root + shift;
    // Bass: root on 1, a walk on the rest.
    if (beat === 0) bass(at, freq(root), 0.5);
    else if (beat === 4) bass(at, freq(root + 7), 0.4);
    else if (mode !== 'menu' && (beat === 6 || beat === 3)) bass(at, freq(root + (beat === 6 ? ch.tones[1] : 12)), 0.22);
    // Marimba: chord tones on the off-beats, a melody line in play.
    if (beat % 2 === 1) marimba(at, freq(root + 24 + ch.tones[(beat >> 1) % 3]), mode === 'menu' ? 0.06 : 0.07, 0.3);
    if (mode !== 'menu') {
      const m = MELODY[Math.floor(step / 16) % MELODY.length][step % 16];
      if (m !== null && m !== undefined) marimba(at, freq(shift + 36 + PENTA[m]), 0.11, 0.45);
      // Brushes and shaker.
      if (beat === 2 || beat === 6) hiss(at, 0.16, 'bandpass', 2400, 0.12, 0.7);
      hiss(at, 0.045, 'highpass', 7000, beat % 2 ? 0.05 : 0.08);
      if (mode === 'late' && beat % 2 === 0) cowbell(at);
    } else if (beat === 0 && bar % 2 === 0) {
      marimba(at, freq(root + 36 + ch.tones[2]), 0.05, 0.6);
    }
    step++;
  }

  function pump() {
    const ahead = 0.15;
    while (next < ctx.currentTime + ahead) {
      schedule(next);
      next += 60 / bpm / 2;
    }
  }

  return {
    get mode() {
      return mode;
    },
    set(m) {
      if (m === mode) return;
      const was = mode;
      mode = m;
      bpm = m === 'menu' ? 90 : m === 'late' ? 132 : 112;
      shift = m === 'late' ? 2 : 0;
      level = m === 'off' ? 0 : m === 'menu' ? 0.45 : 0.75;
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(level, now, 0.25);
      if (m === 'off') {
        if (timer) clearInterval(timer);
        timer = null;
        return;
      }
      if (was === 'off' || !timer) {
        next = now + 0.05;
        if (m !== 'late') step = 0;
        timer = setInterval(pump, 25);
      }
    },
    duck(on) {
      bus.gain.setTargetAtTime(on ? level * 0.35 : level, ctx.currentTime, 0.1);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      mode = 'off';
      bus.gain.value = 0;
    },
  };
}
