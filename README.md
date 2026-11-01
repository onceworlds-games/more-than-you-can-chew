# More Than You Can Chew

Stuff your cheeks, bank it in your burrow, don't pop. Most food wins.

A 2D party game for up to 8 hamsters (bots fill the rest): run over food to eat it, waddle home to bank it, bump rivals to
knock their food loose, and don't take one bite too many. Picnics (a ladder of eight arenas) and a Daily for playing alone.

Play: https://onceworlds.com/play/more-than-you-can-chew

## Tests

```sh
npm test
```

Plain Node (`node --test`), no install. The online tests use the Onceworlds SDK's built helpers and skip themselves when
they aren't there (`OW_SDK_DIST` points at them).

MIT licensed.
