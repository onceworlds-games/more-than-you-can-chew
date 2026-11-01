// Store art (?poster=cover|action|win|multi|icon|badge-<id>): one staged frame drawn with the game's own renderer.
// No room and no platform UI; document.body.dataset.ready = '1' once it's on screen.

import { createRenderer } from './render.js';
import { createFx, drawScreenParts } from './fx.js';
import { createLocalSession } from './session.js';
import { drawBiscuit, piped, biscuitTexture } from './biscuit.js';
import { drawHamster } from './hamster.js';
import { drawFood, roundRect } from './food.js';
import { buildGround } from './ground.js';
import { arenaById } from './arenas.js';
import { BOTS, GOLDEN } from './config.js';

const INK = '#3B2218';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A round played by eight bots up to `secs`, then frozen: real food, real heaps, real tosses. */
function playedWorld(arena, seed, secs) {
  const s = createLocalSession({
    arena,
    seed,
    me: null,
    bots: BOTS.map((b) => ({ name: b.name, kind: b.kind, coat: b.coat, skill: 0.75 })),
    intro: 0,
  });
  for (let t = 0; t < secs; t += 1 / 60) s.step(1 / 60);
  s.w.drain();
  for (const h of s.w.hams) h.brain = null;
  return s.w;
}

function place(h, x, y, a, o = {}) {
  h.x = x;
  h.y = y;
  h.a = a;
  h.vx = Math.cos(a) * (o.speed ?? 0);
  h.vy = Math.sin(a) * (o.speed ?? 0);
  h.speed = o.speed ?? 0;
  h.fill = o.fill ?? 0;
  h.dashT = o.dash ? 0.1 : 0;
  h.dizzyT = o.dizzy ? 1 : 0;
  h.kbT = 0;
  h.gone = false;
  h.away = false;
}

function food(w, type, x, y) {
  return w.addFood({ id: w.dynId++, type, x, y, bx: x, by: y, tb: 0, land: -1, src: 'open', fx: null, fy: null });
}

/** Clears food from around (x, y) so a staged moment reads. */
function clearAround(w, x, y, r) {
  for (const f of [...w.food.values()]) if (Math.hypot(f.x - x, f.y - y) < r) w.food.delete(f.id);
}

function settleAnims(r, w, extra = {}) {
  for (const h of w.hams) {
    const a = r.anim(h.id);
    a.fill = h.fill;
    a.heap = h.heap;
    a.blinkT = 99;
    a.blink = 0;
    a.gait = h.seat * 1.9 + 0.6;
    Object.assign(a, extra[h.id] || {});
  }
}

function frame(r, w, cx, cy, z, scene = {}) {
  r.camera(w, { mode: 'follow', x: cx, y: cy, snap: true }, 0);
  r.cam.x = cx;
  r.cam.y = cy;
  r.cam.z = z;
  r.draw({ w, me: null, dt: 0, noRing: true, noTags: true, ...scene });
}

// ------------------------------------------------------------------ the posters

function cover(r, fx, W, H) {
  const w = playedWorld(0, 'poster:cover', 46);
  const [gus, pepper, mabel, dot, rocco, fig, bea, clem] = w.hams;
  // The camera sees x 530-1330, y 55-505: Mabel's burrow at the top, the logo over the bottom left.
  const cx = 930;
  const cy = 280;
  const z = 1.6;
  clearAround(w, 1000, 280, 420);
  // Gus, cheeks far past full, eyeing one more cookie; Pepper dashing at him; Mabel taking a load home.
  place(gus, 1095, 262, Math.PI + 0.22, { fill: 134, speed: 30 });
  place(pepper, 1235, 400, -2.36, { fill: 22, speed: 520, dash: true });
  place(mabel, 905, 168, -Math.PI / 2, { fill: 92, speed: 110 });
  place(dot, 700, 215, 0.25, { fill: 40, speed: 150 });
  place(fig, 1250, 130, 2.5, { fill: 20, speed: 180 });
  place(rocco, 805, 320, -0.4, { fill: 66, speed: 140 });
  place(bea, 200, 950, 0, {});
  place(clem, 1600, 950, 0, {});
  mabel.heap = 412;
  const spots = [
    [5, 1020, 248],
    [3, 975, 330],
    [0, 960, 214], [0, 978, 202], [0, 948, 196], [0, 990, 226],
    [1, 1160, 205], [1, 1180, 228],
    [2, 1030, 400], [2, 1062, 418],
    [4, 880, 410],
    [3, 1290, 260],
    [0, 760, 160], [0, 775, 178], [0, 742, 182],
    [2, 690, 290],
    [6, 1150, 330],
    [4, 610, 140],
    [1, 1220, 470],
    [3, 1300, 340],
  ];
  for (const [t, x, y] of spots) food(w, t, x, y);
  fx.dust(1265, 430, 8, 16);
  fx.step(0.12);
  settleAnims(r, w, { [gus.id]: { wob: 0.6 } });
  frame(r, w, cx, cy, z, { leader: mabel.id });
  logo(r.ctx, 40, H - 246, 560);
}

