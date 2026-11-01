// A round played on this page alone: the title's attract mode, the lobby's practice blanket, a Picnic and the Daily.
// The same world and bot brains the host runs online.

import { createWorld } from './sim/world.js';
import { createBrain } from './sim/brain.js';
import { arenaById } from './sim/arenas.js';
import { BOTS, ROUND } from './sim/config.js';

const STEP = 1 / 60;

/**
 * @param {object} o
 *   arena (id), seed, me ({ id, name, coat } or null), others ([{ id, name, coat }]: players moved by their own pages),
 *   meIndex (my place among the players),
 *   bots ([{ name, skill, kind?, coat? }]), duration, practice,
 *   intro (seconds, default ROUND.intro; 0 = start at once), onEvent(e)
 */
export function createLocalSession(o) {
  const seats = [];
  // Other players in the lobby: their own pages move them (setRemote), hidden until they're on the blanket. Every page
  // seats the players in the same order (meIndex is mine), so a burrow belongs to the same hamster everywhere.
  const humans = (o.others || []).map((p) => ({ id: p.id, name: p.name, bot: false, coat: p.coat ?? 0 }));
  if (o.me) humans.splice(Math.min(humans.length, o.meIndex ?? 0), 0, { id: o.me.id, name: o.me.name, bot: false, coat: o.me.coat });
  seats.push(...humans);
  (o.bots || []).forEach((b, i) => {
    const def = BOTS.find((d) => d.name === b.name) ?? BOTS[i % BOTS.length];
    seats.push({ id: `bot:${i + 1}`, name: b.name ?? def.name, bot: true, coat: b.coat ?? def.coat, kind: b.kind ?? def.kind, skill: b.skill ?? 0.5 });
  });
  const w = createWorld({
    arena: arenaById(o.arena),
    seed: o.seed,
    round: o.round ?? 1,
    duration: o.duration ?? ROUND.seconds,
    practice: !!o.practice,
    specials: o.specials,
    seats,
    brains: (h, world) => createBrain(h, world, { skill: h.skill, kind: h.kind, seed: `${o.seed}:${h.id}` }),
  });
  if (o.practice) {
    // In the lobby the bots doze at their doors.
    for (const h of w.hams) if (h.bot) h.brain = null;
  }
  for (const p of o.others || []) {
    const h = w.byId.get(p.id);
    if (!h) continue;
    h.remote = true;
    h.gone = true;
    h.away = true;
  }
  const intro = o.intro ?? ROUND.intro;
  const s = {
    kind: o.practice ? 'practice' : o.me ? 'solo' : 'attract',
    w,
    me: o.me ? o.me.id : null,
    phase: intro > 0 ? 'intro' : 'round',
    introT: 0,
    intro,
    endT: 0,
    acc: 0,
    paused: false,
    get timeLeft() {
      return Math.max(0, w.duration - w.t);
    },
    get mine() {
      return s.me ? w.byId.get(s.me) : null;
    },
    /** Advances by real time dt; `input` drives my hamster. Returns world events. */
    step(dt, input) {
      if (s.paused) return [];
      const out = [];
      if (s.phase === 'intro') {
        s.introT += dt;
        if (s.introT >= intro) {
          s.phase = 'round';
          out.push({ k: 'go' });
        }
        // The blanket is alive under the intro: shadows and tosses wait, hamsters stand at their doors.
        return out;
      }
      if (s.phase === 'round') {
        // Whole steps, then the remainder as a short one, so the world is drawn exactly where it is now (smooth at any
        // refresh rate, no judder between 60 Hz steps and 120 Hz frames).
        s.acc = Math.min(s.acc + dt, 0.25);
        while (s.acc > 1e-6) {
          const d = Math.min(STEP, s.acc);
          s.acc -= d;
          const me = s.mine;
          if (me && input) me.input = input();
          w.step(d);
          for (const e of w.drain()) out.push(e);
          if (w.over) {
            s.phase = 'end';
            break;
          }
        }
        return out;
      }
      if (s.phase === 'end') s.endT += dt;
      return out;
    },
  };
  return s;
}

/** The title's bots: six hamsters on the blanket. */
export function attractBots() {
  return [0, 1, 3, 4, 5, 6].map((i) => ({ name: BOTS[i].name, skill: 0.55, kind: BOTS[i].kind, coat: BOTS[i].coat }));
}
