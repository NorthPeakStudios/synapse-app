/* CT / MRI reader: real openly licensed head scans (Wikimedia Commons: CC0 / public domain / CC BY / CC BY-SA, credited). Single images + swipeable slice series. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic, BASE = 'feat/lab/scan/';
  let S = null, D = null;
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__sc) { el.__sc = 1; el.addEventListener('click', onClick); el.addEventListener('input', onInput); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading scans…</div></div>';
    L.json('feat/lab/scan.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load the scans. Check your connection.</div></div>'; });
  }
  const credit = c => `<div class="img-cred sc-cred">${c.u ? `<a href="${esc(c.u)}" target="_blank" rel="noopener">${esc(c.t)}</a>` : esc(c.t)} · ${esc(c.a)} · ${c.lu ? `<a href="${esc(c.lu)}" target="_blank" rel="noopener">${esc(c.l)}</a>` : esc(c.l)} · via Wikimedia Commons</div>`;
  function paint() {
    if (!S || !S.el.isConnected) return;
    let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('scan'), nS = D.items.filter(i => i.series).length;
      h = L.top('CT / MRI reader', st ? `${st.n}/${D.items.length} tried` : '', 'lab') + `<p class="muted lb-p">Real head CTs and MRIs: bleeds, strokes, hydrocephalus, tumours and normal anatomy. ${D.items.length} questions, ${nS} of them on scrollable slice stacks.</p>
        <div class="lb-card lz-intro"><b>How to read a head scan</b><ul><li>Scan view: the patient's <i>right</i> is on your <i>left</i>.</li><li>CT: white = dense (bone, fresh blood), dark = water (CSF, old stroke), black = air.</li><li>Always compare left and right, then check the midline.</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-sc-start="mix" type="button">Round of 10</button><button class="btn" data-sc-start="all" type="button">All ${D.items.length}</button></div>
        <div class="lb-group"><button class="lb-row" data-sc-browse="norm" type="button"><span class="lb-ic">${ic('scan', 18)}</span><span class="lb-rt"><span class="t1">Normal head CT</span><span class="t2">Free scroll, ${D.series.norm.length} slices top to bottom</span></span><span class="lb-chev">${ic('chev', 16)}</span></button><button class="lb-row" data-sc-browse="t1" type="button"><span class="lb-ic">${ic('scan', 18)}</span><span class="lb-rt"><span class="t1">Normal T1 MRI</span><span class="t2">Free scroll, ${D.series.t1.length} slices</span></span><span class="lb-chev">${ic('chev', 16)}</span></button></div>`;
    } else if (S.mode === 'browse') {
      const it = { series: S.browse, cr: S.browse === 'norm' ? D.items.find(i => i.series === 'norm').cr : D.items.find(i => i.series === 't1').cr };
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sc-menu>${ic('back', 18)}<span>Scans</span></button><span class="lb-tr"></span></div><h2 class="lb-title">${S.browse === 'norm' ? 'Normal head CT' : 'Normal T1 MRI'}</h2>${viewer(it)}<p class="muted small lb-p">Swipe up/down on the image or drag the slider.</p>`;
    } else if (S.mode === 'end') {
      const pct = Math.round(100 * S.ok / S.q.length);
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.ok}/${S.q.length}</div><div class="sim-verd ${pct >= 70 ? 'ok' : 'bad'}">${pct >= 70 ? 'Sharp eyes' : 'Keep reading scans'}</div></div><div class="lb-btns"><button class="btn" data-sc-menu type="button">Done</button><button class="btn pri" data-sc-start="mix" type="button">Another round</button></div>`;
    } else {
      const it = S.q[S.i], done = S.ans != null;
      h = `${L.top('', `${S.i + 1} / ${S.q.length} · ${S.ok} right`, 'lab')}<div class="rx-bar lb-bar"><i style="width:${100 * S.i / S.q.length}%"></i></div>
        <div class="sc-mod"><span class="chip">${it.mod}</span>${it.series ? '<span class="chip">Swipe through the slices</span>' : ''}</div>
        <div class="lb-card lz-sx"><p>${esc(it.q)}</p></div>
        ${it.series ? viewer(it) : `<div class="sc-img"><img src="${BASE + it.img[0]}" alt="${it.mod} scan" draggable="false"></div>${credit(it.cr)}`}
        ${it.kind === 'find' ? (done ? '' : `<button class="btn pri lb-wide" data-sc-here type="button">This one</button>`) : `<div class="sim-opts">${S.order.map(k => `<button type="button" class="sim-o dx${done ? (k === it.a ? ' good' : k === S.ans ? ' badc' : '') : ''}" data-sc-opt="${k}" ${done ? 'disabled' : ''}><span class="sim-q">${esc(it.opts[k])}</span></button>`).join('')}</div>`}
        ${done ? `<div class="lb-card lz-fb2 lb-anchor"><div class="lz-ans ${S.right ? 'ok' : 'bad'}">${S.right ? ic('check', 17) + ' Right' : ic('x', 17) + (it.kind === 'find' ? ' Not quite: the answer is slices ' + it.range[0] + '–' + it.range[1] : ' Not quite')}</div><p class="lz-why">${esc(it.why)}</p></div><button class="btn pri lb-wide" data-sc-next type="button">${S.i + 1 < S.q.length ? 'Next →' : 'See results'}</button>` : ''}`;
    }
    S.el.innerHTML = `<div class="lb sc">${h}</div>`;
    const v = S.el.querySelector('.sc-view'); if (v) bindSwipe(v);
    if (S.mode === 'play' && S.ans != null) { const a = S.el.querySelector('.lb-anchor'); if (a) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function viewer(it) {
    const files = D.series[it.series], n = files.length; if (S.slice == null || S.slice >= n) S.slice = Math.min(n - 1, it.start || 0);
    // preload the stack once
    if (!S.pre || S.pre !== it.series) { S.pre = it.series; files.forEach(f => { const im = new Image(); im.src = BASE + f; }); }
    return `<div class="sc-view" data-n="${n}"><img src="${BASE + files[S.slice]}" alt="slice ${S.slice + 1}" draggable="false"><span class="sc-num">${S.slice + 1} / ${n}</span></div>
      <input type="range" class="sc-range" min="1" max="${n}" value="${S.slice + 1}" data-sc-range aria-label="Slice">${credit(it.cr)}`;
  }
  function setSlice(k) {
    const v = S.el.querySelector('.sc-view'); if (!v) return; const n = +v.dataset.n; k = Math.max(0, Math.min(n - 1, k)); if (k === S.slice) return; S.slice = k;
    const it = S.mode === 'browse' ? { series: S.browse } : S.q[S.i];
    v.querySelector('img').src = BASE + D.series[it.series][k]; v.querySelector('.sc-num').textContent = (k + 1) + ' / ' + n;
    const r = S.el.querySelector('[data-sc-range]'); if (r) r.value = k + 1;
  }
  function bindSwipe(v) {
    let y0 = null, s0 = 0;
    v.addEventListener('touchstart', e => { if (e.touches.length !== 1) return; y0 = e.touches[0].clientY; s0 = S.slice; }, { passive: true });
    v.addEventListener('touchmove', e => { if (y0 == null) return; e.preventDefault(); const dy = e.touches[0].clientY - y0; setSlice(s0 + Math.round(-dy / 14)); }, { passive: false });
    v.addEventListener('touchend', () => { y0 = null; });
    v.addEventListener('wheel', e => { e.preventDefault(); setSlice(S.slice + (e.deltaY > 0 ? 1 : -1)); }, { passive: false });
  }
  function start(kind) {
    const all = D.items.slice(); let q;
    if (kind === 'all') q = L.shuffle(all);
    else { const s = L.shuffle(all.filter(i => i.series)), m = L.shuffle(all.filter(i => !i.series)); q = L.shuffle(m.slice(0, 7).concat(s.slice(0, 3))); }
    S.q = q; S.i = 0; S.ok = 0; S.mode = 'play'; prep(); paint(); window.scrollTo(0, 0);
  }
  function prep() { const it = S.q[S.i]; S.ans = null; S.right = false; S.slice = it.series ? it.start || 0 : null; S.order = it.opts ? L.shuffle(it.opts.map((x, i) => i)) : []; S.t0 = Date.now(); }
  function answer(right, val) {
    const it = S.q[S.i]; S.ans = val; S.right = right; if (right) S.ok++;
    L.result('scan', it.id, right ? 100 : 0);
    L.mastery({ id: 'SC:' + it.id, tags: ['neurology'], ok: right, ms: Date.now() - S.t0, choices: it.kind === 'find' ? 0 : 4, label: 'Scan: ' + it.q.slice(0, 60), src: 'scan' });
    if (it.kind === 'find' && !right) S.slice = Math.round((it.range[0] + it.range[1]) / 2) - 1;
    L.fx(right); paint();
  }
  function onInput(e) { const r = e.target.closest('[data-sc-range]'); if (r) setSlice(+r.value - 1); }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const st = t.closest('[data-sc-start]'); if (st) { start(st.dataset.scStart); return; }
    const b = t.closest('[data-sc-browse]'); if (b) { S.mode = 'browse'; S.browse = b.dataset.scBrowse; S.slice = b.dataset.scBrowse === 'norm' ? 16 : 18; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-sc-menu]')) { S.mode = 'menu'; S.slice = null; paint(); return; }
    const o = t.closest('[data-sc-opt]'); if (o && S.ans == null) { const k = +o.dataset.scOpt; answer(k === S.q[S.i].a, k); return; }
    if (t.closest('[data-sc-here]')) { const it = S.q[S.i], n = S.slice + 1; answer(n >= it.range[0] && n <= it.range[1], n); return; }
    if (t.closest('[data-sc-next]')) { if (S.i + 1 < S.q.length) { S.i++; prep(); paint(); window.scrollTo(0, 0); } else { L.award('scan', 3 * S.ok); S.mode = 'end'; paint(); window.scrollTo(0, 0); } return; }
  }
  window.LabMods.scan = { render, _S: () => S };
})();
