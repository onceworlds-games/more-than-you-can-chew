// The page's screens in bitten biscuits: title, lobby (card or band), the wardrobe, Picnics, the Daily, the round's board,
// results with what the round earned (XP, levels, rewards, stars, goals), pause and a closed room. Every name is escaped;
// a screen only re-renders when its markup changes (so its animations play once).

import { ordinal } from './hud.js';
import { hamsterPortrait, hatPortrait } from './render/portrait.js';
import { COATS } from './sim/config.js';
import { TRACK, itemName } from './wardrobe.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const INK = '#3B2218';
const SVG = {
  left: '<svg width="20" height="22" viewBox="0 0 20 22"><path d="M16 2 L3 11 L16 20 Z" fill="#FFF2D9" stroke="#3B2218" stroke-width="3" stroke-linejoin="round"/></svg>',
  right: '<svg width="20" height="22" viewBox="0 0 20 22"><path d="M4 2 L17 11 L4 20 Z" fill="#FFF2D9" stroke="#3B2218" stroke-width="3" stroke-linejoin="round"/></svg>',
  tick: '<svg class="tick" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.5" fill="#2DC38A" stroke="#3B2218" stroke-width="2"/><path d="M5 9.5 L8 12 L13 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  crown: '<svg class="crown" viewBox="0 0 18 18"><path d="M2 14 L3 5 L7 9 L9 3 L11 9 L15 5 L16 14 Z" fill="#FFCB2E" stroke="#3B2218" stroke-width="2" stroke-linejoin="round"/></svg>',
  cloche:
    '<svg class="cloche" viewBox="0 0 136 104"><ellipse cx="68" cy="94" rx="64" ry="8" fill="#9AA3A8" stroke="#3B2218" stroke-width="3"/><path d="M10 92 C10 40 40 18 68 18 C96 18 126 40 126 92 Z" fill="#D7DEE2" stroke="#3B2218" stroke-width="3.5"/><path d="M30 80 C30 52 44 36 62 30" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.8"/><circle cx="68" cy="14" r="8" fill="#C3CBD0" stroke="#3B2218" stroke-width="3"/></svg>',
  lock: '<svg class="lk" viewBox="0 0 24 24"><path d="M7 10 V7.5 a5 5 0 0 1 10 0 V10" fill="none" stroke="#3B2218" stroke-width="2.6"/><rect x="4.5" y="10" width="15" height="11" rx="3" fill="#FFCB2E" stroke="#3B2218" stroke-width="2.4"/><circle cx="12" cy="15.5" r="1.8" fill="#3B2218"/></svg>',
  flame: '<svg class="flame" viewBox="0 0 24 24"><path d="M12 2.5 C13 7 18 8.5 18 14.5 a6 6 0 0 1 -12 0 C6 11 8 9.5 9 7.5 C10 10 11 10.5 12 10 C12.5 7.5 11.5 5 12 2.5 Z" fill="#FF7A2A" stroke="#3B2218" stroke-width="2" stroke-linejoin="round"/><path d="M12 13 C13.5 14.5 15 15.5 14.6 17.6 a2.7 2.7 0 0 1 -5.3 0 C9.1 16 10.6 15 12 13 Z" fill="#FFD34D"/></svg>',
  check: '<svg class="chk" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9.5" fill="#2DC38A" stroke="#3B2218" stroke-width="2.2"/><path d="M6.5 11.5 L9.8 14.5 L15.5 7.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dot: '<svg class="chk" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9.5" fill="rgba(255,242,217,0.25)" stroke="#3B2218" stroke-width="2.2"/></svg>',
};
const star = (on, cls = '') =>
  `<svg class="star ${on ? 'on' : 'off'} ${cls}" viewBox="0 0 24 24"><path d="M12 2.2 l2.95 6.1 6.7.85 -4.95 4.6 1.3 6.6 L12 17.05 6 20.35 l1.3 -6.6 -4.95 -4.6 6.7 -.85 Z" fill="${on ? '#FFCB2E' : 'rgba(59,34,24,0.28)'}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>${on ? '<path d="M8.5 9.5 L10.5 9.2" stroke="#FFF6C2" stroke-width="1.8" stroke-linecap="round"/>' : ''}</svg>`;

