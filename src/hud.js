// The play HUD, drawn flat over the 3D world: the timer, your place and heap, name tags and your chevron, the badge over
// your head (gobble chains, Stuffed and Bursting), specials' timers, edge arrows, hints, floating numbers, big words and
// confetti. Stickers: cocoa ink, a cream rim, bright fills. Kept clear of the platform's UI (ow.ui.reserved).

import { SEATS, TIERS, SPECIAL } from './sim/config.js';
import { drawEmblem } from './render/arena.js';

const INK = '#3B2218';
const CREAM = '#FFF2D9';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DISPLAY = 'Shrikhand, "Bricolage Grotesque", system-ui, sans-serif';
const BOLD = '"Bricolage Grotesque", system-ui, sans-serif';

export const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
};

function hits(rect, list) {
  for (const a of list || []) {
    if (rect.x < a.x + a.w && rect.x + rect.w > a.x && rect.y < a.y + a.h && rect.y + rect.h > a.y) return a;
  }
  return null;
}

const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

export function createHud(canvas, world) {
  const ctx = canvas.getContext('2d');
  let vw = 1;
  let vh = 1;
  let dpr = 1;
  let time = 0;
  let lastSec = -1;
  let tick = 0;
  const floats = [];
  const conf = [];
  let badge = { key: '', t: 0, pop: 0 };

  /** A rounded sticker: ink shadow, ink edge, cream rim, fill. */
  function sticker(x, y, w, h, r, fill, rim = CREAM) {
    ctx.fillStyle = 'rgba(59,34,24,0.35)';
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 4, w, h, r);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5);
    ctx.fill();
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, r - 1);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4));
    ctx.fill();
    // A gloss along the top.
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(x + 7, y + 6, w - 14, (h - 10) * 0.42, Math.max(2, r - 6));
    ctx.fill();
  }

  /** Display text with an ink outline and a soft drop. */
  function label(text, x, y, size, o = {}) {
    ctx.font = `${o.weight || ''} ${Math.round(size)}px ${o.font === 'bold' ? BOLD : DISPLAY}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(59,34,24,0.45)';
      ctx.fillText(text, x, y + size * 0.09);
    }
    ctx.lineWidth = size * (o.outline ?? 0.26);
    ctx.strokeStyle = o.ink || INK;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = o.color || CREAM;
    ctx.fillText(text, x, y);
  }

  function place(rect, reserved, dir = 'down') {
    for (let k = 0; k < 6; k++) {
      const a = hits(rect, reserved);
      if (!a) break;
      if (dir === 'down') rect.y = a.y + a.h + 8;
      else rect.x = a.x + a.w + 8;
    }
    return rect;
  }

  function pawPrint(x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, s * 0.25);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.35, s * 0.9, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const [tx, ty] of [
      [-0.95, -0.45],
      [-0.35, -0.95],
      [0.35, -0.95],
      [0.95, -0.45],
    ]) {
      ctx.beginPath();
      ctx.ellipse(tx * s, ty * s, s * 0.32, s * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function seedIcon(x, y, s, color = '#FFCB2E') {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.bezierCurveTo(s * 0.75, -s * 0.5, s * 0.6, s * 0.7, 0, s);
    ctx.bezierCurveTo(-s * 0.6, s * 0.7, -s * 0.75, -s * 0.5, 0, -s);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.5);
    ctx.lineTo(-s * 0.2, s * 0.4);
    ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------ pieces

  function drawTimer(t, reserved) {
    const H = vw >= 700 ? 58 : 50;
    const W = H * 2.25;
    const rect = place({ x: vw / 2 - W / 2, y: 10, w: W, h: H }, reserved, 'right');
    const f = clamp(t.left / t.total, 0, 1);
    const late = t.left <= 30;
    const sec = Math.ceil(t.left);
    if (sec !== lastSec) {
      lastSec = sec;
      if (t.left <= 10 && t.left > 0) tick = 1;
    }
    tick = Math.max(0, tick - 0.05);
    const pulse = 1 + tick * 0.14;
    ctx.save();
    ctx.translate(rect.x + W / 2, rect.y + H / 2);
    ctx.scale(pulse, pulse);
    ctx.translate(-W / 2, -H / 2);
    sticker(0, 0, W, H, H / 2, late ? '#FF4D6D' : '#3FA7F2');
    // The dial: a wedge that drains clockwise.
    const cx = H / 2 + 2;
    const cy = H / 2;
    const R = H / 2 - 9;
    ctx.fillStyle = 'rgba(59,34,24,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R - 2, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (late) pawPrint(cx, cy + 1, R * 0.38, '#FF4D6D');
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    label(`${m}:${String(s).padStart(2, '0')}`, H + (W - H) / 2 - 2, H / 2 + 1, H * 0.46, { font: 'bold', weight: 800, outline: 0.22 });
    ctx.restore();
    return rect;
  }

  function drawPlace(p, reserved) {
    const lead = p.place === 1;
    const W = vw < 420 ? 132 : 156;
    const H = p.leaderHeap ? 84 : 62;
    const rect = place({ x: vw - W - 12, y: 10, w: W, h: H }, reserved, 'down');
    sticker(rect.x, rect.y, W, H, 18, lead ? '#FFCB2E' : '#2DC38A');
    label(ordinal(p.place), rect.x + 16, rect.y + 31, 30, { align: 'left', color: lead ? CREAM : CREAM });
    label(String(p.heap), rect.x + W - 14, rect.y + 32, 25, { align: 'right', font: 'bold', weight: 800, outline: 0.24 });
    if (p.leaderHeap) label(`1st ${p.leaderHeap}`, rect.x + W - 14, rect.y + 63, 16, { align: 'right', font: 'bold', weight: 800, outline: 0.24, color: '#FFE9B8', shadow: false });
    return rect;
  }

  function drawTags(tags) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const g of tags) {
      if (g.me) {
        if (g.badge) continue;
        const seat = SEATS[g.seat % SEATS.length];
        const s = 11;
        const y = g.y - 12 + Math.sin(time * 5) * 3;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(g.x - s, y - s * 0.7);
        ctx.lineTo(g.x, y + s * 0.5);
        ctx.lineTo(g.x + s, y - s * 0.7);
        ctx.lineWidth = s * 0.95;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = s * 0.5;
        ctx.strokeStyle = seat.color;
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const size = 15;
      ctx.globalAlpha = g.away ? 0.5 : 1;
      ctx.font = `800 ${size}px ${BOLD}`;
      const tw = ctx.measureText(g.name).width;
      const seat = SEATS[g.seat % SEATS.length];
      const x = g.x;
      const y = g.y - 8;
      // A seat-coloured dot with the emblem, then the name.
      ctx.save();
      ctx.translate(x - tw / 2 - 9, y);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = seat.color;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      drawEmblem(ctx, seat.emblem, 0, 0, 4, '#fff');
      ctx.restore();
      label(g.name, x + 6, y, size, { font: 'bold', weight: 800, outline: 0.32, color: '#FFFFFF', shadow: false });
      if (g.crown) {
        ctx.save();
        ctx.translate(x + 6, y - 17);
        ctx.fillStyle = '#FFCB2E';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-9, 5);
        ctx.lineTo(-10, -5);
        ctx.lineTo(-4, -1);
        ctx.lineTo(0, -8);
        ctx.lineTo(4, -1);
        ctx.lineTo(10, -5);
        ctx.lineTo(9, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      if (g.away) label('z z', x + tw / 2 + 18, y - 14 - Math.sin(time * 2) * 3, 16, { color: '#FFFFFF' });
      ctx.globalAlpha = 1;
    }
  }

  /** The badge over my head: the gobble chain, Stuffed or Bursting. */
  function drawBadge(me, dt) {
    if (!me) return;
    let key = '';
    let text = '';
    let color = '#FFCB2E';
    const tier = me.fill > TIERS[0].at ? TIERS[0] : me.fill > TIERS[1].at ? TIERS[1] : null;
    if (tier) {
      key = tier.key;
      text = `${tier.name} ×${tier.mult}`;
      color = tier.key === 'bursting' ? '#FF4D6D' : '#FF8A2A';
    }
    if (me.chain >= 2 && me.chainFresh) {
      key = `chain${me.chain}${tier ? tier.key : ''}`;
      text = tier ? `${text}  ·  Gobble ×${me.chain}` : `Gobble ×${me.chain}`;
      if (!tier) color = '#2DC38A';
    }
    if (key !== badge.key) {
      if (key) badge.pop = 1;
      badge.key = key;
    }
    badge.pop = Math.max(0, badge.pop - dt * 4);
    if (!key) return;
    const size = 19;
    ctx.font = `${size}px ${DISPLAY}`;
    const tw = ctx.measureText(text).width;
    const W = tw + 28;
    const H = 38;
    const x = clamp(me.x - W / 2, 8, vw - W - 8);
    const y = clamp(me.y - H - 14, 8, vh - H - 8);
    const shake = tier && tier.key === 'bursting' ? Math.sin(time * 50) * 1.5 : 0;
    ctx.save();
    ctx.translate(x + W / 2 + shake, y + H / 2);
    const sc = 1 + badge.pop * 0.25;
    ctx.scale(sc, sc);
    ctx.rotate(-0.03);
    sticker(-W / 2, -H / 2, W, H, 14, color);
    label(text, 0, 1, size, { outline: 0.24 });
    ctx.restore();
  }

  /** Little round timers for the specials (chili, gum, a sneeze coming). */
  function drawSpecials(me) {
    if (!me) return;
    const list = [];
    if (me.hotT > 0) list.push({ k: 'hot', u: me.hotT / SPECIAL.hot, c: '#FF5A2A', t: 'Hot!' });
    if (me.gumT > 0) list.push({ k: 'gum', u: me.gumT / SPECIAL.gum, c: '#FF7EC0', t: 'Gum' });
    if (me.sneezeT > 0) list.push({ k: 'sneeze', u: me.sneezeT / SPECIAL.sneezeDelay, c: '#B98A5A', t: 'Achoo' });
    let x = me.x + 34;
    const y = me.y + 6;
    for (const s of list) {
      const R = 17;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 2, -Math.PI / 2, -Math.PI / 2 + clamp(s.u, 0, 1) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      label(s.t, x, y + R + 10, 12, { font: 'bold', weight: 800, outline: 0.34, color: '#FFFFFF', shadow: false });
      x += R * 2 + 10;
    }
  }

  function drawArrows(list, reserved) {
    const m = 36;
    for (const a of list) {
      const p = world.toScreen(a.x, a.y, 0.2);
      if (!p.behind && p.x > m && p.x < vw - m && p.y > m && p.y < vh - m) continue;
      const cx = vw / 2;
      const cy = vh / 2;
      let dx = p.x - cx;
      let dy = p.y - cy;
      if (p.behind) {
        dx = -dx;
        dy = -dy;
      }
      const k = Math.min(Math.abs((vw / 2 - m) / (dx || 1e-6)), Math.abs((vh / 2 - m) / (dy || 1e-6)));
      let x = cx + dx * k;
      let y = cy + dy * k;
      const hit = hits({ x: x - 24, y: y - 24, w: 48, h: 48 }, reserved);
      if (hit) {
        if (Math.abs(x - m) < 2 || Math.abs(x - (vw - m)) < 2) y = y < hit.y + hit.h / 2 ? hit.y - 28 : hit.y + hit.h + 28;
        else x = x < hit.x + hit.w / 2 ? hit.x - 28 : hit.x + hit.w + 28;
      }
      const ang = Math.atan2(dy, dx);
      const pulse = a.pulse ? 1 + Math.sin(time * 9) * 0.1 : 1;
      const col = a.kind === 'home' ? SEATS[a.seat % SEATS.length].color : a.kind === 'gold' ? '#FFCB2E' : '#FF4D6D';
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(17, -14);
      ctx.lineTo(17, 14);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(30, 0);
      ctx.lineTo(19, -8);
      ctx.lineTo(19, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 2, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      if (a.kind === 'home') drawEmblem(ctx, SEATS[a.seat % SEATS.length].emblem, 0, 0, 8, '#fff');
      else if (a.kind === 'gold') seedIcon(0, 0, 9, '#FFE680');
      else pawPrint(0, 1, 6.5, '#FFF2D9');
      ctx.restore();
    }
  }

  function drawHint(h, taken) {
    const p = world.toScreen(h.x, h.y, 0.6);
    const u = h.age / h.life;
    const size = 20;
    ctx.save();
    ctx.font = `${size}px ${DISPLAY}`;
    const tw = ctx.measureText(h.text).width;
    const W = tw + 34;
    const H = 44;
    const x = clamp(p.x - W / 2, 10, vw - W - 10);
    // Under the hamster (the badge and floats live above it).
    const below = p.y + 46;
    const above = p.y - 120 - H;
    const tries = [below, above, p.y - H / 2].map((t) => clamp(t, 10, vh - H - 10));
    let y = tries[0];
    for (const t of tries) {
      if (!hits({ x, y: t, w: W, h: H }, taken)) {
        y = t;
        break;
      }
    }
    const appear = clamp(h.age / 0.2, 0, 1);
    const gone = u > 0.85 ? (u - 0.85) / 0.15 : 0;
    ctx.globalAlpha = 1 - gone;
    ctx.translate(x + W / 2, y + H / 2);
    ctx.scale((0.6 + 0.4 * easeOutBack(appear)) * (1 - gone * 0.3), (0.6 + 0.4 * easeOutBack(appear)) * (1 - gone * 0.3));
    ctx.rotate(-0.03);
    sticker(-W / 2, -H / 2, W, H, 16, h.hot ? '#FF4D6D' : '#3B2218', CREAM);
    label(h.text, 0, 1, size, { color: CREAM, outline: 0.18 });
    ctx.restore();
  }

  function drawBig(big) {
    const u = clamp(big.u, 0, 1);
    ctx.save();
    ctx.translate(vw / 2, vh * 0.4);
    if (big.kind === 'banner') {
      const drop = u < 0.25 ? -1 + easeOutBack(u / 0.25) : u > 0.85 ? -((u - 0.85) / 0.15) * 1.2 : 0;
      ctx.translate(0, drop * vh * 0.5);
      ctx.font = `46px ${DISPLAY}`;
      const W = Math.min(vw - 40, Math.max(300, ctx.measureText(big.text).width + 70));
      const H = big.sub ? 126 : 96;
      ctx.rotate(-0.035);
      sticker(-W / 2, -H / 2, W, H, 26, '#FF8A2A');
      label(big.text, 0, big.sub ? -16 : 0, Math.min(46, (W - 40) / Math.max(4, big.text.length) * 1.7));
      if (big.sub) label(big.sub, 0, 34, 22, { font: 'bold', weight: 800, outline: 0.24 });
    } else {
      const s = u < 0.18 ? easeOutBack(u / 0.18) : 1 + (u - 0.18) * 0.15;
      ctx.globalAlpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      ctx.scale(s, s);
      const size = big.text.length > 2 ? Math.min(140, vw * 0.24) : Math.min(180, vw * 0.4);
      label(big.text, 0, 0, size, { color: big.color || CREAM, outline: 0.15 });
    }
    ctx.restore();
  }

  function drawTag(text, reserved) {
    ctx.save();
    ctx.font = `20px ${DISPLAY}`;
    const W = ctx.measureText(text).width + 40;
    const H = 48;
    const rect = { x: vw / 2 - W / 2, y: vh - H - 20, w: W, h: H };
    for (let k = 0; k < 4; k++) {
      const a = hits(rect, reserved);
      if (!a) break;
      rect.y = a.y - H - 10;
    }
    sticker(rect.x, rect.y, W, H, 18, '#3B2218');
    label(text, rect.x + W / 2, rect.y + H / 2 + 1, 20);
    ctx.restore();
  }

  function drawFloats(dt) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      if (f.t >= f.life) {
        floats.splice(i, 1);
        continue;
      }
      const u = f.t / f.life;
      const p = world.toScreen(f.x, f.y, f.h);
      if (p.behind) continue;
      const rise = 46 * (1 - (1 - u) * (1 - u));
      const pop = u < 0.12 ? 0.5 + (u / 0.12) * 0.7 : u < 0.24 ? 1.2 - ((u - 0.12) / 0.12) * 0.2 : 1;
      ctx.globalAlpha = u > 0.72 ? (1 - u) / 0.28 : 1;
      ctx.save();
      ctx.translate(p.x, p.y - rise);
      ctx.rotate(f.rot * (1 - u));
      label(f.s, 0, 0, f.size * pop, { color: f.c, outline: 0.24 });
      if (f.sub) label(f.sub, 0, f.size * 0.78, f.size * 0.5, { font: 'bold', weight: 800, color: '#FFFFFF', outline: 0.32 });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function drawConfetti(dt) {
    for (let i = conf.length - 1; i >= 0; i--) {
      const p = conf[i];
      p.t += dt;
      if (p.t >= p.life || p.y > vh + 20) {
        conf.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt + Math.sin(p.t * 4 + p.rot) * 30 * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const u = p.t / p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(Math.cos(p.t * 6 + p.rot)) * 0.8 + 0.2);
      ctx.globalAlpha = u > 0.8 ? (1 - u) * 5 : 1;
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  return {
    resize(w, h, ratio) {
      vw = Math.max(1, w);
      vh = Math.max(1, h);
      dpr = ratio;
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
    },
    /** A number or word rising from a spot in the world (sim px, `h` world units up). */
    float(x, y, h, s, color = CREAM, size = 28, life = 1.1, sub = '') {
      if (floats.length > 40) floats.shift();
      floats.push({ x, y, h, s, c: color, size, life, t: 0, sub, rot: (Math.random() - 0.5) * 0.3 });
    },
    confetti(n, reduced) {
      const k = reduced ? Math.ceil(n / 3) : n;
      const cols = ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA', '#FFF2D9', '#E3A24F'];
      for (let i = 0; i < k; i++) conf.push({ x: Math.random() * vw, y: -Math.random() * 140, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 170, life: 3 + Math.random() * 1.5, t: 0, r: 3 + Math.random() * 4, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
    },
    clear() {
      floats.length = 0;
      conf.length = 0;
    },
    /** h: { dt, reserved, timer, place, arrows, hint, big, tag, tags, me } */
    draw(h) {
      const dt = h.dt || 0;
      time += dt;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const reserved = h.reserved || [{ x: 0, y: 0, w: 150, h: 70 }];
      if (h.tags) drawTags(h.tags);
      drawFloats(dt);
      if (h.me) {
        drawBadge(h.me, dt);
        drawSpecials(h.me);
      }
      if (h.arrows) drawArrows(h.arrows, reserved);
      const taken = [...reserved];
      if (h.timer) taken.push(drawTimer(h.timer, reserved));
      if (h.place) taken.push(drawPlace(h.place, taken));
      if (h.hint) drawHint(h.hint, taken);
      if (h.tag) drawTag(h.tag, reserved);
      if (h.big) drawBig(h.big);
      drawConfetti(dt);
    },
  };
}
