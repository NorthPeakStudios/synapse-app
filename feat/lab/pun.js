/* Punnett squares: build a cross and read the odds, then quiz yourself. Patterns: autosomal recessive (cystic fibrosis, sickle cell), autosomal dominant (Huntington, Marfan), X-linked recessive (red-green color blindness, hemophilia A), codominance (ABO blood type). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null;
  const P = {
    ar: { t: 'Autosomal recessive', ex: 'Cystic fibrosis', a: 'F', note: 'Two broken copies (ff) = affected. One copy (Ff) = healthy carrier.', g: ['FF', 'Ff', 'ff'], ph: g => g === 'ff' ? 'affected' : g.includes('f') ? 'carrier' : 'unaffected' },
    sc: { t: 'Autosomal recessive', ex: 'Sickle cell disease', a: 'S', note: 'HbS from both parents (ss) = sickle cell disease; Ss = sickle cell trait (mostly healthy, some malaria protection).', g: ['SS', 'Ss', 'ss'], ph: g => g === 'ss' ? 'affected' : g.includes('s') ? 'carrier' : 'unaffected' },
    ad: { t: 'Autosomal dominant', ex: 'Huntington disease', a: 'H', note: 'One copy of the faulty gene (H) is enough. Each child of an Hh parent has a 50% chance.', g: ['HH', 'Hh', 'hh'], ph: g => g.includes('H') ? 'affected' : 'unaffected' },
    xr: { t: 'X-linked recessive', ex: 'Red-green color blindness', x: 1, note: 'The gene is on the X chromosome. XY children have only one X, so one faulty copy (XᶜY) shows. XX children need two.', gm: ['XY', 'XᶜY'], gf: ['XX', 'XXᶜ', 'XᶜXᶜ'] },
    abo: { t: 'Codominance', ex: 'ABO blood type', abo: 1, note: 'A and B are codominant (AB shows both); O is recessive, so AO = type A and BO = type B.', g: ['AA', 'AO', 'BB', 'BO', 'AB', 'OO'] }
  };
  function render(el) {
    S = { el, k: localStorage.getItem('pun.k') || 'ar', p1: null, p2: null, mode: 'build', q: null, n: 0, right: 0 };
    def();
    if (!el.__pn) { el.__pn = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
    paint();
  }
  function def() { const p = P[S.k]; if (p.x) { S.p1 = p.gf[1]; S.p2 = p.gm[0]; } else { S.p1 = p.g[1]; S.p2 = p.g[1]; } }
  const alleles = g => g.startsWith('X') ? g.match(/X[ᶜ]?|Y/g) : g.split('');
  const sortG = (a, b, k) => { if (P[k].x) { const xs = [a, b].sort((m, n) => (m === 'Y') - (n === 'Y') || (m.length - n.length)); return xs.join(''); } if (P[k].abo) { const o = 'ABO'; return [a, b].sort((m, n) => o.indexOf(m) - o.indexOf(n)).join(''); } return [a, b].sort((m, n) => (m === m.toLowerCase()) - (n === n.toLowerCase())).join(''); };
  function phen(g, k) {
    const p = P[k];
    if (p.x) { const y = g.includes('Y'), c = (g.match(/ᶜ/g) || []).length; return y ? (c ? 'affected' : 'unaffected') : c === 2 ? 'affected' : c === 1 ? 'carrier' : 'unaffected'; }
    if (p.abo) { const s = new Set(g.split('')); return s.has('A') && s.has('B') ? 'type AB' : s.has('A') ? 'type A' : s.has('B') ? 'type B' : 'type O'; }
    return p.ph(g);
  }
  function cross(p1, p2, k) {
    const a1 = alleles(p1), a2 = alleles(p2), grid = a1.map(x => a2.map(y => sortG(x, y, k)));
    const cnt = {}; grid.flat().forEach(g => { const ph = phen(g, k); cnt[ph] = (cnt[ph] || 0) + 1; });
    return { a1, a2, grid, cnt };
  }
  const COL = { affected: 'rgba(229,72,77,.28)', carrier: 'rgba(242,193,78,.28)', unaffected: 'rgba(48,164,108,.22)', 'type A': 'rgba(76,154,255,.25)', 'type B': 'rgba(242,193,78,.28)', 'type AB': 'rgba(160,110,255,.28)', 'type O': 'rgba(48,164,108,.22)' };
  function gridHTML(c, k) {
    const cell = 'style="border:1px solid var(--line,#333);padding:12px 4px;text-align:center;font-weight:700;font-size:18px"';
    return `<table style="border-collapse:collapse;width:100%;max-width:340px;margin:10px auto"><tr><td></td>${c.a2.map(a => `<td ${cell}>${esc(a)}</td>`).join('')}</tr>${c.a1.map((a, i) => `<tr><td ${cell}>${esc(a)}</td>${c.grid[i].map(g => `<td ${cell.replace('style="', `style="background:${COL[phen(g, k)] || 'none'};`)}>${esc(g)}<div style="font-size:11px;font-weight:500;opacity:.8">${esc(phen(g, k))}</div></td>`).join('')}</tr>`).join('')}</table>`;
  }
  const pct = (n, t) => Math.round(n / t * 100) + '%';
  function paint() {
    if (!S || !S.el.isConnected) return; const p = P[S.k];
    let h = L.top('Punnett squares', S.n ? `${S.right}/${S.n}` : '', 'lab');
    h += `<div class="at-tabs"><button type="button" data-pn-mode="build" class="${S.mode === 'build' ? 'on' : ''}">Build a cross</button><button type="button" data-pn-mode="quiz" class="${S.mode === 'quiz' ? 'on' : ''}">Quiz me</button></div>`;
    if (S.mode === 'build') {
      h += `<label class="oc-deck" style="display:block;margin:12px 0">Pattern <select data-pn-k style="width:100%;margin-top:4px">${Object.entries(P).map(([k, x]) => `<option value="${k}" ${k === S.k ? 'selected' : ''}>${esc(x.t)}: ${esc(x.ex)}</option>`).join('')}</select></label>`;
      const o1 = p.x ? p.gf : p.g, o2 = p.x ? p.gm : p.g;
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>${p.x ? 'Parent 1 (XX)' : 'Parent 1'}<select data-pn-p="1" style="width:100%">${o1.map(g => `<option ${g === S.p1 ? 'selected' : ''}>${g}</option>`).join('')}</select></label><label>${p.x ? 'Parent 2 (XY)' : 'Parent 2'}<select data-pn-p="2" style="width:100%">${o2.map(g => `<option ${g === S.p2 ? 'selected' : ''}>${g}</option>`).join('')}</select></label></div>`;
      const c = cross(S.p1, S.p2, S.k);
      h += gridHTML(c, S.k) + `<div class="lb-card"><b>Each child's odds</b><p style="margin:6px 0 0">${Object.entries(c.cnt).map(([ph, n]) => `${pct(n, 4)} ${esc(ph)}`).join(' · ')}</p><p class="muted small" style="margin:8px 0 0">${esc(p.note)} Every child is a fresh coin flip: the odds don't change with how many kids came before.</p></div>`;
    } else {
      if (!S.q) newQ();
      const q = S.q;
      h += `<div class="lb-card" style="margin-top:12px"><p class="muted small" style="margin:0">${esc(P[q.k].t)} · ${esc(P[q.k].ex)}</p><p style="margin:6px 0 0;font-weight:600">${esc(q.txt)}</p></div>`;
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">${q.opts.map(o => `<button type="button" class="btn ${q.ans != null ? (o === q.right ? 'pri' : o === q.ans ? 'bad' : '') : ''}" data-pn-a="${o}" ${q.ans != null ? 'disabled' : ''}>${o}</button>`).join('')}</div>`;
      if (q.ans != null) h += `<p class="sim-verd ${q.ans === q.right ? 'ok' : 'bad'}">${q.ans === q.right ? 'Right!' : 'Answer: ' + q.right}</p>` + gridHTML(q.c, q.k) + `<div class="lb-btns"><button class="btn pri" data-pn-next type="button">Next</button></div>`;
    }
    h += `<p class="lb-foot">Simplified single-gene teaching models.</p>`;
    S.el.innerHTML = `<div class="lb pn">${h}</div>`;
  }
  function newQ() {
    const ks = Object.keys(P), k = ks[Math.floor(Math.random() * ks.length)], p = P[k];
    const r = a => a[Math.floor(Math.random() * a.length)];
    let p1, p2, ph;
    for (let i = 0; i < 30; i++) {
      p1 = p.x ? r(p.gf) : r(p.g); p2 = p.x ? r(p.gm) : r(p.g);
      const c0 = cross(p1, p2, k), phs = Object.keys(c0.cnt); ph = r(phs);
      if (phs.length > 1 || Math.random() < 0.2) break;
    }
    const c = cross(p1, p2, k), right = pct(c.cnt[ph] || 0, 4);
    const txt = `Parents ${p1} × ${p2}. What are the odds a child is ${ph === 'carrier' ? 'a carrier' : ph}?`;
    S.q = { k, c, txt, right, opts: ['0%', '25%', '50%', '75%', '100%'].filter((o, i, a) => true).slice(0), ans: null };
    S.q.opts = ['0%', '25%', '50%', '75%', '100%'];
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const m = t.closest('[data-pn-mode]'); if (m) { S.mode = m.dataset.pnMode; paint(); return; }
    const a = t.closest('[data-pn-a]'); if (a && S.q && S.q.ans == null) { S.q.ans = a.dataset.pnA; const ok = S.q.ans === S.q.right; S.n++; if (ok) S.right++; L.fx(ok); L.result('pun', 'q' + (S.n % 20), ok ? 100 : 0); L.award('pun', ok ? 2 : 0); L.mastery({ id: 'PUN:' + S.q.k, tags: ['genetics'], ok, choices: 5, label: P[S.q.k].ex, src: 'pun' }); paint(); return; }
    if (t.closest('[data-pn-next]')) { S.q = null; paint(); return; }
  }
  function onChange(e) {
    const k = e.target.closest('[data-pn-k]'); if (k) { S.k = k.value; localStorage.setItem('pun.k', S.k); def(); paint(); return; }
    const pp = e.target.closest('[data-pn-p]'); if (pp) { S['p' + pp.dataset.pnP] = pp.value; paint(); }
  }
  window.LabMods.pun = { render, cross, phen, _S: () => S };
})();
