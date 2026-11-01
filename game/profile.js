// What a player keeps: coats, Picnics, bests, totals, today's Daily, hints already seen. Saved in ow.save ('profile'),
// with badges and leaderboards. Pure helpers at the top; the platform calls are all guarded.

import { COATS, COAT_UNLOCKS } from './config.js';

export const BADGES = ['first-bite', 'chipmunk-cheeks', 'pop', 'bully', 'golden-seed', 'hoarder', 'clean-plate', 'buzzer-beater', 'daily-crumbs', 'picnic-season'];
export const HOARDER = 1000;

export function freshProfile() {
  return {
    v: 1,
    coat: 0,
    picnics: { won: [false, false, false, false, false, false, false, false], best: [0, 0, 0, 0, 0, 0, 0, 0] },
    bests: { round: 0, trip: 0, golden: 0 },
    totals: { banked: 0, pops: 0, golden: 0, wins: 0, matches: 0 },
    daily: { day: -1, best: 0 },
    hints: {},
  };
}

const num = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

/** A saved profile, checked field by field (a bad save never breaks the game). */
export function cleanProfile(raw) {
  const p = freshProfile();
  if (!raw || typeof raw !== 'object') return p;
  p.coat = num(raw.coat, COATS.length - 1);
  if (raw.picnics && Array.isArray(raw.picnics.won)) p.picnics.won = p.picnics.won.map((_, i) => !!raw.picnics.won[i]);
  if (raw.picnics && Array.isArray(raw.picnics.best)) p.picnics.best = p.picnics.best.map((_, i) => num(raw.picnics.best[i], 99999));
  for (const k of Object.keys(p.bests)) p.bests[k] = num(raw.bests?.[k], 99999);
  for (const k of Object.keys(p.totals)) p.totals[k] = num(raw.totals?.[k]);
  p.daily.day = Number.isFinite(raw.daily?.day) ? raw.daily.day : -1;
  p.daily.best = num(raw.daily?.best, 99999);
  if (raw.hints && typeof raw.hints === 'object') for (const k of Object.keys(raw.hints).slice(0, 40)) p.hints[String(k).slice(0, 24)] = !!raw.hints[k];
  if (!coatUnlocked(p, p.coat)) p.coat = 0;
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

/**
 * What a finished round means for the profile: returns { badges: [ids], lines (best lines) } and updates p.
 * r: { heap, trips: [fills], pops, popsByBump (rivals popped by my bumps), golden, eaten, lastBankLeft (s), won, match, matchWon, cleanMatch }
 */
export function recordRound(p, r) {
  const badges = [];
  const lines = [];
  if (r.heap > 0) badges.push('first-bite');
  if ((r.bestTrip ?? 0) >= 120) badges.push('chipmunk-cheeks');
  if (r.pops > 0) badges.push('pop');
  if (r.popsByBump > 0) badges.push('bully');
  if (r.golden > 0) badges.push('golden-seed');
  if (r.heap >= HOARDER) badges.push('hoarder');
  if (r.lastBankLeft !== null && r.lastBankLeft !== undefined && r.lastBankLeft <= 3) badges.push('buzzer-beater');
  if (r.heap > p.bests.round && r.heap > 0) {
    if (p.bests.round > 0) lines.push({ text: `New best round! ${r.heap}`, best: true });
    p.bests.round = r.heap;
  }
  if ((r.bestTrip ?? 0) > p.bests.trip) {
    if (p.bests.trip > 0 && r.bestTrip >= 60) lines.push({ text: `Biggest cheekful yet: ${r.bestTrip}`, best: true });
    p.bests.trip = r.bestTrip;
  }
  if (r.golden > p.bests.golden) p.bests.golden = r.golden;
  p.totals.banked += r.heap;
  p.totals.pops += r.pops;
  p.totals.golden += r.golden;
  return { badges, lines };
}

/** Coats a round's totals just unlocked (indexes), comparing before and after. */
export function newCoats(before, after) {
  const out = [];
  for (let i = 0; i < COATS.length; i++) if (!coatUnlocked(before, i) && coatUnlocked(after, i)) out.push(i);
  return out;
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
