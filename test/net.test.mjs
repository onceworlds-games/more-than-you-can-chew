// Whole matches between pages through a room in one process: the host's record, predicted bites and banks, bumps with lag,
// a host who reloads or leaves, and a latecomer. Bots drive every hamster, players' too.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hub, haveSdk, loadHelpers } from './hub.mjs';
import { createOnline, readSnapshot, readPresence, packBits, unpackBits } from '../game/net.js';
import { createBrain } from '../game/brain.js';
import { arenaById } from '../game/arenas.js';

const skip = !haveSdk && 'the SDK helpers (OW_SDK_DIST) are not available';
const flush = () => new Promise((r) => setImmediate(r));
const DROP = new Set(['bank', 'pop', 'hit', 'lost']);

async function setup(settings, lag = 0) {
  mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'], now: 1_000_000 });
  const h = await loadHelpers();
  return { hub: new Hub(settings, lag), h };
}

/** A page: its room, its game, and a bot brain moving its own hamster. */
function page(hub, h, id, o = {}) {
  const room = o.reload ? hub.reload(id) : hub.join(id);
  const p = { id, room, events: [], skill: o.skill ?? 0.7, brain: null, brainWorld: null, undo: 0, undoBy: [], lastFill: 0, lastDrop: -1e9, steer: o.steer || null };
  p.game = createOnline(room, h, { now: () => Date.now(), coat: () => 1, onEvent: (e) => p.events.push(e) });
  return p;
}

function inputFor(p) {
  return () => {
    const w = p.game.world;
    const me = w && w.byId.get(p.id);
    if (!me) return { mx: 0, my: 0, dash: false };
    if (p.steer) return p.steer(w, me);
    if (p.brainWorld !== w) {
      p.brain = createBrain(me, w, { skill: p.skill, kind: 'plain', seed: p.id });
      p.brainWorld = w;
    }
    return p.brain.think(w, me, 1 / 60);
  };
}

/** One page's animation frame, watching its own cheeks: a drop with no bank, pop, hit or buzzer is a bite undone. */
function frame(p) {
  if (p.room.closed) return;
  p.events.length = 0;
  const out = p.game.frame(0.05, inputFor(p));
  const w = p.game.world;
  const me = w && p.game.me ? w.byId.get(p.game.me) : null;
  if (!me || p.game.match.phase !== 'round') {
    p.lastFill = me ? me.fill : 0;
    return;
  }
  const now = Date.now();
  if ([...out, ...p.events].some((e) => e.id === p.id && DROP.has(e.k))) p.lastDrop = now;
  if (me.fill < p.lastFill - 0.5 && now - p.lastDrop > 1500) {
    p.undo++;
    p.undoBy.push(`${(w.t).toFixed(1)}s ${p.lastFill}->${me.fill}`);
  }
  p.lastFill = me.fill;
  for (const h of w.hams) assert.ok(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.fill), `${h.name} is a number`);
}

async function run(pages, ms) {
  for (let t = 0; t < ms; t += 50) {
    mock.timers.tick(50);
    await flush();
    for (const p of pages) frame(p);
    await flush();
  }
}

async function until(pages, fn, ms = 400000) {
  for (let t = 0; t < ms; t += 50) {
    if (fn()) return true;
    await run(pages, 50);
  }
  return fn();
}

const roundSecs = (p) => (p.game.match.phase === 'round' ? p.game.world?.t ?? 0 : 0);

test('what the room carries is checked', () => {
  const arena = arenaById(0);
  assert.equal(readPresence(null), null);
  assert.equal(readPresence({ x: 'a', y: 1 }), null);
  const p = readPresence({ k: 'p', r: 1, x: 99999, y: -5, a: 1, f: 999, c: 99, s: 255 }, arena);
  assert.equal(p.x, arena.w);
  assert.equal(p.y, 0);
  assert.equal(p.f, 160);
  assert.ok(p.c < 20 && p.s < 32);
  assert.equal(readSnapshot({ r: 5 }), null);
  const s = readSnapshot({ r: 'm1:1', t: 3, g: '', d: [[5, 1, 1, 1, 1], [20000, 99, 1, 1, 1], [20001, 2, 10, 10, 100]], ch: [[1, 2, 3]], hp: [-4, 'x'], ev: [[1, 2, 3, 'x']] });
  assert.deepEqual(s.d.map((e) => e[0]), [20001], 'only real spills');
  assert.equal(s.ch[0].length, 7, 'bad cheeks read as empty');
  assert.deepEqual(s.hp, [0, 0]);
  assert.equal(s.ev.length, 0);
  const bits = new Uint8Array(37);
  bits[0] = bits[9] = bits[36] = 1;
  assert.deepEqual([...unpackBits(packBits(bits), 37)], [...bits]);
  assert.equal(unpackBits('%%%not base64', 10).length, 10);
});

