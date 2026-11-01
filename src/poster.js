// Store art (?poster=cover|action|win|multi|icon|badge-<id>|plate-<n>): one staged frame drawn with the game's own renderer.
// A real round is played by bots, then frozen and staged; no room, no HUD, no platform UI. Plates are the small pictures
// the Picnics and Daily screens use. document.body.dataset.ready = '1' once the frame is on screen.

import * as THREE from 'three';
import { createWorld3d } from './render/world3d.js';
import { createHamster } from './render/hamster.js';
import { createFoodBatch } from './render/food.js';
import { environment, model, fit, loadsPending } from './render/assets.js';
import { createLocalSession } from './session.js';
import { BOTS, GOLDEN, CHILI, GUM, PEPPER } from './sim/config.js';
import { BOT_OUTFITS, dressHam } from './wardrobe.js';

const INK = '#3B2218';
const CREAM = '#FFF2D9';
const U = 0.01;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = 0;
const NUT = 1;
const BERRY = 2;
const CRACKER = 3;
const STRAW = 4;
const COOKIE = 5;

async function settled(maxMs = 9000) {
  const t0 = performance.now();
  await sleep(200);
  while (loadsPending() > 0 && performance.now() - t0 < maxMs) await sleep(100);
  await sleep(250);
}

async function fonts() {
  try {
    await Promise.race([Promise.all([document.fonts.load('40px Shrikhand'), document.fonts.load('800 20px "Bricolage Grotesque"')]), sleep(3000)]);
    await document.fonts.ready;
  } catch {
    /* fall back to whatever loaded */
  }
}

// ------------------------------------------------------------------ staging a played round

/** A round played by eight bots up to `secs`, then frozen: real food, real heaps. */
function playedWorld(arena, seed, secs) {
  const s = createLocalSession({ arena, seed, me: null, bots: BOTS.map((b) => ({ name: b.name, kind: b.kind, coat: b.coat, skill: 0.75 })), intro: 0 });
  for (let t = 0; t < secs; t += 1 / 60) s.step(1 / 60);
  s.w.drain();
  const w = s.w;
  for (const h of w.hams) {
    h.brain = null;
    dressHam(h, BOT_OUTFITS[h.name]);
  }
  // Nothing on its way: no hands, sweeps or drops in a still frame.
  for (const k of ['tosses', 'sweeps', 'goldens', 'drops']) if (Array.isArray(w.sched[k])) w.sched[k].length = 0;
  return w;
}
const byName = (w, n) => w.hams.find((h) => h.name === n);

function place(h, x, y, a, o = {}) {
  Object.assign(h, { x, y, a, fill: o.fill ?? 0, dashT: o.dash ? 0.15 : 0, dizzyT: o.dizzy ? 1.2 : 0, stunT: 0, kbT: 0, hotT: o.hot ? 3 : 0, gumT: o.gum ? 3 : 0, gone: false, away: false });
  h.vx = Math.cos(a) * (o.speed ?? 0);
  h.vy = Math.sin(a) * (o.speed ?? 0);
  h.posterSpeed = o.speed ?? 0;
}
function food(w, type, x, y) {
  return w.addFood({ id: w.dynId++, type, x, y, bx: x, by: y, tb: 0, land: -1, src: 'open', fx: null, fy: null });
}
function clearAround(w, x, y, r) {
  for (const f of [...w.food.values()]) if (Math.hypot(f.x - x, f.y - y) < r) w.food.delete(f.id);
}
/** A loose scatter of food (deterministic). */
function scatter(w, cx, cy, r, n, types, seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * Math.sqrt(rnd());
    food(w, types[Math.floor(rnd() * types.length)], cx + Math.cos(a) * d, cy + Math.sin(a) * d);
  }
}

