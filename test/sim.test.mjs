// The schedule, the bots and the balance: whole rounds played through the pure modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSchedule } from '../game/schedule.js';
import { ARENAS, arenaById, burrowsFor, foodSpotOk, inField } from '../game/arenas.js';
import { FOODS, GOLDEN, ROUND, BODY_R, PAW } from '../game/config.js';
import { playRound, median } from './play.mjs';

test('the schedule is the same on every page for a seed, and different for another', () => {
  for (const a of ARENAS) {
    const burrows = burrowsFor(a, 8);
    const one = makeSchedule({ seed: 'abc', arena: a, burrows });
    const two = makeSchedule({ seed: 'abc', arena: a, burrows });
    const other = makeSchedule({ seed: 'abd', arena: a, burrows });
    assert.deepEqual(one, two, a.name);
    assert.notDeepEqual(one.items, other.items, a.name);
  }
});

test('every piece lands on the field, clear of burrows and obstacles, inside the round', () => {
  for (const a of ARENAS) {
    for (const seed of [1, 2, 3]) {
      const burrows = burrowsFor(a, 8);
      const s = makeSchedule({ seed, arena: a, burrows });
      assert.ok(s.count > 600 && s.count < 1000, `${a.name}: ${s.count} pieces`);
      for (const it of s.items) {
        assert.ok(Number.isFinite(it.x) && Number.isFinite(it.y) && Number.isFinite(it.land));
        assert.ok(it.land <= ROUND.seconds, 'lands before the buzzer');
        assert.ok(inField(a, it.x, it.y, -2), `${a.name}: in the field`);
        assert.ok(foodSpotOk(a, it.x, it.y, FOODS[it.type].r - 2, burrows), `${a.name}: (${it.x}, ${it.y}) is a fair spot`);
      }
      assert.ok(s.goldens.length >= 3, `${a.name}: golden seeds`);
      for (const g of s.goldens) assert.equal(s.items[g.i].type, GOLDEN);
      const late = s.sweeps.filter((x) => x.at >= PAW.from - 1);
      assert.ok(late.length >= 4, `${a.name}: the cat comes in the last 30 s`);
      for (const sw of s.sweeps) assert.ok(sw.end < ROUND.seconds);
    }
  }
});

test('whole rounds on every arena: they end on time, nothing is NaN, nothing throws', () => {
  for (const a of ARENAS) {
    for (const seed of [11, 12]) {
      const r = playRound({ arena: a.id, seed, onStep: (w) => {
        for (const h of w.hams) {
          if (!Number.isFinite(h.x) || !Number.isFinite(h.y) || !Number.isFinite(h.fill) || !Number.isFinite(h.heap)) throw new Error(`${a.name}: ${h.name} NaN at ${w.t}`);
          if (h.x < BODY_R - 1 || h.y < BODY_R - 1 || h.x > a.w - BODY_R + 1 || h.y > a.h - BODY_R + 1) throw new Error(`${a.name}: ${h.name} off the arena`);
        }
      } });
      assert.equal(r.w.t, ROUND.seconds);
      assert.ok(r.w.over);
      for (const h of r.w.hams) assert.equal(h.fill, 0, 'cheeks emptied at the buzzer');
      assert.ok(r.standings[0].heap > 0, `${a.name}: someone banked`);
    }
  }
});

test('balance: heaps near 600, winners near 950, nobody runs away with it, food never runs out', () => {
  const heaps = [];
  const winners = [];
  const gaps = [];
  let low = Infinity;
  for (const arena of [0, 1, 3, 4]) {
    for (let seed = 1; seed <= 3; seed++) {
      const r = playRound({ arena, seed });
      for (const s of r.standings) heaps.push(s.heap);
      winners.push(r.standings[0].heap);
      gaps.push(r.standings[0].heap / Math.max(1, r.standings[1].heap));
      const mid = r.counts.filter((c) => c.t > 10 && c.t < 145).map((c) => c.food);
      low = Math.min(low, ...mid);
    }
  }
  const m = median(heaps);
  const wm = median(winners);
  assert.ok(m > 450 && m < 800, `median heap ${m}`);
  assert.ok(wm > 750 && wm < 1250, `median winner ${wm}`);
  assert.ok(median(gaps) < 1.35, `winners win, but close (first/second ${median(gaps).toFixed(2)})`);
  assert.ok(low >= 8, `there is always food to find (${low})`);
});

test('bots: better bots bank more, the best can be beaten, the worst still play', () => {
  const by = { easy: [], hard: [] };
  let hardLost = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const skills = [0.15, 0.15, 0.15, 0.15, 0.85, 0.85, 0.85, 0.85];
    const kinds = Array(8).fill('plain');
    const r = playRound({ arena: 0, seed, skills, kinds });
    r.w.hams.forEach((h, i) => (i < 4 ? by.easy : by.hard).push(h.heap));
    const top = r.standings[0].id;
    if (Number(top.split(':')[1]) <= 4) hardLost++;
    for (const h of r.w.hams.slice(0, 4)) assert.ok(h.heap > 0 || h.stats.trips > 0 || h.stats.eaten > 5, 'easy bots still eat');
  }
  const e = median(by.easy);
  const h = median(by.hard);
  assert.ok(h > e * 1.15, `hard ${h} beats easy ${e}`);
  assert.ok(e > 150, `easy bots aren't useless (${e})`);
  // A hard bot isn't perfect: it pops sometimes and loses a round now and then to a lucky easy one is allowed, never required.
  assert.ok(hardLost <= 3);
});

test('personalities show: the glutton pops most, the banker least', () => {
  const pops = {};
  for (let seed = 1; seed <= 5; seed++) {
    const r = playRound({ arena: 0, seed });
    for (const h of r.w.hams) pops[h.kind] = (pops[h.kind] ?? 0) + h.stats.pops;
  }
  const most = Math.max(...Object.values(pops));
  const least = Math.min(...Object.values(pops));
  assert.equal(pops.glutton, most, JSON.stringify(pops));
  assert.equal(pops.banker, least, JSON.stringify(pops));
  assert.ok(pops.glutton >= pops.banker * 4, JSON.stringify(pops));
});

test('arena twists are in place', () => {
  assert.equal(ARENAS.length, 8);
  assert.ok(arenaById(1).obstacles.some((o) => o.prop === 'sink'), 'Kitchen Counter has its sink');
  assert.ok(arenaById(3).dark, 'Night Garden is dark');
  assert.ok(arenaById(4).cake, 'Birthday Table has its cake');
  assert.ok(arenaById(5).stream, 'Campsite has its stream');
  assert.ok(arenaById(6).disc, 'Lazy Susan turns');
  assert.ok(arenaById(7).pawAll, "The Cat's Table: the cat is awake all round");
  assert.equal(new Set(ARENAS.map((a) => a.name)).size, 8);
});
