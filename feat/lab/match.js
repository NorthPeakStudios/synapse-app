/* Drug class matcher: mechanism → class, then class → example drug. Tap one on the left, then its partner on the right. No doses. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  let S = null, T = null;
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__mt) { el.__mt = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/drugs.json').then(d => { T = d.t; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('match');
      h = L.top('Drug class matcher', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Match each mechanism to its drug class, then each class to an example drug. ${T.length} classes in the pool, 5 per round.</p>
        <div class="lb-btns"><button class="btn pri" data-mt-start type="button">Start a round</button><button class="btn" data-mt-list type="button">All classes</button></div><p class="lb-foot">Mechanisms and classes only. No doses. Not medical advice.</p>`;
    } else if (S.mode === 'list') {
      h = `<div class="lb-top"><button class="lb-back" type="button" data-mt-menu>${ic('back', 18)}<span>Matcher</span></button><span class="lb-tr"></span></div><h2 class="lb-title">All ${T.length} classes</h2><div class="lb-group">${T.map(t => `<div class="mt-li"><b>${esc(t[1])}</b><span>${esc(t[0])}</span><i>e.g. ${esc(t[2])}</i></div>`).join('')}</div>`;
    } else if (S.mode === 'end') {
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.score >= 70 ? 'Pharm brain' : 'Keep matching'}</div><div class="muted small">${S.miss} wrong tap${S.miss === 1 ? '' : 's'}</div></div>
        <div class="lb-card sim-sec"><h3>This round</h3><ul>${S.set.map(i => `<li><b>${esc(T[i][1])}</b>: ${esc(T[i][0])} <i>(e.g. ${esc(T[i][2])})</i></li>`).join('')}</ul></div>
        <div class="lb-btns"><button class="btn" data-mt-menu type="button">Done</button><button class="btn pri" data-mt-start type="button">Another round</button></div>`;
    } else {
      const ph = S.phase, Lk = ph === 1 ? 0 : 1, Rk = ph === 1 ? 1 : 2;
      const col = (side, order, key) => order.map(i => { const done = S.done.has(i), sel = S.sel && S.sel.side === side && S.sel.i === i, bad = S.bad && S.bad.side === side && S.bad.i === i; return `<button type="button" class="mt-c${done ? ' done' : ''}${sel ? ' sel' : ''}${bad ? ' bad' : ''}" data-mt-side="${side}" data-mt-i="${i}" ${done ? 'disabled' : ''}>${esc(T[i][key])}</button>`; }).join('');
      h = `${L.top('', `Step ${ph} of 2`, 'lab')}<p class="mt-h">${ph === 1 ? 'Match the <b>mechanism</b> to the <b>class</b>' : 'Match the <b>class</b> to an <b>example drug</b>'}</p>
        <div class="mt-board"><div class="mt-col l">${col('l', S.lo, Lk)}</div><div class="mt-col r">${col('r', S.ro, Rk)}</div></div>
        <p class="muted small" style="text-align:center">${S.done.size}/${S.set.length} matched · tap left, then right</p>`;
    }
    S.el.innerHTML = `<div class="lb mt">${h}</div>`;
  }
  function start() { S.set = L.shuffle(T.map((t, i) => i)).slice(0, 5); S.phase = 1; S.miss = 0; S.tries = 0; S.firsts = 0; S.mode = 'play'; S.t0 = Date.now(); phase(); }
  function phase() { S.done = new Set(); S.sel = null; S.bad = null; S.lo = L.shuffle(S.set); S.ro = L.shuffle(S.set); S.wrongOn = new Set(); paint(); window.scrollTo(0, 0); }
  function pick(side, i) {
    if (S.done.has(i)) return;
    if (!S.sel || S.sel.side === side) { S.sel = { side, i }; S.bad = null; paint(); return; }
    const a = S.sel.side === 'l' ? S.sel.i : i, b = S.sel.side === 'l' ? i : S.sel.i;
    if (a === b) {
      S.done.add(a); S.sel = null; S.bad = null; L.fx(true);
      const first = !S.wrongOn.has(a); if (first) S.firsts++;
      L.mastery({ id: 'MT:' + S.phase + ':' + T[a][1].slice(0, 30), tags: ['pharmacology'], ok: first, choices: 5, label: (S.phase === 1 ? 'Mechanism → ' : 'Example of ') + T[a][1], src: 'match' });
      if (S.done.size === S.set.length) { if (S.phase === 1) { S.phase = 2; setTimeout(phase, 450); paint(); } else { finish(); } return; }
      paint(); return;
    }
    S.miss++; S.wrongOn.add(a); S.wrongOn.add(b); S.bad = { side, i }; S.sel = null; try { Prefs.sound('bad'); } catch (e) {} paint();
    setTimeout(() => { if (S.bad && S.bad.i === i) { S.bad = null; paint(); } }, 600);
  }
  function finish() {
    S.score = Math.round(100 * S.firsts / (S.set.length * 2)); S.mode = 'end';
    L.result('match', 'day-' + new Date().toISOString().slice(0, 10), S.score);
    L.award('match', 2 * S.firsts); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-mt-start]')) { start(); return; }
    if (t.closest('[data-mt-list]')) { S.mode = 'list'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-mt-menu]')) { S.mode = 'menu'; paint(); return; }
    const c = t.closest('[data-mt-side]'); if (c && S.mode === 'play') { pick(c.dataset.mtSide, +c.dataset.mtI); return; }
  }
  window.LabMods.match = { render, _S: () => S };
})();
