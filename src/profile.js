// What a player keeps: XP and level, what they wear (coat, hat, pop, trail), Picnic wins, bests and stars, totals, today's
// Daily (best, goals, streak), hints already seen. Saved in ow.save ('profile') with badges and leaderboards. Pure helpers
// at the top (tests use them); the platform calls are all guarded.

import { COATS, COAT_UNLOCKS } from './sim/config.js';
import { HAT_LIST, POPS, TRAILS, levelOf, rewardAt, itemUnlocked, itemName, roundXp, picnicStars, starCount, goalsFor, goalDef, GOAL_XP, streakXp, CROWN_STARS } from './wardrobe.js';

export const BADGES = ['first-bite', 'stuffed', 'bursting', 'gobbler', 'pop', 'bully', 'golden-seed', 'hoarder', 'clean-plate', 'buzzer-beater', 'spice-rack', 'week-streak', 'picnic-season', 'three-star', 'well-fed'];
export const HOARDER = 2000;
export const GOBBLER = 8;

const eight = (v) => [v, v, v, v, v, v, v, v];

export function freshProfile() {
  return {
    v: 2,
    xp: 0,
    coat: 0,
    hat: '',
    pop: 'crumbs',
    trail: 'dust',
    picnics: { won: eight(false), best: eight(0), stars: eight(null).map(() => [false, false, false]) },
    bests: { round: 0, trip: 0, golden: 0, chain: 0, bank: 0 },
    totals: { banked: 0, pops: 0, golden: 0, wins: 0, matches: 0, rounds: 0, stuffed: 0, bursting: 0, specials: 0, bumps: 0 },
    daily: { day: -1, best: 0, goalsDay: -1, goals: [], streak: 0, bestStreak: 0, lastDay: -9 },
    seen: [],
    hints: {},
  };
}

const num = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
const int = (v, d) => (Number.isFinite(v) ? Math.floor(v) : d);

/** A saved profile (v1 or v2), checked field by field (a bad save never breaks the game). */
export function cleanProfile(raw) {
  const p = freshProfile();
  if (!raw || typeof raw !== 'object') return p;
  p.xp = num(raw.xp, 1e8);
  p.coat = num(raw.coat, COATS.length - 1);
  p.hat = HAT_LIST.some((h) => h.id === raw.hat) ? raw.hat : '';
  p.pop = POPS.some((x) => x.id === raw.pop) ? raw.pop : 'crumbs';
  p.trail = TRAILS.some((x) => x.id === raw.trail) ? raw.trail : 'dust';
  const pc = raw.picnics || {};
  if (Array.isArray(pc.won)) p.picnics.won = p.picnics.won.map((_, i) => !!pc.won[i]);
  if (Array.isArray(pc.best)) p.picnics.best = p.picnics.best.map((_, i) => num(pc.best[i], 99999));
  if (Array.isArray(pc.stars)) p.picnics.stars = p.picnics.stars.map((_, i) => [0, 1, 2].map((k) => !!(Array.isArray(pc.stars[i]) && pc.stars[i][k])));
  // A Picnic won before stars existed keeps its first star.
  p.picnics.won.forEach((w, i) => {
    if (w) p.picnics.stars[i][0] = true;
  });
  for (const k of Object.keys(p.bests)) p.bests[k] = num(raw.bests?.[k], 99999);
  for (const k of Object.keys(p.totals)) p.totals[k] = num(raw.totals?.[k]);
  const d = raw.daily || {};
  p.daily.day = int(d.day, -1);
  p.daily.best = num(d.best, 99999);
  p.daily.goalsDay = int(d.goalsDay, -1);
  if (Array.isArray(d.goals))
    p.daily.goals = d.goals
      .slice(0, 3)
      .filter((g) => g && typeof g.id === 'string')
      .map((g) => ({ id: goalDef(g.id).id, have: num(g.have, 1e6), done: !!g.done }));
  p.daily.streak = num(d.streak, 9999);
  p.daily.bestStreak = Math.max(p.daily.streak, num(d.bestStreak, 9999));
  p.daily.lastDay = int(d.lastDay, -9);
  if (Array.isArray(raw.seen)) p.seen = raw.seen.filter((s) => typeof s === 'string').slice(0, 80).map((s) => s.slice(0, 24));
  if (raw.hints && typeof raw.hints === 'object') for (const k of Object.keys(raw.hints).slice(0, 40)) p.hints[String(k).slice(0, 24)] = !!raw.hints[k];
  if (!coatUnlocked(p, p.coat)) p.coat = 0;
  if (p.hat && !itemUnlocked(p, 'hat', p.hat)) p.hat = '';
  if (!itemUnlocked(p, 'pop', p.pop)) p.pop = 'crumbs';
  if (!itemUnlocked(p, 'trail', p.trail)) p.trail = 'dust';
  return p;
}

export function coatUnlocked(p, i) {
  const u = COAT_UNLOCKS.find((c) => c.coat === COATS[i]?.key);
  return !!u && (!u.test || u.test(p));
}
export const coatCondition = (i) => COAT_UNLOCKS.find((c) => c.coat === COATS[i]?.key)?.label ?? '';