function action(r, fx) {
  const w = playedWorld(1, 'poster:action', 70);
  const [gus, pepper, mabel, dot, ...rest] = w.hams;
  const X = 1050;
  const Y = 760;
  clearAround(w, X, Y, 330);
  rest.forEach((h, i) => place(h, 200 + i * 60, 1100, 0, {}));
  place(gus, X, Y, 0.4, { fill: 0, dizzy: true });
  place(pepper, X - 92, Y + 46, -0.5 + Math.PI, { fill: 24, speed: 120 });
  place(mabel, X + 210, Y - 120, 2.7, { fill: 40, speed: 260 });
  place(dot, X - 200, Y - 130, 0.6, { fill: 70, speed: 220 });
  // The pop: everything in Gus's cheeks sprays out in a ring.
  gus.cheeks = [4, 3, 3, 3, 2, 2, 0];
  gus.fill = 128;
  w.pop(gus, pepper.id);
  w.t += 0.4;
  w.drain();
  fx.ring(X, Y, 150, '#FFF2D9');
  fx.crumbs(X, Y, 26, ['#FF4D6D', '#FFF2D9', '#E3A24F', '#FFCB2E'], 300, 1.2);
  fx.dust(X, Y, 5, 14);
  fx.stars(gus, 1.2);
  fx.text(X, Y - 64, 'POP!', '#FF4D6D', 64, 1.3);
  fx.step(0.1);
  settleAnims(r, w, { [pepper.id]: { sx: 1.1, sy: 0.9 } });
  frame(r, w, X + 5, Y - 10, 2.05);
}

function win(r, fx, W, H) {
  const w = playedWorld(4, 'poster:win', 140);
  const [gus, pepper, mabel] = w.hams;
  const b = mabel.burrow;
  clearAround(w, b.x, b.y, 160);
  mabel.heap = 1240;
  place(mabel, b.x + b.nx * 34 + 30, b.y + b.ny * 34, Math.PI * 0.75, { fill: 0 });
  place(gus, b.x - 190, b.y + b.ny * 110, -0.5, { fill: 40, speed: 60 });
  place(pepper, b.x + 230, b.y + b.ny * 120, Math.PI + 0.4, { fill: 0, dizzy: true });
  settleAnims(r, w, { [mabel.id]: { happy: 1 } });
  fx.confetti(0, 0, W, 180);
  fx.step(1.1);
  frame(r, w, b.x + 10, b.y + b.ny * 70, 2.2, { leader: mabel.id });
  const ctx = r.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawScreenParts(ctx, fx);
  // The round's verdict, on a biscuit.
  ctx.translate(W / 2, H - 150);
  ctx.rotate(-0.03);
  drawBiscuit(ctx, -270, -62, 540, 124, { scale: 1, radius: 26, bite: 'tr' });
  piped(ctx, 'Most food wins!', 0, 0, 56);
  ctx.restore();
}

