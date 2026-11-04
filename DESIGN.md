# More Than You Can Chew

## The pitch

Stuff your hamster's cheeks at a giant picnic, waddle home to bank it, and don't bite off more than you can chew, or you POP.

## The goal in one line

**Carry food home in your cheeks. Biggest heap wins.**

What says it with no words: eight burrows round a gingham blanket, each with a heap of real food and a cocktail-stick flag
showing its number; furry hamsters whose cheek pouches balloon as they eat and blush hot pink past full, waddling slower and
slower back to their holes; a giant hand tossing food and pouring lines of seeds; a hamster that ate one seed too many going
POP and spraying everything across the cloth.

## The first minute

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0 s | **Lobby**, as soon as the page is up: no Play to press. The camera is at your burrow; your hamster (your coat, hat and bandana) can already run, eat practice crumbs and bank them. The lobby card shows the eight seats as portraits, your level, the settings, and Picnics, Daily and Wardrobe. | "Ready!" is the platform's strip |
| ~4 s | Ready, the platform's 3-2-1, and "EAT!": you're at your door and can run at once. A few seeds and a nut lie on your doorstep. | none |
| ~8 s | First bite: a munch, your pouches puff with a gulp bounce, the cheek ring round your feet starts to fill. Quick bites chain: "Gobble ×3!" floats up and a marimba climbs. | "Run over food", "Gobble chains add up!" |
| ~12 s | Cheeks at 70: you feel the waddle; the burrow arrow pulses. | "Full? Go home!" |
| ~18 s | You bank: food arcs out of the burrow onto your heap, chimes count up "+48", the flag's number ticks. | none: the count is the lesson |
| ~20 s | A giant hand's shadow slides in and pours a line of seeds across the cloth: run along it for a long gobble chain. | none |
| ~25 s | A shaft of light: a golden sunflower seed is about to land. Gold arrow at the screen edge. | "Golden seed!" |
| 30-50 s | Push your luck: past 100 the pouches blush and a sticker reads "Stuffed ×2"; past 120 "Bursting ×3" and they tremble. Bank now for double or triple, or POP: hit-stop, a spray of food, dizzy stars, rivals swarm. | "Stuffed! Bank it for ×2", after a pop "Bank sooner" |
| ~45 s | A rival waddles past with fat cheeks while your Bump is ready. | "Space: Bump!" (touch: "Bump!") |
| 60 s | The player knows the game: eat, chain, push to Stuffed, go home, don't pop, bump the fat ones. The cat comes at 2:02. | |

The first round is gentler: bots never bump during the first 30 s of round 1, and every burrow starts with food on its doorstep.
After the round: XP lines tick up, the level bar fills, a new hat or effect drops onto the card.

## Controls

| | Keyboard / mouse | Phone / tablet |
|---|---|---|
| Move | WASD or arrows, or the mouse: your hamster runs toward the cursor (it stops when the cursor is on it) | The platform's stick (`stick: 'analog'`, zone `wide`): analog speed and direction |
| Bump (dash) | Space, or click | One button, "Bump" (key Space) |
| Menus | Click / tap, Esc closes a sheet or pauses a Picnic / the Daily | Tap |

That is the whole game: move and one button. Eating and banking happen by touch. Mouse-follow switches on when the mouse
moves over the game and off when a movement key is pressed, so keyboard players never get dragged. A key held down is one
bump (`event.repeat` ignored).

## The rules (the core loop)

**Eat.** Run over food and you eat it, always. You can't refuse food you touch, so when you're full you steer around it.

**Cheeks.** Every food has a size (how much cheek it fills) and a worth (points when banked); for everything but the golden
seed they are the same number. Capacity is 100: "full". The fuller you are:
- the **slower** you run (240 px/s empty, 100 at 100, 72 at 140) and the heavier you turn;
- the **wider** your cheeks, so the more food you brush into by accident;
- past 100 you're **overstuffed**: every bite can **POP** you.

**Stuffed and Bursting.** A cheekful banked past 100 counts **×2** (Stuffed), past 120 **×3** (Bursting). That is the push-your-
luck: the safe trip home at 90 banks 90; the greedy one at 121 banks 363, if it gets home.

**POP.** Each bite that leaves you above 100 may pop you: from about 3% just over to 60% near 140 (`0.03 + 0.57·((f−100)/40)²`),
scaled by the bite's size (a seed is half as risky as a cracker, a cookie half again riskier); any bite past 140 pops for sure.
A pop sprays everything you held in a ring for anyone to grab and leaves you dizzy for 1.2 s. Your heap is never touched.

**Gobble chains.** Bites less than 0.6 s apart chain; every chained bite adds +1 that rides in your cheeks (banked with them,
lost if you pop, split if you spill). Pours and tight clusters are where chains come from.

**Bank.** Run into your burrow (a 64 px porch at its mouth) and everything in your cheeks goes to your heap. The round score is
your heap. Nobody can be bumped on the porch.

