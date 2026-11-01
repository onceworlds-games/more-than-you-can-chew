// Food, drawn in crisp vector with cocoa outlines, lit from the upper left. Cached as sprites per scale.

import { FOODS } from './config.js';

const INK = '#3B2218';

function teardrop(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.bezierCurveTo(len * 0.55, -wid * 1.05, -len * 0.75, -wid * 1.05, -len, 0);
  ctx.bezierCurveTo(-len * 0.75, wid * 1.05, len * 0.55, wid * 1.05, len, 0);
  ctx.closePath();
}

function radial(ctx, r, light, base, dark) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.05);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, dark);
  return g;
}

/** Draws one piece centred on the origin, `r` in the current units. */
export function drawFood(ctx, type, r) {
  const ow = Math.max(1.4, r * 0.16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (FOODS[type].key) {
    case 'seed':
    case 'golden': {
      const gold = FOODS[type].key === 'golden';
      const len = r * 1.25;
      const wid = r * 0.62;
      teardrop(ctx, len, wid);
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = gold ? radial(ctx, len, '#FFF6C2', '#FFC928', '#C98A0C') : radial(ctx, len, '#5B5552', '#2E2A29', '#141212');
      ctx.fill();
      ctx.save();
      teardrop(ctx, len, wid);
      ctx.clip();
      ctx.strokeStyle = gold ? 'rgba(255,255,255,0.55)' : '#E9E1D3';
      ctx.lineWidth = r * 0.16;
      for (const k of [-0.42, 0, 0.42]) {
        ctx.beginPath();
        ctx.moveTo(-len * 0.85, k * wid);
        ctx.quadraticCurveTo(0, k * wid * 1.4, len * 0.9, k * wid * 0.3);
        ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(-len * 0.15, -wid * 0.45, len * 0.38, wid * 0.16, -0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'nut': {
      ctx.beginPath();
      ctx.moveTo(r * 0.05, -r * 1.12);
      ctx.bezierCurveTo(r * 0.9, -r * 0.9, r * 1.05, r * 0.6, 0, r * 0.98);
      ctx.bezierCurveTo(-r * 1.05, r * 0.6, -r * 0.9, -r * 0.9, r * 0.05, -r * 1.12);
      ctx.closePath();
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = radial(ctx, r, '#E0A262', '#A8622A', '#6E3A16');
      ctx.fill();
      // The pale cap.
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#E8C99A';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.62, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,90,40,0.45)';
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(i * r * 0.22, r * 0.72 + Math.abs(i) * r * 0.03, r * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = 'rgba(80,40,10,0.35)';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, -r * 0.6);
      ctx.quadraticCurveTo(-r * 0.4, 0, -r * 0.3, r * 0.3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,220,0.75)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.32, -r * 0.45, r * 0.18, r * 0.32, 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'berry': {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = radial(ctx, r, '#8FA8F0', '#3E4FA8', '#1D2260');
      ctx.fill();
      ctx.fillStyle = 'rgba(200,215,255,0.28)';
      ctx.beginPath();
      ctx.arc(-r * 0.15, -r * 0.1, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      // The crown.
      ctx.fillStyle = '#1A1640';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 ? r * 0.16 : r * 0.36;
        ctx.lineTo(r * 0.18 + Math.cos(a) * rr, r * 0.12 + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.4, -r * 0.42, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cracker': {
      const s = r * 0.9;
      const k = r * 0.28;
      ctx.beginPath();
      roundRect(ctx, -s, -s, s * 2, s * 2, k);
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      const g = ctx.createLinearGradient(-s, -s, s, s);
      g.addColorStop(0, '#F7D58C');
      g.addColorStop(0.6, '#E6AE55');
      g.addColorStop(1, '#C98535');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.6)';
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      roundRect(ctx, -s * 0.82, -s * 0.82, s * 1.64, s * 1.64, k * 0.8);
      ctx.stroke();
      ctx.fillStyle = '#9B5E22';
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++) {
          ctx.beginPath();
          ctx.arc(i * s * 0.5, j * s * 0.5, r * 0.075, 0, Math.PI * 2);
          ctx.fill();
        }
      ctx.fillStyle = 'rgba(160,90,30,0.25)';
      ctx.beginPath();
      ctx.arc(s * 0.4, -s * 0.2, r * 0.22, 0, Math.PI * 2);
      ctx.arc(-s * 0.3, s * 0.45, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'straw': {
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.bezierCurveTo(-r * 1.15, r * 0.25, -r * 1.05, -r * 0.85, 0, -r * 0.72);
      ctx.bezierCurveTo(r * 1.05, -r * 0.85, r * 1.15, r * 0.25, 0, r * 1.05);
      ctx.closePath();
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = radial(ctx, r, '#FF8A80', '#E0242E', '#8E0F1A');
      ctx.fill();
      ctx.fillStyle = '#FFE07A';
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4;
        const d = Math.sqrt((i + 0.5) / 14) * r * 0.78;
        const x = Math.cos(a) * d * 0.85;
        const y = Math.sin(a) * d * 0.9 + r * 0.12;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.05, r * 0.08, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // Leaves.
      ctx.fillStyle = '#2F8A3A';
      ctx.strokeStyle = INK;
      ctx.lineWidth = ow * 1.2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62;
        ctx.moveTo(0, -r * 0.62);
        ctx.quadraticCurveTo(Math.cos(a - 0.3) * r * 0.5, -r * 0.62 + Math.sin(a - 0.3) * r * 0.5, Math.cos(a) * r * 0.62, -r * 0.62 + Math.sin(a) * r * 0.42);
        ctx.quadraticCurveTo(Math.cos(a + 0.3) * r * 0.5, -r * 0.62 + Math.sin(a + 0.3) * r * 0.5, 0, -r * 0.62);
      }
      ctx.stroke();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, -r * 0.1, r * 0.13, r * 0.3, 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cookie': {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = r * (1 + 0.035 * Math.sin(i * 2.7));
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.lineWidth = ow * 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, '#F2C27A');
      g.addColorStop(0.7, '#D99446');
      g.addColorStop(1, '#A9652B');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,80,30,0.45)';
      ctx.lineWidth = r * 0.04;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.1);
      ctx.lineTo(-r * 0.15, r * 0.05);
      ctx.lineTo(r * 0.05, -r * 0.25);
      ctx.moveTo(r * 0.2, r * 0.4);
      ctx.lineTo(r * 0.5, r * 0.3);
      ctx.stroke();
      const chips = [
        [-0.45, -0.45, 0.17],
        [0.3, -0.5, 0.14],
        [0.55, 0.05, 0.16],
        [-0.1, 0.5, 0.18],
        [-0.6, 0.25, 0.13],
        [0.1, -0.05, 0.12],
        [0.35, 0.6, 0.1],
      ];
      for (const [x, y, s] of chips) {
        ctx.fillStyle = '#4A2614';
        ctx.beginPath();
        ctx.moveTo(x * r - s * r, y * r + s * r * 0.4);
        ctx.lineTo(x * r - s * r * 0.2, y * r - s * r);
        ctx.lineTo(x * r + s * r, y * r + s * r * 0.2);
        ctx.lineTo(x * r + s * r * 0.1, y * r + s * r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,220,190,0.35)';
        ctx.fillRect(x * r - s * r * 0.4, y * r - s * r * 0.5, s * r * 0.4, s * r * 0.25);
      }
      break;
    }
    default:
      break;
  }
}

/** Sprites of every food at a scale (device px per world px): { canvas, half } each. */
export function foodSprites(scale) {
  const out = [];
  for (let i = 0; i < FOODS.length; i++) {
    const r = FOODS[i].r;
    const half = Math.ceil((r * 1.45 + 3) * scale);
    const c = makeCanvas(half * 2, half * 2);
    const ctx = c.getContext('2d');
    ctx.translate(half, half);
    ctx.scale(scale, scale);
    drawFood(ctx, i, r);
    out.push({ canvas: c, half });
  }
  return out;
}

/** A rounded rectangle path (ctx.roundRect is missing on older Safari). */
export function roundRect(ctx, x, y, w, h, r) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.arcTo(x + w, y, x + w, y + k, k);
  ctx.lineTo(x + w, y + h - k);
  ctx.arcTo(x + w, y + h, x + w - k, y + h, k);
  ctx.lineTo(x + k, y + h);
  ctx.arcTo(x, y + h, x, y + h - k, k);
  ctx.lineTo(x, y + k);
  ctx.arcTo(x, y, x + k, y, k);
  ctx.closePath();
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
