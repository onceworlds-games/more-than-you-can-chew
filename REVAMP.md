# Revamp: teardown and plan

Played the `main` build headless (16 s of autoplay on the Picnic Blanket, frames read at full size) and read every module.
This is the honest list, then the plan the rebuild follows.

## Teardown

### Looks cheap

- **A flat map, not a world.** Straight-down Canvas 2D: the "giant picnic at hamster scale" never shows, because nothing has
  height, light or distance. 80% of every frame is a flat gingham tile with fake crease lines that read as rendering glitches.
- **The stars are 45 px blobs seen from above.** A hamster is a rotated sprite: no face you can read, cheeks (the whole
  signature) barely visible until they turn pink. Eight of them look like eight coloured buttons.
- **Food is icon soup.** Seeds read as grey rice, nuts as brown dots; nothing looks edible, nothing glints.
- **Props are flat panels**: the basket is a rectangle with a pattern, the glass a yellow disc. Burrows are black ovals in a ring
  of oats; heaps are a few overlapping icons.
- **No light at all**: no shadows with direction, no time of day, no depth of field, no atmosphere. Every arena reads as a
  different wallpaper.

### Moves stiffly

- Hamsters slide and rotate as one piece; four foot dots wiggle. No anticipation, no squash on stops, no lean into turns, no
  head that looks where it's going, no idle life, no emotes, no celebration or sulk.
- Eating is a pulse on the cheek radius. A pop is a squashed sprite with stars. Banking is a number.
- Food pops into existence (the toss "shadow" is a grey blob); spills slide out flat.
- The camera follows with a lag and never reacts: no punch-in, no lean, no slow-mo for a pop or the win.
- UI biscuits snap in; counts jump.

### Feels floaty or slow

- 220 px/s empty and 90 px/s full in a 1,500 px field seen through a 1,000 px window: a trip home at full is 6-8 s of holding a
  direction with nothing to do.
- Eating has no rhythm: run over things, numbers go up. No escalation in sound or reward for a clean gobble through a cluster.
- The bump is a short lunge with a puff: no wind-up, no impact frame, no stars.

### Reads unclear

- The cheek "ring" on the floor is the only gauge and it's thin. Overstuffed is a pink tint you notice too late.
- Name tags float over tiny sprites; the leader's crown is an 8 px cap.

### Boring after one round, no reason to come back

- **The push-your-luck is hollow.** Overstuffing has no upside beyond carrying a bit more, so the right play is "bank at 85,
  always", and the POP (the pitch) becomes something you simply avoid. There is one decision and it's solved.
- No short-term goals: no combos, streaks, pickups or near-misses that pay.
- Mid-term: the arena twists are the only variety; nothing new appears over a session; round 20 plays like round 1.
- Long-term: 8 coats behind odd conditions, 10 badges, 3 boards. No level, no track, nothing unlocked per session, no daily
  goals, no streak, nothing to show off.

### What the best games of the kind do that this doesn't

- **Pikmin**: tiny creatures in a giant, almost-real world (real fabric, real fruit, real light), shallow depth of field. The
  scale *is* the charm.
- **Fall Guys / Stumble Guys**: squishy, physical characters whose every action is slapstick; cosmetics everyone wants and a
  progression track that hands out something every session.
- **Balatro / Peggle**: multipliers that escalate with sound and colour until the payout explodes: the risk is the fun.
- **Hungry Hungry Hippos / Agar.io**: one verb, instant feedback, a crowd fighting over the same pile.
- **Overcooked**: carrying something precious home through chaos.

## The plan

### 1. A real world: 3D, "golden-hour macro picnic"

Rebuild the renderer in three.js (Vite): a low camera at about 55 degrees, tilt-shift depth of field, so it looks like a macro
photograph of a real picnic with tiny hamsters in it.
- **Photo-real giant props** (Poly Haven, CC0): the wicker basket, a lemon, a croissant, an apple, a jug, the strawberry
  cake, the tea set, the cutting board, the lantern, a gnome, a stump, a clay pot. Real fabric and wood textures (gingham
  weave recoloured per arena, butcher block, farm table, linen, lawn, leaf litter).
