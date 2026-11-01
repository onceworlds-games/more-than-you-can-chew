// The hamsters, drawn from above: chunky round bodies, a bandana in the seat's colour with its emblem, and cheeks that
// swell (the signature). Lit from the upper left whatever way they face. Drawn in world units around (0, 0).

import { ALL_COATS, SEATS, CAP, MAX } from './config.js';
import { bulge } from './rules.js';

const INK = '#3B2218';
const PINK = '#F4A7A1';
const HOT = '#FF4D6D';

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/** An emblem centred on the origin (radius r): circle, star, triangle, diamond, square, heart, cross, moon. */
export function emblemPath(ctx, kind, r) {
  ctx.beginPath();
  switch (kind) {
    case 'circle':
      ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.95, r * 0.75);
      ctx.lineTo(-r * 0.95, r * 0.75);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      break;
    case 'heart':
      ctx.moveTo(0, r * 0.9);
      ctx.bezierCurveTo(-r * 1.3, 0, -r * 0.7, -r * 1.05, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.7, -r * 1.05, r * 1.3, 0, 0, r * 0.9);
      ctx.closePath();
      break;
    case 'cross': {
      const k = r * 0.34;
      ctx.moveTo(-k, -r);
      ctx.lineTo(k, -r);
      ctx.lineTo(k, -k);
      ctx.lineTo(r, -k);
      ctx.lineTo(r, k);
      ctx.lineTo(k, k);
      ctx.lineTo(k, r);
      ctx.lineTo(-k, r);
      ctx.lineTo(-k, k);
      ctx.lineTo(-r, k);
      ctx.lineTo(-r, -k);
      ctx.lineTo(-k, -k);
      ctx.closePath();
      break;
    }
    case 'moon':
      ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75);
      ctx.arc(r * 0.45, 0, r * 0.72, Math.PI * 1.62, Math.PI * 0.38, true);
      ctx.closePath();
      break;
    default:
      ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

/**
 * Draws a hamster. `s`: { x, y, a (facing), fill, coat, seat, t (seconds), gait (phase), speed, wob (cheek spring),
 * bite (0..1 pulse), sx, sy (squash), sway, blink (0..1 closed), dizzy, stun, happy, away, crown, strain (0..1) }
 */
