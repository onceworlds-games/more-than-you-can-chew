// The bitten biscuit: the game's one panel, button and plaque. A baked texture for the page's CSS, sprites for the
// canvas HUD, and piped icing text.

import { makeCanvas, roundRect } from './food.js';
import { createRng } from './rng.js';

const INK = '#3B2218';

/** A tileable baked surface (golden with darker speckles and sugar), as a canvas. */
export function biscuitTexture(size = 192, seed = 'biscuit') {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const rng = createRng(seed);
  ctx.fillStyle = '#E3A24F';
  ctx.fillRect(0, 0, size, size);
  // Browner and paler blotches, wrapped so the tile repeats.
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(size * 0.08, size * 0.22);
    const dark = rng.chance(0.55);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, dark ? 'rgba(170,95,30,0.28)' : 'rgba(255,215,140,0.3)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
  for (let i = 0; i < size * 2.2; i++) {
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const k = rng.next();
    ctx.fillStyle = k < 0.55 ? 'rgba(140,75,25,0.35)' : k < 0.85 ? 'rgba(255,230,180,0.55)' : 'rgba(255,255,255,0.7)';
    ctx.fillRect(x, y, rng.range(0.8, 2), rng.range(0.8, 2));
  }
  return c;
}

const cache = new Map();

/**
 * A biscuit sprite: a rounded slab (or a disc when `round`) with a baked rim, docking holes, a bite out of one corner
 * and a drop shadow. Sizes in CSS px; `scale` is device px per CSS px. Returns { canvas, pad } (pad = shadow margin).
 */
export function biscuitSprite(w, h, { scale = 1, radius = 18, bite = 'tr', round = false, tint = null, holes = true } = {}) {
  const key = `${w}|${h}|${scale}|${radius}|${bite}|${round}|${tint}|${holes}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pad = 8;
  const c = makeCanvas(Math.ceil((w + pad * 2) * scale), Math.ceil((h + pad * 2) * scale));
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(pad, pad);
  const shape = () => {
    ctx.beginPath();
    if (round) ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else roundRect(ctx, 0, 0, w, h, radius);
  };
  // Drop shadow.
  ctx.save();
  ctx.translate(2, 4);
  shape();
  ctx.fillStyle = 'rgba(59,34,24,0.45)';
  ctx.fill();
  ctx.restore();
  // Body.
  shape();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  if (round) ctx.ellipse(w / 2, h / 2, w / 2 - 2.5, h / 2 - 2.5, 0, 0, Math.PI * 2);
  else roundRect(ctx, 2.5, 2.5, w - 5, h - 5, Math.max(2, radius - 2.5));
  ctx.clip();
  const tex = biscuitTexture(128, `b:${tint}`);
  const pat = ctx.createPattern(tex, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  if (tint) {
    ctx.fillStyle = tint;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Baked rim: darker towards the edge, a soft highlight on the upper left.
  const rim = Math.min(w, h) * 0.16 + 4;
  ctx.lineWidth = rim * 2;
  ctx.strokeStyle = 'rgba(150,80,25,0.42)';
  ctx.filter = 'blur(3px)';
  shape();
  ctx.stroke();
  ctx.filter = 'none';
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, 'rgba(255,240,200,0.35)');
  g.addColorStop(0.5, 'rgba(255,240,200,0)');
  g.addColorStop(1, 'rgba(90,45,15,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Docking holes.
  if (holes) {
    const rows = Math.max(1, Math.round(h / 40));
    const cols = Math.max(2, Math.round(w / 40));
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const x = ((k + 0.5) / cols) * w;
        const y = ((r + 0.5) / rows) * h;
        if (round && Math.hypot((x - w / 2) / (w / 2), (y - h / 2) / (h / 2)) > 0.7) continue;
        if (!round && (y < 9 || y > h - 9)) continue;
        ctx.fillStyle = 'rgba(110,55,15,0.55)';
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,235,190,0.5)';
        ctx.beginPath();
        ctx.arc(x + 0.8, y + 1, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  // The bite: scallops out of one corner, with a paler broken edge.
  if (bite) {
    const bx = bite.includes('r') ? w : 0;
    const by = bite.includes('b') ? h : 0;
    const R = Math.min(w, h) * 0.3 + 4;
    const sx = bx === 0 ? 1 : -1;
    const sy = by === 0 ? 1 : -1;
    const bites = [
      [bx + sx * R * 0.15, by + sy * R * 0.62, R * 0.5],
      [bx + sx * R * 0.55, by + sy * R * 0.45, R * 0.48],
      [bx + sx * R * 0.72, by + sy * R * 0.08, R * 0.46],
    ];
    // Crumbly edge first (paler ring), then cut.
    ctx.fillStyle = '#F6D9A0';
    for (const [x, y, r] of bites) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of bites) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Outline only where the biscuit is: re-stroke the bite edge in ink, clipped to the biscuit.
    ctx.save();
    shape();
    ctx.clip();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    for (const [x, y, r] of bites) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (const [x, y, r] of bites) {
      ctx.beginPath();
      ctx.arc(x, y, r + 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  const out = { canvas: c, pad };
  if (cache.size > 80) cache.clear();
  cache.set(key, out);
  return out;
}

/** Draws a cached biscuit at (x, y) (its top left, CSS px). */
export function drawBiscuit(ctx, x, y, w, h, opts = {}) {
  const s = biscuitSprite(w, h, opts);
  ctx.drawImage(s.canvas, x - s.pad, y - s.pad, w + s.pad * 2, h + s.pad * 2);
}

/** Icing text: cream with a thick cocoa outline and a short drop shadow. */
export function piped(ctx, text, x, y, size, { color = '#FFF2D9', font = 'Shrikhand', align = 'center', outline = 0.24, shadow = true } = {}) {
  ctx.save();
  ctx.font = `${font === 'Shrikhand' ? '' : '800 '}${Math.round(size)}px ${font === 'Shrikhand' ? 'Shrikhand, "Bricolage Grotesque", sans-serif' : '"Bricolage Grotesque", system-ui, sans-serif'}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const lw = Math.max(3, size * outline);
  if (shadow) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(59,34,24,0.55)';
    ctx.strokeText(text, x + size * 0.04, y + size * 0.08);
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
