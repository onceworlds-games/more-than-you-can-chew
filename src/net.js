// Online: the room, the match and who decides what. Each page moves its own hamster (presence, 20 a second) and predicts
// its own bites and banks; the host decides the food, every cheek's contents, pops, heaps and the bots, and writes them to
// `host:world`. Bumps are seen by the dasher's page and checked (with room for lag) by the target's.

import { createWorld, DYN } from './sim/world.js';
import { createBrain } from './sim/brain.js';
import { arenaById, ARENAS } from './sim/arenas.js';
import { FOODS, ROUND, POP, PORCH_R, BOT_NAMES, DIFFICULTY, botByName, COATS, SPILL_LAND, FOOD_TYPES, CHAIN } from './sim/config.js';
import { fillOf, worthOf, reach, emptyCheeks, popChance, bankValue, tierOf } from './sim/rules.js';
import { inBand } from './sim/schedule.js';
import { hash32, unit } from './sim/rng.js';

export const BOT_LEVELS = ['off', 'easy', 'normal', 'hard'];
export const JOIN = {
  maxPlayers: 8,
  minPlayers: 1,
  lobby: 'bar',
  countdown: 0,
  settings: [
    { id: 'arena', label: 'Arena', options: ARENAS.map((a) => ({ value: a.id, label: a.name })), default: 0 },
    { id: 'rounds', label: 'Rounds', options: [1, 3, 5], default: 3 },
    { id: 'bots', label: 'Bots', options: BOT_LEVELS.map((b) => ({ value: b, label: b[0].toUpperCase() + b.slice(1) })), default: 'normal' },
  ],
};

const STEP = 1 / 60;
const EV = { pop: 1, bank: 2, hit: 3, sneeze: 4 };
/** Presence bits: 1 dashing, 2 stunned, 4 dizzy, 8 home, 16 chili, 32 bubble gum, 64 a sneeze coming. */
export const BITS = 127;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Settings as the game uses them, whatever the room holds. */
export function readSettings(s) {
  const arena = clamp(Math.floor(Number(s?.arena)) || 0, 0, ARENAS.length - 1);
  const rounds = [1, 3, 5].includes(Number(s?.rounds)) ? Number(s.rounds) : 3;
  const bots = BOT_LEVELS.includes(s?.bots) ? s.bots : 'normal';
  return { arena, rounds, bots };
}

/** A player's presence, checked: null when it isn't one. */
export function readPresence(p, arena) {
  if (!p || typeof p !== 'object') return null;
  if (!finite(p.x) || !finite(p.y)) return null;
  const W = arena ? arena.w : 2400;
  const H = arena ? arena.h : 1200;
  return {
    k: p.k === 'p' || p.k === 'l' || p.k === 'w' ? p.k : 'l',
    r: Number.isInteger(p.r) ? p.r : -1,
    x: clamp(p.x, 0, W),
    y: clamp(p.y, 0, H),
    a: finite(p.a) ? p.a : 0,
    f: finite(p.f) ? clamp(p.f, 0, 160) : 0,
    c: Number.isInteger(p.c) ? clamp(p.c, 0, COATS.length - 1) : 0,
    s: Number.isInteger(p.s) ? p.s & BITS : 0,
    d: Number.isInteger(p.d) ? p.d : 0,
    h: finite(p.h) ? clamp(Math.floor(p.h), 0, 99999) : 0,
  };
}

/** Bots in the host's presence: [[x, y, fill, bits], ...], checked. */
export function readBots(b, arena) {
  if (!Array.isArray(b) || b.length > 8) return [];
  return b.map((e) => (Array.isArray(e) && finite(e[0]) && finite(e[1]) ? { x: clamp(e[0], 0, arena.w), y: clamp(e[1], 0, arena.h), f: finite(e[2]) ? clamp(e[2], 0, 160) : 0, s: Number.isInteger(e[3]) ? e[3] & BITS : 0 } : null));
}

