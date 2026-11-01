import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProfile, cleanProfile, finishRound, todaysGoals, liveStreak, picnicOpen, earnedKeys, BADGES, HOARDER } from '../src/profile.js';
import { HAT_LIST, POPS, TRACK, TRAILS, MAX_LEVEL, levelCost, levelOf, roundXp, itemUnlocked, picnicStars, starCount, goalsFor, goalDef, GOALS, GOAL_XP, encodeOutfit, decodeOutfit, BOT_OUTFITS, CROWN_STARS, PICNIC_GOALS } from '../src/wardrobe.js';
import { BOTS } from '../src/sim/config.js';

const round = (o = {}) => ({ heap: 1100, trips: 9, pops: 1, popsByBump: 0, golden: 0, bestTrip: 90, lastBankLeft: 20, stuffed: 1, bursting: 0, bestChain: 3, bestBank: 180, specials: 0, spice: 0, bumps: 2, swatted: 0, place: 3, players: 8, ...o });

test('levels: each costs a little more than the last, totals map back to a level, the top is capped', () => {
  assert.deepEqual(levelOf(0), { level: 1, into: 0, need: 120 });
  assert.equal(levelOf(119).level, 1);
  assert.equal(levelOf(120).level, 2);
  assert.equal(levelOf(120 + 160).level, 3);
  for (let n = 2; n < MAX_LEVEL; n++) assert.ok(levelCost(n) > levelCost(n - 1));
  let last = 0;
  for (let xp = 0; xp < 200000; xp += 997) {
    const l = levelOf(xp).level;
    assert.ok(l >= last);
    last = l;
  }
  assert.equal(levelOf(1e9).level, MAX_LEVEL);
  assert.equal(levelOf(-50).level, 1);
  assert.equal(levelOf(NaN).level, 1);
});

test('the track: every reward is a real item, every item but the crown and the defaults is on it once', () => {
  const lists = { hat: HAT_LIST, pop: POPS, trail: TRAILS };
  const seen = new Set();
  for (const [lv, r] of Object.entries(TRACK)) {
    assert.ok(Number(lv) >= 2 && Number(lv) <= MAX_LEVEL);
    assert.ok(lists[r.kind].some((x) => x.id === r.id), `${r.kind}:${r.id} exists`);
    assert.ok(!seen.has(`${r.kind}:${r.id}`), `${r.kind}:${r.id} once`);
    seen.add(`${r.kind}:${r.id}`);
  }
  for (const h of HAT_LIST) if (h.id !== 'crown') assert.ok(seen.has(`hat:${h.id}`), `hat ${h.id} is earned somewhere`);
  for (const x of POPS) if (x.id !== 'crumbs') assert.ok(seen.has(`pop:${x.id}`));
  for (const x of TRAILS) if (x.id !== 'dust') assert.ok(seen.has(`trail:${x.id}`));
  const p = freshProfile();
  assert.ok(itemUnlocked(p, 'pop', 'crumbs') && itemUnlocked(p, 'trail', 'dust'));
  assert.ok(!itemUnlocked(p, 'hat', 'party'));
  p.xp = 120;
  assert.ok(itemUnlocked(p, 'hat', 'party'));
  assert.ok(!itemUnlocked(p, 'hat', 'crown'));
});

test('pacing: an ordinary round is worth a level early on; level 10 takes a couple of evenings, the track weeks', () => {
  const typical = roundXp(round()).reduce((a, l) => a + l.xp, 0);
  assert.ok(typical >= 120 && typical <= 320, `typical round ${typical} XP`);
  const good = roundXp(round({ heap: 1800, place: 1, stuffed: 3, bursting: 1, bestChain: 8, golden: 2 })).reduce((a, l) => a + l.xp, 0);
  assert.ok(good > typical * 1.6, 'playing well pays clearly more');
  const toLevel = (n) => {
    let xp = 0;
    for (let l = 1; l < n; l++) xp += levelCost(l);
    return xp;
  };
  const rounds10 = toLevel(10) / typical;
  assert.ok(rounds10 >= 8 && rounds10 <= 25, `level 10 in ${rounds10.toFixed(1)} typical rounds`);
  const last = Math.max(...Object.keys(TRACK).map(Number));
  assert.ok(toLevel(last) / typical > 60, 'the whole track is a long-term goal');
  assert.equal(roundXp(round({ players: 1, place: 1 })).some((l) => l.text === 'Won!'), false, 'no place XP alone');
});

