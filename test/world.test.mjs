import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, DYN } from '../game/world.js';
import { arenaById } from '../game/arenas.js';
import { FOODS, GOLDEN, CAP, MAX, PORCH_R, POP, DASH, ROUND } from '../game/config.js';
import { fillOf } from '../game/rules.js';
import { createLocalSession } from '../game/session.js';

function world(o = {}) {
  const seats = o.seats ?? [
    { id: 'a', name: 'Ann', bot: false },
    { id: 'b', name: 'Bo', bot: false },
  ];
  return createWorld({ arena: arenaById(o.arena ?? 0), seed: o.seed ?? 7, round: 1, seats, ...o });
}

/** A piece put down right where we want it, landed. */
function put(w, type, x, y) {
  return w.addFood({ id: w.dynId++, type, x, y, bx: x, by: y, tb: 0, land: -1, src: 'open', fx: null, fy: null });
}

/** Out in the field, away from every burrow and piece. */
function clearSpot(w, h, x = 900, y = 600) {
  for (const f of [...w.food.values()]) if (Math.hypot(f.x - x, f.y - y) < 260) w.food.delete(f.id);
  h.x = x;
  h.y = y;
  h.vx = 0;
  h.vy = 0;
}

test('eating: running over food puts it in the cheeks; banked at your own burrow it scores', () => {
  const w = world();
  const a = w.byId.get('a');
  clearSpot(w, a);
  put(w, 3, 905, 600);
  w.step(1 / 60);
  assert.equal(a.cheeks[3], 1, 'the cracker is in the cheeks');
  assert.equal(a.fill, FOODS[3].size);
  assert.equal(a.heap, 0, 'nothing scores until it is banked');
  // Home: the porch banks everything at once.
  a.x = a.burrow.x + a.burrow.nx * 30;
  a.y = a.burrow.y + a.burrow.ny * 30;
  w.step(1 / 60);
  assert.equal(a.heap, FOODS[3].worth);
  assert.equal(a.fill, 0);
  const ev = w.drain();
  assert.ok(ev.some((e) => e.k === 'eat') && ev.some((e) => e.k === 'bank'));
});

test("another hamster's burrow banks nothing", () => {
  const w = world();
  const a = w.byId.get('a');
  const b = w.byId.get('b');
  clearSpot(w, a);
  put(w, 4, 900, 600);
  w.step(1 / 60);
  a.x = b.burrow.x + b.burrow.nx * 20;
  a.y = b.burrow.y + b.burrow.ny * 20;
  w.step(1 / 60);
  assert.equal(a.heap, 0);
  assert.equal(a.fill, FOODS[4].size);
});

test('overstuffed: every bite past full may pop; a pop sprays everything out and leaves you dizzy', () => {
  let pops = 0;
  let safe = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = world({ seed });
    const a = w.byId.get('a');
    clearSpot(w, a);
    a.cheeks[5] = 3; // 90
    a.fill = fillOf(a.cheeks);
    put(w, 4, 902, 600); // +18 = 108: a chance
    w.step(1 / 60);
    const ev = w.drain();
    if (ev.some((e) => e.k === 'pop')) {
      pops++;
      assert.equal(a.fill, 0);
      assert.equal(a.heap, 0);
      assert.ok(a.dizzyT > 0 && a.dizzyT <= POP.dizzy);
      const spilled = [...w.food.values()].filter((f) => f.id >= DYN);
      assert.equal(spilled.length, 4, 'the pieces fly out to be picked up');
      for (const f of spilled) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
    } else safe++;
  }
  assert.ok(pops > 3 && safe > 20, `a gamble, not a sure thing (${pops} pops in 60)`);
  // Past the max it always pops.
  const w = world();
  const a = w.byId.get('a');
  clearSpot(w, a);
  a.cheeks[5] = 4; // 120
  a.fill = fillOf(a.cheeks);
  put(w, 5, 902, 600); // 150 > MAX
  w.step(1 / 60);
  assert.ok(w.drain().some((e) => e.k === 'pop'));
  assert.ok(MAX < 150);
});

