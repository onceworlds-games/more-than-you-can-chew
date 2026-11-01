// Each arena's ground and its standing props, drawn once into a canvas at the camera's scale. Seen from straight above,
// lit from the upper left: every prop throws a soft cocoa shadow down and to the right.

import { createRng } from './rng.js';
import { makeCanvas, roundRect } from './food.js';

const INK = '#3B2218';
const SHADOW = 'rgba(59,34,24,0.28)';

/** The colour beyond an arena's edge (when the screen is bigger than the arena). */
export const OUTSIDE = {
  gingham: '#4F8A34',
  counter: '#8C5A36',
  shelf: '#5A3A24',
  lawn: '#3C6B2D',
  party: '#C25A8A',
  camp: '#4B6B2E',
  dinner: '#6B2B30',
  farm: '#5B4030',
};

/** A canvas holding the arena's ground at `scale` device px per world px. */
export function buildGround(arena, scale) {
  const c = makeCanvas(Math.ceil(arena.w * scale), Math.ceil(arena.h * scale));
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  const rng = createRng(`ground:${arena.key}`);
  drawGround(ctx, arena, rng);
  return c;
}

export function drawGround(ctx, arena, rng) {
  switch (arena.ground) {
    case 'gingham':
      meadow(ctx, arena, rng, '#5E9E3F');
      blanket(ctx, arena, rng);
      break;
    case 'counter':
      counter(ctx, arena, rng);
      break;
    case 'shelf':
      shelf(ctx, arena, rng);
      break;
    case 'lawn':
      meadow(ctx, arena, rng, '#4E8A3A');
      break;
    case 'party':
      party(ctx, arena, rng);
      break;
    case 'camp':
      meadow(ctx, arena, rng, '#6B8E3A', true);
      stream(ctx, arena, rng);
      break;
    case 'dinner':
      dinner(ctx, arena, rng);
      break;
    case 'farm':
      farm(ctx, arena, rng);
      break;
    default:
      ctx.fillStyle = '#5E9E3F';
      ctx.fillRect(0, 0, arena.w, arena.h);
  }
  for (const d of arena.decor || []) prop(ctx, d, rng, arena);
  // Shadows first, then the props, so no shadow falls over a neighbour's top.
  for (const o of arena.obstacles) if (o.prop !== 'water') shadowOf(ctx, o);
  for (const o of arena.obstacles) if (o.prop !== 'water') prop(ctx, o, rng, arena);
  for (const b of arena.burrows) mound(ctx, b, rng, arena);
}

// ---------------------------------------------------------------- grounds