/** Draws `frames` frames so springs and particles settle; moving hamsters run into their marks. */
function settle(world, w, view, frames, sc = {}) {
  const marks = w.hams.filter((h) => h.posterSpeed > 0).map((h) => ({ h, x: h.x, y: h.y }));
  for (let i = 0; i < frames; i++) {
    const back = (frames - 1 - i) / 60;
    for (const m of marks) {
      m.h.x = m.x - Math.cos(m.h.a) * m.h.posterSpeed * back;
      m.h.y = m.y - Math.sin(m.h.a) * m.h.posterSpeed * back;
    }
    if (sc.each) sc.each(i, frames);
    world.camera(w, view, 1 / 60);
    world.draw({ w, me: sc.me || null, leader: sc.leader || null, dt: 1 / 60, noRing: !sc.ring, snapHeaps: !!sc.snapHeaps });
  }
}

function setupWorld(W, H, opts = {}) {
  const canvas = document.getElementById('game');
  const world = createWorld3d(canvas, { preserve: true });
  world.setQuality('high');
  world.resize(W, H, 1);
  if (opts.pitch) world.rig.pitch = opts.pitch;
  if (opts.yaw) world.rig.yaw = opts.yaw;
  world.stage.tilt.amount = opts.tilt ?? 2.2;
  world.stage.tilt.focus = opts.focus ?? 0.47;
  return world;
}

async function finish(world, w, view, sc, frames = 40) {
  // Draw once so the arena starts loading, wait for every model and texture, then settle the moment.
  world.camReady = false;
  settle(world, w, view, 2, { ...sc, each: null });
  await settled();
  world.camReady = false;
  settle(world, w, view, frames, sc);
}

// ------------------------------------------------------------------ the logo (cover only)

function logo(where) {
  const ui = document.getElementById('ui');
  ui.innerHTML = `<div class="poster-logo ${where}"><div class="card logo" style="animation:none"><div class="in"><span class="piped l1">More Than</span><span class="piped l2">You Can <em>Chew</em></span></div></div></div>`;
}

// ------------------------------------------------------------------ world posters

async function cover(W, H) {
  const world = setupWorld(W, H, { pitch: 0.55, tilt: 2.4, focus: 0.6 });
  const w = playedWorld(0, 'cover-3', 46);
  clearAround(w, 740, 520, 700);
  const gus = byName(w, 'Gus');
  const pepper = byName(w, 'Pepper');
  const mabel = byName(w, 'Mabel');
  const dot = byName(w, 'Dot');
  const rocco = byName(w, 'Rocco');
  const bea = byName(w, 'Bea');
  place(gus, 800, 640, Math.PI / 2 + 0.25, { fill: 132 });
  place(pepper, 610, 610, 0.2, { dash: true, speed: 420, fill: 30 });
  place(mabel, 700, 440, 1.1, { fill: 96 });
  place(dot, 900, 420, 2.4, { fill: 10, dizzy: true });
  place(rocco, 950, 600, Math.PI - 0.35, { fill: 70, speed: 150 });
  place(bea, 800, 290, 1.4, { fill: 110 });
  // Everyone else waddles in the back, out of the way.
  place(byName(w, 'Clem'), 1090, 360, 2.2, { fill: 60 });
  place(byName(w, 'Fig'), 1500, 200, 2.6, { fill: 20 });
  scatter(w, 760, 470, 300, 80, [SEED, SEED, SEED, NUT, NUT, BERRY, BERRY, CRACKER, STRAW], 3);
  scatter(w, 780, 700, 80, 10, [SEED, SEED, SEED, NUT], 9);
  scatter(w, 900, 420, 110, 18, [SEED, NUT, BERRY, CRACKER, COOKIE, STRAW], 4);
  for (const [t, x, y] of [
    [COOKIE, 880, 560],
    [STRAW, 720, 620],
    [GOLDEN, 690, 560],
    [CHILI, 560, 520],
  ])
    food(w, t, x, y);
  for (const f of [...w.food.values()]) if (f.y > 690 && f.type > NUT) w.food.delete(f.id);
  clearAround(w, 800, 640, 60);
  clearAround(w, 700, 440, 40);
  clearAround(w, 610, 610, 40);
  clearAround(w, 950, 600, 40);
  clearAround(w, 1090, 360, 40);
  clearAround(w, 800, 290, 40);
  logo('tl');
  const view = { mode: 'fixed', x: 760, y: 560, dist: 3.9 };
  await finish(world, w, view, {
    me: gus.id,
    each: (i, n) => {
      if (i === n - 12) world.gulp(gus.id, 10);
      if (i === n - 14) {
        const x = 900 * U;
        const z = 420 * U;
        world.fx.crumbs(x, 0.3, z, 40, ['#E3A24F', '#FFF2D9', '#FF4D6D', '#FFCB2E'], 2.4, 1.3, 0.04);
        world.fx.confetti(x, 0.3, z, 20, 1.2);
        world.fx.ring(x, z, 0.9, '#fff2d9');
        world.fx.stars(world.hamTop(dot.id), 1.6);
      }
      if (i === n - 8) world.gulp(mabel.id, 6);
      if (i === n - 7) world.fx.dust(540 * U, 590 * U, 12, 0.3);
    },
  });
}

