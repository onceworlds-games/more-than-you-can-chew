// More Than You Can Chew: the page. Joins the room first, then runs one of four worlds (the title's attract mode, the
// lobby's practice blanket, a solo Picnic or Daily, or the online round) and draws it with its HUD and screens.

import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createFx, drawScreenParts } from './fx.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUi } from './ui.js';
import { createStore, recordRound, coatUnlocked, coatCondition, picnicOpen, dayNumber, dailyArena, dailyScore, copyProfile, newCoats } from './profile.js';
import { createLocalSession, attractBots } from './session.js';
import { createOnline, JOIN, readSettings, readPresence } from './net.js';
import { createBrain } from './brain.js';
import { biscuitTexture } from './biscuit.js';
import { ARENAS, arenaById } from './arenas.js';
import { buildGround } from './ground.js';
import { BOTS, LADDER_SKILL, DIFFICULTY, COATS, FOODS, GOLDEN, CAP, MAX, ROUND, POP } from './config.js';

const params = new URLSearchParams(location.search);
async function importHelpers() {
  try {
    const [m, h, b] = await Promise.all([import('/__onceworlds/v1/match.js'), import('/__onceworlds/v1/host.js'), import('/__onceworlds/v1/bots.js')]);
    return { createMatch: m.createMatch, createHost: h.createHost, createBots: b.createBots, t: h.t };
  } catch {
    return null;
  }
}