function multi(r, fx) {
  // Eight players at the campsite, all running for one golden seed.
  const w = playedWorld(5, 'poster:multi', 62);
  const g = w.findLanding(1210, 620, 12);
  clearAround(w, g.x, g.y, 120);
  food(w, GOLDEN, g.x, g.y);
  const spots = [
    [-240, -60, 70],
    [200, -100, 30],
    [-80, 150, 10],
    [150, 130, 50],
    [-300, 100, 110],
    [320, 40, 0],
    [-130, -150, 90],
    [70, -160, 20],
  ];
  const names = new Map();
  const tags = ['Ava', 'Kenji', 'Mo', 'Lucia', 'Sam', 'Priya', 'Theo', 'Zoe'];
  w.hams.forEach((h, i) => {
    const [dx, dy, fill] = spots[i];
    const p = w.findLanding(g.x + dx * 0.8, g.y + dy * 0.85, 26);
    place(h, p.x, p.y, Math.atan2(g.y - p.y, g.x - p.x), { fill, speed: 220, dash: i === 4 || i === 1 });
    names.set(h.id, tags[i]);
  });
  fx.dust(g.x - 300, g.y + 100, 6, 14);
  fx.step(0.1);
  settleAnims(r, w);
  const z = 1.6;
  frame(r, w, g.x, g.y - 10, z, { names, noTags: false });
  // The seed everyone is after shines.
  const ctx = r.ctx;
  const sx = r.vw / 2;
  const sy = r.vh / 2 + 10 * z;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 90);
  glow.addColorStop(0, 'rgba(255,214,90,0.85)');
  glow.addColorStop(0.35, 'rgba(255,203,46,0.35)');
  glow.addColorStop(1, 'rgba(255,203,46,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(sx, sy);
  ctx.scale(z * 1.5, z * 1.5);
  drawFood(ctx, GOLDEN, 12);
  ctx.restore();
}

function icon(r, W, H) {
  const ctx = r.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // The blanket, then one hamster with cheeks far past full.
  const A = arenaById(0);
  const g = buildGround(A, 1.4);
  ctx.drawImage(g, 760 * 1.4, 480 * 1.4, 380 * 1.4, 380 * 1.4, 0, 0, W, H);
  ctx.save();
  ctx.translate(W * 0.47, H * 0.56);
  const s = W / 74;
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(59,34,24,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 5, 25, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  drawHamster(ctx, { x: 0, y: 0, a: -Math.PI / 2, fill: 128, coat: 3, seat: 4, t: 0.4, gait: 0.6, speed: 0, wob: 0.3, bite: 0.4, sx: 1, sy: 1, sway: 0, blink: 0, dizzy: 0, happy: 0, away: false, crown: false });
  ctx.restore();
  ctx.save();
  ctx.translate(W * 0.8, H * 0.2);
  ctx.rotate(0.3);
  ctx.scale(s * 0.62, s * 0.62);
  drawFood(ctx, 5, 18);
  ctx.restore();
}

// ------------------------------------------------------------------ badges

const BADGE_DISC = {
  'first-bite': '#5E9E3F',
  'chipmunk-cheeks': '#FF4D6D',
  pop: '#D8413A',
  bully: '#3FA7F2',
  'golden-seed': '#3B2218',
  hoarder: '#9A5BEA',
  'clean-plate': '#2DC38A',
  'buzzer-beater': '#FF8424',
  'daily-crumbs': '#16B3AE',
  'picnic-season': '#FFCB2E',
};

function badge(ctx, id, S) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  const c = S / 2;
  const R = S * 0.44;
  ctx.fillStyle = 'rgba(59,34,24,0.35)';
  ctx.beginPath();
  ctx.arc(c + 3, c + 6, R, 0, Math.PI * 2);
  ctx.fill();
  const col = BADGE_DISC[id] || '#E3A24F';
  const g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R);
  g.addColorStop(0, lighten(col, 0.28));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = S * 0.035;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = S * 0.018;
  ctx.beginPath();
  ctx.arc(c, c, R * 0.86, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  ctx.save();
  ctx.translate(c, c);
  const u = S / 256;
  ctx.scale(u, u);
  symbol(ctx, id);
  ctx.restore();
}

function lighten(hex, t) {
  const p = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(v + (255 - v) * t);
  return `rgb(${ch((p >> 16) & 255)},${ch((p >> 8) & 255)},${ch(p & 255)})`;
}

function ham(ctx, x, y, k, o) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  drawHamster(ctx, { x: 0, y: 0, a: -Math.PI / 2, fill: 0, coat: 0, seat: 0, t: 0.3, gait: 0.6, speed: 0, wob: 0, bite: 0, sx: 1, sy: 1, sway: 0, blink: 0, dizzy: 0, happy: 0, away: false, crown: false, ...o });
  ctx.restore();
}

function piece(ctx, type, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  drawFood(ctx, type, r);
  ctx.restore();
}