async function action(W, H) {
  const world = setupWorld(W, H, { pitch: 0.58, yaw: 0.25, tilt: 2.6, focus: 0.55 });
  const w = playedWorld(4, 'action-2', 40);
  const cx = 1100;
  const cy = 900;
  clearAround(w, cx, cy, 380);
  const pepper = byName(w, 'Pepper');
  const dot = byName(w, 'Dot');
  const bea = byName(w, 'Bea');
  const gus = byName(w, 'Gus');
  place(dot, cx, cy, 2.6, { fill: 0 });
  place(pepper, cx - 70, cy + 40, -0.45, { dash: true, speed: 300, fill: 26 });
  place(bea, cx + 190, cy - 90, Math.PI - 0.6, { fill: 96 });
  place(gus, cx - 230, cy - 120, 0.2, { fill: 60, speed: 220 });
  scatter(w, cx, cy - 40, 340, 26, [SEED, SEED, NUT, BERRY, CRACKER], 7);
  clearAround(w, cx, cy, 120);
  // Dot pops: everything in its cheeks sprays out, caught mid-air.
  dot.cheeks = [7, 4, 3, 2, 2, 1, 0, 0, 0, 0];
  w.pop(dot, pepper.id);
  w.drain();
  w.t += 0.17;
  const view = { mode: 'fixed', x: cx - 20, y: cy - 30, dist: 3.5 };
  await finish(world, w, view, {
    each: (i, n) => {
      if (i === n - 10) {
        world.pop(dot.id);
        world.hit(pepper.id);
        const x = cx * U;
        const z = cy * U;
        world.fx.ring(x, z, 0.65, '#fff2d9');
        world.fx.crumbs(x, 0.3, z, 34, ['#FF4D6D', '#FFF2D9', '#E3A24F', '#FFCB2E'], 2.4, 1.2, 0.035);
        world.fx.confetti(x, 0.4, z, 18, 1.1);
        world.fx.stars(world.hamTop(dot.id), 1.6);
        world.fx.dust(x, z, 12, 0.3);
      }
      if (i === n - 6) world.fx.dust((cx - 140) * U, (cy + 70) * U, 8, 0.25);
    },
  });
}

