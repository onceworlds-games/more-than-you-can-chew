// More Than You Can Chew: the page. Joins the room first, then runs one of four worlds (the title's attract mode, the
// lobby's practice blanket, a solo Picnic or Daily, or the online round), draws it in 3D with the HUD over it, and keeps
// the profile: XP, the wardrobe, stars, Daily goals and the streak.

import { createWorld3d } from './render/world3d.js';
import { U } from './render/stage.js';
import { loadsPending } from './render/assets.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUi } from './ui.js';
import { createStore, finishRound, coatUnlocked, coatCondition, picnicOpen, dayNumber, dailyArena, dailyScore, todaysGoals, liveStreak, earnedKeys } from './profile.js';
import { HAT_LIST, POPS, TRAILS, levelOf, itemUnlocked, itemCondition, starCount, PICNIC_GOALS, PICNIC_SPECIALS, goalDef, BOT_OUTFITS, encodeOutfit, dressHam, CROWN_STARS } from './wardrobe.js';
import { createLocalSession, attractBots } from './session.js';
import { createOnline, JOIN, readSettings, readPresence } from './net.js';
import { createBrain } from './sim/brain.js';
import { ARENAS, arenaById } from './sim/arenas.js';
import { BOTS, LADDER_SKILL, DIFFICULTY, COATS, FOODS, GOLDEN, CAP, MAX, ROUND, POP, TIERS } from './sim/config.js';

const params = new URLSearchParams(location.search);
async function importHelpers() {
  try {
    // The platform serves these next to the game (not part of the build).
    const at = (name) => import(/* @vite-ignore */ `${location.origin}/__onceworlds/v1/${name}.js`);
    const [m, h, b] = await Promise.all([at('match'), at('host'), at('bots')]);
    return { createMatch: m.createMatch, createHost: h.createHost, createBots: b.createBots, t: h.t };
  } catch {
    return null;
  }
}

const withTimeout = (p, ms, fallback = null) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const turnTo = (a, b, k) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
};
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Crumb colours per food type.
const CRUMBS = [
  ['#2E2A29', '#E9E1D3'],
  ['#B5733A', '#E8B77A'],
  ['#4A5FB8', '#2E3B80'],
  ['#E8B35C', '#F6D9A0'],
  ['#E33A3A', '#FFD34D'],
  ['#C98A4B', '#4A2A18'],
  ['#FFC928', '#FFF6C2'],
  ['#E8321E', '#5BA332'],
  ['#FF7EC0', '#FFD1E8'],
  ['#3B2A22', '#7A5A44'],
];
const POP_STYLE = {
  crumbs: { colors: ['#FF4D6D', '#FFF2D9', '#E3A24F', '#FFCB2E'], glow: '#fff2c0' },
  confetti: { colors: ['#FF4D6D', '#3FA7F2', '#FFCB2E', '#2DC38A', '#9A5BEA'], glow: '#ffffff', confetti: true },
  hearts: { colors: ['#FF6FB0', '#FF9AC8', '#FFD1E8', '#FF4D6D'], glow: '#ffb3d6', sparkle: '#ff6fb0' },
  stars: { colors: ['#FFCB2E', '#FFE680', '#FFF6C2'], glow: '#ffe680', sparkle: '#ffe680' },
  bubbles: { colors: ['#BFE8FF', '#FFFFFF', '#9AD8F7'], glow: '#d8f2ff', bubbles: true },
  fireworks: { colors: ['#FF4D6D', '#FFCB2E', '#3FA7F2', '#9BD13A'], glow: '#ffffff', fireworks: true },
};