const withTimeout = (p, ms, fallback = null) => Promise.race([Promise.resolve(p).catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CRUMBS = [
  ['#2E2A29', '#E9E1D3'],
  ['#B5733A', '#E8B77A'],
  ['#4A5FB8', '#2E3B80'],
  ['#E8B35C', '#F6D9A0'],
  ['#E33A3A', '#FFD34D'],
  ['#C98A4B', '#4A2A18'],
  ['#FFC928', '#FFF6C2'],
];

async function boot() {
  const ow = window.onceworlds || null;
  const dev = !/onceworldsusercontent\.com$/.test(location.hostname);
  const autoplay = dev && params.get('autoplay') === '1';
  // Join first, before anything is built, so a reload keeps its seat.
  const joinRoom = () => (ow && ow.rooms && ow.rooms.join ? Promise.resolve(ow.rooms.join(JOIN)).catch(() => null) : Promise.resolve(null));
  let joining = joinRoom();
  const helpersP = importHelpers();

  const canvas = document.getElementById('game');
  const fx = createFx();
  const renderer = createRenderer(canvas, fx);
  const hud = createHud(renderer);
  const input = createInput(canvas, renderer, ow);
  const audio = createAudio();
  const store = createStore(ow);
  try {
    document.documentElement.style.setProperty('--tex', `url(${biscuitTexture(192).toDataURL()})`);
  } catch {
    /* the plain biscuit colour still works */
  }
  try {
    if (ow && ow.ui && ow.ui.setLook) ow.ui.setLook({ accent: '#FFCB2E', panel: '#3B2218', text: '#FFF2D9' });
  } catch {
    /* outside the platform */
  }

  const S = {
    screen: 'title',
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
    roundSeen: '',
    endSeen: '',
    watch: null,
    ateAt: 0,
    lastT: 0,
    daily: { top: [], rank: null },
    matchPops: 0,
    matchLines: [],
    pick: 0,
    camTarget: null,
    lastSec: -1,
    autoBrain: null,
    netEvents: [],
  };
  const P = () => store.p;

  // ------------------------------------------------------------------ sizing, reserved areas

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
    renderer.resize(w, h, pixelRatio());
    document.body.classList.toggle('portrait', h > w * 1.1 && w < 700);
    document.body.classList.toggle('short', h < 560);
  }
  resize();
  window.addEventListener('resize', resize);
  try {
    if (ow && ow.ui) {
      reserved = ow.ui.reserved || null;
      ow.on('reserved', (r) => (reserved = r));
    }
    if (ow && ow.settings && ow.settings.on) {
      fx.setReduced(!!ow.settings.reducedMotion);
      ow.settings.on('change', (s) => {
        fx.setReduced(!!(s && s.reducedMotion));
        resize();
      });
    }
  } catch {
    /* outside the platform */
  }
  const reservedList = () => (Array.isArray(reserved) ? reserved : [{ kind: 'menu', x: 0, y: 0, w: 150, h: 70 }]);
  /** The lobby card's width (style.css), and how high it can sit when its left edge is at `left`. */
  const cardWidth = () => (document.body.classList.contains('short') ? Math.min(620, renderer.vw - 170) : 350);
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

  // ------------------------------------------------------------------ the screens

  const ui = createUi(document.getElementById('ui'), {
    press: (act) => {
      audio.unlock();
      if (act === 'noop' || act === 'closeSheet') return;
      audio.play(act === 'arena' || act === 'coat' || act === 'rounds' || act === 'bots' || act === 'plate' ? 'soft' : 'crunch');
    },
    play: () => play(),
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
    coat: (d) => {
      // Browse every coat; wear the ones you've earned.
      const p = P();
      S.pick = (S.pick + Number(d) + COATS.length) % COATS.length;
      if (coatUnlocked(p, S.pick)) {
        p.coat = S.pick;
        store.save();
      }
    },
    sheet: (name) => (S.sheet = name),
    closeSheet: () => (S.sheet = null),
    invite: () => {
      try {
        ow.ui.showInvite();
      } catch {
        /* outside the platform */
      }
    },
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
    skip: () => S.net && S.net.skip(),
    next: () => S.net && S.net.skip(),
    resume: () => setPaused(false),
    quit: () => {
      setPaused(false);
      backToLobby();
    },
    rejoin: () => rejoin(),
  });
  const localSettings = { arena: 0, rounds: 1, bots: 'normal' };
  const settings = () => (S.net ? S.net.settings() : readSettings(localSettings));

  // ------------------------------------------------------------------ the room

  let room = null;
  async function connect() {
    const [r, helpers] = await Promise.all([joining, helpersP]);
    if (!r || !helpers) return;
    room = r;
    try {
      S.net = createOnline(room, helpers, { coat: () => P().coat, now: () => performance.now(), onEvent: (e) => S.netEvents.push(e) });
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
      fx.confetti(0, 0, renderer.vw, 140);
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
  });

  let attractRound = 0;
  function newAttract() {
    attractRound++;
    S.attract = createLocalSession({ arena: 0, seed: `title:${attractRound}`, bots: attractBots(), intro: 0, duration: 75 });
    // Start a little in: food already strewn, a toss on its way.
    for (let i = 0; i < 60 * 3; i++) S.attract.step(1 / 60);
    S.attract.w.drain();
  }
  newAttract();

  const titleView = () => ({ best: P().bests.round > 0 ? fmt(P().bests.round) : '', keys: !(ow && ow.controls && ow.controls.touch) });

  function play() {
    audio.unlock();
    audio.music('menu');
    S.screen = 'lobby';
    S.pick = P().coat;
    renderer.cam.ready = false;
    // In a public server, Play is your Ready (a lone player starts at once).
    if (S.net && room && room.kind === 'public' && room.match.phase === 'lobby') S.net.ready(true);
  }

  input.onKeyDown((e) => {
    if (S.screen === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      audio.unlock();
      audio.play('crunch');
      play();
    } else if (e.code === 'Escape' && S.sheet) S.sheet = null;
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
    if (info.kind === 'picnic') {
      if (!picnicOpen(p, info.n)) return;
      arena = info.n;
      seed = `picnic:${info.n}:${Math.floor(Math.random() * 1e9)}`;
      skill = LADDER_SKILL[info.n];
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
    const bots = BOTS.slice(0, 7).map((b, i) => ({ name: b.name, kind: b.kind, coat: b.coat, skill: clamp(skill + (i % 3 - 1) * 0.04, 0, 1) }));
    S.solo = createLocalSession({ arena, seed, me: { id: 'me', name: 'You', coat: p.coat }, bots });
    S.soloInfo = info;
    S.soloResult = null;
    S.screen = 'solo';
    S.sheet = null;
    S.matchPops = 0;
    fx.clear();
    renderer.resetAnims();
    renderer.cam.ready = false;
    audio.music('play');
    S.autoBrain = null;
  }

  function hideLobby(on) {
    try {
      if (room && room.hideLobby) room.hideLobby(on);
    } catch {
      /* fine */
    }
  }

  function backToLobby() {
    S.solo = null;
    S.soloResult = null;
    S.screen = 'lobby';
    S.sheet = null;
    S.big = null;
    renderer.cam.ready = false;
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

  function finishSolo() {
    const s = S.solo;
    const w = s.w;
    const me = w.byId.get('me');
    const st = w.standings();
    const mine = st.find((r) => r.id === 'me');
    const place = mine ? mine.place : 8;
    const p = P();
    const before = copyProfile(p);
    const rec = recordRound(p, { heap: me.heap, pops: me.stats.pops, popsByBump: me.stats.bullied, golden: me.stats.golden, bestTrip: me.stats.bestTrip, lastBankLeft: me.stats.lastBank > 0 ? w.duration - me.stats.lastBank : null });
    const lines = [{ text: `Your heap ${fmt(me.heap)}` }, ...rec.lines];
    const info = S.soloInfo;
    let canNext = false;
    if (info.kind === 'picnic') {
      if (me.heap > p.picnics.best[info.n]) p.picnics.best[info.n] = me.heap;
      if (place === 1) {
        const first = !p.picnics.won[info.n];
        p.picnics.won[info.n] = true;
        if (first && info.n < 7) lines.push({ text: `${ARENAS[info.n + 1].name} is open!`, best: true });
        if (p.picnics.won.every(Boolean)) rec.badges.push('picnic-season');
      }
      canNext = info.n < 7 && picnicOpen(p, info.n + 1);
    } else if (info.kind === 'daily') {
      rec.badges.push('daily-crumbs');
      if (p.daily.day !== info.day) p.daily = { day: info.day, best: 0 };
      if (me.heap > p.daily.best) {
        p.daily.best = me.heap;
        store.submit('daily', dailyScore(info.day, me.heap)).then((r) => (S.daily.rank = r && r.rank ? r.rank : S.daily.rank));
      }
    }
    // A solo win counts like a match won.
    p.totals.matches++;
    if (place === 1) {
      p.totals.wins++;
      store.submit('wins', p.totals.wins);
      if (me.stats.pops === 0) rec.badges.push('clean-plate');
    }
    for (const c of newCoats(before, p)) lines.push({ text: `New coat: ${COATS[c].name}`, best: true });
    for (const b of rec.badges) store.award(b);
    store.submit('best-round', me.heap);
    store.save();
    S.soloResult = {
      place,
      podium: st.slice(0, 3).map((r) => {
        const h = w.byId.get(r.id);
        return { name: r.id === 'me' ? 'You' : r.name, coat: h.coat, seat: h.seat, total: fmt(r.heap), place: r.place };
      }),
      lines,
      canNext,
    };
    S.screen = 'soloResults';
    if (place === 1) {
      audio.play('fanfare');
      fx.confetti(0, 0, renderer.vw, 160);
    }
    audio.music('menu');
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
    const p = renderer.toScreen(x, y);
    return p.x > -m && p.y > -m && p.x < renderer.vw + m && p.y < renderer.vh + m;
  };

  function showHint(key, text, opts = {}) {
    const p = P();
    if (!opts.always && p.hints[key]) return;
    if (S.hint && S.hint.age < S.hint.life * 0.7 && !opts.force) return;
    p.hints[key] = true;
    store.save();
    S.hint = { text, age: 0, life: opts.life || 2.6, hot: !!opts.hot };
  }

  function juice(e, w, meId) {
    const h = w.byId.get(e.id);
    const mine = !!meId && e.id === meId;
    const near = h ? onScreen(h.x, h.y) : false;
    switch (e.k) {
      case 'eat': {
        const size = FOODS[e.type].size;
        renderer.gulp(e.id, size);
        if (near) fx.crumbs(e.x, e.y, 3 + Math.min(6, Math.round(size / 5)), CRUMBS[e.type] || CRUMBS[0], 80, 0.5);
        if (mine) {
          audio.play('munch', { size, fill: e.fill });
          S.ateAt = w.t;
          if (e.type === GOLDEN) fx.text(e.x, e.y - 24, '+60', '#FFCB2E', 34);
        }
        break;
      }
      case 'pop': {
        if (h) fx.stars(h, POP.dizzy);
        renderer.squash(e.id, 0.55);
        if (near || mine) {
          fx.ring(e.x, e.y, 140, '#FFF2D9');
          fx.crumbs(e.x, e.y, 24, ['#FF4D6D', '#FFF2D9', '#E3A24F', '#FFCB2E'], 280, 1.2);
          fx.dust(e.x, e.y, 10, 16);
          audio.play('pop');
          fx.shake(mine ? 0.75 : 0.35);
          fx.hitStop(0.09);
        }
        fx.text(e.x, e.y - 44, 'POP!', mine ? '#FF4D6D' : '#FFF2D9', mine ? 46 : 32, 1.3);
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
        renderer.happy(e.id, 1);
        if (h) {
          const hs = renderer.heapSpot(h.burrow);
          if (near || mine) {
            fx.text(hs.x + 10, hs.y - 70, `+${e.worth}`, '#FFCB2E', mine ? 42 : 28, 1.3);
            fx.crumbs(hs.x, hs.y - 6, 10, ['#E3A24F', '#FFF2D9', '#FFCB2E'], 70, 1);
          }
        }
        if (mine) {
          const n = e.counts ? e.counts.reduce((a, b) => a + b, 0) : Math.ceil(e.worth / 6);
          audio.play('bank', { n, worth: e.worth, fill: e.fill });
        }
        break;
      }
      case 'hit': {
        renderer.squash(e.id, 0.45);
        if (near || mine) {
          fx.dust(e.x, e.y, 8, 12);
          audio.play(e.kind === 'paw' ? 'swat' : 'hit');
          fx.hitStop(0.05);
          fx.shake(mine ? 0.42 : 0.15);
        }
        break;
      }
      case 'dash':
        renderer.squash(e.id, -0.25);
        if (near) fx.dust(e.x, e.y, 4, 8);
        if (mine || near) audio.play('dash');
        break;
      case 'lost':
        if (near || mine) fx.text(e.x, e.y - 34, `-${e.worth}`, '#C9BFB6', mine ? 38 : 26, 1.6);
        if (mine) audio.play('lost');
        break;
      case 'end':
        audio.play('buzzer');
        break;
      default:
        break;
    }
  }

  /** Things that happen on the schedule's clock: the hand, a golden seed's light, the cat. */
  function scheduleBeats(w, t0, t1, meId) {
    if (t1 <= t0) return;
    for (const ts of w.sched.tosses) {
      if (ts.at > t0 && ts.at <= t1 && onScreen(ts.x, ts.y, 200)) audio.play('toss');
      if (ts.land > t0 && ts.land <= t1 && onScreen(ts.x, ts.y, 100)) {
        audio.play('land');
        fx.dust(ts.x, ts.y, 6, 18);
      }
    }
    for (const g of w.sched.goldens) {
      if (g.at > t0 && g.at <= t1) {
        audio.play('golden');
        if (meId) showHint('golden', 'Golden seed!');
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
        fx.shake(0.25);
      }
    }
    if (w.t >= w.duration - 30 && t0 < w.duration - 30 && t1 >= w.duration - 30) audio.music('late');
  }

  function playHints(w, me) {
    if (!me) return;
    const t = w.t;
    if (t > 3.5 && S.ateAt === 0 && me.fill === 0 && me.heap === 0) showHint('eat', 'Run over food');
    if (me.fill >= 70 && me.fill <= CAP) showHint('home', 'Full? Go home!');
    if (me.fill > CAP) showHint('over', 'Too full! Dodge food', { hot: true });
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
    return { coat: h ? h.coat : 0, seat: h ? h.seat : i };
  }

  function reasonLine(w, ranked) {
    if (!w || !ranked.length) return '';
    const win = w.byId.get(ranked[0].id);
    let popper = null;
    for (const h of w.hams) if (!popper || h.stats.pops > popper.stats.pops) popper = h;
    const name = (h) => (h.id === S.net?.me ? 'You' : h.name);
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
    const p = P();
    const before = copyProfile(p);
    const rec = recordRound(p, r);
    for (const b of rec.badges) store.award(b);
    store.submit('best-round', r.heap);
    S.matchLines.push(...rec.lines);
    for (const c of newCoats(before, p)) S.matchLines.push({ text: `New coat: ${COATS[c].name}`, best: true });
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
      if (!S.autoBrain || S.autoBrain.w !== w) S.autoBrain = { w, b: createBrain(me, w, { skill: 0.9, kind: 'plain', seed: 'auto' }) };
      const i = S.autoBrain.b.think(w, me, 1 / 60);
      return i || { mx: 0, my: 0, dash: false };
    }
    return input.read(me);
  }

  let stripKey = '';
  /** The platform's Ready strip: off where Ready makes no sense (the title, Picnics, the Daily, a solo round). */
  function syncStrip() {
    if (!room || !room.match) return;
    const hide = S.screen === 'title' || S.screen === 'picnics' || S.screen === 'daily' || S.screen === 'solo' || S.screen === 'soloResults';
    const key = `${hide}|${room.match.id}|${room.match.phase}`;
    if (key === stripKey) return;
    stripKey = key;
    hideLobby(hide);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    S.camTarget = null;
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.1);
    const gdt = fx.gate(dt);
    fx.step(dt);
    if (S.hint) {
      S.hint.age += dt;
      if (S.hint.age >= S.hint.life) S.hint = null;
    }
    if (S.big) {
      S.big.t += dt;
      if (S.big.t >= S.big.life) S.big = null;
    }

    // A match takes its players out of whatever they were doing; someone watching it only sees it from the lobby.
    const pulled = room && !room.spectating ? ['title', 'lobby', 'picnics', 'daily', 'solo', 'soloResults'] : ['lobby'];
    if (S.net && onlineActive() && pulled.includes(S.screen)) {
      S.solo = null;
      S.paused = false;
      S.screen = 'match';
      S.sheet = null;
      fx.clear();
      renderer.resetAnims();
      renderer.cam.ready = false;
    }
    if (S.screen === 'match' && !onlineActive()) {
      S.screen = 'lobby';
      renderer.cam.ready = false;
      audio.music('menu');
      audio.strain(0);
    }
    if (autoplay && S.screen === 'title' && now > 1200) play();

    let w;
    let meId = null;
    let mode = 'follow';
    const hudView = { dt, reserved: reservedList() };
    let showRing = true;
    let tags = true;
    let practice = false;

    if (S.screen === 'title' || (S.screen === 'closed' && !S.solo && !onlineActive())) {
      const s = S.attract;
      s.step(gdt);
      for (const e of s.w.drain()) juice(e, s.w, null);
      if (s.phase === 'end') newAttract();
      w = S.attract.w;
      mode = 'drift';
      showRing = false;
      tags = false;
      setControls(false);
      setFlow(S.screen === 'closed' ? 'closed' : 'title');
      ui.render(S.screen === 'closed' ? 'closed' : 'title', S.screen === 'closed' ? S.closed : titleView());
    } else if (S.screen === 'match' && !S.net.world) {
      // The round's world comes with the host's round data: the blanket keeps moving until then.
      S.net.frame(gdt, null);
      S.attract.step(gdt);
      S.attract.w.drain();
      w = S.attract.w;
      mode = 'drift';
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
      // Phase changes: the intro's banner, EAT!, the buzzer.
      const pk = `${net.roundKey}:${ph}`;
      if (pk !== S.phaseSeen) {
        const prev = S.phaseSeen.split(':').pop();
        S.phaseSeen = pk;
        if (ph === 'intro') {
          audio.music('play');
          S.ateAt = 0;
          S.lastSec = -1;
          renderer.cam.ready = false;
          if (m.round <= 1) {
            S.matchPops = 0;
            S.matchLines = [];
          }
        }
        if (ph === 'round' && prev === 'intro') {
          S.big = { kind: 'word', text: 'EAT!', t: 0, life: 0.9, color: '#FFCB2E' };
          audio.play('eat');
        }
        if (ph === 'roundEnd') {
          S.big = { kind: 'word', text: 'Time!', t: 0, life: 1.1 };
          audio.music('menu');
          audio.strain(0);
          roundEndOnce();
        }
      }
      if (room && room.spectating) {
        if (!S.watch || !w.byId.get(S.watch)) S.watch = w.leader() ? w.leader().id : w.hams[0] && w.hams[0].id;
      } else S.watch = null;
      const playing = (ph === 'round' || ph === 'intro') && !!me;
      setControls(ph === 'round' && !!me);
      if (ph === 'intro') {
        const introT = ROUND.intro - (m.secondsLeft ?? 0);
        introBig(introT, `Round ${m.round}`, m.rounds > 1 ? `of ${m.rounds}` : '');
        hudView.timer = { left: ROUND.seconds, total: ROUND.seconds };
      }
      if (ph === 'round') {
        hudView.timer = { left: m.secondsLeft ?? 0, total: ROUND.seconds };
        if (me) hudView.place = placeOf(w, me);
        hudView.arrows = arrowsFor(w, me);
        if (me) strainFor(me);
      } else audio.strain(0);
      if (ph === 'roundEnd' || ph === 'results') {
        mode = 'overview';
        showRing = false;
      }
      if (S.watch && (ph === 'round' || ph === 'intro')) hudView.tag = 'Watching · next round';
      if (ph === 'roundEnd') ui.render('board', boardView(net, w));
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
        hudView.timer = { left: s.timeLeft, total: w.duration };
        tickSound(s.timeLeft);
        hudView.place = placeOf(w, me);
        hudView.arrows = arrowsFor(w, me);
      } else audio.strain(0);
      if (s.phase === 'intro') {
        const title = S.soloInfo.kind === 'picnic' ? `Picnic ${S.soloInfo.n + 1}` : S.soloInfo.kind === 'daily' ? 'Daily' : 'Round 1';
        introBig(s.introT, title, w.arena.twist);
        hudView.timer = { left: w.duration, total: w.duration };
      }
      if (wasPhase === 'round' && s.phase === 'end') {
        S.big = { kind: 'word', text: 'Time!', t: 0, life: 1.1 };
        audio.music('off');
      }
      if (s.phase === 'end' && s.endT > 2.2 && !S.soloResult) finishSolo();
      setControls(s.phase === 'round' && !S.paused);
      if (s.phase === 'end') {
        mode = s.endT > 0.8 ? 'overview' : 'follow';
        showRing = false;
      }
      if (S.paused) ui.render('pause');
      else if (S.screen === 'soloResults') ui.render('solo', S.soloResult);
      else ui.render('none');
      setFlow(S.paused ? 'paused' : S.screen === 'soloResults' ? 'soloResults' : s.phase === 'round' ? 'play' : s.phase);
      S.camTarget = me;
    } else {
      // The lobby (and Picnics and Daily over it).
      S.netEvents.length = 0;
      const s = ensurePractice();
      const me = s.w.byId.get('me');
      me.coat = S.pick;
      syncOthers(s.w);
      const events = s.step(gdt, () => myInput(s.w, me));
      for (const e of events) if (e.k !== 'bumpOut') juice(e, s.w, 'me');
      w = s.w;
      meId = 'me';
      practice = true;
      setControls(false);
      input.setEnabled(true);
      if (S.net) S.net.lobbyPresence(me, me.heap);
      S.camTarget = me;
      if (S.screen === 'picnics') {
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

    syncStrip();

    // Camera and drawing.
    const tgt = S.camTarget && w && w.byId.get(S.camTarget.id) ? S.camTarget : null;
    const touch = !!(ow && ow.controls && ow.controls.touch);
    renderer.camera(w, mode === 'follow' && tgt ? { mode, x: tgt.x, y: tgt.y, vx: tgt.vx || 0, vy: tgt.vy || 0, touch } : mode === 'follow' ? { mode: 'overview' } : { mode }, dt);
    const leader = w.leader ? w.leader() : null;
    renderer.draw({ w, me: S.watch && !meId ? null : meId, leader: leader && !practice && S.screen !== 'title' ? leader.id : null, practice, dt, noRing: !showRing, noTags: !tags });
    if (S.hint && meId) {
      const me = w.byId.get(meId);
      if (me) hudView.hint = { ...S.hint, x: me.x, y: me.y };
    }
    if (S.big) hudView.big = bigView(S.big);
    hud.draw(hudView);
    if (fx.parts.length) {
      const c = renderer.ctx;
      c.save();
      c.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
      drawScreenParts(c, fx);
      c.restore();
    }
  }


  function introBig(introT, title, sub) {
    if (introT < 1.1) S.big = { kind: 'banner', text: title, sub, t: introT, life: 1.1, fixed: true };
    else {
      const n = 3 - Math.floor(introT - 1.1);
      if (n >= 1 && n <= 3) {
        const key = `n${n}`;
        if (!S.big || S.big.key !== key) {
          S.big = { kind: 'word', text: String(n), t: (introT - 1.1) % 1, life: 1, key };
          audio.play('count', { n });
        }
      }
    }
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
      // Point at the band where it's nearest.
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
    }
  }

  // ------------------------------------------------------------------ screen views

  function lobbyView() {
    const s = settings();
    const p = P();
    const portrait = document.body.classList.contains('portrait');
    // The same order as the practice blanket, so a head's bandana matches its burrow.
    const seats = [];
    const lob = S.net ? S.net.lobby() : null;
    const players = lob ? [...lob.players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 8) : [{ me: true, ready: false, host: false }];
    let mySeat = 0;
    for (const pl of players) {
      if (pl.me) mySeat = seats.length;
      seats.push({ name: pl.me ? 'You' : pl.name, ready: !!pl.ready, host: !!pl.host, me: !!pl.me, coat: pl.me ? S.pick : coatOf(pl.id), seat: seats.length });
    }
    const nb = s.bots === 'off' ? 0 : 8 - seats.length;
    for (let i = 0; i < nb && seats.length < 8; i++) seats.push({ name: BOTS[i].name, coat: BOTS[i].coat, seat: seats.length });
    while (seats.length < 8) seats.push({ empty: true });
    const arena = arenaById(s.arena);
    return {
      portrait,
      top: portrait ? Math.max(10, menuBottom() + 8) : clearTop(renderer.vw - 14 - cardWidth()),
      sideTop: Math.round(renderer.vh * 0.42),
      seats,
      isHost: !S.net || (room && room.isHost),
      canInvite: !!(room && room.kind === 'private' && ow && ow.ui && ow.ui.showInvite),
      arenaName: arena.name,
      twist: arena.twist,
      rounds: s.rounds,
      bots: s.bots,
      coat: S.pick,
      mySeat,
      coatName: COATS[S.pick].name,
      coatLocked: coatUnlocked(p, S.pick) ? '' : coatCondition(S.pick),
      picnicsWon: p.picnics.won.filter(Boolean).length,
      sheet: S.sheet,
      standalone: !S.net,
    };
  }

  function coatOf(id) {
    const pl = room && room.players.get(id);
    const pr = pl ? readPresence(pl.presence, null) : null;
    return pr ? pr.c : 0;
  }

  const minis = new Map();
  function mini(i, w = 112, h = 75) {
    const key = `${i}|${w}`;
    if (minis.has(key)) return minis.get(key);
    let url = '';
    try {
      const a = arenaById(i);
      const sc = Math.min(w / a.w, h / a.h) * 2;
      const c = buildGround(a, sc);
      url = c.toDataURL('image/jpeg', 0.85);
    } catch {
      url = '';
    }
    minis.set(key, url);
    return url;
  }

  function picnicsView() {
    const p = P();
    return {
      sel: S.plate,
      plates: ARENAS.map((a, i) => ({
        name: a.name,
        twist: a.twist,
        won: p.picnics.won[i],
        best: p.picnics.best[i] ? fmt(p.picnics.best[i]) : '',
        locked: !picnicOpen(p, i),
        unlock: `Win Picnic ${i}`,
        mini: picnicOpen(p, i) ? mini(i) : '',
      })),
    };
  }

  function dailyView() {
    const day = today();
    const a = arenaById(dailyArena(day));
    const d = new Date(day * 86400000);
    const p = P();
    return {
      date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
      mini: mini(a.id, 220, 147),
      arenaName: a.name,
      twist: a.twist,
      best: p.daily.day === day && p.daily.best ? fmt(p.daily.best) : '',
      rank: S.daily.rank,
      top: S.daily.top,
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
      raw: last && last.points ? last.points[seat.id] ?? 0 : 0,
      total: fmt(scores[seat.id] ?? 0),
      ...seatRow(seat, w, i),
    }));
    rows.sort((a, b) => b.raw - a.raw);
    let place = 0;
    rows.forEach((r, i) => {
      if (i === 0 || r.raw !== rows[i - 1].raw) place = i + 1;
      r.place = place;
    });
    const bw = Math.min(440, renderer.vw - 24);
    return { title: m.rounds > 1 ? `Round ${m.round} of ${m.rounds}` : 'Round over', rows, why: reasonLine(w, rows), next: '', canSkip: m.isHost, top: clearTop((renderer.vw - bw) / 2) };
  }

  function resultsView(net, w) {
    const m = net.match;
    const res = m.results || m.standings || [];
    const podium = res.slice(0, 3).map((r) => {
      const seat = m.seats.find((s) => s.id === r.id);
      const h = w ? w.byId.get(r.id) : null;
      return { name: seat && seat.me ? 'You' : r.name, total: fmt(r.points), place: r.place, coat: h ? h.coat : 0, seat: h ? h.seat : 0 };
    });
    const mine = res.find((r) => m.seats.find((s) => s.id === r.id && s.me));
    const lines = [];
    if (mine) lines.push({ text: `Total ${fmt(mine.points)}` });
    if (mine && mine.place === 1 && S.matchPops === 0) lines.push({ text: 'Never popped!', best: true });
    lines.push(...S.matchLines.slice(0, 3));
    return { podium, myPlace: mine ? mine.place : 0, headline: 'Results', lines, canNext: m.isHost, next: '' };
  }

  requestAnimationFrame(frame);
}

// Started last, once every module-level name above exists.
const posterName = params.get('poster');
if (posterName) {
  import('./poster.js')
    .then((m) => m.runPoster(posterName, params))
    .catch((e) => {
      document.body.dataset.error = String((e && e.stack) || e);
      document.body.dataset.ready = 'error';
    });
} else boot().catch((e) => console.error('[chew] boot failed', e));