async function win(W, H) {
  const w = playedWorld(0, 'win-5', 120);
  const mabel = byName(w, 'Mabel');
  mabel.heap = Math.max(mabel.heap, 1640);
  dressHam(mabel, { hat: 'crown', pop: 'confetti', trail: 'sparkle' });
  const b = mabel.burrow;
  const px = -b.ny;
  const py = b.nx;
  // In front of the burrow, beside the heap, facing the field (and the camera).
  const x = b.x + b.nx * 105 - px * 30;
  const y = b.y + b.ny * 105 - py * 30;
  const world = setupWorld(W, H, { pitch: 0.6, yaw: Math.atan2(b.nx, b.ny), tilt: 2.0, focus: 0.45 });
  world.stage.tilt.band = 0.32;
  clearAround(w, x, y, 260);
  place(mabel, x, y, Math.atan2(b.ny, b.nx), { fill: 14 });
  // The runners-up, glum, off to the sides.
  const others = ['Gus', 'Pepper'].map((n) => byName(w, n));
  place(others[0], x + b.nx * 60 + px * 260, y + b.ny * 60 + py * 260, Math.atan2(b.ny, b.nx) - 2, { fill: 30 });
  place(others[1], x + b.nx * 70 - px * 250, y + b.ny * 70 - py * 250, Math.atan2(b.ny, b.nx) + 2, { fill: 8 });
  scatter(w, x + b.nx * 170, y + b.ny * 170, 160, 8, [SEED, SEED, NUT], 11);
  const view = { mode: 'fixed', x: x - b.nx * 52 + px * 22, y: y - b.ny * 52 + py * 22, dist: 2.35 };
  // The winner's spin is a whole number of turns when the frame is taken.
  const frames = 110;
  await finish(
    world,
    w,
    view,
    {
      leader: mabel.id,
      snapHeaps: true,
      each: (i, n) => {
        if (i === n - 108) {
          world.mood(mabel.id, 'win');
          for (const o of others) world.mood(o.id, 'lose');
        }
        if (i === n - 80 || i === n - 55) world.fx.confetti(x * U, 0.4, y * U, 120, 1.6);
        if (i === n - 20) {
          world.fx.sparkle(x * U, 0.4, y * U, 24, '#ffe680', 1.0, 0.12);
        }
      },
    },
    frames,
  );
}

async function multi(W, H) {
  const world = setupWorld(W, H, { pitch: 0.8, tilt: 2.0, focus: 0.5 });
  const w = playedWorld(4, 'multi-1', 60);
  const cx = 1290;
  const cy = 520;
  clearAround(w, cx, cy, 420);
  w.hams.forEach((h, i) => {
    const a = (i / w.hams.length) * Math.PI * 2 + 0.35;
    const d = 175 + (i % 3) * 30;
    place(h, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, a + Math.PI + (i % 2 ? 0.2 : -0.15), { speed: i % 3 === 0 ? 380 : 220, dash: i % 3 === 0, fill: 15 + ((i * 37) % 105) });
  });
  food(w, GOLDEN, cx, cy);
  scatter(w, cx, cy, 150, 22, [SEED, SEED, NUT, BERRY, CRACKER, STRAW], 5);
  clearAround(w, cx, cy, 40);
  food(w, GOLDEN, cx, cy);
  const view = { mode: 'fixed', x: cx, y: cy + 20, dist: 6.2 };
  await finish(world, w, view, { each: (i, n) => i === n - 20 && world.fx.sparkle(cx * U, 0.25, cy * U, 30, '#fff2a8', 1.0) });
}

async function icon(W, H) {
  const world = setupWorld(W, H, { pitch: 0.38, tilt: 3.4, focus: 0.5 });
  const w = playedWorld(0, 'icon-1', 30);
  const gus = byName(w, 'Gus');
  dressHam(gus, { hat: 'party' });
  gus.coat = 0;
  const x = 1100;
  const y = 600;
  clearAround(w, x, y, 400);
  place(gus, x, y, Math.PI / 2 - 0.2, { fill: 84 });
  for (const h of w.hams) if (h !== gus) h.gone = true;
  for (const [t, fx, fy] of [
    [STRAW, x - 75, y + 20],
    [SEED, x + 58, y + 46],
    [BERRY, x + 80, y - 6],
    [COOKIE, x - 40, y - 140],
    [NUT, x + 130, y - 80],
  ])
    food(w, t, fx, fy);
  const view = { mode: 'fixed', x: x + 2, y: y - 26, dist: 1.85 };
  await finish(world, w, view, { each: (i, n) => i === n - 12 && world.gulp(gus.id, 7) });
}

