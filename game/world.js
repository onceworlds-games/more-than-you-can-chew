// One round's world: hamsters, food, the toss schedule, bumps, pops, the cat. Pure (no page, no network): the title's
// attract mode, solo Picnics and the Daily run it whole; online, the host runs it for the food and the bots while each
// player's body comes from its own page ("remote" hamsters).

import { FOODS, GOLDEN, BODY_R, PORCH_R, POP, DASH, PAW, SCHEDULE, SPILL_LAND, ROUND, botByName } from './config.js';
import { fillOf, worthOf, topSpeed, tauOf, reach, popChance, dashSpeed, knockScale, spillPick, emptyCheeks, clamp } from './rules.js';
import { collide, burrowsFor, inSlip, onDisc, spinPoint, fireflies, blocked } from './arenas.js';
import { makeSchedule, pawHits, inBand } from './schedule.js';
import { createRng, unit } from './rng.js';

export const DYN = 10000; // ids at or above this are spilled or flung pieces; below are the schedule's

const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * @param {object} o
 *   arena, seed, round (1-based), duration (s),
 *   seats: [{ id, name, bot, coat, kind?, skill? }] in burrow order,
 *   brains: optional (seat, world) => brain with think(world, h, dt) -> input, for bots,
 *   authority: false on a page that isn't the host (it predicts: touching food, reaching home and being hit go to `hooks`
 *     { touch(h, f), home(h), hit(h, kind, by, dx, dy) } and the host decides),
 *   practice: true for the lobby's practice blanket (no clock, no cat, food comes back)
 */