test('outfits: what you wear travels as one small number and comes back the same; junk is the plain outfit', () => {
  for (const h of ['', ...HAT_LIST.map((x) => x.id)])
    for (const p of POPS)
      for (const t of TRAILS) {
        const o = { hat: h, pop: p.id, trail: t.id };
        const c = encodeOutfit(o);
        assert.ok(Number.isInteger(c) && c >= 0 && c < 1024);
        assert.deepEqual(decodeOutfit(c), o);
      }
  const plain = { hat: '', pop: 'crumbs', trail: 'dust' };
  for (const junk of [-1, 1.5, 'x', null, undefined, 99999, {}]) assert.deepEqual(decodeOutfit(junk), plain);
  assert.deepEqual(decodeOutfit(encodeOutfit({ hat: 'nope', pop: 'nope', trail: 'nope' })), plain);
  for (const b of BOTS) assert.ok(BOT_OUTFITS[b.name], `${b.name} is dressed`);
});

test('daily goals: three different ones, the same for everyone on a day, others another day', () => {
  const days = [20000, 20001, 20002, 20003, 20100];
  const seen = new Set();
  for (const d of days) {
    const g = goalsFor(d);
    assert.equal(g.length, 3);
    assert.equal(new Set(g.map((x) => x.id)).size, 3);
    for (const x of g) assert.ok(GOALS.some((d2) => d2.id === x.id));
    assert.deepEqual(goalsFor(d), g);
    seen.add(g.map((x) => x.id).join());
  }
  assert.ok(seen.size >= 3, 'goals change from day to day');
});

test('a Picnic win: XP, the first stars, the next Picnic opens, badges for what happened', () => {
  const p = freshProfile();
  const out = finishRound(p, round({ place: 1, pops: 0, heap: 1000 }), { mode: 'picnic', n: 0, day: 20000 });
  assert.ok(out.xpTotal > 0 && p.xp === out.xpTotal);
  assert.ok(out.after.level >= 2, 'the first win is worth a level');
  assert.ok(out.rewards.some((r) => r.kind === 'hat' && r.id === 'party'), 'and the first hat');
  assert.deepEqual(p.picnics.stars[0], [true, true, true]);
  assert.deepEqual(out.stars.fresh, [true, true, true]);
  assert.ok(p.picnics.won[0] && picnicOpen(p, 1) && !picnicOpen(p, 2));
  assert.ok(out.lines.some((l) => /Picnic 2 is open/.test(l.text)));
  for (const b of ['first-bite', 'stuffed', 'clean-plate']) assert.ok(out.badges.includes(b), b);
  assert.ok(!out.badges.includes('pop'));
  for (const b of out.badges) assert.ok(BADGES.includes(b));
  // The same stars again are not new, and pay nothing more.
  const again = finishRound(p, round({ place: 1, pops: 0, heap: 1000 }), { mode: 'picnic', n: 0, day: 20000 });
  assert.deepEqual(again.stars.fresh, [false, false, false]);
  assert.ok(!again.xp.some((l) => /star/.test(l.text)));
});

test('stars: win, the heap goal and the challenge are separate; all 24 earn the crown and a badge', () => {
  assert.deepEqual(picnicStars(0, round({ place: 2, heap: 950, stuffed: 0, bursting: 0 })), [false, true, false]);
  assert.deepEqual(picnicStars(2, round({ place: 1, heap: 500, pops: 0 })), [true, false, true]);
  assert.equal(PICNIC_GOALS.length, 8);
  const p = freshProfile();
  for (let n = 0; n < 8; n++) p.picnics.stars[n] = [true, true, true];
  p.picnics.won = p.picnics.won.map(() => true);
  assert.equal(starCount(p), CROWN_STARS);
  assert.ok(itemUnlocked(p, 'hat', 'crown'));
  p.picnics.stars[7] = [true, true, false];
  const out = finishRound(p, round({ place: 1, heap: 1700, swatted: 0 }), { mode: 'picnic', n: 7, day: 20000 });
  assert.ok(out.badges.includes('picnic-season') && out.badges.includes('three-star'));
  assert.ok(out.rewards.some((r) => r.kind === 'hat' && r.id === 'crown'), 'the crown shows as a reward');
});

test('the Daily streak: a day in a row adds one, a missed day starts over, seven earns the badge; once a day', () => {
  const p = freshProfile();
  let out;
  for (let d = 0; d < 7; d++) out = finishRound(p, round(), { mode: 'daily', day: 30000 + d });
  assert.equal(p.daily.streak, 7);
  assert.ok(out.badges.includes('week-streak'));
  assert.ok(out.xp.some((l) => /Day streak 7/.test(l.text)));
  const again = finishRound(p, round(), { mode: 'daily', day: 30006 });
  assert.equal(p.daily.streak, 7, 'a second Daily the same day does not count');
  assert.ok(!again.xp.some((l) => /Day streak/.test(l.text)));
  assert.equal(liveStreak(p, 30007), 7);
  assert.equal(liveStreak(p, 30009), 0, 'a missed day shows as broken');
  finishRound(p, round(), { mode: 'daily', day: 30009 });
  assert.equal(p.daily.streak, 1);
  assert.equal(p.daily.bestStreak, 7);
});