async function plate(n, W, H) {
  const world = setupWorld(W, H, { tilt: 0, pitch: 1.0 });
  const w = playedWorld(n, `plate-${n}`, 25);
  // The table a little closer than the whole-arena view, so the picture is the table, not its surroundings.
  const across = (span) => span / (2 * Math.tan((17 * Math.PI) / 180) * (W / H));
  const view = { mode: 'fixed', x: w.arena.w / 2, y: w.arena.h / 2 + 40, dist: across(w.arena.w * U * 0.86) };
  await finish(world, w, view, {
    // Night reads as night, but a picture this small needs to show the table.
    each: (i) => i === 0 && world.stage.grade.uDark.value > 0 && ((world.stage.grade.uDark.value = 0.55), (world.stage.renderer.toneMappingExposure *= 1.35)),
  }, 30);
}

// ------------------------------------------------------------------ badges: a symbol on a disc

const BADGE = {
  'first-bite': { color: '#2DC38A', ham: { coat: 0, seat: 0, fill: 40, bite: true, held: [SEED, 0.55, 0.5, 1.05, 0.5] } },
  stuffed: { color: '#FF8A2A', ham: { coat: 1, seat: 4, fill: 112 } },
  bursting: { color: '#FF4D6D', ham: { coat: 5, seat: 5, fill: 138, strain: 0.9 }, draw: 'sweat' },
  gobbler: {
    color: '#16B3AE',
    pitch: 0.12,
    food: [
      [SEED, -0.78, -0.05, 0.8],
      [BERRY, -0.4, 0.28, 0.95],
      [NUT, 0.02, 0.42, 1.1],
      [STRAW, 0.48, 0.28, 1.25],
      [COOKIE, 0.92, -0.08, 1.35],
    ],
    draw: 'chain',
  },
  pop: { color: '#FF6FB0', draw: 'pop' },
  bully: {
    color: '#9A5BEA',
    draw: 'impact',
    hams: [
      { coat: 4, seat: 1, x: -0.42, a: Math.PI / 2 - 0.62, fill: 20 },
      { coat: 3, seat: 2, x: 0.42, a: Math.PI / 2 + 0.62, dizzy: true, fill: 60 },
    ],
  },
  'golden-seed': { color: '#3FA7F2', food: [[GOLDEN, 0, 0, 2.6]], draw: 'sparkles' },
  hoarder: { color: '#E3A24F', heap: true },
  'clean-plate': { color: '#16B3AE', plate: true, draw: 'shine' },
  'buzzer-beater': { color: '#2E3F9E', draw: 'watch' },
  'spice-rack': {
    color: '#FF8424',
    food: [
      [GUM, -0.36, 0, 1.45, -0.32],
      [PEPPER, 0.42, -0.04, 1.35, -0.26],
      [CHILI, 0.02, -0.1, 1.75, 0.4],
    ],
  },
  'week-streak': { color: '#D8413A', draw: 'flame' },
  'picnic-season': { color: '#9BD13A', basket: true },
  'three-star': { color: '#6A3FB8', draw: 'stars' },
  'well-fed': { color: '#FFCB2E', ham: { coat: 7, seat: 3, fill: 60, hat: 'chef', mood: 'win' } },
};

function discCanvas(S) {
  const c = document.getElementById('hud');
  c.width = S;
  c.height = S;
  c.style.width = `${S}px`;
  c.style.height = `${S}px`;
  c.style.zIndex = '1';
  document.getElementById('game').style.zIndex = '2';
  return c.getContext('2d');
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k));
  return `#${c.getHexString()}`;
}

function drawDisc(ctx, S, color) {
  const c = S / 2;
  const R = S * 0.43;
  const circle = (x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(59,34,24,0.35)';
  circle(c + 2, c + 6, R + 7);
  ctx.fillStyle = INK;
  circle(c, c, R + 7);
  ctx.fillStyle = CREAM;
  circle(c, c, R + 2);
  ctx.fillStyle = INK;
  circle(c, c, R - 4);
  const g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
  g.addColorStop(0, shade(color, 0.35));
  g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g;
  circle(c, c, R - 6.5);
  // Soft rays.
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R - 6.5, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.09)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a, a + Math.PI / 12);
    ctx.fill();
  }
  ctx.restore();
}

