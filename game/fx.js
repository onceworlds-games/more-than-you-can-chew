// Juice: crumbs, dust, stars, confetti, floating numbers, camera shake (trauma², smooth noise) and hit-stop.

const MAX_PARTS = 600;

export function createFx() {
  const parts = [];
  const texts = [];
  let trauma = 0;
  let stop = 0;
  let reduced = false;
  let time = 0;

  const add = (p) => {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  };

  const fx = {
    parts,
    texts,
    setReduced(v) {
      reduced = !!v;
    },
    get reduced() {
      return reduced;
    },
    /** Crumbs flying from (x, y). */
    crumbs(x, y, n, colors, speed = 120, up = 1) {
      const k = reduced ? Math.ceil(n / 2) : n;
      for (let i = 0; i < k; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.8);
        add({ k: 'crumb', x, y, z: 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: (60 + Math.random() * 140) * up, life: 0.5 + Math.random() * 0.4, t: 0, r: 1.5 + Math.random() * 2.5, c: colors[i % colors.length], rot: Math.random() * 6 });
      }
    },
    /** A puff of dust. */
    dust(x, y, n = 6, size = 10) {
      const k = reduced ? Math.ceil(n / 2) : n;
      for (let i = 0; i < k; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 30 + Math.random() * 60;
        add({ k: 'dust', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.45 + Math.random() * 0.3, t: 0, r: size * (0.6 + Math.random() * 0.6) });
      }
    },
    /** A ring burst (the POP). */
    ring(x, y, r, color = '#FFFFFF') {
      add({ k: 'ring', x, y, life: 0.35, t: 0, r, c: color });
    },
    /** Dizzy stars circling a hamster for `life` seconds (follows `follow` when given). */
    stars(follow, life) {
      for (let i = 0; i < 3; i++) add({ k: 'star', f: follow, x: follow.x, y: follow.y, life, t: 0, ph: (i / 3) * Math.PI * 2 });
    },
    /** Confetti and sprinkles over a screen-space box (results). */
    confetti(x, y, w, n) {
      const k = reduced ? Math.ceil(n / 3) : n;
      const cols = ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA', '#FFF2D9', '#E3A24F'];
      for (let i = 0; i < k; i++) {
        add({ k: 'conf', screen: true, x: x + Math.random() * w, y: y - Math.random() * 120, vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 160, life: 2.5 + Math.random() * 1.5, t: 0, r: 3 + Math.random() * 4, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
      }
    },
    /** A floating number or word in world space. */
    text(x, y, s, color = '#FFF2D9', size = 26, life = 1.1) {
      if (texts.length > 40) texts.shift();
      texts.push({ x, y, s, c: color, size, life, t: 0 });
    },
    shake(amount) {
      if (reduced) return;
      trauma = Math.min(1, trauma + amount);
    },
    hitStop(sec) {
      if (reduced) return;
      stop = Math.max(stop, sec);
    },
    /** Consumes hit-stop: returns the dt the world should step. */
    gate(dt) {
      if (stop > 0) {
        stop = Math.max(0, stop - dt);
        return 0;
      }
      return dt;
    },
    /** Camera offset (world px) from the current trauma. */
    offset() {
      const s = trauma * trauma;
      if (s <= 0.0001) return { x: 0, y: 0, a: 0 };
      const n = (k) => Math.sin(time * 37 + k) * 0.6 + Math.sin(time * 61 + k * 2.3) * 0.4;
      return { x: n(1) * 22 * s, y: n(5) * 22 * s, a: n(9) * 0.03 * s };
    },
    step(dt) {
      time += dt;
      trauma = Math.max(0, trauma - dt * 1.6);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) {
          parts.splice(i, 1);
          continue;
        }
        if (p.k === 'crumb') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vz -= 520 * dt;
          p.z = Math.max(0, p.z + p.vz * dt);
          if (p.z === 0) {
            p.vx *= 0.8;
            p.vy *= 0.8;
          }
          p.rot += dt * 8;
        } else if (p.k === 'dust') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.9;
          p.vy *= 0.9;
        } else if (p.k === 'conf') {
          p.x += p.vx * dt + Math.sin(p.t * 4 + p.rot) * 30 * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        } else if (p.k === 'star' && p.f) {
          p.x = p.f.x;
          p.y = p.f.y;
        }
      }
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.t += dt;
        if (t.t >= t.life) texts.splice(i, 1);
      }
    },
    clear() {
      parts.length = 0;
      texts.length = 0;
      trauma = 0;
      stop = 0;
    },
  };
  return fx;
}

/** Draws world-space particles (call inside the camera transform). */
export function drawParts(ctx, fx, zoom) {
  for (const p of fx.parts) {
    if (p.screen) continue;
    const u = p.t / p.life;
    switch (p.k) {
      case 'crumb':
        ctx.fillStyle = p.c;
        ctx.save();
        ctx.translate(p.x, p.y - p.z);
        ctx.rotate(p.rot);
        ctx.globalAlpha = u > 0.75 ? (1 - u) * 4 : 1;
        ctx.fillRect(-p.r, -p.r * 0.7, p.r * 2, p.r * 1.4);
        ctx.restore();
        break;
      case 'dust':
        ctx.fillStyle = `rgba(255,248,232,${0.55 * (1 - u)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.6 + u * 0.9), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ring':
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = 1 - u;
        ctx.lineWidth = 6 * (1 - u) + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.3 + u * 0.9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'star': {
        const a = p.t * 7 + p.ph;
        const sx = p.x + Math.cos(a) * 20;
        const sy = p.y - 6 + Math.sin(a) * 8;
        ctx.fillStyle = '#FFCB2E';
        ctx.strokeStyle = '#3B2218';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const b = -Math.PI / 2 + (i * Math.PI) / 5 + p.t * 3;
          const r = i % 2 ? 2.6 : 6;
          ctx.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }
  // Floating numbers: piped (cream with a cocoa outline), rising and fading.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const t of fx.texts) {
    const u = t.t / t.life;
    const rise = 34 * (1 - (1 - u) * (1 - u));
    const pop = u < 0.12 ? 0.6 + (u / 0.12) * 0.55 : u < 0.22 ? 1.15 - ((u - 0.12) / 0.1) * 0.15 : 1;
    const size = (t.size * pop) / Math.max(0.7, zoom);
    ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.font = `${Math.round(size)}px Shrikhand, "Bricolage Grotesque", sans-serif`;
    ctx.lineWidth = size * 0.26;
    ctx.strokeStyle = '#3B2218';
    ctx.strokeText(t.s, t.x, t.y - rise);
    ctx.fillStyle = t.c;
    ctx.fillText(t.s, t.x, t.y - rise);
  }
  ctx.globalAlpha = 1;
}

/** Draws screen-space particles (confetti). */
export function drawScreenParts(ctx, fx) {
  for (const p of fx.parts) {
    if (!p.screen) continue;
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
}
