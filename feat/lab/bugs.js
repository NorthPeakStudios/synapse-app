/* Bug ID: name the microbe from lab clues. Clue 1 (stain/shape) is free; a wrong pick opens the next clue (lab test → disease → classic pearl). 4 choices, picked from look-alike groups so stain alone isn't enough. No STI organisms; no doses. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const LBL = ['Stain & shape', 'Lab test', 'Disease', 'Classic clue'];
  const GN = { gp: 'Gram +', gn: 'Gram −', af: 'Acid-fast', fungus: 'Fungi', para: 'Parasites', virus: 'Viruses' };
  function render(el) {
    S = { el, mode: 'menu', streak: 0, round: null, set: localStorage.getItem('bugs.set') || 'all' };
    if (!el.__bg) { el.__bg = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/bugs.json').then(d => { D = d.bugs; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const pool = () => S.set === 'all' ? D : D.filter(b => b.g === S.set);
  function pickChoices(b) {
    const same = L.shuffle(D.filter(x => x.id !== b.id && x.g === b.g)), other = L.shuffle(D.filter(x => x.id !== b.id && x.g !== b.g));
    return L.shuffle([b, ...same.concat(other).slice(0, 3)]);
  }
  function next() {
    const p = pool(); const un = p.filter(b => !L.bestOf('bugs', b.id)); const from = (un.length ? un : p).filter(b => !S.round || b.id !== S.round.b.id);
    const b = from[Math.floor(Math.random() * from.length)] || p[0];
    S.round = { b, open: 1, picks: [], ch: pickChoices(b), done: false, win: false }; S.mode = 'play'; paint(); window.scrollTo(0, 0);
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h;
    if (S.mode === 'menu') {
      const st = L.stat('bugs'), seen = D.filter(b => L.bestOf('bugs', b.id)).length;
      h = L.top('Bug ID', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Name the microbe like a micro lab would. You start with the stain and shape; every wrong pick opens the next clue (lab test, disease, classic clue). ${D.length} bugs, ${seen} identified so far.</p>
        <div class="at-tabs" style="flex-wrap:wrap">${[['all', 'All']].concat(Object.entries(GN)).map(([k, l]) => `<button type="button" data-bg-set="${k}" class="${S.set === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="lb-btns"><button class="btn pri" data-bg-go type="button">Start</button></div>
        <div class="lb-group">${pool().map(b => { const r = L.bestOf('bugs', b.id); return `<div class="lb-row"><span class="lb-rt"><span class="t1">${r ? esc(b.n) : '???'}</span><span class="t2">${esc(GN[b.g])}${r ? '' : ' · not yet identified'}</span></span>${r ? `<span class="lb-best">${r.b}%</span>` : ''}</div>`; }).join('')}</div>
        <p class="lb-foot">Teaching facts only. No doses. Not medical advice.</p>`;
    } else {
      const R = S.round, b = R.b, open = R.done ? 4 : R.open;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-bg-menu>${ic('back', 18)}<span>Bug ID</span></button><span class="lb-tr">${S.streak ? '🔥 ' + S.streak + ' in a row' : esc(GN[b.g] && S.set !== 'all' ? GN[b.g] : '')}</span></div>`;
      h += `<div class="dl6-clues">${LBL.map((l, i) => i < open ? `<div class="dl6-c"><i>${i + 1}</i><span><b>${l}:</b> ${esc(b.c[i])}</span></div>` : `<div class="dl6-c lock"><i>${i + 1}</i><span>${l}: locked</span></div>`).join('')}</div>`;
      h += `<div class="bg-ch" style="display:grid;gap:8px;margin:12px 0">${R.ch.map(x => { const picked = R.picks.includes(x.id), right = x.id === b.id; const cls = R.done ? (right ? 'pri' : picked ? 'bad' : '') : picked ? 'bad' : ''; return `<button type="button" class="btn ${cls}" data-bg-pick="${x.id}" ${R.done || picked ? 'disabled' : ''} style="text-align:left;justify-content:flex-start;${picked && !right ? 'opacity:.55;text-decoration:line-through' : ''}">${esc(x.n)}</button>`; }).join('')}</div>`;
      if (R.done) {
        h += `<div class="lb-card sim-res"><div class="lz-big">${R.win ? R.score + '%' : '✗'}</div><div class="sim-verd ${R.win ? 'ok' : 'bad'}">${R.win ? (R.picks.length === 1 ? 'First try!' : `Got it on pick ${R.picks.length}`) : 'Out of picks'}</div><p style="margin:8px 0 0;font-weight:700;font-size:18px">${esc(b.n)}</p></div>
          <div class="lb-card"><p class="lb-why"><b>Treatment (drug class):</b> ${esc(b.tx)}</p></div>
          <div class="lb-btns"><button class="btn" data-bg-menu type="button">Done</button><button class="btn pri" data-bg-go type="button">Next bug</button></div>`;
      } else h += `<p class="muted small">${3 - R.picks.length} wrong pick${3 - R.picks.length === 1 ? '' : 's'} left · each miss opens a clue</p>`;
    }
    S.el.innerHTML = `<div class="lb bg">${h}</div>`;
  }
  function pick(id) {
    const R = S.round; if (!R || R.done || R.picks.includes(id)) return; R.picks.push(id);
    if (id === R.b.id) { R.done = true; R.win = true; R.score = [100, 70, 40, 15][R.picks.length - 1] || 10; S.streak++; }
    else if (R.picks.length >= 3) { R.done = true; R.win = false; R.score = 0; S.streak = 0; }
    else { R.open = Math.min(4, R.open + 1); L.fx(false); }
    if (R.done) { L.fx(R.win); L.result('bugs', R.b.id, R.score); L.mastery({ id: 'BUG:' + R.b.id, tags: ['microbiology', GN[R.b.g]], ok: R.win, choices: 4, label: R.b.n, src: 'bugs' }); L.award('bugs', R.win ? 2 + (3 - R.picks.length) : 1); }
    paint();
  }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    const s = t.closest('[data-bg-set]'); if (s) { S.set = s.dataset.bgSet; localStorage.setItem('bugs.set', S.set); paint(); return; }
    if (t.closest('[data-bg-go]')) { next(); return; }
    if (t.closest('[data-bg-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    const p = t.closest('[data-bg-pick]'); if (p) { pick(p.dataset.bgPick); return; }
  }
  window.LabMods.bugs = { render, _S: () => S, _D: () => D, pick };
})();
