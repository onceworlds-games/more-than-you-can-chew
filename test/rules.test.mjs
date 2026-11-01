import test from 'node:test';
import assert from 'node:assert/strict';
import { fillOf, worthOf, topSpeed, popChance, spillPick, bulge, reach, knockScale, dashSpeed, emptyCheeks, countOf } from '../game/rules.js';
import { FOODS, GOLDEN, CAP, MAX, SPEED, COATS, COAT_UNLOCKS, SEATS, BOTS, ALL_COATS, SCHEDULE } from '../game/config.js';
import { createRng } from '../game/rng.js';

test('food: sizes fill the cheeks, worth banks; the golden seed is worth more than it fills', () => {
  const c = emptyCheeks();
  c[0] = 3; // seeds
  c[5] = 1; // cookie
  c[GOLDEN] = 1;
  assert.equal(fillOf(c), 3 * 2 + 30 + 25);
  assert.equal(worthOf(c), 3 * 2 + 30 + 60);
  assert.equal(countOf(c), 5);
  assert.ok(FOODS[GOLDEN].worth > FOODS[GOLDEN].size);
  for (let i = 0; i < GOLDEN; i++) assert.equal(FOODS[i].worth, FOODS[i].size, `${FOODS[i].key}: worth equals size`);
  const shares = FOODS.slice(0, GOLDEN).reduce((a, f) => a + f.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9, 'the tossed food shares add up to 1');
});

test('speed falls as the cheeks fill, and keeps falling past full', () => {
  assert.equal(topSpeed(0), SPEED.empty);
  assert.equal(Math.round(topSpeed(CAP)), SPEED.full);
  assert.equal(Math.round(topSpeed(MAX)), SPEED.max);
  assert.equal(Math.round(topSpeed(400)), SPEED.max);
  let last = Infinity;
  for (let f = 0; f <= MAX; f += 5) {
    const s = topSpeed(f);
    assert.ok(s <= last, `slower at ${f}`);
    last = s;
  }
  assert.ok(dashSpeed(0) > dashSpeed(MAX), 'a full hamster dashes shorter');
  assert.ok(knockScale(0) > knockScale(MAX), 'a full hamster is harder to knock');
});

test('popping: never at or under full, sure past the max, rising in between', () => {
  assert.equal(popChance(0), 0);
  assert.equal(popChance(CAP), 0);
  assert.equal(popChance(MAX + 1), 1);
  assert.ok(popChance(CAP + 1) > 0.1 && popChance(CAP + 1) < 0.2);
  assert.ok(popChance(MAX) >= 0.59 && popChance(MAX) <= 0.6);
  for (let f = CAP + 1; f < MAX; f++) assert.ok(popChance(f + 1) >= popChance(f));
});

test('cheeks bulge and reach further as they fill', () => {
  assert.equal(bulge(0), 0);
  assert.ok(bulge(CAP) > bulge(50));
  assert.ok(bulge(MAX) > bulge(CAP));
  assert.ok(reach(MAX, 10) > reach(0, 10));
});

test('spills take about the share asked, at least one piece, and only what is there', () => {
  const rng = createRng('spill');
  const c = emptyCheeks();
  c[0] = 10;
  c[3] = 3;
  c[5] = 1;
  for (let k = 0; k < 200; k++) {
    const out = spillPick(c, 0.4, rng.next);
    assert.ok(out.length >= 1);
    const got = out.reduce((a, t) => a + FOODS[t].size, 0);
    assert.ok(got >= fillOf(c) * 0.4, 'at least the share');
    const n = emptyCheeks();
    for (const t of out) n[t]++;
    for (let i = 0; i < n.length; i++) assert.ok(n[i] <= c[i], 'never more than the cheeks hold');
  }
  assert.deepEqual(spillPick(emptyCheeks(), 0.5, rng.next), []);
  assert.equal(spillPick(c, 1, rng.next).length, 14, 'a pop takes everything');
});

test('every coat has a way to get it, seats have distinct colours and emblems, bots have their own look', () => {
  for (const c of COATS) assert.ok(COAT_UNLOCKS.find((u) => u.coat === c.key), c.key);
  assert.equal(new Set(SEATS.map((s) => s.color)).size, SEATS.length);
  assert.equal(new Set(SEATS.map((s) => s.emblem)).size, SEATS.length);
  assert.equal(new Set(BOTS.map((b) => b.name)).size, BOTS.length);
  for (const b of BOTS) assert.ok(ALL_COATS[b.coat], `${b.name} wears a coat`);
  assert.ok(SCHEDULE.opening > 0);
});