test('alone with the bots: a whole match, heaps scored by the host, back to the lobby', { skip }, async (t) => {
  const { hub, h } = await setup({ rounds: 1 });
  t.after(() => mock.timers.reset());
  const me = page(hub, h, 'p1');
  const pages = [me];
  me.room.startMatch();
  let heaps = null;
  let trips = 0;
  const ok = await until(pages, () => {
    const m = me.game.match;
    if (m.phase === 'roundEnd' && !heaps) {
      heaps = Object.fromEntries(me.game.world.hams.map((x) => [x.id, x.heap]));
      trips = me.game.world.byId.get('p1').stats.trips;
    }
    return m.phase === 'results';
  });
  assert.ok(ok, 'the match ends');
  const m = me.game.match;
  assert.equal(m.seats.length, 8);
  assert.equal(m.seats.filter((s) => s.bot).length, 7);
  assert.equal(m.results.length, 8);
  for (const s of m.results) assert.equal(s.points, heaps[s.id], `${s.name}: the round's heap is the score`);
  assert.ok(heaps.p1 > 150, `the player banked (${heaps.p1})`);
  assert.ok(Object.values(heaps).filter((x) => x > 0).length >= 6, 'the bots play');
  assert.ok(trips >= 3, `trips home (${trips})`);
  await until(pages, () => me.room.match.phase === 'lobby', 60000);
  assert.equal(me.room.match.phase, 'lobby', 'back to the lobby after the podium');
});

test('two players with lag: my bites show at once and stay; the host agrees on my heap', { skip }, async (t) => {
  const { hub, h } = await setup({ rounds: 1 }, 120);
  t.after(() => mock.timers.reset());
  const a = page(hub, h, 'a');
  const b = page(hub, h, 'b');
  const pages = [a, b];
  b.room.setReady(true);
  a.room.startMatch();
  let predicted = 0;
  let mineAtEnd = null;
  const ok = await until(pages, () => {
    const m = b.game.match;
    if (m.phase === 'round' && b.game.world) predicted = Math.max(predicted, b.game.world.byId.get('b').stats.eaten);
    if (m.phase === 'roundEnd' && !mineAtEnd) mineAtEnd = b.game.roundStats();
    return m.phase === 'results';
  });
  assert.ok(ok, 'the match ends');
  const st = b.game.stats;
  t.diagnostic(`client bites: claims lost ${st.claimsLost}, rejected ${st.claimsRejected}; cheeks undone ${b.undo} ${b.undoBy.slice(0, 5).join(', ')}`);
  t.diagnostic(`bumps on the client (bots and a): taken ${st.bumpsTaken}, refused ${st.bumpsRefused}`);
  assert.ok(st.bumpsRefused <= Math.max(1, (st.bumpsTaken + st.bumpsRefused) * 0.15), 'few visible hits do nothing');
  assert.ok(st.claimsLost + st.claimsRejected <= 2, 'the host takes nearly every bite I saw');
  assert.ok(b.undo <= 1, `a bite never visibly undoes (${b.undoBy.join(', ')})`);
  const hostSays = a.game.match.results.find((s) => s.id === 'b').points;
  assert.equal(mineAtEnd.heap, hostSays, 'my heap is the host\'s');
  assert.ok(hostSays > 150, `the client banked (${hostSays})`);
  assert.ok(st.banks >= 3);
});