function burst(ctx, r1, r2, n, fill) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r2 : r1;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function symbol(ctx, id) {
  switch (id) {
    case 'first-bite':
      piece(ctx, 0, 0, 0, 52, -0.5);
      break;
    case 'chipmunk-cheeks':
      ham(ctx, 0, 10, 2.25, { fill: 132, coat: 1, seat: 0, wob: 0.2 });
      break;
    case 'pop':
      burst(ctx, 82, 50, 10, '#FFF2D9');
      piece(ctx, 0, -40, -44, 15, 0.4);
      piece(ctx, 2, 44, -30, 18);
      piece(ctx, 1, 40, 42, 16);
      piece(ctx, 3, -44, 36, 18, 0.6);
      piece(ctx, 0, 0, 2, 20, 1.1);
      break;
    case 'bully':
      ctx.strokeStyle = '#FFF2D9';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      for (const y of [-26, 0, 26]) {
        ctx.beginPath();
        ctx.moveTo(-86, y + 8);
        ctx.lineTo(-50, y + 8);
        ctx.stroke();
      }
      ctx.save();
      ctx.rotate(Math.PI / 2);
      ham(ctx, 0, -6, 2.5, { coat: 4, seat: 1, sx: 1.12, sy: 0.88 });
      ctx.restore();
      break;
    case 'golden-seed':
      ctx.fillStyle = 'rgba(255,214,90,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.fill();
      piece(ctx, GOLDEN, 0, 0, 56, -0.5);
      break;
    case 'hoarder': {
      const pile = [
        [0, -40, 5],
        [-44, 4, 4],
        [40, 2, 3],
        [-12, 30, 5],
        [52, 44, 2],
        [-58, 50, 1],
        [12, -4, 0],
        [24, 56, 1],
      ];
      for (const [x, y, t] of pile) piece(ctx, t, x, y, [8, 13, 14, 20, 22, 30][t], x * 0.01);
      break;
    }
    case 'clean-plate':
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#D9DEE2';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(30, -30);
      burst(ctx, 22, 8, 4, '#FFCB2E');
      ctx.restore();
      break;
    case 'buzzer-beater': {
      // The timer biscuit, nibbled to its last sliver.
      ctx.fillStyle = '#E3A24F';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 70, -Math.PI / 2 + 0.6, Math.PI * 1.5);
      ctx.setLineDash([10, 12]);
      ctx.strokeStyle = 'rgba(255,242,217,0.7)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFF2D9';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'daily-crumbs': {
      ctx.save();
      ctx.rotate(-0.12);
      ctx.beginPath();
      roundRect(ctx, -62, -60, 124, 124, 18);
      ctx.fillStyle = '#FFF2D9';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      roundRect(ctx, -62, -60, 124, 36, 18);
      ctx.fillStyle = '#D8413A';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      piece(ctx, 3, -4, 22, 30, 0.2);
      piece(ctx, 0, 34, 40, 10, 1);
      piece(ctx, 0, -38, 46, 9, 2);
      break;
    }
    case 'picnic-season':
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 78, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#FFF2D9';
      ctx.fillRect(-80, -80, 160, 160);
      ctx.fillStyle = 'rgba(216,65,58,0.55)';
      for (let i = -80; i < 80; i += 32) {
        ctx.fillRect(i, -80, 16, 160);
        ctx.fillRect(-80, i, 160, 16);
      }
      ctx.restore();
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, 78, 0, Math.PI * 2);
      ctx.stroke();
      ham(ctx, 0, 6, 2.6, { coat: 7, seat: 5, happy: 1, crown: true });
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ the logo (cover only)

function logo(ctx, x, y, w) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(x + w / 2, y + 100);
  ctx.rotate(-0.035);
  drawBiscuit(ctx, -w / 2, -100, w, 200, { scale: 1, radius: 34, bite: 'tr' });
  piped(ctx, 'More Than', -w / 2 + 40, -46, 46, { align: 'left' });
  piped(ctx, 'You Can', -w / 2 + 40, 28, 64, { align: 'left' });
  ctx.font = '64px Shrikhand';
  const tw = ctx.measureText('You Can ').width;
  piped(ctx, 'Chew', -w / 2 + 40 + tw, 28, 64, { align: 'left', color: '#FF4D6D' });
  ctx.restore();
}