// The eaten bits of the schedule, as base64.
export function packBits(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8) {
    let v = 0;
    for (let k = 0; k < 8; k++) if (bytes[i + k]) v |= 1 << k;
    s += String.fromCharCode(v);
  }
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
export function unpackBits(text, n) {
  const out = new Uint8Array(n);
  if (typeof text !== 'string' || text.length > 4000) return out;
  let s;
  try {
    s = typeof atob === 'function' ? atob(text) : Buffer.from(text, 'base64').toString('binary');
  } catch {
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

/** The host's world record, checked against itself (another version of the game may have written it). */
export function readSnapshot(v) {
  if (!v || typeof v !== 'object' || typeof v.r !== 'string' || v.r.length > 40) return null;
  const d = Array.isArray(v.d) ? v.d.filter((e) => Array.isArray(e) && Number.isInteger(e[0]) && e[0] >= DYN && Number.isInteger(e[1]) && e[1] >= 0 && e[1] < FOOD_TYPES && finite(e[2]) && finite(e[3]) && finite(e[4])).slice(0, 400) : [];
  const ch = Array.isArray(v.ch) ? v.ch.slice(0, 8).map((c) => (Array.isArray(c) && c.length === FOOD_TYPES ? c.map((n) => (Number.isInteger(n) ? clamp(n, 0, 99) : 0)) : emptyCheeks())) : [];
  const hp = Array.isArray(v.hp) ? v.hp.slice(0, 8).map((n) => (finite(n) ? clamp(Math.floor(n), 0, 99999) : 0)) : [];
  const e = Array.isArray(v.e) ? v.e.slice(0, 8).map((l) => (Array.isArray(l) ? l.filter((n) => Number.isInteger(n)).slice(0, 24) : [])) : [];
  const ev = Array.isArray(v.ev) ? v.ev.filter((x) => Array.isArray(x) && x.length >= 4 && x.every((n) => finite(n))).slice(0, 24) : [];
  const st = Array.isArray(v.st) ? v.st.slice(0, 8).map((x) => (Array.isArray(x) ? x.slice(0, 8).map((n) => (finite(n) ? clamp(Math.floor(n), 0, 99999) : 0)) : [])) : [];
  const bo = Array.isArray(v.bo) ? v.bo.slice(0, 8).map((n) => (finite(n) ? clamp(Math.floor(n), 0, 9999) : 0)) : [];
  return { r: v.r, t: finite(v.t) ? v.t : 0, g: typeof v.g === 'string' ? v.g : '', d, ch, hp, e, ev, st, bo };
}

/**
 * @param room the joined room
 * @param helpers { createMatch, createHost, createBots, t }
 * @param o { coat(): my coat, onEvent(e), now(): ms }
 */
export function createOnline(room, helpers, o = {}) {
  const { createMatch, createHost, createBots, t } = helpers;
  const host = createHost(room);
  const onEvent = o.onEvent || (() => {});
  const nowMs = o.now || (() => Date.now());
  const myId = () => (room.me ? room.me.id : '');

  let world = null;
  let worldKey = '';
  let worldArena = arenaById(0);
  let acc = 0;
  // My predictions.
  const pending = new Map(); // food id -> { type, at, won, c (its gobble chain), popped }
  let hostCheeks = emptyCheeks();
  let hostBonus = 0;
  let bankPend = null; // { at, worth, counts, bonus, seq, base, sent }
  let popPend = null; // { at }: a pop I saw coming (the roll is the host's, made the same way)
  let evSeen = 0;
  let evSeq = 0;
  const evRing = [];
  const eaten = new Map(); // host: seat -> recent food ids
  let lastWrite = 0;
  let dirty = false;
  let snapKey = '';
  const lastBots = new Map(); // bot id -> last position seen (for a new host)
  const dashSeen = new Map(); // player id -> ms their dash bit was last seen
  const stats = { bumpsSent: 0, bumpsTaken: 0, bumpsRefused: 0, claimsLost: 0, claimsRejected: 0, banks: 0 };
  const mine = { pops: 0, popsByBump: 0, golden: 0, bestTrip: 0, lastBank: null, specials: 0, st: [] };
  let wasHost = false;
  let presenceAt = 0;
  let hostHeap = 0;

  const worldState = host.state('world', { schema: t.any(15000), initial: null });

  const settings = () => readSettings(room.settings);

  const match = createMatch(room, {
    rounds: 'rounds',
    roundSeconds: ROUND.seconds,
    introSeconds: ROUND.intro,
    roundEndSeconds: ROUND.end,
    resultsSeconds: ROUND.results,
    admit: 'round',
    startRound: (m) => ({ a: settings().arena, s: hash32(`${m.roundId}:${room.match.seed ?? 0}`) % 1000000000 }),
    score: () => heaps(),
    resume: () => {
      worldKey = '';
    },
  });
  const bots = createBots(match, { host, fill: settings().bots === 'off' ? 0 : 8, names: BOT_NAMES, skill: 0.5, think: () => null });

  // ------------------------------------------------------------------ host calls

  // Each player's bite is its own claim (keyed by piece and player): a bite someone saw happen is theirs. On a tie, or when
  // a bot got there a moment before on the host, the piece was big enough for both: they get one too.
  const eatClaim = host.claim('eat', {
    args: { id: t.int(0, 99999), r: t.int(0, 99), p: t.string(40), c: t.int(0, 999) },
    key: (a) => `${a.id}:${a.p}`,
    window: 60,
    rate: 25,
    validate: (c) => (c.args.p === c.from.id ? validEat(c.from.id, c.args) : 'not yours'),
    apply: (winner) => applyEat(winner.from.id, winner.args),
  });

  const bankCall = host.rpc('bank', {
    args: { r: t.int(0, 99) },
    rate: 4,
    validate: (from, a) => validBank(from.id, a),
    run: (from) => {
      const h = world && world.byId.get(from.id);
      if (h && world.bank(h) > 0) dirty = true;
    },
  });

  const hitCall = host.rpc('hit', {
    args: { by: t.string(40), k: t.int(0, 1), n: t.int(0, 99), r: t.int(0, 99), dx: t.number, dy: t.number },
    rate: 4,
    validate: (from, a) => validHit(from.id, a),
    run: (from, a) => {
      const h = world && world.byId.get(from.id);
      if (!h) return;
      if (world.hit(h, a.k === 1 ? 'paw' : 'bump', a.by || null, a.dx, a.dy)) dirty = true;
    },
  });

  function authWorld() {
    return world && world.authority && match.isHost && match.phase === 'round' && !world.over ? world : null;
  }
  function validEat(pid, a) {
    const w = authWorld();
    if (!w || a.r !== match.round) return 'not now';
    const h = w.byId.get(pid);
    if (!h || h.away || h.gone || h.dizzyT > 0) return 'cannot eat';
    if (eaten.get(h.seat)?.includes(a.id)) return 'eaten';
    const f = w.food.get(a.id) || shared(a.id);
    if (!f || w.t < f.land - 0.15) return 'gone';
    const tol = reach(h.fill, FOODS[f.type].r) + 70;
    const p = latestPresence(pid);
    const near = (p && Math.hypot(p.x - f.x, p.y - f.y) <= tol) || w.nearRecently(h, f.x, f.y, tol);
    if (!near) return 'too far';
    if (w.food.has(a.id)) w.reserved.set(a.id, w.t + 0.35);
    return true;
  }
  /** A piece eaten in the last moment, as one to share. */
  function shared(id) {
    const e = world.eatenAt.get(id);
    return e && world.t - e.t <= 0.7 ? { id, type: e.type, x: e.x, y: e.y, land: -1 } : null;
  }
  function applyEat(pid, a) {
    const w = authWorld();
    if (!w) return;
    const h = w.byId.get(pid);
    const f = w.food.get(a.id) || shared(a.id);
    if (!f || !h || eaten.get(h.seat)?.includes(a.id)) return;
    w.eat(h, f, a.c);
    noteEaten(h.seat, a.id);
    dirty = true;
  }
  function validBank(pid, a) {
    const w = authWorld();
    if (!w || a.r !== match.round) return 'not now';
    const h = w.byId.get(pid);
    if (!h || h.gone || h.fill <= 0) return 'nothing';
    const b = h.burrow;
    const p = latestPresence(pid);
    const ok = (p && Math.hypot(p.x - b.x, p.y - b.y) <= PORCH_R + 60) || w.nearRecently(h, b.x, b.y, PORCH_R + 40);
    return ok || 'not home';
  }
  function validHit(pid, a) {
    const w = authWorld();
    if (!w || a.r !== match.round) return 'not now';
    const h = w.byId.get(pid);
    if (!h || h.gone) return 'no';
    if (!finite(a.dx) || !finite(a.dy)) return 'bad';
    if (a.k === 1) {
      const s = w.sched.sweeps[a.n];
      if (!s || w.t < s.swat - 0.3 || w.t > s.end + 0.8) return 'no paw';
      return inBand(s, h.x, h.y, 80) || 'missed';
    }
    const by = w.byId.get(a.by);
    if (!by || by === h) return 'no one';
    return dashedNear(by, h.x, h.y, 170) || 'too far';
  }

  /** Whether `by` was dashing lately and near (x, y), as this page saw it. */
  function dashedNear(by, x, y, tol) {
    const w = world;
    let dashing;
    if (by.remote && !by.bot) {
      const lp = latestPresence(by.id);
      if (lp && lp.s & 1) dashSeen.set(by.id, nowMs());
      dashing = nowMs() - (dashSeen.get(by.id) ?? -1e9) < 700;
      if (dashing && lp && Math.hypot(lp.x - x, lp.y - y) <= tol) return true;
    }
    else if (by.remote) dashing = !!by.remoteDash || nowMs() - (dashSeen.get(by.id) ?? -1e9) < 700;
    else dashing = by.dashT > 0 || w.t - (by.lastDashT ?? -9) < 0.7;
    if (!dashing) return false;
    return Math.hypot(by.x - x, by.y - y) <= tol || w.nearRecently(by, x, y, tol);
  }

  function latestPresence(pid) {
    const pl = room.players.get(pid);
    return pl ? readPresence(pl.presence, worldArena) : null;
  }

  function noteEaten(seat, id) {
    let l = eaten.get(seat);
    if (!l) eaten.set(seat, (l = []));
    l.push(id);
    if (l.length > 20) l.shift();
  }

  // ------------------------------------------------------------------ bumps, by message

  // A bump can arrive before the dash that made it (presence and messages travel apart): it waits a moment for it.
  const bumpWait = [];
  room.on('message', (data, from) => {
    if (!data || typeof data !== 'object' || data.$ow) return;
    if (data.t !== 'bump' || !world || match.phase !== 'round' || !from) return;
    if (data.r !== match.round || !finite(data.dx) || !finite(data.dy)) return;
    const targetId = typeof data.to === 'string' ? data.to : myId();
    const target = world.byId.get(targetId);
    if (!target || target.remote) return; // only the page that moves a hamster takes its bumps
    const byId = typeof data.by === 'string' ? data.by : from.id;
    const by = world.byId.get(byId);
    // A bot's bump comes from the host; a player's from that player.
    if (!by || (by.bot ? from.id !== room.host : from.id !== by.id)) return;
    const b = { to: target.id, by: by.id, dx: data.dx, dy: data.dy, r: data.r, at: nowMs() };
    if (!takeBump(b) && bumpWait.length < 16) bumpWait.push(b);
  });

  /** True when the bump is done with (taken, or refused); false while it waits for the dash. */
  function takeBump(b) {
    const target = world && world.byId.get(b.to);
    const by = world && world.byId.get(b.by);
    if (!target || !by || target.remote || b.r !== match.round || match.phase !== 'round') return true;
    if (!dashedNear(by, target.x, target.y, 150)) {
      if (nowMs() - b.at < 400) return false;
      stats.bumpsRefused++;
      return true;
    }
    if (world.hit(target, 'bump', by.id, b.dx, b.dy)) {
      stats.bumpsTaken++;
      dirty = true;
    }
    return true;
  }

  // ------------------------------------------------------------------ the round's world

  function seatList() {
    const s = settings();
    const level = DIFFICULTY[s.bots] ?? 0.5;
    return match.seats.map((seat) => {
      const def = seat.bot ? botByName(seat.name) : null;
      const p = seat.bot ? null : latestPresence(seat.id);
      return {
        id: seat.id,
        name: seat.name,
        bot: seat.bot,
        coat: def ? def.coat : p ? p.c : 0,
        kind: def ? def.kind : 'plain',
        skill: clamp(level + (unit(seat.id, room.match.id) - 0.5) * 0.12, 0, 1),
      };
    });
  }

  function hooks() {
    return {
      touch(h, f) {
        if (pending.has(f.id) || h.id !== myId() || popPend) return;
        const c = world.chainAt(h);
        h.chain = c;
        h.lastBite = world.t;
        pending.set(f.id, { type: f.type, at: nowMs(), won: false, c, popped: false });
        world.food.delete(f.id);
        const fill = displayFill();
        const size = FOODS[f.type].size;
        const chance = popChance(fill, size);
        world.emit({ k: 'eat', id: h.id, type: f.type, x: f.x, y: f.y, fill, food: f.id, chance, chain: c, predicted: true });
        if (FOODS[f.type].special) mine.specials++;
        world.effect(h, f.type);
        // The host rolls the pop the same way from the same numbers: see it now, not a round trip later.
        if (chance > 0 && unit(world.seed, world.round, h.id, f.id) < chance) predictPop(h);
        const r = match.round;
        Promise.resolve(eatClaim({ id: f.id, r, p: myId(), c }))
          .then((res) => {
            const p = pending.get(f.id);
            if (!p) return;
            if (res === 'won') p.won = true;
            else {
              if (res === 'lost') stats.claimsLost++;
              else stats.claimsRejected++;
              pending.delete(f.id);
            }
          })
          .catch(() => pending.delete(f.id));
      },
      home(h) {
        if (h.id !== myId() || bankPend || popPend) return;
        const counts = myCheeks();
        const fill = fillOf(counts);
        if (fill <= 0) return;
        const bonus = myBonus();
        const worth = bankValue(counts, bonus, fill);
        const tier = tierOf(fill);
        bankPend = { at: nowMs(), worth, counts, bonus, seq: evSeen, base: h.heap, sent: false, fill };
        world.emit({ k: 'bank', id: h.id, worth, base: worthOf(counts), bonus, tier: tier ? tier.key : null, mult: tier ? tier.mult : 1, fill, counts, x: h.burrow.x, y: h.burrow.y, t: world.t, predicted: true });
      },
      hit(h, kind, by, dx, dy) {
        if (h.id !== myId()) return;
        Promise.resolve(hitCall({ by: by || '', k: kind === 'paw' ? 1 : 0, n: kind === 'paw' ? world.lastSweep ?? 0 : 0, r: match.round, dx, dy })).catch(() => {});
      },
    };
  }

  function ensureWorld() {
    const ph = match.phase;
    if (ph !== 'intro' && ph !== 'round' && ph !== 'roundEnd') return;
    const data = match.data;
    if (!data || !Number.isInteger(data.a) || !finite(data.s)) return;
    if (worldKey === match.roundId && world) return;
    const isHost = match.isHost;
    worldArena = arenaById(data.a);
    world = createWorld({
      arena: worldArena,
      seed: data.s,
      round: match.round,
      duration: ROUND.seconds,
      seats: seatList(),
      authority: isHost,
      hooks: hooks(),
      brains: (h, w) => (h.bot ? createBrain(h, w, { skill: h.skill, kind: h.kind, seed: `${data.s}:${h.id}` }) : null),
    });
    worldKey = match.roundId;
    bumpWait.length = 0;
    wasHost = isHost;
    pending.clear();
    hostCheeks = emptyCheeks();
    hostBonus = 0;
    bankPend = null;
    popPend = null;
    evSeen = 0;
    snapKey = '';
    eaten.clear();
    evRing.length = 0;
    evSeq = 0;
    mine.pops = 0;
    mine.popsByBump = 0;
    mine.golden = 0;
    mine.bestTrip = 0;
    mine.lastBank = null;
    mine.specials = 0;
    mine.st = [];
    acc = 0;
    setRoles(isHost);
    // A reload (or a new host) carries on from the record and from where hamsters were.
    const snap = readSnapshot(worldState.get());
    if (snap && snap.r === worldKey) {
      applySnapshot(snap, true);
      if (isHost) {
        evSeq = snap.ev.reduce((m, e) => Math.max(m, e[0]), 0);
        for (const e of snap.ev) evRing.push(e);
      }
    }
    const me = world.byId.get(myId());
    const p = latestPresence(myId());
    if (me && p && p.k === 'p' && p.r === match.round && match.phase === 'round') {
      me.x = p.x;
      me.y = p.y;
      me.a = p.a;
    }
    for (const h of world.hams) {
      const b = lastBots.get(h.id);
      if (h.bot && b && match.phase === 'round') {
        h.x = b.x;
        h.y = b.y;
      }
    }
  }

  /** Who this page moves: on the host, itself and the bots; elsewhere, only itself. */
  function setRoles(isHost) {
    if (!world) return;
    world.authority = isHost;
    for (const h of world.hams) {
      const self = h.id === myId() && !room.spectating;
      h.remote = !(self || (isHost && h.bot));
      if (isHost && h.bot && !h.brain) h.brain = createBrain(h, world, { skill: h.skill, kind: h.kind, seed: `${world.seed}:${h.id}` });
    }
    if (isHost) {
      // Cheeks come from the record: the new host takes them as they were.
      const snap = readSnapshot(worldState.get());
      if (snap && snap.r === worldKey) {
        world.hams.forEach((h, i) => {
          if (snap.ch[i]) {
            h.cheeks = snap.ch[i].slice();
            h.fill = fillOf(h.cheeks);
          }
          if (snap.hp[i] !== undefined) h.heap = snap.hp[i];
          if (snap.bo[i] !== undefined) h.bonus = snap.bo[i];
        });
      }
      pending.clear();
      bankPend = null;
      popPend = null;
    }
  }

  // ------------------------------------------------------------------ my cheeks as I see them

  function myCheeks() {
    if (popPend) return emptyCheeks();
    const c = hostCheeks.slice();
    for (const p of pending.values()) if (!p.popped) c[p.type]++;
    if (bankPend) for (let i = 0; i < c.length; i++) c[i] = Math.max(0, c[i] - bankPend.counts[i]);
    return c;
  }
  /** My gobble-chain bonus as I see it. */
  function myBonus() {
    if (popPend) return 0;
    let b = hostBonus;
    for (const p of pending.values()) if (!p.popped && p.c >= 2) b += CHAIN.bonus;
    if (bankPend) b -= bankPend.bonus;
    return Math.max(0, b);
  }
  /** My pop, seen on my page the moment I bite (the host's record follows with the spill). */
  function predictPop(h) {
    popPend = { at: nowMs() };
    const lost = worthOf(myCheeksRaw()) + myBonusRaw();
    for (const p of pending.values()) p.popped = true;
    h.dizzyT = POP.dizzy;
    h.dashT = 0;
    h.chain = 0;
    h.sneezeT = 0;
    mine.pops++;
    world.emit({ k: 'pop', id: h.id, x: h.x, y: h.y, by: null, lost, n: 0, predicted: true });
  }
  function myCheeksRaw() {
    const c = hostCheeks.slice();
    for (const p of pending.values()) if (!p.popped) c[p.type]++;
    return c;
  }
  function myBonusRaw() {
    let b = hostBonus;
    for (const p of pending.values()) if (!p.popped && p.c >= 2) b += CHAIN.bonus;
    return b;
  }
  function displayFill() {
    return fillOf(myCheeks());
  }

  // ------------------------------------------------------------------ the record (host writes, everyone reads)

  function snapshot() {
    const w = world;
    const d = [];
    for (const f of w.food.values()) {
      if (f.id < DYN) continue;
      d.push([f.id, f.type, Math.round(f.bx), Math.round(f.by), Math.round(f.land * 100), Math.round(f.fx ?? f.bx), Math.round(f.fy ?? f.by)]);
      if (d.length >= 380) break;
    }
    return {
      r: worldKey,
      t: Math.round(w.t * 10) / 10,
      g: packBits(w.gone),
      d,
      ch: w.hams.map((h) => h.cheeks.slice()),
      hp: w.hams.map((h) => h.heap),
      bo: w.hams.map((h) => h.bonus),
      e: w.hams.map((h) => (eaten.get(h.seat) || []).slice(-16)),
      ev: evRing.slice(-16),
      st: w.hams.map((h) => [h.stats.trips, h.stats.pops, h.stats.golden, h.stats.bestTrip, h.stats.stuffed, h.stats.bursting, h.stats.bestChain, h.stats.bestBank]),
    };
  }

  function record(e) {
    // Host: the events everyone's page shows from the record.
    const w = world;
    const seat = (id) => (w.byId.get(id) ? w.byId.get(id).seat : -1);
    if (e.k === 'pop') evRing.push([++evSeq, EV.pop, seat(e.id), Math.round(e.x), Math.round(e.y), seat(e.by), e.lost | 0]);
    else if (e.k === 'bank') evRing.push([++evSeq, EV.bank, seat(e.id), e.worth | 0, e.fill | 0, (e.counts && e.counts[6]) | 0, Math.round(e.t * 10)]);
    else if (e.k === 'hit' && !e.predicted) evRing.push([++evSeq, EV.hit, seat(e.id), Math.round(e.x), Math.round(e.y), seat(e.by), e.kind === 'paw' ? 1 : 0]);
    else if (e.k === 'sneezeSpill') evRing.push([++evSeq, EV.sneeze, seat(e.id), Math.round(e.x), Math.round(e.y)]);
    else return;
    while (evRing.length > 24) evRing.shift();
    dirty = true;
  }

  function writeRecord(force) {
    const now = nowMs();
    if (!force && (now - lastWrite < 120 || (!dirty && now - lastWrite < 1000))) return;
    lastWrite = now;
    dirty = false;
    worldState.set(snapshot());
  }

  /** A page that isn't the host takes the record in: eaten food, spills, cheeks, heaps, what happened. */
  function applySnapshot(s, first) {
    const w = world;
    if (!w || s.r !== worldKey) return;
    const gone = unpackBits(s.g, w.gone.length);
    const t = w.t;
    for (let i = 0; i < gone.length; i++) {
      if (gone[i] && !w.gone[i]) {
        w.gone[i] = 1;
        const f = w.food.get(i);
        if (f) {
          w.food.delete(i);
          if (!first) vanish(f);
        }
      }
    }
    // Pieces I hid for a bite the host didn't give me come back.
    for (let k = 0; k < w.next; k++) {
      const it = w.sched.items[w.order[k]];
      if (!it || w.gone[it.i] || w.food.has(it.i) || pending.has(it.i)) continue;
      if (w.showAt(it) > t) continue;
      w.addFood({ id: it.i, type: it.type, x: it.x, y: it.y, bx: it.x, by: it.y, tb: Math.max(0, it.land), land: it.land, src: it.src, fx: null, fy: null });
    }
    // Spills and flung pieces.
    const keep = new Set();
    for (const e of s.d) {
      keep.add(e[0]);
      if (pending.has(e[0])) continue;
      if (!w.food.has(e[0])) {
        const land = e[4] / 100;
        const p = { id: e[0], type: e[1], x: e[2], y: e[3], bx: e[2], by: e[3], tb: land, land, src: 'spill', fx: e[5] ?? e[2], fy: e[6] ?? e[3], ft: land - SPILL_LAND };
        if (w.arena.disc && t > land) {
          // On the turning table it has moved on since it landed.
          const dd = w.arena.disc;
          if ((p.bx - dd.x) ** 2 + (p.by - dd.y) ** 2 < dd.r * dd.r) {
            const a = dd.w * (t - land);
            const dx = p.bx - dd.x;
            const dy = p.by - dd.y;
            p.x = dd.x + dx * Math.cos(a) - dy * Math.sin(a);
            p.y = dd.y + dx * Math.sin(a) + dy * Math.cos(a);
          }
        }
        w.addFood(p);
      }
    }
    for (const f of [...w.food.values()]) {
      if (f.id >= DYN && !keep.has(f.id)) {
        w.food.delete(f.id);
        if (!first) vanish(f);
      }
    }
    // Cheeks and heaps.
    const meH = w.byId.get(myId());
    w.hams.forEach((h, i) => {
      if (s.hp[i] !== undefined) h.heap = s.hp[i];
      if (h === meH && s.hp[i] !== undefined) hostHeap = s.hp[i];
      if (h === meH && s.ch[i]) hostCheeks = s.ch[i].slice();
      else if (h.remote && s.ch[i]) h.hostFill = fillOf(s.ch[i]);
      if (h === meH && s.bo[i] !== undefined) hostBonus = s.bo[i];
      else if (s.bo[i] !== undefined) h.bonus = s.bo[i];
      if (s.st[i] && s.st[i].length >= 4) {
        h.stats.trips = s.st[i][0];
        h.stats.pops = s.st[i][1];
        h.stats.golden = s.st[i][2];
      }
    });
    if (meH && s.e[meH.seat]) for (const id of s.e[meH.seat]) pending.delete(id);
    // Events.
    for (const e of s.ev) {
      if (e[0] <= evSeen) continue;
      evSeen = e[0];
      if (!first) showEvent(e);
    }
    if (meH && s.st[meH.seat] && s.st[meH.seat].length >= 4) {
      mine.bestTrip = Math.max(mine.bestTrip, s.st[meH.seat][3]);
      mine.golden = s.st[meH.seat][2];
      mine.st = s.st[meH.seat];
    }
  }

  /** A piece gone from my screen: if a hamster was at it, they ate it (crumbs, a gulp). */
  function vanish(f) {
    const w = world;
    let best = null;
    let bd = 1e9;
    for (const h of w.hams) {
      const d = Math.hypot(h.x - f.x, h.y - f.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    if (best && bd < 70 && best.id !== myId()) onEvent({ k: 'eat', id: best.id, type: f.type, x: f.x, y: f.y, fill: best.fill, remote: true });
  }

  function showEvent(e) {
    const w = world;
    const h = w.hams[e[2]];
    if (!h) return;
    const me = h.id === myId();
    if (e[1] === EV.pop) {
      const by = w.hams[e[5]];
      if (by && by.id === myId()) mine.popsByBump++;
      if (me && popPend && !by) {
        // The pop I saw coming.
        popPend = null;
        for (const [id, p] of pending) if (p.popped) pending.delete(id);
        return;
      }
      if (me) {
        h.dizzyT = POP.dizzy;
        h.dashT = 0;
        h.chain = 0;
        h.sneezeT = 0;
        mine.pops++;
        for (const p of pending.values()) p.popped = true;
      }
      onEvent({ k: 'pop', id: h.id, x: me ? h.x : e[3], y: me ? h.y : e[4], by: by ? by.id : null, lost: e[6], n: 0, fromRecord: true });
    } else if (e[1] === EV.sneeze) {
      if (!me) onEvent({ k: 'sneeze', id: h.id, x: e[3], y: e[4], dx: Math.cos(h.a), dy: Math.sin(h.a), fromRecord: true });
    } else if (e[1] === EV.bank) {
      if (me) {
        stats.banks++;
        mine.lastBank = ROUND.seconds - e[6] / 10;
        if (bankPend) {
          bankPend = null;
          return;
        }
      }
      const tier = tierOf(e[4]);
      onEvent({ k: 'bank', id: h.id, worth: e[3], fill: e[4], tier: tier ? tier.key : null, mult: tier ? tier.mult : 1, x: h.burrow.x, y: h.burrow.y, fromRecord: true });
    } else if (e[1] === EV.hit && !me) {
      const by = w.hams[e[5]];
      onEvent({ k: 'hit', id: h.id, by: by ? by.id : null, kind: e[6] ? 'paw' : 'bump', x: e[3], y: e[4], dx: 0, dy: 0, fromRecord: true });
    }
  }

  function heaps() {
    const out = {};
    if (world && worldKey === match.roundId) for (const h of world.hams) out[h.id] = h.heap;
    else {
      const s = readSnapshot(worldState.get());
      if (s && s.r === match.roundId) match.seats.forEach((seat, i) => (out[seat.id] = s.hp[i] ?? 0));
    }
    return out;
  }

  // ------------------------------------------------------------------ each frame

  function applyRemotes() {
    const w = world;
    const hostP = room.players.get(room.host);
    const hp = hostP ? hostP.presence : null;
    const botPos = hp && Array.isArray(hp.b) ? readBots(room.presenceAt ? (room.presenceAt(room.host) || hp).b : hp.b, w.arena) : [];
    const botLatest = hp && Array.isArray(hp.b) ? readBots(hp.b, w.arena) : [];
    let bi = 0;
    for (const seat of match.seats) {
      const h = w.byId.get(seat.id);
      if (!h) continue;
      if (seat.left && !h.gone) leave(h);
      if (seat.bot) {
        const idx = bi++;
        if (!h.remote) {
          lastBots.set(h.id, { x: h.x, y: h.y });
          continue;
        }
        const b = botPos[idx];
        const latest = botLatest[idx];
        if (!b) continue;
        const ox = h.x;
        const oy = h.y;
        w.setRemote(h.id, { x: b.x, y: b.y, a: h.a, away: false, dash: !!(b.s & 1), dizzy: !!(b.s & 4), hot: !!(b.s & 16), gum: !!(b.s & 32), tickle: !!(b.s & 64) });
        const mv = Math.hypot(b.x - ox, b.y - oy);
        if (mv > 0.5) h.a = turn(h.a, Math.atan2(b.y - oy, b.x - ox), 0.35);
        h.speed = mv * 60;
        h.fill = b.f;
        if (latest && latest.s & 1) dashSeen.set(h.id, nowMs());
        lastBots.set(h.id, { x: b.x, y: b.y });
        continue;
      }
      if (!h.remote) continue;
      const pl = room.players.get(seat.id);
      const raw = pl ? (room.presenceAt ? room.presenceAt(seat.id, { angles: ['a'], snap: 160 }) : pl.presence) : null;
      const p = readPresence(raw, w.arena);
      const latest = pl ? readPresence(pl.presence, w.arena) : null;
      const away = !!seat.away || !pl || pl.connected === false;
      if (!p || p.k !== 'p') {
        h.away = away || !p;
        continue;
      }
      const ox = h.x;
      const oy = h.y;
      w.setRemote(h.id, { x: p.x, y: p.y, a: p.a, away, dash: !!(p.s & 1), dizzy: !!(p.s & 4), hot: !!(p.s & 16), gum: !!(p.s & 32), tickle: !!(p.s & 64) });
      h.speed = Math.hypot(p.x - ox, p.y - oy) * 60;
      h.coat = p.c;
      // Their own page's fill draws their cheeks (it includes their bites in flight); the host's numbers decide.
      if (!w.authority) h.fill = p.f;
      if (latest && latest.s & 1) dashSeen.set(h.id, nowMs());
    }
  }

  const turn = (a, b, k) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * k;
  };

  function leave(h) {
    // Gone for good: the cheeks spill where it stood, the burrow closes; the heap still counts.
    if (world.authority && h.fill > 0) {
      world.spill(h, 1, 0, 1);
      dirty = true;
    }
    h.gone = true;
    h.away = true;
  }

  function publish() {
    const now = nowMs();
    if (now - presenceAt < 45) return;
    presenceAt = now;
    const w = world;
    const me = w ? w.byId.get(myId()) : null;
    if (!me || room.spectating) {
      room.setPresence({ k: 'w', x: 0, y: 0, c: o.coat ? o.coat() : 0 });
      return;
    }
    // The dash bit stays up a moment after the dash: a dash that ends in a bump within a frame still goes out.
    const dashed = me.dashT > 0 || w.t - (me.lastDashT ?? -9) < 0.35;
    const bits = (dashed ? 1 : 0) | (me.stunT > 0 ? 2 : 0) | (me.dizzyT > 0 ? 4 : 0) | (me.home ? 8 : 0) | specialBits(me);
    const pres = { k: 'p', r: match.round, x: Math.round(me.x), y: Math.round(me.y), a: Math.round(me.a * 100) / 100, f: Math.round(me.fill), c: o.coat ? o.coat() : 0, s: bits };
    if (w.authority) pres.b = w.hams.filter((h) => h.bot).map((h) => [Math.round(h.x), Math.round(h.y), Math.round(h.fill), (h.dashT > 0 || w.t - (h.lastDashT ?? -9) < 0.35 ? 1 : 0) | (h.dizzyT > 0 ? 4 : 0) | specialBits(h)]);
    room.setPresence(pres);
  }

  const specialBits = (h) => (h.hotT > 0 ? 16 : 0) | (h.gumT > 0 ? 32 : 0) | (h.sneezeT > 0 || h.sneezeAt > 0 ? 64 : 0);

  const api = {
    match,
    room,
    stats,
    mine,
    get world() {
      return world;
    },
    get roundKey() {
      return worldKey;
    },
    /** How my round went, for bests and badges. */
    roundStats() {
      const h = world && world.byId.get(myId());
      if (!h) return null;
      if (world.authority) {
        const s = h.stats;
        return { heap: h.heap, pops: s.pops, golden: s.golden, bestTrip: s.bestTrip, popsByBump: mine.popsByBump, lastBankLeft: s.lastBank > 0 ? world.duration - s.lastBank : null, trips: s.trips, stuffed: s.stuffed, bursting: s.bursting, bestChain: s.bestChain, bestBank: s.bestBank, specials: s.specials };
      }
      const st = mine.st;
      return { heap: hostHeap, pops: mine.pops, golden: mine.golden, bestTrip: mine.bestTrip, popsByBump: mine.popsByBump, lastBankLeft: mine.lastBank, trips: st[0] | 0, stuffed: st[4] | 0, bursting: st[5] | 0, bestChain: st[6] | 0, bestBank: st[7] | 0, specials: mine.specials };
    },
    /** The record's per-seat numbers (trips, pops, golden, best trip), for the round's reason line. */
    seatStats() {
      if (!world) return [];
      return world.hams.map((h) => ({ id: h.id, name: h.name, trips: h.stats.trips, pops: h.stats.pops, golden: h.stats.golden }));
    },
    get me() {
      return room.spectating || !room.me ? null : room.me.id;
    },
    get isHost() {
      return match.isHost;
    },
    settings,
    /** The page's frame: step the round's world to the match clock. `input()` gives my hamster's movement. */
    frame(dt, input) {
      const out = [];
      ensureWorld();
      if (!world || worldKey !== match.roundId) return out;
      const isHost = match.isHost;
      if (isHost !== wasHost) {
        wasHost = isHost;
        setRoles(isHost);
      }
      // Clients: take in the host's record when it changes.
      if (!isHost) {
        const raw = worldState.get();
        const key = raw && raw.r === worldKey ? `${raw.t}|${raw.ev && raw.ev.length ? raw.ev[raw.ev.length - 1][0] : 0}|${raw.g ? raw.g.length : 0}|${raw.d ? raw.d.length : 0}|${JSON.stringify(raw.ch)}|${JSON.stringify(raw.hp)}` : '';
        if (key && key !== snapKey) {
          snapKey = key;
          const s = readSnapshot(raw);
          if (s) applySnapshot(s, false);
        }
      }
      const me = world.byId.get(myId());
      if (me && !world.authority) {
        // My cheeks: the host's, plus my bites on their way, minus a bank on its way.
        for (const [id, p] of pending) if (nowMs() - p.at > 3000) pending.delete(id);
        if (bankPend && nowMs() - bankPend.at > 2500) bankPend = null;
        if (popPend && nowMs() - popPend.at > 2500) {
          // The host didn't pop me after all: the record's cheeks stand.
          popPend = null;
          for (const [id, p] of pending) if (p.popped) pending.delete(id);
        }
        me.cheeks = myCheeks();
        me.fill = fillOf(me.cheeks);
        me.bonus = myBonus();
        me.heap = hostHeap + (bankPend ? bankPend.worth : 0);
        if (bankPend && !bankPend.sent) {
          const waiting = [...pending.values()].some((p) => !p.won);
          if (!waiting || nowMs() - bankPend.at > 450) {
            bankPend.sent = true;
            Promise.resolve(bankCall({ r: match.round })).catch(() => {});
          }
        }
      }
      if (match.phase === 'round' && !world.over) {
        applyRemotes();
        if (bumpWait.length) {
          const keep = bumpWait.filter((b) => !takeBump(b));
          bumpWait.length = 0;
          bumpWait.push(...keep);
        }
        const target = Math.min(world.duration, match.elapsed / 1000);
        if (target - world.t > 3) {
          // Far behind (a hidden tab): jump, the schedule catches up on its own.
          world.t = target - 0.05;
        }
        let guard = 0;
        while (world.t < target - 1e-6 && guard++ < 240) {
          const step = Math.min(STEP, target - world.t);
          if (me && !room.spectating) me.input = input ? input() : me.input;
          world.step(step);
          if (me && !world.authority) {
            me.cheeks = myCheeks();
            me.fill = fillOf(me.cheeks);
            me.bonus = myBonus();
          }
          for (const e of world.drain()) {
            if (e.k === 'bumpOut') {
              sendBump(e);
              continue;
            }
            if (world.authority) {
              if (e.k === 'eat') dirty = true; // pieces gone: others must see it soon, or they bite it too
              record(e);
              if (e.k === 'pop' && e.by && e.by === myId()) mine.popsByBump++;
              if (e.k === 'eat' && e.id === myId() && FOODS[e.type].special) mine.specials++;
              // Someone else's page shows their own sneeze; the host shows it here as it spills them.
              const sh = e.k === 'sneezeSpill' ? world.byId.get(e.id) : null;
              if (sh && sh.remote) out.push({ k: 'sneeze', id: sh.id, x: e.x, y: e.y, dx: Math.cos(sh.a), dy: Math.sin(sh.a), fromRecord: true });
            }
            out.push(e);
          }
        }
      } else if (match.phase === 'roundEnd' && !world.over) {
        world.finish();
        for (const e of world.drain()) if (e.k !== 'bumpOut') out.push(e);
        if (world.authority) writeRecord(true);
      } else {
        for (const e of world.drain()) if (e.k !== 'bumpOut') out.push(e);
      }
      if (world.authority && match.phase === 'round') writeRecord(false);
      if (match.phase === 'intro' || match.phase === 'round') publish();
      return out;
    },
    /** In the lobby: my practice hamster in presence, so others see me run about. */
    lobbyPresence(h, heap) {
      const now = nowMs();
      if (now - presenceAt < 45) return;
      presenceAt = now;
      if (!h) return;
      room.setPresence({ k: 'l', x: Math.round(h.x), y: Math.round(h.y), a: Math.round(h.a * 100) / 100, f: Math.round(h.fill), c: o.coat ? o.coat() : 0, s: (h.dashT > 0 ? 1 : 0) | (h.dizzyT > 0 ? 4 : 0), h: heap | 0 });
    },
    lobby() {
      const l = match.lobby;
      return { players: l.players, canStart: l.canStart, bots: l.bots, waitingFor: l.waitingFor };
    },
    setSetting(id, v) {
      if (!room.isHost || room.match.phase !== 'lobby') return;
      try {
        room.setSetting(id, v);
      } catch {
        /* refused: the lobby shows the room's values */
      }
      if (id === 'bots') bots.setFill(v === 'off' ? 0 : 8);
    },
    syncBots() {
      bots.setFill(settings().bots === 'off' ? 0 : 8);
    },
    ready(on = true) {
      match.ready(on);
    },
    start() {
      match.start();
    },
    skip() {
      match.skip();
    },
    myCheeks,
    dispose() {
      try {
        match.dispose();
      } catch {
        /* closing anyway */
      }
    },
  };

  function sendBump(e) {
    const target = world.byId.get(e.id);
    if (!target) return;
    const msg = { t: 'bump', by: e.by, to: e.id, dx: Math.round(e.dx * 1000) / 1000, dy: Math.round(e.dy * 1000) / 1000, r: match.round };
    stats.bumpsSent++;
    if (target.bot) {
      if (room.host && room.host !== myId()) room.send(msg, { to: room.host });
    } else room.send(msg, { to: target.id });
  }

  return api;
}
