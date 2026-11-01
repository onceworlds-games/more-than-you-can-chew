// The rules as small pure functions: cheeks, speed, pops, spills. Everything else builds on these.

import { FOODS, FOOD_TYPES, CAP, MAX, SPEED, TAU, POP, DASH, BODY_R, TIERS } from './config.js';

export const emptyCheeks = () => new Array(FOOD_TYPES).fill(0);

/** How full a set of cheeks is (sum of sizes). */
export function fillOf(cheeks) {
  let f = 0;
  for (let i = 0; i < FOOD_TYPES; i++) f += (cheeks[i] || 0) * FOODS[i].size;
  return f;
}

/** What a set of cheeks is worth banked. */
export function worthOf(cheeks) {
  let w = 0;
  for (let i = 0; i < FOOD_TYPES; i++) w += (cheeks[i] || 0) * FOODS[i].worth;
  return w;
}

export const countOf = (cheeks) => cheeks.reduce((a, b) => a + (b || 0), 0);

/** Top speed at a fill: 220 empty, 90 at full, 65 at 140. */
export function topSpeed(fill) {
  const f = Math.max(0, fill);
  if (f <= CAP) return SPEED.full + (SPEED.empty - SPEED.full) * (1 - Math.pow(f / CAP, SPEED.curve));
  return SPEED.full - (SPEED.full - SPEED.max) * Math.min(1, (f - CAP) / (MAX - CAP));
}

/** How sluggish a hamster turns and speeds up (seconds). */
export const tauOf = (fill) => TAU.base + (TAU.fill * Math.min(MAX, Math.max(0, fill))) / MAX;

/** How far the cheeks bulge past the body (world px). */
export function bulge(fill) {
  const f = Math.max(0, fill);
  return (13 * Math.min(f, CAP)) / CAP + 5 * Math.max(0, Math.min(1, (f - CAP) / (MAX - CAP)));
}

/** Distance at which a hamster eats a piece of food of radius r. */
export const reach = (fill, r) => 16 + bulge(fill) + r;

/**
 * The chance that a bite of `size` leaving the cheeks at `after` pops them: none up to full, then rising with how far past
 * full and how big the bite is (a seed is a nibble, a cookie a gamble); anything past MAX pops for sure.
 */
export function popChance(after, size = POP.sizeRef) {
  if (after <= CAP) return 0;
  if (after > MAX) return 1;
  const base = POP.base + (POP.top - POP.base) * Math.pow((after - CAP) / (MAX - CAP), POP.curve);
  const k = Math.min(1.45, Math.max(0.45, 0.4 + (0.6 * size) / POP.sizeRef));
  return Math.min(0.95, base * k);
}

/** The bank tier a fill reaches: null (plain), or { mult, key, name }. */
export function tierOf(fill) {
  for (const t of TIERS) if (fill > t.at) return t;
  return null;
}

/** What a cheekful banks for: its worth plus the gobble bonus, times the tier's multiplier. */
export function bankValue(cheeks, bonus = 0, fill = fillOf(cheeks)) {
  const t = tierOf(fill);
  return Math.round((worthOf(cheeks) + Math.max(0, bonus)) * (t ? t.mult : 1));
}

export const overstuffed = (fill) => fill > CAP;

/** Dash speed: slower hamsters dash shorter. */
export const dashSpeed = (fill) => DASH.speed * (0.55 + (0.45 * topSpeed(fill)) / SPEED.empty);

/** Knockback distance scaled down for heavier hamsters. */
export const knockScale = (fill) => 1 - (0.35 * Math.min(MAX, Math.max(0, fill))) / MAX;

/**
 * Which pieces spill: in random order until at least `frac` of the fill is out (at least one piece when there is any).
 * `rnd` is a function returning [0, 1). Returns a list of food type indices.
 */
export function spillPick(cheeks, frac, rnd) {
  const pieces = [];
  for (let i = 0; i < FOOD_TYPES; i++) for (let n = 0; n < (cheeks[i] || 0); n++) pieces.push(i);
  if (pieces.length === 0) return [];
  if (frac >= 1) return pieces;
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  const goal = fillOf(cheeks) * frac;
  const out = [];
  let sum = 0;
  for (const p of pieces) {
    if (sum >= goal && out.length > 0) break;
    out.push(p);
    sum += FOODS[p].size;
  }
  return out;
}

export const bodyRadius = (fill) => BODY_R + bulge(fill) * 0.35;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
