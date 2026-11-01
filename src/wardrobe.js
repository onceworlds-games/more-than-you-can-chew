// What playing earns: XP and levels with a reward track (hats, pop effects, trails), coats for feats, three stars per
// Picnic, three Daily goals a day and a streak. Pure data and rules (the profile applies them; tests check them).

import { COATS } from './sim/config.js';

export const HAT_LIST = [
  { id: 'party', name: 'Party Hat' },
  { id: 'bow', name: 'Big Bow' },
  { id: 'daisy', name: 'Daisy' },
  { id: 'beanie', name: 'Bobble Beanie' },
  { id: 'sprout', name: 'Sprout' },
  { id: 'acorn', name: 'Acorn Cap' },
  { id: 'chef', name: 'Chef Hat' },
  { id: 'cowboy', name: 'Cowboy Hat' },
  { id: 'propeller', name: 'Propeller Cap' },
  { id: 'strawberry', name: 'Strawberry' },
  { id: 'tophat', name: 'Top Hat' },
  { id: 'crown', name: 'Golden Crown' },
];
export const POPS = [
  { id: 'crumbs', name: 'Crumbs' },
  { id: 'confetti', name: 'Confetti' },
  { id: 'hearts', name: 'Hearts' },
  { id: 'stars', name: 'Starburst' },
  { id: 'bubbles', name: 'Bubbles' },
  { id: 'fireworks', name: 'Fireworks' },
];
export const TRAILS = [
  { id: 'dust', name: 'Dust' },
  { id: 'sparkle', name: 'Sparkles' },
  { id: 'petals', name: 'Petals' },
  { id: 'bubbles', name: 'Bubbles' },
  { id: 'flames', name: 'Flames' },
  { id: 'rainbow', name: 'Rainbow' },
];

// The level track: what each level hands out (levels not listed give XP only... none are skipped below 30).
export const TRACK = {
  2: { kind: 'hat', id: 'party' },
  3: { kind: 'pop', id: 'confetti' },
  4: { kind: 'hat', id: 'bow' },
  5: { kind: 'trail', id: 'sparkle' },
  6: { kind: 'hat', id: 'daisy' },
  8: { kind: 'hat', id: 'beanie' },
  9: { kind: 'pop', id: 'hearts' },
  10: { kind: 'hat', id: 'sprout' },
  11: { kind: 'trail', id: 'petals' },
  12: { kind: 'hat', id: 'acorn' },
  14: { kind: 'pop', id: 'stars' },
  15: { kind: 'hat', id: 'chef' },
  16: { kind: 'trail', id: 'bubbles' },
  18: { kind: 'hat', id: 'cowboy' },
  20: { kind: 'pop', id: 'bubbles' },
  21: { kind: 'trail', id: 'flames' },
  22: { kind: 'hat', id: 'propeller' },
  24: { kind: 'hat', id: 'strawberry' },
  25: { kind: 'pop', id: 'fireworks' },
  26: { kind: 'trail', id: 'rainbow' },
  28: { kind: 'hat', id: 'tophat' },
};
// The crown is for all 24 Picnic stars.
export const CROWN_STARS = 24;
export const MAX_LEVEL = 50;

/** XP to go from level n to n + 1. */
export const levelCost = (n) => 120 + 40 * (n - 1);

/** { level, into (XP into this level), need (XP this level takes) } for a total. */
export function levelOf(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(xp) || 0);
  while (level < MAX_LEVEL && left >= levelCost(level)) {
    left -= levelCost(level);
    level++;
  }
  return { level, into: left, need: levelCost(level) };
}

export function itemName(kind, id) {
  const list = kind === 'hat' ? HAT_LIST : kind === 'pop' ? POPS : kind === 'trail' ? TRAILS : null;
  if (kind === 'coat') return COATS.find((c) => c.key === id)?.name ?? id;
  return list?.find((x) => x.id === id)?.name ?? id;
}