/** Picnic n (0-based) is open when it's the first or the one before it was won. */
export const picnicOpen = (p, n) => n === 0 || !!p.picnics.won[n - 1];

/** The Daily's day number on the platform clock, and its arena (they take turns). */
export const dayNumber = (ms) => Math.floor(ms / 86400000);
export const dailyArena = (day) => ((day % 8) + 8) % 8;
export const dailyScore = (day, heap) => day * 10000 + Math.min(9999, heap);

/** Today's goals, fresh when the day turned. */
export function todaysGoals(p, day) {
  if (p.daily.goalsDay !== day || p.daily.goals.length !== 3) {
    p.daily.goalsDay = day;
    p.daily.goals = goalsFor(day);
  }
  return p.daily.goals;
}

/** The streak as it stands today (a missed day breaks it, though it isn't saved until the next Daily). */
export const liveStreak = (p, day) => (p.daily.lastDay >= day - 1 ? p.daily.streak : 0);

/** Everything a profile has earned (for "New!" markers): `kind:id` keys. */
export function earnedKeys(p) {
  const out = [];
  for (const h of HAT_LIST) if (itemUnlocked(p, 'hat', h.id)) out.push(`hat:${h.id}`);
  for (const x of POPS) if (itemUnlocked(p, 'pop', x.id)) out.push(`pop:${x.id}`);
  for (const x of TRAILS) if (itemUnlocked(p, 'trail', x.id)) out.push(`trail:${x.id}`);
  COATS.forEach((c, i) => {
    if (coatUnlocked(p, i)) out.push(`coat:${c.key}`);
  });
  return out;
}

/**
 * A finished round, applied to the profile. r (my numbers): { heap, trips, pops, popsByBump, golden, bestTrip, lastBankLeft,
 * stuffed, bursting, bestChain, bestBank, specials, spice, bumps, swatted, place, players }.
 * ctx: { mode: 'picnic' | 'daily' | 'quick' | 'match', n (Picnic), day (today) }.
 * Returns what to show: { badges, lines, xp: [{ text, xp }], xpTotal, before, after (levelOf), rewards: [{ kind, id, name }],
 * stars: { n, got, fresh } | null, goals: [{ text, have, n, done, fresh }], streak, newKeys }.
 */
