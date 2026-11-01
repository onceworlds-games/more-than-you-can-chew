// A round's food and cat, decided up front from the seed: every page computes the same schedule, so only what changes
// (what was eaten, what spilled) ever travels between pages.

import { FOODS, GOLDEN, CHILI, GUM, PEPPER, PLAIN_TYPES, SCHEDULE as S, PAW, ROUND } from './config.js';
import { createRng } from './rng.js';
import { foodSpotOk, inField, blocked } from './arenas.js';

export const ALL_SPECIALS = [CHILI, GUM, PEPPER];

function pickType(rng) {
  let r = rng.next();
  for (let i = 0; i < PLAIN_TYPES; i++) {
    r -= FOODS[i].share;
    if (r < 0) return i;
  }
  return 0;
}

function spot(rng, arena, burrows, r, cx, cy, spread, tries = 24) {
  for (let k = 0; k < tries; k++) {
    let x;
    let y;
    if (cx === undefined) {
      const f = arena.field;
      x = rng.range(f.x, f.x + f.w);
      y = rng.range(f.y, f.y + f.h);
    } else {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * spread;
      x = cx + Math.cos(a) * d;
      y = cy + Math.sin(a) * d;
    }
    if (foodSpotOk(arena, x, y, r, burrows)) return { x, y };
  }
  return null;
}

/** A point in the middle of the field (fraction `part` of each side). */
function middle(rng, arena, part) {
  const f = arena.field;
  return { x: f.x + f.w * (0.5 + (rng.next() - 0.5) * part), y: f.y + f.h * (0.5 + (rng.next() - 0.5) * part) };
}

/**
 * The schedule of one round.
 * @param {object} o { seed, arena, burrows (the seats' burrows), duration (s), specials (the special types that may drop) }
 */