// ------------------------------------------------------------------ screens (debug: every screen at any size)

async function screen(kind, r, W, H) {
  const { createUi } = await import('./ui.js');
  const { createHud } = await import('./hud.js');
  const { COATS } = await import('./config.js');
  const portrait = H > W * 1.1 && W < 700;
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('short', H < 560);
  const ui = createUi(document.getElementById('ui'), {});
  document.getElementById('ui').style.display = '';
  const w = playedWorld(0, 'poster:screens', kind === 'play' ? 40 : 90);
  const me = w.hams[0];
  me.name = 'You';
  const names = ['You', 'Pepper', 'Mabel', 'Dot', 'Rocco', 'Fig', 'Bea', 'Clem'];
  const rows = w.standings().map((st, i) => {
    const h = w.byId.get(st.id);
    return { name: h === me ? 'You' : h.name, me: h === me, heap: String(st.heap), total: String(st.heap * 2 + 40), place: st.place, coat: h.coat, seat: h.seat };
  });
  const top = 80;
  const lobby = (sheet) => ({
    portrait,
    top: portrait ? 64 : top,
    sideTop: Math.round(H * 0.42),
    seats: names.map((n, i) => ({ name: n, me: i === 0, ready: i < 2, host: i === 0, coat: BOTS[i].coat % 8, seat: i })),
    isHost: true,
    canInvite: false,
    arenaName: 'Picnic Blanket',
    twist: 'The classic',
    rounds: 3,
    bots: 'normal',
    coat: 2,
    mySeat: 0,
    coatName: COATS[2].name,
    coatLocked: '',
    picnicsWon: 3,
    sheet,
    standalone: false,
  });
  let flowWorld = w;
  if (kind === 'lobby' || kind === 'settings' || kind === 'coat') {
    const s = createLocalSession({ arena: 0, seed: 'practice:0', me: { id: 'me', name: 'You', coat: 2 }, bots: BOTS.slice(0, 7).map((b) => ({ name: b.name, coat: b.coat, kind: b.kind, skill: 0.5 })), practice: true, intro: 0 });
    for (let t = 0; t < 4; t += 1 / 60) s.step(1 / 60, () => ({ mx: 0.6, my: 0.3, dash: false }));
    flowWorld = s.w;
    ui.render('lobby', lobby(kind === 'lobby' ? null : kind));
  } else if (kind === 'title') ui.render('title', { best: '1,240', keys: true });
  else if (kind === 'board') ui.render('board', { title: 'Round 2 of 3', rows, why: 'Mabel: 9 trips, never popped', next: 'Next round in 6', canSkip: true, top: portrait ? 64 : 12 });
  else if (kind === 'results')
    ui.render('results', { podium: rows.slice(0, 3).map((x) => ({ ...x, total: x.total })), myPlace: 2, headline: 'Results', lines: [{ text: 'Total 1,032' }, { text: 'New best round! 612', best: true }], canNext: true, next: '' });
  else if (kind === 'solo') ui.render('solo', { place: 1, podium: rows.slice(0, 3), lines: [{ text: 'Your heap 702' }, { text: 'Kitchen Counter is open!', best: true }], canNext: true });
  else if (kind === 'picnics') {
    const { ARENAS } = await import('./arenas.js');
    const plates = ARENAS.map((a, i) => {
      let mini = '';
      if (i < 4) {
        const g = buildGround(a, Math.min(112 / a.w, 75 / a.h) * 2);
        mini = g.toDataURL('image/jpeg', 0.85);
      }
      return { name: a.name, twist: a.twist, won: i < 3, best: i < 4 ? String(400 + i * 37) : '', locked: i >= 4, unlock: `Win Picnic ${i}`, mini };
    });
    ui.render('picnics', { plates, sel: 3 });
  } else if (kind === 'daily') {
    const g = buildGround(arenaById(5), Math.min(220 / 1800, 147 / 1200) * 2);
    ui.render('daily', { date: 'Nov 1', mini: g.toDataURL('image/jpeg', 0.85), arenaName: 'Campsite', twist: 'Two bridges', best: '588', rank: 4, top: [{ name: 'Ann', score: 811 }, { name: 'Bo', score: 760 }, { name: 'Cy', score: 702 }, { name: 'Di', score: 640 }, { name: 'You', score: 588 }] });
  } else if (kind === 'pause') ui.render('pause');
  else if (kind === 'closed') ui.render('closed', { text: 'Connection lost', button: 'Rejoin' });
  settleAnims(r, flowWorld);
  const focus = kind === 'lobby' || kind === 'settings' || kind === 'coat' ? flowWorld.byId.get('me') : me;
  const over = kind === 'board' || kind === 'results' || kind === 'solo';
  if (over) {
    r.camera(flowWorld, { mode: 'overview' }, 0);
    r.draw({ w: flowWorld, me: null, dt: 0, noRing: true, noTags: true });
  } else if (kind === 'title' || kind === 'closed') {
    frame(r, flowWorld, 900, 600, r.zoom() * 0.85);
  } else {
    place(me, me.x, me.y, me.a, { fill: kind === 'play' ? 112 : 30, speed: 120 });
    settleAnims(r, flowWorld, { [me.id]: { wob: 0.4 } });
    r.camera(flowWorld, { mode: 'follow', x: focus.x, y: focus.y, snap: true }, 0);
    r.draw({ w: flowWorld, me: focus.id, dt: 0, practice: kind !== 'play', leader: kind === 'play' ? w.leader()?.id : null });
  }
  if (kind === 'play') {
    const hud = createHud(r);
    const reserved = [{ kind: 'menu', x: 10, y: 10, w: 120, h: 44 }];
    if (W < 900) reserved.push({ kind: 'stick', x: 0, y: H - 200, w: 200, h: 200 }, { kind: 'buttons', x: W - 140, y: H - 160, w: 140, h: 160 });
    const st = w.standings();
    const mine = st.find((x) => x.id === me.id);
    hud.draw({
      dt: 0,
      reserved,
      timer: { left: 24, total: 150 },
      place: { place: mine.place, heap: String(me.heap), leaderHeap: mine.place > 1 ? String(st[0].heap) : null },
      arrows: [{ kind: 'home', x: me.burrow.x, y: me.burrow.y, seat: me.seat, pulse: true }, { kind: 'gold', x: 1700, y: 300 }],
      hint: { text: 'Full? Go home!', x: me.x, y: me.y, age: 0.5, life: 2.6, hot: false },
    });
  }
  if (kind === 'intro') {
    const hud = createHud(r);
    hud.draw({ dt: 0, reserved: [{ kind: 'menu', x: 10, y: 10, w: 120, h: 44 }], timer: { left: 150, total: 150 }, big: { kind: 'banner', text: 'Round 1', sub: 'of 3', u: 0.5 } });
  }
  if (kind === 'watch') {
    const hud = createHud(r);
    hud.draw({ dt: 0, reserved: [{ kind: 'menu', x: 10, y: 10, w: 120, h: 44 }], timer: { left: 88, total: 150 }, tag: 'Watching · next round' });
  }
}

