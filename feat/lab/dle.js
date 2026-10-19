/* Doctordle rounds: the 6-clue format from our nightly texts. Clue 1 is free; each wrong guess (or skip) opens the next clue; 6 guesses. Archive of past rounds + a pool of new ones. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const MAX = 6;
  function render(el, o) {
    o = o || {}; const home = o.start === 'arc' ? 'arc' : 'menu';
    S = { el, mode: home, home, embed: !!o.embed };
    if (!el.__d6) { el.__d6 = 1; el.addEventListener('click', onClick); el.addEventListener('submit', e => { e.preventDefault(); const i = el.querySelector('[data-d6-in]'); if (i) guess(i.value); }); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/dle.json').then(d => { D = d.rounds; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const FILL = new Set(['acute', 'the', 'a', 'an', 'of', 'with', 'and', 'disease', 'syndrome', 'disorder', 'primary', 'type', 'left', 'right', 'from', 'due', 'to', 'in', 'on', 'attack', 'his', 'her', 'its']);
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]s\b/g, 's').replace(/[^a-z0-9]+/g, ' ').replace(/ae/g, 'e').replace(/oe/g, 'e').replace(/ph/g, 'f').replace(/\bhaem/g, 'hem').replace(/\s+/g, ' ').trim(); }
  const toks = s => norm(s).split(' ').filter(w => w && !FILL.has(w));
  function lev(a, b) { if (Math.abs(a.length - b.length) > 2) return 9; const m = []; for (let i = 0; i <= a.length; i++) { m[i] = [i]; for (let j = 1; j <= b.length; j++) m[i][j] = i ? Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) : j; } return m[a.length][b.length]; }
  function match(g, r) {
    const gn = norm(g); if (!gn) return false; const gt = toks(g).join(' ');
    for (const a of [r.dx].concat(r.al)) {
      const an = norm(a), at = toks(a).join(' ');
      if (gn === an || (at && gt === at)) return true;
      if (at.length >= 6 && lev(gt, at) <= (at.length > 10 ? 2 : 1)) return true;
      if (at.length >= 5 && (' ' + gt + ' ').includes(' ' + at + ' ')) return true;
    }
    return false;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    const arc = D.filter(r => r.arc), pool = D.filter(r => !r.arc);
    if (S.mode === 'menu') {
      const st = L.stat('dle');
      h = (S.embed ? '' : L.top('Doctordle: 6 clues', st ? `avg ${st.avg}%` : '', 'lab')) + `<p class="muted lb-p">Same game as our nightly texts. You get one clue; every wrong guess (or skip) opens the next. Six guesses to name the diagnosis. ${pool.length} new rounds + ${arc.length} from our archive.${S.embed && st ? ' Your average: ' + st.avg + '%.' : ''}</p>
        <div class="lb-btns"><button class="btn pri" data-d6-new type="button">New round</button>${S.embed ? '' : '<button class="btn" data-d6-arc type="button">Our past rounds</button>'}</div>
        <div class="lb-group">${pool.map(r => { const b = L.bestOf('dle', r.id); return `<button class="lb-row" data-d6-go="${r.id}" type="button"><span class="lb-rt"><span class="t1">${b ? esc(r.dx) : 'Round ' + r.id.slice(1)}</span><span class="t2">${esc(r.area)}${b ? '' : ' · unplayed'}</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else if (S.mode === 'arc') {
      h = (S.embed ? '' : `<div class="lb-top"><button class="lb-back" type="button" data-d6-menu>${ic('back', 18)}<span>Doctordle</span></button><span class="lb-tr"></span></div><h2 class="lb-title">Our past rounds</h2>`) + (S.embed ? '' : `<p class="muted lb-p">Every doctordle we've played by text, with how you did that night. Replay any of them.</p>`) + `
        <div class="lb-group">${arc.map(r => { const b = L.bestOf('dle', r.id); return `<button class="lb-row" data-d6-go="${r.id}" type="button"><span class="lb-rt"><span class="t1">#${r.n} · ${esc(r.dx)}</span><span class="t2">${esc(r.date)} · ${esc(r.res)}${b ? ' · replay best ' + b.b + '%' : ''}</span></span><span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else {
      const r = S.r, done = S.mode === 'end', open = done ? MAX : S.open;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-d6-${S.embed ? S.home : r.arc ? 'arc' : 'menu'}>${ic('back', 18)}<span>${(S.embed ? S.home === 'arc' : r.arc) ? 'Past rounds' : '6 clues'}</span></button><span class="lb-tr">${r.arc ? '#' + r.n + ' · ' + esc(r.date) : esc(r.area)}</span></div>`;
      h += `<div class="dl6-dots">${Array.from({ length: MAX }, (x, i) => `<b class="${i < S.g.length ? (S.g[i].ok ? 'o' : 'x') : ''}"></b>`).join('')}</div>`;
      h += `<div class="dl6-clues">${r.c.map((c, i) => i < open ? `<div class="dl6-c"><i>${i + 1}</i><span>${esc(c)}</span></div>` : `<div class="dl6-c lock"><i>${i + 1}</i><span>Locked</span></div>`).join('')}</div>`;
      if (S.g.length) h += `<div class="dl6-g">${S.g.map(g => `<span class="${g.ok ? 'ok' : ''}">${esc(g.t)}</span>`).join('')}</div>`;
      if (!done) h += `<form class="dl6-in" autocomplete="off"><input data-d6-in type="text" placeholder="Your diagnosis…" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"><button class="btn pri" type="submit">Guess</button></form><div class="lb-btns"><button class="btn" data-d6-skip type="button" ${S.open >= MAX ? 'disabled' : ''}>Next clue (costs a guess)</button><button class="btn" data-d6-give type="button">Reveal</button></div>`;
      else {
        h += `<div class="lb-card sim-res"><div class="lz-big">${S.win ? S.score + '%' : '✗'}</div><div class="sim-verd ${S.win ? 'ok' : 'bad'}">${S.win ? `Solved on guess ${S.g.length} with ${S.open} clue${S.open > 1 ? 's' : ''}` : 'Not this time'}</div><p style="margin:8px 0 0;font-weight:700;font-size:18px">${esc(r.dx)}</p>${r.arc ? `<p class="dl6-res">That night: ${esc(r.res)}</p>` : ''}</div>`;
        h += `<div class="lb-card"><p class="lb-why">${esc(r.rev)}</p></div><div class="lb-btns"><button class="btn" data-d6-${S.embed ? S.home : r.arc ? 'arc' : 'menu'} type="button">Done</button><button class="btn pri" data-d6-new type="button">New round</button></div>`;
      }
    }
    S.el.innerHTML = `<div class="lb d6">${h}</div>`;
  }
  function scr() { if (S.embed) { const t = S.el.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo(0, Math.max(0, t)); } else window.scrollTo(0, 0); }
  function start(id) {
    let r = D.find(x => x.id === id);
    if (!r) { const pool = D.filter(x => !x.arc && x.id !== (S.r && S.r.id)); const un = pool.filter(x => !L.bestOf('dle', x.id)); const from = un.length ? un : pool; r = from[Math.floor(Math.random() * from.length)]; }
    S.r = r; S.open = 1; S.g = []; S.win = false; S.mode = 'play'; paint(); scr();
  }
  function finish(win) {
    S.win = win; S.mode = 'end'; S.score = win ? Math.round(100 * (MAX + 1 - S.g.length) / MAX) : 0; L.fx(win);
    L.result('dle', S.r.id, S.score); L.mastery({ id: 'D6:' + S.r.id, tags: ['doctordle', S.r.area], ok: win, choices: 6, label: S.r.dx, src: 'dle' });
    L.award('dle', win ? 3 + (MAX - S.g.length) : 1); paint(); scr();
  }
  function guess(v) {
    v = String(v || '').trim(); if (!v || S.mode !== 'play') return;
    const ok = match(v, S.r); S.g.push({ t: v, ok });
    if (ok) return finish(true);
    if (S.g.length >= MAX) return finish(false);
    S.open = Math.min(MAX, S.open + 1); L.fx(false); paint();
    const i = S.el.querySelector('[data-d6-in]'); if (i) i.focus();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-d6-menu]')) { S.mode = 'menu'; paint(); scr(); return; }
    if (t.closest('[data-d6-arc]')) { S.mode = 'arc'; paint(); scr(); return; }
    if (t.closest('[data-d6-new]')) { start(null); return; }
    const g = t.closest('[data-d6-go]'); if (g) { start(g.dataset.d6Go); return; }
    if (S.mode !== 'play') return;
    if (t.closest('[data-d6-skip]')) { S.g.push({ t: '(skip)', ok: false }); if (S.g.length >= MAX) return finish(false); S.open = Math.min(MAX, S.open + 1); paint(); return; }
    if (t.closest('[data-d6-give]')) { finish(false); return; }
  }
  window.LabMods.dle = { render, match, _S: () => S, _D: () => D };
})();
