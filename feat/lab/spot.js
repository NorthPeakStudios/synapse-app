/* Spot the difference: a normal brain scan next to a sick one. Tap the part that's different, then learn what it is. Images are Wikimedia Commons, credited on each case. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  function render(el) {
    S = { el, mode: 'menu', r: null };
    if (!el.__st) { el.__st = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/spot.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const cr = c => `<a href="${esc(c.u)}" target="_blank" rel="noopener">${esc(c.t)}</a> · ${esc(c.a)} · ${esc(c.l)}`;
  function start(id) {
    const cs = D.cases; let c = cs.find(x => x.id === id);
    if (!c) { const un = cs.filter(x => !L.bestOf('spot', x.id) && x !== (S.r && S.r.c)); const from = un.length ? un : cs.filter(x => x !== (S.r && S.r.c)); c = from[Math.floor(Math.random() * from.length)]; }
    S.r = { c, taps: [], found: false, done: false }; S.mode = 'play'; paint(); window.scrollTo(0, 0);
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h;
    if (S.mode === 'menu') {
      h = L.top('Spot the difference', '', 'lab') + `<p class="muted lb-p">A normal brain scan next to a sick one. Find what's wrong and tap it. Three tries, then learn what it was.</p><div class="lb-btns"><button class="btn pri" data-st-go type="button">Start</button></div>
        <div class="lb-group">${D.cases.map(c => { const b = L.bestOf('spot', c.id); return `<button class="lb-row" type="button" data-st-c="${c.id}"><span class="lb-rt"><span class="t1">${b ? esc(c.dx) : 'Scan ' + (D.cases.indexOf(c) + 1)}</span><span class="t2">${esc(c.mod)} · ${esc(c.q.slice(0, 60))}</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else {
      const R = S.r, c = R.c;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-st-menu>${ic('back', 18)}<span>Spot it</span></button><span class="lb-tr">${R.done ? '' : (3 - R.taps.filter(t => !t.ok).length) + ' tries left'}</span></div>`;
      h += `<p style="margin:4px 0 10px"><b>${esc(c.q)}</b></p>`;
      h += `<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;align-items:start"><figure style="margin:0"><img src="${esc(D.cases && c.ref)}" alt="Normal brain CT" style="width:100%;border-radius:10px;display:block;background:#000"><figcaption class="muted small" style="text-align:center">Normal CT</figcaption></figure>
        <figure style="margin:0"><div data-st-stage style="position:relative;border-radius:10px;overflow:hidden;background:#000;touch-action:manipulation"><img src="${esc(c.img)}" alt="Patient scan" style="width:100%;display:block;pointer-events:none">${R.taps.map(t => `<span style="position:absolute;left:${t.x * 100}%;top:${t.y * 100}%;transform:translate(-50%,-50%);font:800 20px/1 system-ui;color:${t.ok ? '#30a46c' : '#e5484d'};text-shadow:0 0 3px #000">${t.ok ? '✓' : '✕'}</span>`).join('')}${R.done ? c.t.map(([x, y, r]) => `<span style="position:absolute;left:${(x - r) * 100}%;top:${(y - r) * 100}%;width:${r * 200}%;height:${r * 200}%;border:3px solid #30a46c;border-radius:50%;box-sizing:border-box"></span>`).join('') : ''}</div><figcaption class="muted small" style="text-align:center">Patient ${esc(c.mod)}: tap what's different</figcaption></figure></div>`;
      if (R.done) h += `<div class="lb-card sim-res"><div class="lz-big">${R.score ? R.score + '%' : '✗'}</div><div class="sim-verd ${R.found ? 'ok' : 'bad'}">${R.found ? (R.taps.length === 1 ? 'Spotted it first try' : 'Spotted it') : 'Here it is (green circle)'}</div><p style="margin:8px 0 0;font-weight:700;font-size:18px">${esc(c.dx)}</p></div><div class="lb-card"><p class="lb-why">${esc(c.why)}</p></div>
        <div class="lb-btns"><button class="btn" data-st-menu type="button">Done</button><button class="btn pri" data-st-go type="button">Next scan</button></div>`;
      h += `<p class="at-cr" style="margin-top:10px">Patient image: ${cr(c.cr)}<br>Normal image: ${cr(D.refcr)}</p>`;
    }
    S.el.innerHTML = `<div class="lb st">${h}</div>`;
  }
  function tap(e, st) {
    const R = S.r; if (!R || R.done) return; const b = st.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    const ok = R.c.t.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + 0.03); R.taps.push({ x, y, ok });
    if (ok) { R.found = true; R.done = true; R.score = [100, 70, 40][R.taps.length - 1] || 30; }
    else if (R.taps.length >= 3) { R.done = true; R.score = 0; }
    else L.fx(false);
    if (R.done) { L.fx(R.found); L.result('spot', R.c.id, R.score); L.mastery({ id: 'SPOT:' + R.c.id, tags: ['imaging', 'neuro'], ok: R.found, choices: 4, label: R.c.dx, src: 'spot' }); L.award('spot', R.found ? 3 : 1); }
    paint();
  }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    const st = t.closest('[data-st-stage]'); if (st) { tap(e, st); return; }
    if (t.closest('[data-st-go]')) { start(null); return; }
    const c = t.closest('[data-st-c]'); if (c) { start(c.dataset.stC); return; }
    if (t.closest('[data-st-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
  }
  window.LabMods.spot = { render, _S: () => S, _D: () => D };
})();