function meadow(ctx, arena, rng, base, dirt) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, arena.w, arena.h);
  // Soft patches of lighter and darker grass.
  for (let i = 0; i < 40; i++) {
    const x = rng.range(0, arena.w);
    const y = rng.range(0, arena.h);
    const r = rng.range(80, 220);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rng.chance(0.5);
    g.addColorStop(0, light ? 'rgba(170,210,90,0.22)' : 'rgba(30,70,25,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (dirt) {
    for (let i = 0; i < 14; i++) {
      const x = rng.range(0, arena.w);
      const y = rng.range(0, arena.h);
      const r = rng.range(60, 140);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(150,110,60,0.55)');
      g.addColorStop(1, 'rgba(150,110,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  // Blades.
  const n = Math.round((arena.w * arena.h) / 260);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, arena.w);
    const y = rng.range(0, arena.h);
    const len = rng.range(5, 12);
    const a = -Math.PI / 2 + rng.range(-0.7, 0.7);
    const k = rng.next();
    ctx.strokeStyle = k < 0.45 ? 'rgba(25,60,20,0.35)' : k < 0.85 ? 'rgba(140,195,80,0.4)' : 'rgba(200,235,140,0.5)';
    ctx.lineWidth = rng.range(1.2, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 2, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  // A few clover and daisies.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(20, arena.w - 20);
    const y = rng.range(20, arena.h - 20);
    if (rng.chance(0.5)) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 1.8, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#FFCB2E';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60,120,45,0.9)';
      for (let p = 0; p < 3; p++) {
        const a = (p / 3) * Math.PI * 2 + 0.4;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function blanket(ctx, arena, rng) {
  const x0 = 128;
  const y0 = 126;
  const w = arena.w - 256;
  const h = arena.h - 252;
  // Shadow on the grass.
  ctx.fillStyle = 'rgba(25,45,15,0.35)';
  ctx.fillRect(x0 + 8, y0 + 10, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  ctx.fillStyle = '#FFF2D9';
  ctx.fillRect(x0, y0, w, h);
  const sq = 64;
  ctx.fillStyle = 'rgba(216,65,58,0.55)';
  for (let x = x0; x < x0 + w; x += sq * 2) ctx.fillRect(x, y0, sq, h);
  for (let y = y0; y < y0 + h; y += sq * 2) ctx.fillRect(x0, y, w, sq);
  // The weave: fine threads.
  ctx.strokeStyle = 'rgba(120,30,25,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x < x0 + w; x += 4) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + h);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  for (let y = y0; y < y0 + h; y += 4) {
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + w, y);
  }
  ctx.stroke();
  // Soft folds.
  for (let i = 0; i < 5; i++) {
    const fx = rng.range(x0, x0 + w);
    const a = rng.range(-0.5, 0.5) + (i % 2 ? Math.PI / 2 : 0);
    const len = Math.max(w, h) * 1.4;
    ctx.save();
    ctx.translate(fx, y0 + h * rng.range(0.2, 0.8));
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.55, 'rgba(59,34,24,0.16)');
    g.addColorStop(1, 'rgba(59,34,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-len / 2, -40, len, 80);
    ctx.restore();
  }
  ctx.restore();
  // Hem and fringe.
  ctx.strokeStyle = 'rgba(160,40,35,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
  ctx.strokeStyle = '#F3E0C0';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let x = x0 + 4; x < x0 + w; x += 7) {
    const l = 8 + rng.range(-2, 3);
    ctx.moveTo(x, y0);
    ctx.lineTo(x + rng.range(-2, 2), y0 - l);
    ctx.moveTo(x, y0 + h);
    ctx.lineTo(x + rng.range(-2, 2), y0 + h + l);
  }
  ctx.stroke();
}

function planks(ctx, x0, y0, w, h, size, vertical, colors, rng) {
  const n = Math.ceil((vertical ? w : h) / size);
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length];
    ctx.fillStyle = c;
    if (vertical) ctx.fillRect(x0 + i * size, y0, size, h);
    else ctx.fillRect(x0, y0 + i * size, w, size);
    // Grain.
    ctx.strokeStyle = 'rgba(70,35,15,0.14)';
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 7; k++) {
      const off = rng.range(4, size - 4);
      ctx.beginPath();
      const len = vertical ? h : w;
      for (let s = 0; s <= len; s += 40) {
        const wob = Math.sin(s * 0.013 + k * 2 + i) * 3 + Math.sin(s * 0.05 + k) * 1.2;
        if (vertical) ctx.lineTo(x0 + i * size + off + wob, y0 + s);
        else ctx.lineTo(x0 + s, y0 + i * size + off + wob);
      }
      ctx.stroke();
    }
    // Knots.
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(0.4)) continue;
      const kx = vertical ? x0 + i * size + size / 2 : x0 + rng.range(0, w);
      const ky = vertical ? y0 + rng.range(0, h) : y0 + i * size + size / 2;
      ctx.strokeStyle = 'rgba(70,35,15,0.25)';
      ctx.beginPath();
      ctx.ellipse(kx, ky, vertical ? 5 : 14, vertical ? 14 : 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,20,10,0.35)';
    if (vertical) ctx.fillRect(x0 + i * size, y0, 2, h);
    else ctx.fillRect(x0, y0 + i * size, w, 2);
  }
}

