// The page's screens in bitten biscuits: title, lobby (card or band), sheets, the round's board, results, Picnics,
// the Daily, solo results, pause and a closed room. Every name is escaped; screens only re-render when they change.

import { drawHamster } from './hamster.js';
import { makeCanvas } from './food.js';
import { ordinal } from './hud.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icons = new Map();
/** A hamster seen from above, facing up, as an image URL (cached). */
export function hamsterIcon(coat, seat, size = 64, fill = 0) {
  const key = `${coat}|${seat}|${size}|${fill}`;
  if (icons.has(key)) return icons.get(key);
  let url = '';
  try {
    const c = makeCanvas(size * 2, size * 2);
    const ctx = c.getContext('2d');
    ctx.scale((size * 2) / 64, (size * 2) / 64);
    drawHamster(ctx, { x: 32, y: 36, a: -Math.PI / 2, fill, coat, seat, t: 0, gait: 0, speed: 0, wob: 0, bite: 0, sx: 0.98, sy: 0.98, sway: 0, blink: 0, dizzy: 0, happy: 0, away: false, crown: false });
    url = c.toDataURL ? c.toDataURL() : '';
  } catch {
    url = '';
  }
  icons.set(key, url);
  return url;
}

const SVG = {
  left: '<svg width="20" height="22" viewBox="0 0 20 22"><path d="M16 2 L3 11 L16 20 Z" fill="#FFF2D9" stroke="#3B2218" stroke-width="3" stroke-linejoin="round"/></svg>',
  right: '<svg width="20" height="22" viewBox="0 0 20 22"><path d="M4 2 L17 11 L4 20 Z" fill="#FFF2D9" stroke="#3B2218" stroke-width="3" stroke-linejoin="round"/></svg>',
  tick: '<svg class="tick" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="#2DC38A" stroke="#3B2218" stroke-width="2"/><path d="M5 9.5 L8 12 L13 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crown: '<svg class="crown" viewBox="0 0 18 18"><path d="M2 14 L3 5 L7 9 L9 3 L11 9 L15 5 L16 14 Z" fill="#FFCB2E" stroke="#3B2218" stroke-width="2" stroke-linejoin="round"/></svg>',
  stamp: '<svg class="stamp" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="#FFCB2E" stroke="#3B2218" stroke-width="3"/><path d="M20 8 C27 13 27 26 20 32 C13 26 13 13 20 8 Z" fill="#E7A90C" stroke="#3B2218" stroke-width="2.4"/><path d="M17 14 C18 19 18 24 17 28 M23 14 C22 19 22 24 23 28" stroke="#FFF6C2" stroke-width="1.6" fill="none"/></svg>',
  cloche:
    '<svg class="cloche" viewBox="0 0 136 104"><ellipse cx="68" cy="94" rx="64" ry="8" fill="#9AA3A8" stroke="#3B2218" stroke-width="3"/><path d="M10 92 C10 40 40 18 68 18 C96 18 126 40 126 92 Z" fill="#D7DEE2" stroke="#3B2218" stroke-width="3.5"/><path d="M30 80 C30 52 44 36 62 30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8"/><circle cx="68" cy="14" r="8" fill="#C3CBD0" stroke="#3B2218" stroke-width="3"/></svg>',
};

const btn = (act, label, cls = '', arg = '') => `<button class="bis ${cls}" data-act="${act}"${arg !== '' ? ` data-arg="${esc(arg)}"` : ''}><span class="in">${label}</span></button>`;

function headHtml(s) {
  const img = s.avatar ? s.avatar : hamsterIcon(s.coat ?? 0, s.seat ?? 0, 40);
  return `<span class="head">${img ? `<img alt="" src="${esc(img)}">` : ''}${s.ready ? SVG.tick : ''}${s.host ? SVG.crown : ''}</span>`;
}