// ------------------------------------------------------------------ entry

export async function runPoster(name, params) {
  const canvas = document.getElementById('game');
  // The page's size (the tools also say it in ?w= and ?h=; a frame can still be laying out).
  for (let i = 0; i < 40 && !(window.innerWidth > 0); i++) await sleep(50);
  const W = Number(params && params.get('w')) || window.innerWidth;
  const H = Number(params && params.get('h')) || window.innerHeight;
  document.getElementById('ui').style.display = 'none';
  await Promise.race([Promise.all([document.fonts.load('64px Shrikhand'), document.fonts.load('800 20px "Bricolage Grotesque"')]), sleep(2500)]);
  try {
    document.documentElement.style.setProperty('--tex', `url(${biscuitTexture(192).toDataURL()})`);
  } catch {
    /* not needed on canvas */
  }
  const fx = createFx();
  const r = createRenderer(canvas, fx);
  r.resize(W, H, 1);
  if (name.startsWith('badge-')) badge(r.ctx, name.slice(6), Math.min(W, H));
  else if (name === 'cover') cover(r, fx, W, H);
  else if (name === 'action') action(r, fx);
  else if (name === 'win') win(r, fx, W, H);
  else if (name === 'multi') multi(r, fx);
  else if (name === 'icon') icon(r, W, H);
  else if (name.startsWith('screen-')) await screen(name.slice(7), r, W, H);
  else throw new Error(`no poster "${name}"`);
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  document.body.dataset.ready = '1';
}