// Pop and trail icons (cosmetics you see as effects in the round), and the specials.
const C = { pink: '#FF4D6D', blue: '#3FA7F2', sun: '#FFCB2E', mint: '#2DC38A', plum: '#9A5BEA', cream: '#FFF2D9', crumb: '#E3A24F', orange: '#FF8A2A' };
const S2 = `stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"`;
const heart = (x, y, s, f) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C-6 -1 -4 -7 0 -3.5 C4 -7 6 -1 0 4 Z" fill="${f}" stroke="${INK}" stroke-width="${(2.2 / s).toFixed(2)}" stroke-linejoin="round"/>`;
const spark = (x, y, r, f) => `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${f}" ${S2}/>`;
const ray = (a, c) => {
  const p = (r) => `${(24 + Math.cos(a) * r).toFixed(1)} ${(24 + Math.sin(a) * r).toFixed(1)}`;
  return `<path d="M${p(6)} L${p(15)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M${p(6)} L${p(15)}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${(24 + Math.cos(a) * 19).toFixed(1)}" cy="${(24 + Math.sin(a) * 19).toFixed(1)}" r="2.6" fill="${c}" ${S2}/>`;
};
const arc = (i, c) => `<path d="M${6 + i * 3} 40 A${18 - i * 3} ${18 - i * 3} 0 0 1 ${42 - i * 3} 40" fill="none" stroke="${c}" stroke-width="${c === INK ? 5.4 : 2.6}"/>`;
const ICON = {
  'pop:crumbs': `<circle cx="24" cy="25" r="6" fill="${C.crumb}" ${S2}/><circle cx="11" cy="15" r="4" fill="${C.pink}" ${S2}/><circle cx="37" cy="13" r="3.6" fill="${C.cream}" ${S2}/><circle cx="38" cy="33" r="4.4" fill="${C.sun}" ${S2}/><circle cx="12" cy="36" r="3.4" fill="${C.crumb}" ${S2}/><circle cx="24" cy="8" r="2.6" fill="${C.pink}" ${S2}/>`,
  'pop:confetti': `<rect x="8" y="10" width="7" height="11" rx="1.5" transform="rotate(-25 11 15)" fill="${C.pink}" ${S2}/><rect x="30" y="7" width="7" height="11" rx="1.5" transform="rotate(30 33 12)" fill="${C.blue}" ${S2}/><rect x="20" y="20" width="7" height="11" rx="1.5" transform="rotate(10 23 25)" fill="${C.sun}" ${S2}/><rect x="9" y="30" width="7" height="11" rx="1.5" transform="rotate(50 12 35)" fill="${C.mint}" ${S2}/><rect x="32" y="29" width="7" height="11" rx="1.5" transform="rotate(-40 35 34)" fill="${C.plum}" ${S2}/>`,
  'pop:hearts': `${heart(24, 24, 2.2, '#FF6FB0')}${heart(10, 12, 1.1, '#FF9AC8')}${heart(38, 12, 1.2, C.pink)}${heart(38, 37, 1.0, '#FF9AC8')}${heart(10, 37, 1.0, '#FFD1E8')}`,
  'pop:stars': `${spark(24, 24, 13, C.sun)}${spark(9, 10, 5, '#FFE680')}${spark(39, 36, 5.5, '#FFE680')}${spark(39, 11, 3.6, C.cream)}`,
  'pop:bubbles': `<circle cx="20" cy="26" r="11" fill="#BFE8FF" ${S2}/><circle cx="36" cy="14" r="6" fill="#D8F2FF" ${S2}/><circle cx="36" cy="35" r="4.5" fill="#D8F2FF" ${S2}/><circle cx="10" cy="10" r="3.6" fill="#D8F2FF" ${S2}/><path d="M14 21 Q16 17 20 17" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  'pop:fireworks': [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ray((i / 8) * Math.PI * 2, [C.pink, C.sun, C.blue, '#9BD13A'][i % 4])).join(''),
  'trail:dust': `<circle cx="34" cy="14" r="7" fill="#E9DDC9" ${S2}/><circle cx="22" cy="26" r="5.5" fill="#DCCDB5" ${S2}/><circle cx="12" cy="36" r="4" fill="#CFBFA6" ${S2}/>`,
  'trail:sparkle': `${spark(33, 15, 9, '#FFF2A8')}${spark(18, 29, 6, C.sun)}${spark(9, 39, 4, '#FFF2A8')}`,
  'trail:petals': `<ellipse cx="33" cy="15" rx="8" ry="4.5" transform="rotate(-30 33 15)" fill="#FFB3D0" ${S2}/><ellipse cx="20" cy="27" rx="6" ry="3.6" transform="rotate(20 20 27)" fill="#FF8FB8" ${S2}/><ellipse cx="10" cy="38" rx="4.5" ry="2.8" transform="rotate(-50 10 38)" fill="#FFF0F5" ${S2}/>`,
  'trail:bubbles': `<circle cx="33" cy="15" r="7.5" fill="#D8F2FF" ${S2}/><circle cx="20" cy="28" r="5" fill="#BFE8FF" ${S2}/><circle cx="10" cy="38" r="3.4" fill="#D8F2FF" ${S2}/><path d="M29 12 Q30.5 9.5 33 9.5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
  'trail:flames': `<path d="M30 4 C32 11 40 13 40 22 a10 10 0 0 1 -20 0 C20 17 23 14 25 11 C26 15 28 15.5 29 15 C30 11 29 8 30 4 Z" fill="${C.orange}" ${S2}/><path d="M30 18 C32.5 20.5 35 22 34.4 25.5 a4.5 4.5 0 0 1 -8.8 0 C25.3 23 27.8 21 30 18 Z" fill="#FFD34D"/><path d="M13 26 C14 30 18 31 18 35.5 a5 5 0 0 1 -10 0 C8 33 10 31 11 29.5 C11.5 31 12.5 31 13 26 Z" fill="${C.orange}" ${S2}/>`,
  'trail:rainbow': ['#FF4D6D', '#FFCB2E', '#2DC38A', '#3FA7F2', '#9A5BEA'].map((c, i) => arc(i, INK) + arc(i, c)).join(''),
  'hat:none': `<circle cx="24" cy="24" r="14" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="5 4"/><path d="M14 34 L34 14" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  'sp:chili': `<path d="M14 14 C22 12 36 18 38 34 C38 38 34 38 32 34 C28 24 20 20 13 20 C10 19 10 15 14 14 Z" fill="#E8321E" ${S2}/><path d="M14 15 C11 12 9 9 11 6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M14 15 C11 12 9 9 11 6" fill="none" stroke="#5BA332" stroke-width="2.6" stroke-linecap="round"/><path d="M20 16 C26 17 31 21 33 26" stroke="#FF8A70" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  'sp:gum': `<circle cx="24" cy="24" r="14" fill="#FF7EC0" ${S2}/><path d="M16 18 Q19 13 25 13" stroke="#FFD1E8" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  'sp:pepper': `<circle cx="24" cy="25" r="12" fill="#3B2A22" ${S2}/><path d="M17 22 Q24 17 31 23 M18 29 Q24 25 30 30" stroke="#7A5A44" stroke-width="2" fill="none"/>`,
};
const icon = (key, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 48 48">${ICON[key] || ''}</svg>`;
const SPECIAL_NAME = { chili: 'Chili', gum: 'Bubble gum', pepper: 'Peppercorn' };
const KIND_WORD = { coat: 'coat', hat: 'hat', pop: 'pop', trail: 'trail' };

const btn = (act, label, cls = '', arg = '') => `<button class="bis ${cls}" data-act="${act}"${arg !== '' ? ` data-arg="${esc(arg)}"` : ''}><span class="in">${label}</span></button>`;

const portrait = (s, mood = null) => hamsterPortrait({ coat: s.coat ?? 0, seat: s.seat ?? 0, hat: s.hat || '', mood });
function headHtml(s, cls = 'head') {
  const img = portrait(s);
  return `<span class="${cls}">${img ? `<img alt="" src="${esc(img)}">` : ''}${s.ready ? SVG.tick : ''}${s.host ? SVG.crown : ''}</span>`;
}
const coatIndex = (key) => Math.max(0, COATS.findIndex((c) => c.key === key));

/** The picture for a wardrobe item or a reward. */
function itemPic(kind, id) {
  if (kind === 'coat') {
    const img = hamsterPortrait({ coat: typeof id === 'number' ? id : coatIndex(id), seat: 0 });
    return img ? `<img alt="" src="${esc(img)}">` : '';
  }
  if (kind === 'hat') {
    if (!id) return icon('hat:none');
    const img = hatPortrait(id);
    return img ? `<img alt="" src="${esc(img)}">` : '';
  }
  return icon(`${kind}:${id}`);
}

/** The next reward on the level track after `level`. */
function nextReward(level) {
  for (let l = level + 1; l <= 50; l++) if (TRACK[l]) return { level: l, ...TRACK[l], name: itemName(TRACK[l].kind, TRACK[l].id) };
  return null;
}

const levelChip = (lv) => `<span class="lvchip"><span class="lv">${lv.level}</span><span class="bar"><i style="width:${Math.round(lv.f * 100)}%"></i></span></span>`;

function goalRow(g, attr = '') {
  const f = Math.max(0, Math.min(1, g.have / g.n));
  const prog = g.n > 20 ? `${Math.round(f * 100)}%` : `${g.have}/${g.n}`;
  return `<div class="goal${g.done ? ' done' : ''}${g.fresh ? ' fresh' : ''}" ${attr}>${g.done ? SVG.check : SVG.dot}<span class="gt">${esc(g.text)}</span>${g.done ? (g.fresh ? '<b>+100 XP</b>' : '') : `<span class="gp"><i style="width:${Math.round(f * 100)}%"></i><em>${prog}</em></span>`}</div>`;
}

/** What a round earned: XP lines, the level bar, a level-up, rewards, Picnic stars, Daily goals. */
function progHtml(s, t0 = 0.6) {
  let t = t0;
  const lines = s.xp
    .map((l) => {
      t += 0.13;
      return `<div class="xl" style="animation-delay:${t.toFixed(2)}s"><span>${esc(l.text)}</span><b>+${l.xp}</b></div>`;
    })
    .join('');
  t += 0.2;
  const up = s.to.level > s.from.level;
  const bar = `<div class="lvl${up ? ' up' : ''}" style="animation-delay:${t.toFixed(2)}s"><span class="lv" style="animation-delay:${(t + 1.0).toFixed(2)}s">${s.to.level}</span><span class="bar"><i style="--from:${up ? 0 : Math.round(s.from.f * 100)}%;--to:${Math.round(s.to.f * 100)}%;animation-delay:${(t + 0.2).toFixed(2)}s"></i></span><span class="xpt">+${s.xpTotal} XP</span></div>`;
  t += 1.1;
  const lvup = up ? `<div class="lvup" style="animation-delay:${t.toFixed(2)}s">Level ${s.to.level}!</div>` : '';
  if (up) t += 0.35;
  const rewards = s.rewards.length
    ? `<div class="rewards">${s.rewards.map((r, i) => `<div class="rw" style="animation-delay:${(t + i * 0.18).toFixed(2)}s"><span class="pic">${itemPic(r.kind, r.id)}</span><span class="rn">${esc(r.name)}</span><span class="rk">New ${KIND_WORD[r.kind] || ''}!</span></div>`).join('')}</div>`
    : '';
  if (s.rewards.length) t += s.rewards.length * 0.18 + 0.2;
  let stars = '';
  if (s.stars) {
    const have = s.have || s.stars.got;
    stars = `<div class="pstars">${[0, 1, 2]
      .map((k) => {
        const fresh = s.stars.fresh[k];
        return `<div class="ps${fresh ? ' fresh' : ''}" style="animation-delay:${(t + k * 0.22).toFixed(2)}s">${star(have[k])}<span>${esc(s.starText[k])}</span></div>`;
      })
      .join('')}</div>`;
    t += 0.7;
  }
  const goals = s.goals && s.goals.length ? `<div class="goals mini">${s.goals.map((g) => goalRow(g, `style="animation-delay:${t.toFixed(2)}s"`)).join('')}</div>` : '';
  return `<div class="prog">${lines ? `<div class="xls">${lines}</div>` : ''}${bar}${lvup}${rewards}${stars}${goals}</div>`;
}

export function createUi(root, handlers) {
  let shown = '';
  let html = '';
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'noop') return;
    if (act === 'locked') {
      b.classList.remove('nope');
      void b.offsetWidth;
      b.classList.add('nope');
      if (handlers.press) handlers.press('noop');
      return;
    }
    b.classList.add('pressed');
    setTimeout(() => b.classList.remove('pressed'), 120);
    if (handlers.press) handlers.press(act);
    const f = handlers[act];
    if (f) f(b.dataset.arg);
  });

  function show(id, markup) {
    if (id === shown && markup === html) return false;
    // Scrolled lists keep their place when the screen redraws.
    const scrolls = id === shown ? [...root.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, el.scrollTop]) : [];
    shown = id;
    html = markup;
    root.innerHTML = markup;
    for (const [k, top] of scrolls) {
      const el = root.querySelector(`[data-keep="${k}"]`);
      if (el) el.scrollTop = top;
    }
    return true;
  }
  function live(name, text) {
    for (const el of root.querySelectorAll(`[data-live="${name}"]`)) if (el.textContent !== String(text)) el.textContent = String(text);
  }

  const modeButtons = (v) =>
    `${btn('picnics', `Picnics <span class="count">${star(true, 'tiny')}${v.stars}</span>`, 'small')}${btn('daily', `Daily${v.streak ? ` <span class="count">${SVG.flame}${v.streak}</span>` : v.goalsDone < 3 ? ` <span class="count">${v.goalsDone}/3</span>` : ''}`, 'small bl')}${btn('wardrobe', `Wardrobe${v.fresh ? '<span class="newdot">New!</span>' : ''}`, 'small')}`;

  const screens = {
    none() {
      return '';
    },
    title(v) {
      const chips = `${v.level > 1 ? `<span class="chip">Level ${v.level}</span>` : ''}${v.streak ? `<span class="chip">${SVG.flame}${v.streak}</span>` : ''}${v.best ? `<span class="chip">Best ${esc(v.best)}</span>` : ''}`;
      return `<div class="title">
        <div class="card logo"><div class="in"><span class="piped l1">More Than</span><span class="piped l2">You Can <em>Chew</em></span></div></div>
        <div class="play-row">
          ${btn('play', `Play${v.keys ? ' <span class="key">Space</span>' : ''}`, 'big')}
          ${chips ? `<div class="chips">${chips}</div>` : ''}
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
      const streak = v.streak ? `<span class="chip sm">${SVG.flame}${v.streak}</span>` : '';
      if (v.portrait) {
        const heads = v.seats.map((s) => (s.empty ? `<span class="head" style="opacity:.5"></span>` : headHtml(s))).join('');
        const summary = `${esc(v.arenaName)} · ${v.rounds} round${v.rounds === 1 ? '' : 's'} · ${esc(v.bots[0].toUpperCase() + v.bots.slice(1))}`;
        const sheet = v.sheet === 'settings' ? sheetHtml('Settings', settings) : '';
        return `<div class="card band" style="top:${v.top}px"><div class="in">
            <div class="heads">${heads}</div>
            ${v.isHost ? `<button class="summary" data-act="sheet" data-arg="settings">${summary} ${SVG.right}</button>` : `<div class="summary">${summary}</div>`}
          </div></div>
          <div class="side" style="top:${v.sideTop}px">${modeButtons(v)}${v.standalone ? btn('quick', 'Start', 'small') : ''}</div>
          <div class="lvfloat">${levelChip(v.level)}${streak}</div>
          ${sheet}`;
      }
      return `<div class="card lobby-card" style="top:${v.top}px"><div class="in" data-keep="lobby">
          <div class="lc-a">
            <div class="mebar">${levelChip(v.level)}<span class="lvtxt">Level ${v.level.level}</span>${streak}</div>
            <div><div class="piped arena-name">${esc(v.arenaName)}</div><div class="twist">${esc(v.twist)}</div></div>
            <div class="seats">${seatList}</div>
          </div>
          <div class="lc-b">
            ${settings}
            <div class="solo-row">${modeButtons(v)}</div>
            ${v.standalone ? `<div style="display:flex;justify-content:center">${btn('quick', 'Start', '')}</div>` : ''}
          </div>
        </div></div>`;
    },
    wardrobe(v) {
      const tabs = v.tabs.map((t) => btn('tab', `${esc(t.name)}${t.fresh ? '<span class="newdot sm"></span>' : ''}`, `small nobite ${v.tab === t.id ? 'on' : 'off'}`, t.id)).join('');
      const items = v.items
        .map(
          (it) => `<button class="item${it.on ? ' on' : ''}${it.locked ? ' locked' : ''}" data-act="${it.locked ? 'locked' : 'wear'}" data-arg="${esc(it.arg)}">
            <span class="pic">${itemPicFor(v.tab, it)}</span>
            <span class="inm">${esc(it.name)}</span>
            ${it.locked ? `<span class="cond">${SVG.lock}${esc(it.cond)}</span>` : ''}
            ${it.on ? SVG.check : ''}
            ${it.fresh ? '<span class="newtag">New!</span>' : ''}
          </button>`,
        )
        .join('');
      const nx = nextReward(v.level.level);
      return `<div class="card wardrobe${v.portrait ? ' port' : ''}"${v.portrait ? '' : ` style="top:${v.top}px"`}><div class="in">
          <div class="whead"><span class="piped">Wardrobe</span>${btn('lobby', 'Done', 'small')}</div>
          <div class="wtabs">${tabs}</div>
          <div class="grid" data-keep="wgrid-${v.tab}">${items}</div>
          <div class="wfoot">${levelChip(v.level)}<span class="nx">${nx ? `Next: ${esc(nx.name)} at level ${nx.level}` : 'The whole track is yours!'}</span></div>
        </div></div>`;
    },
    board(v) {
      const rows = v.rows
        .map(
          (r, i) => `<div class="r${r.me ? ' me' : ''}" style="animation-delay:${0.15 + i * 0.07}s"><span class="pl">${ordinal(r.place)}</span>${headHtml(r)}<span class="nm">${esc(r.name)}</span><span class="n">${r.heap}</span><span class="tot">${r.total}</span></div>`,
        )
        .join('');
      const s = v.summary;
      const xp = s ? `<div class="bxp">${levelChip({ level: s.to.level, f: s.to.f })}<span>+${s.xpTotal} XP</span>${s.to.level > s.from.level ? `<b>Level ${s.to.level}!</b>` : ''}</div>` : '';
      return `<div class="card board" style="top:${v.top ?? 12}px"><div class="in">
          <div class="hdr"><span class="piped">${esc(v.title)}</span></div>
          <div class="colh"><span></span><span></span><span></span><span>Heap</span><span>Total</span></div>
          <div class="rows">${rows}</div>
          ${v.why ? `<div class="why">${esc(v.why)}</div>` : ''}
          ${xp}
          <div class="nextin"><span data-live="next">${esc(v.next)}</span>${v.canSkip ? btn('skip', 'Skip', 'small') : ''}</div>
        </div></div>`;
    },
    results(v) {
      return resultsHtml({
        place: v.myPlace,
        headline: v.headline,
        podium: v.podium,
        lines: v.lines,
        summary: v.summary,
        buttons: v.canNext ? btn('next', 'Next', 'big') : `<span class="label" data-live="next">${esc(v.next || '')}</span>`,
      });
    },
    solo(v) {
      return resultsHtml({
        place: v.place,
        title: v.title,
        podium: v.podium,
        lines: v.lines,
        summary: v.summary,
        buttons: `${btn('again', 'Again', 'big')}${v.canNext ? btn('nextPicnic', 'Next Picnic', '') : ''}${btn('lobby', 'Lobby', 'bl')}`,
      });
    },
    picnics(v) {
      const plates = v.plates
        .map(
          (p, i) => `<button class="plate${v.sel === i ? ' sel' : ''}${p.locked ? ' locked' : ''}" data-act="plate" data-arg="${i}">
            <span class="num">${i + 1}</span>
            ${p.locked ? SVG.cloche : `<img class="mini" alt="" src="${esc(p.img)}" onerror="this.style.visibility='hidden'">`}
            <span class="pnm">${esc(p.name)}</span>
            ${p.locked ? `<span class="lock">${esc(p.unlock)}</span>` : `<span class="pst">${p.stars.map((s) => star(s)).join('')}</span>`}
          </button>`,
        )
        .join('');
      const sel = v.sel !== null && v.sel !== undefined ? v.plates[v.sel] : null;
      const detail = sel
        ? `<div class="card pdetail"><div class="in">
            <div class="pd-a"><span class="piped pd-name">${esc(sel.name)}</span><span class="twist">${esc(sel.twist)}</span>
              ${sel.specials.length ? `<span class="sps">${sel.specials.map((s) => `<span class="sp">${icon(`sp:${s}`)}${esc(SPECIAL_NAME[s])}</span>`).join('')}</span>` : ''}
            </div>
            <div class="pd-b">${sel.goals.map((g, k) => `<div class="pg${sel.stars[k] ? ' got' : ''}">${star(sel.stars[k])}<span>${esc(g)}</span></div>`).join('')}</div>
            <div class="pd-c">${sel.locked ? `<span class="label">${SVG.lock} ${esc(sel.unlock)}</span>` : `${btn('playPicnic', 'Play', 'big', v.sel)}${sel.best ? `<span class="pbest">Best ${esc(sel.best)}</span>` : ''}`}</div>
          </div></div>`
        : '';
      return `<div class="screen picnics">
          <div class="top"><span class="piped ttl">Picnics</span><span class="chip">${star(true, 'tiny')} ${v.stars}/${v.crown}</span>${btn('lobby', 'Back', 'small')}</div>
          <div class="card cloth"><div class="in" data-keep="plates">${plates}</div></div>
          ${detail}
        </div>`;
    },
    daily(v) {
      return `<div class="screen daily">
          <div class="card daily-card"><div class="in">
            <div class="dc-a">
              <span class="piped dc-title">Daily Feast</span>
              <span class="dc-date">${esc(v.date)}</span>
              <img class="mini" alt="" src="${esc(v.img)}" onerror="this.style.visibility='hidden'">
              <span class="piped dc-arena">${esc(v.arenaName)}</span>
              <span class="twist">${esc(v.twist)}</span>
            </div>
            <div class="dc-b">
              <div class="streak">${SVG.flame}<span>${v.streak ? `${v.streak}-day streak` : 'Start a streak'}</span>${v.played ? '<em>Played today</em>' : ''}</div>
              <div class="goals">${v.goals.map((g) => goalRow(g)).join('')}</div>
              ${btn('playDaily', v.played ? 'Play again' : 'Play', 'big')}
              <span class="label">${v.best ? `Your best today ${esc(v.best)}${v.rank ? ` · ${ordinal(v.rank)}` : ''}` : 'Same food for everyone today'}</span>
              ${v.top.length ? `<div class="top5">${v.top.map((t, i) => `<div class="t"><span>${i + 1}. ${esc(t.name)}</span><span>${esc(t.score)}</span></div>`).join('')}</div>` : ''}
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

  function itemPicFor(tab, it) {
    if (tab === 'coat') return itemPic('coat', Number(String(it.arg).split(':')[1]));
    if (tab === 'hat') return itemPic('hat', it.icon === 'none' ? '' : it.icon);
    return icon(`${tab}:${it.icon}`);
  }

  function resultsHtml(o) {
    const order = [1, 0, 2].filter((i) => o.podium[i]);
    const pods = order
      .map((i) => {
        const p = o.podium[i];
        const h = [118, 86, 62][i];
        const img = portrait(p, p.place === 1 ? 'win' : null);
        return `<div class="pod${p.me ? ' me' : ''}"><img class="ham" alt="" src="${esc(img)}" style="animation-delay:${(0.5 + (2 - i) * 0.12).toFixed(2)}s"><span class="nm">${esc(p.name)}</span><div class="card stack" style="--h:${h}px;animation-delay:${(0.2 + (2 - i) * 0.12).toFixed(2)}s"><div class="in"><div class="pn">${ordinal(p.place)}</div><div class="tot">${p.total}</div></div></div></div>`;
      })
      .join('');
    const head = o.place ? `<div class="bigplace${o.place === 1 ? ' gold' : ''}">${ordinal(o.place)}!</div>` : `<div class="bigplace">${esc(o.headline || 'Results')}</div>`;
    const lines = o.lines.length ? `<div class="lines">${o.lines.map((l) => `<span class="${l.best ? 'best' : ''}">${esc(l.text)}</span>`).join('')}</div>` : '';
    return `<div class="results${o.summary ? ' has-prog' : ''}">
        <div class="rcol">
          ${o.title ? `<div class="rtitle">${esc(o.title)}</div>` : ''}
          ${head}
          <div class="podium">${pods}</div>
          ${lines}
        </div>
        ${o.summary ? `<div class="card progcard"><div class="in" data-keep="prog">${progHtml(o.summary)}</div></div>` : ''}
        <div class="btns">${o.buttons}</div>
      </div>`;
  }

  function sheetHtml(title, body) {
    return `<div class="sheet-wrap" data-act="closeSheet"><div class="card sheet" data-act="noop"><div class="in"><h2 class="piped">${esc(title)}</h2>${body}<div style="display:flex;justify-content:center">${btn('closeSheet', 'Done', 'small')}</div></div></div></div>`;
  }

  return {
    /** Shows a screen: `name` with view `v`. */
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
