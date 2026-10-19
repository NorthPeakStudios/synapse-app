/* Differential builder: read a vignette, rank your top 5 diagnoses, get scored against an expert ranking with reasoning. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let S = null, D = null;
  const W = [5, 4, 3, 2, 1], MAX = 15;
  const up = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15 6-6 6 6"/></svg>';
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__dx) { el.__dx = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/ddx.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function score(rank, c) {
    let pts = 0; const ex = c.expert.map(e => e[0]);
    rank.forEach((d, i) => { const j = ex.indexOf(d); if (j >= 0) pts += Math.max(0, W[j] * (1 - 0.25 * Math.abs(i - j))); });
    return Math.round(100 * pts / MAX);
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('ddx');
      h = L.top('Differential builder', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Doctors never jump to one answer. Read the case, then rank the 5 diagnoses you'd think about, most likely first. You're scored against an expert's list, with the reasoning for each.</p>
        <button class="btn pri lb-wide" data-dx-rand type="button">Random case</button>
        <div class="lb-group">${D.map(c => { const b = L.bestOf('ddx', c.id); return `<button class="lb-row" data-dx-go="${c.id}" type="button"><span class="lb-rt"><span class="t1">${esc(c.title)}</span><span class="t2">${esc(c.stem)}</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>
        <p class="lb-foot">Teaching cases. Not medical advice.</p>`;
    } else if (S.mode === 'play') {
      const c = S.c;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-dx-menu>${ic('back', 18)}<span>Cases</span></button><span class="lb-tr">${S.rank.length}/5 ranked</span></div>
        <h2 class="lb-title">${esc(c.title)}</h2><div class="lb-card"><p>${esc(c.stem)}</p></div>
        <p class="mt-h">Your ranking (tap a diagnosis below to add it; tap one here to remove)</p>
        <div class="dx-rank">${[0, 1, 2, 3, 4].map(i => { const d = S.rank[i]; return d ? `<div class="dx-slot f"><span class="dx-num">${i + 1}</span><span class="dx-t" data-dx-rm="${i}">${esc(d)}</span>${i ? `<button class="dx-mv" type="button" data-dx-up="${i}" aria-label="Move up">${up}</button>` : ''}</div>` : `<div class="dx-slot"><span class="dx-num">${i + 1}</span><span class="dx-t">${i === 0 ? 'Most likely' : i === 4 ? 'Least likely of your 5' : ''}</span></div>`; }).join('')}</div>
        <div class="dx-pool">${S.pool.map(d => `<button type="button" class="dx-chip${S.rank.includes(d) ? ' used' : ''}" data-dx-add="${esc(d)}">${esc(d)}</button>`).join('')}</div>
        <div class="lb-btns sticky"><button class="btn pri" data-dx-check type="button" ${S.rank.length < 5 ? 'disabled' : ''}>${S.rank.length < 5 ? `Pick ${5 - S.rank.length} more` : 'Score my differential'}</button></div>`;
    } else {
      const c = S.c, ex = c.expert.map(e => e[0]);
      h = `<div class="lb-top"><button class="lb-back" type="button" data-dx-menu>${ic('back', 18)}<span>Cases</span></button><span class="lb-tr"></span></div>
        <div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.score >= 85 ? 'Attending-level' : S.score >= 70 ? 'Solid differential' : S.score >= 45 ? 'On the right track' : 'Rethink it'}</div><div class="muted small">${S.rank[0] === ex[0] ? 'You nailed #1' : 'Expert #1: ' + esc(ex[0])}</div></div>
        <div class="lb-card"><h3>Expert ranking</h3>${c.expert.map((e, j) => { const i = S.rank.indexOf(e[0]); const tag = i < 0 ? '<span class="dx-you n">not in yours</span>' : i === j ? '<span class="dx-you g">you: #' + (i + 1) + '</span>' : '<span class="dx-you m">you: #' + (i + 1) + '</span>'; return `<div class="dx-ex"><span class="dx-num">${j + 1}</span><div><b>${esc(e[0])}</b>${tag}<p>${esc(e[1])}</p></div></div>`; }).join('')}</div>
        ${c.others.length ? `<div class="lb-card"><h3>Lower on the list</h3>${c.others.map(o => { const i = S.rank.indexOf(o[0]); return `<div class="dx-ex"><span class="dx-num">–</span><div><b>${esc(o[0])}</b>${i >= 0 ? '<span class="dx-you n">you: #' + (i + 1) + '</span>' : ''}<p>${esc(o[1])}</p></div></div>`; }).join('')}</div>` : ''}
        <div class="lb-btns"><button class="btn" data-dx-menu type="button">All cases</button><button class="btn pri" data-dx-rand type="button">Next case</button></div>`;
    }
    S.el.innerHTML = `<div class="lb dx">${h}</div>`;
  }
  function go(id) { const c = D.find(x => x.id === id); if (!c) return; S.c = c; S.rank = []; S.pool = L.shuffle(c.expert.map(e => e[0]).concat(c.others.map(o => o[0]))); S.mode = 'play'; paint(); window.scrollTo(0, 0); }
  function check() {
    const c = S.c; S.score = score(S.rank, c); S.mode = 'end'; L.fx(S.score >= 70);
    L.result('ddx', c.id, S.score);
    L.mastery({ id: 'DX:' + c.id, tags: ['medicine', 'diagnosis'], ok: S.score >= 70, choices: 5, label: 'Differential: ' + c.title, src: 'ddx' });
    L.award('ddx', 3 + Math.round(S.score / 10)); paint(); window.scrollTo(0, 0);
  }
  function keep(f) { const y = window.scrollY; f(); paint(); window.scrollTo(0, y); }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-dx-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-dx-rand]')) { const pool = D.filter(c => !S.c || c.id !== S.c.id); go(pool[Math.floor(Math.random() * pool.length)].id); return; }
    const g = t.closest('[data-dx-go]'); if (g) { go(g.dataset.dxGo); return; }
    if (S.mode !== 'play') return;
    const a = t.closest('[data-dx-add]'); if (a) { const d = a.dataset.dxAdd; keep(() => { const i = S.rank.indexOf(d); if (i >= 0) S.rank.splice(i, 1); else if (S.rank.length < 5) S.rank.push(d); }); return; }
    const u = t.closest('[data-dx-up]'); if (u) { const i = +u.dataset.dxUp; keep(() => { [S.rank[i - 1], S.rank[i]] = [S.rank[i], S.rank[i - 1]]; }); return; }
    const r = t.closest('[data-dx-rm]'); if (r) { keep(() => S.rank.splice(+r.dataset.dxRm, 1)); return; }
    if (t.closest('[data-dx-check]') && S.rank.length === 5) { check(); return; }
  }
  window.LabMods.ddx = { render, _S: () => S, score };
})();
