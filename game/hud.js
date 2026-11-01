// The play HUD, in screen space over the world: the nibbled timer biscuit, your place and heap, edge arrows, hints,
// the intro's banner and numerals, the watching tag. Kept clear of the platform's UI (ow.ui.reserved).

import { SEATS, FOODS, GOLDEN } from './config.js';
import { biscuitSprite, drawBiscuit, piped } from './biscuit.js';
import { emblemPath } from './hamster.js';
import { drawFood, makeCanvas } from './food.js';

const INK = '#3B2218';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
};
export { ordinal };

function hits(rect, list) {
  for (const a of list || []) {
    if (rect.x < a.x + a.w && rect.x + rect.w > a.x && rect.y < a.y + a.h && rect.y + rect.h > a.y) return a;
  }
  return null;
}

export function createHud(renderer) {
  const ctx = renderer.ctx;
  let timerCanvas = null;
  let time = 0;
  let lastSec = -1;
  let tick = 0;

  /** Pushes a rect down (or sideways) until it misses the reserved areas. */
  function place(rect, reserved, dir = 'down') {
    for (let k = 0; k < 6; k++) {
      const a = hits(rect, reserved);
      if (!a) break;
      if (dir === 'down') rect.y = a.y + a.h + 8;
      else rect.x = a.x + a.w + 8;
    }
    return rect;
  }

  function drawTimer(t, reserved, vw) {
    const D = vw >= 700 ? 104 : 84;
    const rect = place({ x: vw / 2 - D / 2, y: 10, w: D, h: D }, reserved, 'right');
    const f = clamp(t.left / t.total, 0, 1);
    const late = t.left <= 30;
    const sec = Math.ceil(t.left);
    if (sec !== lastSec) {
      lastSec = sec;
      if (t.left <= 10 && t.left > 0) tick = 1;
    }
    tick = Math.max(0, tick - 0.06);
    const dpr = renderer.dpr;
    const size = Math.ceil((D + 24) * dpr);
    if (!timerCanvas || timerCanvas.width !== size) timerCanvas = makeCanvas(size, size);
    const g = timerCanvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    g.scale(dpr, dpr);
    const spr = biscuitSprite(D, D, { scale: dpr, round: true, bite: null, tint: late ? '#FF9AAE' : null });
    g.drawImage(spr.canvas, 12 - spr.pad, 12 - spr.pad, D + spr.pad * 2, D + spr.pad * 2);
    // Nibbled away clockwise from the top: a wedge with a scalloped edge.
    const cx = 12 + D / 2;
    const cy = 12 + D / 2;
    const a0 = -Math.PI / 2;
    const a1 = -Math.PI / 2 + (1 - f) * Math.PI * 2;
    if (f < 0.999) {
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, D / 2 + 10, a0, a1);
      g.closePath();
      g.fill();
      const R = D * 0.1;
      for (const ang of [a0, a1]) {
        for (let k = 1; k <= 4; k++) {
          const d = (k / 4.4) * (D / 2);
          const side = ang === a0 ? 1 : -1;
          const bx = cx + Math.cos(ang) * d + Math.cos(ang + (side * Math.PI) / 2) * -R * 0.25;
          const by = cy + Math.sin(ang) * d + Math.sin(ang + (side * Math.PI) / 2) * -R * 0.25;
          g.beginPath();
          g.arc(bx, by, R * (0.75 + (k % 2) * 0.25), 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    const pulse = 1 + tick * 0.12;
    ctx.save();
    ctx.translate(rect.x + D / 2, rect.y + D / 2);
    ctx.scale(pulse, pulse);
    ctx.drawImage(timerCanvas, -D / 2 - 12, -D / 2 - 12, D + 24, D + 24);
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    piped(ctx, `${m}:${String(s).padStart(2, '0')}`, 0, 2, D * 0.3, { color: late ? '#FFFFFF' : '#FFF2D9', outline: 0.3 });
    if (late) {
      ctx.translate(0, D * 0.3);
      pawPrint(ctx, 0, 0, D * 0.09, '#FF4D6D');
    }
    ctx.restore();
    return rect;
  }

  function pawPrint(c, x, y, s, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = color;
    c.strokeStyle = INK;
    c.lineWidth = Math.max(1.5, s * 0.25);
    c.beginPath();
    c.ellipse(0, s * 0.35, s * 0.9, s * 0.7, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    for (const [tx, ty] of [
      [-0.95, -0.45],
      [-0.35, -0.95],
      [0.35, -0.95],
      [0.95, -0.45],
    ]) {
      c.beginPath();
      c.ellipse(tx * s, ty * s, s * 0.32, s * 0.38, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.restore();
  }

  function drawPlace(p, reserved, vw) {
    const lead = p.place === 1;
    const W = vw < 420 ? 128 : 150;
    const H = lead ? 62 : 86;
    const rect = place({ x: vw - W - 12, y: 12, w: W, h: H }, reserved, 'down');
    drawBiscuit(ctx, rect.x, rect.y, W, H, { scale: renderer.dpr, radius: 16, bite: 'bl' });
    piped(ctx, ordinal(p.place), rect.x + 14, rect.y + 31, 30, { align: 'left', color: lead ? '#FFCB2E' : '#FFF2D9' });
    piped(ctx, String(p.heap), rect.x + W - 14, rect.y + 32, 24, { align: 'right', font: 'Bricolage', outline: 0.3 });
    if (!lead && p.leaderHeap !== null) {
      piped(ctx, `1st ${p.leaderHeap}`, rect.x + W - 14, rect.y + 66, 17, { align: 'right', font: 'Bricolage', outline: 0.3, color: '#FFE9B8', shadow: false });
    }
    return rect;
  }

  const goldSprite = (() => {
    let c = null;
    return () => {
      if (c) return c;
      c = makeCanvas(64, 64);
      const g = c.getContext('2d');
      g.translate(32, 32);
      g.scale(2.4, 2.4);
      drawFood(g, GOLDEN, FOODS[GOLDEN].r);
      return c;
    };
  })();

  function drawArrows(list, vw, vh, reserved) {
    const m = 34;
    for (const a of list) {
      const p = renderer.toScreen(a.x, a.y);
      if (p.x > m && p.x < vw - m && p.y > m && p.y < vh - m) continue;
      const cx = vw / 2;
      const cy = vh / 2;
      const dx = p.x - cx;
      const dy = p.y - cy;
      const k = Math.min(Math.abs((vw / 2 - m) / (dx || 1e-6)), Math.abs((vh / 2 - m) / (dy || 1e-6)));
      let x = cx + dx * k;
      let y = cy + dy * k;
      const box = { x: x - 24, y: y - 24, w: 48, h: 48 };
      const hit = hits(box, reserved);
      if (hit) {
        // Slide along the edge out of the platform's UI.
        if (Math.abs(x - m) < 2 || Math.abs(x - (vw - m)) < 2) y = y < hit.y + hit.h / 2 ? hit.y - 28 : hit.y + hit.h + 28;
        else x = x < hit.x + hit.w / 2 ? hit.x - 28 : hit.x + hit.w + 28;
      }
      const ang = Math.atan2(dy, dx);
      const pulse = a.pulse ? 1 + Math.sin(time * 9) * 0.1 : 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      // The pointer.
      ctx.save();
      ctx.rotate(ang);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(34, 0);
      ctx.lineTo(18, -13);
      ctx.lineTo(18, 13);
      ctx.closePath();
      ctx.fill();
      const col = a.kind === 'home' ? SEATS[a.seat % SEATS.length].color : a.kind === 'gold' ? '#FFCB2E' : '#FF4D6D';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(29, 0);
      ctx.lineTo(19, -8);
      ctx.lineTo(19, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawBiscuit(ctx, -21, -21, 42, 42, { scale: renderer.dpr, round: true, bite: null, holes: false });
      if (a.kind === 'home') {
        const seat = SEATS[a.seat % SEATS.length];
        ctx.fillStyle = seat.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        emblemPath(ctx, seat.emblem, 7);
        ctx.fill();
      } else if (a.kind === 'gold') {
        ctx.drawImage(goldSprite(), -16, -16, 32, 32);
      } else {
        pawPrint(ctx, 0, 1, 8, '#FF4D6D');
      }
      ctx.restore();
    }
  }

  function drawHint(h, vw, vh) {
    const p = renderer.toScreen(h.x, h.y);
    const u = h.age / h.life;
    const size = 20;
    ctx.save();
    ctx.font = `${size}px Shrikhand, sans-serif`;
    const tw = ctx.measureText(h.text).width;
    const W = tw + 34;
    const H = 44;
    let x = clamp(p.x - W / 2, 10, vw - W - 10);
    let y = p.y - 112 * Math.max(0.8, renderer.cam.z);
    if (y < 110) y = p.y + 54;
    y = clamp(y, 10, vh - H - 10);
    const appear = clamp(h.age / 0.2, 0, 1);
    const gone = u > 0.85 ? (u - 0.85) / 0.15 : 0;
    ctx.globalAlpha = 1 - gone;
    ctx.translate(x + W / 2, y + H / 2);
    const sc = (0.6 + 0.4 * (1 - (1 - appear) ** 3)) * (1 - gone * 0.3);
    ctx.scale(sc, sc);
    ctx.rotate(-0.03);
    drawBiscuit(ctx, -W / 2, -H / 2, W, H, { scale: renderer.dpr, radius: 14, bite: 'tr', holes: false });
    piped(ctx, h.text, 0, 1, size, { color: h.hot ? '#FFD6DE' : '#FFF2D9' });
    ctx.restore();
  }

  function drawIntro(big, vw, vh) {
    const u = clamp(big.u, 0, 1);
    ctx.save();
    ctx.translate(vw / 2, vh * 0.42);
    if (big.kind === 'banner') {
      // Drops in with a bounce, then lifts away.
      const drop = u < 0.25 ? -1 + easeOutBack(u / 0.25) : u > 0.85 ? -((u - 0.85) / 0.15) * 1.2 : 0;
      ctx.translate(0, drop * vh * 0.5);
      const W = Math.min(vw - 40, 340);
      const H = 92;
      ctx.rotate(-0.04);
      drawBiscuit(ctx, -W / 2, -H / 2, W, H, { scale: renderer.dpr, radius: 22, bite: 'tr' });
      piped(ctx, big.text, 0, 0, 46);
      if (big.sub) piped(ctx, big.sub, 0, 70, 20, { font: 'Bricolage', outline: 0.3 });
    } else {
      const s = u < 0.18 ? easeOutBack(u / 0.18) : 1 + (u - 0.18) * 0.15;
      ctx.globalAlpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      ctx.scale(s, s);
      const size = big.text.length > 2 ? Math.min(150, vw * 0.3) : Math.min(190, vw * 0.42);
      piped(ctx, big.text, 0, 0, size, { color: big.color || '#FFF2D9', outline: 0.16 });
    }
    ctx.restore();
  }

  function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  }

  function drawTag(text, vw, vh, reserved) {
    ctx.save();
    ctx.font = `20px Shrikhand, sans-serif`;
    const W = ctx.measureText(text).width + 40;
    const H = 48;
    const rect = { x: vw / 2 - W / 2, y: vh - H - 20, w: W, h: H };
    for (let k = 0; k < 4; k++) {
      const a = hits(rect, reserved);
      if (!a) break;
      rect.y = a.y - H - 10;
    }
    drawBiscuit(ctx, rect.x, rect.y, W, H, { scale: renderer.dpr, radius: 16, bite: 'tl', holes: false });
    piped(ctx, text, rect.x + W / 2, rect.y + H / 2 + 1, 20);
    ctx.restore();
  }

  return {
    /** hud: { timer, place, arrows, hint, big, tag, reserved, dt } */
    draw(h) {
      const vw = renderer.vw;
      const vh = renderer.vh;
      time += h.dt || 0;
      ctx.save();
      ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
      const reserved = h.reserved || [{ x: 0, y: 0, w: 150, h: 70 }];
      if (h.arrows) drawArrows(h.arrows, vw, vh, reserved);
      const taken = [...reserved];
      if (h.timer) taken.push(drawTimer(h.timer, reserved, vw));
      if (h.place) drawPlace(h.place, taken, vw);
      if (h.hint) drawHint(h.hint, vw, vh);
      if (h.tag) drawTag(h.tag, vw, vh, reserved);
      if (h.big) drawIntro(h.big, vw, vh);
      ctx.restore();
    },
  };
}
