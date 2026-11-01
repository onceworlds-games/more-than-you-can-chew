// The eight arenas: their size, the field food lands on, burrows, obstacles and their one twist. Pure data and geometry.

import { PORCH_R } from './config.js';

// Burrow mouths for a 1800×1200 arena: three on top, three on the bottom, one each side. `n` points into the field.
const STD_BURROWS = [
  { x: 450, y: 78, nx: 0, ny: 1 },
  { x: 900, y: 78, nx: 0, ny: 1 },
  { x: 1350, y: 78, nx: 0, ny: 1 },
  { x: 450, y: 1122, nx: 0, ny: -1 },
  { x: 900, y: 1122, nx: 0, ny: -1 },
  { x: 1350, y: 1122, nx: 0, ny: -1 },
  { x: 74, y: 600, nx: 1, ny: 0 },
  { x: 1726, y: 600, nx: -1, ny: 0 },
];
const STD_SPREAD = [6, 7, 1, 4, 0, 5, 2, 3];
const STD = { w: 1800, h: 1200, field: { x: 150, y: 150, w: 1500, h: 900 }, burrows: STD_BURROWS, spread: STD_SPREAD };

// The stream at the campsite: across the whole arena, with three gaps (two log bridges and a ford).
const STREAM = { ax: 1300, ay: -40, bx: 500, by: 1240, r: 46, gaps: [0.3, 0.55, 0.8], gapHalf: 60 };
function streamParts() {
  const len = Math.hypot(STREAM.bx - STREAM.ax, STREAM.by - STREAM.ay);
  const g = STREAM.gapHalf / len;
  const cuts = [0];
  for (const s of STREAM.gaps) cuts.push(s - g, s + g);
  cuts.push(1);
  const at = (s) => ({ x: STREAM.ax + (STREAM.bx - STREAM.ax) * s, y: STREAM.ay + (STREAM.by - STREAM.ay) * s });
  const water = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = at(cuts[i]);
    const b = at(cuts[i + 1]);
    water.push({ k: 's', ax: a.x, ay: a.y, bx: b.x, by: b.y, r: STREAM.r, prop: 'water' });
  }
  const crossings = STREAM.gaps.map((s, i) => ({ ...at(s), kind: i === 2 ? 'ford' : 'bridge' }));
  return { water, crossings };
}
const stream = streamParts();

export const ARENAS = [
  {
    id: 0,
    key: 'blanket',
    name: 'Picnic Blanket',
    twist: 'The classic',
    ...STD,
    ground: 'gingham',
    obstacles: [
      { k: 'r', x: 196, y: 214, w: 236, h: 160, prop: 'basket' },
      { k: 'c', x: 1330, y: 820, r: 58, prop: 'glass' },
    ],
    decor: [
      { prop: 'hat', x: 1660, y: 1080, r: 120 },
      { prop: 'napkin', x: 1180, y: 330, r: 70 },
    ],
  },
  {
    id: 1,
    key: 'kitchen',
    name: 'Kitchen Counter',
    twist: 'Slippery sink',
    ...STD,
    ground: 'counter',
    obstacles: [
      { k: 'r', x: 760, y: 400, w: 300, h: 210, prop: 'sink' },
      { k: 'c', x: 330, y: 830, r: 52, prop: 'jar' },
    ],
    slip: [
      { x: 700, y: 680, r: 120 },
      { x: 1130, y: 360, r: 105 },
      { x: 1110, y: 690, r: 92 },
      { x: 680, y: 360, r: 88 },
    ],
    decor: [{ prop: 'board', x: 1360, y: 330, w: 300, h: 170 }],
  },
  {
    id: 2,
    key: 'pantry',
    name: 'Pantry Shelf',
    twist: 'Narrow shelf',
    w: 2400,
    h: 900,
    field: { x: 140, y: 150, w: 2120, h: 600 },
    burrows: [
      { x: 520, y: 78, nx: 0, ny: 1 },
      { x: 1000, y: 78, nx: 0, ny: 1 },
      { x: 1400, y: 78, nx: 0, ny: 1 },
      { x: 1880, y: 78, nx: 0, ny: 1 },
      { x: 520, y: 822, nx: 0, ny: -1 },
      { x: 1000, y: 822, nx: 0, ny: -1 },
      { x: 1400, y: 822, nx: 0, ny: -1 },
      { x: 1880, y: 822, nx: 0, ny: -1 },
    ],
    spread: [0, 7, 3, 4, 1, 6, 2, 5],
    ground: 'shelf',
    obstacles: [190, 310, 430, 680, 800, 920, 1150, 1270, 1500, 1620, 1740, 1970, 2090].map((x, i) => ({ k: 'c', x, y: 450, r: 60, prop: 'jar', v: i % 4 })),
    decor: [],
  },
  {
    id: 3,
    key: 'night',
    name: 'Night Garden',
    twist: 'Lights out',
    ...STD,
    ground: 'lawn',
    dark: { own: 175, lantern: { x: 900, y: 600, r: 270 }, flies: 7, fly: 125 },
    obstacles: [
      { k: 'c', x: 900, y: 600, r: 30, prop: 'lantern' },
      { k: 'c', x: 500, y: 760, r: 70, prop: 'pot' },
      { k: 'c', x: 1330, y: 420, r: 46, prop: 'gnome' },
    ],
    decor: [
      { prop: 'stone', x: 640, y: 360, r: 46 },
      { prop: 'stone', x: 1140, y: 860, r: 52 },
      { prop: 'stone', x: 1500, y: 640, r: 40 },
    ],
  },
  {
    id: 4,
    key: 'party',
    name: 'Birthday Table',
    twist: 'Cake showers',
    ...STD,
    ground: 'party',
    cake: { x: 900, y: 600, r: 150 },
    obstacles: [
      { k: 'c', x: 900, y: 600, r: 150, prop: 'cake' },
      { k: 'r', x: 300, y: 270, w: 124, h: 104, prop: 'present' },
      { k: 'r', x: 1370, y: 800, w: 116, h: 104, prop: 'present', v: 1 },
    ],
    decor: [{ prop: 'popper', x: 1460, y: 300, r: 60 }],
  },
  {
    id: 5,
    key: 'camp',
    name: 'Campsite',
    twist: 'Two bridges',
    ...STD,
    ground: 'camp',
    stream: STREAM,
    crossings: stream.crossings,
    obstacles: [
      ...stream.water,
      { k: 'r', x: 1440, y: 250, w: 190, h: 150, prop: 'tent' },
      { k: 'c', x: 420, y: 820, r: 52, prop: 'fire' },
    ],
    decor: [],
  },
  {
    id: 6,
    key: 'susan',
    name: 'Lazy Susan',
    twist: 'Spinning table',
    ...STD,
    ground: 'dinner',
    disc: { x: 900, y: 600, r: 380, w: 0.25 },
    obstacles: [{ k: 'c', x: 900, y: 600, r: 58, prop: 'teapot' }],
    decor: [],
  },
  {
    id: 7,
    key: 'cat',
    name: "The Cat's Table",
    twist: "The cat's awake",
    ...STD,
    ground: 'farm',
    pawAll: { from: 20, every: 12 },
    obstacles: [
      { k: 'c', x: 620, y: 420, r: 80, prop: 'bowl' },
      { k: 'r', x: 1130, y: 720, w: 170, h: 96, prop: 'butter' },
    ],
    decor: [],
  },
];

