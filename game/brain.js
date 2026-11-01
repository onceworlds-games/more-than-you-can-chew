// The bot hamsters' brain: they read what a player reads (food they can see, cheeks, shadows, the paw) and play like
// people, on their own clock, with mistakes that shrink with skill. A personality bends each one.

import { FOODS, GOLDEN, BODY_R, CAP, DASH, PORCH_R } from './config.js';
import { reach, topSpeed, lerp, clamp } from './rules.js';
import { waypoint, lit } from './arenas.js';
import { inBand } from './schedule.js';
import { createRng } from './rng.js';

const DIRS = 16;
const DIR_X = [];
const DIR_Y = [];
for (let i = 0; i < DIRS; i++) {
  DIR_X.push(Math.cos((i / DIRS) * Math.PI * 2));
  DIR_Y.push(Math.sin((i / DIRS) * Math.PI * 2));
}

/** Skill (0..1) and personality turned into numbers. */
export function brainParams(skill, kind) {
  const s = clamp(skill, 0, 1);
  const p = {
    plan: lerp(0.62, 0.22, s),
    err: lerp(0.5, 0.05, s),
    homeLo: lerp(72, 58, s),
    homeHi: lerp(104, 80, s),
    avoid: lerp(0.2, 1, s),
    aggro: lerp(0.05, 0.36, s),
    dodge: lerp(0.15, 0.92, s),
    goldenFill: lerp(40, 85, s),
    goldenChance: lerp(0.5, 1, s),
    cluster: s,
    anticipate: s > 0.55,
    topK: Math.max(1, Math.round(1 + (1 - s) * 3)),
    overstuff: lerp(0.35, 0.02, s), // chance to take a bite that overstuffs anyway
    weights: [1, 1, 1, 1, 1, 1, 1],
    dyn: 1,
    golden: 1,
    homeBias: 0,
    noOver: false,
    hunt: false,
  };
  switch (kind) {
    case 'glutton':
      p.homeLo += 18;
      p.homeHi += 22;
      p.avoid *= 0.3;
      p.overstuff = Math.max(p.overstuff, 0.55);
      p.weights[4] = 1.8;
      p.weights[5] = 2;
      break;
    case 'bully':
      p.aggro = Math.min(1, p.aggro + 0.3);
      p.hunt = true;
      break;
    case 'banker':
      p.homeLo = 52;
      p.homeHi = 70;
      p.avoid = 1;
      p.noOver = true;
      p.overstuff = 0;
      break;
    case 'grazer':
      p.homeBias = 1;
      p.weights[0] = 1.3;
      p.weights[1] = 1.3;
      p.weights[2] = 1.2;
      break;
    case 'gambler':
      p.golden = 3;
      p.weights[5] = 1.6;
      p.goldenFill += 15;
      p.overstuff = Math.max(p.overstuff, 0.25);
      break;
    case 'scavenger':
      p.dyn = 2.2;
      break;
    default:
      break;
  }
  return p;
}