test('dizzy hamsters do not eat; at or under full nothing pops', () => {
  const w = world();
  const a = w.byId.get('a');
  clearSpot(w, a);
  a.dizzyT = 1;
  const nut = put(w, 1, 902, 600);
  w.step(1 / 60);
  assert.equal(a.fill, 0);
  assert.ok(w.food.has(nut.id), 'still there');
  w.removeFood(nut.id);
  a.dizzyT = 0;
  a.cheeks[5] = 3;
  a.fill = 90;
  put(w, 3, 902, 600); // exactly 100
  for (let i = 0; i < 3; i++) w.step(1 / 60);
  assert.equal(a.fill, CAP);
  assert.ok(!w.drain().some((e) => e.k === 'pop'));
});

test('bumps: a dash knocks food out of a rival, pops one past full; burrows and hit immunity protect', () => {
  const w = world();
  const a = w.byId.get('a');
  const b = w.byId.get('b');
  w.t = 10;
  clearSpot(w, b, 900, 600);
  b.cheeks[3] = 6; // 60
  b.fill = 60;
  a.x = 860;
  a.y = 600;
  a.input = { mx: 1, my: 0, dash: true };
  for (let i = 0; i < 20; i++) w.step(1 / 60);
  assert.ok(b.fill < 60, 'some food flew out');
  assert.ok(b.immuneT > 0, 'a moment of immunity after a hit');
  assert.ok(w.drain().some((e) => e.k === 'hit' && e.id === 'b' && e.by === 'a'));
  // Immune: a second dash right away does nothing.
  a.dashCd = 0;
  a.lastDash = false;
  a.x = b.x - 40;
  a.y = b.y;
  a.input = { mx: 1, my: 0, dash: true };
  for (let i = 0; i < 10; i++) w.step(1 / 60);
  assert.ok(!w.drain().some((e) => e.k === 'hit' && e.id === 'b'), 'no second hit while immune');
  // In its own porch a hamster is safe.
  b.immuneT = 0;
  b.x = b.burrow.x + b.burrow.nx * 20;
  b.y = b.burrow.y + b.burrow.ny * 20;
  b.cheeks = [0, 0, 0, 0, 0, 0, 0];
  b.fill = 0;
  assert.equal(w.hit(b, 'bump', 'a', 1, 0), false);
  assert.ok(Math.hypot(b.x - b.burrow.x, b.y - b.burrow.y) <= PORCH_R);
  // Past full, a hit pops.
  const w2 = world();
  const c = w2.byId.get('b');
  clearSpot(w2, c);
  c.cheeks[5] = 4;
  c.fill = 120;
  w2.t = 10;
  assert.equal(w2.hit(c, 'bump', 'a', 1, 0), true);
  assert.equal(c.fill, 0);
  assert.ok(w2.drain().some((e) => e.k === 'pop' && e.by === 'a'));
  assert.equal(w2.byId.get('a').stats.bullied, 1, 'the bumper gets the credit');
});

test('no bumps in the first seconds of a round', () => {
  const w = world();
  const a = w.byId.get('a');
  const b = w.byId.get('b');
  clearSpot(w, b, 900, 600);
  b.cheeks[3] = 6;
  b.fill = 60;
  a.x = 860;
  a.y = 600;
  a.input = { mx: 1, my: 0, dash: true };
  for (let i = 0; i < 20; i++) w.step(1 / 60);
  assert.ok(w.t < DASH.grace);
  assert.equal(b.fill, 60);
});

test('the buzzer: whatever is still in the cheeks is lost; heaps stay', () => {
  const w = world({ duration: 5 });
  const a = w.byId.get('a');
  const b = w.byId.get('b');
  a.heap = 120;
  a.cheeks[4] = 2;
  a.fill = 36;
  clearSpot(w, a);
  while (!w.over) w.step(1 / 60);
  assert.equal(a.heap, 120);
  assert.equal(a.fill, 0);
  const ev = w.drain();
  assert.ok(ev.some((e) => e.k === 'lost' && e.id === 'a' && e.worth === 36));
  assert.ok(ev.some((e) => e.k === 'end'));
  assert.equal(w.t, 5);
  b.heap = 120;
  const st = w.standings();
  assert.equal(st[0].place, 1);
  assert.equal(st[1].place, 1, 'ties share a place');
});