export function createWorld(o) {
  const arena = o.arena;
  const practice = !!o.practice;
  const duration = practice ? Infinity : o.duration ?? ROUND.seconds;
  const hooks = o.hooks || {};
  const burrows = burrowsFor(arena, o.seats.length);
  const sched = makeSchedule({ seed: o.seed, arena, burrows, duration: practice ? 24 : duration });
  if (practice) {
    sched.sweeps.length = 0;
    sched.goldens.length = 0;
    sched.items = sched.items.filter((it) => it.src === 'open' || it.src === 'door' || it.src === 'toss');
    sched.items.forEach((it, i) => (it.i = i));
    sched.count = sched.items.length;
  }
  const rng = createRng(`world:${o.seed}:${o.round ?? 1}`);

  const w = {
    arena,
    seed: o.seed,
    round: o.round ?? 1,
    duration,
    practice,
    authority: o.authority !== false, // can change when the host changes
    burrows,
    sched,
    t: 0,
    over: false,
    hams: [],
    byId: new Map(),
    food: new Map(),
    gone: new Uint8Array(sched.count),
    next: 0, // next schedule item to show
    dynId: DYN,
    events: [],
    rng,
    flies: [],
    reserved: new Map(), // food id -> world time it's kept until (a claim in flight, on the host)
    swept: new Set(), // `${sweep}:${id}` already hit
    sweptFood: new Set(),
  };
  // Schedule items in the order they appear (their shadow or beacon first).
  const lead = (it) => (it.src === 'toss' || it.src === 'cake' ? SCHEDULE.tossShadow : it.src === 'golden' ? SCHEDULE.beacon : 0);
  const order = sched.items.map((it) => it.i).sort((a, b) => sched.items[a].land - lead(sched.items[a]) - (sched.items[b].land - lead(sched.items[b])));
  w.order = order;
  w.showAt = (it) => it.land - lead(it);

  o.seats.forEach((s, i) => {
    const b = burrows[i];
    const bot = !!s.bot;
    const def = bot ? botByName(s.name) : null;
    const h = {
      id: s.id,
      seat: i,
      name: s.name,
      bot,
      coat: Number.isInteger(s.coat) ? s.coat : def ? def.coat : 0,
      kind: s.kind ?? (def ? def.kind : 'plain'),
      skill: s.skill ?? 0.5,
      burrow: b,
      x: b.x + b.nx * 40,
      y: b.y + b.ny * 40,
      vx: 0,
      vy: 0,
      a: Math.atan2(b.ny, b.nx),
      speed: 0,
      cheeks: emptyCheeks(),
      fill: 0,
      heap: 0,
      remote: false,
      away: false,
      gone: false,
      input: { mx: 0, my: 0, dash: false },
      lastDash: false,
      dashT: 0,
      dashCd: 0,
      dashDx: 0,
      dashDy: 0,
      dashHit: new Set(),
      stunT: 0,
      dizzyT: 0,
      immuneT: 0,
      kbx: 0,
      kby: 0,
      kbT: 0,
      kbDur: 0.3,
      home: true,
      lastBite: -9,
      trail: [], // recent positions: [t, x, y]
      stats: { trips: 0, pops: 0, golden: 0, bestTrip: 0, bullied: 0, banked: 0, eaten: 0, swatted: 0, maxFill: 0, lastBank: -9 },
      brain: null,
    };
    w.hams.push(h);
    w.byId.set(h.id, h);
  });
  if (o.brains) for (const h of w.hams) if (h.bot) h.brain = o.brains(h, w);

  w.emit = (e) => w.events.push(e);
  w.drain = () => {
    const e = w.events;
    w.events = [];
    return e;
  };

  // ------------------------------------------------------------ food

  w.addFood = (f) => {
    w.food.set(f.id, f);
    return f;
  };
  /** Shows schedule items whose time has come (shadows and beacons a moment early). */
  w.spawnDue = () => {
    while (w.next < order.length) {
      const it = sched.items[order[w.next]];
      if (w.showAt(it) > w.t) break;
      w.next++;
      if (w.gone[it.i]) continue;
      w.addFood({ id: it.i, type: it.type, x: it.x, y: it.y, bx: it.x, by: it.y, tb: Math.max(0, it.land), land: it.land, src: it.src, fx: null, fy: null });
    }
  };
  /** Removes a piece (eaten, or flung into a new one). */
  w.removeFood = (id) => {
    w.food.delete(id);
    if (id < DYN && id >= 0 && id < w.gone.length) w.gone[id] = 1;
  };
  w.landed = (f) => w.t >= f.land;
  w.newPiece = (type, fromX, fromY, toX, toY, delay = 0) => {
    const p = w.findLanding(toX, toY, FOODS[type].r);
    const land = w.t + SPILL_LAND + delay;
    return w.addFood({ id: w.dynId++, type, x: p.x, y: p.y, bx: p.x, by: p.y, tb: land, land, src: 'spill', fx: fromX, fy: fromY, ft: w.t });
  };
  w.findLanding = (x, y, r) => {
    let p = collide(arena, x, y, r + 4);
    // Never inside a porch: the burrow's mouth stays clear.
    for (const b of burrows) {
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const d = Math.hypot(dx, dy);
      const min = PORCH_R + r + 6;
      if (d < min) {
        const nx = d > 0.01 ? dx / d : b.nx;
        const ny = d > 0.01 ? dy / d : b.ny;
        p = collide(arena, b.x + nx * min, b.y + ny * min, r + 4);
      }
    }
    return { x: Math.round(p.x), y: Math.round(p.y) };
  };

  // ------------------------------------------------------------ cheeks (the authority's side)

  w.inPorch = (h, slack = 0) => Math.hypot(h.x - h.burrow.x, h.y - h.burrow.y) <= PORCH_R + slack;

  /** A hamster eats a piece. Returns { pop }. Only the authority (local world or host) calls it. */
  w.eat = (h, f) => {
    const size = FOODS[f.type].size;
    const after = h.fill + size;
    const chance = popChance(after);
    w.removeFood(f.id);
    h.cheeks[f.type]++;
    h.fill = after;
    h.lastBite = w.t;
    h.stats.eaten++;
    h.stats.maxFill = Math.max(h.stats.maxFill, after);
    const pop = chance > 0 && unit(w.seed, w.round, h.id, f.id) < chance;
    w.emit({ k: 'eat', id: h.id, type: f.type, x: f.x, y: f.y, fill: after, food: f.id, chance });
    if (pop) w.pop(h, null);
    return { pop };
  };

  /** Everything in the cheeks sprays out in a ring. */
  w.pop = (h, by) => {
    const pieces = spillPick(h.cheeks, 1, w.rng.next);
    const n = pieces.length;
    const base = w.rng.next() * Math.PI * 2;
    pieces.forEach((type, i) => {
      const a = base + (i / Math.max(1, n)) * Math.PI * 2 + w.rng.range(-0.25, 0.25);
      const d = w.rng.range(POP.ringMin, POP.ringMax);
      w.newPiece(type, h.x, h.y, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, w.rng.range(0, 0.15));
    });
    const lost = worthOf(h.cheeks);
    h.cheeks = emptyCheeks();
    h.fill = 0;
    h.stats.pops++;
    h.dizzyT = POP.dizzy;
    h.dashT = 0;
    if (by) {
      const b = w.byId.get(by);
      if (b) b.stats.bullied++;
    }
    w.emit({ k: 'pop', id: h.id, x: h.x, y: h.y, by, lost, n });
  };

  /** Some of the cheeks fly out in a fan toward (dx, dy). */
  w.spill = (h, frac, dx, dy) => {
    const pieces = spillPick(h.cheeks, frac, w.rng.next);
    if (pieces.length === 0) return 0;
    const base = Math.atan2(dy, dx);
    pieces.forEach((type) => {
      h.cheeks[type]--;
      const a = base + w.rng.range(-1.1, 1.1);
      const d = w.rng.range(40, 125);
      w.newPiece(type, h.x, h.y, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, w.rng.range(0, 0.1));
    });
    h.fill = fillOf(h.cheeks);
    return pieces.length;
  };

  /** Banks the cheeks into the heap. */
  w.bank = (h) => {
    if (h.fill <= 0) return 0;
    const worth = worthOf(h.cheeks);
    const counts = h.cheeks.slice();
    h.heap += worth;
    h.stats.trips++;
    h.stats.banked += worth;
    h.stats.golden += h.cheeks[GOLDEN];
    h.stats.bestTrip = Math.max(h.stats.bestTrip, h.fill);
    h.stats.lastBank = w.t;
    w.emit({ k: 'bank', id: h.id, worth, fill: h.fill, counts, x: h.burrow.x, y: h.burrow.y, t: w.t });
    h.cheeks = emptyCheeks();
    h.fill = 0;
    return worth;
  };

  /**
   * A hit lands on h: a bump from `by` or the paw. The body part (knockback, stun) only for hamsters this world moves;
   * the cheeks part for everyone. Returns true when it took.
   */
  w.hit = (h, kind, by, dx, dy) => {
    if (w.inPorch(h) || h.immuneT > 0 || h.dizzyT > 0 || h.away) return false;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    if (!h.remote) w.knock(h, kind, nx, ny);
    if (!w.authority) {
      // The host decides what spills: tell it, and show the knock now.
      h.immuneT = DASH.immune;
      w.emit({ k: 'hit', id: h.id, by, kind, x: h.x, y: h.y, dx: nx, dy: ny, fill: h.fill, predicted: true });
      if (hooks.hit) hooks.hit(h, kind, by, nx, ny);
      return true;
    }
    h.immuneT = DASH.immune;
    if (kind === 'paw') h.stats.swatted++;
    w.emit({ k: 'hit', id: h.id, by, kind, x: h.x, y: h.y, dx: nx, dy: ny, fill: h.fill });
    if (h.fill > 100) w.pop(h, by);
    else w.spill(h, kind === 'paw' ? PAW.spill : DASH.spill, nx, ny);
    return true;
  };
  /** The body part of a hit: flung along (nx, ny) and stunned. */
  w.knock = (h, kind, nx, ny) => {
    const dist = (kind === 'paw' ? PAW.kb : DASH.kb) * knockScale(h.fill);
    const time = DASH.kbTime * (kind === 'paw' ? 1.3 : 1);
    h.kbx = (nx * dist * 2) / time;
    h.kby = (ny * dist * 2) / time;
    h.kbT = time;
    h.kbDur = time;
    h.stunT = kind === 'paw' ? PAW.stun : DASH.stun;
    h.immuneT = DASH.immune;
    h.dashT = 0;
    h.vx *= 0.2;
    h.vy *= 0.2;
  };

  // ------------------------------------------------------------ remote bodies (online, on the host)

  w.setRemote = (id, p) => {
    const h = w.byId.get(id);
    if (!h) return;
    h.remote = true;
    h.x = p.x;
    h.y = p.y;
    if (Number.isFinite(p.a)) h.a = p.a;
    h.away = !!p.away;
    h.remoteDash = !!p.dash;
    h.remoteDizzy = !!p.dizzy;
    h.trail.push([w.t, p.x, p.y]);
    while (h.trail.length > 0 && w.t - h.trail[0][0] > 0.6) h.trail.shift();
  };

  /** Whether `by`'s body was within `tol` of h's recent positions (a bump seen on another page, checked here). */
  w.nearRecently = (h, x, y, tol) => {
    if (Math.hypot(h.x - x, h.y - y) <= tol) return true;
    for (const [, px, py] of h.trail) if (Math.hypot(px - x, py - y) <= tol) return true;
    return false;
  };

  // ------------------------------------------------------------ the step

  const DT_TRAIL = 0.05;
  let trailT = 0;

  w.step = (dt) => {
    if (w.over) return;
    const t0 = w.t;
    w.t = Math.min(w.duration, w.t + dt);
    w.spawnDue();
    if (arena.dark) w.flies = fireflies(arena, w.t);
    if (arena.disc) {
      for (const f of w.food.values()) {
        if (w.t < f.land || !onDisc(arena, f.bx, f.by)) continue;
        const p = spinPoint(arena, f.bx, f.by, w.t - f.tb);
        f.x = p.x;
        f.y = p.y;
      }
    }
    trailT += dt;
    const keepTrail = trailT >= DT_TRAIL;
    if (keepTrail) trailT = 0;

    // Bots think; everyone this world moves, moves.
    for (const h of w.hams) {
      if (h.remote) {
        // Timers the host keeps for players it doesn't move (it decided their pops and hits).
        h.immuneT = Math.max(0, h.immuneT - dt);
        h.dizzyT = Math.max(0, h.dizzyT - dt);
        continue;
      }
      if (h.brain) h.input = h.brain.think(w, h, dt) || h.input;
      move(h, dt);
      if (keepTrail) {
        h.trail.push([w.t, h.x, h.y]);
        while (h.trail.length > 0 && w.t - h.trail[0][0] > 0.6) h.trail.shift();
      }
    }
    separate();
    for (const h of w.hams) {
      if (h.remote) continue;
      h.home = w.inPorch(h);
      if (h.dizzyT <= 0 && !h.away) eatAround(h);
      if (h.home && h.fill > 0 && h.dizzyT <= 0) {
        if (w.authority) w.bank(h);
        else if (hooks.home) hooks.home(h);
      }
      if (h.dashT > 0) bumps(h);
    }
    paw(t0, w.t);
    if (practice) refill();
    if (w.t >= w.duration) w.finish();
  };

  // The practice blanket: eaten pieces come back a while later, dropping in like a toss.
  let refillT = 0;
  function refill() {
    if (w.t < refillT) return;
    refillT = w.t + 1.5;
    let landed = 0;
    for (const f of w.food.values()) if (f.id < DYN) landed++;
    if (landed >= sched.count * 0.7) return;
    let n = 0;
    for (let k = 0; k < sched.count && n < 6; k++) {
      const it = sched.items[(Math.floor(w.t * 7) + k * 37) % sched.count];
      if (!w.gone[it.i] || w.food.has(it.i)) continue;
      w.gone[it.i] = 0;
      w.addFood({ id: it.i, type: it.type, x: it.x, y: it.y, bx: it.x, by: it.y, tb: w.t + 1, land: w.t + 1, src: 'toss', fx: null, fy: null });
      n++;
    }
  }

  function move(h, dt) {
    h.dashCd = Math.max(0, h.dashCd - dt);
    h.immuneT = Math.max(0, h.immuneT - dt);
    h.stunT = Math.max(0, h.stunT - dt);
    h.dizzyT = Math.max(0, h.dizzyT - dt);
    const inp = h.input || { mx: 0, my: 0, dash: false };
    const pressed = !!inp.dash && !h.lastDash;
    h.lastDash = !!inp.dash;
    let mx = Number.isFinite(inp.mx) ? inp.mx : 0;
    let my = Number.isFinite(inp.my) ? inp.my : 0;
    const mag = Math.min(1, Math.hypot(mx, my));
    if (mag > 0.001) {
      const l = Math.hypot(mx, my);
      mx /= l;
      my /= l;
    }
    const busy = h.stunT > 0 || h.dizzyT > 0;
    if (pressed && !busy && h.dashCd <= 0 && w.t >= DASH.grace) {
      const dx = mag > 0.1 ? mx : Math.cos(h.a);
      const dy = mag > 0.1 ? my : Math.sin(h.a);
      h.dashT = DASH.time;
      h.dashCd = DASH.cooldown;
      h.dashDx = dx;
      h.dashDy = dy;
      h.dashHit.clear();
      h.lastDashT = w.t;
      w.emit({ k: 'dash', id: h.id, x: h.x, y: h.y, dx, dy });
    }
    const slip = inSlip(arena, h.x, h.y);
    if (h.dashT > 0) {
      h.dashT = Math.max(0, h.dashT - dt);
      const s = dashSpeed(h.fill);
      h.vx = h.dashDx * s;
      h.vy = h.dashDy * s;
    } else {
      const top = busy ? 0 : topSpeed(h.fill) * mag * (slip ? 1.1 : 1);
      const tau = tauOf(h.fill) * (slip ? 4 : 1) * (busy ? 0.5 : 1);
      const k = 1 - Math.exp(-dt / tau);
      h.vx += (mx * top - h.vx) * k;
      h.vy += (my * top - h.vy) * k;
    }
    let vx = h.vx;
    let vy = h.vy;
    if (h.kbT > 0) {
      const f = h.kbT / (h.kbDur || DASH.kbTime);
      vx += h.kbx * Math.min(1, f);
      vy += h.kby * Math.min(1, f);
      h.kbT = Math.max(0, h.kbT - dt);
    }
    let x = h.x + vx * dt;
    let y = h.y + vy * dt;
    if (arena.disc && onDisc(arena, x, y)) {
      const p = spinPoint(arena, x, y, dt);
      x = p.x;
      y = p.y;
    }
    const p = collide(arena, x, y, BODY_R);
    h.x = p.x;
    h.y = p.y;
    h.speed = Math.hypot(vx, vy);
    if (h.speed > 15 && h.dizzyT <= 0) {
      const target = Math.atan2(vy, vx);
      h.a += angDiff(h.a, target) * (1 - Math.exp(-dt / 0.07));
    }
  }

  function separate() {
    const hs = w.hams;
    for (let i = 0; i < hs.length; i++) {
      for (let j = i + 1; j < hs.length; j++) {
        const a = hs[i];
        const b = hs[j];
        if (a.away || b.away) continue;
        if (a.remote && b.remote) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = BODY_R * 2 - 4;
        if (d >= min || d < 0.001) continue;
        const push = min - d;
        const nx = dx / d;
        const ny = dy / d;
        const sa = a.remote ? 0 : b.remote ? 1 : 0.5;
        const sb = b.remote ? 0 : a.remote ? 1 : 0.5;
        if (sa) {
          const p = collide(arena, a.x - nx * push * sa, a.y - ny * push * sa, BODY_R);
          a.x = p.x;
          a.y = p.y;
        }
        if (sb) {
          const p = collide(arena, b.x + nx * push * sb, b.y + ny * push * sb, BODY_R);
          b.x = p.x;
          b.y = p.y;
        }
      }
    }
  }

  function eatAround(h) {
    for (const f of w.food.values()) {
      if (w.t < f.land) continue;
      // A player's bite on its way to the host keeps the piece for them.
      if (w.reserved.size && (w.reserved.get(f.id) ?? -1) > w.t) continue;
      const r = reach(h.fill, FOODS[f.type].r);
      const dx = f.x - h.x;
      const dy = f.y - h.y;
      if (dx * dx + dy * dy > r * r) continue;
      if (!w.authority) {
        if (hooks.touch) hooks.touch(h, f);
        continue;
      }
      w.eat(h, f);
      if (h.dizzyT > 0 || h.fill === 0) break; // popped
    }
  }

  function bumps(h) {
    if (w.t < DASH.grace) return;
    for (const g of w.hams) {
      if (g === h || g.away || h.dashHit.has(g.id)) continue;
      const dx = g.x - h.x;
      const dy = g.y - h.y;
      if (dx * dx + dy * dy > DASH.hit * DASH.hit) continue;
      h.dashHit.add(g.id);
      if (w.inPorch(g) || g.immuneT > 0 || g.dizzyT > 0) continue;
      // Recoil, and the dash ends.
      const d = Math.hypot(dx, dy) || 1;
      h.dashT = 0;
      h.kbx = (-dx / d) * ((DASH.recoil * 2) / 0.2);
      h.kby = (-dy / d) * ((DASH.recoil * 2) / 0.2);
      h.kbT = 0.2;
      h.kbDur = 0.2;
      if (g.remote) w.emit({ k: 'bumpOut', id: g.id, by: h.id, dx: dx / d, dy: dy / d, x: h.x, y: h.y });
      else w.hit(g, 'bump', h.id, dx, dy);
      break;
    }
  }

  function paw(t0, t1) {
    for (const s of sched.sweeps) {
      if (t1 < s.swat || t0 > s.end) continue;
      for (const h of w.hams) {
        if (h.remote || h.away || h.gone) continue;
        const key = `${s.n}:${h.id}`;
        if (w.swept.has(key)) continue;
        if (!pawHits(s, h.x, h.y, t0, t1)) continue;
        w.swept.add(key);
        w.lastSweep = s.n;
        if (w.hit(h, 'paw', null, s.dx, s.dy)) w.emit({ k: 'swat', id: h.id, n: s.n });
      }
      // Food in the band is flung along the swat (by whoever decides the food).
      if (!w.authority) continue;
      for (const f of [...w.food.values()]) {
        if (w.t < f.land || w.sweptFood.has(`${s.n}:${f.id}`)) continue;
        if (!pawHits(s, f.x, f.y, t0, t1)) continue;
        w.removeFood(f.id);
        const d = w.rng.range(PAW.flingMin, PAW.flingMax);
        const side = w.rng.range(-50, 50);
        const g = w.newPiece(f.type, f.x, f.y, f.x + s.dx * d - s.dy * side, f.y + s.dy * d + s.dx * side, w.rng.range(0, 0.1));
        w.sweptFood.add(`${s.n}:${g.id}`);
      }
    }
  }

  /** Time's up: what's still in cheeks is lost. */
  w.finish = () => {
    if (w.over) return;
    w.over = true;
    w.t = w.duration;
    for (const h of w.hams) {
      if (h.fill > 0) w.emit({ k: 'lost', id: h.id, worth: worthOf(h.cheeks), x: h.x, y: h.y });
      h.cheeks = emptyCheeks();
      h.fill = 0;
    }
    w.emit({ k: 'end' });
  };

  /** Seats by heap, biggest first (ties share a place). */
  w.standings = () => {
    const list = w.hams.map((h) => ({ id: h.id, name: h.name, heap: h.heap, bot: h.bot }));
    list.sort((a, b) => b.heap - a.heap);
    let place = 0;
    let last = null;
    list.forEach((s, i) => {
      if (s.heap !== last) place = i + 1;
      last = s.heap;
      s.place = place;
    });
    return list;
  };
  w.leader = () => {
    let best = null;
    for (const h of w.hams) if (h.heap > 0 && (!best || h.heap > best.heap)) best = h;
    return best;
  };

  /** The active paw sweep's shadow (warning or swat), or null. */
  w.sweepNow = () => sched.sweeps.find((s) => w.t >= s.at && w.t <= s.end + 0.3) ?? null;
  w.inSweep = (x, y, pad = 30) => {
    const s = sched.sweeps.find((q) => w.t >= q.at - 0.1 && w.t <= q.end);
    return !!s && inBand(s, x, y, pad);
  };

  w.blocked = (x, y, r) => blocked(arena, x, y, r);
  w.clampT = () => clamp(w.t, 0, w.duration);
  w.spawnDue();
  return w;
}
