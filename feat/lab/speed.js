/* Anatomy speed run: 60 seconds, name as many structures as you can. "Find it" mode points at a spot on a real brain MRI slice; "What does it do" mode gives the job and you name the part. Wrong answers cost 2 seconds. Personal bests are saved and synced. Images: the brain atlas set (Wikimedia Commons, credited). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null, tm = 0;
  const LEN = 60;
  function render(el) {
    clearInterval(tm); S = { el, mode: 'menu', kind: localStorage.getItem('speed.kind') || 'pt' };
    if (!el.__sr) { el.__sr = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/atlas.json').then(d => { D = d.slices.flatMap(s => s.pts.map(p => ({ s, n: p[0], x: p[1], y: p[2], d: p[3] }))); if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const best = k => { const b = L.bestOf('speed', k); return b ? b.b : 0; };
  function q() {
    const R = S.run; let p; do { p = D[Math.floor(Math.random() * D.length)]; } while (R.last && p.n === R.last.n && D.length > 1);
    const same = [...new Set((S.kind === 'pt' ? p.s.pts.map(x => x[0]) : D.map(x => x.n)).filter(n => n !== p.n))];
    R.cur = { p, opts: L.shuffle([p.n, ...L.shuffle(same).slice(0, 3)]) }; R.last = p;
  }
  function blank(d, n) { for (const w of n.split(/[\s\/(),]+/).filter(w => w.length >= 4).sort((a, b) => b.length - a.length)) d = d.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '___'); return d; }
  function go() {
    S.mode = 'run'; S.run = { score: 0, miss: 0, end: Date.now() + LEN * 1000, wrong: [] }; q(); paint();
    clearInterval(tm); tm = setInterval(() => { if (!S || !S.el.isConnected) { clearInterval(tm); return; } const left = Math.max(0, Math.ceil((S.run.end - Date.now()) / 1000)); const t = S.el.querySelector('[data-sr-t]'); if (t) t.textContent = left + 's'; if (left <= 0) finish(); }, 250);
  }
  function finish() {
    clearInterval(tm); const R = S.run, k = S.kind, prev = best(k); S.mode = 'end'; R.pb = R.score > prev;
    L.result('speed', k, R.score); L.award('speed', Math.min(10, R.score)); if (R.pb) L.fx(true); paint();
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h;
    if (S.mode === 'menu') {
      h = L.top('Anatomy speed run', '', 'lab') + `<p class="muted lb-p">60 seconds. Name as many brain structures as you can. A wrong answer costs 2 seconds.</p>
        <div class="at-tabs"><button type="button" data-sr-k="pt" class="${S.kind === 'pt' ? 'on' : ''}">Find it on the scan</button><button type="button" data-sr-k="fn" class="${S.kind === 'fn' ? 'on' : ''}">What does it do?</button></div>
        <div class="lb-card sim-res" style="margin-top:12px"><div class="lz-big">${best(S.kind)}</div><div class="muted small">your best</div></div>
        <div class="lb-btns"><button class="btn pri" data-sr-go type="button">Go!</button></div><p class="lb-foot">${D.length} structures from 3 MRI slices.</p>`;
    } else if (S.mode === 'run') {
      const R = S.run, c = R.cur, left = Math.max(0, Math.ceil((R.end - Date.now()) / 1000));
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sr-stop>${ic('back', 18)}<span>Stop</span></button><span class="lb-tr"><b data-sr-t style="font-size:20px">${left}s</b> · ${R.score} ✓</span></div>`;
      if (S.kind === 'pt') h += `<div style="position:relative;border-radius:12px;overflow:hidden;background:#000;max-width:420px;margin:0 auto"><img src="feat/lab/atlas/${esc(c.p.s.img)}" alt="" style="width:100%;display:block"><span style="position:absolute;left:${c.p.x}%;top:${c.p.y}%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#e5484d;border:3px solid #fff;box-shadow:0 0 0 3px rgba(229,72,77,.45)"></span></div>`;
      else h += `<div class="lb-card"><p style="margin:0;font-size:17px">${esc(blank(c.p.d, c.p.n))}</p></div>`;
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">${c.opts.map(o => `<button type="button" class="btn" data-sr-a="${esc(o)}" style="min-height:52px">${esc(o)}</button>`).join('')}</div>`;
    } else {
      const R = S.run;
      h = L.top('Anatomy speed run', '', 'lab') + `<div class="lb-card sim-res"><div class="lz-big">${R.score}</div><div class="sim-verd ${R.pb ? 'ok' : ''}">${R.pb ? 'New personal best! 🎉' : 'Best: ' + best(S.kind)}</div><p class="muted small" style="margin:6px 0 0">${R.miss} miss${R.miss === 1 ? '' : 'es'}</p></div>`;
      if (R.wrong.length) h += `<div class="lb-card"><b>Review</b>${[...new Map(R.wrong.map(w => [w.n, w])).values()].map(w => `<p style="margin:8px 0 0"><b>${esc(w.n)}</b><br><span class="muted small">${esc(w.d)}</span></p>`).join('')}</div>`;
      h += `<div class="lb-btns"><button class="btn" data-sr-menu type="button">Done</button><button class="btn pri" data-sr-go type="button">Again</button></div>`;
    }
    S.el.innerHTML = `<div class="lb sr">${h}</div>`;
  }
  function answer(o) {
    const R = S.run; if (!R || S.mode !== 'run') return; const ok = o === R.cur.p.n;
    if (ok) R.score++; else { R.miss++; R.end -= 2000; R.wrong.push(R.cur.p); L.fx(false); }
    L.mastery({ id: 'SR:' + R.cur.p.n, tags: ['anatomy', 'neuro'], ok, choices: 4, label: R.cur.p.n, src: 'speed' });
    if (Date.now() >= R.end) return finish(); q(); paint();
  }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    const k = t.closest('[data-sr-k]'); if (k) { S.kind = k.dataset.srK; localStorage.setItem('speed.kind', S.kind); paint(); return; }
    if (t.closest('[data-sr-go]')) { go(); return; }
    const a = t.closest('[data-sr-a]'); if (a) { answer(a.dataset.srA); return; }
    if (t.closest('[data-sr-stop]')) { clearInterval(tm); S.mode = 'menu'; paint(); return; }
    if (t.closest('[data-sr-menu]')) { S.mode = 'menu'; paint(); return; }
  }
  window.LabMods.speed = { render, _S: () => S, finish };
})();
