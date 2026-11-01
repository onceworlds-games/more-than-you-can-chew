# More Than You Can Chew

Hamsters at a giant picnic. Stuff your cheeks, bank it in your burrow, don't pop. Most food wins.

A 3D party game for up to 8 hamsters (bots fill the empty seats). Run over food to eat it and waddle home to bank it. Past
full a cheekful banks for double, past 120 for triple, but every bite may pop you and spray it all over the cloth. Chain quick
bites into gobbles, bump rivals to knock their food loose, grab the golden seed under its shaft of light, and watch for the
cat's paw in the last thirty seconds.

Alone: eight Picnics with three stars each, a Daily Feast (the same table for everyone, a streak and three goals a day) and
quick rounds. Everything you play earns XP: levels unlock hats, pop effects and trails in the Wardrobe, feats unlock coats.

Play: https://onceworlds.com/play/more-than-you-can-chew

## Run it

```sh
npm install
npm run dev      # http://localhost:5173 (dev only: ?autoplay=1 plays itself, ?lab=hams shows the hamsters up close)
npm run build    # dist/, what the platform serves
```

## Tests

```sh
npm test
```

Plain Node (`node --test`): rules, whole bot rounds on every arena (balance, food, bots), the world's mechanics, progression
(levels, stars, Daily goals and streaks, outfits, saves) and online play. The online tests use the Onceworlds SDK's built
helpers and skip themselves when they aren't there (`OW_SDK_DIST` points at them).

Art credits: [CREDITS.md](CREDITS.md). MIT licensed.