/** Whether a wardrobe item is earned, and what earns it when it isn't. */
export function itemUnlocked(p, kind, id) {
  if ((kind === 'pop' && id === 'crumbs') || (kind === 'trail' && id === 'dust')) return true;
  if (kind === 'hat' && id === 'crown') return starCount(p) >= CROWN_STARS;
  const lv = levelOf(p.xp).level;
  for (const [l, r] of Object.entries(TRACK)) if (r.kind === kind && r.id === id) return lv >= Number(l);
  return false;
}
export function itemCondition(kind, id) {
  if (kind === 'hat' && id === 'crown') return `All ${CROWN_STARS} Picnic stars`;
  for (const [l, r] of Object.entries(TRACK)) if (r.kind === kind && r.id === id) return `Level ${l}`;
  return '';
}
/** Rewards for reaching level `n` (from the track). */
export const rewardAt = (n) => TRACK[n] ?? null;

// ------------------------------------------------------------------ XP for a round

/**
 * XP a finished round is worth. r: { heap, place, players, stuffed, bursting, bestChain, golden, specials, pops, solo }
 * Returns [{ text, xp }] lines (summed by the caller).
 */
export function roundXp(r) {
  const out = [];
  const heap = Math.max(0, r.heap | 0);
  if (heap > 0) out.push({ text: 'Banked', xp: Math.round(heap / 8) });
  if (r.stuffed > 0) out.push({ text: `Stuffed ×${r.stuffed}`, xp: r.stuffed * 15 });
  if (r.bursting > 0) out.push({ text: `Bursting ×${r.bursting}`, xp: r.bursting * 30 });
  if ((r.bestChain ?? 0) >= 4) out.push({ text: `Gobble ×${r.bestChain}`, xp: r.bestChain * 3 });
  if (r.golden > 0) out.push({ text: 'Golden seeds', xp: r.golden * 10 });
  const n = Math.max(1, r.players ?? 8);
  if (n > 1 && r.place >= 1 && r.place <= 3) out.push({ text: ['Won!', '2nd place', '3rd place'][r.place - 1], xp: [60, 35, 20][r.place - 1] });
  return out.filter((l) => l.xp > 0);
}

// ------------------------------------------------------------------ Picnic stars

export const PICNIC_GOALS = [
  { heap: 900, text: 'Bank a Stuffed cheekful', test: (r) => r.stuffed + r.bursting >= 1 },
  { heap: 1000, text: 'Gobble ×6', test: (r) => r.bestChain >= 6 },
  { heap: 1100, text: 'Never pop', test: (r) => r.pops === 0 && r.heap > 0 },
  { heap: 1200, text: 'Bank 2 golden seeds', test: (r) => r.golden >= 2 },
  { heap: 1300, text: 'Bank a Bursting cheekful', test: (r) => r.bursting >= 1 },
  { heap: 1400, text: 'Bank 12 times', test: (r) => r.trips >= 12 },
  { heap: 1500, text: 'Eat 3 specials', test: (r) => r.specials >= 3 },
  { heap: 1600, text: 'Never get swatted', test: (r) => r.swatted === 0 && r.heap > 0 },
];

/** Which of a Picnic's three stars this round earns: [win, heap goal, challenge]. */
export function picnicStars(n, r) {
  const g = PICNIC_GOALS[n] || PICNIC_GOALS[0];
  return [r.place === 1, r.heap >= g.heap, !!g.test(r)];
}
export const starCount = (p) => (p.picnics?.stars || []).reduce((a, s) => a + (s ? s.filter(Boolean).length : 0), 0);

// Which specials each Picnic drops: the first has none, then they come one at a time; matches have them all.
export const PICNIC_SPECIALS = [[], ['chili'], ['chili', 'gum'], ['chili', 'gum', 'pepper'], ['chili', 'gum', 'pepper'], ['chili', 'gum', 'pepper'], ['chili', 'gum', 'pepper'], ['chili', 'gum', 'pepper']];

// ------------------------------------------------------------------ Daily goals and the streak

