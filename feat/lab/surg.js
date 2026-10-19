/* Surgery steps: put the steps of a real procedure in order (craniotomy, VP shunt, lumbar puncture, appendectomy, DBS…), then read why each step comes where it does. Non-graphic. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const ar = d => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__sg) { el.__sg = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/surg.json').then(d => { D = d.procs; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('surg');
      h = L.top('Surgery steps', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Every operation follows a script. Put the steps in the right order, then learn why. ${D.length} procedures.</p>
        <div class="lb-btns"><button class="btn pri" data-sg-go="-1" type="button">Random procedure</button></div>
        <div class="lb-group">${D.map((p, i) => { const bo = L.bestOf('surg', p.id), b = bo ? bo.b : null; return `<button class="lb-row" data-sg-go="${i}" type="button"><span class="lb-rt"><span class="t1">${esc(p.t)}</span><span class="t2">${esc(p.area)} · ${p.s.length} steps</span></span>${b != null ? `<span class="lb-best">${b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else {
      const p = D[S.pi], done = S.mode === 'end', n = p.s.length;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sg-menu>${ic('back', 18)}<span>Procedures</span></button><span class="lb-tr">${done ? S.score + '%' : p.area}</span></div><h2 class="lb-title">${esc(p.t)}</h2>`;
      if (done) h += `<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.inplace === n ? 'Perfect: ready to scrub in' : S.inplace + '/' + n + ' steps in the right spot'}</div></div><p class="mt-h">The real order</p>`;
      else h += `<p class="mt-h">Use the arrows to put the steps in order, <b>first</b> at the top.</p>`;
      const list = done ? p.s.map((x, i) => i) : S.items;
      h += `<div class="tl-list">${list.map((ix, i) => { const st = p.s[ix]; const cls = done ? (S.items[i] === ix ? ' ok' : ' no') : ''; return `<div class="tl-it${cls}">${done ? `<span class="tl-yr">${ix + 1}</span>` : ''}<span class="tl-t">${esc(st[0])}${done && st[1] ? `<small>${esc(st[1])}</small>` : ''}</span>${done ? '' : `<span class="tl-mv"><button type="button" data-sg-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">${ar('m6 15 6-6 6 6')}</button><button type="button" data-sg-dn="${i}" ${i < n - 1 ? '' : 'disabled'} aria-label="Move down">${ar('m6 9 6 6 6-6')}</button></span>`}</div>`; }).join('')}</div>`;
      if (!done) h += `<div class="lb-btns sticky"><button class="btn pri" data-sg-check type="button">Check order</button></div>`;
      else h += `<p class="muted small" style="text-align:center">Green = you had that step in exactly the right spot.</p><div class="lb-btns"><button class="btn" data-sg-go="${S.pi}" type="button">Try again</button><button class="btn pri" data-sg-go="-1" type="button">Next procedure</button></div>`;
    }
    S.el.innerHTML = `<div class="lb tl">${h}</div>`;
  }
  function start(i) {
    if (i < 0) { const o = D.map((x, k) => k).filter(k => k !== S.pi); i = o[Math.floor(Math.random() * o.length)]; }
    S.pi = i; const n = D[i].s.length; let items = L.shuffle(D[i].s.map((x, k) => k));
    if (items.every((x, k) => x === k)) items = items.reverse();
    S.items = items; S.mode = 'play'; paint(); window.scrollTo(0, 0);
  }
  function check() {
    const it = S.items, n = it.length; let pairs = 0, ok = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { pairs++; if (it[i] < it[j]) ok++; }
    S.inplace = it.filter((x, i) => x === i).length; S.score = Math.round(100 * ok / pairs); S.mode = 'end'; L.fx(S.score >= 70);
    const p = D[S.pi]; L.result('surg', p.id, S.score);
    L.mastery({ id: 'SG:' + p.id, tags: ['surgery', p.area], ok: S.score >= 80, choices: 4, label: p.t, src: 'surg' });
    L.award('surg', 2 + Math.round(S.score / 20)); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-sg-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    const g = t.closest('[data-sg-go]'); if (g) { start(+g.dataset.sgGo); return; }
    if (S.mode !== 'play') return;
    const u = t.closest('[data-sg-up]'), d = t.closest('[data-sg-dn]');
    if (u || d) { const i = +(u ? u.dataset.sgUp : d.dataset.sgDn), j = u ? i - 1 : i + 1; [S.items[i], S.items[j]] = [S.items[j], S.items[i]]; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    if (t.closest('[data-sg-check]')) { check(); return; }
  }
  window.LabMods.surg = { render, _S: () => S };
})();
