# More Than You Can Chew

## The pitch

Stuff your hamster's cheeks at a giant picnic, waddle home to bank it, and don't bite off more than you can chew, or you POP.

## The goal in one line

**Carry food home in your cheeks. Biggest heap wins.**

What says it with no words: eight burrows round a gingham blanket, each with a heap of food and a toothpick flag showing its
number; hamsters whose cheeks balloon as they eat, waddling slower and slower back to their holes; food tumbling out into the
heap with a count-up; a hamster that ate one seed too many going POP and spraying everything across the blanket.

## The first minute

| Time | What happens | Hint (2-5 words, once) |
|---|---|---|
| 0 s | **Title.** The picnic is alive: six bot hamsters gobble and waddle on the blanket under the title, piped in white icing on a big bitten biscuit. Now and then one of them overstuffs and POPs (Gus, the glutton, usually does). One big **Play** biscuit (Space / Enter). A toothpick flag beside it shows "Best 412" once there is one. | none |
| ~2 s | **Play.** A crunch (the button loses a bite), music starts, the camera swoops down to your burrow and your hamster pops out of the hole in your seat's bandana. In a public server Play also readies you; alone, the match starts at once. With others, you wait in the lobby, which is the blanket itself: you can already run, eat practice crumbs and bank them. | "Ready!" is the platform's strip |
| ~3 s | **Intro (4 s).** A biscuit banner drops in: "Round 1". Then 3, 2, 1 in piped numerals with marimba hits, then "EAT!". Every hamster waits at its door; a few seeds and a nut already lie on your doorstep. | none |
| ~7 s | You move. First bite: a munch, your cheeks puff with a gulp bounce, the cheek ring round your feet starts to fill. | "Run over food" (only if you haven't eaten 3 s in) |
| ~12 s | Cheeks half full: you feel the waddle. At 70 the burrow arrow pulses. | "Full? Go home!" |
| ~18 s | You reach your burrow. Food tumbles out into your heap, chimes count up "+48" on your flag, your heap number on the HUD bumps. | none: the count is the lesson |
| ~22 s | A giant's hand shadow sweeps over the blanket, crumb shadows grow, a toss of food lands with bounces and dust. | none |
| ~25 s | A shaft of light: a golden sunflower seed is about to land. Gold arrow at the screen edge. | "Golden seed!" |
| 30-50 s | Push your luck. Past 100 your cheeks go hot pink, wobble and sweat, the ring turns jagged red. Maybe a POP: spray, dizzy stars, rivals swarm your food. | "Too full! Dodge food", after a first pop "Bank sooner" |
| ~45 s | A rival waddles past with fat cheeks while your Bump is ready. | "Space: Bump!" (touch: "Bump!" by the button) |
| 60 s | The player knows the whole game: eat, go home, don't pop, bump the fat ones. The cat comes at 2:00 ("Cat!"). | |

The first round is gentler: bots never bump during the first 30 s of round 1, and every burrow starts with food on its doorstep.

## Controls

| | Keyboard / mouse | Phone / tablet |
|---|---|---|
| Move | WASD or arrows, or the mouse: your hamster runs toward the cursor (it stops when the cursor is on it) | The platform's stick (`stick: 'analog'`, zone `wide`): analog speed and direction |
| Bump (dash) | Space, or click | One button, "Bump" (key Space) |
| Menus | Click / tap, Enter on the focused biscuit, Esc closes a sheet | Tap |

That is the whole game: move and one button. Eating and banking happen by touch. Mouse-follow switches on when the mouse
moves over the game and off when a movement key is pressed, so keyboard players never get dragged. A key held down is one
bump (`event.repeat` ignored).

## The rules (the core loop)

**Eat.** Run over food and you eat it, always. You can't refuse food you touch, so when you're full you steer around it.

**Cheeks.** Every food has a size (how much cheek it fills) and a worth (points when banked); for everything but the golden
seed they are the same number. Capacity is 100: "full". The fuller you are:
- the **slower** you run (220 px/s empty, 90 at 100, 65 at 140) and the heavier you turn;
- the **wider** your cheeks, so the more food you brush into by accident;
- past 100 you're **overstuffed**: cheeks glow hot pink, wobble and sweat, and every bite can **POP** you.

**POP.** Each bite that leaves you above 100 pops you with a chance from 15% (just over) to 60% (at 140); any bite that would
take you past 140 pops you for sure. A pop sprays everything you held in a ring around you for anyone to grab, and you're dizzy
for 1.2 s. Your heap is never touched.

**Bank.** Run into your burrow (a 64 px zone at its mouth) and everything in your cheeks tumbles out into your heap. The round
score is your heap. The zone is also a safe porch: nobody can be bumped inside it.

**Bump.** A short dash in the direction you're moving (0.25 s, then a 2.5 s cooldown). Ram another hamster and they spill a
third of what's in their cheeks, get knocked back and stunned for 0.4 s. Ram an overstuffed hamster and they POP. Bumping an
empty hamster only shoves it. A hamster that was just hit can't be hit again for 1 s.

**Food.** The blanket starts strewn with food and a few pieces on every doorstep. Every 4 s an unseen picnicker's hand tosses a
cluster (its shadow 1 s before it lands, so you can read where it'll fall). Four golden sunflower seeds a round land under a
shaft of light: they fill 25 but are worth 60.

**The cat.** In the last 30 s the cat wakes up. Five times, a paw-shaped shadow darkens a band across the blanket for 1.4 s, then
the paw swats through it: hamsters in the band are flung, stunned and spill half their cheeks (overstuffed ones pop); food in the
band is scattered. Burrow porches are never swept. The music speeds up and tosses come faster.

**The buzzer.** At 0:00 food still in cheeks is lost (cheeks deflate with a sad "pfft" and a grey "-23"). Bank before time runs
out. A match is 3 rounds; the total of your heaps wins.

### Where mastery comes from

| A beginner | An expert |
|---|---|
| Eats whatever is near and goes home when the ring looks full | Plans a loop: big food first while fast, small food on the way home, arrives at 95 |
| Wanders into food when full, pops | Threads gaps between seeds at a waddle, uses the cheek width as a feel |
| Ignores the toss shadows | Is under the toss when it lands, and reads which tosses are worth the trip |
| Banks at the buzzer or loses a full load | Times the last trip to land in the final seconds |
| Bumps whoever is close | Bumps the overstuffed (a pop), the full near a cluster, cuts off a rival's path home; keeps out of range when they're full and a rival's bump is ready |
| Runs from the cat | Uses the paw: waits for it to scatter a rival's load, then sweeps the spill |
| Takes every golden seed | Takes the golden seed only when the risk fits (at 85 full it's a 26% pop for +60) |

The decisions are all on screen: cheek size and the ring (your risk), other hamsters' cheeks (who is worth bumping), shadows
(where food and the paw will be), flags (who's winning), the leader's bottle-cap crown (the target).

## Solo

A player alone gets the full game three ways, all from the lobby:

- **Quick match.** Ready on the platform's strip: you and 7 bot hamsters, the arena and bot difficulty you pick (Easy, Normal,
  Hard), 1, 3 or 5 rounds. About 9 minutes for 3 rounds.
- **Picnics**: a ladder of 8 arenas. Each Picnic is one round (2:30) against 7 bots that get sharper up the ladder. Finish first
  to unlock the next. Every plate keeps your best heap. Eight wins take about 40-90 minutes for a new player; the best heap on
  each is the long tail.
- **Daily**: one round on the day's arena (the arenas take turns, locked ones included) with the day's seed: the same food, the
  same tosses, the same golden seeds and the same bots for everyone that day, on Normal. Your heap goes on the Daily board.
  Unlimited tries; the best counts.

Picnics and the Daily run on the page alone (the same rules module the host runs), with `room.hideLobby()` while they play. They
end when a match starts in the room (a friend joined and everyone readied). They pause on the platform's pause and when the page is
hidden.

### The eight arenas

All arenas use the same seven foods (a cookie is always 30), the same burrows and the same cat. Each adds at most one twist that
shows itself.

| # | Arena | Size | Layout and twist (the 2-4 word label) | Bots |
|---|---|---|---|---|
| 1 | Picnic Blanket | 1800×1200 | Red gingham on a meadow, a wicker basket and a lemonade glass as obstacles. "The classic" | Easy |
| 2 | Kitchen Counter | 1800×1200 | Butcher block and tiles, a cutting board; puddles round the sink are slippery (grip ×0.25, top speed +10%). "Slippery sink" | Easy+ |
| 3 | Pantry Shelf | 2400×900 | Long and narrow; a row of jars splits it into two lanes with four gaps. "Narrow shelf" | Normal- |
| 4 | Night Garden | 1800×1200 | A lawn at night: food shows only in light (your own glow, drifting fireflies, a lantern); golden seeds always glow. "Lights out" | Normal |
| 5 | Birthday Table | 1800×1200 | A cake in the middle (obstacle); every 15 s it sheds a "cake shower" of 4 big pieces round itself. "Cake showers" | Normal+ |
| 6 | Campsite | 1800×1200 | A stream crosses diagonally; two log bridges and a stepping-stone ford are the only ways over; tent and campfire. "Two bridges" | Hard- |
| 7 | Lazy Susan | 1800×1200 | A dinner table whose round centre (r 380) turns slowly (0.25 rad/s), carrying food and hamsters. "Spinning table" | Hard |
| 8 | The Cat's Table | 1800×1200 | A farmhouse table: the cat is awake all round, a paw every 12 s from 0:20 and every 5 s in the last 30. "The cat's awake" | Hard+ |

## Multiplayer

**Kind and size.** A public game, `rooms.join({ maxPlayers: 8, minPlayers: 1, lobby: 'bar', countdown: 0, settings })`.
Friends get private servers from the platform. Bots fill the empty burrows up to 8.

**Lobby.** The game draws it on the blanket (the chosen arena, live): who is here (avatars on burrow flags and in the lobby
card, a tick when ready, a host marker), the host's settings, your coat, and the Picnics and Daily biscuits; the platform adds
the Ready / Start strip at the bottom. Settings (declared at join, changed by the host with `room.setSetting`, ready flags
cleared after a change):
- Arena: 0-7, default 0 (the host's picker only offers arenas the host has unlocked in Picnics);
- Rounds: 1, 3, 5, default 3;
- Bots: Off, Easy, Normal, Hard, default Normal.

Nothing starts until everyone has readied: a public server starts itself (no countdown: the game's own 4 s intro is the only
one); a private server waits for the host's Start (`room.canStart`). Title Play readies you in a public server; in a private
server the host gets Start and everyone else Ready.

**Rounds.** `createMatch` with `rounds: 'rounds'`, `roundSeconds: 150`, `introSeconds: 4`, `roundEndSeconds: 7`,
`resultsSeconds: 30` (the host's Next skips it), `admit: 'round'`. Round score = heap; `score(m)` returns the heaps, so the
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
| My hamster: `{ k: 'p', r: round, x, y, a, f (cheeks, for drawing), c (coat), s (bits: dash, stun, dizzy, home) }`; `k: 'l'` with my heap `h` on the lobby's practice blanket, `k: 'w'` while watching | presence, at most 20 Hz | each page (moves its own hamster, never corrected by the network) |
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

- **Picnics**: 8 arenas unlocked one by one; a won plate gets a golden-seed stamp and keeps its best heap. Unlocked arenas
  become choices for you as a host.
- **Coats** (cosmetic, chosen in the lobby, sent in presence): Golden and Cream from the start; Dove (bank 2,000 in all),
  Ginger & White (pop 10 times), Banded (win a match), Cinnamon (win Picnic 4), Sunflower, a shimmering golden-seed coat
  (bank 10 golden seeds), Panda (win all 8 Picnics). Locked ones show their condition in the picker.
- **Personal bests**: best round heap, best single trip, golden seeds in a round; on the title flag and the results.
- **Leaderboards**: `best-round` (biggest heap in one round, any mode), `wins` (matches won), `daily` (score = day number ×
  10,000 + heap, so the board ranks today's heaps above every earlier day; the game shows only today's entries).
- **Badges** (in `onceworlds.json`, awarded where earned):

| id | Name | Earned by |
|---|---|---|
| `first-bite` | First Bite | Bank your first food |
| `chipmunk-cheeks` | Chipmunk Cheeks | Bank a cheekful of 120 or more |
| `pop` | POP! | Burst your cheeks |
| `bully` | Bully | Pop a rival with a bump |
| `golden-seed` | Golden Seed | Bank a golden sunflower seed |
| `hoarder` | Hoarder | Bank 1,000 in one round |
| `clean-plate` | Clean Plate | Win a match without popping |
| `buzzer-beater` | Buzzer Beater | Bank in the last 3 seconds |
| `daily-crumbs` | Daily Crumbs | Finish a Daily |
| `picnic-season` | Picnic Season | Win all eight Picnics |

Saves (`ow.save`, key `profile`, written on events): coats, chosen coat, Picnics won and bests, personal bests, totals
(banked, pops, golden seeds, wins, matches), today's Daily best, hints already shown.

## Balance and timing

World units are px at zoom 1. All of these live in one `config.js`.

**Hamsters**

| | Value |
|---|---|
| Body radius | 18 |
| Eat reach | 16 + cheek bulge (0 → 13 at 100 → 18 at 140) + food radius |
| Top speed | 220 at 0, `90 + 130·(1 − (f/100)^1.4)` up to 100 (178 at 50), then 90 → 65 at 140 |
| Turn / speed-up time constant | 0.06 s + 0.12 s × f/140 |
| Capacity | 100; overstuffed above; any bite past 140 pops |
| Pop chance per overstuffed bite | 0.15 + 0.45 × (fill after − 100)/40 |
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

**Food schedule** (per round): an opening spread of 140 pieces weighted to the middle plus a doorstep of 3 seeds and a nut in
front of each burrow; a toss every 4 s (±1 s) from 0:04, then every 3.5 s (±0.7 s) from 2:00; each toss 13-23 pieces (at least
one of size 10+) in a cluster, its shadow 1 s before it lands; golden seeds at about 0:25, 1:05, 1:40 and 2:12 (±3 s) after a
2 s beacon. About 815 pieces a round. Every piece lands on the field, clear of porches and obstacles (tested on every arena).
Eight hamsters bank about 5,000 of it between them, so food is contested and spills matter.

**Bump and cat**

| | Value |
|---|---|
| Dash | 0.25 s at `560 × (0.55 + 0.45 × speed/220)` px/s: 140 px empty, about 100 px full |
| Cooldown | 2.5 s from the dash's start |
| Hit | centres within 46 px during the dash |
| Victim | knocked 150 px × (1 − 0.35 × f/140) over 0.3 s, stunned 0.4 s, spills at least 35% of its fill (random pieces); overstuffed: POP; immune for 1 s |
| Attacker | recoils 30 px, dash ends |
| Never | inside a porch, in the first 2 s of a round, from bots in the first 30 s of round 1 |
| Cat | 5 sweeps from 2:02, about 6 s apart; band 190 px wide at a seeded angle; shadow 1.4 s, swat 0.45 s; hit: flung 220 px, stunned 0.6 s, spills 50% (pop if overstuffed); food in the band flung 120-280 px along the swat |

**Clock**: round 2:30, intro 4 s, round end 7 s, results 30 s (host can skip). A 3-round match is about 8.7 minutes; 1 round
about 3; 5 rounds about 14.

**Camera**: zoom = clamp(√(viewport area / 600,000), 0.62, 1.5) screen px per world px, so a phone held upright sees about
500×1100 of the world and a 1280×720 laptop about 1030×580; it eases after you (0.18 s) with 60 px of look-ahead and keeps your
hamster a little above centre on touch screens (thumbs below).

**Bots** (the host's page, or the page alone in solo). They read the same screen a player does: food they can see, cheeks,
shadows, the paw band. Each thinks on its own clock.

| | Easy (0.15) | Normal (0.5) | Hard (0.85) |
|---|---|---|---|
| Re-plans every | 0.56 s | 0.42 s | 0.28 s |
| Steering error | ±25° | ±16° | ±6° |
| Goes home at | 70-100 | 65-92 | 60-84 |
| Steers around food that would overstuff it | 32% of trips | 60% | 88% |
| Takes a bite that overstuffs anyway | 30% of trips | 19% | 7% |
| Dodges the paw | 27% | 54% | 80% |
| Golden seed | up to 47 full | up to 62 | up to 78 |

Skill is one number from 0 to 1 (the lobby's choices above; Picnics climb 0.1, 0.22, 0.38, 0.5, 0.6, 0.72, 0.85, 0.95). A
sharper bot banks smaller loads more often and steers around the pieces that would overstuff it: that is what wins.

Personalities shift those numbers. Eight bot hamsters; no two in a match share a coat:

| Name | Coat | Personality |
|---|---|---|
| Gus | ginger and white | Glutton: goes home only past 115, chases cookies, pops a lot |
| Pepper | black with a white band | Bully: hunts full rivals, lurks on paths home |
| Mabel | golden | Banker: home at 55-70, never overstuffs |
| Dot | white with one black spot | Grazer: small food near home, quick trips |
| Rocco | sable with a white blaze | Gambler: golden seeds and cookies first |
| Fig | dove grey | Scavenger: runs to pops and spills |
| Bea | cream | All-rounder |
| Clem | chocolate | All-rounder |

Picnics set the skill: 1 Easy, 2 Easy (sharper), 3 Normal (softer), 4 Normal, 5 Normal (sharper), 6 Hard (softer), 7 Hard,
8 Hard (sharpest).

**How the numbers are checked** (`npm test`, the pure modules over many seeds):
- Every arena: the round ends at 2:30 with every cheek emptied, nothing is ever NaN or off the arena, someone banks.
- Default bots (Normal, each with its personality): median heap about 620, a round's winner about 1,000, first over second
  under 1.35, about 30 bumps a round, never fewer than 8 pieces to find between 0:10 and 2:25.
- Skill ordering in mixed rounds: Easy bots bank a median of about 390, Normal about 515, Hard about 850; Easy still banks.
- Personalities: Gus (glutton) pops the most and banks the least; Mabel (banker) pops the least and banks the most.
- Food schedule: the same on every page for a seed, every piece on a fair spot, golden seeds and the cat in every round.
- Online: a whole match alone with bots, heaps scored by the host; predicted bites and banks under lag; bumps under lag; the
  host reloading and leaving mid-round; a latecomer watching and playing the next round.

## Every screen

Layouts keep clear of `ow.ui.reserved` (top-left 150×70 until it says), the platform's lobby strip (about 88 px at the bottom)
and, during play on touch screens, the stick and Bump button corners. Text is at least 16 px, main buttons at least 56 px tall.

- **Title.** The attract mode full screen (Picnic Blanket, six bots, the camera drifting). Upper middle: the title biscuit,
  "More Than You Can Chew" in piped icing, a bite out of its corner. Lower middle: the Play biscuit (64 px tall on phones, with a
  Space key cap on keyboards) and, if any, a toothpick flag "Best 412". Nothing else.
- **Lobby.** The chosen arena live, your hamster at your burrow, free to run, eat practice crumbs and bank them (practice heap,
  not counted); other players' hamsters run on it too, moved by their pages' presence (every page seats the lobby's players
  in the same order, so each owns the same burrow everywhere); bots doze in their doorways with their names. Desktop and landscape:
  a lobby biscuit card on the right (300 px): the eight seats (avatar or bot hamster head, name, tick when ready, host marker; in
  a private server empty seats are an Invite biscuit), the settings (host: Arena with ◀ ▶ and its twist label, Rounds 1/3/5,
  Bots Off/Easy/Normal/Hard as biscuit toggles; others see the values), Coat ◀ ▶, then the Picnics (with "3/8") and Daily
  biscuits. Portrait phone: a band under the platform's buttons with the eight seat heads and one summary line ("Kitchen Counter ·
  3 rounds · Normal", the host taps it for a settings sheet); tapping your own head opens the coat sheet; Picnics and Daily as
  two stacked biscuits at the right edge, mid-height. The platform's Ready / Start strip at the bottom.
- **Play HUD.** In the world: heaps with toothpick flags showing each pile, name tags over other hamsters (white with a cocoa
  outline), your cheek ring on the ground, the leader's bottle-cap crown, toss and paw shadows. On screen: the timer biscuit top
  centre, nibbled away clockwise as the round runs, the time piped on it (84 px wide on phones, 104 on desktop; hot pink with a
  paw print in the last 30 s, ticking in the last 10); top right your place in a big numeral and your heap ("2nd · 312", with
  "1st 388" under it when you're not leading); edge arrows for your burrow (seat colour and emblem, pulsing past 70), a golden
  seed and the paw. Hints appear as piped words on a small biscuit next to your hamster and crumble away.
- **Intro.** "Round 2" biscuit banner drops in with a bounce, then 3, 2, 1, "EAT!" in huge piped numerals over the arena.
- **Between rounds (7 s).** Cheeks with food left deflate (grey loss numbers); the camera pulls back to the whole arena; the
  flags count up in rank order; a biscuit board slides down: rows of head, name, this round's heap and total, in rank order, and
  one reason line ("Mabel: 4 trips, never popped"; "Gus popped 3 times"); a nibbling biscuit counts to the next round; the host can
  skip.
- **Results (up to 30 s).** A podium of heaps: the top three hamsters standing on their match heaps (height by total), the winner
  with the crown and a burst of crumb confetti and sprinkles; your place in a giant numeral ("2nd!"), your total, "New best!"
  lines, badges. The host's Next biscuit; then the lobby, where Ready plays again.
- **Watching.** The round as it plays, following the leader; "Watching · next round" on a biscuit tag at the bottom centre;
  left/right or a tap changes hamster.
- **Picnics.** A long tablecloth with eight plates on a crumb trail (two rows on desktop, a vertical scroll-free column of
  smaller plates in portrait, paged if it doesn't fit). Each plate: a miniature of the arena, its name, the twist label; locked
  plates under a silver cloche with "Win Picnic 3"; won plates with a golden-seed stamp and the best heap. Tap a plate, then its
  Play biscuit. A Back biscuit top right.
- **Daily.** One card: the date, the arena of the day with its miniature and twist, Play, your best today with your rank, and
  today's top five (name, heap).
- **Solo round results.** Your place in a giant numeral, your heap, "New best!", and when you won a Picnic the next plate's cloche
  lifts on screen. Again (main), Next Picnic (when unlocked), Lobby.
- **Pause** (Picnics and Daily only, on the platform's pause or a hidden page). The scene frozen and darkened slightly behind a
  biscuit: "Paused", Resume (main), Quit.
- **Room closed.** One biscuit, one line, one button: removed → "You were removed" + Play; disconnected → "Connection lost" +
  Rejoin; replaced → "Playing in another tab" + Play here. Each calls `rooms.join()` again with the same options.

## Art direction

**The world.** A summer picnic seen from straight above at hamster scale: a red-and-cream gingham blanket with a woven texture,
soft folds and a fringed edge, on a meadow of thick grass; giant props (the basket's rim, a lemonade glass throwing a pool of
yellow caustic light, a sun hat brim) casting long soft shadows. The giants are never seen, only their shadows: the hand that
tosses food, the cat's paw. That sense of scale is what every arena shares.

**Palette**

| | Hex | Use |
|---|---|---|
| Gingham Red | `#D8413A` | the blanket, the brand |
| Cream | `#FFF2D9` | the blanket's light squares, icing, text |
| Meadow | `#5E9E3F` | grass, lawns |
| Biscuit | `#E3A24F` | every UI panel and button, crackers |
| Cocoa | `#3B2218` | outlines, text outlines, shadow tint |
| Sunflower | `#FFCB2E` | golden seeds, gains, highlights, the crown |
| Hot Cheek | `#FF4D6D` | overstuffed, danger, the last 30 s |

Seats have their own colours, each with an emblem so colour is never the only cue: Sky `#3FA7F2` circle, Lime `#9BD13A` star,
Mint `#2DC38A` triangle, Grape `#9A5BEA` diamond, Tangerine `#FF8424` square, Bubblegum `#FF6FB0` heart, Teal `#16B3AE` cross,
Navy `#2E3F9E` moon.

**Type.** Shrikhand (a heavy retro display italic, like a biscuit tin's lettering) for the title, big words and big numerals,
"piped" in Cream with a thick Cocoa outline and a short drop shadow. Bricolage Grotesque ExtraBold for names, labels and small
numbers. Both self-hosted woff2 (latin subset, one weight each) with their OFL licences. Sentence case, no letter-spaced
capitals.

**The signature: the bitten biscuit.** Every panel, button, banner and plaque is a baked biscuit (golden with a darker baked rim
and docking holes) with a hamster-sized bite out of one corner, its words piped on in white icing. Pressing one takes another bite
(a crunch and a puff of crumbs). The timer is a biscuit being nibbled away. The title is a big one.

**Light and camera.** Orthographic from above, objects drawn standing (y-sorted) and lit from the upper left: every hamster, food
piece and prop casts a soft Cocoa-tinted shadow down-right, longer for taller things. Drifting leaf dapple over the ground; cloud
shadows pass now and then; dandelion fluff and pollen float in a foreground layer that moves faster than the ground (parallax);
grass blades at the blanket's edge overlap hamsters that run through them. Night Garden swaps to moonlight and warm light pools.

**Hamsters** are the stars: chunky round bodies, natural coats with markings (golden, cream, dove, ginger and white, banded,
cinnamon, panda, the shimmering sunflower coat), a bandana knotted in the seat colour with the seat emblem, little pattering
paws, a stub tail, blinking eyes. The face is drawn on the head as a turning sphere, so a hamster turns smoothly through every
direction. The cheeks are the show: they swell to 1.8× the head's width at full and 2.2× at 140, jiggle on a spring with every
bite (a gulp overshoot), and when overstuffed stretch shiny and hot pink, wobble and sweat. Fuller hamsters waddle (body sways,
ears flatten). A pop deflates the hamster to a comic pancake with circling stars. Your hamster has a cream ring with a chevron
in your seat colour; the leader wears a bottle-cap crown.

**Food** in crisp vector with Cocoa outlines and highlights, each a distinct silhouette: a striped seed teardrop, a capped
hazelnut, a blueberry with its crown, a square cracker with holes, a seeded strawberry with leaves, a chocolate-chip cookie, a
golden seed that glints. Heaps by the burrows are real piles of those pieces that grow in steps.

**Juice.** Every bite: munch sound, crumb puff, cheek pulse (within a frame). Banking: pieces tumble in arcs into the heap,
chimes, the flag's number counts up, "+48" floats up. Bumps: stretch on the dash, squash on impact, a 50 ms hit-stop, a dust
burst. POP: 90 ms hit-stop, camera shake from decaying trauma² (smooth noise, never random jitter), a ring of flying food.
Tosses: shadows grow, pieces bounce in with squash. The win: crumb confetti, sprinkles, a fanfare. `reducedMotion`: no shake,
no flashes, half the particles; the cheek shape cues stay.

**Platform UI**: `ow.ui.setLook({ accent: '#FFCB2E', panel: '#3B2218', text: '#FFF2D9' })`.

## Sound

All synthesized with Web Audio (`audio.js`, `music.js`).
- **Munch**: a short filtered-noise crunch plus a pluck whose pitch drops as cheeks fill; bigger food, a deeper crunch; a gulp
  on cookies.
- **Strain**: a thin squeaky whine with vibrato while overstuffed, rising with the fill.
- **POP**: a sharp burst (noise click, low thump, a rising "pfft"), then the patter of food landing and a dizzy slide whistle.
- **Bank**: one marimba note per piece up a pentatonic run, a bell on a big trip, a chord over 100.
- **Bump**: a dash whoosh, a soft thud and a squeak on a hit, a "boing" on head-on bumps.
- **Toss**: a whoosh as the hand's shadow passes, soft thuds as pieces land. **Golden seed**: a shimmer as the beacon lights.
- **Cat**: a low rumbling purr as the last 30 s begins, a rising swish before each swat, a slap on the swat.
- **UI**: a crunch on every biscuit press, a softer one on toggles.
- **Stingers**: marimba hits on 3, 2, 1 and a run on "EAT!", a bell at the buzzer, a short fanfare (marimba with a walking bass)
  for the results.
- **Music**: a small sequencer: upright bass (plucked, swung) and marimba, brushed snare and a shaker, 112 BPM in play; in the last
  30 s it moves up a tone to 132 BPM and adds a cowbell; in menus the bass and a soft marimba alone at 90 BPM, quieter.

## Store art and the trailer

Posters (`?poster=<name>`, drawn by the real renderer from a staged, seeded scene):
- **cover** (1280×720): four hamsters with ballooning cheeks racing across the gingham toward their burrows, one mid-POP
  spraying seeds into the air, a toss landing; the title biscuit once, big, top left.
- **action** (1280×720): close-up of a dashing hamster ramming an overstuffed rival, hit-stop frame, food flying, dust.
- **win** (1280×720): the winner on top of a towering heap with its flag and crown, crumb confetti, rivals' smaller heaps.
- **multi** (1280×720, `thumb-4`): eight hamsters spread over the blanket with the cat's paw shadow sweeping toward them.
- **icon** (512×512): one hamster face front on, cheeks enormous, a golden seed in its paws, on a gingham disc; nothing in the
  outer 10%, no text.
- **badge-<id>** (256×256): a bold symbol on a seat-coloured disc for each badge.

Trailer (28 s, real autoplay gameplay with the game's own sound): 0-3 s a hamster gobbling a line of seeds, cheeks ballooning,
then tumbling a load into its heap (+count); 3-8 s a full waddle home through a field of food; 8-13 s a bump on an overstuffed
rival: POP, food sprays, everyone swarms; 13-18 s the golden seed beacon and the race to it; 18-24 s the cat: the shadow, the
swat, hamsters flung, music up; 24-26 s the final count and the winner on its heap; 26-28 s the title biscuit over gameplay.

## Originality check

It resembles .io eating games (Agar.io, slither: eat to grow), Hungry Hungry Hippos (grab food), carry-it-home games (a bank or
flag you return to) and Star Party (grab stars). What a player notices in the first minute that is different:
- your capacity is your body: the cheeks visibly balloon, and fuller means slower and wider;
- you can't refuse food, so the skill when full is avoiding food, not finding it;
- the push-your-luck POP, a public, comic disaster that feeds everyone else;
- a bump is about what's in the other hamster's cheeks, so the fattest, slowest hamster is the target;
- the giant picnic seen only through its shadows, and the cat at the end.

## Risks

- **Eating feels laggy online.** Eating is shown at once and confirmed by a claim; a lost claim (two hamsters on one seed within
  about 150 ms) takes the bite back with a small puff. Tests race claims through a fake room.
- **Bumps that feel unfair.** The attacker's view decides within a 140 px sanity bound; 1 s immunity after a hit; the porch is
  safe; bots don't bump in the first 30 s.
- **Pops that feel random.** Below 100 never; the risk shows as colour, wobble, sweat and a jagged ring; past 140 is certain;
  the round-end line says why ("popped on a cookie at 128").
- **Phones.** Canvas 2D with cached layers (gingham as rects, pre-rendered shadow and food sprites, no `shadowBlur`), particles
  and dapple scaled by `ow.settings.quality`, `pixelRatio(2)`; the camera zoom keeps hamsters at least 26 px wide on a phone.
- **Scope (8 arenas).** One rules module; arenas are data (size, obstacles, zones: slippery, dark, turning, water, extra showers,
  cat schedule). Build order: the full loop on Picnic Blanket (solo and online), then the arenas, then progression and art.
- **Burrow camping.** The porch is safe, the camper has a 2.5 s cooldown, and an empty hamster isn't worth bumping; Hard bots
  stop lurking after one miss.
- **Host change or reload mid-round.** Everything the host decides is in room state; the food and paw schedules are functions of
  match time; tested with a fake room (host reload, leaver, latecomer).
- **Board too full or too bare.** Toss sizes scale with seats; simulations check the counts.

## Tech and files

Canvas 2D and plain ES modules in `game/` (`"dir": "game"`, no build), drawn at `ow.settings.pixelRatio(2)`. The SDK helpers
come from `/__onceworlds/v1/{match,host,bots}.js`; without the platform (the file opened alone, posters) the title's attract
mode runs and nothing throws.
- Pure (no `window`, `document` or `onceworlds` at import; tested in node): `config.js` (every number), `rng.js`, `arenas.js`,
  `schedule.js` (spread, tosses, golden seeds, paw sweeps), `sim.js` (movement, eating, cheeks, pops, banking, bumps, the cat;
  runs a whole round alone for solo, the title and tests, or as the host's world online), `bots.js` (the brain), `codec.js`
  (the world state, checked on read).
- Page: `main.js` (boot, join first, screens), `net.js` (room glue: createMatch, createHost, claims, presence), `render.js`,
  `hamster.js`, `food.js`, `fx.js`, `ui.js` (biscuits), `audio.js`, `music.js`, `poster.js` (store art and every screen at any
  size, `?poster=`). Autoplay for capture (`?autoplay=1`, never on onceworldsusercontent.com) drives your hamster with a
  skill-0.9 bot brain.
- Tests in `test/` (`node --test "test/*.test.mjs"`): rules and scoring, the world, the schedule, bots and balance over whole
  rounds, and the online flow between pages through a fake room with lag (`test/hub.mjs`; skipped when the SDK's built helpers
  aren't there).

## Changes from the spec

- **The host owns cheek contents and rolls the pops**; each page still owns its body and decides whether a bump hit it. One
  authority for what's in a cheek means a reload or a new host never disagrees about it, and no page can skip a pop.
- **Mouse: the hamster follows the cursor and a click bumps** (the spec's hold-to-move plus click-to-bump collide: every click
  is also a hold).
- **Hamsters wear natural coats plus a seat-coloured bandana with an emblem** instead of one flat colour each: it reads as real
  animals, keeps eight seats distinct for colour-blind players, and makes coats an unlock.
- **Title Play readies you** in a public server so a stranger is eating within 10 s; the lobby is the live blanket with practice
  food, so waiting is play.
- **The game draws its own one countdown** (the room's is 0), inside a 4 s round intro.
- **Added**: the safe porch, 1 s immunity after a hit, a "Bots: Off" setting, the buzzer (unbanked food is lost), the leader's
  crown, and the eight arenas' twists as listed. Heaps reset each round; the match total is the sum.
- **Bites are shared on a tie** (decided in the build): a piece two hamsters reached within 0.7 s goes into both cheeks, so the
  coordinator's rule holds that a bite never visibly undoes; it costs a few extra pieces a round.
- **A solo win counts** toward wins (the Banded coat and the wins board) like a match won; Clean Plate too.
- **Arena choice follows Picnics**: a host's arena picker offers the arenas that host has opened.