export async function boot() {
  const ow = window.onceworlds || null;
  const dev = !/onceworldsusercontent\.com$/.test(location.hostname);
  const autoplay = dev && params.get('autoplay') === '1';
  // Join first, before anything is built, so a reload keeps its seat.
  const joinRoom = () => (ow && ow.rooms && ow.rooms.join ? Promise.resolve(ow.rooms.join(JOIN)).catch(() => null) : Promise.resolve(null));
  let joining = joinRoom();
  const helpersP = importHelpers();

  const canvas = document.getElementById('game');
  const hudCanvas = document.getElementById('hud');
  const world = createWorld3d(canvas);
  const fx = world.fx;
  const hud = createHud(hudCanvas, world);
  const input = createInput(canvas, world, ow);
  const audio = createAudio();
  const store = createStore(ow);
  try {
    if (ow && ow.ui && ow.ui.setLook) ow.ui.setLook({ accent: '#FFCB2E', panel: '#3B2218', text: '#FFF2D9' });
  } catch {
    /* outside the platform */
  }

  const S = {
    screen: 'lobby',
    attract: null,
    practice: null,
    practiceKey: '',
    solo: null,
    soloInfo: null,
    soloResult: null,
    net: null,
    sheet: null,
    plate: null,
    paused: false,
    closed: null,
    hint: null,
    big: null,
    phaseSeen: '',
    endSeen: '',
    watch: null,
    ateAt: 0,
    daily: { top: [], rank: null },
    matchPops: 0,
    matchLines: [],
    matchSummary: null,
    pick: 0,
    tab: 'hat',
    camTarget: null,
    lastSec: -1,
    autoBrain: null,
    netEvents: [],
    slow: 0,
    stop: 0,
    endFocus: null,
  };
  const P = () => store.p;
  let reduced = false;

  // ------------------------------------------------------------------ sizing, quality, reserved areas

  let reserved = null;
  const pixelRatio = () => {
    try {
      if (ow && ow.settings && ow.settings.pixelRatio) return ow.settings.pixelRatio(2);
    } catch {
      /* fall through */
    }
    return Math.min(2, window.devicePixelRatio || 1);
  };
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const r = pixelRatio();
    world.resize(w, h, r);
    hud.resize(w, h, Math.min(2, r));
    document.body.classList.toggle('portrait', h > w * 1.1 && w < 700);
    document.body.classList.toggle('short', h < 560);
  }
  const quality = () => {
    const q = params.get('q') || (ow && ow.settings && ow.settings.quality) || 'high';
    return ['low', 'medium', 'high'].includes(q) ? q : 'high';
  };
  world.setQuality(quality());
  resize();
  window.addEventListener('resize', resize);
  try {
    if (ow && ow.ui) {
      reserved = ow.ui.reserved || null;
      // The screens end above the platform's strip while it's up.
      const strip = () => {
        const r = (reserved || []).find((x) => x.kind === 'lobby');
        document.documentElement.style.setProperty('--strip', `${r ? Math.max(0, innerHeight - r.y) : 0}px`);
      };
      strip();
      ow.on('reserved', (r) => {
        reserved = r;
        strip();
      });
      addEventListener('resize', strip);
    }
    if (ow && ow.settings && ow.settings.on) {
      reduced = !!ow.settings.reducedMotion;
      world.setReduced(reduced);
      ow.settings.on('change', (s) => {
        reduced = !!(s && s.reducedMotion);
        world.setReduced(reduced);
        world.setQuality(quality());
        resize();
      });
    }
  } catch {
    /* outside the platform */
  }
  const reservedList = () => (Array.isArray(reserved) ? reserved : [{ kind: 'menu', x: 0, y: 0, w: 150, h: 70 }]);
  const cardWidth = () => (document.body.classList.contains('short') ? Math.min(620, world.vw - 170) : 360);
  const clearTop = (left) => {
    let t = 12;
    for (const r of reservedList()) if (r.x + r.w > left && r.y < 140) t = Math.max(t, r.y + r.h + 10);
    return t;
  };
  const menuBottom = () => {
    let b = 0;
    for (const r of reservedList()) if (r.kind === 'menu' && r.y < 120) b = Math.max(b, r.y + r.h);
    return b;
  };

  // ------------------------------------------------------------------ what everyone wears

  const myOutfit = () => ({ hat: P().hat, pop: P().pop, trail: P().trail });
  function dress(w) {
    for (const h of w.hams) {
      if (h.id === 'me') dressHam(h, myOutfit());
      else if (h.bot) dressHam(h, BOT_OUTFITS[String(h.name).replace(/ \d+$/, '')]);
    }
  }

  // ------------------------------------------------------------------ the screens

  const handlers = {
    press: (act) => {
      audio.unlock();
      if (act === 'noop' || act === 'closeSheet') return;
      audio.play(['arena', 'rounds', 'bots', 'plate', 'tab', 'wear'].includes(act) ? 'soft' : 'crunch');
    },
    arena: (d) => {
      const s = settings();
      const open = ARENAS.map((a) => a.id).filter((i) => picnicOpen(P(), i));
      const k = open.indexOf(s.arena);
      const next = open[(k + Number(d) + open.length) % open.length];
      if (S.net) S.net.setSetting('arena', next);
      else localSettings.arena = next;
    },
    rounds: (n) => (S.net ? S.net.setSetting('rounds', Number(n)) : (localSettings.rounds = Number(n))),
    bots: (b) => (S.net ? S.net.setSetting('bots', b) : (localSettings.bots = b)),
    sheet: (name) => (S.sheet = name),
    closeSheet: () => (S.sheet = null),
    invite: () => {
      try {
        ow.ui.showInvite();
      } catch {
        /* outside the platform */
      }
    },
    wardrobe: () => {
      S.screen = 'wardrobe';
      S.sheet = null;
    },
    tab: (t) => (S.tab = t),
    wear: (arg) => wear(arg),
    picnics: () => {
      S.screen = 'picnics';
      S.plate = firstOpenPlate();
    },
    daily: () => {
      S.screen = 'daily';
      loadDaily();
    },
    plate: (i) => (S.plate = Number(i)),
    playPicnic: (i) => startSolo({ kind: 'picnic', n: Number(i) }),
    playDaily: () => startSolo({ kind: 'daily' }),
    quick: () => startSolo({ kind: 'quick' }),
    lobby: () => backToLobby(),
    again: () => startSolo(S.soloInfo),
    nextPicnic: () => startSolo({ kind: 'picnic', n: Math.min(7, S.soloInfo.n + 1) }),
    resume: () => setPaused(false),
    quit: () => {
      setPaused(false);
      backToLobby();
    },
    rejoin: () => rejoin(),
  };
  const ui = createUi(document.getElementById('ui'), handlers);
  // Local testing: poke at the page from the console.
  if (dev) {
    window.__chew = {
      S,
      handlers,
      store,
      world,
      startSolo: (i) => startSolo(i),
      loads: () => loadsPending(),
      auto: (w, me) => {
        if (!S.autoBrain || S.autoBrain.w !== w) S.autoBrain = { w, b: createBrain(me, w, { skill: 0.9, kind: params.get('brain') || 'plain', seed: 'auto' }) };
        return S.autoBrain.b.think(w, me, 1 / 60) || { mx: 0, my: 0, dash: false };
      },
    };
  }
  // Capture: `zoom=0.7` brings the follow camera closer (dev only; a director can change __chew.S.zoom, and S.pitch and S.lift
  // for a low hero angle, as it plays).
  if (dev && params.get('zoom')) S.zoom = Number(params.get('zoom')) || 1;
  const localSettings = { arena: 0, rounds: 1, bots: 'normal' };
  const settings = () => (S.net ? S.net.settings() : readSettings(localSettings));

  function wear(arg) {
    const [kind, id] = String(arg).split(':');
    const p = P();
    if (kind === 'coat') {
      const i = Number(id);
      if (!coatUnlocked(p, i)) return;
      p.coat = i;
      S.pick = i;
    } else if (kind === 'hat') {
      if (id && !itemUnlocked(p, 'hat', id)) return;
      p.hat = id || '';
    } else if (kind === 'pop') {
      if (!itemUnlocked(p, 'pop', id)) return;
      p.pop = id;
      // Show it off.
      const me = S.practice && S.practice.w.byId.get('me');
      if (me) popBurst(me, id, true);
    } else if (kind === 'trail') {
      if (!itemUnlocked(p, 'trail', id)) return;
      p.trail = id;
    }
    store.save();
    if (S.practice) dress(S.practice.w);
    world.happy('me');
  }

  // ------------------------------------------------------------------ the room

  let room = null;
  async function connect() {
    const [r, helpers] = await Promise.all([joining, helpersP]);
    if (!r || !helpers) return;
    room = r;
    try {
      S.net = createOnline(room, helpers, { coat: () => P().coat, outfit: () => encodeOutfit(myOutfit()), now: () => performance.now(), onEvent: (e) => S.netEvents.push(e) });
    } catch (e) {
      console.error('[chew] online failed', e);
      S.net = null;
      return;
    }
    room.on('close', (reason) => {
      if (reason === 'moved' || reason === 'left') return;
      S.closed = reason === 'kicked' ? { text: 'You were removed', button: 'Play' } : reason === 'replaced' ? { text: 'Playing in another tab', button: 'Play here' } : { text: 'Connection lost', button: 'Rejoin' };
      if (S.net) S.net.dispose();
      S.net = null;
      S.solo = null;
      S.screen = 'closed';
    });
    S.net.match.on('results', (standings, mine) => {
      const p = P();
      p.totals.matches++;
      if (mine && mine.place === 1) {
        p.totals.wins++;
        store.submit('wins', p.totals.wins);
        if (S.matchPops === 0) store.award('clean-plate');
      }
      store.save();
      audio.play('fanfare');
      hud.confetti(160, reduced);
    });
  }
  connect();
  function rejoin() {
    S.closed = null;
    S.screen = 'lobby';
    joining = joinRoom();
    connect();
  }

  // ------------------------------------------------------------------ fonts, profile, attract

  withTimeout(Promise.all([document.fonts.load('40px Shrikhand'), document.fonts.load('800 20px "Bricolage Grotesque"')]), 2000);
  store.load().then(() => {
    S.pick = P().coat;
    // What a player had before the wardrobe existed counts as seen (only fresh unlocks say "New!").
    if (!P().seen.length) {
      P().seen = earnedKeys(P());
      store.save();
    }
  });

  let attractRound = 0;
  function newAttract() {
    attractRound++;
    S.attract = createLocalSession({ arena: 0, seed: `title:${attractRound}`, bots: attractBots(), intro: 0, duration: 75 });
    dress(S.attract.w);
    // Start a little in: food already strewn, a toss on its way.
    for (let i = 0; i < 60 * 3; i++) S.attract.step(1 / 60);
    S.attract.w.drain();
  }
  newAttract();

  // Sound waits for the first touch or key on this page (Ready is pressed on the platform's).
  audio.music('menu');
  addEventListener('keydown', () => audio.unlock()); // any key: the click on the platform's Ready can't start sound in this frame
  input.onKeyDown((e) => {
    audio.unlock();
    if (e.code === 'Escape' && S.sheet) S.sheet = null;
    else if (e.code === 'Escape' && S.screen === 'wardrobe') backToLobby();
    else if (e.code === 'Escape' && S.solo && S.screen === 'solo' && S.solo.phase !== 'end') setPaused(!S.paused);
    else if (S.watch !== null && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) cycleWatch(e.code === 'ArrowLeft' ? -1 : 1);
  });
  canvas.addEventListener('pointerdown', () => {
    audio.unlock();
    if (S.watch !== null && onlineActive()) cycleWatch(1);
  });

  // ------------------------------------------------------------------ solo: Picnics, the Daily

  const firstOpenPlate = () => {
    const p = P();
    for (let i = 7; i >= 0; i--) if (picnicOpen(p, i) && !p.picnics.won[i]) return i;
    return 0;
  };

  function today() {
    return dayNumber(store.now());
  }

  async function loadDaily() {
    const day = today();
    const { entries } = await store.top('daily', 100);
    const todays = (entries || []).filter((e) => Math.floor(e.score / 10000) === day);
    S.daily.top = todays.slice(0, 5).map((e) => ({ name: e.player && e.player.name ? e.player.name : 'Player', score: e.score % 10000 }));
  }

  function startSolo(info) {
    if (!info) return;
    audio.unlock();
    const p = P();
    let arena;
    let seed;
    let skill;
    let specials;
    if (info.kind === 'picnic') {
      if (!picnicOpen(p, info.n)) return;
      arena = info.n;
      seed = `picnic:${info.n}:${Math.floor(Math.random() * 1e9)}`;
      skill = LADDER_SKILL[info.n];
      specials = PICNIC_SPECIALS[info.n];
    } else if (info.kind === 'daily') {
      const day = today();
      arena = dailyArena(day);
      seed = `daily:${day}`;
      skill = DIFFICULTY.normal;
      info = { ...info, day };
    } else {
      arena = settings().arena;
      seed = `quick:${Math.floor(Math.random() * 1e9)}`;
      skill = DIFFICULTY[settings().bots] ?? 0.5;
    }
    const bots = BOTS.slice(0, 7).map((b, i) => ({ name: b.name, kind: b.kind, coat: b.coat, skill: clamp(skill + ((i % 3) - 1) * 0.04, 0, 1) }));
    S.solo = createLocalSession({ arena, seed, me: { id: 'me', name: 'You', coat: p.coat }, bots, specials });
    dress(S.solo.w);
    S.soloInfo = info;
    S.soloResult = null;
    S.screen = 'solo';
    S.sheet = null;
    S.matchPops = 0;
    S.endFocus = null;
    hud.clear();
    world.resetAnims();
    world.camReady = false;
    audio.music('play');
    S.autoBrain = null;
  }

  function backToLobby() {
    S.solo = null;
    S.soloResult = null;
    S.screen = 'lobby';
    S.sheet = null;
    S.big = null;
    world.camReady = false;
    world.mood('me', null);
    audio.music('menu');
    audio.strain(0);
  }

  function setPaused(on) {
    if (!S.solo || S.solo.phase === 'end') on = false;
    S.paused = on;
    if (S.solo) S.solo.paused = on;
    audio.duck(on);
    if (on) audio.strain(0);
  }
  try {
    if (ow) {
      ow.on('pause', () => setPaused(true));
      ow.on('resume', () => {});
    }
  } catch {
    /* outside the platform */
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (S.solo && S.screen === 'solo' && S.solo.phase !== 'end') setPaused(true);
      audio.suspend(true);
    } else audio.suspend(false);
  });

  /** My numbers for a finished round (solo). */
  function myRound(w, me, place) {
    const s = me.stats;
    return {
      heap: me.heap,
      trips: s.trips,
      pops: s.pops,
      popsByBump: s.bullied,
      golden: s.golden,
      bestTrip: s.bestTrip,
      lastBankLeft: s.lastBank > 0 ? w.duration - s.lastBank : null,
      stuffed: s.stuffed,
      bursting: s.bursting,
      bestChain: s.bestChain,
      bestBank: s.bestBank,
      specials: s.specials,
      spice: s.spice,
      bumps: s.bumps,
      swatted: s.swatted,
      place,
      players: w.hams.length,
    };
  }

  function finishSolo() {
    const s = S.solo;
    const w = s.w;
    const me = w.byId.get('me');
    const st = w.standings();
    const mine = st.find((r) => r.id === 'me');
    const place = mine ? mine.place : 8;
    const p = P();
    const info = S.soloInfo;
    const sum = finishRound(p, myRound(w, me, place), { mode: info.kind, n: info.n, day: today() });
    if (info.kind === 'daily') {
      store.submit('daily', dailyScore(info.day, me.heap)).then((r) => (S.daily.rank = r && r.rank ? r.rank : S.daily.rank));
      store.submit('streak', p.daily.bestStreak);
    }
    if (place === 1) store.submit('wins', p.totals.wins);
    for (const b of sum.badges) store.award(b);
    store.submit('best-round', me.heap);
    store.submit('level', levelOf(p.xp).level);
    store.save();
    const canNext = info.kind === 'picnic' && info.n < 7 && picnicOpen(p, info.n + 1);
    S.soloResult = {
      place,
      podium: st.slice(0, 3).map((r) => {
        const h = w.byId.get(r.id);
        return { name: r.id === 'me' ? 'You' : r.name, coat: h.coat, seat: h.seat, hat: h.hat, total: fmt(r.heap), place: r.place, me: r.id === 'me' };
      }),
      heap: fmt(me.heap),
      lines: sum.lines,
      canNext,
      summary: progressView(sum),
      title: info.kind === 'picnic' ? `Picnic ${info.n + 1}` : info.kind === 'daily' ? 'Daily Feast' : arenaById(w.arena.id).name,
    };
    S.screen = 'soloResults';
    if (place === 1) {
      audio.play('fanfare');
      hud.confetti(160, reduced);
    }
    progSounds(S.soloResult.summary);
    audio.music('menu');
  }

  /** The results card's beats, heard: XP ticks, the level-up, new stars (timed like the card's animations). */
  function progSounds(s) {
    const later = (sec, f) => setTimeout(f, sec * 1000);
    let t = 0.6;
    s.xp.forEach((l, i) => {
      t += 0.13;
      later(t, () => audio.play('xp', { i }));
    });
    t += 1.3;
    if (s.to.level > s.from.level) {
      later(t, () => audio.play('levelup'));
      t += 0.35;
    }
    if (s.rewards.length) t += s.rewards.length * 0.18 + 0.2;
    if (s.stars) s.stars.fresh.forEach((f, k) => f && later(t + k * 0.22, () => audio.play('star', { i: k })));
  }

  /** The progress part of a results screen. */
  function progressView(sum) {
    return {
      xp: sum.xp.map((l) => ({ text: l.text, xp: l.xp })),
      xpTotal: sum.xpTotal,
      from: { level: sum.before.level, f: sum.before.into / sum.before.need },
      to: { level: sum.after.level, f: sum.after.into / sum.after.need, into: sum.after.into, need: sum.after.need },
      rewards: sum.rewards,
      stars: sum.stars,
      have: sum.stars ? P().picnics.stars[sum.stars.n].slice() : null,
      starText: sum.stars ? ['Win', `Bank ${fmt(PICNIC_GOALS[sum.stars.n].heap)}`, PICNIC_GOALS[sum.stars.n].text] : null,
      goals: sum.goals,
      streak: sum.streak,
    };
  }

  // ------------------------------------------------------------------ the lobby's practice blanket

  function practiceRoster() {
    const others = [];
    let meIndex = 0;
    if (S.net && room) {
      const players = [...S.net.lobby().players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 8);
      players.forEach((pl) => {
        if (pl.me) meIndex = others.length;
        else others.push({ id: pl.id, name: pl.name });
      });
    }
    const s = settings();
    const nb = s.bots === 'off' ? 0 : Math.max(0, 8 - 1 - others.length);
    return { others, meIndex, bots: BOTS.slice(0, nb) };
  }

  function ensurePractice() {
    const s = settings();
    const roster = practiceRoster();
    const key = `${s.arena}|${roster.meIndex}|${roster.others.map((o) => o.id).join(',')}|${roster.bots.length}`;
    if (S.practice && S.practiceKey === key) return S.practice;
    const old = S.practice ? S.practice.w.byId.get('me') : null;
    const sameArena = S.practice && S.practice.w.arena.id === s.arena;
    S.practice = createLocalSession({
      arena: s.arena,
      seed: `practice:${s.arena}`,
      me: { id: 'me', name: 'You', coat: P().coat },
      others: roster.others,
      meIndex: roster.meIndex,
      bots: roster.bots.map((b) => ({ name: b.name, kind: b.kind, coat: b.coat, skill: 0.5 })),
      practice: true,
      intro: 0,
    });
    dress(S.practice.w);
    S.practiceKey = key;
    if (old && sameArena) {
      const me = S.practice.w.byId.get('me');
      me.x = old.x;
      me.y = old.y;
      me.a = old.a;
      me.heap = old.heap;
    }
    return S.practice;
  }

  // ------------------------------------------------------------------ juice

  const onScreen = (x, y, m = 80) => {
    const p = world.toScreen(x, y, 0);
    return !p.behind && p.x > -m && p.y > -m && p.x < world.vw + m && p.y < world.vh + m;
  };

  function showHint(key, text, opts = {}) {
    const p = P();
    if (!opts.always && p.hints[key]) return;
    if (S.hint && S.hint.age < S.hint.life * 0.7 && !opts.force) return;
    p.hints[key] = true;
    store.save();
    S.hint = { text, age: 0, life: opts.life || 2.6, hot: !!opts.hot };
  }

  const hitStop = (sec) => {
    if (!reduced) S.stop = Math.max(S.stop, sec);
  };
  const slowMo = (sec) => {
    if (!reduced) S.slow = Math.max(S.slow, sec);
  };

  /** A pop's burst in the hamster's chosen style. `show`: a wardrobe preview. */
  function popBurst(h, style, show = false) {
    const st = POP_STYLE[style] || POP_STYLE.crumbs;
    const x = h.x * U;
    const z = h.y * U;
    fx.ring(x, z, 1.5, '#fff2d9');
    fx.flare(x, 0.35, z, 1.4, st.glow, 0.25);
    fx.crumbs(x, 0.35, z, 26, st.colors, 2.6, 1.1, 0.035);
    if (st.confetti) fx.confetti(x, 0.4, z, 40, 1.4, st.colors);
    if (st.sparkle) fx.sparkle(x, 0.4, z, 24, st.sparkle, 1.2, 0.18);
    if (st.bubbles) for (let i = 0; i < 12; i++) fx.steam(x + (Math.random() - 0.5) * 0.6, 0.2, z + (Math.random() - 0.5) * 0.6, 1, '#d8f2ff', 0.12);
    if (st.fireworks) {
      fx.sparkle(x, 0.6, z, 30, '#ffcb2e', 1.6, 0.16);
      fx.sparkle(x, 0.6, z, 20, '#3fa7f2', 1.4, 0.14);
      fx.sparkle(x, 0.6, z, 20, '#ff4d6d', 1.5, 0.14);
    }
    fx.dust(x, z, 10, 0.3);
    if (show) audio.play('pop');
  }

  function juice(e, w, meId) {
    const h = w.byId.get(e.id);
    const mine = !!meId && e.id === meId;
    const near = h ? onScreen(h.x, h.y) : false;
    switch (e.k) {
      case 'eat': {
        const def = FOODS[e.type];
        world.gulp(e.id, def.size);
        if (near) fx.crumbs(e.x * U, 0.1, e.y * U, 3 + Math.min(6, Math.round(def.size / 5)), CRUMBS[e.type] || CRUMBS[0], 0.9, 0.5, 0.022);
        if (mine) {
          audio.play('munch', { size: def.size, fill: e.fill, chain: e.chain || 0 });
          S.ateAt = w.t;
          if (e.type === GOLDEN) {
            hud.float(e.x, e.y, 0.5, '+60', '#FFCB2E', 34);
            fx.sparkle(e.x * U, 0.3, e.y * U, 16, '#fff2a8', 0.8);
          }
          const c = e.chain || 0;
          if (c === 3 || c === 5 || c === 8 || (c > 8 && c % 4 === 0)) {
            hud.float(e.x, e.y, 0.7, `Gobble ×${c}!`, '#2DC38A', 24 + Math.min(10, c), 0.9);
            fx.sparkle(e.x * U, 0.4, e.y * U, 6 + c, '#bfffd0', 0.5, 0.1);
            if (c === 3) showHint('chain', 'Gobble chains add up!');
          }
          if (e.fill > TIERS[1].at && e.fill - def.size <= TIERS[1].at) {
            audio.play('tier', { n: 1 });
            showHint('stuffed', 'Stuffed! Bank it for ×2', { force: true });
          } else if (e.fill > TIERS[0].at && e.fill - def.size <= TIERS[0].at) {
            audio.play('tier', { n: 2 });
            showHint('bursting', 'Bursting! ×3 if you get home', { force: true, hot: true });
          }
        }
        break;
      }
      case 'hot':
        if (near || mine) {
          fx.steam(e.x * U, 0.4, e.y * U, 8, '#ffb070', 0.18);
          fx.sparkle(e.x * U, 0.4, e.y * U, 10, '#ff8a2a', 0.6);
          hud.float(e.x, e.y, 0.7, 'HOT!', '#FF5A2A', mine ? 34 : 24, 0.9);
        }
        if (mine) {
          audio.play('sizzle');
          showHint('chili', 'Chili: full speed!', { force: true });
        }
        break;
      case 'gum':
        if (near || mine) {
          fx.ring(e.x * U, e.y * U, 0.8, '#ff7ec0');
          hud.float(e.x, e.y, 0.7, 'Bubble!', '#FF7EC0', mine ? 32 : 22, 0.9);
        }
        if (mine) {
          audio.play('gum');
          showHint('gum', 'Bumps bounce off you', { force: true });
        }
        break;
      case 'tickle':
        if (mine) {
          hud.float(e.x, e.y, 0.7, 'Uh oh…', '#E8C9A0', 28, 0.9);
          audio.play('tickle');
          showHint('pepper', 'Peppercorn: you sneeze!', { force: true, hot: true });
        }
        break;
      case 'sneeze': {
        if (h && (near || mine)) {
          fx.spray(h.x * U + (e.dx || 0) * 0.25, 0.35, h.y * U + (e.dy || 0) * 0.25, e.dx || 1, e.dy || 0, 22);
          hud.float(h.x, h.y, 0.8, 'ACHOO!', '#FFFFFF', mine ? 34 : 24, 0.9);
          world.squash(e.id, -0.4);
        }
        if (mine || near) audio.play('sneeze');
        if (mine) world.rig.kick(0.3, -(e.dx || 0), -(e.dy || 0));
        break;
      }
      case 'pop': {
        if (h) fx.stars(world.hamTop(h.id), POP.dizzy);
        world.pop(e.id);
        if (near || mine) {
          popBurst(h || e, (h && h.pop) || 'crumbs');
          audio.play('pop');
          world.rig.kick(mine ? 0.85 : 0.35);
          hitStop(mine ? 0.12 : 0.06);
          if (mine) world.rig.punchIn(0.12);
        }
        hud.float(e.x, e.y, 0.8, 'POP!', mine ? '#FF4D6D' : '#FFF2D9', mine ? 48 : 30, 1.3);
        if (mine) {
          S.matchPops++;
          const p = P();
          if (!p.hints.popfirst) {
            p.hints.popfirst = true;
            store.save();
            S.big = { kind: 'word', text: 'Too full!', t: 0, life: 1.5, color: '#FF4D6D' };
            setTimeout(() => showHint('banksooner', 'Bank sooner', { force: true }), 1800);
          }
        }
        break;
      }
      case 'bank': {
        world.happy(e.id);
        if (h) {
          world.bankFlight(h, e.counts, e.worth);
          const hs = world.heapSpot(h);
          const tier = e.tier ? TIERS.find((t) => t.key === e.tier) : null;
          if (near || mine) {
            const sub = tier ? `${tier.name} ×${tier.mult}!` : e.bonus > 0 ? `+${e.bonus} gobble` : '';
            hud.float(hs.x, hs.y, 1.0, `+${e.worth}`, tier ? (tier.key === 'bursting' ? '#FF4D6D' : '#FF8A2A') : '#FFCB2E', mine ? (tier ? 50 : 40) : 26, tier ? 1.7 : 1.3, sub);
            fx.sparkle(hs.x * U, 0.3, hs.y * U, tier ? 30 : 10, tier ? '#ffe680' : '#fff2c0', tier ? 1.2 : 0.6);
            if (tier) {
              fx.confetti(hs.x * U, 0.5, hs.y * U, tier.key === 'bursting' ? 60 : 30, 1.4);
              fx.ring(hs.x * U, hs.y * U, 2.2, tier.key === 'bursting' ? '#ff4d6d' : '#ffcb2e', 0.6);
            }
          }
          if (mine && tier) {
            world.rig.punchIn(tier.key === 'bursting' ? 0.22 : 0.14);
            if (tier.key === 'bursting') {
              slowMo(0.55);
              S.big = { kind: 'word', text: 'BURSTING!', t: 0, life: 1.2, color: '#FF4D6D' };
            }
          }
        }
        if (mine) {
          const n = e.counts ? e.counts.reduce((a, b) => a + b, 0) : Math.ceil(e.worth / 6);
          audio.play('bank', { n, worth: e.worth, fill: e.fill, tier: e.tier ? (e.tier === 'bursting' ? 2 : 1) : 0 });
        }
        break;
      }
      case 'hit': {
        world.squash(e.id, 0.45);
        world.hit(e.id);
        if (near || mine) {
          fx.dust(e.x * U, e.y * U, 8, 0.22);
          fx.flare(e.x * U, 0.3, e.y * U, 0.8, '#ffffff', 0.12);
          audio.play(e.kind === 'paw' ? 'swat' : 'hit');
          hitStop(0.06);
          world.rig.kick(mine ? 0.5 : 0.18, e.dx || 0, e.dy || 0);
        }
        if (e.by && e.by === meId) {
          hitStop(0.05);
          world.rig.kick(0.25, e.dx || 0, e.dy || 0);
        }
        break;
      }
      case 'boing':
        if (near || mine) {
          fx.ring(e.x * U, e.y * U, 1.0, '#ff7ec0', 0.35);
          hud.float(e.x, e.y, 0.7, 'Boing!', '#FF7EC0', 26, 0.8);
          audio.play('boing');
        }
        break;
      case 'dash':
        world.squash(e.id, -0.3);
        if (near) fx.dust(e.x * U, e.y * U, 5, 0.16);
        if (h && h.trailFx && h.trailFx !== 'dust' && near) trailBurst(h, 8);
        if (mine || near) audio.play('dash');
        break;
      case 'lost':
        if (near || mine) hud.float(e.x, e.y, 0.6, `-${e.worth}`, '#C9BFB6', mine ? 36 : 24, 1.5);
        if (mine) audio.play('lost');
        break;
      case 'end':
        audio.play('buzzer');
        break;
      default:
        break;
    }
  }

  function trailBurst(h, n) {
    const x = h.x * U;
    const z = h.y * U;
    switch (h.trailFx) {
      case 'sparkle':
        fx.sparkle(x, 0.2, z, n, '#fff2a8', 0.4, 0.1);
        break;
      case 'petals':
        fx.confetti(x, 0.3, z, n, 0.6, ['#ffb3d0', '#ff8fb8', '#fff0f5']);
        break;
      case 'bubbles':
        fx.steam(x, 0.15, z, n, '#d8f2ff', 0.08);
        break;
      case 'flames':
        fx.sparkle(x, 0.15, z, n, '#ff8a2a', 0.3, 0.14);
        break;
      case 'rainbow':
        for (const c of ['#ff4d6d', '#ffcb2e', '#2dc38a', '#3fa7f2', '#9a5bea']) fx.sparkle(x, 0.2, z, Math.ceil(n / 4), c, 0.4, 0.1);
        break;
      default:
        break;
    }
  }

  /** Every hamster's trail as it runs (its cosmetic, a few particles a second). */
  const trailAcc = new Map();
  function trails(w, dt) {
    for (const h of w.hams) {
      if (h.gone || !h.trailFx || h.trailFx === 'dust') continue;
      if ((h.speed || 0) < 120) continue;
      const a = (trailAcc.get(h.id) || 0) + dt * 9;
      if (a >= 1) {
        if (onScreen(h.x, h.y, 20)) trailBurst(h, 1);
        trailAcc.set(h.id, 0);
      } else trailAcc.set(h.id, a);
    }
  }

  /** Things that happen on the schedule's clock: the hand, a golden seed's light, the cat. */
  function scheduleBeats(w, t0, t1, meId) {
    if (t1 <= t0) return;
    for (const ts of w.sched.tosses) {
      if (ts.at > t0 && ts.at <= t1 && onScreen(ts.x, ts.y, 200)) audio.play('toss');
      if (ts.land > t0 && ts.land <= t1 && onScreen(ts.x, ts.y, 100)) {
        audio.play('land');
        fx.dust(ts.x * U, ts.y * U, ts.pour ? 3 : 7, 0.3);
      }
      // A pour patters down along its line.
      if (ts.pour && t1 > ts.land && t0 < ts.land + ts.pour.dur) {
        const k = Math.min(1, (t1 - ts.land) / ts.pour.dur);
        const x = ts.x + (ts.pour.x1 - ts.x) * k;
        const y = ts.y + (ts.pour.y1 - ts.y) * k;
        if (onScreen(x, y, 60)) fx.dust(x * U, y * U, 1, 0.16);
      }
    }
    for (const g of w.sched.goldens) {
      if (g.at > t0 && g.at <= t1) {
        audio.play('golden');
        if (meId) showHint('golden', 'Golden seed!');
      }
      if (g.land > t0 && g.land <= t1 && onScreen(g.x, g.y, 100)) fx.sparkle(g.x * U, 0.2, g.y * U, 20, '#fff2a8', 0.9);
    }
    for (const d of w.sched.drops || []) {
      if (d.land > t0 && d.land <= t1 && onScreen(d.x, d.y, 100)) {
        fx.dust(d.x * U, d.y * U, 5, 0.22);
        audio.play('land');
      }
    }
    const first = w.sched.sweeps[0];
    for (const s of w.sched.sweeps) {
      if (s.at > t0 && s.at <= t1) {
        audio.play('swish');
        if (s === first) {
          audio.play('cat');
          if (meId) showHint('cat', 'Cat!', { hot: true });
        }
      }
      if (s.swat > t0 && s.swat <= t1 && onScreen(s.px, s.py, 400)) {
        audio.play('swat');
        world.rig.kick(0.3, s.dx, s.dy);
      }
    }
    if (w.t >= w.duration - 30 && t0 < w.duration - 30 && t1 >= w.duration - 30) audio.music('late');
  }

  function playHints(w, me) {
    if (!me) return;
    const t = w.t;
    if (t > 3.5 && S.ateAt === 0 && me.fill === 0 && me.heap === 0) showHint('eat', 'Run over food');
    if (me.fill >= 70 && me.fill <= CAP) showHint('home', 'Full? Go home!');
    if (me.fill > CAP + 5 && P().hints.stuffed) showHint('over', 'Big bites can pop you', { hot: true });
    if (t > 30 && me.dashCd <= 0 && me.dizzyT <= 0) {
      for (const g of w.hams) {
        if (g === me || g.away || g.gone || g.fill < 60) continue;
        if (Math.hypot(g.x - me.x, g.y - me.y) < 170) {
          showHint('bump', ow && ow.controls && ow.controls.touch ? 'Bump!' : 'Space: Bump!');
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ online helpers

  const onlinePhase = () => (S.net ? S.net.match.phase : 'lobby');
  function onlineActive() {
    if (!S.net) return false;
    const ph = onlinePhase();
    return ph === 'intro' || ph === 'round' || ph === 'roundEnd' || ph === 'results';
  }

  function cycleWatch(d) {
    const w = S.net && S.net.world;
    if (!w) return;
    const list = w.hams.filter((h) => !h.gone);
    if (!list.length) return;
    const k = list.findIndex((h) => h.id === S.watch);
    S.watch = list[(k + d + list.length) % list.length].id;
  }

  function seatRow(seat, w, i) {
    const h = w ? w.byId.get(seat.id) : null;
    return { coat: h ? h.coat : 0, seat: h ? h.seat : i, hat: h ? h.hat : '' };
  }

  function reasonLine(w, ranked) {
    if (!w || !ranked.length) return '';
    const win = w.byId.get(ranked[0].id);
    let popper = null;
    for (const h of w.hams) if (!popper || h.stats.pops > popper.stats.pops) popper = h;
    const name = (h) => (h.id === S.net?.me ? 'You' : h.name);
    if (win && win.stats.bursting > 0) return `${name(win)} banked ${win.stats.bursting} Bursting cheekful${win.stats.bursting > 1 ? 's' : ''}`;
    if (popper && popper.stats.pops >= 3 && popper !== win) return `${name(popper)} popped ${popper.stats.pops} times`;
    if (win && win.stats.pops === 0 && win.stats.trips > 0) return `${name(win)}: ${win.stats.trips} trips, never popped`;
    if (popper && popper.stats.pops >= 2) return `${name(popper)} popped ${popper.stats.pops} times`;
    return win ? `${name(win)} banked ${fmt(win.heap)}` : '';
  }

  function roundEndOnce() {
    const net = S.net;
    const key = net.roundKey;
    if (S.endSeen === key) return;
    S.endSeen = key;
    const r = net.roundStats();
    if (!r) return;
    const w = net.world;
    const st = w ? w.standings() : [];
    const mine = st.find((x) => x.id === net.me);
    const p = P();
    const sum = finishRound(p, { ...r, place: mine ? mine.place : 8, players: w ? w.hams.length : 8 }, { mode: 'match', day: today() });
    for (const b of sum.badges) store.award(b);
    store.submit('best-round', r.heap);
    store.submit('level', levelOf(p.xp).level);
    S.matchLines.push(...sum.lines);
    S.matchSummary = progressView(sum);
    store.save();
  }

  // ------------------------------------------------------------------ the frame

  let last = performance.now();
  let flow = '';
  function setFlow(f) {
    if (f !== flow) {
      flow = f;
      document.body.dataset.flow = f;
    }
  }
  let controlsOn = null;
  function setControls(on) {
    if (on === controlsOn) return;
    controlsOn = on;
    input.setEnabled(on);
    try {
      if (ow && ow.controls) ow.controls.set(on ? { stick: 'analog', zone: 'wide', buttons: [{ id: 'bump', label: 'Bump', key: ' ' }] } : null);
    } catch {
      /* outside the platform */
    }
  }

  function myInput(w, me) {
    if (autoplay && me) {
      if (!S.autoBrain || S.autoBrain.w !== w) S.autoBrain = { w, b: createBrain(me, w, { skill: 0.9, kind: params.get('brain') || 'plain', seed: 'auto' }) };
      const i = S.autoBrain.b.think(w, me, 1 / 60);
      return i || { mx: 0, my: 0, dash: false };
    }
    return input.read(me);
  }

  /** Name tags (projected over each head). */
  function tagsFor(w, meId, leaderId) {
    const out = [];
    for (const h of w.hams) {
      if (h.gone) continue;
      const top = world.hamTop(h.id);
      if (!top) continue;
      const p = world.worldToScreen(top.wx, top.hy + 0.12, top.wz);
      if (p.x < -40 || p.y < -40 || p.x > world.vw + 40 || p.y > world.vh + 40) continue;
      out.push({ x: p.x, y: p.y, name: h.name, me: h.id === meId, seat: h.seat, away: h.away, crown: leaderId === h.id, badge: h.id === meId && (h.fill > TIERS[1].at || (h.chain >= 2 && w.t - h.lastBite < 0.9)) });
    }
    return out;
  }
  /** My numbers for the badge over my head. */
  function meBadge(w, me) {
    if (!me || me.gone) return null;
    const top = world.hamTop(me.id);
    if (!top) return null;
    const p = world.worldToScreen(top.wx, top.hy + 0.15, top.wz);
    return { x: p.x, y: p.y, fill: me.fill, chain: me.chain, chainFresh: w.t - me.lastBite < 0.9, hotT: me.hotT, gumT: me.gumT, sneezeT: me.sneezeT };
  }

  const frameMs = [];
  if (dev) {
    window.__fps = () => {
      const a = frameMs.slice(-180);
      const avg = a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
      return { fps: Math.round(1000 / avg), worst: Math.round(Math.max(...a)), slow: a.filter((x) => x > 20).length, n: a.length };
    };
  }

  function frame() {
    requestAnimationFrame(frame);
    // The clock, not the frame's timestamp: some browsers (and recorders) hand out timestamps that step back and forth,
    // and every backward step would come back as extra time.
    const now = Math.max(last, performance.now());
    S.camTarget = null;
    let dt = (now - last) / 1000;
    if (dev) {
      frameMs.push(now - last);
      if (frameMs.length > 600) frameMs.splice(0, 300);
    }
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    // Hit-stop freezes the world a moment; slow-mo eases it.
    let gdt = dt;
    if (S.stop > 0) {
      S.stop = Math.max(0, S.stop - dt);
      gdt = 0;
    } else if (S.slow > 0) {
      S.slow = Math.max(0, S.slow - dt);
      gdt = dt * 0.3;
    }
    if (S.hint) {
      S.hint.age += dt;
      if (S.hint.age >= S.hint.life) S.hint = null;
    }
    if (S.big) {
      S.big.t += dt;
      if (S.big.t >= S.big.life) S.big = null;
    }

    // A match takes its players out of whatever they were doing; someone watching it only sees it from the lobby.
    const pulled = room && !room.spectating ? ['lobby', 'picnics', 'daily', 'solo', 'soloResults', 'wardrobe'] : ['lobby'];
    if (S.net && onlineActive() && pulled.includes(S.screen)) {
      S.solo = null;
      S.paused = false;
      S.screen = 'match';
      S.sheet = null;
      hud.clear();
      world.resetAnims();
      world.camReady = false;
    }
    if (S.screen === 'match' && !onlineActive()) {
      S.screen = 'lobby';
      world.camReady = false;
      audio.music('menu');
      audio.strain(0);
    }
    if (autoplay && !S.autoStarted && now > 1200 && (params.get('wait') !== '1' || window.__go)) {
      // Capture: `solo=picnic:N | daily | quick | wardrobe` goes there without readying in the room; `xp=` sets the XP;
      // `wait=1` holds the lobby until the capture sets `window.__go`.
      S.autoStarted = true;
      const solo = params.get('solo');
      if (solo) {
        const p = P();
        if (params.get('xp')) p.xp = Number(params.get('xp')) || 0;
        if (params.get('hints') === '0') p.hints = new Proxy({}, { get: () => true });
        S.screen = 'lobby';
        world.camReady = false;
        const [kind, n] = solo.split(':');
        if (kind === 'picnic') {
          for (let i = 0; i < Number(n); i++) p.picnics.won[i] = true;
          startSolo({ kind, n: Number(n) });
        } else if (kind === 'wardrobe') handlers.wardrobe();
        else startSolo({ kind });
        // `skip=90` plays the first 90 s of the round unseen, to capture its later part.
        const skip = Number(params.get('skip')) || 0;
        if (S.solo && skip > 0) {
          for (let i = 0; i < Math.round(skip * 60); i++) S.solo.step(1 / 60, () => myInput(S.solo.w, S.solo.mine));
          S.solo.w.drain();
          hud.clear();
        }
      }
    }
    if (autoplay && S.screen === 'lobby' && now > 2400 && !S.net && params.get('stay') !== '1') startSolo({ kind: params.get('mode') === 'daily' ? 'daily' : 'quick' });

    let w;
    let meId = null;
    let view = { mode: 'follow' };
    const hudView = { dt, reserved: reservedList() };
    let showRing = true;
    let tags = true;
    let practice = false;

    if (S.screen === 'closed' && !S.solo && !onlineActive()) {
      const s = S.attract;
      s.step(gdt);
      for (const e of s.w.drain()) juice(e, s.w, null);
      if (s.phase === 'end') newAttract();
      w = S.attract.w;
      view = { mode: 'drift' };
      showRing = false;
      tags = false;
      setControls(false);
      setFlow('closed');
      ui.render('closed', S.closed);
    } else if (S.screen === 'match' && !S.net.world) {
      // The round's world comes with the host's round data: the blanket keeps moving until then.
      S.net.frame(gdt, null);
      S.attract.step(gdt);
      S.attract.w.drain();
      w = S.attract.w;
      view = { mode: 'drift' };
      showRing = false;
      tags = false;
      setControls(false);
      ui.render('none');
      setFlow('waiting');
    } else if (S.screen === 'match') {
      const net = S.net;
      const m = net.match;
      const t0 = net.world ? net.world.t : 0;
      const events = net.frame(gdt, () => myInput(net.world, net.world && net.world.byId.get(net.me)));
      w = net.world;
      meId = net.me;
      const me = meId ? w.byId.get(meId) : null;
      for (const e of events) juice(e, w, meId);
      // What the host's record says happened to others (and my pops and banks).
      for (const e of S.netEvents.splice(0)) if (w.byId.get(e.id)) juice(e, w, meId);
      const ph = m.phase;
      if (ph === 'round') {
        scheduleBeats(w, t0, w.t, meId);
        playHints(w, me);
      }
      // Phase changes: EAT! (play begins as the room's countdown ends), the buzzer.
      const pk = `${net.roundKey}:${ph}`;
      if (pk !== S.phaseSeen) {
        S.phaseSeen = pk;
        if (ph === 'round') {
          // Ready was pressed on the platform's page: try for the sound now (the first key or touch makes sure of it).
          audio.unlock();
          audio.music('play');
          S.ateAt = 0;
          S.lastSec = -1;
          world.camReady = false;
          S.endFocus = null;
          if (m.round <= 1) {
            S.matchPops = 0;
            S.matchLines = [];
            S.matchSummary = null;
          }
          // (not for a page that reloads into a round under way)
          if ((m.elapsed ?? 0) < 1500) {
            S.big = m.round > 1 ? { kind: 'banner', text: `Round ${m.round}`, sub: `of ${m.rounds}`, t: 0, life: 1.1 } : { kind: 'word', text: 'EAT!', t: 0, life: 0.9, color: '#FFCB2E' };
            audio.play('eat');
          }
        }
        if (ph === 'roundEnd') {
          S.big = { kind: 'word', text: 'Time!', t: 0, life: 1.1 };
          audio.music('menu');
          audio.strain(0);
          roundEndOnce();
          const lead = w.leader();
          S.endFocus = lead ? { id: lead.id, t: 0 } : null;
          if (lead) world.mood(lead.id, 'win');
        }
      }
      if (room && room.spectating) {
        if (!S.watch || !w.byId.get(S.watch)) S.watch = w.leader() ? w.leader().id : w.hams[0] && w.hams[0].id;
      } else S.watch = null;
      const playing = ph === 'round' && !!me;
      setControls(ph === 'round' && !!me);
      if (ph === 'round') {
        hudView.timer = { left: m.secondsLeft ?? 0, total: ROUND.seconds };
        if (me) hudView.place = placeOf(w, me);
        hudView.arrows = arrowsFor(w, me);
        if (me) strainFor(me);
        trails(w, gdt);
      } else audio.strain(0);
      if (ph === 'roundEnd' || ph === 'results') {
        view = endView(w, dt);
        showRing = false;
        tags = false;
      }
      if (S.watch && ph === 'round') hudView.tag = 'Watching · next round';
      if (ph === 'roundEnd') ui.render(S.big && S.big.text === 'Time!' ? 'none' : 'board', boardView(net, w));
      else if (ph === 'results') ui.render('results', resultsView(net, w));
      else ui.render('none');
      if (ph === 'round') tickSound(m.secondsLeft ?? 0);
      if (ph === 'roundEnd' || ph === 'results') ui.live('next', nextText(m));
      setFlow(ph === 'round' ? (S.watch ? 'watching' : 'play') : ph);
      if (playing && me) S.camTarget = me;
      else if (S.watch) S.camTarget = w.byId.get(S.watch);
    } else if (S.solo && (S.screen === 'solo' || S.screen === 'soloResults')) {
      S.netEvents.length = 0;
      const s = S.solo;
      const t0 = s.w.t;
      const wasPhase = s.phase;
      const me = s.mine;
      const events = s.step(gdt, () => myInput(s.w, me));
      w = s.w;
      meId = 'me';
      for (const e of events) {
        if (e.k === 'go') {
          S.big = { kind: 'word', text: 'EAT!', t: 0, life: 0.9, color: '#FFCB2E' };
          audio.play('eat');
          continue;
        }
        juice(e, w, meId);
      }
      if (s.phase === 'round') {
        scheduleBeats(w, t0, w.t, meId);
        playHints(w, me);
        strainFor(me);
        trails(w, gdt);
        hudView.timer = { left: s.timeLeft, total: w.duration };
        tickSound(s.timeLeft);
        hudView.place = placeOf(w, me);
        hudView.arrows = arrowsFor(w, me);
      } else audio.strain(0);
      if (s.phase === 'intro') {
        const title = S.soloInfo.kind === 'picnic' ? `Picnic ${S.soloInfo.n + 1}` : S.soloInfo.kind === 'daily' ? 'Daily Feast' : 'Round 1';
        introBig(s.introT, title, w.arena.twist);
        hudView.timer = { left: w.duration, total: w.duration };
      }
      if (wasPhase === 'round' && s.phase === 'end') {
        S.big = { kind: 'word', text: 'Time!', t: 0, life: 1.1 };
        audio.music('off');
        const lead = w.leader();
        S.endFocus = lead ? { id: lead.id, t: 0 } : null;
        if (lead) world.mood(lead.id, 'win');
        if (!lead || lead.id !== 'me') world.mood('me', 'lose');
      }
      if (s.phase === 'end' && s.endT > 2.4 && !S.soloResult) finishSolo();
      setControls(s.phase === 'round' && !S.paused);
      if (s.phase === 'end') {
        view = endView(w, dt);
        showRing = false;
        tags = false;
      }
      if (S.paused) ui.render('pause');
      else if (S.screen === 'soloResults') ui.render('solo', S.soloResult);
      else ui.render('none');
      setFlow(S.paused ? 'paused' : S.screen === 'soloResults' ? 'soloResults' : s.phase === 'round' ? 'play' : s.phase);
      S.camTarget = me;
    } else {
      // The lobby (and Picnics, the Daily and the wardrobe over it).
      S.netEvents.length = 0;
      const s = ensurePractice();
      const me = s.w.byId.get('me');
      me.coat = P().coat;
      dress(s.w);
      syncOthers(s.w);
      const wardrobe = S.screen === 'wardrobe';
      // In the wardrobe the hamster trots out onto the cloth, clear of its burrow and flag, to pose.
      const out = me.burrow.ny < -0.5 ? 270 : 110; // the camera looks from the bottom edge: keep its burrow out of the shot
      const spot = wardrobe ? { x: me.burrow.x + me.burrow.nx * out, y: me.burrow.y + me.burrow.ny * out } : null;
      const toSpot = () => {
        const dx = spot.x - me.x;
        const dy = spot.y - me.y;
        const d = Math.hypot(dx, dy);
        const k = d > 8 ? Math.min(1, d / 60) / d : 0;
        return { mx: dx * k, my: dy * k, dash: false };
      };
      // Keep the fitting room clear: no food on the way or round the spot to nibble or block the view.
      if (spot) for (const f of [...s.w.food.values()]) if ((f.x - spot.x) ** 2 + (f.y - spot.y) ** 2 < 170 ** 2) s.w.removeFood(f.id);
      const events = s.step(gdt, () => (wardrobe ? toSpot() : myInput(s.w, me)));
      for (const e of events) if (e.k !== 'bumpOut') juice(e, s.w, 'me');
      trails(s.w, gdt);
      w = s.w;
      meId = 'me';
      practice = true;
      setControls(false);
      input.setEnabled(!wardrobe);
      if (S.net) S.net.lobbyPresence(me, me.heap);
      S.camTarget = me;
      if (wardrobe) {
        // Once there, turn to face the camera.
        if (me.speed < 15 && Math.hypot(spot.x - me.x, spot.y - me.y) < 14) me.a = turnTo(me.a, Math.PI / 2, 1 - Math.exp(-dt * 5));
        const portrait = document.body.classList.contains('portrait');
        view = portrait
          ? { mode: 'fixed', x: spot.x, y: spot.y + 62, dist: 3.5, pitch: 0.6, lift: 0.1 }
          : { mode: 'fixed', x: spot.x + 34, y: spot.y + 6, dist: 2.1, pitch: 0.5, lift: 0.12 };
        tags = false;
        showRing = false;
        ui.render('wardrobe', wardrobeView());
        setFlow('wardrobe');
      } else if (S.screen === 'picnics') {
        ui.render('picnics', picnicsView());
        setFlow('picnics');
      } else if (S.screen === 'daily') {
        ui.render('daily', dailyView());
        setFlow('daily');
      } else {
        S.screen = 'lobby';
        ui.render('lobby', lobbyView());
        setFlow('lobby');
      }
    }

    // Camera and drawing.
    const tgt = S.camTarget && w && w.byId.get(S.camTarget.id) ? S.camTarget : null;
    const touch = !!(ow && ow.controls && ow.controls.touch);
    if (view.mode === 'follow') {
      if (tgt) view = { mode: 'follow', x: tgt.x, y: tgt.y + (touch && world.vh > world.vw ? 60 : 0), vx: tgt.vx || 0, vy: tgt.vy || 0, zoom: S.zoom || 1, pitch: S.pitch, lift: S.lift };
      else view = { mode: 'overview' };
      // Capture (dev only): a director can point the camera somewhere else for a moment.
      if (dev && S.look && view.mode === 'follow') view = { ...view, x: S.look.x, y: S.look.y, vx: 0, vy: 0 };
    }
    world.camera(w, view, dt);
    const leader = w.leader ? w.leader() : null;
    const leaderId = leader && !practice ? leader.id : null;
    world.draw({ w, me: S.watch && !meId ? null : meId, leader: leaderId, practice, dt: gdt, noRing: !showRing });
    // A capture's low hero camera (dev only) leaves out the floating tags: from down there they'd stack under the timer.
    const hero = dev && S.pitch;
    if (tags && !hero) hudView.tags = tagsFor(w, S.watch && !meId ? null : meId, leaderId);
    if (meId && showRing && !practice && !hero) hudView.me = meBadge(w, w.byId.get(meId));
    if (S.hint && meId) {
      const me = w.byId.get(meId);
      if (me) hudView.hint = { ...S.hint, x: me.x, y: me.y };
    }
    if (S.big) hudView.big = bigView(S.big);
    hud.draw(hudView);
  }

  /** The end of a round: a close look at the winner, then the whole table. */
  function endView(w, dt) {
    const f = S.endFocus;
    if (f) {
      f.t += dt;
      const h = w.byId.get(f.id);
      if (h && f.t < 2.2) return { mode: 'fixed', x: h.x, y: h.y + 40, dist: 4.2 };
    }
    return { mode: 'overview' };
  }

  function introBig(introT, title, sub) {
    S.big = { kind: 'banner', text: title, sub, t: introT, life: ROUND.intro, fixed: true };
  }

  function bigView(b) {
    return { kind: b.kind === 'banner' ? 'banner' : 'word', text: b.text, sub: b.sub, u: b.t / b.life, color: b.color };
  }

  function nextText(m) {
    const s = Math.ceil(m.secondsLeft ?? 0);
    if (m.phase === 'roundEnd') return m.round >= m.rounds ? `Results in ${s}` : `Next round in ${s}`;
    return `Back to the lobby in ${s}`;
  }

  function placeOf(w, me) {
    const st = w.standings();
    const mine = st.find((r) => r.id === me.id);
    const top = st[0];
    return { place: mine ? mine.place : 1, heap: fmt(me.heap), leaderHeap: top && top.id !== me.id && mine && mine.place > 1 ? fmt(top.heap) : null };
  }

  function arrowsFor(w, me) {
    const out = [];
    if (me && !me.gone) out.push({ kind: 'home', x: me.burrow.x, y: me.burrow.y, seat: me.seat, pulse: me.fill >= 70 });
    for (const f of w.food.values()) if (f.type === GOLDEN && w.t >= f.land - 2) out.push({ kind: 'gold', x: f.x, y: f.y });
    const s = w.sweepNow ? w.sweepNow() : null;
    if (s && me) {
      const rx = me.x - s.px;
      const ry = me.y - s.py;
      const along = rx * s.dx + ry * s.dy;
      out.push({ kind: 'paw', x: s.px + s.dx * along, y: s.py + s.dy * along });
    }
    return out;
  }

  /** The last ten seconds tick. */
  function tickSound(left) {
    const sec = Math.ceil(left);
    if (sec === S.lastSec) return;
    S.lastSec = sec;
    if (sec <= 10 && sec >= 1) audio.play('tick');
  }

  function strainFor(me) {
    const f = me.fill;
    audio.strain(f > CAP && me.dizzyT <= 0 ? clamp((f - CAP) / (MAX - CAP), 0.08, 1) : 0);
  }

  /** Other players on the practice blanket: where their pages put them (only while they're in the lobby too). */
  function syncOthers(w) {
    if (!room) return;
    for (const h of w.hams) {
      if (!h.remote) continue;
      const pl = room.players.get(h.id);
      const raw = pl ? (room.presenceAt ? room.presenceAt(h.id, { angles: ['a'], snap: 160 }) || pl.presence : pl.presence) : null;
      const pr = raw ? readPresence(raw, w.arena) : null;
      const here = !!pr && pr.k === 'l' && pl.connected !== false;
      h.gone = !here;
      h.away = !here;
      if (!here) continue;
      w.setRemote(h.id, { x: pr.x, y: pr.y, a: pr.a, dash: !!(pr.s & 1), dizzy: !!(pr.s & 4) });
      h.coat = pr.c;
      h.fill = pr.f;
      h.heap = pr.h;
      dressHam(h, pr.o);
    }
  }

  // ------------------------------------------------------------------ screen views

  function levelBar() {
    const lv = levelOf(P().xp);
    return { level: lv.level, f: lv.into / lv.need, into: lv.into, need: lv.need };
  }

  function lobbyView() {
    const s = settings();
    const p = P();
    const portrait = document.body.classList.contains('portrait');
    const seats = [];
    const lob = S.net ? S.net.lobby() : null;
    const players = lob ? [...lob.players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 8) : [{ me: true, ready: false, host: false }];
    let mySeat = 0;
    for (const pl of players) {
      if (pl.me) mySeat = seats.length;
      const o = pl.me ? myOutfit() : outfitOf(pl.id);
      seats.push({ name: pl.me ? 'You' : pl.name, host: !!pl.host, me: !!pl.me, coat: pl.me ? p.coat : coatOf(pl.id), hat: o.hat, seat: seats.length });
    }
    const nb = s.bots === 'off' ? 0 : 8 - seats.length;
    for (let i = 0; i < nb && seats.length < 8; i++) seats.push({ name: BOTS[i].name, coat: BOTS[i].coat, hat: BOT_OUTFITS[BOTS[i].name]?.hat || '', seat: seats.length });
    while (seats.length < 8) seats.push({ empty: true });
    const arena = arenaById(s.arena);
    const day = today();
    const goals = todaysGoals(p, day);
    const fresh = earnedKeys(p).some((k) => !p.seen.includes(k));
    return {
      portrait,
      top: portrait ? Math.max(10, menuBottom() + 8) : clearTop(world.vw - 14 - cardWidth()),
      sideTop: Math.round(world.vh * 0.4),
      seats,
      isHost: !S.net || (room && room.isHost),
      canInvite: !!(room && room.kind === 'private' && ow && ow.ui && ow.ui.showInvite),
      arenaName: arena.name,
      twist: arena.twist,
      rounds: s.rounds,
      bots: s.bots,
      mySeat,
      stars: starCount(p),
      sheet: S.sheet,
      standalone: !S.net,
      level: levelBar(),
      streak: liveStreak(p, day),
      goalsDone: goals.filter((g) => g.done).length,
      fresh,
    };
  }

  function wardrobeView() {
    const p = P();
    const tab = S.tab;
    let items;
    if (tab === 'coat') items = COATS.map((c, i) => ({ arg: `coat:${i}`, name: c.name, on: p.coat === i, locked: !coatUnlocked(p, i), cond: coatCondition(i), key: `coat:${c.key}`, swatch: [c.base, c.belly, c.mark ? c.mark.color : c.dark] }));
    else if (tab === 'hat') items = [{ arg: 'hat:', name: 'No hat', on: !p.hat, locked: false, cond: '', key: '', icon: 'none' }, ...HAT_LIST.map((h) => ({ arg: `hat:${h.id}`, name: h.name, on: p.hat === h.id, locked: !itemUnlocked(p, 'hat', h.id), cond: itemCondition('hat', h.id), key: `hat:${h.id}`, icon: h.id }))];
    else if (tab === 'pop') items = POPS.map((x) => ({ arg: `pop:${x.id}`, name: x.name, on: p.pop === x.id, locked: !itemUnlocked(p, 'pop', x.id), cond: itemCondition('pop', x.id), key: `pop:${x.id}`, icon: x.id }));
    else items = TRAILS.map((x) => ({ arg: `trail:${x.id}`, name: x.name, on: p.trail === x.id, locked: !itemUnlocked(p, 'trail', x.id), cond: itemCondition('trail', x.id), key: `trail:${x.id}`, icon: x.id }));
    for (const it of items) it.fresh = !!it.key && !it.locked && !p.seen.includes(it.key);
    // What a tab shows as "New!" counts as seen a moment later.
    const unseen = items.filter((it) => it.fresh).map((it) => it.key);
    if (unseen.length && !seenTimer) {
      seenTimer = setTimeout(() => {
        seenTimer = null;
        for (const k of unseen) if (!p.seen.includes(k)) p.seen.push(k);
        store.save();
      }, 2500);
    }
    const tabs = ['coat', 'hat', 'pop', 'trail'].map((t) => ({ id: t, name: { coat: 'Coats', hat: 'Hats', pop: 'Pops', trail: 'Trails' }[t], fresh: earnedKeys(p).some((k) => k.startsWith(`${t}:`) && !p.seen.includes(k)) }));
    return { tab, tabs, items, level: levelBar(), portrait: document.body.classList.contains('portrait'), top: clearTop(world.vw - 400) };
  }
  let seenTimer = null;

  function coatOf(id) {
    const pl = room && room.players.get(id);
    const pr = pl ? readPresence(pl.presence, null) : null;
    return pr ? pr.c : 0;
  }
  function outfitOf(id) {
    const pl = room && room.players.get(id);
    const pr = pl ? readPresence(pl.presence, null) : null;
    return pr ? pr.o : { hat: '', pop: 'crumbs', trail: 'dust' };
  }

  function picnicsView() {
    const p = P();
    return {
      sel: S.plate,
      stars: starCount(p),
      crown: CROWN_STARS,
      plates: ARENAS.map((a, i) => ({
        name: a.name,
        twist: a.twist,
        won: p.picnics.won[i],
        stars: p.picnics.stars[i],
        goals: ['Win', `Bank ${fmt(PICNIC_GOALS[i].heap)}`, PICNIC_GOALS[i].text],
        best: p.picnics.best[i] ? fmt(p.picnics.best[i]) : '',
        locked: !picnicOpen(p, i),
        unlock: `Win Picnic ${i}`,
        img: `assets/plates/plate-${i}.jpg`,
        specials: PICNIC_SPECIALS[i],
      })),
    };
  }

  function dailyView() {
    const day = today();
    const a = arenaById(dailyArena(day));
    const d = new Date(day * 86400000);
    const p = P();
    const goals = todaysGoals(p, day).map((g) => {
      const def = goalDef(g.id);
      return { text: def.text(def.n), have: Math.min(g.have, def.n), n: def.n, done: g.done };
    });
    return {
      date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      img: `assets/plates/plate-${a.id}.jpg`,
      arenaName: a.name,
      twist: a.twist,
      best: p.daily.day === day && p.daily.best ? fmt(p.daily.best) : '',
      played: p.daily.lastDay === day,
      rank: S.daily.rank,
      top: S.daily.top,
      goals,
      streak: liveStreak(p, day),
    };
  }

  function boardView(net, w) {
    const m = net.match;
    const last = m.last;
    const scores = m.scores || {};
    const rows = m.seats.map((seat, i) => ({
      id: seat.id,
      name: seat.me ? 'You' : seat.name,
      me: !!seat.me,
      heap: last && last.points ? fmt(last.points[seat.id] ?? 0) : '0',
      raw: last && last.points ? (last.points[seat.id] ?? 0) : 0,
      total: fmt(scores[seat.id] ?? 0),
      ...seatRow(seat, w, i),
    }));
    rows.sort((a, b) => b.raw - a.raw);
    let place = 0;
    rows.forEach((r, i) => {
      if (i === 0 || r.raw !== rows[i - 1].raw) place = i + 1;
      r.place = place;
    });
    const bw = Math.min(460, world.vw - 24);
    return { title: m.rounds > 1 ? `Round ${m.round} of ${m.rounds}` : 'Round over', rows, why: reasonLine(w, rows), next: '', top: clearTop((world.vw - bw) / 2), summary: S.matchSummary };
  }

  function resultsView(net, w) {
    const m = net.match;
    const res = m.results || m.standings || [];
    const podium = res.slice(0, 3).map((r) => {
      const seat = m.seats.find((s) => s.id === r.id);
      const h = w ? w.byId.get(r.id) : null;
      return { name: seat && seat.me ? 'You' : r.name, total: fmt(r.points), place: r.place, coat: h ? h.coat : 0, seat: h ? h.seat : 0, hat: h ? h.hat : '', me: !!(seat && seat.me) };
    });
    const mine = res.find((r) => m.seats.find((s) => s.id === r.id && s.me));
    const lines = [];
    if (mine) lines.push({ text: `Total ${fmt(mine.points)}` });
    if (mine && mine.place === 1 && S.matchPops === 0) lines.push({ text: 'Never popped!', best: true });
    lines.push(...S.matchLines.slice(0, 3));
    return { podium, myPlace: mine ? mine.place : 0, headline: 'Results', lines, next: '', summary: S.matchSummary };
  }

  requestAnimationFrame(frame);
}
