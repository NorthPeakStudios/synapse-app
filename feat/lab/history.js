/* Medicine timeline: put 5 discoveries/events in chronological order, then see the real dates and a fact for each. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let S = null, D = null;
  const N = 5;
  const ar = d => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__tl) { el.__tl = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/history.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('history');
      h = L.top('Medicine timeline', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">From Hippocrates to mRNA vaccines. Each round gives you ${N} moments in medicine: put them in order, oldest at the top. ${D.length} events in the pool.</p>
        <div class="lb-btns"><button class="btn pri" data-tl-start type="button">Start a round</button><button class="btn" data-tl-all type="button">Full timeline</button></div>`;
    } else if (S.mode === 'all') {
      h = `<div class="lb-top"><button class="lb-back" type="button" data-tl-menu>${ic('back', 18)}<span>Timeline</span></button><span class="lb-tr"></span></div><h2 class="lb-title">Full timeline</h2><div class="tl-list">${D.slice().sort((a, b) => a[0] - b[0]).map(e => `<div class="tl-it"><span class="tl-yr">${esc(e[1])}</span><span class="tl-t">${esc(e[2])}<small>${esc(e[3])}</small></span></div>`).join('')}</div>`;
    } else {
      const done = S.mode === 'end';
      h = `<div class="lb-top"><button class="lb-back" type="button" data-tl-menu>${ic('back', 18)}<span>Timeline</span></button><span class="lb-tr">${done ? S.score + '%' : 'Oldest on top'}</span></div>`;
      if (done) h += `<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.exact ? 'Perfect order' : S.inplace + '/' + N + ' in the right spot'}</div></div><p class="mt-h">Correct order</p>`;
      else h += `<p class="mt-h">Use the arrows to sort these from <b>oldest</b> (top) to <b>newest</b> (bottom).</p><div class="tl-axis"><span>▲ older</span></div>`;
      const list = done ? S.items.slice().sort((a, b) => D[a][0] - D[b][0]) : S.items;
      h += `<div class="tl-list">${list.map((ix, i) => { const e = D[ix]; const cls = done ? (S.items[i] === ix ? ' ok' : ' no') : ''; return `<div class="tl-it${cls}">${done ? `<span class="tl-yr">${esc(e[1])}</span>` : ''}<span class="tl-t">${esc(e[2])}${done ? `<small>${esc(e[3])}</small>` : ''}</span>${done ? '' : `<span class="tl-mv"><button type="button" data-tl-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">${ar('m6 15 6-6 6 6')}</button><button type="button" data-tl-dn="${i}" ${i < N - 1 ? '' : 'disabled'} aria-label="Move down">${ar('m6 9 6 6 6-6')}</button></span>`}</div>`; }).join('')}</div>`;
      if (!done) h += `<div class="tl-axis"><span>▼ newer</span></div><div class="lb-btns sticky"><button class="btn pri" data-tl-check type="button">Check order</button></div>`;
      else h += `<p class="muted small" style="text-align:center">Green = you had it in that exact spot.</p><div class="lb-btns"><button class="btn" data-tl-menu type="button">Done</button><button class="btn pri" data-tl-start type="button">Another round</button></div>`;
    }
    S.el.innerHTML = `<div class="lb tl">${h}</div>`;
  }
  function start() {
    // pick N events spread out enough to be fair but still close sometimes
    const idx = L.shuffle(D.map((e, i) => i)).slice(0, N);
    let items = L.shuffle(idx); const sorted = idx.slice().sort((a, b) => D[a][0] - D[b][0]);
    if (items.every((x, i) => x === sorted[i])) items = items.reverse();
    S.items = items; S.mode = 'play'; paint(); window.scrollTo(0, 0);
  }
  function check() {
    const it = S.items; let pairs = 0, ok = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { pairs++; if (D[it[i]][0] < D[it[j]][0]) ok++; }
    const sorted = it.slice().sort((a, b) => D[a][0] - D[b][0]);
    S.inplace = it.filter((x, i) => x === sorted[i]).length; S.exact = S.inplace === N;
    S.score = Math.round(100 * ok / pairs); S.mode = 'end'; L.fx(S.score >= 70);
    L.result('history', 'day-' + new Date().toISOString().slice(0, 10), S.score);
    it.forEach((x, i) => L.mastery({ id: 'TL:' + D[x][1] + ':' + D[x][2].slice(0, 24), tags: ['history of medicine'], ok: x === sorted[i], choices: N, label: D[x][1] + ': ' + D[x][2], src: 'history' }));
    L.award('history', 2 + Math.round(S.score / 20)); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-tl-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-tl-all]')) { S.mode = 'all'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-tl-start]')) { start(); return; }
    if (S.mode !== 'play') return;
    const u = t.closest('[data-tl-up]'), d = t.closest('[data-tl-dn]');
    if (u || d) { const i = +(u ? u.dataset.tlUp : d.dataset.tlDn), j = u ? i - 1 : i + 1; [S.items[i], S.items[j]] = [S.items[j], S.items[i]]; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    if (t.closest('[data-tl-check]')) { check(); return; }
  }
  window.LabMods.history = { render, _S: () => S };
})();