export const GOALS = [
  { id: 'stuffed', text: (n) => `Bank ${n} Stuffed cheekfuls`, n: 3, stat: 'stuffedAll', sum: true },
  { id: 'bursting', text: () => 'Bank a Bursting cheekful', n: 1, stat: 'bursting', sum: true },
  { id: 'chain', text: (n) => `Gobble ×${n}`, n: 6, stat: 'bestChain', sum: false },
  { id: 'golden', text: (n) => `Bank ${n} golden seeds`, n: 2, stat: 'golden', sum: true },
  { id: 'heap', text: (n) => `Bank ${n.toLocaleString('en-US')} in a round`, n: 1500, stat: 'heap', sum: false },
  { id: 'bumps', text: (n) => `Bump rivals ${n} times`, n: 6, stat: 'bumps', sum: true },
  { id: 'specials', text: (n) => `Eat ${n} specials`, n: 4, stat: 'specials', sum: true },
  { id: 'wins', text: (n) => `Win ${n} rounds`, n: 2, stat: 'win', sum: true },
  { id: 'trips', text: (n) => `Bank ${n} times`, n: 15, stat: 'trips', sum: true },
  { id: 'clean', text: () => 'Win without popping', n: 1, stat: 'cleanWin', sum: true },
];
export const GOAL_XP = 100;

/** Today's three goals (the same for everyone on a day). */
export function goalsFor(day) {
  const pick = [];
  let s = (day * 2654435761) >>> 0;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
  while (pick.length < 3) {
    const g = GOALS[Math.floor(next() * GOALS.length)];
    if (!pick.includes(g.id)) pick.push(g.id);
  }
  return pick.map((id) => ({ id, have: 0, done: false }));
}
export const goalDef = (id) => GOALS.find((g) => g.id === id) ?? GOALS[0];

/** Streak bonus XP for the first Daily of a day. */
export const streakXp = (streak) => 20 * Math.min(7, Math.max(1, streak));

// ------------------------------------------------------------------ what you wear, as one number (presence)

/** { hat, pop, trail } → a small integer others' pages can read. */
export function encodeOutfit(o) {
  const h = Math.max(0, HAT_LIST.findIndex((x) => x.id === o?.hat) + 1);
  const p = Math.max(0, POPS.findIndex((x) => x.id === o?.pop));
  const t = Math.max(0, TRAILS.findIndex((x) => x.id === o?.trail));
  return h | (p << 4) | (t << 7);
}
/** The other way, checked (anything odd becomes the plain outfit). */
export function decodeOutfit(code) {
  const c = Number.isInteger(code) && code >= 0 && code < 1024 ? code : 0;
  const h = c & 15;
  return { hat: HAT_LIST[h - 1]?.id ?? '', pop: POPS[(c >> 4) & 7]?.id ?? 'crumbs', trail: TRAILS[(c >> 7) & 7]?.id ?? 'dust' };
}

// The bots dress up too.
export const BOT_OUTFITS = {
  Gus: { hat: 'chef', pop: 'confetti', trail: 'dust' },
  Pepper: { hat: 'cowboy', pop: 'fireworks', trail: 'flames' },
  Mabel: { hat: 'bow', pop: 'hearts', trail: 'petals' },
  Dot: { hat: 'daisy', pop: 'bubbles', trail: 'bubbles' },
  Rocco: { hat: 'tophat', pop: 'stars', trail: 'sparkle' },
  Fig: { hat: 'acorn', pop: 'crumbs', trail: 'dust' },
  Bea: { hat: 'sprout', pop: 'confetti', trail: 'petals' },
  Clem: { hat: 'beanie', pop: 'crumbs', trail: 'dust' },
};

/** Puts an outfit on a sim hamster (its trail goes in `trailFx`: `trail` is the sim's own). */
export function dressHam(h, o) {
  h.hat = o?.hat || '';
  h.pop = o?.pop || 'crumbs';
  h.trailFx = o?.trail || 'dust';
}