export const arenaById = (id) => ARENAS[Math.max(0, Math.min(ARENAS.length - 1, Math.floor(Number(id)) || 0))];

/** The burrows the seats use, in seat order, spread round the arena when fewer than eight play. */
export function burrowsFor(arena, count) {
  const n = Math.max(1, Math.min(8, count));
  return arena.spread.slice(0, n).map((i) => ({ ...arena.burrows[i], index: i }));
}

export function inField(arena, x, y, pad = 0) {
  const f = arena.field;
  return x >= f.x + pad && x <= f.x + f.w - pad && y >= f.y + pad && y <= f.y + f.h - pad;
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

/** Whether a circle at (x, y) of radius r overlaps an obstacle (or leaves the arena). */
export function blocked(arena, x, y, r) {
  if (x < 20 + r || y < 20 + r || x > arena.w - 20 - r || y > arena.h - 20 - r) return true;
  for (const o of arena.obstacles) {
    if (o.k === 'c') {
      const rr = o.r + r;
      if ((x - o.x) ** 2 + (y - o.y) ** 2 < rr * rr) return true;
    } else if (o.k === 'r') {
      const cx = Math.max(o.x, Math.min(x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(y, o.y + o.h));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    } else if (o.k === 's') {
      const rr = o.r + r;
      if (segDist2(x, y, o.ax, o.ay, o.bx, o.by) < rr * rr) return true;
    }
  }
  return false;
}

/** Pushes a circle out of every obstacle and back inside the arena. Returns the corrected position. */
export function collide(arena, x, y, r) {
  for (let pass = 0; pass < 2; pass++) {
    for (const o of arena.obstacles) {
      if (o.k === 'c') {
        const dx = x - o.x;
        const dy = y - o.y;
        const d = Math.hypot(dx, dy);
        const rr = o.r + r;
        if (d < rr) {
          const nx = d > 0.001 ? dx / d : 1;
          const ny = d > 0.001 ? dy / d : 0;
          x = o.x + nx * rr;
          y = o.y + ny * rr;
        }
      } else if (o.k === 'r') {
        const cx = Math.max(o.x, Math.min(x, o.x + o.w));
        const cy = Math.max(o.y, Math.min(y, o.y + o.h));
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d < r) {
          if (d > 0.001) {
            x = cx + (dx / d) * r;
            y = cy + (dy / d) * r;
          } else {
            // Inside the box: out by the nearest side.
            const left = x - o.x;
            const right = o.x + o.w - x;
            const top = y - o.y;
            const bottom = o.y + o.h - y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) x = o.x - r;
            else if (m === right) x = o.x + o.w + r;
            else if (m === top) y = o.y - r;
            else y = o.y + o.h + r;
          }
        }
      } else if (o.k === 's') {
        const dx = o.bx - o.ax;
        const dy = o.by - o.ay;
        const l2 = dx * dx + dy * dy || 1;
        let t = ((x - o.ax) * dx + (y - o.ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = o.ax + dx * t;
        const cy = o.ay + dy * t;
        const ex = x - cx;
        const ey = y - cy;
        const d = Math.hypot(ex, ey);
        const rr = o.r + r;
        if (d < rr) {
          const nx = d > 0.001 ? ex / d : -dy / Math.sqrt(l2);
          const ny = d > 0.001 ? ey / d : dx / Math.sqrt(l2);
          x = cx + nx * rr;
          y = cy + ny * rr;
        }
      }
    }
  }
  x = Math.max(20 + r, Math.min(arena.w - 20 - r, x));
  y = Math.max(20 + r, Math.min(arena.h - 20 - r, y));
  return { x, y };
}

/** Whether the straight path from a to b (for a circle of radius r) is clear of obstacles: sampled. */
export function pathClear(arena, ax, ay, bx, by, r) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 24));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked(arena, ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false;
  }
  return true;
}