- **Warm low sun** with soft shadows and long contact shadows, an HDRI sky for reflections, ACES tone mapping, warm grade,
  vignette, bloom on the golden seed and sparkles, drifting pollen motes in the light.
- **Instanced grass** around every blanket, swaying; giant blades the hamsters run past.
- **Food you want to eat**, modelled and instanced: striped sunflower seeds, glossy hazelnuts, dusty blueberries, crackers
  with docking holes, seeded strawberries with leaves, chunky cookies, a golden seed that glints.
- **Burrows** dug into the edge with dirt lips; **heaps** that are real piles of the food you banked, growing piece by piece.

### 2. Hamsters you'd adopt

- One soft, fused body (skinned mesh: hips, chest, head bones) with **cheek morph targets** that swell to twice the head's
  width and shine hot pink when overstuffed. Velvet "sheen" fur, coat markings painted per coat, glossy eyes, pink ears and
  paws, a bandana in the seat colour with its emblem.
- **Procedural animation with blended states**: idle (breathe, ear twitch, look around, groom), run (bouncy gallop, ears
  back), waddle (heavy sway when full), dash (anticipation squash, stretch, skid), eat (head dip, cheek gulp jiggle), strain
  (sweat drops, trembling), pop (cheeks burst, pancake flop, dizzy stars), stunned, bank (happy hop, food tumbling out),
  win (jump and twirl), lose (sulk). Head leads turns, body follows, everything springs back.
- Expressions: eyes blink, squeeze shut when straining, go `^ ^` when banking, spin when dizzy.

### 3. Feel

- Fixed-step simulation with interpolated drawing; snappier acceleration; heavier hamsters drift and skid.
- Hit-stop on bumps and pops, directional camera shake, camera punch-in on a pop and a stuffed bank, slow-mo on the win.
- Particles everywhere (crumbs, dust puffs from feet, sparks, confetti, sweat drops, seed sprays) from a pooled system.
- Layered synthesized sound: munches that rise in pitch through a gobble chain, cheek squeaks, a real pop, a cash-register
  bank with a chime per piece, music that builds in the last 30 s.

### 4. Depth: make the risk pay

- **Stuffed banks pay more.** Bank over 100: Stuffed, ×1.5. Over 120: Bursting, ×2. Now every trip is a gamble: stop at 95,
  or take one more cookie and waddle home through a field of food you can't refuse. The pop finally matters.
- **Gobble chains**: bites within 0.6 s of each other chain; each chained bite adds +1 that rides in your cheeks (lost on a
  pop). Rewards routing through clusters fast; the sound climbs with the chain.
- **Specials** (introduced one at a time up the Picnics ladder, all on in matches): Chili (4 s of full speed whatever your
  cheeks, dash recharges), Bubble gum (6 s shield: bumps bounce off, the paw can't swat you), Peppercorn (a trap: you sneeze
  1 s later and spit a third of your cheeks).
- Bots that understand all of it (personalities lean on different risks).

### 5. Reasons to come back

- **Hamster level** (XP from every round, daily goals and stars) with a reward track: hats, coats, pop effects and trails.
- **Wardrobe**: 12 hats, 10 coats, 6 pop effects, 6 trails, worn in every mode and seen by everyone online.
- **Picnic stars**: three per arena (win, reach the heap goal, the arena's own challenge): 24 stars, with rewards.
- **Daily**: the Daily Feast (same seed for everyone, board), three daily goals with XP, a day streak with a bonus.
- Badges that mean something (stuffed, bursting, gobble chains, streaks, all stars).

### 6. Every screen in the world

Title over a live 3D picnic, the lobby on the blanket, a wardrobe with your hamster turning on a plate, results on a podium of
real heaps with confetti, the Picnics as plates on a long table. HUD in the picnic's language (the biscuit stays as the
signature, baked properly).

### Order

1. Vite + three; pure modules move to `src/sim/` and keep their tests.
2. Rules for stuffed banks, gobble chains, specials; bots; tests and balance runs.
3. The 3D world on the Picnic Blanket: light, ground, grass, props, food, burrows, heaps, hamsters, camera, effects, HUD.
4. Screens and progression (level, wardrobe, stars, daily goals, streak), badges.
5. The other seven arenas.
6. Sound and music pass.
7. Capture, critique, repeat. Then posters, trailer, docs, check.