**Bump.** A short dash in the direction you're moving (0.25 s, then a 2.5 s cooldown). Ram another hamster and they spill a
third of what's in their cheeks, get knocked back and stunned for 0.4 s. Ram an overstuffed hamster and they POP. Bumping an
empty hamster only shoves it. A hamster that was just hit can't be hit again for 1 s.

**Food.** The blanket starts strewn with food and a few pieces on every doorstep. A giant picnicker's hand tosses a cluster
every 3.2 s or so (its shadow a second before it lands), and every ten seconds or so **pours** a line of seeds across the cloth
(a nut every fifth piece, a treat at the end). Four golden sunflower seeds a round land under a shaft of light: they fill 25 but
are worth 60.

**Specials** (one at a time, about every 16 s from 0:14, under a little whirl; Picnics introduce them one by one):
- **Chili**: 4 s at full speed whatever your cheeks hold, and your dash recharges at once.
- **Bubble gum**: for 6 s bumps and the paw bounce off you, and whoever bumped you flies back.
- **Peppercorn**: a tickle, then 0.9 s later a sneeze that spits a third of your cheeks forward (into a rival's path, or yours).

**The cat.** In the last 30 s the cat wakes up. Five times, a paw-shaped shadow darkens a band across the blanket for 1.4 s, then
the paw swats through it: hamsters in the band are flung, stunned and spill half their cheeks (overstuffed ones pop); food in the
band is scattered. Burrow porches are never swept. The music moves up a tone and tosses come faster.

**The buzzer.** At 0:00 food still in cheeks is lost. Bank before time runs out. A match is 1, 3 or 5 rounds; the total of your
heaps wins.

### Where mastery comes from

| A beginner | An expert |
|---|---|
| Eats whatever is near and goes home when the ring looks full | Plans a loop: big food first while fast, small food on the way home, arrives just past 100 for ×2 |
| Banks at 80 every time | Reads the room: goes Stuffed when the way home is clear, Bursting only with a seed-sized bite left and no bully near |
| Wanders into food when full, pops | Threads gaps between seeds at a waddle, uses the cheek width as a feel |
| Ignores the hand | Is under the toss when it lands, runs a pour end to end for a ×15 gobble |
| Banks at the buzzer or loses a full load | Times the last trip to land in the final seconds |
| Bumps whoever is close | Bumps the overstuffed (a pop), the full near a cluster, cuts off a rival's path home; saves a chili's free dash for it |
| Runs from the cat | Uses the paw: waits for it to scatter a rival's load, then sweeps the spill; chews gum before it comes |
| Takes every golden seed | Takes the golden seed only when the risk fits (at 85 full it's a pop roll for +60) |

The decisions are all on screen: cheek size, blush and the ring (your risk), the tier sticker (what a bank is worth now), other
hamsters' cheeks (who is worth bumping), shadows (where food and the paw will be), flags (who's winning), the leader's crown.

## Solo

A player alone gets the full game four ways, all from the lobby:

- **Quick round.** You and 7 bots, the arena and bot difficulty you pick (Easy, Normal, Hard), 1, 3 or 5 rounds.
- **Picnics**: a ladder of 8 arenas, one round each against bots that sharpen up the ladder (skill 0.1 to 0.95). Win to open the
  next. Each Picnic has **three stars**: win it, bank its heap goal (900 on the first, +100 a step to 1,600), and its challenge
  (bank a Stuffed cheekful; Gobble ×6; never pop; bank 2 golden seeds; bank a Bursting cheekful; bank 12 times; eat 3
  specials; never get swatted). Specials join the ladder one at a time: none on Picnic 1, chili from 2, gum from 3, all three
  from 4. All 24 stars earn the Golden Crown.
- **Daily Feast**: one round on the day's arena with the day's seed: the same food and bots for everyone that day, on Normal.
  The best heap goes on today's board. The first Daily of a day extends your **streak** (+20 XP a day in a row, up to +140).
- **Daily goals**: three a day (the same three for everyone), counted in any mode: "Bank 3 Stuffed cheekfuls", "Gobble ×6",
  "Bump rivals 6 times", "Win 2 rounds"... Each pays 100 XP.

Picnics and the Daily run on the page alone (the same rules module the host runs), with `room.hideLobby()` while they play. They
end when a match starts in the room. They pause on the platform's pause and when the page is hidden.

### The eight arenas

All arenas use the same foods, burrows and cat. Each adds one twist that shows itself.

| # | Arena | Size | Layout and twist | Bots |
|---|---|---|---|---|
| 1 | Picnic Blanket | 1800×1200 | Red gingham on a meadow; the wicker basket and a lemonade glass are obstacles, a sun hat and a napkin set dressing. "The classic" | Easy |
| 2 | Kitchen Counter | 1800×1200 | Wood planks, a steel sink, a cutting board; wet patches round the sink are slippery. "Slippery sink" | Easy+ |
| 3 | Pantry Shelf | 2400×900 | Long and narrow; a row of jars splits it into two lanes with four gaps. "Narrow shelf" | Normal- |
| 4 | Night Garden | 1800×1200 | A lawn at night: food shows in light (your glow, fireflies, a lantern); golden seeds always glow. "Lights out" | Normal |
| 5 | Birthday Table | 1800×1200 | A strawberry cake in the middle; every 15 s a cake shower flings big pieces off its top; presents and a popper. "Cake showers" | Normal+ |
| 6 | Campsite | 1800×1200 | A stream across the clearing; two log bridges and a ford; a tent and a campfire. "Two bridges" | Hard- |
| 7 | Lazy Susan | 1800×1200 | A dinner table whose round centre turns slowly, carrying food and hamsters. "Spinning table" | Hard |
| 8 | The Cat's Table | 1800×1200 | A farmhouse table: the cat is awake all round, a paw every 12 s from 0:20 and every 5 s in the last 30. "The cat's awake" | Hard+ |

## Multiplayer

**Kind and size.** A public game, `rooms.join({ maxPlayers: 8, minPlayers: 1, lobby: 'bar', countdown: 0, settings })`.
Friends get private servers from the platform. Bots fill the empty burrows up to 8.

**Lobby.** The game draws it on the blanket (the chosen arena, live): who is here (portraits of each hamster in its coat and hat
in the lobby card, a tick when ready, a host marker), the host's settings, your level, and the Picnics, Daily and Wardrobe
biscuits; the platform adds
the Ready / Start strip at the bottom. Settings (declared at join, changed by the host with `room.setSetting`, ready flags
cleared after a change):
- Arena: 0-7, default 0 (the host's picker only offers arenas the host has unlocked in Picnics);
- Rounds: 1, 3, 5, default 3;
- Bots: Off, Easy, Normal, Hard, default Normal.

Nothing starts until everyone has readied on the platform's strip (Enter works too): a public server starts itself, a private
server waits for the host's Start. The platform's 3-2-1 is the only countdown; the round is on when it ends.

**Rounds.** `createMatch` with `rounds: 'rounds'`, `roundSeconds: 150`, `introSeconds: 0`, `roundEndSeconds: 7`,
`resultsSeconds: 12`, `admit: 'round'`. Round score = heap; `score(m)` returns the heaps, so the
match total is the sum of heaps. Heaps reset every round. Ties share a place.

**Bots.** `createBots(match, { host, fill, names, think: () => null })` seats them (fill 8, or 0 with Bots Off); the host's page
drives their bodies with the rules module's bot brain at 30 Hz. Each has a name, coat, personality and skill (see Balance).

**Latecomers** (only in private servers: a public server closes while its match plays) watch: the camera follows the leader
(tap or left/right to change hamster), a biscuit tag reads "Watching · next round". At the next round they take a bot's burrow.

**Leavers and the away.** An away player's hamster dozes where it stood, translucent; it can't eat or be bumped until back
(the seat hold). A player who leaves for good: their hamster's cheeks spill where it stood, it goes home, the burrow closes and
the heap still counts in the standings. Food totals per toss scale with seats (seats/8, at least 0.5), so a 3-player game with
Bots Off isn't a buffet.

**Host change.** Everything the host decides is in room state; the toss and paw schedules are pure functions of the match seed
and match time, so a new host just carries on. It resumes the bots from the positions it was drawing.

### Netcode: who decides what (as built)

Pages own their **bodies**; the host owns the **food, every cheek's contents, the heaps, pops and the bots**. The food
schedule (opening spread, tosses, golden seeds, paw sweeps) is a pure function of the round's seed and arena, computed on every
page, so a new host just carries on.

| What | Where | Who writes it |
|---|---|---|
| My hamster: `{ k: 'p', r: round, x, y, a, f (cheeks, for drawing), c (coat), o (hat, pop effect and trail as one small number), s (bits: dash, stun, dizzy, home) }`; `k: 'l'` with my heap `h` on the lobby's practice blanket, `k: 'w'` while watching | presence, at most 20 Hz | each page (moves its own hamster, never corrected by the network) |
| Bots' bodies: `b: [[x, y, fill, bits], ...]` | the host's presence | host |
| The round's arena and seed | `match.data` `{ a, s }` | host (`startRound`) |
| The world record `host:world`: `{ r: roundId, t, g: eaten bitset of scheduled food (base64), d: spills and flung pieces [[id, type, x, y, land, fromX, fromY]], ch: cheek counts per seat, hp: heaps, e: each seat's last 16 confirmed bites, ev: last 16 events [seq, kind, seat, ...] (pop, bank, hit), st: per-seat trips, pops, golden, best trip }` | room state, under 15 KB | host: within 120 ms of any change (every bite marks it), else once a second |

Calls (`createHost`):
- **eat** (a claim keyed by piece **and** player, window 60 ms, rate 25/s): the page eats at once (munch, cheeks grow) and
  claims. The host checks the claimer is near the piece (its presence or its recent trail, reach + 70 px for lag) and not dizzy,
  then puts it in that seat's cheeks and rolls the pop from its own count (a hash of seed, round, seat and piece). A piece eaten
  by someone else in the last 0.7 s is **shared**: the second claimer gets one too, so a bite a player saw never undoes. The page
  shows host cheeks + its bites in flight − a bank in flight; the bites leave "in flight" when the record lists them.
- **bank** (rpc, rate 4/s): sent on entering the porch once the page's bites have settled (at most 450 ms); the host checks the
  seat is at its porch and moves the cheeks into the heap. The page shows the +count at once and doesn't repeat it when the
  record confirms.
- **hit** (rpc, rate 4/s): `{ by, k: bump | paw, n }`. The hit page reports it; the host checks the dasher was dashing and near,
  or sweep n was live and the hamster in its band, then spills a third (half for the paw), or pops an overstuffed one.

Bumps: the dasher's page sees contact against the target as it draws it, marks the target immune locally (no repeats) and sends
`{ t: 'bump', by, to, dx, dy, r }` to the target (for a bot, to the host). The target accepts it if the dasher's dash bit was
seen in the last 0.7 s (the bit stays up 0.35 s from a dash's start, so a dash that ends in a bump within a frame still goes
out) and the dasher is within 150 px of it now or lately; a bump that arrives before the dash waits up to 0.4 s for it. The
target applies the knock to its own body and calls **hit**.

On a page that isn't the host, food in the paw's band leaves the table the moment the swat starts (the record brings the flung
pieces back where they land), so nobody bites a piece the paw already took.

Measured in the tests (`test/net.test.mjs`, two pages with 120 ms each way): 0 bites lost or undone over a round; a hunter's
18 bumps on the other page, 17 taken, 0 refused (the rest hit an immune hamster). A page that reloads mid-round takes its
position from its presence and its cheeks and heap from the record; a host that reloads or leaves hands over without losing
heaps or food. Every value read from the room is checked for shape and range; names are drawn as text.

## Progression and reasons to come back

Every round in every mode ends on the same card: XP lines tick in (banked/8, Stuffed ×15 each, Bursting ×30, a gobble of 4+,
golden seeds, a podium place, new stars ×50, Daily goals ×100, the streak), the level bar fills, and what the new level hands
out drops onto the card with a chime.

- **Levels**: level n → n+1 costs `120 + 40·(n−1)` XP. A typical round is worth 150-250, so level 2 comes in the first round,
  level 10 in a dozen or so, the end of the track (level 28) over many weeks.
- **The Wardrobe** (lobby → Wardrobe; your hamster trots out onto the cloth and poses for a low close-up beside the card):
  - **Hats** (12): Party Hat (L2), Big Bow (4), Daisy (6), Bobble Beanie (8), Sprout (10), Acorn Cap (12), Chef Hat (15),
    Cowboy Hat (18), Propeller Cap (22), Strawberry (24), Top Hat (28), Golden Crown (all 24 Picnic stars).
  - **Pop effects** (how your pop bursts): Crumbs, Confetti (L3), Hearts (9), Starburst (14), Bubbles (20), Fireworks (25).
  - **Trails** (behind your dash): Dust, Sparkles (L5), Petals (11), Bubbles (16), Flames (21), Rainbow (26).
  - **Coats** for feats: Golden and Cream from the start; Dove (bank 2,000 in all), Ginger & White (pop 10 times), Banded (win a
    match), Cinnamon (win Picnic 4), Sunflower (bank 10 golden seeds), Panda (win all 8 Picnics), Winter White (bank 25 Stuffed
    cheekfuls), Lilac (a 7-day Daily streak).
  Locked items show what earns them; new ones carry a "New!" tag until seen. What you wear travels in presence, so everyone
  sees your hat, your trail and your pop.
- **Picnic stars**, **the Daily streak** and **Daily goals** (above).
- **Personal bests**: best round heap, biggest bank, best trip, longest gobble, golden seeds in a round.
- **Leaderboards**: `best-round`, `wins`, `level`, `streak` (best Daily streak) and `daily` (day number × 10,000 + heap, so today
  ranks above every earlier day; the game shows only today's entries).
- **Badges** (in `onceworlds.json`):

| id | Name | Earned by |
|---|---|---|
| `first-bite` | First Bite | Bank your first food |
| `stuffed` | Stuffed | Bank a cheekful past full (×2) |
| `bursting` | Bursting | Bank a cheekful past 120 (×3) |
| `gobbler` | Gobbler | Chain 8 bites |
| `pop` | POP! | Burst your cheeks |
| `bully` | Bully | Pop a rival with a bump |
| `golden-seed` | Golden Seed | Bank a golden sunflower seed |
| `hoarder` | Hoarder | Bank 2,000 in one round |
| `clean-plate` | Clean Plate | Win without popping once |
| `buzzer-beater` | Buzzer Beater | Bank in the last 3 seconds |
| `spice-rack` | Spice Rack | Eat a chili, a gumball and a peppercorn in one round |
| `week-streak` | Week Streak | Play the Daily seven days in a row |
| `picnic-season` | Picnic Season | Win all eight Picnics |
| `three-star` | Three Stars All Round | All 24 Picnic stars |
| `well-fed` | Well Fed | Reach level 10 |

Saves (`ow.save`, key `profile`, version 2, every field checked on load so a bad save never breaks the game): XP, what you wear,
Picnic wins, stars and bests, personal bests, totals, the Daily (today's best, goals, streak, best streak), items already seen,
hints already shown. A version-1 save keeps its Picnic wins (each as its first star).

## Balance and timing

World units are px. All of these live in `src/sim/config.js`.

**Hamsters**

| | Value |
|---|---|
| Body radius | 18 |
| Top speed | 240 empty, `100 + 140·(1 − (f/100)^1.4)` up to 100, then 100 → 72 at 140 |
| Turn / speed-up time constant | 0.06 s + 0.12 s × f/140 |
| Capacity | 100; Stuffed ×2 past 100, Bursting ×3 past 120; any bite past 140 pops |
| Pop chance per overstuffed bite | `(0.03 + 0.57·((f−100)/40)²)` × a size factor (0.45 for seeds to 1.45 for cookies), at most 0.95 |
| Gobble chain | bites within 0.6 s; +1 per chained bite, riding in the cheeks |
| Dizzy after a pop | 1.2 s; spray ring 50-180 px; spilled food lands (eatable) after 0.45 s |
| Burrow porch | radius 64: bank on entry, no bumps inside |

**Food** (size = worth, except golden)

| Food | Size | Worth | Radius | Share of tossed food |
|---|---|---|---|---|
| Sunflower seed | 2 | 2 | 6 | 38% |
| Hazelnut | 5 | 5 | 9 | 24% |
| Blueberry | 7 | 7 | 10 | 16% |
| Cracker | 10 | 10 | 14 | 12% |
| Strawberry | 18 | 18 | 16 | 6% |
| Cookie | 30 | 30 | 22 | 4% |
| Golden sunflower seed | 25 | 60 | 10 | 4 a round, scheduled |
| Chili / Bubble gum / Peppercorn | 4 / 3 / 3 | 4 / 3 / 0 | 10-12 | about one per 16 s |

**Food schedule** (per round, a pure function of seed and arena): an opening spread of 140 pieces weighted to the middle plus a
doorstep of 3 seeds and a nut before each burrow; a toss every 3.2 s (±0.8) from 0:04, every 2.8 s (±0.6) from 2:00, each 10-17
pieces in a cluster with at least one of size 10+; a pour every 10 s (±2) from about 0:10, 10-17 seeds 24 px apart along a gentle
arc, landing one after another; golden seeds at about 0:25, 1:05, 1:40 and 2:12 after a 2 s beacon. Toss sizes scale with seats.
Every piece lands on a fair spot, clear of porches and obstacles (tested on every arena). Between 0:10 and 2:25 a round keeps
about 70 pieces on the table (median), never fewer than a dozen.

**Bump and cat**

| | Value |
|---|---|
| Dash | 0.25 s at `560 × (0.55 + 0.45 × speed/240)` px/s |
| Cooldown | 2.5 s from the dash's start (a chili refills it) |
| Hit | centres within 46 px during the dash |
| Victim | knocked 150 px × (1 − 0.35 × f/140) over 0.3 s, stunned 0.4 s, spills 35% of its fill; overstuffed: POP; immune for 1 s |
| Never | inside a porch, in the first 2 s of a round, from bots in the first 30 s of round 1, against gum |
| Cat | 5 sweeps from 2:02, about 6 s apart; band 190 px; shadow 1.4 s, swat 0.45 s; hit: flung 220 px, stunned 0.6 s, spills 50% (pop if overstuffed) |

**Clock**: round 2:30, intro 4 s, round end 7 s, results 30 s (host can skip).

**Camera**: a perspective camera 52° above the table (a little steeper in portrait) following your hamster with look-ahead,
showing about 7.8 m of table across in landscape and 5.1 in portrait; it punches in on a Stuffed or Bursting bank and a pop, and
shakes (smooth noise, directional) on bumps, pops and the paw. A pop of yours: 0.12 s hit-stop; your winning bank: slow motion.

**Bots** read the same table a player does. Skill is one number from 0 to 1 (Easy 0.15, Normal 0.5, Hard 0.85; Picnics climb
0.1 → 0.95). Sharper bots steer around pieces that would overstuff them, aim more trips at Stuffed (20% → 70%), gamble on
Bursting a little more, bail out of a Stuffed trip when a bully is close, dodge the paw and anticipate tosses.

| Name | Coat | Personality | Wears |
|---|---|---|---|
| Gus | ginger and white | Glutton: goes long, chases cookies, pops a lot | Chef Hat |
| Pepper | banded | Bully: hunts full rivals, lurks on paths home | Cowboy Hat |
| Mabel | golden | Banker: home early, never overstuffs | Big Bow |
| Dot | white with one black spot | Grazer: small food near home, quick trips | Daisy |
| Rocco | sable with a white blaze | Gambler: golden seeds, cookies and Bursting | Top Hat |
| Fig | dove grey | Scavenger: runs to pops and spills | Acorn Cap |
| Bea | cream | All-rounder | Sprout |
| Clem | chocolate | All-rounder | Bobble Beanie |

**How the numbers are checked** (`npm test`):
- Every arena: the round ends at 2:30 with every cheek emptied, nothing is ever NaN or off the arena, someone banks.
- Default bots: median heap about 1,200, a round's winner about 1,700, first over second under 1.35, never fewer than 12 pieces
  on the table between 0:10 and 2:25.
- Skill ordering: Hard bots bank clearly more than Easy ones; Easy still banks. Personalities: the glutton pops most per bot,
  the banker least. The risk pays: good bots that go Stuffed and gamble on Bursting beat good bots that bank safe.
- Progression: level costs, the reward track (every item earned once), pacing (level 10 in 8-25 typical rounds), outfits round-
  trip through presence, Daily goals and streaks, Picnic stars and the badges they earn, saves checked field by field.
- Online: a whole match with bots, heaps scored by the host; predicted bites and banks under lag; bumps under lag; the host
  reloading and leaving mid-round; a latecomer watching and playing the next round.

## Every screen

Layouts keep clear of `ow.ui.reserved`, the platform's lobby strip and, during play on touch screens, the stick and Bump
button. Text is at least 15 px, main buttons at least 48 px tall. Panels slide and bounce in; pressing a biscuit takes a bite.

- **Lobby.** The chosen arena live, your hamster at your burrow, free to practise. Desktop: a biscuit card on the right: your
  level chip and bar (and streak flame), the arena and its twist, the eight seats as portraits in their coats and hats, the
  host's settings (Arena ◀ ▶, Rounds 1/3/5, Bots Off/Easy/Normal/Hard), then Picnics (★ count), Daily (goals done or the
  streak) and Wardrobe ("New!" when something is waiting). Portrait phones: a band of seat heads and a one-line summary (the
  host taps it for a settings sheet), the mode biscuits stacked at the right edge, the level chip bottom left. Short landscape
  screens: the card goes two-column.
- **Wardrobe.** Your hamster trots clear of its burrow (food round the spot is cleared away), turns to the camera, which drops
  low and close, and beams at each thing you try on; tabs for
  Hats, Coats, Pops and Trails; a grid of 3D portraits (locked ones greyed with their condition; a locked tap shakes); picking a
  pop or trail previews it on your hamster.
- **Picnics.** Eight plates on a tablecloth, each with a picture of its table, its name and three stars (or a silver cloche
  "Win Picnic 3"); the chosen plate's card: name, twist, specials, its three goals with stars, Play and the best heap.
- **Daily Feast.** One card: the date, the day's table and twist, the streak, today's three goals with progress pills, Play,
  your best today with your rank, today's top five.
- **Play HUD.** In the world: heaps with cocktail-stick flags, name tags over other hamsters, your cheek ring on the ground, the
  leader's crown, toss and paw shadows, golden beacons. On screen: the timer biscuit top centre, nibbled away as the round runs
  (hot pink in the last 30 s); top right your place and heap; edge arrows for your burrow, a golden seed and the paw; over your
  hamster the tier sticker ("Stuffed ×2", "Bursting ×3 · Gobble ×7") and special timers; floats for bites, gobbles and banks;
  one-time hints on a small biscuit under your hamster.
- **Intro.** "Round 2 · Slippery sink" biscuit banner, then 3, 2, 1, "EAT!" in huge piped numerals.
- **Between rounds (7 s).** "Time!"; the camera pulls back; flags count up in rank order; a biscuit board: head, name, this
  round and total, and one reason line ("Gus popped 3 times").
- **Results.** A podium of 3D portraits (the winner in its crown, the others glum), your place in a giant numeral, your total,
  best lines, badges; beside it the progress card (XP lines, the level bar, rewards, Picnic stars, Daily goals, the streak).
  Again / Next Picnic / Lobby (solo) or the host's Next.
- **Watching**, **Pause** and **Room closed** as before: a tag "Watching · next round"; "Paused" with Resume and Quit; one line and
  one button for removed / connection lost / another tab.

## Art direction

**The world.** A summer picnic at hamster scale, in 3D: the camera hangs just above the table with a macro lens (tilt-shift
blur top and bottom), so the cloth's weave is crisp under the hamsters and the giant props behind them dissolve into bokeh. The
giants are never seen, only their shadows: the hand that tosses and pours food, the cat's paw. Each arena is a real surface
(gingham, wood planks, a pantry shelf, a lawn at night, a party cloth, a campsite clearing, a dinner table, a farmhouse table) on
a ground of grass, mud or floor, dressed with real props: the wicker basket and a teapot on the blanket, a cutting board and
croissants on the counter, a strawberry cake and presents at the birthday, a tent, campfire (flickering flames and a warm point
light) and stream at the campsite, a lantern and gnome in the night garden.

**Light.** Golden-hour sun with soft 2048 px shadows, a sky HDRI (Sunflowers by day, Evening Meadow at night) for reflections
and fill, ACES tone mapping, a light bloom on highlights, and a warm grade with a vignette. Night is a blue-black grade with
pools of light where the lantern, fireflies and your own glow are. Quality follows the platform's Graphics setting: Low drops
shadows and post, Medium keeps 1024 px shadows and the tilt-shift, High adds bloom.

**Palette** (UI and accents)

| | Hex | Use |
|---|---|---|
| Gingham Red | `#D8413A` | the blanket, the brand |
| Cream | `#FFF2D9` | icing, text |
| Biscuit | `#E3A24F` | every UI panel and button |
| Cocoa | `#3B2218` | outlines, text outlines |
| Sunflower | `#FFCB2E` | golden seeds, gains, the crown |
| Hot Cheek | `#FF4D6D` | overstuffed, danger, the last 30 s |

Seats have their own colours, each with an emblem so colour is never the only cue: Sky `#3FA7F2` circle, Lime `#9BD13A` star,
Mint `#2DC38A` triangle, Grape `#9A5BEA` diamond, Tangerine `#FF8424` square, Bubblegum `#FF6FB0` heart, Teal `#16B3AE` cross,
Navy `#2E3F9E` moon.

**Type.** Shrikhand for the logo, big words and numerals, "piped" in Cream with a Cocoa outline; Bricolage Grotesque ExtraBold
for names and labels. Both self-hosted woff2 with their OFL licences.

**The signature: the bitten biscuit.** Every panel, button and banner is a baked biscuit with a bite out of one corner.

**Hamsters** are the stars: one soft skinned body (hips, chest, head bones) with velvet fur (sheen, rim light, fine strands),
painted coat markings, pink ears and paws, glossy eyes with expressions (open, blink, happy, squeeze, dizzy, KO), whiskers, a
bandana in the seat colour and whatever hat they wear. The cheeks are the show: two pouches that inflate from a point inside
the head into round balls (past full a second swell sags them forward), blush pink, glow hot pink past 100 and tremble past 120.
They are animated from the simulation: a gallop with bounce and lean, a waddle when heavy, head that looks where it turns, ears
back at speed, idle grooming and looking about, paws to the mouth on every bite (a gulp spring in the cheeks), a squash-and-
stretch dash, a pancake pop with circling stars, a happy hop when banking, a winner's spin and a loser's slump.

**Food** is modelled in code, smooth and glossy, each a distinct silhouette: a striped sunflower seed, a glossy hazelnut, a
dusty blueberry, a docked cracker, a seeded strawberry with its calyx, a baked cookie with chocolate chunks, a golden seed that
glints and sparkles, a red chili that steams, a swirled gumball, a peppercorn. Heaps by the burrows are real mounds of the
pieces each hamster banked.

**Juice.** Every bite: munch, crumbs in the food's colours, a cheek gulp. Chains: a rising marimba and "Gobble ×n!" floats.
Banking: pieces arc from the burrow onto the heap, chimes, the flag counts up; Stuffed and Bursting banks punch the camera in
with a fanfare. Bumps: hit-stop, directional shake, dust. POP: hit-stop, shake, a burst in your pop effect, food spraying in
arcs. Tosses and pours: the hand's shadow, pieces dropping in with their shadows growing, dust as they land. The win: slow
motion, confetti. `reducedMotion`: no shake, no hit-stop, half the particles.

**Platform UI**: `ow.ui.setLook({ accent: '#FFCB2E', panel: '#3B2218', text: '#FFF2D9' })`.

## Sound

All synthesized with Web Audio (`audio.js`, `music.js`).
- **Munch**: a filtered-noise crunch plus a pluck whose pitch drops as cheeks fill; chains climb a marimba scale.
- **Tiers**: a rising two-note sting at Stuffed, three at Bursting; a strain whine while overstuffed.
- **POP**: a burst, a thump and a "pfft", then the patter of food and a dizzy slide whistle.
- **Bank**: a marimba run per piece, flourishes for Stuffed and Bursting banks.
- **Specials**: a sizzle (chili), a stretchy gum squeak and a "boing" when a bump bounces, a tickle and a sneeze.
- **Bump**, **toss**, **golden seed**, **cat** (a purr, a swish, a slap), **UI** crunches, **stingers** for 3-2-1 and the buzzer.
- **Progress**: ticks as XP lines land, a bright chord on a level up, a chime per reward and per star, a soft "wear" pop in the
  Wardrobe.
- **Music**: upright bass and marimba with brushes and a shaker, 112 BPM in play, a tone up at 132 with a cowbell in the last
  30 s, 90 BPM and softer in menus.

## Store art and the trailer

Posters (`?poster=<name>`) are drawn by the game's own renderer from a round eight bots really played, frozen and staged:
- **cover** (`thumb-1`): Gus, cheeks far past full, front and centre on the blanket among scattered food, Pepper dashing in, Dot
  popping behind; the logo biscuit top left.
- **action** (`thumb-2`): a POP at the Birthday Table, caught mid-spray: Pepper's bump, Dot flattened with KO eyes and stars,
  the food in the air.
- **win** (`thumb-3`): Mabel in the Golden Crown before her burrow and heap, happy, in confetti.
- **multi** (`thumb-4`): eight hamsters in their hats racing in on a golden seed.
- **icon** (512×512): one hamster in a party hat, cheeks round and full, looking at you.
- **badge-<id>** (256×256): a symbol on a coloured disc for each of the fifteen badges, 3D where it's a hamster or food.
- **plate-<n>**: the small pictures of each table on the Picnics and Daily screens (`public/assets/plates`).

The trailer (`store/trailer.mp4`) is cut from real rounds captured with the game's own sound.

## Originality check

It resembles .io eating games (Agar.io, slither: eat to grow), Hungry Hungry Hippos (grab food), carry-it-home games (a bank or
flag you return to) and Star Party (grab stars). What a player notices in the first minute that is different:
- your capacity is your body: the cheeks visibly balloon, and fuller means slower and wider;
- you can't refuse food, so the skill when full is avoiding food, not finding it;
- the push-your-luck POP, a public, comic disaster that feeds everyone else;
- a bump is about what's in the other hamster's cheeks, so the fattest, slowest hamster is the target;
- the giant picnic seen only through its shadows, and the cat at the end.

## Tech and files

three.js and plain ES modules, built with Vite into `dist/` (`"dir": "dist"`, `base: './'`). The SDK helpers come from
`/__onceworlds/v1/{match,host,bots}.js` at run time; without the platform (the page opened alone, posters) the title's attract
round runs and nothing throws. The game is about 14 MB (models meshopt-compressed, textures WebP).
- Pure (no `window`, `document` or `onceworlds` at import; tested in node), `src/sim/`: `config.js` (every number), `rng.js`,
  `arenas.js`, `schedule.js` (spread, tosses, pours, golden seeds, specials, cake showers, paw sweeps), `world.js` (movement,
  eating, cheeks, tiers, chains, specials, pops, banking, bumps, the cat), `rules.js`, `brain.js` (the bots). Also pure:
  `src/wardrobe.js` (levels, the track, stars, Daily goals, outfits) and the top of `src/profile.js` (the save, a round's
  rewards).
- Page: `boot.js` (game, `?poster=` or the dev-only `?lab=`), `main.js` (screens, juice, solo modes), `net.js` (room glue),
  `session.js` (a local round), `hud.js` (the canvas overlay), `ui.js` (biscuits), `input.js`, `audio.js`, `music.js`,
  `poster.js`; `src/render/`: `stage.js` (renderer, sun, post, camera rig), `world3d.js` (the scene from the world each frame),
  `arena.js` (the eight tables), `hamster.js`, `hats.js`, `food.js`, `fx.js` (pooled particles), `materials.js`, `assets.js`
  (models, textures, skies), `portrait.js` (the little 3D pictures). Autoplay for capture (`?autoplay=1`, dev builds only).
- Tests in `test/` (`node --test "test/*.test.mjs"`): rules, the world, the schedule, bots and balance over whole rounds,
  progression, and the online flow between pages through a fake room with lag (skipped when the SDK's built helpers aren't
  there).

## Changes from the spec

- **The host owns cheek contents and rolls the pops**; each page still owns its body and decides whether a bump hit it. One
  authority for what's in a cheek means a reload or a new host never disagrees about it, and no page can skip a pop.
- **Mouse: the hamster follows the cursor and a click bumps** (the spec's hold-to-move plus click-to-bump collide: every click
  is also a hold).
- **Hamsters wear natural coats plus a seat-coloured bandana with an emblem** instead of one flat colour each: it reads as real
  animals, keeps eight seats distinct for colour-blind players, and makes coats an unlock.
- **The lobby is the first screen and the live blanket with practice food,** so waiting is play.
- **One countdown:** the platform's 3-2-1. A Picnic or the Daily (solo, no room countdown) opens on a short banner instead.
- **Added**: the safe porch, 1 s immunity after a hit, a "Bots: Off" setting, the buzzer (unbanked food is lost), the leader's
  crown, and the eight arenas' twists as listed. Heaps reset each round; the match total is the sum.
- **Bites are shared on a tie** (decided in the build): a piece two hamsters reached within 0.7 s goes into both cheeks, so the
  coordinator's rule holds that a bite never visibly undoes; it costs a few extra pieces a round.
- **A solo win counts** toward wins (the Banded coat and the wins board) like a match won; Clean Plate too.
- **Arena choice follows Picnics**: a host's arena picker offers the arenas that host has opened.
- **The revamp** (see `REVAMP.md`): the 2D canvas game became a lit 3D table with modelled hamsters and food and real props;
  banks past full pay ×2 and ×3; gobble chains; chili, gum and peppercorn specials; pours; three stars per Picnic; XP, levels and
  a Wardrobe of hats, pop effects and trails; Daily goals and streaks; fifteen badges.