function counter(ctx, arena, rng) {
  // Tiles round the edge, butcher block inside.
  ctx.fillStyle = '#F4EFE6';
  ctx.fillRect(0, 0, arena.w, arena.h);
  ctx.strokeStyle = '#C9C0B2';
  ctx.lineWidth = 3;
  const t = 60;
  ctx.beginPath();
  for (let x = 0; x <= arena.w; x += t) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, arena.h);
  }
  for (let y = 0; y <= arena.h; y += t) {
    ctx.moveTo(0, y);
    ctx.lineTo(arena.w, y);
  }
  ctx.stroke();
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = rng.chance(0.5) ? 'rgba(80,150,190,0.22)' : 'rgba(255,255,255,0.4)';
    const x = Math.floor(rng.range(0, arena.w / t)) * t;
    const y = Math.floor(rng.range(0, arena.h / t)) * t;
    ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
  }
  const x0 = 130;
  const y0 = 130;
  ctx.fillStyle = 'rgba(40,20,10,0.35)';
  ctx.fillRect(x0 + 8, y0 + 10, arena.w - 260, arena.h - 260);
  planks(ctx, x0, y0, arena.w - 260, arena.h - 260, 56, true, ['#D9A066', '#CF955B', '#E0AA70', '#C98D52'], rng);
  ctx.strokeStyle = 'rgba(70,35,15,0.6)';
  ctx.lineWidth = 4;
  ctx.strokeRect(x0, y0, arena.w - 260, arena.h - 260);
  // Puddles.
  for (const z of arena.slip || []) {
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const rr = z.r * (0.9 + 0.1 * Math.sin(a * 3 + z.x) + 0.05 * Math.sin(a * 7));
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(120,190,235,0.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(-z.r * 0.35, -z.r * 0.35, z.r * 0.28, z.r * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function shelf(ctx, arena, rng) {
  ctx.fillStyle = '#6E4A2E';
  ctx.fillRect(0, 0, arena.w, arena.h);
  planks(ctx, 0, 40, arena.w, arena.h - 80, 205, false, ['#D8B07A', '#CFA56E', '#DDB884', '#D2A971'], rng);
  // The shelf's front and back lips.
  const g = ctx.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, '#4A2E1B');
  g.addColorStop(1, '#7A5232');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, arena.w, 40);
  const g2 = ctx.createLinearGradient(0, arena.h - 40, 0, arena.h);
  g2.addColorStop(0, '#9A6B42');
  g2.addColorStop(1, '#5A3A24');
  ctx.fillStyle = g2;
  ctx.fillRect(0, arena.h - 40, arena.w, 40);
  // Paper shelf liner with a scalloped edge.
  ctx.fillStyle = 'rgba(255,248,232,0.5)';
  ctx.fillRect(0, 40, arena.w, 26);
  ctx.beginPath();
  for (let x = 0; x < arena.w; x += 24) ctx.arc(x + 12, 66, 12, 0, Math.PI);
  ctx.fill();
  // Flour dust.
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(rng.range(0, arena.w), rng.range(80, arena.h - 60), rng.range(1, 3.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function party(ctx, arena, rng) {
  ctx.fillStyle = '#F6D7E5';
  ctx.fillRect(0, 0, arena.w, arena.h);
  // Polka dots.
  const cols = ['#FF8FC0', '#8FD3FF', '#FFE07A', '#A8E6A0'];
  for (let y = 30, row = 0; y < arena.h; y += 70, row++) {
    for (let x = row % 2 ? 65 : 30; x < arena.w; x += 70) {
      ctx.fillStyle = cols[(row + Math.floor(x / 70)) % cols.length];
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Spilt sprinkles and confetti.
  const sp = ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA', '#FFFFFF'];
  for (let i = 0; i < 420; i++) {
    const x = rng.range(0, arena.w);
    const y = rng.range(0, arena.h);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng.range(0, Math.PI));
    ctx.fillStyle = rng.pick(sp);
    if (rng.chance(0.7)) {
      roundRectFill(ctx, -4, -1.4, 8, 2.8, 1.4);
    } else {
      ctx.fillRect(-4, -3, 8, 6);
    }
    ctx.restore();
  }
  // Lace edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.setLineDash([2, 8]);
  ctx.strokeRect(118, 118, arena.w - 236, arena.h - 236);
  ctx.setLineDash([]);
}

function dinner(ctx, arena, rng) {
  ctx.fillStyle = '#8E3A3F';
  ctx.fillRect(0, 0, arena.w, arena.h);
  // A white linen cloth.
  const x0 = 110;
  const y0 = 110;
  ctx.fillStyle = 'rgba(30,10,10,0.35)';
  ctx.fillRect(x0 + 8, y0 + 10, arena.w - 220, arena.h - 220);
  ctx.fillStyle = '#F8F3EA';
  ctx.fillRect(x0, y0, arena.w - 220, arena.h - 220);
  ctx.strokeStyle = 'rgba(180,160,130,0.25)';
  ctx.lineWidth = 2;
  for (let x = x0 + 60; x < arena.w - x0; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, arena.h - y0);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(216,175,90,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x0 + 14, y0 + 14, arena.w - 248, arena.h - 248);
  // Place settings round the edge: plates.
  for (const [px, py] of [
    [300, 300],
    [1500, 300],
    [300, 900],
    [1500, 900],
  ]) {
    ctx.fillStyle = 'rgba(40,20,10,0.12)';
    ctx.beginPath();
    ctx.arc(px + 6, py + 7, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px, py, 88, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2E5E9E';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(46,94,158,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 56, 0, Math.PI * 2);
    ctx.stroke();
  }
  void rng;
}

function farm(ctx, arena, rng) {
  planks(ctx, 0, 0, arena.w, arena.h, 150, false, ['#C9A57A', '#C19C70', '#CFAD83', '#BD976A'], rng);
  // Scrubbed pale patches and a cat's grey hairs.
  for (let i = 0; i < 18; i++) {
    const x = rng.range(0, arena.w);
    const y = rng.range(0, arena.h);
    const r = rng.range(60, 160);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,245,225,0.3)');
    g.addColorStop(1, 'rgba(255,245,225,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = 'rgba(110,110,110,0.45)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 120; i++) {
    const x = rng.range(0, arena.w);
    const y = rng.range(0, arena.h);
    const a = rng.range(0, Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * 6 + 3, y + Math.sin(a) * 6, x + Math.cos(a) * 12, y + Math.sin(a) * 12);
    ctx.stroke();
  }
  // A runner down the middle.
  ctx.fillStyle = 'rgba(46,63,158,0.18)';
  ctx.fillRect(0, 520, arena.w, 160);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.moveTo(0, 532);
  ctx.lineTo(arena.w, 532);
  ctx.moveTo(0, 668);
  ctx.lineTo(arena.w, 668);
  ctx.stroke();
  ctx.setLineDash([]);
}

function stream(ctx, arena, rng) {
  const s = arena.stream;
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  // Banks, then water: a wavy band along the line.
  const band = (half, fill) => {
    ctx.beginPath();
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const w = half + Math.sin(t * 17) * 5 + Math.sin(t * 41) * 3;
      pts.push([s.ax + dx * t + nx * w, s.ay + dy * t + ny * w]);
    }
    for (let k = 40; k >= 0; k--) {
      const t = k / 40;
      const w = half + Math.sin(t * 13 + 2) * 5 + Math.sin(t * 37) * 3;
      pts.push([s.ax + dx * t - nx * w, s.ay + dy * t - ny * w]);
    }
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  band(s.r + 18, '#8A6A3E');
  band(s.r + 8, '#B89A62');
  band(s.r, '#3E9CC4');
  band(s.r - 14, '#5BB6DA');
  // Pebbles in the shallows, ripples.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const t = rng.next();
    const off = rng.range(-s.r * 0.7, s.r * 0.7);
    const x = s.ax + dx * t + nx * off;
    const y = s.ay + dy * t + ny * off;
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 3, Math.atan2(dy, dx), 0, Math.PI);
    ctx.stroke();
  }
  // Crossings: logs over the bridges, stepping stones at the ford.
  for (const c of arena.crossings) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.atan2(ny, nx));
    if (c.kind === 'bridge') {
      // The gap itself is walkable ground; a log bridge drawn across it.
      ctx.fillStyle = 'rgba(40,20,10,0.3)';
      roundRectFill(ctx, -s.r - 26 + 6, -54 + 8, (s.r + 26) * 2, 108, 14);
      for (const off of [-36, 0, 36]) {
        const g = ctx.createLinearGradient(0, off - 17, 0, off + 17);
        g.addColorStop(0, '#B07A47');
        g.addColorStop(0.5, '#8B5A30');
        g.addColorStop(1, '#5E3B1E');
        ctx.fillStyle = g;
        roundRectFill(ctx, -s.r - 26, off - 17, (s.r + 26) * 2, 34, 16);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        roundRect(ctx, -s.r - 26, off - 17, (s.r + 26) * 2, 34, 16);
        ctx.stroke();
        ctx.fillStyle = '#D9B07A';
        ctx.beginPath();
        ctx.ellipse(s.r + 26 - 6, off, 6, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      for (const [sx, sy, sr] of [
        [-40, -22, 22],
        [-6, 18, 24],
        [30, -14, 22],
        [52, 26, 18],
        [-52, 30, 16],
      ]) {
        ctx.fillStyle = 'rgba(40,20,10,0.3)';
        ctx.beginPath();
        ctx.arc(sx + 4, sy + 5, sr, 0, Math.PI * 2);
        ctx.fill();
        const g = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 2, sx, sy, sr);
        g.addColorStop(0, '#D8D2C4');
        g.addColorStop(1, '#8E877A');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- props

function roundRectFill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function shadowOf(ctx, o) {
  const off = o.prop === 'cake' ? 22 : o.prop === 'jar' || o.prop === 'glass' || o.prop === 'gnome' ? 18 : 12;
  ctx.fillStyle = SHADOW;
  ctx.save();
  ctx.filter = 'blur(6px)';
  if (o.k === 'c') {
    ctx.beginPath();
    ctx.ellipse(o.x + off, o.y + off, o.r * 1.04, o.r * 1.04, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.k === 'r') {
    roundRectFill(ctx, o.x + off, o.y + off, o.w, o.h, 16);
  }
  ctx.restore();
}

function ringed(ctx, x, y, r, fill, line = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = line;
  ctx.stroke();
}

function lightGrad(ctx, x, y, r, light, base, dark) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(0.6, base);
  g.addColorStop(1, dark);
  return g;
}

function prop(ctx, o, rng, arena) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (o.prop) {
    case 'basket': {
      const { x, y, w, h } = o;
      ctx.fillStyle = '#9B6A35';
      roundRectFill(ctx, x, y, w, h, 18);
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 10);
      ctx.clip();
      ctx.fillStyle = '#C8935A';
      ctx.fillRect(x, y, w, h);
      // Weave.
      for (let yy = y; yy < y + h; yy += 14) {
        for (let xx = x + ((yy - y) / 14) % 2 * 14; xx < x + w; xx += 28) {
          ctx.fillStyle = 'rgba(110,65,25,0.45)';
          roundRectFill(ctx, xx + 1, yy + 2, 12, 10, 4);
          ctx.fillStyle = 'rgba(255,230,180,0.25)';
          roundRectFill(ctx, xx + 15, yy + 2, 12, 5, 3);
        }
      }
      // A checked cloth poking out.
      ctx.fillStyle = '#FFF2D9';
      ctx.beginPath();
      ctx.moveTo(x + w * 0.25, y + 10);
      ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.55, x + w * 0.8, y + 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(216,65,58,0.6)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + w * 0.3 + k * 26, y + 10, 12, h * 0.4);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 18);
      ctx.stroke();
      ctx.strokeStyle = '#6E4520';
      ctx.lineWidth = 4;
      ctx.beginPath();
      roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 10);
      ctx.stroke();
      // The handle arching over, its shadow on the lid.
      ctx.strokeStyle = 'rgba(59,34,24,0.3)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(x + 14, y + h / 2 + 22);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2 + 2, x + w - 14, y + h / 2 + 22);
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h / 2);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2 - 22, x + w - 8, y + h / 2);
      ctx.stroke();
      ctx.strokeStyle = '#B07A42';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,180,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'glass': {
      const { x, y, r } = o;
      // Caustic light pool down-right.
      const g = ctx.createRadialGradient(x + r * 0.9, y + r * 0.9, 4, x + r * 0.8, y + r * 0.8, r * 1.5);
      g.addColorStop(0, 'rgba(255,236,120,0.75)');
      g.addColorStop(1, 'rgba(255,236,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + r * 0.8, y + r * 0.8, r * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ringed(ctx, x, y, r, 'rgba(230,245,250,0.9)', 4);
      ctx.fillStyle = lightGrad(ctx, x, y, r * 0.84, '#FFF7B0', '#F7DC5B', '#E2B92A');
      ctx.beginPath();
      ctx.arc(x, y, r * 0.84, 0, Math.PI * 2);
      ctx.fill();
      // Ice and a lemon slice.
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (const [ix, iy] of [
        [-18, -12],
        [12, 16],
      ]) {
        ctx.save();
        ctx.translate(x + ix, y + iy);
        ctx.rotate(0.4);
        roundRectFill(ctx, -10, -10, 20, 20, 4);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(x + 14, y - 16);
      ctx.fillStyle = '#FFF48A';
      ctx.strokeStyle = '#E8C21A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232,194,26,0.6)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.stroke();
      }
      ctx.restore();
      // Straw.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 4);
      ctx.lineTo(x - r - 30, y - r - 24);
      ctx.stroke();
      ctx.strokeStyle = '#FF6FB0';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r - 5, Math.PI * 1.05, Math.PI * 1.45);
      ctx.stroke();
      break;
    }
    case 'hat': {
      const { x, y, r } = o;
      ctx.fillStyle = 'rgba(59,34,24,0.22)';
      ctx.beginPath();
      ctx.arc(x + 14, y + 16, r, 0, Math.PI * 2);
      ctx.fill();
      ringed(ctx, x, y, r, lightGrad(ctx, x, y, r, '#FBE7B0', '#EFCF83', '#C9A35B'), 3.5);
      ctx.strokeStyle = 'rgba(150,110,50,0.35)';
      ctx.lineWidth = 2;
      for (let k = 1; k < 9; k++) {
        ctx.beginPath();
        ctx.arc(x, y, r * (k / 9), 0, Math.PI * 2);
        ctx.stroke();
      }
      ringed(ctx, x, y, r * 0.5, lightGrad(ctx, x, y, r * 0.5, '#FBE7B0', '#E9C470', '#BE9548'), 3);
      ctx.strokeStyle = '#D8413A';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5 + 2, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'napkin': {
      const { x, y, r } = o;
      ctx.translate(x, y);
      ctx.rotate(0.35);
      ctx.fillStyle = 'rgba(59,34,24,0.18)';
      roundRectFill(ctx, -r + 6, -r + 8, r * 2, r * 2, 6);
      ctx.fillStyle = '#FFFFFF';
      roundRectFill(ctx, -r, -r, r * 2, r * 2, 6);
      ctx.fillStyle = 'rgba(63,167,242,0.18)';
      ctx.beginPath();
      ctx.moveTo(-r, -r);
      ctx.lineTo(r, r);
      ctx.lineTo(-r, r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3FA7F2';
      ctx.lineWidth = 3;
      ctx.strokeRect(-r + 8, -r + 8, r * 2 - 16, r * 2 - 16);
      break;
    }
    case 'sink': {
      const { x, y, w, h } = o;
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#EEF2F4');
      g.addColorStop(1, '#AEB8BE');
      ctx.fillStyle = g;
      roundRectFill(ctx, x, y, w, h, 26);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 26);
      ctx.stroke();
      const g2 = ctx.createLinearGradient(x, y, x, y + h);
      g2.addColorStop(0, '#8D979E');
      g2.addColorStop(1, '#C9D1D6');
      ctx.fillStyle = g2;
      roundRectFill(ctx, x + 16, y + 16, w - 32, h - 32, 18);
      ringed(ctx, x + w / 2, y + h / 2 + 10, 16, '#6E777D', 2.5);
      ctx.strokeStyle = '#3E454A';
      ctx.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2 + k * 5, y + h / 2);
        ctx.lineTo(x + w / 2 + k * 5, y + h / 2 + 20);
        ctx.stroke();
      }
      // Tap.
      ctx.fillStyle = '#D9DFE3';
      roundRectFill(ctx, x + w / 2 - 14, y - 14, 28, 60, 12);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x + w / 2 - 14, y - 14, 28, 60, 12);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      roundRectFill(ctx, x + w / 2 - 8, y - 8, 6, 46, 3);
      break;
    }
    case 'jar': {
      const { x, y, r } = o;
      const v = o.v ?? 0;
      const lids = [
        ['#D8413A', '#FFF2D9'],
        ['#E7B53A', '#F7DC8A'],
        ['#3FA7F2', '#DDF0FF'],
        ['#7A5232', '#C9A57A'],
      ][v % 4];
      ringed(ctx, x, y, r, 'rgba(225,240,245,0.85)', 3.5);
      // Jam showing through the glass edge.
      ctx.strokeStyle = v % 2 ? 'rgba(240,160,40,0.7)' : 'rgba(180,30,60,0.6)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(x, y, r - 5, 0, Math.PI * 2);
      ctx.stroke();
      if (v === 0 || v === 3) {
        // A cloth cap tied with string.
        ctx.fillStyle = lids[0];
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const a = (k / 20) * Math.PI * 2;
          const rr = r * 0.86 + (k % 2 ? 0 : 5);
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        if (v === 0) {
          ctx.fillStyle = lids[1];
          for (let gx = -2; gx <= 2; gx++)
            for (let gy = -2; gy <= 2; gy++)
              if ((gx + gy) % 2 === 0 && Math.hypot(gx, gy) < 2.4) ctx.fillRect(x + gx * 13 - 6, y + gy * 13 - 6, 12, 12);
        }
        ctx.strokeStyle = '#F2E6CF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ringed(ctx, x, y, r * 0.8, lightGrad(ctx, x, y, r * 0.8, lids[1], lids[0], lids[0]), 2.5);
        ctx.strokeStyle = 'rgba(59,34,24,0.35)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
          ctx.lineTo(x + Math.cos(a) * r * 0.79, y + Math.sin(a) * r * 0.79);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.45, y - r * 0.45, r * 0.22, r * 0.09, -0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'board': {
      const { x, y, w, h } = o;
      ctx.fillStyle = 'rgba(59,34,24,0.25)';
      roundRectFill(ctx, x + 8, y + 10, w, h, 22);
      ctx.fillStyle = '#E8C08A';
      roundRectFill(ctx, x, y, w, h, 22);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 22);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,90,40,0.3)';
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 8; k++) {
        ctx.beginPath();
        ctx.moveTo(x + 14, y + (h * k) / 8);
        ctx.lineTo(x + w - 14, y + (h * k) / 8 + rng.range(-3, 3));
        ctx.stroke();
      }
      ringed(ctx, x + w - 26, y + h / 2, 10, '#C9935A', 2.5);
      break;
    }
    case 'lantern': {
      const { x, y, r } = o;
      ringed(ctx, x, y, r, '#2F3A40', 3);
      ringed(ctx, x, y, r * 0.65, '#FFE7A0', 2);
      ctx.strokeStyle = '#2F3A40';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r + 8, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'pot': {
      const { x, y, r } = o;
      ringed(ctx, x, y, r, lightGrad(ctx, x, y, r, '#F0A27A', '#D2693F', '#A44A28'), 3.5);
      ringed(ctx, x, y, r * 0.8, '#5A3A26', 2.5);
      // A leafy plant.
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2 + 0.3;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = k % 2 ? '#4F9A3A' : '#68B54C';
        ctx.beginPath();
        ctx.ellipse(r * 0.45, 0, r * 0.5, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'gnome': {
      const { x, y, r } = o;
      ringed(ctx, x, y, r, '#2E7DC9', 3);
      // Beard from above, then the hat.
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.35, y + r * 0.1, r * 0.55, r * 0.7, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ringed(ctx, x - r * 0.1, y - r * 0.1, r * 0.62, lightGrad(ctx, x - r * 0.1, y - r * 0.1, r * 0.62, '#FF8A80', '#D8413A', '#A12A25'), 3);
      ctx.fillStyle = '#FFE0E0';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.28, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stone': {
      const { x, y, r } = o;
      ctx.fillStyle = 'rgba(20,40,15,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 7, r, r * 0.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = lightGrad(ctx, x, y, r, '#D5D0C6', '#A9A397', '#7A756B');
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.8, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      break;
    }
    case 'cake': {
      const { x, y, r } = o;
      ringed(ctx, x, y, r + 14, '#FFFFFF', 3.5); // the stand
      ringed(ctx, x, y, r, lightGrad(ctx, x, y, r, '#FFE3EE', '#FFB3CF', '#E77FA8'), 3.5);
      // Piped border.
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        ringed(ctx, x + Math.cos(a) * (r - 10), y + Math.sin(a) * (r - 10), 9, '#FFFFFF', 1.5);
      }
      // Sprinkles.
      const sp = ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA'];
      for (let k = 0; k < 70; k++) {
        const a = rng.range(0, Math.PI * 2);
        const d = Math.sqrt(rng.next()) * (r - 26);
        ctx.save();
        ctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d);
        ctx.rotate(rng.range(0, Math.PI));
        ctx.fillStyle = rng.pick(sp);
        roundRectFill(ctx, -4, -1.5, 8, 3, 1.5);
        ctx.restore();
      }
      // Candles (their flames drawn live).
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const cx = x + Math.cos(a) * r * 0.45;
        const cy = y + Math.sin(a) * r * 0.45;
        ringed(ctx, cx, cy, 8, ['#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA', '#FF8424'][k], 2.5);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, Math.PI, Math.PI * 1.6);
        ctx.stroke();
      }
      break;
    }
    case 'present': {
      const { x, y, w, h } = o;
      const v = o.v ?? 0;
      const [base, rib] = v ? ['#3FA7F2', '#FFCB2E'] : ['#9A5BEA', '#FF6FB0'];
      ctx.fillStyle = base;
      roundRectFill(ctx, x, y, w, h, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + 6 + k * 20, y, 8, h);
      ctx.fillStyle = rib;
      ctx.fillRect(x + w / 2 - 9, y, 18, h);
      ctx.fillRect(x, y + h / 2 - 9, w, 18);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 8);
      ctx.stroke();
      // Bow.
      for (const s of [-1, 1]) {
        ctx.fillStyle = rib;
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + s * 16, y + h / 2, 17, 11, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ringed(ctx, x + w / 2, y + h / 2, 8, rib, 3);
      break;
    }
    case 'popper': {
      const { x, y } = o;
      const sc = ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A'];
      ctx.lineWidth = 4;
      for (let k = 0; k < 9; k++) {
        ctx.strokeStyle = sc[k % 4];
        ctx.beginPath();
        ctx.moveTo(x, y);
        const a = -1.2 + k * 0.28;
        let px = x;
        let py = y;
        for (let s = 1; s <= 6; s++) {
          px += Math.cos(a) * 18;
          py += Math.sin(a) * 18;
          ctx.lineTo(px + Math.sin(s * 1.7 + k) * 7, py + Math.cos(s * 1.7 + k) * 7);
        }
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(2.6);
      ctx.fillStyle = '#FFCB2E';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(56, -6);
      ctx.lineTo(56, 6);
      ctx.lineTo(0, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'tent': {
      const { x, y, w, h } = o;
      ctx.fillStyle = '#2E9E7A';
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.1);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.1);
      ctx.lineTo(x + w, y + h * 0.9);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.1);
      ctx.lineTo(x + w, y + h * 0.9);
      ctx.lineTo(x + w / 2, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.1);
      ctx.lineTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h * 0.1);
      ctx.lineTo(x + w, y + h * 0.9);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h * 0.9);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
      ctx.strokeStyle = '#FFCB2E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 20, y + h * 0.1);
      ctx.lineTo(x, y + h * 0.1);
      ctx.moveTo(x + w, y + h * 0.9);
      ctx.lineTo(x + w + 20, y + h * 0.9 + 8);
      ctx.stroke();
      break;
    }
    case 'fire': {
      const { x, y, r } = o;
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        ringed(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 13, lightGrad(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 13, '#C9C3B8', '#9A9488', '#6E695F'), 2.5);
      }
      ringed(ctx, x, y, r - 8, '#3A2A22', 2);
      for (const a of [0.3, 1.9, 3.6]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = '#7A4B26';
        roundRectFill(ctx, -r * 0.7, -6, r * 1.4, 12, 6);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        roundRect(ctx, -r * 0.7, -6, r * 1.4, 12, 6);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'teapot': {
      const { x, y, r } = o;
      // Spout and handle first, then the lid.
      ctx.fillStyle = '#F6F3EE';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.7, y - 10);
      ctx.lineTo(x + r + 34, y - 18);
      ctx.lineTo(x + r + 36, y - 6);
      ctx.lineTo(x + r * 0.7, y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x - r - 12, y, 18, 12, 0, 0, Math.PI * 2);
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = '#F6F3EE';
      ctx.lineWidth = 5;
      ctx.stroke();
      ringed(ctx, x, y, r, lightGrad(ctx, x, y, r, '#FFFFFF', '#F1ECE4', '#C9C1B4'), 3.5);
      ctx.strokeStyle = '#2E5E9E';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ringed(ctx, x, y, r * 0.42, '#FFFFFF', 3);
      ringed(ctx, x, y, 7, '#2E5E9E', 2);
      break;
    }
    case 'bowl': {
      const { x, y, r } = o;
      ringed(ctx, x, y, r, lightGrad(ctx, x, y, r, '#FFFFFF', '#E8EEF5', '#B8C4D2'), 3.5);
      ringed(ctx, x, y, r * 0.78, '#FBF8F2', 2);
      ctx.strokeStyle = '#3FA7F2';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.25, r * 0.1, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'butter': {
      const { x, y, w, h } = o;
      ctx.fillStyle = '#FFFFFF';
      roundRectFill(ctx, x - 14, y - 14, w + 28, h + 28, 14);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      roundRect(ctx, x - 14, y - 14, w + 28, h + 28, 14);
      ctx.stroke();
      ctx.fillStyle = lightGrad(ctx, x + w / 2, y + h / 2, w * 0.6, '#FFF6C8', '#FFE58A', '#F2CA55');
      roundRectFill(ctx, x, y, w, h, 6);
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,150,40,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 30);
      ctx.quadraticCurveTo(x + w / 2, y + 10, x + w - 20, y + 40);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
  void arena;
}

/** A burrow's mound of hamster bedding (the hole itself is drawn live, so empty burrows stay closed). */
function mound(ctx, b, rng, arena) {
  ctx.save();
  ctx.translate(b.x - b.nx * 6, b.y - b.ny * 6);
  const dark = arena.ground === 'lawn';
  for (let i = 0; i < 46; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = 30 + rng.range(0, 22);
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
    ctx.rotate(rng.range(0, Math.PI));
    ctx.fillStyle = rng.pick(dark ? ['#C9AE7E', '#B89B6A', '#D8C08E'] : ['#F2DDB0', '#E6CB94', '#FBEBC8', '#DDBE86']);
    ctx.strokeStyle = 'rgba(59,34,24,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, rng.range(6, 11), rng.range(2.5, 4), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