function inked(ctx, lw, fill, path) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}
function starPath(ctx, x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
function sparkle(ctx, x, y, r, fill = '#FFF6C2') {
  inked(ctx, 3, fill, () => starPath(ctx, x, y, r, 4, 0.28, 0));
}
const dot = (ctx, x, y, r) => () => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};

function draw2d(ctx, S, kind) {
  const c = S / 2;
  const k = S / 256;
  if (kind === 'watch') {
    inked(ctx, 6 * k, '#FFF2D9', dot(ctx, c, c + 8 * k, 64 * k));
    inked(ctx, 5 * k, '#FFCB2E', () => {
      ctx.beginPath();
      ctx.roundRect(c - 14 * k, c - 78 * k, 28 * k, 20 * k, 5 * k);
    });
    inked(ctx, 5 * k, '#FFCB2E', () => {
      ctx.beginPath();
      ctx.roundRect(c + 40 * k, c - 64 * k, 18 * k, 14 * k, 4 * k);
    });
    // The last sliver of time, in red.
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath();
    ctx.moveTo(c, c + 8 * k);
    ctx.arc(c, c + 8 * k, 54 * k, -Math.PI / 2 - 0.55, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.lineWidth = 4 * k;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 50 * k, c + 8 * k + Math.sin(a) * 50 * k);
      ctx.lineTo(c + Math.cos(a) * 58 * k, c + 8 * k + Math.sin(a) * 58 * k);
      ctx.stroke();
    }
    ctx.lineWidth = 7 * k;
    ctx.beginPath();
    ctx.moveTo(c, c + 8 * k);
    ctx.lineTo(c - 24 * k, c - 36 * k);
    ctx.stroke();
    ctx.fillStyle = INK;
    dot(ctx, c, c + 8 * k, 8 * k)();
    ctx.fill();
  } else if (kind === 'flame') {
    inked(ctx, 7 * k, '#FF7A2A', () => {
      ctx.beginPath();
      ctx.moveTo(c, c - 80 * k);
      ctx.bezierCurveTo(c + 10 * k, c - 40 * k, c + 62 * k, c - 26 * k, c + 58 * k, c + 22 * k);
      ctx.bezierCurveTo(c + 56 * k, c + 66 * k, c - 56 * k, c + 66 * k, c - 58 * k, c + 22 * k);
      ctx.bezierCurveTo(c - 60 * k, c - 10 * k, c - 36 * k, c - 26 * k, c - 26 * k, c - 46 * k);
      ctx.bezierCurveTo(c - 14 * k, c - 26 * k, c - 4 * k, c - 24 * k, c + 2 * k, c - 30 * k);
      ctx.bezierCurveTo(c + 6 * k, c - 50 * k, c - 4 * k, c - 64 * k, c, c - 80 * k);
      ctx.closePath();
    });
    ctx.fillStyle = '#FFD34D';
    ctx.beginPath();
    ctx.moveTo(c, c - 6 * k);
    ctx.bezierCurveTo(c + 18 * k, c + 10 * k, c + 32 * k, c + 22 * k, c + 28 * k, c + 38 * k);
    ctx.bezierCurveTo(c + 24 * k, c + 58 * k, c - 24 * k, c + 58 * k, c - 28 * k, c + 38 * k);
    ctx.bezierCurveTo(c - 30 * k, c + 20 * k, c - 12 * k, c + 10 * k, c, c - 6 * k);
    ctx.fill();
    for (let i = 0; i < 7; i++) inked(ctx, 3 * k, '#FFF2D9', dot(ctx, c + (i - 3) * 19 * k, c + 84 * k, 6.5 * k));
  } else if (kind === 'stars') {
    inked(ctx, 7 * k, '#FFCB2E', () => starPath(ctx, c - 54 * k, c + 18 * k, 36 * k));
    inked(ctx, 7 * k, '#FFCB2E', () => starPath(ctx, c + 54 * k, c + 18 * k, 36 * k));
    inked(ctx, 7 * k, '#FFE680', () => starPath(ctx, c, c - 22 * k, 48 * k));
  } else if (kind === 'pop') {
    inked(ctx, 7 * k, '#FFF2D9', () => starPath(ctx, c, c, 82 * k, 12, 0.62, 0.2));
    inked(ctx, 6 * k, '#FFCB2E', () => starPath(ctx, c, c, 46 * k, 9, 0.6, 0.5));
    for (const [x, y, r, f] of [
      [-70, -60, 10, '#E3A24F'],
      [72, -50, 8, '#FF4D6D'],
      [-78, 50, 9, '#FFCB2E'],
      [64, 68, 11, '#E3A24F'],
      [8, -88, 7, '#9BD13A'],
      [-8, 90, 7, '#FF4D6D'],
    ])
      inked(ctx, 3.5 * k, f, dot(ctx, c + x * k, c + y * k, r * k));
  } else if (kind === 'impact') {
    inked(ctx, 5 * k, '#FFF2D9', () => starPath(ctx, c, c - 34 * k, 30 * k, 8, 0.5, 0.3));
  } else if (kind === 'sweat') {
    for (const [x, y, s] of [
      [-74, -54, 1],
      [78, -40, 0.85],
      [-82, 18, 0.7],
    ]) {
      inked(ctx, 3.5 * k, '#BFE8FF', () => {
        const r = 10 * s * k;
        const X = c + x * k;
        const Y = c + y * k;
        ctx.beginPath();
        ctx.moveTo(X, Y - r * 1.9);
        ctx.quadraticCurveTo(X + r * 1.1, Y - r * 0.2, X, Y + r);
        ctx.quadraticCurveTo(X - r * 1.1, Y - r * 0.2, X, Y - r * 1.9);
      });
    }
  } else if (kind === 'sparkles' || kind === 'shine') {
    sparkle(ctx, c - 64 * k, c - 52 * k, 16 * k);
    sparkle(ctx, c + 66 * k, c - 40 * k, 12 * k);
    sparkle(ctx, c + 58 * k, c + 62 * k, 14 * k);
  } else if (kind === 'chain') {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 6 * k;
    ctx.setLineDash([2, 14 * k]);
    ctx.beginPath();
    ctx.arc(c + 6 * k, c + 96 * k, 118 * k, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

async function badge(id, S) {
  const def = BADGE[id] || { color: '#FFCB2E', draw: 'stars' };
  const ctx = discCanvas(S);
  drawDisc(ctx, S, def.color);
  const over = def.draw === 'impact';
  if (def.draw && !over) draw2d(ctx, S, def.draw);
  if (def.ham || def.hams || def.food || def.heap || def.plate || def.basket) {
    const canvas = document.getElementById('game');
    canvas.style.width = `${S}px`;
    canvas.style.height = `${S}px`;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(S, S, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff6e6', '#8a6a48', 1.3));
    const key = new THREE.DirectionalLight('#ffe2bc', 2.6);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe4ff', 1.4);
    rim.position.set(-3, 2.5, -3);
    scene.add(rim);
    const env = await environment(renderer, 'sunflowers');
    if (env) {
      scene.environment = env.env;
      scene.environmentIntensity = 0.5;
    }
    const subject = new THREE.Group();
    scene.add(subject);
    const hamsters = [];
    const addHam = (o) => {
      const h = createHamster({ coat: o.coat, seat: o.seat, hat: o.hat || null, scale: 1 });
      const s = { x: (o.x || 0) * 3, z: 0, a: o.a ?? Math.PI / 2 - 0.3, speed: 0, fill: o.fill || 0, over: o.strain || 0, dash: false, dizzy: o.dizzy ? 1 : 0, stun: 0, strain: o.strain || 0, gum: false, fire: false, away: false, mood: o.mood || null };
      for (let i = 0; i < 90; i++) h.update(s, 1 / 60);
      if (o.bite) {
        h.bite(8);
        for (let i = 0; i < 5; i++) h.update(s, 1 / 60);
      }
      Object.assign(h.A, { spin: 0, hop: 0, hopV: 0, blink: 0, blinkT: 9 });
      h.update(s, 0.0001);
      subject.add(h.root);
      hamsters.push(h);
      if (o.held) {
        const [t, fx, fy, fz, r] = o.held;
        const b = createFoodBatch(4, { shadows: false });
        b.begin();
        b.add(t, fx, fy, fz, 0.9, 0.4, r);
        b.end();
        subject.add(b.group);
      }
    };
    if (def.ham) addHam(def.ham);
    if (def.hams) def.hams.forEach(addHam);
    if (def.food || def.heap) {
      const batch = createFoodBatch(80, { shadows: false });
      batch.begin();
      if (def.food) for (const [t, x, y, sc, z] of def.food) batch.add(t, x * 1.6, (y || 0) * 1.6 + 0.3, 0.6 + (z || 0) * 1.6, 0.4, 0.5, 0.42 * (sc || 1));
      if (def.heap) {
        // A heap: pieces stacked in a cone.
        const types = [SEED, NUT, BERRY, CRACKER, STRAW, COOKIE, GOLDEN];
        let n = 0;
        for (let layer = 0; layer < 6; layer++) {
          const ring = Math.max(1, 9 - layer * 2);
          for (let i = 0; i < ring; i++) {
            const a = (i / ring) * Math.PI * 2 + layer;
            const rr = (6 - layer) * 0.17;
            batch.add(types[(n++ * 5) % types.length], Math.cos(a) * rr, layer * 0.2 + 0.1, Math.sin(a) * rr, a, 0.6, 0.32);
          }
        }
      }
      batch.end();
      subject.add(batch.group);
    }
    if (def.plate) {
      const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, clearcoat: 1 });
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 0.14, 64), mat);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.07, 12, 64), mat);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 0.08;
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: '#3fa7f2', roughness: 0.4 }));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.075;
      subject.add(p, lip, band);
    }
    if (def.basket) {
      const m = await model('wicker_basket_01');
      if (m) subject.add(fit(m, 2.2));
    }
    // Frame it.
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    const box = new THREE.Box3().setFromObject(subject);
    const size = new THREE.Vector3();
    const ctr = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(ctr);
    const r = Math.max(size.x, size.y, size.z) * 0.5 * (def.ham && !def.ham.hat ? 1.05 : 1.12);
    const d = r / Math.tan(THREE.MathUtils.degToRad(14)) / 0.78;
    const pitch = def.pitch ?? (def.food || def.heap || def.plate || def.basket ? 0.62 : 0.28);
    cam.position.set(ctr.x, ctr.y + Math.sin(pitch) * d, ctr.z + Math.cos(pitch) * d);
    cam.lookAt(ctr);
    await settled();
    renderer.render(scene, cam);
    for (const h of hamsters) h.dispose();
  }
  if (over) {
    // On top of the hamsters: a second canvas over the 3D.
    const top = document.createElement('canvas');
    top.width = top.height = S;
    Object.assign(top.style, { position: 'fixed', left: '0', top: '0', width: `${S}px`, height: `${S}px`, zIndex: '3' });
    document.body.appendChild(top);
    draw2d(top.getContext('2d'), S, def.draw);
  }
}

// ------------------------------------------------------------------ entry

export async function runPoster(name) {
  document.body.classList.add('poster');
  const W = window.innerWidth;
  const H = window.innerHeight;
  await fonts();
  if (name === 'action') await action(W, H);
  else if (name === 'win') await win(W, H);
  else if (name === 'multi') await multi(W, H);
  else if (name === 'icon') await icon(W, H);
  else if (name.startsWith('badge-')) await badge(name.slice(6), Math.min(W, H));
  else if (name.startsWith('plate-')) await plate(Number(name.slice(6)) || 0, W, H);
  else await cover(W, H);
  await sleep(100);
  document.body.dataset.ready = '1';
}
