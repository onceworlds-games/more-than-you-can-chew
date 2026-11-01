// The world on screen: camera, ground, burrows and heaps, shadows of what's coming (the hand, the golden seed's light,
// the cat's paw), food, hamsters, the night, juice. The HUD is drawn over it by hud.js.

import { FOODS, GOLDEN, SEATS, PORCH_R, CAP, MAX, PAW } from './config.js';
import { buildGround, OUTSIDE } from './ground.js';
import { foodSprites, makeCanvas } from './food.js';
import { drawHamster, emblemPath } from './hamster.js';
import { drawParts } from './fx.js';
import { pawAt } from './schedule.js';
import { unit } from './rng.js';

const INK = '#3B2218';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Screen px per world px for a viewport (CSS px). */
export const baseZoom = (vw, vh) => clamp(Math.sqrt((vw * vh) / 600000), 0.62, 1.5);

export function createRenderer(canvas, fx) {
  const ctx = canvas.getContext('2d');
  let vw = 1;
  let vh = 1;
  let dpr = 1;
  let zoom = 1;
  const cam = { x: 900, y: 600, z: 1, ready: false, shake: { x: 0, y: 0, a: 0 } };
  let ground = null;
  let groundKey = '';
  let disc = null;
  let sprites = null;
  let spriteScale = 0;
  let pollen = [];
  let dapple = null;
  let night = null;
  const anims = new Map();
  let time = 0;

  const r = {
    ctx,
    cam,
    get vw() {
      return vw;
    },
    get vh() {
      return vh;
    },
    get dpr() {
      return dpr;
    },
    resize(w, h, ratio) {
      vw = Math.max(1, w);
      vh = Math.max(1, h);
      dpr = ratio;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      zoom = baseZoom(vw, vh);
      groundKey = '';
      night = null;
    },
    /** Per-hamster animation state (gait, cheek spring, blinks...). */
    anim(id) {
      let a = anims.get(id);
      if (!a) {
        a = { gait: 0, wob: 0, wobV: 0, bite: 0, sq: 0, sqV: 0, blinkT: 1 + Math.random() * 3, blink: 0, happy: 0, fill: 0, heap: 0, heapT: 0, lastX: null, lastY: null, sway: 0 };
        anims.set(id, a);
      }
      return a;
    },
    resetAnims() {
      anims.clear();
    },
    /** A bite: the cheeks gulp (overshoot) and the head dips. */
    gulp(id, size) {
      const a = r.anim(id);
      a.wobV += 2.2 + size * 0.12;
      a.bite = 1;
    },
    squash(id, amount) {
      const a = r.anim(id);
      a.sqV -= amount;
    },
    happy(id, sec = 0.8) {
      r.anim(id).happy = sec;
    },
    toScreen(x, y) {
      return { x: (x - cam.x) * cam.z + vw / 2, y: (y - cam.y) * cam.z + vh / 2 };
    },
    toWorld(sx, sy) {
      return { x: (sx - vw / 2) / cam.z + cam.x, y: (sy - vh / 2) / cam.z + cam.y };
    },
    zoom: () => zoom,
    /** Moves the camera toward its target. view: { mode: 'follow'|'overview'|'drift', x, y, vx, vy, snap, touch }. */
    camera(w, view, dt) {
      const A = w.arena;
      let tz = zoom;
      let tx = cam.x;
      let ty = cam.y;
      if (view.mode === 'overview') {
        tz = Math.min(vw / A.w, (vh - (view.padTop || 0) - (view.padBottom || 0)) / A.h) * 0.97;
        tx = A.w / 2;
        ty = A.h / 2 - ((view.padTop || 0) - (view.padBottom || 0)) / 2 / tz;
      } else if (view.mode === 'drift') {
        tz = zoom * 0.9;
        const t = time * 0.05;
        tx = A.w / 2 + Math.sin(t) * A.w * 0.22;
        ty = A.h / 2 + Math.sin(t * 1.7 + 1) * A.h * 0.16;
      } else {
        tz = zoom;
        const look = 0.25;
        tx = view.x + clamp((view.vx || 0) * look, -60, 60);
        ty = view.y + clamp((view.vy || 0) * look, -60, 60);
        if (view.touch && vh > vw) ty += (vh * 0.1) / tz;
      }
      if (!cam.ready || view.snap) {
        cam.x = tx;
        cam.y = ty;
        cam.z = tz;
        cam.ready = true;
      } else {
        const k = 1 - Math.exp(-dt / (view.mode === 'follow' ? 0.18 : 0.6));
        cam.z += (tz - cam.z) * (1 - Math.exp(-dt / 0.5));
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
      }
      // Keep the arena filling the screen where it can.
      const hw = vw / 2 / cam.z;
      const hh = vh / 2 / cam.z;
      const mx = 30;
      cam.x = A.w + mx * 2 > hw * 2 ? clamp(cam.x, hw - mx, A.w + mx - hw) : A.w / 2;
      cam.y = A.h + mx * 2 > hh * 2 ? clamp(cam.y, hh - mx, A.h + mx - hh) : A.h / 2;
    },
    /** Draws one frame of the world. scene: { w, me, leader, names, practice, dt } */
    draw(scene) {
      const w = scene.w;
      const A = w.arena;
      const dt = scene.dt || 0;
      time += dt;
      ensure(A);
      const sh = fx.offset();
      cam.shake = sh;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = OUTSIDE[A.ground] || '#4F8A34';
      ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.translate(vw / 2, vh / 2);
      ctx.rotate(sh.a);
      ctx.scale(cam.z, cam.z);
      ctx.translate(-cam.x + sh.x, -cam.y + sh.y);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(ground, 0, 0, A.w, A.h);
      const view = { x0: cam.x - vw / 2 / cam.z - 80, y0: cam.y - vh / 2 / cam.z - 80, x1: cam.x + vw / 2 / cam.z + 80, y1: cam.y + vh / 2 / cam.z + 80 };
      if (A.disc) drawDisc(w);
      drawBurrows(w, scene, dt);
      drawTosses(w);
      drawGoldens(w);
      drawPawBand(w);
      drawFood(w, view);
      if (A.dark) {
        drawHamsterLayer(w, scene, dt, view);
        drawNight(w, scene);
        drawGoldenGlow(w, view);
      } else {
        drawHamsterLayer(w, scene, dt, view);
      }
      drawLive(w);
      drawParts(ctx, fx, cam.z);
      drawPaw(w);
      if (A.ground === 'gingham' || A.ground === 'camp' || A.ground === 'lawn') drawDapple(view, A);
      drawTags(w, scene, view);
      ctx.restore();
      drawPollen(A, dt);
    },
  };

  // ------------------------------------------------------------------ caches

  function ensure(A) {
    const gs = Math.min(2, zoom * dpr * 1.05);
    const cap = 9e6;
    const scale = Math.min(gs, Math.sqrt(cap / (A.w * A.h)));
    const key = `${A.id}|${scale.toFixed(2)}`;
    if (key !== groundKey) {
      ground = buildGround(A, scale);
      groundKey = key;
      disc = A.disc ? buildDisc(A, scale) : null;
      dapple = null;
      pollen = [];
    }
    const ss = Math.round(zoom * dpr * 4) / 4 || 1;
    if (!sprites || ss !== spriteScale) {
      sprites = foodSprites(Math.max(1, ss));
      spriteScale = Math.max(1, ss);
    }
  }

  function buildDisc(A, scale) {
    const d = A.disc;
    const size = Math.ceil((d.r * 2 + 20) * scale);
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    g.scale(scale, scale);
    g.translate(d.r + 10, d.r + 10);
    g.fillStyle = 'rgba(30,10,10,0.3)';
    g.beginPath();
    g.arc(6, 8, d.r, 0, Math.PI * 2);
    g.fill();
    const grad = g.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 20, 0, 0, d.r);
    grad.addColorStop(0, '#C98C55');
    grad.addColorStop(1, '#8E5730');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, d.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(70,35,15,0.25)';
    for (let k = 1; k < 24; k++) {
      g.lineWidth = 1 + (k % 3);
      g.beginPath();
      g.arc(0, 0, (d.r * k) / 24, 0, Math.PI * 2);
      g.stroke();
    }
    // Spokes so the turning reads.
    g.strokeStyle = 'rgba(255,235,200,0.35)';
    g.lineWidth = 6;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 90, Math.sin(a) * 90);
      g.lineTo(Math.cos(a) * (d.r - 30), Math.sin(a) * (d.r - 30));
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(0, 0, d.r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#E8C08A';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, d.r - 10, 0, Math.PI * 2);
    g.stroke();
    // A lace doily.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      g.beginPath();
      g.arc(Math.cos(a) * 112, Math.sin(a) * 112, 16, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, 112, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(200,190,170,0.6)';
    g.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(0, 0, 70 + k * 10, 0, Math.PI * 2);
      g.stroke();
    }
    return c;
  }

  // ------------------------------------------------------------------ layers

  function drawDisc(w) {
    const d = w.arena.disc;
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.w * w.t);
    ctx.drawImage(disc, -d.r - 10, -d.r - 10, d.r * 2 + 20, d.r * 2 + 20);
    ctx.restore();
    // The teapot stays put on its spindle.
    const tp = w.arena.obstacles[0];
    ctx.save();
    ctx.fillStyle = 'rgba(59,34,24,0.28)';
    ctx.beginPath();
    ctx.arc(tp.x + 14, tp.y + 16, tp.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawTeapot(tp);
  }

  function drawTeapot(o) {
    const { x, y, r: R } = o;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#F6F3EE';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + R * 0.7, y - 10);
    ctx.lineTo(x + R + 34, y - 18);
    ctx.lineTo(x + R + 36, y - 6);
    ctx.lineTo(x + R * 0.7, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x - R - 12, y, 18, 12, 0, 0, Math.PI * 2);
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = '#F6F3EE';
    ctx.lineWidth = 5;
    ctx.stroke();
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.6, '#F1ECE4');
    g.addColorStop(1, '#C9C1B4');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = '#2E5E9E';
    ctx.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, R * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  function heapSpot(b) {
    const px = -b.ny;
    const py = b.nx;
    return { x: b.x - b.nx * 2 + px * 64, y: b.y - b.ny * 2 + py * 64 };
  }
  r.heapSpot = heapSpot;

  // Food in a heap: the same mix every time for the same heap.
  const PILE = [0, 1, 0, 2, 3, 0, 1, 4, 2, 0, 5, 1, 3, 0, 2, 1, 4, 0, 3, 1];

  function drawBurrows(w, scene, dt) {
    const meH = scene.me ? w.byId.get(scene.me) : null;
    for (const h of w.hams) {
      const b = h.burrow;
      const seat = SEATS[h.seat % SEATS.length];
      const mine = meH === h;
      // Porch: a dashed ring in the seat colour.
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = mine ? 'rgba(255,242,217,0.16)' : 'rgba(255,242,217,0.08)';
      ctx.beginPath();
      ctx.arc(0, 0, PORCH_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(time * 0.25);
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = mine ? 5 : 3.5;
      ctx.strokeStyle = INK;
      ctx.globalAlpha = mine ? 0.55 : 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, PORCH_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = mine ? 1 : 0.7;
      ctx.lineWidth = mine ? 3 : 2;
      ctx.strokeStyle = seat.color;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // The hole.
      const hx = b.x - b.nx * 6;
      const hy = b.y - b.ny * 6;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(Math.atan2(b.ny, b.nx));
      const g = ctx.createRadialGradient(-4, 0, 2, 0, 0, 26);
      g.addColorStop(0, '#0E0705');
      g.addColorStop(0.7, '#2A160D');
      g.addColorStop(1, '#5A3A22');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 21, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Seat emblem on a little stake at the hole's back.
      ctx.restore();
      ctx.save();
      ctx.translate(hx - b.nx * 30, hy - b.ny * 30);
      ctx.fillStyle = seat.color;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      emblemPath(ctx, seat.emblem, 6);
      ctx.fill();
      ctx.restore();
      drawHeap(h, w, scene, dt, mine);
    }
  }

  function drawHeap(h, w, scene, dt, mine) {
    const a = r.anim(h.id);
    const target = h.heap;
    // The flag's number counts up.
    if (a.heap < target) a.heap = Math.min(target, a.heap + Math.max(40, (target - a.heap) * 4) * dt);
    else a.heap = target;
    const shown = Math.round(a.heap);
    const p = heapSpot(h.burrow);
    const count = Math.min(34, Math.ceil(shown / 14));
    const R = 8 + Math.min(34, Math.sqrt(shown) * 1.25);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (count > 0) {
      ctx.fillStyle = 'rgba(59,34,24,0.25)';
      ctx.beginPath();
      ctx.ellipse(5, 7, R + 8, (R + 8) * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < count; i++) {
      const d = Math.sqrt(1 - i / Math.max(1, count)) * R;
      const ang = i * 2.39996 + h.seat;
      const type = PILE[(i + h.seat * 3) % PILE.length];
      const s = sprites[type];
      const sz = (s.half * 2) / spriteScale;
      const lift = (1 - d / (R + 1)) * 10;
      ctx.save();
      ctx.translate(Math.cos(ang) * d, Math.sin(ang) * d * 0.85 - lift);
      ctx.rotate(ang * 3);
      ctx.drawImage(s.canvas, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    // Toothpick flag with the number.
    const seat = SEATS[h.seat % SEATS.length];
    const zs = 1 / Math.max(0.75, cam.z);
    const pole = 34 + R * 0.6;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -pole);
    ctx.stroke();
    ctx.strokeStyle = '#F2D9A8';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    const label = String(shown);
    ctx.font = `800 ${Math.round(17 * zs)}px "Bricolage Grotesque", system-ui, sans-serif`;
    const tw = Math.max(26 * zs, ctx.measureText(label).width + 16 * zs);
    const fh = 24 * zs;
    const wave = Math.sin(time * 3 + h.seat) * 1.5;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(1, -pole - 1.5);
    ctx.lineTo(tw + 2, -pole - 1.5 + wave);
    ctx.lineTo(tw + 2, -pole + fh + 1.5 + wave);
    ctx.lineTo(1, -pole + fh + 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mine ? '#FFF2D9' : seat.color;
    ctx.beginPath();
    ctx.moveTo(2, -pole);
    ctx.lineTo(tw, -pole + wave);
    ctx.lineTo(tw, -pole + fh + wave);
    ctx.lineTo(2, -pole + fh);
    ctx.closePath();
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = mine ? INK : '#FFFFFF';
    if (!mine) {
      ctx.lineWidth = 3 * zs;
      ctx.strokeStyle = INK;
      ctx.lineJoin = 'round';
      ctx.strokeText(label, 2 + tw / 2, -pole + fh / 2 + wave / 2 + 1);
    }
    ctx.fillText(label, 2 + tw / 2, -pole + fh / 2 + wave / 2 + 1);
    ctx.restore();
  }

  function softBlob(x, y, rx, ry, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx);
    g.addColorStop(0, `rgba(40,22,14,${alpha})`);
    g.addColorStop(1, 'rgba(40,22,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A giant hand's shadow: palm and fingers pointing along `ang`. */
  function handShadow(x, y, ang, s, alpha) {
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    softBlob(x, y, 120 * s, 100 * s, ang, alpha);
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * 34 * s;
      const len = (k === 0 || k === 3 ? 70 : 88) * s;
      const fx = x + c * (95 * s + len * 0.5) - sn * off;
      const fy = y + sn * (95 * s + len * 0.5) + c * off;
      softBlob(fx, fy, len * 0.75, 22 * s, ang, alpha * 0.95);
    }
    const tx = x + c * 40 * s - sn * 110 * s;
    const ty = y + sn * 40 * s + c * 110 * s;
    softBlob(tx, ty, 62 * s, 24 * s, ang + 0.9, alpha * 0.9);
  }

  function drawTosses(w) {
    const t = w.t;
    for (const ts of w.sched.tosses) {
      if (t < ts.at - 0.4 || t > ts.land + 0.5) continue;
      const ang = unit('hand', w.seed, ts.i) * Math.PI * 2;
      let u;
      if (t < ts.land) u = clamp((t - (ts.at - 0.4)) / (ts.land - ts.at + 0.4), 0, 1);
      else u = 1 - clamp((t - ts.land) / 0.5, 0, 1);
      const e = 1 - (1 - u) * (1 - u);
      const dist = 140 + (1 - e) * 700;
      const hx = ts.x - Math.cos(ang) * dist;
      const hy = ts.y - Math.sin(ang) * dist;
      handShadow(hx, hy, ang, 1.15, 0.2 * Math.min(1, u * 2));
    }
  }

  function drawGoldens(w) {
    const t = w.t;
    for (const g of w.sched.goldens) {
      if (t < g.at || t > g.land + 0.8) continue;
      if (w.gone[g.i] && t > g.land) continue;
      const u = clamp((t - g.at) / (g.land - g.at), 0, 1);
      const fade = t > g.land ? 1 - (t - g.land) / 0.8 : 1;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.globalAlpha = fade;
      const R = 50 + u * 40;
      const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, R);
      gr.addColorStop(0, 'rgba(255,248,200,0.85)');
      gr.addColorStop(0.5, 'rgba(255,214,80,0.4)');
      gr.addColorStop(1, 'rgba(255,214,80,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(time * 0.8);
      ctx.fillStyle = 'rgba(255,240,170,0.35)';
      for (let k = 0; k < 8; k++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, -R * 1.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawGoldenGlow(w, view) {
    // At night golden seeds always show: drawn again over the dark.
    for (const f of w.food.values()) {
      if (f.type !== GOLDEN || w.t < f.land) continue;
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) continue;
      const gr = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 40);
      gr.addColorStop(0, 'rgba(255,230,120,0.6)');
      gr.addColorStop(1, 'rgba(255,230,120,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 40, 0, Math.PI * 2);
      ctx.fill();
      foodAt(f, f.x, f.y, 1, 0);
    }
  }

  function drawPawBand(w) {
    const t = w.t;
    for (const s of w.sched.sweeps) {
      if (t < s.at || t > s.end + 0.3) continue;
      const warn = t < s.swat;
      const u = warn ? (t - s.at) / (s.swat - s.at) : 1 - clamp((t - s.end) / 0.3, 0, 1);
      ctx.save();
      ctx.translate(s.px, s.py);
      ctx.rotate(Math.atan2(s.dy, s.dx));
      const half = PAW.band / 2;
      const len0 = s.from - 200;
      const len1 = s.to + 200;
      const gr = ctx.createLinearGradient(0, -half, 0, half);
      const a = (warn ? 0.1 + u * 0.22 : 0.3) * (warn ? 1 : u);
      gr.addColorStop(0, `rgba(40,20,30,0)`);
      gr.addColorStop(0.18, `rgba(40,20,30,${a})`);
      gr.addColorStop(0.82, `rgba(40,20,30,${a})`);
      gr.addColorStop(1, `rgba(40,20,30,0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(len0, -half, len1 - len0, half * 2);
      if (warn) {
        // Claw-mark chevrons run along the band toward the swat.
        ctx.strokeStyle = `rgba(255,77,109,${0.25 + u * 0.45})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        const step = 120;
        const off = (time * 260) % step;
        for (let x = len0 + off; x < len1; x += step) {
          ctx.beginPath();
          ctx.moveTo(x - 18, -26);
          ctx.lineTo(x + 6, 0);
          ctx.lineTo(x - 18, 26);
          ctx.stroke();
        }
        // The paw's shadow gathering at the start of its line.
        const g = 0.4 + u * 0.6;
        pawShape(s.from - 60, 0, 1.1 * g, 0.12 + u * 0.25);
      }
      ctx.restore();
    }
  }

  function pawShape(x, y, s, alpha) {
    softBlob(x, y, 95 * s, 85 * s, 0, alpha);
    for (let k = 0; k < 4; k++) {
      const a = -0.75 + k * 0.5;
      softBlob(x + Math.cos(a) * 105 * s, y + Math.sin(a) * 105 * s, 36 * s, 32 * s, a, alpha);
    }
  }

  function drawPaw(w) {
    const t = w.t;
    for (const s of w.sched.sweeps) {
      const along = pawAt(s, t);
      if (along === null) continue;
      ctx.save();
      ctx.translate(s.px, s.py);
      ctx.rotate(Math.atan2(s.dy, s.dx));
      // Motion trail, then the paw, dark and sharp.
      for (let k = 4; k >= 1; k--) pawShape(along - k * 55, 0, 1.25, 0.08);
      pawShape(along, 0, 1.25, 0.5);
      ctx.restore();
    }
  }

  function foodAt(f, x, y, scale, rot) {
    const s = sprites[f.type];
    const sz = ((s.half * 2) / spriteScale) * scale;
    if (rot) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(s.canvas, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    } else ctx.drawImage(s.canvas, x - sz / 2, y - sz / 2, sz, sz);
  }

  function drawFood(w, view) {
    const t = w.t;
    const flying = [];
    for (const f of w.food.values()) {
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) {
        if (!(f.src === 'spill' && t < f.land)) continue;
      }
      const R = FOODS[f.type].r;
      const rot = ((f.id * 2.399) % (Math.PI * 2)) * 0.6 + (w.arena.disc && t >= f.land ? w.arena.disc.w * (t - f.tb) * (onDiscBase(w, f) ? 1 : 0) : 0);
      if (t < f.land) {
        flying.push(f);
        continue;
      }
      // Shadow, then the piece (a little bounce just after landing).
      const since = t - f.land;
      let sc = 1;
      if (since < 0.3) sc = 1 + Math.sin((since / 0.3) * Math.PI) * 0.18;
      ctx.fillStyle = 'rgba(59,34,24,0.28)';
      ctx.beginPath();
      ctx.ellipse(f.x + R * 0.25, f.y + R * 0.35, R * 0.95, R * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      foodAt(f, f.x, f.y, sc, rot);
      if (f.type === GOLDEN) glint(f.x, f.y, f.id);
    }
    // In the air: shadows growing where they'll land, the piece dropping in.
    for (const f of flying) {
      const R = FOODS[f.type].r;
      if (f.src === 'spill' && f.fx !== null) {
        const ft = f.ft ?? f.land - 0.45;
        const u = clamp((t - ft) / Math.max(0.05, f.land - ft), 0, 1);
        const x = f.fx + (f.x - f.fx) * u;
        const y = f.fy + (f.y - f.fy) * u;
        const z = Math.sin(u * Math.PI) * 70;
        ctx.fillStyle = 'rgba(59,34,24,0.22)';
        ctx.beginPath();
        ctx.ellipse(x + 3, y + 4, R * 0.8, R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        foodAt(f, x, y - z, 1 + z / 300, u * 9 + f.id);
      } else {
        const lead = f.src === 'golden' ? 2 : 1;
        const u = clamp(1 - (f.land - t) / lead, 0, 1);
        if (f.type === GOLDEN && u < 0.75) continue;
        ctx.fillStyle = `rgba(59,34,24,${0.08 + u * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(f.x + 3, f.y + 4, R * (0.4 + u * 0.6), R * (0.3 + u * 0.45), 0, 0, Math.PI * 2);
        ctx.fill();
        if (u > 0.45) {
          const k = (1 - u) / 0.55;
          const z = k * k * 260;
          ctx.globalAlpha = clamp((u - 0.45) * 4, 0, 1);
          foodAt(f, f.x, f.y - z, 1 + k * 0.6, k * 4 + f.id);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  function onDiscBase(w, f) {
    const d = w.arena.disc;
    return (f.bx - d.x) ** 2 + (f.by - d.y) ** 2 < d.r * d.r;
  }

  function glint(x, y, id) {
    const ph = (time * 1.3 + id * 0.37) % 2.2;
    if (ph > 0.5) return;
    const s = Math.sin((ph / 0.5) * Math.PI) * 14;
    ctx.save();
    ctx.translate(x - 4, y - 5);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.18, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s * 0.18, 0);
    ctx.closePath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(0, s * 0.18);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, -s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function cheekRing(h, a) {
    const fill = a.fill;
    const seat = SEATS[h.seat % SEATS.length];
    const R = 34 + Math.min(1, fill / MAX) * 8;
    ctx.save();
    ctx.translate(h.x, h.y);
    // Track.
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(59,34,24,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,242,217,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    // The fill: cream → sunflower → hot pink and jagged past full.
    const f = Math.min(1, fill / CAP);
    if (f > 0) {
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = fill > CAP ? '#FF4D6D' : fill >= 70 ? '#FFCB2E' : seat.color;
      ctx.beginPath();
      ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      ctx.stroke();
    }
    if (fill > CAP) {
      const over = Math.min(1, (fill - CAP) / (MAX - CAP));
      ctx.strokeStyle = '#FF4D6D';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const n = 28;
      for (let i = 0; i <= n; i++) {
        const ang = (i / n) * Math.PI * 2 + time * 2;
        const rr = R + 8 + (i % 2 ? 0 : 5 + over * 6) + Math.sin(time * 30 + i) * over * 1.5;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function stateOf(h, a, dt, scene) {
    // Animation springs.
    const target = h.fill;
    a.fill += (target - a.fill) * (1 - Math.exp(-dt / 0.06));
    if (Math.abs(target - a.fill) < 0.3) a.fill = target;
    const k = 140;
    const damp = 9;
    a.wobV += (-k * a.wob - damp * a.wobV) * dt;
    a.wob += a.wobV * dt * 0.06;
    a.wob = clamp(a.wob, -0.25, 0.35);
    a.sqV += (-170 * a.sq - 12 * a.sqV) * dt;
    a.sq += a.sqV * dt;
    a.sq = clamp(a.sq, -0.4, 0.4);
    a.bite = Math.max(0, a.bite - dt * 6);
    a.happy = Math.max(0, a.happy - dt);
    a.blinkT -= dt;
    if (a.blinkT <= 0) {
      a.blink = 1;
      a.blinkT = 2 + Math.random() * 3.5;
    }
    a.blink = Math.max(0, a.blink - dt * 7);
    const speed = h.speed ?? 0;
    a.gait += dt * (6 + speed * 0.09);
    const full = Math.min(1, a.fill / CAP);
    a.sway = Math.sin(a.gait * 0.5) * 0.12 * full * Math.min(1, speed / 60);
    const dashing = h.dashT > 0 || h.remoteDash;
    let sx = 1 + a.sq;
    let sy = 1 - a.sq * 0.8;
    if (dashing) {
      sx *= 1.18;
      sy *= 0.86;
    }
    return {
      x: h.x,
      y: h.y,
      a: h.a,
      fill: a.fill,
      coat: h.coat,
      seat: h.seat,
      t: time + h.seat,
      gait: a.gait,
      speed,
      wob: a.wob,
      bite: a.bite,
      sx,
      sy,
      sway: a.sway,
      blink: a.blink,
      dizzy: h.dizzyT > 0 || h.remoteDizzy ? 1 : 0,
      happy: a.happy,
      away: h.away,
      crown: scene.leader === h.id,
    };
  }

  function drawHamsterLayer(w, scene, dt, view) {
    const list = w.hams.filter((h) => !h.gone).slice().sort((p, q) => p.y - q.y);
    const meH = scene.me ? w.byId.get(scene.me) : null;
    const states = new Map();
    for (const h of list) states.set(h, stateOf(h, r.anim(h.id), dt, scene));
    if (meH && !meH.gone && !scene.noRing) cheekRing(meH, r.anim(meH.id));
    for (const h of list) {
      if (h.x < view.x0 - 60 || h.x > view.x1 + 60 || h.y < view.y0 - 60 || h.y > view.y1 + 60) continue;
      const s = states.get(h);
      ctx.fillStyle = 'rgba(59,34,24,0.3)';
      ctx.beginPath();
      ctx.ellipse(h.x + 5, h.y + 8, 25 + s.fill * 0.05, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      if (h.dashT > 0 || h.remoteDash) {
        ctx.strokeStyle = 'rgba(255,248,232,0.8)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const c = Math.cos(h.a);
        const sn = Math.sin(h.a);
        for (const o of [-12, 0, 12]) {
          ctx.beginPath();
          ctx.moveTo(h.x - c * 30 - sn * o, h.y - sn * 30 + c * o);
          ctx.lineTo(h.x - c * (58 + Math.abs(o)) - sn * o, h.y - sn * (58 + Math.abs(o)) + c * o);
          ctx.stroke();
        }
      }
    }
    for (const h of list) {
      if (h.x < view.x0 - 60 || h.x > view.x1 + 60 || h.y < view.y0 - 60 || h.y > view.y1 + 60) continue;
      drawHamster(ctx, states.get(h));
    }
  }

  function drawNight(w, scene) {
    const A = w.arena;
    const D = A.dark;
    // A low-resolution mask: dark everywhere but the lights.
    const mw = Math.ceil(vw / 2);
    const mh = Math.ceil(vh / 2);
    if (!night || night.width !== mw || night.height !== mh) night = makeCanvas(mw, mh);
    const m = night.getContext('2d');
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, mw, mh);
    m.fillStyle = 'rgba(12,18,48,0.84)';
    m.fillRect(0, 0, mw, mh);
    m.globalCompositeOperation = 'destination-out';
    const hole = (x, y, rad, strength = 1) => {
      const p = r.toScreen(x, y);
      const sx = p.x / 2;
      const sy = p.y / 2;
      const sr = (rad * cam.z) / 2;
      if (sx + sr < 0 || sy + sr < 0 || sx - sr > mw || sy - sr > mh) return;
      const g = m.createRadialGradient(sx, sy, sr * 0.45, sx, sy, sr);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      m.fillStyle = g;
      m.beginPath();
      m.arc(sx, sy, sr, 0, Math.PI * 2);
      m.fill();
    };
    hole(D.lantern.x, D.lantern.y, D.lantern.r * (1 + Math.sin(time * 3) * 0.02));
    for (const f of w.flies) hole(f.x, f.y, f.r, 0.9);
    for (const h of w.hams) {
      if (h.gone) continue;
      const mine = h.id === scene.me;
      hole(h.x, h.y, mine ? D.own : 70, mine ? 1 : 0.7);
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(night, 0, 0, vw, vh);
    ctx.restore();
    // Fireflies themselves.
    for (const f of w.flies) {
      const g = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 16);
      g.addColorStop(0, 'rgba(255,255,190,1)');
      g.addColorStop(1, 'rgba(220,255,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    // Lantern glow.
    const L = D.lantern;
    const g = ctx.createRadialGradient(L.x, L.y, 10, L.x, L.y, 90);
    g.addColorStop(0, 'rgba(255,220,130,0.7)');
    g.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(L.x, L.y, 90, 0, Math.PI * 2);
    ctx.fill();
    // Hamsters stay readable in the dark: drawn again, moonlit, over the mask.
    ctx.save();
    ctx.globalAlpha = 0.75;
    for (const h of w.hams) {
      if (h.gone || h.id === scene.me) continue;
      const p = r.toScreen(h.x, h.y);
      if (p.x < -60 || p.y < -60 || p.x > vw + 60 || p.y > vh + 60) continue;
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLive(w) {
    const A = w.arena;
    for (const o of A.obstacles) {
      if (o.prop === 'fire') flame(o.x, o.y, 1.4, o.x);
      if (o.prop === 'cake') {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          flame(o.x + Math.cos(a) * o.r * 0.45, o.y + Math.sin(a) * o.r * 0.45, 0.45, k);
        }
      }
    }
    if (A.slip) {
      // Water shine moving across the puddles.
      for (const z of A.slip) {
        const ph = (time * 0.6 + z.x * 0.01) % 3;
        if (ph > 1) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.5 * Math.sin(ph * Math.PI)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r * (0.4 + ph * 0.5), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (A.stream) {
      // Ripples drift downstream.
      const s = A.stream;
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len = Math.hypot(dx, dy);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 26; i++) {
        let u = ((i * 0.0391 + time * 0.03) % 1 + 1) % 1;
        const gapHit = s.gaps.some((g) => Math.abs(u - g) < (s.gapHalf + 20) / len);
        if (gapHit) continue;
        const off = Math.sin(i * 7.1) * s.r * 0.6;
        const x = s.ax + dx * u + (-dy / len) * off;
        const y = s.ay + dy * u + (dx / len) * off;
        ctx.beginPath();
        ctx.ellipse(x, y, 12, 3.5, Math.atan2(dy, dx), 0, Math.PI);
        ctx.stroke();
      }
    }
  }

  function flame(x, y, s, seed) {
    const fl = 1 + Math.sin(time * 17 + seed) * 0.12 + Math.sin(time * 31 + seed * 2) * 0.08;
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40 * s * fl);
    g.addColorStop(0, 'rgba(255,240,170,0.95)');
    g.addColorStop(0.35, 'rgba(255,160,40,0.75)');
    g.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 40 * s * fl, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDapple(view, A) {
    if (!dapple) {
      const size = 512;
      dapple = makeCanvas(size, size);
      const g = dapple.getContext('2d');
      for (let i = 0; i < 18; i++) {
        const x = unit('dap', i, 'x') * size;
        const y = unit('dap', i, 'y') * size;
        const rr = 40 + unit('dap', i, 'r') * 90;
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            const gr = g.createRadialGradient(x + ox, y + oy, rr * 0.3, x + ox, y + oy, rr);
            gr.addColorStop(0, 'rgba(20,40,10,0.5)');
            gr.addColorStop(1, 'rgba(20,40,10,0)');
            g.fillStyle = gr;
            g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
          }
        }
      }
    }
    const pat = ctx.createPattern(dapple, 'repeat');
    if (!pat) return;
    const ox = (time * 9) % 512;
    const oy = (time * 4) % 512;
    ctx.save();
    ctx.globalAlpha = A.dark ? 0 : 0.22;
    ctx.translate(ox, oy);
    ctx.fillStyle = pat;
    ctx.fillRect(view.x0 - ox, view.y0 - oy, view.x1 - view.x0, view.y1 - view.y0);
    ctx.restore();
  }

  function drawTags(w, scene, view) {
    const zs = 1 / cam.z;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const h of w.hams) {
      if (h.gone) continue;
      if (h.x < view.x0 || h.x > view.x1 || h.y < view.y0 || h.y > view.y1) continue;
      const mine = h.id === scene.me;
      const a = r.anim(h.id);
      if (mine) {
        // The "you" chevron in the seat colour, bobbing over the head.
        const seat = SEATS[h.seat % SEATS.length];
        const bob = Math.sin(time * 5) * 3 * zs;
        const y = h.y - 44 - (a.fill > 60 ? 6 : 0) - 10 * zs + bob;
        const s = 11 * Math.max(zs, 0.8);
        ctx.beginPath();
        ctx.moveTo(h.x - s, y - s * 0.7);
        ctx.lineTo(h.x, y + s * 0.5);
        ctx.lineTo(h.x + s, y - s * 0.7);
        ctx.lineCap = 'round';
        ctx.lineWidth = s * 0.85;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = s * 0.45;
        ctx.strokeStyle = seat.color;
        ctx.stroke();
        continue;
      }
      if (scene.noTags) continue;
      const name = (scene.names && scene.names.get(h.id)) || h.name;
      if (!name) continue;
      const size = 14 * Math.max(zs, 0.85);
      ctx.font = `800 ${size}px "Bricolage Grotesque", system-ui, sans-serif`;
      const y = h.y - 40 - Math.min(1, a.fill / CAP) * 6;
      ctx.globalAlpha = h.away ? 0.5 : 1;
      ctx.lineWidth = size * 0.32;
      ctx.strokeStyle = INK;
      ctx.strokeText(name, h.x, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(name, h.x, y);
      if (h.away) {
        ctx.font = `${size * 1.1}px Shrikhand, sans-serif`;
        ctx.strokeText('z z', h.x + 22, y - 16 - Math.sin(time * 2) * 3);
        ctx.fillText('z z', h.x + 22, y - 16 - Math.sin(time * 2) * 3);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPollen(A, dt) {
    if (A.ground !== 'gingham' && A.ground !== 'camp' && A.ground !== 'lawn') return;
    if (!pollen.length) {
      for (let i = 0; i < 26; i++) pollen.push({ x: Math.random() * 2000, y: Math.random() * 2000, s: 1.5 + Math.random() * 2.5, d: 0.3 + Math.random() * 0.5, ph: Math.random() * 6 });
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const night = !!A.dark;
    for (const p of pollen) {
      p.x += (12 + Math.sin(time + p.ph) * 8) * dt;
      p.y += (5 + Math.cos(time * 0.7 + p.ph) * 6) * dt;
      // Moves faster than the ground: parallax.
      let sx = (p.x - cam.x * cam.z * 1.35) % (vw + 40);
      let sy = (p.y - cam.y * cam.z * 1.35) % (vh + 40);
      if (sx < -20) sx += vw + 40;
      if (sy < -20) sy += vh + 40;
      ctx.fillStyle = night ? 'rgba(230,255,150,0.75)' : 'rgba(255,252,235,0.7)';
      ctx.beginPath();
      ctx.arc(sx, sy, p.s * (night ? 0.8 : 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = night ? 'rgba(230,255,150,0.3)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + p.ph;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * p.s * 2.4, sy + Math.sin(a) * p.s * 2.4);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  return r;
}
