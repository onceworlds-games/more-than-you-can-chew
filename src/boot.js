// The page's entry: the game, a poster (?poster=name, for store pictures) or the look bench (?lab=..., not in production).
import './style.css';

const params = new URLSearchParams(location.search);
const dev = !/onceworldsusercontent\.com$/.test(location.hostname);
const fail = (e) => {
  console.error('[chew] boot failed', e);
  document.body.dataset.error = String((e && e.stack) || e);
};
if (dev && params.get('lab')) import('./lab.js').then((m) => m.runLab(params.get('lab'), params)).catch(fail);
else if (params.get('poster')) {
  import('./poster.js')
    .then((m) => m.runPoster(params.get('poster'), params))
    .catch((e) => {
      fail(e);
      document.body.dataset.ready = 'error';
    });
} else import('./main.js').then((m) => m.boot()).catch(fail);