export function createUi(root, handlers) {
  let shown = '';
  let html = '';
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 120);
    if (handlers.press) handlers.press(act);
    const f = handlers[act];
    if (f) f(b.dataset.arg);
  });

  function show(id, markup) {
    if (id === shown && markup === html) return false;
    shown = id;
    html = markup;
    root.innerHTML = markup;
    return true;
  }
  function live(name, text) {
    for (const el of root.querySelectorAll(`[data-live="${name}"]`)) if (el.textContent !== String(text)) el.textContent = String(text);
  }

  const screens = {
    none() {
      return '';
    },
    title(v) {
      return `<div class="title">
        <div class="card logo"><div class="in"><span class="piped l1">More Than</span><span class="piped l2">You Can <em>Chew</em></span></div></div>
        <div class="play-row">
          ${btn('play', `Play${v.keys ? ' <span class="key">Space</span>' : ''}`, 'big')}
          ${v.best ? `<span class="flag">Best ${esc(v.best)}</span>` : ''}
        </div>
      </div>`;
    },
    lobby(v) {
      const seatList = v.seats
        .map((s) =>
          s.empty
            ? `<div class="seat empty">${v.canInvite ? btn('invite', 'Invite', 'small') : `<span class="head"></span><span class="nm">Open</span>`}</div>`
            : `<div class="seat${s.me ? ' me' : ''}">${headHtml(s)}<span class="nm">${esc(s.name)}</span></div>`,
        )
        .join('');
      const settings = v.isHost
        ? `<div class="row"><span class="lbl">Arena</span>${btn('arena', SVG.left, 'arrow small nobite', -1)}<span class="val">${esc(v.arenaName)}</span>${btn('arena', SVG.right, 'arrow small nobite', 1)}</div>
           <div class="row"><span class="lbl">Rounds</span><span class="toggles">${[1, 3, 5].map((n) => btn('rounds', String(n), `small nobite ${v.rounds === n ? 'on' : 'off'}`, n)).join('')}</span></div>
           <div class="row"><span class="lbl">Bots</span><span class="toggles">${['off', 'easy', 'normal', 'hard'].map((n) => btn('bots', n[0].toUpperCase() + n.slice(1), `small nobite ${v.bots === n ? 'on' : 'off'}`, n)).join('')}</span></div>`
        : `<div class="row"><span class="val">${esc(`${v.rounds} round${v.rounds === 1 ? '' : 's'} · Bots ${v.bots[0].toUpperCase() + v.bots.slice(1)}`)}</span></div>`;
      const coat = `<div class="row"><span class="lbl">Coat</span>${btn('coat', SVG.left, 'arrow small nobite', -1)}<span class="val">${esc(v.coatName)}${v.coatLocked ? `<br><span style="font-size:15px;color:#ffe9b8">${esc(v.coatLocked)}</span>` : ''}</span>${btn('coat', SVG.right, 'arrow small nobite', 1)}</div>`;
      const solo = `<div class="solo-row">${btn('picnics', `Picnics <span class="count">${v.picnicsWon}/8</span>`, 'small')}${btn('daily', 'Daily', 'small bl')}</div>`;
      if (v.portrait) {
        const heads = v.seats.map((s) => (s.empty ? `<span class="head" style="opacity:.5"></span>` : s.me ? `<button class="tap" data-act="sheet" data-arg="coat" style="border:0;background:none;padding:0;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center">${headHtml(s)}</button>` : headHtml(s))).join('');
        const summary = `${esc(v.arenaName)} · ${v.rounds} round${v.rounds === 1 ? '' : 's'} · ${esc(v.bots[0].toUpperCase() + v.bots.slice(1))}`;
        const sheet = v.sheet === 'settings' ? sheetHtml('Settings', `${settings}`) : v.sheet === 'coat' ? sheetHtml('Your coat', `<div style="display:flex;justify-content:center"><img alt="" src="${esc(hamsterIcon(v.coat, v.mySeat, 64))}" width="96" height="96"></div>${coat}`) : '';
        return `<div class="card band" style="top:${v.top}px"><div class="in">
            <div class="heads">${heads}</div>
            ${v.isHost ? `<button class="summary" data-act="sheet" data-arg="settings">${summary} ${SVG.right}</button>` : `<div class="summary">${summary}</div>`}
          </div></div>
          <div class="side" style="top:${v.sideTop}px">${btn('picnics', `Picnics <span class="count">${v.picnicsWon}/8</span>`, 'small')}${btn('daily', 'Daily', 'small')}${v.standalone ? btn('quick', 'Start', 'small') : ''}</div>
          ${sheet}`;
      }
      return `<div class="card lobby-card" style="top:${v.top}px"><div class="in">
          <div class="lc-a">
            <div><div class="piped arena-name">${esc(v.arenaName)}</div><div class="twist">${esc(v.twist)}</div></div>
            <div class="seats">${seatList}</div>
          </div>
          <div class="lc-b">
            ${settings}
            ${coat}
            ${solo}
            ${v.standalone ? `<div style="display:flex;justify-content:center">${btn('quick', 'Start', '')}</div>` : ''}
          </div>
        </div></div>`;
    },
    board(v) {
      const rows = v.rows
        .map(
          (r, i) => `<div class="r${r.me ? ' me' : ''}" style="animation-delay:${0.15 + i * 0.07}s"><span class="pl">${ordinal(r.place)}</span>${headHtml(r)}<span class="nm">${esc(r.name)}</span><span class="n">${r.heap}</span><span class="tot">${r.total}</span></div>`,
        )
        .join('');
      return `<div class="card board" style="top:${v.top ?? 12}px"><div class="in">
          <div class="hdr"><span class="piped">${esc(v.title)}</span></div>
          <div class="colh"><span></span><span></span><span></span><span>Heap</span><span>Total</span></div>
          <div class="rows">${rows}</div>
          ${v.why ? `<div class="why">${esc(v.why)}</div>` : ''}
          <div class="nextin"><span data-live="next">${esc(v.next)}</span>${v.canSkip ? btn('skip', 'Skip', 'small') : ''}</div>
        </div></div>`;
    },
    results(v) {
      const order = [1, 0, 2].filter((i) => v.podium[i]);
      const pods = order
        .map((i) => {
          const p = v.podium[i];
          const h = [150, 110, 80][i];
          const img = p.avatar || hamsterIcon(p.coat ?? 0, p.seat ?? 0, 72);
          return `<div class="pod"><img class="ham" alt="" src="${esc(img)}"><span class="nm">${esc(p.name)}</span><div class="card stack" style="--h:${h}px;animation-delay:${0.2 + (2 - i) * 0.12}s"><div class="in"><div class="pn">${ordinal(p.place)}</div><div class="tot">${p.total}</div></div></div></div>`;
        })
        .join('');
      return `<div class="results">
          ${v.myPlace ? `<div class="bigplace${v.myPlace === 1 ? ' gold' : ''}">${ordinal(v.myPlace)}!</div>` : `<div class="bigplace">${esc(v.headline || 'Results')}</div>`}
          <div class="podium">${pods}</div>
          <div class="lines">${v.lines.map((l) => `<span class="${l.best ? 'best' : ''}">${esc(l.text)}</span>`).join('')}</div>
          <div class="btns">${v.canNext ? btn('next', 'Next', 'big') : `<span class="label" data-live="next">${esc(v.next || '')}</span>`}</div>
        </div>`;
    },
    solo(v) {
      return `<div class="results">
          <div class="bigplace${v.place === 1 ? ' gold' : ''}">${ordinal(v.place)}!</div>
          <div class="podium">${v.podium
            .map((p, i) => {
              const h = [150, 110, 80][i];
              return `<div class="pod" style="order:${[1, 0, 2][i]}"><img class="ham" alt="" src="${esc(p.avatar || hamsterIcon(p.coat ?? 0, p.seat ?? 0, 72))}"><span class="nm">${esc(p.name)}</span><div class="card stack" style="--h:${h}px;animation-delay:${0.2 + (2 - i) * 0.12}s"><div class="in"><div class="pn">${ordinal(p.place)}</div><div class="tot">${p.total}</div></div></div></div>`;
            })
            .join('')}</div>
          <div class="lines">${v.lines.map((l) => `<span class="${l.best ? 'best' : ''}">${esc(l.text)}</span>`).join('')}</div>
          <div class="btns">${btn('again', 'Again', 'big')}${v.canNext ? btn('nextPicnic', 'Next Picnic', '') : ''}${btn('lobby', 'Lobby', 'bl')}</div>
        </div>`;
    },
    picnics(v) {
      const plates = v.plates
        .map(
          (p, i) => `<button class="plate${v.sel === i ? ' sel' : ''}" data-act="plate" data-arg="${i}">
            <span class="num">${i + 1}</span>
            ${p.locked ? SVG.cloche : `<img class="mini" alt="" src="${esc(p.mini)}">`}
            ${p.won ? SVG.stamp : ''}
            <span class="pnm">${esc(p.name)}</span>
            ${p.locked ? `<span class="lock">${esc(p.unlock)}</span>` : `<span class="ptw"><span class="tw">${esc(p.twist)}</span>${p.best ? `<span class="tw"> · </span>Best ${p.best}` : ''}</span>`}
          </button>`,
        )
        .join('');
      return `<div class="screen">
          <div class="top"><span class="piped" style="font-size:34px">Picnics</span>${btn('lobby', 'Back', 'small')}</div>
          <div class="card cloth" style="position:relative"><div class="in">${plates}</div></div>
          <div class="go-bar">${v.sel !== null && !v.plates[v.sel].locked ? btn('playPicnic', `Play ${esc(v.plates[v.sel].name)}`, 'big', v.sel) : ''}</div>
        </div>`;
    },
    daily(v) {
      return `<div class="screen" style="justify-content:center">
          <div class="card daily-card"><div class="in">
            <div class="dc-a">
              <span class="piped dc-title">Daily · ${esc(v.date)}</span>
              <img class="mini" alt="" src="${esc(v.mini)}">
              <span class="piped" style="font-size:22px">${esc(v.arenaName)}</span>
              <span class="twist">${esc(v.twist)}</span>
            </div>
            <div class="dc-b">
              ${btn('playDaily', 'Play', 'big')}
              <span class="label">${v.best ? `Your best today ${v.best}${v.rank ? ` · ${ordinal(v.rank)}` : ''}` : 'Same food for everyone today'}</span>
              ${v.top.length ? `<div class="top5">${v.top.map((t, i) => `<div class="t"><span>${i + 1}. ${esc(t.name)}</span><span>${t.score}</span></div>`).join('')}</div>` : ''}
              ${btn('lobby', 'Back', 'small bl')}
            </div>
          </div></div>
        </div>`;
    },
    pause() {
      return `<div class="center dim"><div class="card msg"><div class="in"><span class="piped">Paused</span>${btn('resume', 'Resume', 'big')}${btn('quit', 'Quit', 'small bl')}</div></div></div>`;
    },
    closed(v) {
      return `<div class="center dim"><div class="card msg"><div class="in"><span class="piped">${esc(v.text)}</span>${btn('rejoin', esc(v.button), 'big')}</div></div></div>`;
    },
  };

  function sheetHtml(title, body) {
    return `<div class="sheet-wrap" data-act="closeSheet"><div class="card sheet" data-act="noop"><div class="in"><h2 class="piped">${esc(title)}</h2>${body}<div style="display:flex;justify-content:center">${btn('closeSheet', 'Done', 'small')}</div></div></div></div>`;
  }

  return {
    /** Shows a screen: `name` with view `v`; `id` keeps it from re-rendering while only live values change. */
    render(name, v = {}) {
      const markup = screens[name] ? screens[name](v) : '';
      return show(`${name}`, markup);
    },
    live,
    get screen() {
      return shown;
    },
    focusMain() {
      const b = root.querySelector('.bis.big');
      if (b) b.focus({ preventScroll: true });
    },
  };
}
