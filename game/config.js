// Every number the rules use, in one place. World units are px at zoom 1; times are seconds.

export const FOODS = [
  { key: 'seed', name: 'Sunflower seed', size: 2, worth: 2, r: 6, share: 0.38 },
  { key: 'nut', name: 'Hazelnut', size: 5, worth: 5, r: 9, share: 0.24 },
  { key: 'berry', name: 'Blueberry', size: 7, worth: 7, r: 10, share: 0.16 },
  { key: 'cracker', name: 'Cracker', size: 10, worth: 10, r: 14, share: 0.12 },
  { key: 'straw', name: 'Strawberry', size: 18, worth: 18, r: 16, share: 0.06 },
  { key: 'cookie', name: 'Cookie', size: 30, worth: 30, r: 22, share: 0.04 },
  { key: 'golden', name: 'Golden seed', size: 25, worth: 60, r: 10, share: 0 },
];
export const GOLDEN = 6;
export const FOOD_TYPES = FOODS.length;

export const CAP = 100; // full
export const MAX = 140; // any bite past this pops for sure
export const BODY_R = 18;

export const SPEED = { empty: 220, full: 90, max: 65, curve: 1.4 };
export const TAU = { base: 0.06, fill: 0.12 };
export const PORCH_R = 64;

export const POP = { base: 0.15, top: 0.6, dizzy: 1.2, ringMin: 50, ringMax: 180, land: 0.45 };

export const DASH = {
  time: 0.25,
  speed: 560,
  cooldown: 2.5,
  hit: 46,
  kb: 150,
  kbTime: 0.3,
  stun: 0.4,
  spill: 0.35,
  recoil: 30,
  immune: 1.0,
  grace: 2, // no bumps in a round's first seconds
  botGrace: 30, // bots don't bump in round 1's first seconds
};

export const PAW = { count: 5, from: 122, gap: 6, band: 190, shadow: 1.4, swat: 0.45, kb: 220, stun: 0.6, spill: 0.5, flingMin: 120, flingMax: 280, reach: 80 };

export const ROUND = { seconds: 150, intro: 4, end: 7, results: 30 };

export const SCHEDULE = {
  opening: 140,
  doorstep: ['seed', 'seed', 'seed', 'nut'],
  tossFrom: 4,
  tossEvery: 4,
  tossJitter: 1,
  lateFrom: 120,
  lateEvery: 3.5,
  lateJitter: 0.7,
  tossMin: 13,
  tossMax: 23,
  tossShadow: 1.0,
  golden: [25, 65, 100, 132],
  goldenJitter: 3,
  beacon: 2.0,
  cakeEvery: 15,
  cakeFrom: 10,
  cakeCount: 4,
};

export const SPILL_LAND = 0.45; // seconds a spilled piece flies before it can be eaten

// Bot skill as one number from 0 (clumsy) to 1 (sharp); the lobby's choices and the Picnic ladder pick points on it.
export const DIFFICULTY = { easy: 0.15, normal: 0.5, hard: 0.85 };
export const LADDER_SKILL = [0.1, 0.22, 0.38, 0.5, 0.6, 0.72, 0.85, 0.95];