test('the golden seed: worth 60, fills 25', () => {
  const w = world();
  const a = w.byId.get('a');
  clearSpot(w, a);
  put(w, GOLDEN, 902, 600);
  w.step(1 / 60);
  assert.equal(a.fill, 25);
  a.x = a.burrow.x;
  a.y = a.burrow.y;
  w.step(1 / 60);
  assert.equal(a.heap, 60);
  assert.equal(a.stats.golden, 1);
});

test('a world that is not the authority asks instead of eating, and predicts its own knock', () => {
  const asked = [];
  const w = world({ authority: false, hooks: { touch: (h, f) => asked.push(['touch', h.id, f.id]), home: (h) => asked.push(['home', h.id]), hit: (h, k) => asked.push(['hit', h.id, k]) } });
  const a = w.byId.get('a');
  clearSpot(w, a);
  const f = put(w, 2, 903, 600);
  w.step(1 / 60);
  assert.deepEqual(asked[0], ['touch', 'a', f.id]);
  assert.equal(a.fill, 0, 'the cheeks are the host\'s to fill');
  w.t = 10;
  assert.equal(w.hit(a, 'bump', 'b', 1, 0), true);
  assert.ok(a.kbT > 0 && a.immuneT > 0, 'the knock shows at once');
  assert.deepEqual(asked.at(-1), ['hit', 'a', 'bump']);
});

test('the cat: the paw hits whoever stands in its band during the swat', () => {
  const s = createLocalSession({ arena: 7, seed: 'cat', me: { id: 'me', name: 'Me', coat: 0 }, bots: [], intro: 0 });
  const w = s.w;
  const me = w.byId.get('me');
  const sweep = w.sched.sweeps[0];
  assert.ok(sweep, 'the cat comes');
  while (w.t < sweep.swat - 0.05) w.step(1 / 60);
  me.x = sweep.px;
  me.y = sweep.py;
  me.cheeks[3] = 4;
  me.fill = 40;
  while (w.t < sweep.end + 0.1) w.step(1 / 60);
  const ev = w.drain();
  assert.ok(ev.some((e) => e.k === 'hit' && e.kind === 'paw' && e.id === 'me'), 'swatted');
  assert.ok(me.fill < 40);
});

test('the practice blanket refills and never ends', () => {
  const s = createLocalSession({ arena: 0, seed: 'practice:0', me: { id: 'me', name: 'Me', coat: 0 }, bots: [], practice: true, intro: 0 });
  const w = s.w;
  const me = w.byId.get('me');
  const start = w.food.size;
  // Eat a lot.
  let k = 0;
  for (const f of [...w.food.values()]) {
    if (k++ > start * 0.5) break;
    w.removeFood(f.id);
  }
  for (let i = 0; i < 60 * 30; i++) s.step(1 / 60, () => ({ mx: 0, my: 0, dash: false }));
  assert.equal(w.duration, Infinity);
  assert.equal(s.phase, 'round');
  assert.ok(w.food.size > start * 0.6, `food comes back (${w.food.size} of ${start})`);
  assert.equal(w.sched.sweeps.length, 0, 'no cat in practice');
  assert.equal(me.heap, 0);
});

test('a round lasts its time and the schedule fills it', () => {
  const s = createLocalSession({ arena: 0, seed: 'len', me: null, bots: [{ name: 'Gus' }, { name: 'Bea' }], intro: 0 });
  let n = 0;
  while (s.phase !== 'end' && n++ < 60 * 200) s.step(1 / 60);
  assert.equal(s.phase, 'end');
  assert.ok(Math.abs(s.w.t - ROUND.seconds) < 1e-6);
});