export function finishRound(p, r, ctx) {
  const keysBefore = new Set(earnedKeys(p));
  const before = levelOf(p.xp);
  const badges = [];
  const lines = [];
  const stuffedAll = (r.stuffed | 0) + (r.bursting | 0);
  const win = r.place === 1 && (r.players ?? 2) > 1;
  if (r.heap > 0) badges.push('first-bite');
  if (stuffedAll > 0) badges.push('stuffed');
  if (r.bursting > 0) badges.push('bursting');
  if ((r.bestChain | 0) >= GOBBLER) badges.push('gobbler');
  if (r.pops > 0) badges.push('pop');
  if (r.popsByBump > 0) badges.push('bully');
  if (r.golden > 0) badges.push('golden-seed');
  if (r.heap >= HOARDER) badges.push('hoarder');
  if (win && r.pops === 0) badges.push('clean-plate');
  if (r.lastBankLeft !== null && r.lastBankLeft !== undefined && r.lastBankLeft <= 3) badges.push('buzzer-beater');
  if (((r.spice | 0) & 7) === 7) badges.push('spice-rack');

  // Bests.
  if (r.heap > p.bests.round && r.heap > 0) {
    if (p.bests.round > 0) lines.push({ text: `New best round! ${r.heap}`, best: true });
    p.bests.round = r.heap;
  }
  if ((r.bestBank | 0) > p.bests.bank) {
    if (p.bests.bank > 0 && r.bestBank >= 100) lines.push({ text: `Biggest bank yet: ${r.bestBank}`, best: true });
    p.bests.bank = r.bestBank | 0;
  }
  if ((r.bestTrip | 0) > p.bests.trip) p.bests.trip = r.bestTrip | 0;
  if ((r.bestChain | 0) > p.bests.chain) p.bests.chain = r.bestChain | 0;
  if ((r.golden | 0) > p.bests.golden) p.bests.golden = r.golden | 0;

  // Totals.
  p.totals.banked += r.heap | 0;
  p.totals.pops += r.pops | 0;
  p.totals.golden += r.golden | 0;
  p.totals.rounds++;
  p.totals.stuffed += r.stuffed | 0;
  p.totals.bursting += r.bursting | 0;
  p.totals.specials += r.specials | 0;
  p.totals.bumps += r.bumps | 0;
  if (ctx.mode !== 'match') p.totals.matches++;
  if (win && ctx.mode !== 'match') p.totals.wins++;

  // XP for the round.
  const xp = roundXp({ ...r, players: r.players ?? 8 });

  // Picnic stars.
  let stars = null;
  if (ctx.mode === 'picnic') {
    const n = ctx.n;
    const got = picnicStars(n, r);
    const had = p.picnics.stars[n];
    const fresh = got.map((g, k) => g && !had[k]);
    p.picnics.stars[n] = had.map((h, k) => h || got[k]);
    const nFresh = fresh.filter(Boolean).length;
    if (nFresh) xp.push({ text: nFresh === 1 ? 'New star' : `${nFresh} new stars`, xp: nFresh * 50 });
    if (r.heap > p.picnics.best[n]) p.picnics.best[n] = r.heap;
    if (got[0]) {
      if (!p.picnics.won[n] && n < 7) lines.push({ text: `Picnic ${n + 2} is open!`, best: true });
      p.picnics.won[n] = true;
    }
    if (p.picnics.won.every(Boolean)) badges.push('picnic-season');
    if (starCount(p) >= CROWN_STARS) badges.push('three-star');
    stars = { n, got, fresh };
  }

  // The Daily Feast: best, streak.
  let streak = Number.isFinite(ctx.day) ? liveStreak(p, ctx.day) : 0;
  if (ctx.mode === 'daily') {
    if (p.daily.day !== ctx.day) p.daily = { ...p.daily, day: ctx.day, best: 0 };
    if (r.heap > p.daily.best) p.daily.best = r.heap;
    if (p.daily.lastDay !== ctx.day) {
      p.daily.streak = p.daily.lastDay === ctx.day - 1 ? p.daily.streak + 1 : 1;
      p.daily.lastDay = ctx.day;
      p.daily.bestStreak = Math.max(p.daily.bestStreak, p.daily.streak);
      xp.push({ text: `Day streak ${p.daily.streak}`, xp: streakXp(p.daily.streak) });
    }
    streak = p.daily.streak;
    if (p.daily.streak >= 7) badges.push('week-streak');
  }

  // Today's goals count every mode.
  const goals = [];
  const stat = { stuffedAll, bursting: r.bursting | 0, bestChain: r.bestChain | 0, golden: r.golden | 0, heap: r.heap | 0, bumps: r.bumps | 0, specials: r.specials | 0, win: win ? 1 : 0, trips: r.trips | 0, cleanWin: win && r.pops === 0 ? 1 : 0 };
  if (Number.isFinite(ctx.day)) {
    for (const g of todaysGoals(p, ctx.day)) {
      const def = goalDef(g.id);
      const was = g.done;
      const v = stat[def.stat] | 0;
      g.have = def.sum ? g.have + v : Math.max(g.have, v);
      if (g.have >= def.n) g.done = true;
      const fresh = g.done && !was;
      if (fresh) xp.push({ text: 'Daily goal', xp: GOAL_XP });
      goals.push({ text: def.text(def.n), have: Math.min(g.have, def.n), n: def.n, done: g.done, fresh });
    }
  }

  const xpTotal = xp.reduce((a, l) => a + l.xp, 0);
  p.xp += xpTotal;
  const after = levelOf(p.xp);
  const rewards = [];
  for (let l = before.level + 1; l <= after.level; l++) {
    const rw = rewardAt(l);
    if (rw) rewards.push({ ...rw, name: itemName(rw.kind, rw.id), level: l });
  }
  if (after.level >= 10) badges.push('well-fed');
  const newKeys = earnedKeys(p).filter((k) => !keysBefore.has(k));
  // Coats (and the crown) earned by feats show as rewards too.
  for (const k of newKeys) {
    const [kind, id] = k.split(':');
    if (kind === 'coat' || (kind === 'hat' && id === 'crown')) rewards.push({ kind, id, name: kind === 'coat' ? (COATS.find((c) => c.key === id)?.name ?? id) : itemName(kind, id) });
  }
  return { badges, lines, xp, xpTotal, before, after, rewards, stars, goals, streak, newKeys };
}

export const copyProfile = (p) => JSON.parse(JSON.stringify(p));

/** The platform side: load, save (paced), badges, leaderboards. */
export function createStore(ow) {
  let p = freshProfile();
  let timer = null;
  const store = {
    get p() {
      return p;
    },
    async load() {
      try {
        if (ow && ow.save) p = cleanProfile(await ow.save.get('profile'));
      } catch {
        p = freshProfile();
      }
      return p;
    },
    save() {
      if (!ow || !ow.save) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const r = ow.save.set('profile', p);
          if (r && r.catch) r.catch(() => {});
        } catch {
          /* a lost save is never an error on screen */
        }
      }, 400);
    },
    award(id) {
      if (!ow || !ow.badges || !BADGES.includes(id)) return;
      try {
        const r = ow.badges.award(id);
        if (r && r.catch) r.catch(() => {});
      } catch {
        /* guests can't earn badges */
      }
    },
    async submit(board, score) {
      if (!ow || !ow.leaderboards) return null;
      try {
        return await ow.leaderboards.submit(board, score);
      } catch {
        return null;
      }
    },
    async top(board, limit = 10) {
      if (!ow || !ow.leaderboards) return { entries: [], me: null };
      try {
        return (await ow.leaderboards.top(board, { limit })) || { entries: [], me: null };
      } catch {
        return { entries: [], me: null };
      }
    },
    now() {
      try {
        if (ow && typeof ow.now === 'function') return ow.now();
      } catch {
        /* fall through */
      }
      return Date.now();
    },
  };
  return store;
}