test('daily goals fill across rounds in any mode and pay once', () => {
  const p = freshProfile();
  const day = 20000;
  const goals = todaysGoals(p, day);
  // A round that does a lot of everything.
  const big = round({ heap: 2100, trips: 16, stuffed: 4, bursting: 2, bestChain: 9, golden: 3, specials: 5, bumps: 7, place: 1, pops: 0 });
  const out = finishRound(p, big, { mode: 'quick', day });
  assert.ok(out.goals.every((g) => g.done && g.fresh));
  assert.equal(out.xp.filter((l) => l.text === 'Daily goal').length, 3);
  assert.ok(out.xp.filter((l) => l.text === 'Daily goal').every((l) => l.xp === GOAL_XP));
  const out2 = finishRound(p, big, { mode: 'quick', day });
  assert.ok(out2.goals.every((g) => g.done && !g.fresh));
  assert.equal(out2.xp.filter((l) => l.text === 'Daily goal').length, 0);
  // Counting goals add up over rounds; best-of goals don't.
  const q = freshProfile();
  q.daily.goalsDay = day;
  q.daily.goals = [{ id: 'trips', have: 0, done: false }, { id: 'chain', have: 0, done: false }, { id: 'bumps', have: 0, done: false }];
  finishRound(q, round({ trips: 8, bestChain: 4, bumps: 3 }), { mode: 'quick', day });
  finishRound(q, round({ trips: 8, bestChain: 5, bumps: 3 }), { mode: 'quick', day });
  const byId = Object.fromEntries(q.daily.goals.map((g) => [g.id, g]));
  assert.equal(byId.trips.have, 16);
  assert.ok(byId.trips.done && goalDef('trips').n <= 16);
  assert.equal(byId.chain.have, 5);
  assert.ok(!byId.chain.done);
  assert.equal(byId.bumps.have, 6);
  assert.ok(byId.bumps.done);
  // A new day brings new goals.
  todaysGoals(q, day + 1);
  assert.equal(q.daily.goalsDay, day + 1);
  assert.ok(q.daily.goals.every((g) => !g.done && g.have === 0));
});

test('badges for feats: hoarder, gobbler, bully, buzzer beater, spice rack, well fed', () => {
  const p = freshProfile();
  const out = finishRound(p, round({ heap: HOARDER, bestChain: 8, popsByBump: 1, lastBankLeft: 2, spice: 7, bursting: 1 }), { mode: 'quick', day: 20000 });
  for (const b of ['hoarder', 'gobbler', 'bully', 'buzzer-beater', 'spice-rack', 'bursting', 'stuffed']) assert.ok(out.badges.includes(b), b);
  const none = finishRound(freshProfile(), round({ heap: HOARDER - 1, bestChain: 7, spice: 3, lastBankLeft: null }), { mode: 'quick', day: 20000 });
  for (const b of ['hoarder', 'gobbler', 'spice-rack', 'buzzer-beater']) assert.ok(!none.badges.includes(b), b);
  const q = freshProfile();
  q.xp = 2600;
  assert.ok(finishRound(q, round(), { mode: 'quick', day: 20000 }).badges.includes('well-fed'));
});

test('a saved profile is checked field by field; locked things come off, earned ones stay', () => {
  assert.deepEqual(cleanProfile(null), freshProfile());
  assert.deepEqual(cleanProfile('junk'), freshProfile());
  const p = cleanProfile({ xp: -5, coat: 999, hat: 'tophat', pop: 'fireworks', trail: 'nope', picnics: { won: [true, 'x'], stars: [[false, true]] }, daily: { streak: 3, lastDay: 5, goals: [{ id: 'zzz', have: -2 }] }, seen: [1, 'hat:party'] });
  assert.equal(p.xp, 0);
  assert.equal(p.coat, 0);
  assert.equal(p.hat, '', 'a hat not earned comes off');
  assert.equal(p.pop, 'crumbs');
  assert.equal(p.trail, 'dust');
  assert.deepEqual(p.picnics.won.slice(0, 2), [true, true]);
  assert.deepEqual(p.picnics.stars[0], [true, true, false], 'an old win keeps its first star');
  assert.equal(p.daily.goals[0].id, GOALS[0].id);
  assert.equal(p.daily.goals[0].have, 0);
  assert.deepEqual(p.seen, ['hat:party']);
  const rich = cleanProfile({ xp: 1e7, hat: 'tophat', pop: 'fireworks', trail: 'rainbow' });
  assert.equal(rich.hat, 'tophat');
  assert.equal(rich.pop, 'fireworks');
  assert.equal(rich.trail, 'rainbow');
  assert.ok(earnedKeys(rich).includes('hat:tophat'));
  assert.ok(!earnedKeys(rich).includes('hat:crown'));
});
