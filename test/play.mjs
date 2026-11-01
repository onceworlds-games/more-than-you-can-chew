// Shared by the tests: whole rounds played by bots through the pure modules.
import { createWorld } from '../game/world.js';
import { createBrain } from '../game/brain.js';
import { arenaById } from '../game/arenas.js';
import { BOTS } from '../game/config.js';

/** Plays one round. `skills` per seat (default all 0.5); `kinds` per seat (default each bot's own). */
export function playRound({ arena = 0, seed = 1, round = 2, seats = 8, skills, kinds, dt = 1 / 30, duration, onStep } = {}) {
  const list = Array.from({ length: seats }, (_, i) => ({
    id: `bot:${i + 1}`,
    name: BOTS[i % BOTS.length].name,
    bot: true,
    skill: skills ? skills[i] : 0.5,
    kind: kinds ? kinds[i] : BOTS[i % BOTS.length].kind,
  }));
  const w = createWorld({
    arena: arenaById(arena),
    seed,
    round,
    duration,
    seats: list,
    brains: (h, world) => createBrain(h, world),
  });
  const counts = [];
  const events = [];
  let k = 0;
  while (!w.over) {
    w.step(dt);
    for (const e of w.drain()) events.push(e);
    if (k++ % 30 === 0) counts.push({ t: w.t, food: [...w.food.values()].filter((f) => w.t >= f.land).length });
    if (onStep) onStep(w);
  }
  return { w, counts, events, standings: w.standings() };
}

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