export function drawHamster(ctx, s) {
  const coat = ALL_COATS[s.coat] ?? ALL_COATS[0];
  const seat = SEATS[s.seat % SEATS.length];
  const fill = s.dizzy > 0 ? 0 : s.fill;
  const over = Math.max(0, Math.min(1, (fill - CAP) / (MAX - CAP)));
  const isOver = fill > CAP;
  let B = bulge(fill) * (1 + (s.wob || 0));
  if (isOver) B *= 1 + 0.05 * Math.sin(s.t * 31) * (0.4 + over);
  const cheekR = 5 + B * 0.78;
  const cheekY = 8 + B * 0.56;
  const cheekX = 11 - B * 0.12;
  const dizzy = s.dizzy > 0;

  ctx.save();
  ctx.translate(s.x, s.y);
  if (s.away) ctx.globalAlpha *= 0.45;
  ctx.rotate(s.a + (s.sway || 0));
  ctx.scale(s.sx || 1, s.sy || 1);
  if (dizzy) ctx.scale(0.92, 1.22);

  // Light from the upper left of the world, in this frame.
  const la = -s.a - (s.sway || 0);
  const lx = Math.cos(la) * -0.45 - Math.sin(la) * -0.55;
  const ly = Math.sin(la) * -0.45 + Math.cos(la) * -0.55;

  const gait = s.gait || 0;
  const step = Math.sin(gait) * Math.min(1, (s.speed || 0) / 120) * 4.5;
  const headBob = (s.bite || 0) * 2.5;

  const feet = [
    [9 + step, -12.5],
    [9 - step, 12.5],
    [-11 - step, -12],
    [-11 + step, 12],
  ];
  const bodyX = -3;
  const bodyRX = 21;
  const bodyRY = 17;
  const headX = 13 + headBob;
  const headR = 13.5;
  const earBack = Math.min(1, fill / CAP);
  const ears = [
    [5 - earBack * 2.5 + headBob, -10.5 - earBack * 1.5],
    [5 - earBack * 2.5 + headBob, 10.5 + earBack * 1.5],
  ];
  const cheeks = [
    [cheekX + headBob, -cheekY],
    [cheekX + headBob, cheekY],
  ];

  // 1. The outline: every part, a little bigger, in ink.
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.2;
  ctx.lineJoin = 'round';
  const outline = () => {
    ctx.fill();
    ctx.stroke();
  };
  for (const [fx, fy] of feet) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, 4.6, 3.6, 0, 0, Math.PI * 2);
    outline();
  }
  ctx.beginPath();
  ctx.arc(-22.5, 0, 3.6, 0, Math.PI * 2);
  outline();
  ctx.beginPath();
  ctx.ellipse(bodyX, 0, bodyRX, bodyRY, 0, 0, Math.PI * 2);
  outline();
  for (const [ex, ey] of ears) {
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.4 * (1 - earBack * 0.25), 5.4, 0, 0, Math.PI * 2);
    outline();
  }
  for (const [cx, cy] of cheeks) {
    ctx.beginPath();
    ctx.arc(cx, cy, cheekR, 0, Math.PI * 2);
    outline();
  }
  ctx.beginPath();
  ctx.arc(headX, 0, headR, 0, Math.PI * 2);
  outline();

  // 2. The colours.
  const furGrad = (cx, cy, r, base, dark, light) => {
    const g = ctx.createRadialGradient(cx + lx * r * 0.7, cy + ly * r * 0.7, r * 0.1, cx, cy, r * 1.08);
    g.addColorStop(0, light);
    g.addColorStop(0.55, base);
    g.addColorStop(1, dark);
    return g;
  };
  const light = mix(coat.base, '#FFFFFF', 0.35);
  ctx.fillStyle = PINK;
  for (const [fx, fy] of feet) {
    ctx.beginPath();
    ctx.ellipse(fx, fy, 4.6, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(-22.5, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = furGrad(bodyX, 0, bodyRX, coat.base, coat.dark, light);
  ctx.beginPath();
  ctx.ellipse(bodyX, 0, bodyRX, bodyRY, 0, 0, Math.PI * 2);
  ctx.fill();
  // Markings on the back.
  if (coat.mark) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(bodyX, 0, bodyRX - 0.5, bodyRY - 0.5, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = coat.mark.color;
    switch (coat.mark.kind) {
      case 'band':
        ctx.fillRect(-11, -20, 9, 40);
        break;
      case 'patches':
        ctx.beginPath();
        ctx.ellipse(-12, -6, 9, 8, 0.4, 0, Math.PI * 2);
        ctx.ellipse(0, 9, 7, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'panda':
        ctx.fillRect(-4, -20, 8, 40);
        ctx.beginPath();
        ctx.ellipse(-17, 0, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'spot':
        ctx.beginPath();
        ctx.ellipse(-9, -3, 7, 6, 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'shimmer':
        for (let i = 0; i < 5; i++) {
          const tw = 0.5 + 0.5 * Math.sin(s.t * 3 + i * 1.9);
          ctx.globalAlpha = tw;
          ctx.beginPath();
          const px = -16 + i * 7;
          const py = Math.sin(i * 2.3) * 9;
          ctx.moveTo(px, py - 3);
          ctx.lineTo(px + 1, py);
          ctx.lineTo(px, py + 3);
          ctx.lineTo(px - 1, py);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      default:
        break;
    }
    ctx.restore();
  }
  // A soft fur sheen.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.quadraticCurveTo(-10, -12, -2, -11);
  ctx.moveTo(-17, 5);
  ctx.quadraticCurveTo(-9, 0, -1, 2);
  ctx.stroke();

  // The bandana round the neck, its knot and tails trailing over the back.
  const flap = Math.sin(s.t * 14 + (s.seat || 0)) * Math.min(1, (s.speed || 0) / 100) * 2.4;
  ctx.fillStyle = seat.color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -1.5);
  ctx.quadraticCurveTo(-10, -6 + flap, -16, -6 + flap * 1.6);
  ctx.lineTo(-13, -1.5 + flap);
  ctx.closePath();
  ctx.moveTo(-3, 1.5);
  ctx.quadraticCurveTo(-10, 6 - flap, -16, 5 - flap * 1.4);
  ctx.lineTo(-13, 1 - flap);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(headX, 0, headR + 1.6, Math.PI * 0.62, Math.PI * 1.38);
  ctx.stroke();
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = seat.color;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headX - headR - 1.8, 0, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = seat.color;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  ctx.translate(headX - headR - 1.8, 0);
  ctx.rotate(-s.a - (s.sway || 0));
  ctx.fillStyle = '#FFFFFF';
  emblemPath(ctx, seat.emblem, 3);
  ctx.fill();
  ctx.restore();

  // Ears.
  for (const [ex, ey] of ears) {
    ctx.fillStyle = coat.mark && coat.mark.kind === 'panda' ? coat.mark.color : coat.dark;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 5.4 * (1 - earBack * 0.25), 5.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.ellipse(ex + 1.2, ey * 0.98, 3 * (1 - earBack * 0.3), 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheeks: the coat's paler colour, hot pink and shiny when overstuffed.
  const cheekBase = isOver ? mix(coat.belly, HOT, 0.45 + over * 0.55) : coat.belly;
  const cheekDark = isOver ? mix(coat.dark, '#B01236', 0.5 + over * 0.5) : mix(coat.belly, coat.dark, 0.55);
  for (const [cx, cy] of cheeks) {
    ctx.fillStyle = furGrad(cx, cy, cheekR, cheekBase, cheekDark, mix(cheekBase, '#FFFFFF', 0.5));
    ctx.beginPath();
    ctx.arc(cx, cy, cheekR, 0, Math.PI * 2);
    ctx.fill();
    if (B > 4) {
      ctx.fillStyle = `rgba(255,255,255,${isOver ? 0.75 : 0.35})`;
      ctx.beginPath();
      ctx.ellipse(cx + lx * cheekR * 0.45, cy + ly * cheekR * 0.45, cheekR * 0.3, cheekR * 0.18, Math.atan2(ly, lx) + 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (dizzy) {
      ctx.strokeStyle = 'rgba(59,34,24,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 2);
      ctx.lineTo(cx + 2, cy + 1);
      ctx.stroke();
    }
  }

  // Head.
  ctx.fillStyle = furGrad(headX, 0, headR, coat.base, coat.dark, light);
  ctx.beginPath();
  ctx.arc(headX, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  if (coat.mark) {
    ctx.fillStyle = coat.mark.color;
    if (coat.mark.kind === 'blaze') {
      ctx.beginPath();
      ctx.ellipse(headX + 4, 0, 9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (coat.mark.kind === 'panda') {
      ctx.beginPath();
      ctx.ellipse(headX + 7, -7, 4.2, 3.4, 0.3, 0, Math.PI * 2);
      ctx.ellipse(headX + 7, 7, 4.2, 3.4, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (coat.mark.kind === 'patches') {
      ctx.beginPath();
      ctx.ellipse(headX - 5, -6, 6, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Muzzle.
  ctx.fillStyle = mix(coat.belly, '#FFFFFF', 0.2);
  ctx.beginPath();
  ctx.ellipse(headX + 9, 0, 5.2, 6.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes.
  const ex = headX + 7.5;
  const eyeY = 7.2;
  const pandaEyes = coat.mark && coat.mark.kind === 'panda';
  if (dizzy) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        const a = k * 0.75 + s.t * 9;
        const r = 0.3 + k * 0.2;
        ctx.lineTo(ex + Math.cos(a) * r, sy * eyeY + Math.sin(a) * r);
      }
      ctx.stroke();
    }
  } else if (s.happy > 0 || (isOver && over > 0.5)) {
    // Happy arcs, or squeezed shut with the strain.
    ctx.strokeStyle = pandaEyes ? '#FFFFFF' : INK;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      if (s.happy > 0) ctx.arc(ex - 0.8, sy * eyeY, 2.4, -Math.PI / 2 - 1, -Math.PI / 2 + 1);
      else {
        ctx.moveTo(ex - 2.2, sy * eyeY - 2);
        ctx.lineTo(ex + 1.2, sy * eyeY);
        ctx.lineTo(ex - 2.2, sy * eyeY + 2);
      }
      ctx.save();
      ctx.translate(ex, sy * eyeY);
      ctx.rotate(0);
      ctx.restore();
      ctx.stroke();
    }
  } else {
    const shut = s.blink || 0;
    for (const sy of [-1, 1]) {
      ctx.fillStyle = '#120B08';
      ctx.beginPath();
      ctx.ellipse(ex, sy * eyeY, 2.9 * (1 - shut * 0.85), 2.9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (shut < 0.5) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex + lx * 1.3, sy * eyeY + ly * 1.3, 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Nose and whiskers.
  ctx.fillStyle = '#E8737A';
  ctx.beginPath();
  ctx.ellipse(headX + 13.4, 0, 2.2, 2.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,34,24,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const sy of [-1, 1]) {
    ctx.moveTo(headX + 11, sy * 3);
    ctx.lineTo(headX + 18, sy * (7 + B * 0.4));
    ctx.moveTo(headX + 11, sy * 3.5);
    ctx.lineTo(headX + 16, sy * (11 + B * 0.5));
  }
  ctx.stroke();

  // Strain: little marks beside overstuffed cheeks.
  if (isOver && !dizzy) {
    ctx.strokeStyle = HOT;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const j = Math.sin(s.t * 20) * 1.2;
    for (const sy of [-1, 1]) {
      const cy = sy * (cheekY + cheekR + 4 + j);
      ctx.beginPath();
      ctx.arc(cheekX + headBob, sy * cheekY, cheekR + 4.5 + j, sy > 0 ? 0.2 : -1.2, sy > 0 ? 1.2 : -0.2);
      ctx.stroke();
      void cy;
    }
  }
  if (s.crown) {
    ctx.save();
    ctx.translate(headX - 2, 0);
    ctx.rotate(-s.a - (s.sway || 0));
    drawCap(ctx, s.t);
    ctx.restore();
  }
  ctx.restore();
}

/** The leader's bottle-cap crown. */
export function drawCap(ctx, t) {
  const r = 8;
  ctx.fillStyle = INK;
  ctx.beginPath();
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2;
    const rr = i % 2 ? r + 1.2 : r + 3.2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - 3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFCB2E';
  ctx.beginPath();
  for (let i = 0; i < 21; i++) {
    const a = (i / 21) * Math.PI * 2;
    const rr = i % 2 ? r : r + 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr - 3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#D8413A';
  ctx.beginPath();
  ctx.arc(0, -3, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(-2.5, -6, 2.6, 1.3, -0.5, 0, Math.PI * 2);
  ctx.fill();
  void t;
}