export function createBrain(h, world, { skill = h.skill, kind = h.kind, seed = '' } = {}) {
  const p = brainParams(skill, kind);
  const rng = createRng(`brain:${world.seed}:${world.round}:${h.id}:${seed}`);
  let timer = rng.range(0, p.plan);
  let goal = null; // { x, y, kind, food? }
  let mode = 'forage';
  let tripHome = rng.range(p.homeLo, p.homeHi);
  let avoidTrip = rng.chance(p.avoid);
  let greedyTrip = rng.chance(p.overstuff);
  let errAng = 0;
  let dashAim = null;
  let stuckT = 0;
  let wanderUntil = 0;
  const dodged = new Map();
  const considered = new Map();

  function newTrip() {
    tripHome = rng.range(p.homeLo, p.homeHi);
    avoidTrip = rng.chance(p.avoid);
    greedyTrip = rng.chance(p.overstuff);
  }

  function visible(w, x, y) {
    if (!w.arena.dark) return true;
    return lit(w.arena, x, y, w.flies, w.hams);
  }

  function plan(w) {
    errAng = rng.range(-p.err, p.err);
    // The paw's shadow over me: step out of the band (once decided per sweep).
    const sweep = w.sched.sweeps.find((s) => w.t >= s.at && w.t <= s.end);
    if (sweep && inBand(sweep, h.x, h.y, 45)) {
      if (!dodged.has(sweep.n)) dodged.set(sweep.n, rng.chance(p.dodge));
      if (dodged.get(sweep.n)) {
        const rx = h.x - sweep.px;
        const ry = h.y - sweep.py;
        const side = rx * -sweep.dy + ry * sweep.dx >= 0 ? 1 : -1;
        goal = { x: h.x - sweep.dy * side * 220, y: h.y + sweep.dx * side * 220, kind: 'dodge' };
        mode = 'dodge';
        return;
      }
    }
    const b = h.burrow;
    const dHome = Math.hypot(h.x - b.x, h.y - b.y);
    const left = w.duration - w.t;
    const need = dHome / Math.max(60, topSpeed(h.fill)) + 1.2;
    const closeLoad = h.fill >= 55 && dHome < 230;
    if (h.fill > 0 && (h.fill >= tripHome || closeLoad || left < need + 2.5 + (1 - skill) * 2)) {
      if (mode !== 'home') avoidTrip = rng.chance(p.avoid);
      mode = 'home';
      goal = { x: b.x, y: b.y, kind: 'home' };
      return;
    }
    if (mode === 'home' && h.fill === 0) newTrip();
    mode = 'forage';

    // A bump worth making.
    const roundOneGrace = w.round === 1 && w.t < DASH.botGrace;
    if (!roundOneGrace && w.t >= DASH.grace && h.dashCd <= 0 && h.stunT <= 0) {
      let best = null;
      let bestV = 0;
      const range = 70 + 75 * (topSpeed(h.fill) / 220);
      for (const g of w.hams) {
        if (g === h || g.away || g.immuneT > 0 || g.dizzyT > 0) continue;
        if (Math.hypot(g.x - g.burrow.x, g.y - g.burrow.y) <= PORCH_R + 10) continue;
        const d = Math.hypot(g.x - h.x, g.y - h.y);
        if (d > range) continue;
        const value = g.fill > CAP ? 60 + g.fill : g.fill * 0.35;
        if (value < (kind === 'bully' ? 16 : 24)) continue;
        // Each rival is weighed once every few seconds, like a person deciding.
        if ((considered.get(g.id) ?? -9) > w.t - 3) continue;
        considered.set(g.id, w.t);
        if (value > bestV) {
          bestV = value;
          best = g;
        }
      }
      if (best && rng.chance(p.aggro * clamp(bestV / 45, 0.25, 1))) {
        const lead = 0.12;
        dashAim = { x: best.x + (best.vx || 0) * lead, y: best.y + (best.vy || 0) * lead };
        goal = { x: best.x, y: best.y, kind: 'bump' };
        return;
      }
      // A bully hunts a full rival on its way home.
      if (p.hunt && h.fill < 40) {
        let prey = null;
        let pd = Infinity;
        for (const g of w.hams) {
          if (g === h || g.away || g.fill < 55) continue;
          const d = Math.hypot(g.x - h.x, g.y - h.y);
          if (d < 460 && d < pd && Math.hypot(g.x - g.burrow.x, g.y - g.burrow.y) > PORCH_R + 80) {
            prey = g;
            pd = d;
          }
        }
        if (prey) {
          // Cut it off between it and its burrow.
          const t = 0.35;
          goal = { x: prey.x + (prey.burrow.x - prey.x) * t, y: prey.y + (prey.burrow.y - prey.y) * t, kind: 'hunt' };
          return;
        }
      }
    }

    // Food.
    const cands = [];
    for (const f of w.food.values()) {
      const def = FOODS[f.type];
      const golden = f.type === GOLDEN;
      const until = f.land - w.t;
      if (until > (golden && p.anticipate ? 2.2 : 0.7)) continue;
      if (!visible(w, f.x, f.y) && !(golden && until <= 0)) continue;
      const after = h.fill + def.size;
      if (golden) {
        if (h.fill > p.goldenFill) continue;
      } else if (after > CAP) {
        if (p.noOver) continue;
        if (!greedyTrip) continue;
      }
      const via = waypoint(w.arena, h.x, h.y, f.x, f.y);
      const d = Math.hypot(via.x - h.x, via.y - h.y) + Math.hypot(f.x - via.x, f.y - via.y);
      let score = (def.worth * p.weights[f.type] * (golden ? p.golden * 1.4 : 1)) / (d + 80);
      if (f.id >= 10000) score *= p.dyn;
      if (p.cluster > 0.2) {
        let around = 0;
        for (const g of w.food.values()) {
          if (g === f || w.t < g.land - 0.5) continue;
          const dd = (g.x - f.x) ** 2 + (g.y - f.y) ** 2;
          if (dd < 95 * 95) around += FOODS[g.type].worth;
        }
        score += (p.cluster * 0.55 * around) / (d + 80);
      }
      if (p.homeBias) score *= Math.max(0.3, 1 - Math.hypot(f.x - b.x, f.y - b.y) / 900);
      if (skill > 0.5) {
        for (const g of w.hams) {
          if (g === h) continue;
          const gd = Math.hypot(g.x - f.x, g.y - f.y);
          if (gd < d * 0.45 && g.fill < CAP) {
            score *= 0.5;
            break;
          }
        }
      }
      cands.push({ f, score, via });
    }
    if (p.anticipate) {
      for (const tz of w.sched.tosses) {
        if (w.t < tz.at || w.t > tz.land) continue;
        const d = Math.hypot(tz.x - h.x, tz.y - h.y);
        const score = (tz.n * 6 * 0.8) / (d + 80);
        cands.push({ f: null, toss: tz, score, via: waypoint(w.arena, h.x, h.y, tz.x, tz.y) });
      }
    }
    if (cands.length === 0) {
      if (w.t > wanderUntil || !goal || goal.kind !== 'wander') {
        const fl = w.arena.field;
        goal = { x: rng.range(fl.x + 100, fl.x + fl.w - 100), y: rng.range(fl.y + 100, fl.y + fl.h - 100), kind: 'wander' };
        wanderUntil = w.t + 2.5;
      }
      return;
    }
    cands.sort((a, b2) => b2.score - a.score);
    const pick = cands[Math.min(cands.length - 1, rng.int(0, p.topK - 1))];
    goal = pick.f ? { x: pick.f.x, y: pick.f.y, kind: 'food', food: pick.f.id } : { x: pick.toss.x, y: pick.toss.y, kind: 'toss' };
  }

  function steer(w, gx, gy, avoiding, keep) {
    const dx = gx - h.x;
    const dy = gy - h.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) return { mx: 0, my: 0 };
    const ux = dx / dist;
    const uy = dy / dist;
    let best = -Infinity;
    let bx = ux;
    let by = uy;
    const near = [];
    if (avoiding) {
      for (const f of w.food.values()) {
        if (w.t < f.land - 0.2 || f.id === keep) continue;
        if (h.fill + FOODS[f.type].size <= CAP) continue; // harmless: it still fits
        const d2 = (f.x - h.x) ** 2 + (f.y - h.y) ** 2;
        if (d2 < 150 * 150) near.push(f);
      }
    }
    for (let i = 0; i < DIRS; i++) {
      const cx = DIR_X[i];
      const cy = DIR_Y[i];
      let score = cx * ux + cy * uy;
      if (w.blocked(h.x + cx * 26, h.y + cy * 26, BODY_R)) score -= 3;
      else if (w.blocked(h.x + cx * 58, h.y + cy * 58, BODY_R)) score -= 1.2;
      if (near.length) {
        let hits = 0;
        for (const f of near) {
          const fx = f.x - h.x;
          const fy = f.y - h.y;
          const along = fx * cx + fy * cy;
          if (along < -10 || along > 75) continue;
          const perp = Math.abs(fx * cy - fy * cx);
          if (perp < reach(h.fill, FOODS[f.type].r) + 5) hits++;
        }
        score -= Math.min(3, hits) * 1.5;
      }
      if (score > best) {
        best = score;
        bx = cx;
        by = cy;
      }
    }
    // Smooth the choice toward the ideal so it doesn't zig-zag between samples.
    let ax = bx * 0.8 + ux * 0.2;
    let ay = by * 0.8 + uy * 0.2;
    if (w.blocked(h.x + ax * 26, h.y + ay * 26, BODY_R)) {
      ax = bx;
      ay = by;
    }
    const c = Math.cos(errAng);
    const s = Math.sin(errAng);
    const ex = ax * c - ay * s;
    const ey = ax * s + ay * c;
    const l = Math.hypot(ex, ey) || 1;
    const slow = goal && goal.kind === 'toss' && dist < 40 ? 0.2 : 1;
    return { mx: (ex / l) * slow, my: (ey / l) * slow };
  }

  return {
    get mode() {
      return mode;
    },
    get goal() {
      return goal;
    },
    think(w, me, dt) {
      if (me.dizzyT > 0 || me.stunT > 0) return { mx: 0, my: 0, dash: false };
      timer -= dt;
      // A target that's gone (eaten) means a new plan now.
      if (goal && goal.kind === 'food' && !w.food.has(goal.food)) timer = Math.min(timer, rng.range(0.05, p.plan * 0.6));
      if (timer <= 0) {
        timer = p.plan * rng.range(0.8, 1.25);
        plan(w);
      }
      if (dashAim && me.dashCd <= 0) {
        const dx = dashAim.x - me.x;
        const dy = dashAim.y - me.y;
        const l = Math.hypot(dx, dy) || 1;
        dashAim = null;
        return { mx: dx / l, my: dy / l, dash: true };
      }
      dashAim = null;
      if (!goal) return { mx: 0, my: 0, dash: false };
      // Stuck against something: wander a moment.
      if (me.speed < 25 && goal.kind !== 'home') stuckT += dt;
      else stuckT = 0;
      if (stuckT > 1.2) {
        stuckT = 0;
        const a = rng.next() * Math.PI * 2;
        goal = { x: me.x + Math.cos(a) * 160, y: me.y + Math.sin(a) * 160, kind: 'wander' };
        wanderUntil = w.t + 1;
      }
      const via = waypoint(w.arena, me.x, me.y, goal.x, goal.y);
      const avoiding = avoidTrip && !greedyTrip && me.fill > CAP - 32;
      const out = steer(w, via.x, via.y, avoiding, goal.kind === 'food' ? goal.food : -1);
      return { mx: out.mx, my: out.my, dash: false };
    },
  };
}