/** Whether the line from a to b crosses the campsite's water. */
export function crossesWater(arena, ax, ay, bx, by, r = 18) {
  if (!arena.stream) return false;
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 30));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const o of arena.obstacles) {
      if (o.k !== 's') continue;
      const rr = o.r + r;
      if (segDist2(x, y, o.ax, o.ay, o.bx, o.by) < rr * rr) return true;
    }
  }
  return false;
}

/** Where to go to reach (bx, by) from (ax, ay): the target itself, or the best crossing when the stream is in the way. */
export function waypoint(arena, ax, ay, bx, by) {
  if (!arena.crossings || !crossesWater(arena, ax, ay, bx, by)) return { x: bx, y: by };
  let best = null;
  let bestD = Infinity;
  for (const c of arena.crossings) {
    const d = Math.hypot(c.x - ax, c.y - ay) + Math.hypot(bx - c.x, by - c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  // Already at the crossing: aim past it along the line to the target.
  if (best && Math.hypot(best.x - ax, best.y - ay) < 40) return { x: bx, y: by };
  return best ? { x: best.x, y: best.y } : { x: bx, y: by };
}

/** Where food may land: on the field, clear of obstacles and of every burrow's porch. */
export function foodSpotOk(arena, x, y, r, burrows) {
  if (!inField(arena, x, y, r + 6)) return false;
  if (blocked(arena, x, y, r + 8)) return false;
  for (const b of burrows) if ((x - b.x) ** 2 + (y - b.y) ** 2 < (PORCH_R + 24 + r) ** 2) return false;
  return true;
}

export function inSlip(arena, x, y) {
  if (!arena.slip) return false;
  for (const z of arena.slip) if ((x - z.x) ** 2 + (y - z.y) ** 2 < z.r * z.r) return true;
  return false;
}

export function onDisc(arena, x, y) {
  const d = arena.disc;
  return !!d && (x - d.x) ** 2 + (y - d.y) ** 2 < d.r * d.r;
}

/** Rotates a point on the Lazy Susan's disc by `dt` seconds of its turn. */
export function spinPoint(arena, x, y, dt) {
  const d = arena.disc;
  if (!d || !onDisc(arena, x, y)) return { x, y };
  const a = d.w * dt;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const dx = x - d.x;
  const dy = y - d.y;
  return { x: d.x + dx * c - dy * s, y: d.y + dx * s + dy * c };
}

/** The Night Garden's fireflies at time t (seconds): the same everywhere. */
export function fireflies(arena, t) {
  if (!arena.dark) return [];
  const out = [];
  const f = arena.field;
  for (let i = 0; i < arena.dark.flies; i++) {
    const p = i * 1.7 + 0.3;
    const x = f.x + f.w * (0.5 + 0.42 * Math.sin(t * (0.05 + i * 0.011) + p * 2.1) * Math.cos(t * 0.031 + p));
    const y = f.y + f.h * (0.5 + 0.42 * Math.cos(t * (0.043 + i * 0.009) + p * 1.3));
    out.push({ x, y, r: arena.dark.fly * (0.85 + 0.15 * Math.sin(t * 2.3 + i)) });
  }
  return out;
}

/** Whether a point is lit in the Night Garden: by the lantern, a firefly (`flies`, from fireflies()) or a hamster's glow (`glows`). */
export function lit(arena, x, y, flies, glows) {
  if (!arena.dark) return true;
  const L = arena.dark.lantern;
  if ((x - L.x) ** 2 + (y - L.y) ** 2 < L.r * L.r) return true;
  const own = arena.dark.own * arena.dark.own;
  if (glows) for (const g of glows) if ((x - g.x) ** 2 + (y - g.y) ** 2 < own) return true;
  if (flies) for (const f of flies) if ((x - f.x) ** 2 + (y - f.y) ** 2 < f.r * f.r) return true;
  return false;
}