test('bumps with lag: the target takes nearly every hit the dasher saw', { skip }, async (t) => {
  const { hub, h } = await setup({ rounds: 1, bots: 'off' }, 120);
  t.after(() => mock.timers.reset());
  // a hunts b: runs at where it sees b and dashes when close. b just eats.
  const hunt = (w, me) => {
    const b = w.byId.get('b');
    if (!b) return { mx: 0, my: 0, dash: false };
    const dx = b.x - me.x;
    const dy = b.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    return { mx: dx / d, my: dy / d, dash: d < 95 && me.dashCd <= 0 && w.t > 3 };
  };
  const a = page(hub, h, 'a', { steer: hunt });
  const b = page(hub, h, 'b');
  const pages = [a, b];
  b.room.setReady(true);
  a.room.startMatch();
  await until(pages, () => roundSecs(a) > 70);
  const sent = a.game.stats.bumpsSent;
  const taken = b.game.stats.bumpsTaken;
  const refused = b.game.stats.bumpsRefused;
  t.diagnostic(`a's bumps on b: sent ${sent}, taken ${taken}, refused ${refused} (a visible hit that did nothing: ${((refused / Math.max(1, sent)) * 100).toFixed(0)}%)`);
  assert.ok(sent >= 8, `a caught b often (${sent})`);
  assert.ok(refused <= sent * 0.15, 'few refused');
  assert.ok(taken >= sent * 0.6, 'most land (the rest hit an immune or home hamster)');
});

test('the host reloads, then leaves, mid-round: the round carries on, heaps and food intact', { skip }, async (t) => {
  const { hub, h } = await setup({ rounds: 1 }, 60);
  t.after(() => mock.timers.reset());
  let a = page(hub, h, 'a');
  const b = page(hub, h, 'b');
  let pages = [a, b];
  b.room.setReady(true);
  a.room.startMatch();
  await until(pages, () => roundSecs(b) > 50);
  const before = { heap: b.game.world.byId.get('b').heap, food: b.game.world.food.size, aHeap: b.game.world.byId.get('a').heap };
  // The host reloads: the role moves to b, then a comes back on a new page.
  a.game.dispose();
  hub.drop('a');
  await run([b], 300);
  assert.equal(hub.host, 'b');
  a = page(hub, h, 'a', { reload: true });
  hub.back('a');
  pages = [a, b];
  await run(pages, 2000);
  const w = b.game.world;
  assert.ok(w.authority, 'b decides now');
  assert.ok(w.byId.get('b').heap >= before.heap, 'my heap kept');
  assert.ok(w.byId.get('a').heap >= before.aHeap, "a's heap kept");
  assert.ok(Math.abs(w.food.size - before.food) < 60, `the food on the blanket carries over (${before.food} -> ${w.food.size})`);
  assert.ok(a.game.world && a.game.world.byId.get('a') && !a.game.world.byId.get('a').remote, 'the reloaded page plays its hamster again');
  // Then a leaves for good.
  await until(pages, () => roundSecs(b) > 90);
  const aHeap = w.byId.get('a').heap;
  a.room.leave();
  pages = [b];
  const ok = await until(pages, () => b.game.match.phase === 'results');
  assert.ok(ok, 'the round ends without them');
  const res = b.game.match.results;
  assert.ok(res.find((s) => s.id === 'a').points >= aHeap, 'a leaver keeps their heap in the standings');
  assert.ok(res.find((s) => s.id === 'b').points > before.heap);
});

test('a latecomer watches with a label, then plays the next round', { skip }, async (t) => {
  const { hub, h } = await setup({ rounds: 3 });
  t.after(() => mock.timers.reset());
  const a = page(hub, h, 'a');
  a.room.startMatch();
  let pages = [a];
  await until(pages, () => roundSecs(a) > 20);
  const late = page(hub, h, 'late');
  pages = [a, late];
  await run(pages, 1000);
  assert.equal(late.room.spectating, true);
  assert.equal(late.game.me, null, 'no hamster while watching');
  assert.ok(late.game.world, 'but the round shows');
  assert.equal(hub.players.get('late').presence.k, 'w');
  const ok = await until(pages, () => a.game.match.round === 2 && a.game.match.phase === 'round' && roundSecs(a) > 5);
  assert.ok(ok);
  assert.ok(a.game.match.seats.some((s) => s.id === 'late'), 'seated next round');
  assert.equal(a.game.match.seats.length, 8, 'in a bot\'s seat');
  assert.equal(late.game.me, 'late');
  const mine = late.game.world.byId.get('late');
  assert.ok(mine && !mine.remote, 'and plays');
});
