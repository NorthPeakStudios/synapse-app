/* Patient sim: a case runs chief complaint → history → exam → tests → differential → diagnosis → debrief. Scores feed Mastery + Lab scores. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  const STEPS = [['hx', 'History'], ['ex', 'Exam'], ['tx', 'Tests'], ['ddx', 'DDx'], ['dx', 'Diagnosis']];
  let S = null, DATA = null;
  function render(el) {
    S = { el, mode: 'list', filt: localStorage.getItem('sim.filt') || 'all' };
    if (!el.__sim) { el.__sim = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading cases…</div></div>';
    L.json('feat/lab/cases.json').then(d => { DATA = d.cases; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load the cases. Check your connection.</div></div>'; });
  }
  const live = () => S && S.el.isConnected;
  function paint() { if (!live()) return; S.el.innerHTML = '<div class="lb">' + (S.mode === 'list' ? pList() : S.mode === 'end' ? pEnd() : pCase()) + '</div>'; if (S.mode !== 'list') { const a = S.el.querySelector('.lb-anchor'); if (a && S.scroll) { a.scrollIntoView({ block: 'nearest' }); S.scroll = 0; } } }
  function pList() {
    const list = DATA.filter(c => S.filt === 'all' || c.area === S.filt);
    const st = L.stat('sim');
    return L.top('Patient sim', st ? `${st.n}/${DATA.length} done` : '', 'lab') + `<p class="muted lb-p">Take a history, examine, order tests, then commit to a diagnosis. Unneeded tests cost points.</p>
      <div class="pseg lb-seg">${[['all', 'All'], ['neuro', 'Neuro'], ['gen', 'General']].map(([k, l]) => `<button type="button" class="${S.filt === k ? 'on' : ''}" data-sim-f="${k}">${l}</button>`).join('')}</div>
      <button class="btn pri lb-wide" data-sim-rand type="button">Random case</button>
      <div class="lb-group">${list.map(c => { const b = L.bestOf('sim', c.id); return `<button class="lb-row" data-sim-go="${c.id}" type="button"><span class="lb-ic ${c.area === 'neuro' ? 'neu' : ''}">${ic(c.area === 'neuro' ? 'brain' : 'steth', 18)}</span><span class="lb-rt"><span class="t1">${esc(c.pt)}</span><span class="t2">“${esc(c.cc)}”</span></span>${b ? `<span class="lb-best">${b.b}</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
  }
  function start(id) {
    const c = DATA.find(x => x.id === id); if (!c) return;
    S.mode = 'case'; S.c = c; S.step = 0; S.asked = { hx: new Set(), ex: new Set(), tx: new Set() }; S.ddx = new Set(); S.dx = null; S.t0 = Date.now(); S.dxOrder = L.shuffle(c.dx.map((d, i) => i)); S.ddxOrder = L.shuffle(c.ddx.map((d, i) => i));
    paint(); S.el.scrollIntoView && window.scrollTo(0, 0);
  }
  function pCase() {
    const c = S.c, k = STEPS[S.step][0];
    const steps = `<div class="sim-steps">${STEPS.map(([key, l], i) => `<button type="button" class="sim-st${i === S.step ? ' on' : ''}${i < S.step ? ' done' : ''}" data-sim-step="${i}" ${i > S.step ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
    const pt = `<div class="lb-card sim-pt"><div class="sim-who">${esc(c.pt)}</div><div class="sim-cc">“${esc(c.cc)}”</div><div class="sim-vit">${esc(c.vit)}</div></div>`;
    let body = '';
    if (k === 'hx' || k === 'ex' || k === 'tx') {
      const arr = c[k], set = S.asked[k];
      const tip = { hx: 'Ask what matters. Questions are free, but think about why you ask.', ex: 'Pick the exam findings you want to check.', tx: 'Order only what helps. Each unnecessary test costs 4 points.' }[k];
      body = `<p class="muted lb-p small">${tip}</p><div class="sim-opts">${arr.map((x, i) => { const on = set.has(i); return `<button type="button" class="sim-o${on ? ' on' : ''}${on && k === 'tx' && x[2] === 0 ? ' waste' : ''}" data-sim-ask="${i}" ${on ? 'disabled' : ''}><span class="sim-q">${esc(x[0])}</span>${on ? `<span class="sim-a">${esc(x[1])}</span>` : ''}</button>`; }).join('')}</div>`;
      const nxt = { hx: 'Examine the patient', ex: 'Order tests', tx: 'Build a differential' }[k];
      body += `<button class="btn pri lb-wide lb-anchor" data-sim-next type="button">${nxt} →</button>`;
      if (k === 'tx') body = `<div class="sim-meta">${set.size} ordered · ${[...set].filter(i => arr[i][2] === 0).length} not needed so far</div>` + body;
    } else if (k === 'ddx') {
      body = `<p class="muted lb-p small">Pick the 3 most important things this could be (including what you think it is).</p><div class="sim-chips">${S.ddxOrder.map(i => { const d = c.ddx[i]; return `<button type="button" class="chip-t${S.ddx.has(i) ? ' on' : ''}" data-sim-ddx="${i}">${esc(d[0])}</button>`; }).join('')}</div>
        <button class="btn pri lb-wide lb-anchor" data-sim-next type="button" ${S.ddx.size === 3 ? '' : 'disabled'}>${S.ddx.size === 3 ? 'Make the diagnosis →' : 'Pick ' + (3 - S.ddx.size) + ' more'}</button>`;
    } else {
      body = `<p class="muted lb-p small">Final answer. What's the diagnosis?</p><div class="sim-opts">${S.dxOrder.map(i => `<button type="button" class="sim-o dx${S.dx === i ? ' on' : ''}" data-sim-dx="${i}"><span class="sim-q">${esc(c.dx[i])}</span></button>`).join('')}</div>
        <button class="btn pri lb-wide lb-anchor" data-sim-submit type="button" ${S.dx == null ? 'disabled' : ''}>Lock it in</button>`;
    }
    const found = summaryFound();
    const notes = found.length ? `<details class="sim-notes"><summary>Your notes (${found.length})</summary><ul>${found.map(f => `<li><b>${esc(f[0])}</b> ${esc(f[1])}</li>`).join('')}</ul></details>` : '';
    return `<div class="lb-top"><button class="lb-back" type="button" data-sim-list>${ic('back', 18)}<span>Cases</span></button><span class="lb-tr">${S.c.area === 'neuro' ? 'Neuro' : 'General'}</span></div>${steps}${pt}${S.step > 0 ? notes : ''}${body}`;
  }
  function summaryFound() { const c = S.c, out = []; for (const k of ['hx', 'ex', 'tx']) for (const i of S.asked[k]) out.push([c[k][i][0] + ':', c[k][i][1]]); return out; }
  function score() {
    const c = S.c, okDx = S.dx === c.ans;
    let keyN = 0, keyGot = 0; const missed = [];
    for (const k of ['hx', 'ex', 'tx']) c[k].forEach((x, i) => { const key = k === 'tx' ? x[2] === 2 : x[2] === 1; if (key) { keyN++; if (S.asked[k].has(i)) keyGot++; else missed.push([k, x[0], x[1]]); } });
    const musts = c.ddx.map((d, i) => d[1] ? i : -1).filter(i => i >= 0), ddxGot = [...S.ddx].filter(i => c.ddx[i][1]).length;
    const ddxHasDx = [...S.ddx].some(i => c.ddx[i][0].toLowerCase().split(/[ (]/)[0] === c.dx[c.ans].toLowerCase().split(/[ (]/)[0]) || [...S.ddx].some(i => c.dx[c.ans].toLowerCase().includes(c.ddx[i][0].toLowerCase().slice(0, 10)));
    const waste = [...S.asked.tx].filter(i => c.tx[i][2] === 0).map(i => c.tx[i][0]);
    const pDx = okDx ? 40 : 0, pKey = Math.round(30 * keyGot / Math.max(1, keyN)), pDdx = Math.round(15 * Math.min(1, ddxGot / Math.min(3, musts.length))), pEff = Math.max(0, 15 - 4 * waste.length);
    return { okDx, total: pDx + pKey + pDdx + pEff, pDx, pKey, pDdx, pEff, keyN, keyGot, missed, waste, ddxGot, ddxHasDx };
  }
  function submit() {
    const c = S.c, r = score(); S.r = r; S.mode = 'end';
    const x = L.result('sim', c.id, r.total, { dx: r.okDx ? 1 : 0 });
    L.mastery({ id: 'SIM:' + c.id, tags: [c.area === 'neuro' ? 'neurology' : 'medicine'], score: r.total / 100, ms: Date.now() - S.t0 > 600000 ? 0 : undefined, choices: c.dx.length, label: 'Patient sim: ' + c.dx[c.ans], src: 'sim' });
    L.award('sim', Math.round(5 + r.total / 5));
    L.fx(r.okDx); S.best = x.b;
    paint(); window.scrollTo(0, 0);
  }
  function pEnd() {
    const c = S.c, r = S.r, nm = { hx: 'History', ex: 'Exam', tx: 'Test' };
    const ring = (p) => { const R = 34, C = 2 * Math.PI * R; return `<svg class="sim-ring" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--fill2)" stroke-width="8"/><circle cx="42" cy="42" r="${R}" fill="none" stroke="${p >= 70 ? 'var(--good)' : p >= 45 ? 'var(--hard)' : 'var(--again)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p / 100)).toFixed(1)}" transform="rotate(-90 42 42)"/></svg>`; };
    const idx = DATA.indexOf(c), next = DATA[(idx + 1) % DATA.length];
    return `<div class="lb-top"><button class="lb-back" type="button" data-sim-list>${ic('back', 18)}<span>Cases</span></button><span class="lb-tr">Best ${S.best}</span></div>
      <div class="lb-card sim-res"><div class="sim-score">${ring(r.total)}<b>${r.total}</b></div><div class="sim-verd ${r.okDx ? 'ok' : 'bad'}">${r.okDx ? ic('check', 18) + ' Correct diagnosis' : ic('x', 18) + ' Not quite'}</div><div class="sim-dx">${esc(c.dx[c.ans])}</div>${r.okDx ? '' : `<div class="muted small">You picked: ${esc(c.dx[S.dx])}</div>`}</div>
      <div class="lb-group sim-break">
        <div class="sim-line"><span>Diagnosis</span><b>${r.pDx}/40</b></div>
        <div class="sim-line"><span>Key findings (${r.keyGot}/${r.keyN})</span><b>${r.pKey}/30</b></div>
        <div class="sim-line"><span>Differential</span><b>${r.pDdx}/15</b></div>
        <div class="sim-line"><span>Efficiency${r.waste.length ? ' (' + r.waste.length + ' unneeded test' + (r.waste.length > 1 ? 's' : '') + ')' : ''}</span><b>${r.pEff}/15</b></div>
      </div>
      ${r.waste.length ? `<div class="lb-card sim-sec"><h3>Tests you didn't need</h3><ul>${r.waste.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
      ${r.missed.length ? `<div class="lb-card sim-sec"><h3>Key clues you missed</h3><ul>${r.missed.map(m => `<li><b>${nm[m[0]]}: ${esc(m[1])}</b> ${esc(m[2])}</li>`).join('')}</ul></div>` : ''}
      <div class="lb-card sim-sec"><h3>What's happening (pathophysiology)</h3><p>${esc(c.patho)}</p></div>
      <div class="lb-card sim-sec"><h3>Treatment</h3><ul>${c.tr.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p class="muted small">Drug classes and procedures only. Real treatment is decided by a doctor for each patient.</p></div>
      <div class="lb-card sim-sec"><h3>Must-not-miss differential</h3><p>${c.ddx.filter(d => d[1]).map(d => esc(d[0])).join(' · ')}</p></div>
      <div class="lb-card sim-sec pearl"><h3>Pearl</h3><p>${esc(c.pearl)}</p></div>
      <div class="lb-btns"><button class="btn" data-sim-go="${c.id}" type="button">Retry</button><button class="btn pri" data-sim-go="${next.id}" type="button">Next case</button></div>`;
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const f = t.closest('[data-sim-f]'); if (f) { S.filt = f.dataset.simF; try { localStorage.setItem('sim.filt', S.filt); } catch (x) {} paint(); return; }
    if (t.closest('[data-sim-rand]')) { const pool = DATA.filter(c => S.filt === 'all' || c.area === S.filt); const unplayed = pool.filter(c => !L.bestOf('sim', c.id)); const p = (unplayed.length ? unplayed : pool); start(p[Math.floor(Math.random() * p.length)].id); return; }
    const g = t.closest('[data-sim-go]'); if (g) { start(g.dataset.simGo); return; }
    if (t.closest('[data-sim-list]')) { S.mode = 'list'; paint(); window.scrollTo(0, 0); return; }
    const st = t.closest('[data-sim-step]'); if (st && !st.disabled) { S.step = +st.dataset.simStep; paint(); return; }
    const a = t.closest('[data-sim-ask]'); if (a) { const k = STEPS[S.step][0]; S.asked[k].add(+a.dataset.simAsk); if (k === 'tx' && S.c.tx[+a.dataset.simAsk][2] === 0) { try { Prefs.sound('bad'); } catch (x) {} } paint(); return; }
    const d = t.closest('[data-sim-ddx]'); if (d) { const i = +d.dataset.simDdx; if (S.ddx.has(i)) S.ddx.delete(i); else if (S.ddx.size < 3) S.ddx.add(i); paint(); return; }
    const x = t.closest('[data-sim-dx]'); if (x) { S.dx = +x.dataset.simDx; paint(); return; }
    if (t.closest('[data-sim-next]')) { if (S.step < 4) { S.step++; paint(); window.scrollTo(0, 0); } return; }
    if (t.closest('[data-sim-submit]')) { if (S.dx != null) submit(); return; }
  }
  window.LabMods.sim = { render, _S: () => S };
})();