export function makeSchedule({ seed, arena, burrows, duration = ROUND.seconds, specials = ALL_SPECIALS }) {
  const rng = createRng(`sched:${seed}:${arena.id}`);
  const seatFactor = Math.max(0.5, Math.min(1, burrows.length / 8));
  const items = [];
  const tosses = [];
  const goldens = [];
  const cakes = [];
  const sweeps = [];
  const drops = [];
  const add = (type, x, y, land, src, g = -1) => {
    const it = { i: items.length, type, x: Math.round(x), y: Math.round(y), land, src, g };
    items.push(it);
    return it;
  };

  // The opening spread: weighted to the middle.
  const opening = Math.round(S.opening * (0.6 + 0.4 * seatFactor));
  for (let n = 0; n < opening; n++) {
    const type = pickType(rng);
    const r = FOODS[type].r;
    const mid = rng.next() < 0.55 ? middle(rng, arena, 0.6) : null;
    const p = mid ? spot(rng, arena, burrows, r, mid.x, mid.y, 90) : spot(rng, arena, burrows, r);
    if (p) add(type, p.x, p.y, 0, 'open');
  }
  // A doorstep in front of every burrow, so the first move succeeds.
  for (const b of burrows) {
    S.doorstep.forEach((key, k) => {
      const type = FOODS.findIndex((f) => f.key === key);
      const along = 92 + k * 22;
      const side = (k % 2 ? 1 : -1) * (12 + k * 6);
      const x = b.x + b.nx * along - b.ny * side;
      const y = b.y + b.ny * along + b.nx * side;
      if (inField(arena, x, y, 4) && !blocked(arena, x, y, FOODS[type].r + 4)) add(type, x, y, 0, 'door');
    });
  }

  // Tosses: a cluster every few seconds, its shadow first.
  let t = S.tossFrom;
  while (t < duration - 2.5) {
    const late = t >= S.lateFrom;
    const count = Math.max(3, Math.round(rng.int(S.tossMin, S.tossMax) * seatFactor * (late ? 0.85 : 1)));
    const c = rng.next() < 0.6 ? middle(rng, arena, 1 / 3) : spot(rng, arena, burrows, 30) ?? middle(rng, arena, 0.5);
    const radius = rng.range(70, 150);
    const toss = { i: tosses.length, at: t, land: t + S.tossShadow, x: Math.round(c.x), y: Math.round(c.y), r: Math.round(radius), n: 0 };
    let big = false;
    for (let n = 0; n < count; n++) {
      let type = pickType(rng);
      if (n === count - 1 && !big) type = 3 + rng.int(0, 2);
      if (FOODS[type].size >= 10) big = true;
      const p = spot(rng, arena, burrows, FOODS[type].r, c.x, c.y, radius, 12);
      if (!p) continue;
      add(type, p.x, p.y, toss.land + rng.range(0, 0.3), 'toss', toss.i);
      toss.n++;
    }
    if (toss.n > 0) tosses.push(toss);
    t += late ? S.lateEvery + rng.range(-S.lateJitter, S.lateJitter) : S.tossEvery + rng.range(-S.tossJitter, S.tossJitter);
  }

  // Golden seeds under a shaft of light.
  for (const at of S.golden) {
    const land = at + rng.range(-S.goldenJitter, S.goldenJitter);
    if (land > duration - 3) continue;
    let p = null;
    for (let k = 0; k < 20 && !p; k++) {
      const m = middle(rng, arena, 0.6);
      if (foodSpotOk(arena, m.x, m.y, 14, burrows)) p = m;
    }
    if (!p) continue;
    const it = add(GOLDEN, p.x, p.y, land, 'golden');
    goldens.push({ at: land - S.beacon, land, x: it.x, y: it.y, i: it.i });
  }

  // Specials, one at a time under a little whirl, taking turns (a separate stream, so the rest of the schedule is the same
  // whichever specials a round allows).
  const srng = createRng(`special:${seed}:${arena.id}`);
  const kinds = specials.filter((k) => k === CHILI || k === GUM || k === PEPPER);
  if (kinds.length) {
    let order = srng.shuffle(kinds);
    let k = 0;
    for (let at = S.specialFrom + srng.range(0, S.specialJitter); at < duration - 8; at += S.specialEvery + srng.range(-S.specialJitter, S.specialJitter)) {
      if (k >= order.length) {
        order = srng.shuffle(kinds);
        k = 0;
      }
      const type = order[k++];
      let p = null;
      for (let n = 0; n < 20 && !p; n++) {
        const m = middle(srng, arena, 0.8);
        if (foodSpotOk(arena, m.x, m.y, FOODS[type].r + 10, burrows)) p = m;
      }
      if (!p) continue;
      const it = add(type, p.x, p.y, at + S.tossShadow, 'special');
      drops.push({ at, land: it.land, x: it.x, y: it.y, i: it.i, type });
    }
  }

  // The Birthday Table's cake showers: big pieces round the cake.
  if (arena.cake) {
    for (let at = S.cakeFrom; at < duration - 4; at += S.cakeEvery) {
      const land = at + 1;
      for (let n = 0; n < S.cakeCount; n++) {
        const type = rng.pick([3, 4, 4, 5]);
        let p = null;
        for (let k = 0; k < 16 && !p; k++) {
          const a = rng.next() * Math.PI * 2;
          const d = arena.cake.r + rng.range(30, 170);
          const x = arena.cake.x + Math.cos(a) * d;
          const y = arena.cake.y + Math.sin(a) * d;
          if (foodSpotOk(arena, x, y, FOODS[type].r, burrows)) p = { x, y };
        }
        if (p) add(type, p.x, p.y, land + n * 0.12, 'cake');
      }
      cakes.push({ at, land });
    }
  }

  // The cat: the last 30 s (and all round at The Cat's Table).
  const sweepTimes = [];
  if (arena.pawAll) for (let at = arena.pawAll.from; at < PAW.from - 6; at += arena.pawAll.every) sweepTimes.push(at + rng.range(-1, 1));
  const lastGap = arena.pawAll ? 5 : PAW.gap;
  const lastCount = arena.pawAll ? 6 : PAW.count;
  for (let n = 0; n < lastCount; n++) {
    const at = PAW.from + n * lastGap + rng.range(-0.8, 0.8);
    if (at + PAW.shadow + PAW.swat < duration - 0.5) sweepTimes.push(at);
  }
  const f = arena.field;
  const half = Math.hypot(f.w, f.h) / 2 + 120;
  for (const at of sweepTimes) {
    const m = middle(rng, arena, 0.6);
    const ang = rng.next() * Math.PI;
    const dir = rng.sign();
    sweeps.push({
      n: sweeps.length,
      at,
      swat: at + PAW.shadow,
      end: at + PAW.shadow + PAW.swat,
      px: Math.round(m.x),
      py: Math.round(m.y),
      dx: Math.cos(ang) * dir,
      dy: Math.sin(ang) * dir,
      from: -half,
      to: half,
    });
  }

  return { items, tosses, goldens, cakes, sweeps, drops, count: items.length };
}

/** Where the paw is along its line at time t (or null outside the swat). */
export function pawAt(sweep, t) {
  if (t < sweep.swat || t > sweep.end) return null;
  const u = (t - sweep.swat) / (sweep.end - sweep.swat);
  const e = u * u * (3 - 2 * u);
  return sweep.from + (sweep.to - sweep.from) * e;
}

/** Whether a point is in a sweep's band. */
export function inBand(sweep, x, y, pad = 0) {
  const rx = x - sweep.px;
  const ry = y - sweep.py;
  const perp = Math.abs(rx * sweep.dy - ry * sweep.dx);
  return perp <= PAW.band / 2 + pad;
}

/** Whether the paw passed over (x, y) between t0 and t1. */
export function pawHits(sweep, x, y, t0, t1) {
  if (t1 < sweep.swat || t0 > sweep.end) return false;
  if (!inBand(sweep, x, y)) return false;
  const along = (x - sweep.px) * sweep.dx + (y - sweep.py) * sweep.dy;
  const a = pawAt(sweep, Math.max(t0, sweep.swat));
  const b = pawAt(sweep, Math.min(t1, sweep.end));
  if (a === null || b === null) return false;
  const lo = Math.min(a, b) - PAW.reach;
  const hi = Math.max(a, b) + PAW.reach;
  return along >= lo && along <= hi;
}