// Hamster coats (players choose; bots have their own).
export const COATS = [
  { key: 'golden', name: 'Golden', base: '#E39A45', dark: '#B86F2A', belly: '#FFF0D4', mark: null },
  { key: 'cream', name: 'Cream', base: '#F4DDB3', dark: '#D3B07C', belly: '#FFF8EA', mark: null },
  { key: 'dove', name: 'Dove', base: '#A9A3A6', dark: '#7F787D', belly: '#EEE9E6', mark: null },
  { key: 'ginger', name: 'Ginger & White', base: '#F4F0E8', dark: '#D9CFC1', belly: '#FFFFFF', mark: { color: '#E07B2E', kind: 'patches' } },
  { key: 'banded', name: 'Banded', base: '#2E2624', dark: '#171211', belly: '#F2EDE6', mark: { color: '#F2EDE6', kind: 'band' } },
  { key: 'cinnamon', name: 'Cinnamon', base: '#C9773E', dark: '#94522A', belly: '#F6DCC0', mark: null },
  { key: 'panda', name: 'Panda', base: '#F6F3EE', dark: '#D6D0C6', belly: '#FFFFFF', mark: { color: '#2A2422', kind: 'panda' } },
  { key: 'sunflower', name: 'Sunflower', base: '#F2C232', dark: '#C48E16', belly: '#FFF4C8', mark: { color: '#FFE88A', kind: 'shimmer' } },
];
// Bot-only coats (index 8+).
export const BOT_COATS = [
  { key: 'sable', name: 'Sable', base: '#6A4A36', dark: '#4A3122', belly: '#E9D6C2', mark: { color: '#F6EEE4', kind: 'blaze' } },
  { key: 'spot', name: 'Spot', base: '#F7F4EF', dark: '#D8D1C6', belly: '#FFFFFF', mark: { color: '#2A2422', kind: 'spot' } },
  { key: 'chocolate', name: 'Chocolate', base: '#6B3F25', dark: '#4B2A18', belly: '#D9B593', mark: null },
];
export const ALL_COATS = [...COATS, ...BOT_COATS];

// What unlocks each coat (checked against the profile).
export const COAT_UNLOCKS = [
  { coat: 'golden', label: '' },
  { coat: 'cream', label: '' },
  { coat: 'dove', label: 'Bank 2,000 in all', test: (p) => p.totals.banked >= 2000 },
  { coat: 'ginger', label: 'Pop 10 times', test: (p) => p.totals.pops >= 10 },
  { coat: 'banded', label: 'Win a match', test: (p) => p.totals.wins >= 1 },
  { coat: 'cinnamon', label: 'Win Picnic 4', test: (p) => !!p.picnics.won[3] },
  { coat: 'sunflower', label: 'Bank 10 golden seeds', test: (p) => p.totals.golden >= 10 },
  { coat: 'panda', label: 'Win all 8 Picnics', test: (p) => p.picnics.won.filter(Boolean).length >= 8 },
];

// Seats: a bandana colour and an emblem each (colour is never the only cue).
export const SEATS = [
  { color: '#3FA7F2', emblem: 'circle' },
  { color: '#9BD13A', emblem: 'star' },
  { color: '#2DC38A', emblem: 'triangle' },
  { color: '#9A5BEA', emblem: 'diamond' },
  { color: '#FF8424', emblem: 'square' },
  { color: '#FF6FB0', emblem: 'heart' },
  { color: '#16B3AE', emblem: 'cross' },
  { color: '#2E3F9E', emblem: 'moon' },
];

// The bot hamsters: a name, a coat (index into ALL_COATS) and a personality each.
export const BOTS = [
  { name: 'Gus', coat: 3, kind: 'glutton' },
  { name: 'Pepper', coat: 4, kind: 'bully' },
  { name: 'Mabel', coat: 0, kind: 'banker' },
  { name: 'Dot', coat: 9, kind: 'grazer' },
  { name: 'Rocco', coat: 8, kind: 'gambler' },
  { name: 'Fig', coat: 2, kind: 'scavenger' },
  { name: 'Bea', coat: 1, kind: 'plain' },
  { name: 'Clem', coat: 10, kind: 'plain' },
];
export const BOT_NAMES = BOTS.map((b) => b.name);
export const botByName = (name) => BOTS.find((b) => b.name === String(name).replace(/ \d+$/, '')) ?? BOTS[6];

export const PALETTE = {
  red: '#D8413A',
  cream: '#FFF2D9',
  meadow: '#5E9E3F',
  biscuit: '#E3A24F',
  cocoa: '#3B2218',
  sun: '#FFCB2E',
  hot: '#FF4D6D',
};
