/* SOAP note practice: sort each line of a patient encounter into Subjective, Objective, Assessment or Plan, then read the finished note. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const K = { S: ['Subjective', 'What the patient tells you: symptoms, history, in their words.'], O: ['Objective', 'What you measure or observe: vitals, exam, labs, imaging.'], A: ['Assessment', 'Your diagnosis or differential: what you think is going on.'], P: ['Plan', 'What happens next: tests, treatment, follow-up, red flags.'] };
  const CK = { S: '#4c9aff', O: '#30a46c', A: '#f2c14e', P: '#a06eff' };
  function render(el) {
    S = { el, mode: 'menu', c: null };
    if (!el.__sp) { el.__sp = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/soap.json').then(d => { D = d.cases; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function start(id) { const c = D.find(x => x.id === id); S.c = c; S.order = L.shuffle(c.items.map((x, i) => i)); S.a = {}; S.done = false; S.mode = 'play'; paint(); window.scrollTo(0, 0); }
  function paint() {
    if (!S || !S.el.isConnected) return; let h;
    if (S.mode === 'menu') {
      h = L.top('SOAP note practice', '', 'lab') + `<p class="muted lb-p">Doctors write every visit as a SOAP note. Sort each line of the visit into the right box.</p>
        <div class="lb-card">${Object.entries(K).map(([k, [n, d]]) => `<p style="margin:4px 0"><b style="color:${CK[k]}">${k} · ${n}</b> <span class="muted small">${d}</span></p>`).join('')}</div>
        <div class="lb-group">${D.map(c => { const b = L.bestOf('soap', c.id); return `<button class="lb-row" type="button" data-sp-go="${c.id}"><span class="lb-rt"><span class="t1">${esc(c.t)}</span><span class="t2">${c.items.length} lines</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else {
      const c = S.c, n = Object.keys(S.a).length;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sp-menu>${ic('back', 18)}<span>SOAP</span></button><span class="lb-tr">${esc(c.t)} · ${n}/${c.items.length}</span></div>`;
      if (!S.done) {
        h += `<p class="muted small">Tap S, O, A or P for each line.</p>` + S.order.map(i => { const it = c.items[i], a = S.a[i]; return `<div class="lb-card" style="padding:10px 12px;margin-bottom:8px"><p style="margin:0 0 8px">${esc(it.x)}</p><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${'SOAP'.split('').map(k => `<button type="button" class="btn" data-sp-i="${i}" data-sp-k="${k}" style="min-height:40px;${a === k ? `background:${CK[k]};color:#fff;border-color:${CK[k]}` : ''}">${k}</button>`).join('')}</div></div>`; }).join('');
        h += `<div class="lb-btns sticky"><button class="btn pri" data-sp-check type="button" ${n === c.items.length ? '' : 'disabled'}>Check (${n}/${c.items.length})</button></div>`;
      } else {
        const ok = c.items.filter((it, i) => S.a[i] === it.k).length, sc = Math.round(ok / c.items.length * 100);
        h += `<div class="lb-card sim-res"><div class="lz-big">${sc}%</div><div class="sim-verd ${sc >= 80 ? 'ok' : 'bad'}">${ok} of ${c.items.length} in the right box</div></div>`;
        const wrong = c.items.map((it, i) => [it, S.a[i]]).filter(([it, a]) => a !== it.k);
        if (wrong.length) h += `<div class="lb-card"><b>Fix these</b>${wrong.map(([it, a]) => `<p style="margin:8px 0 0">${esc(it.x)}<br><span class="muted small">You said ${a}, it's <b style="color:${CK[it.k]}">${it.k} · ${K[it.k][0]}</b>: ${K[it.k][1]}</span></p>`).join('')}</div>`;
        h += `<h3 style="margin:16px 0 8px">The finished note</h3><div class="lb-card">${'SOAP'.split('').map(k => `<p style="margin:6px 0 2px"><b style="color:${CK[k]}">${K[k][0]}</b></p><ul style="margin:0;padding-left:18px">${c.items.filter(it => it.k === k).map(it => `<li>${esc(it.x)}</li>`).join('')}</ul>`).join('')}</div>`;
        h += `<div class="lb-btns"><button class="btn" data-sp-menu type="button">Done</button><button class="btn pri" data-sp-next type="button">Next case</button></div>`;
      }
    }
    S.el.innerHTML = `<div class="lb sp">${h}</div>`;
  }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    const g = t.closest('[data-sp-go]'); if (g) { start(g.dataset.spGo); return; }
    if (t.closest('[data-sp-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    const b = t.closest('[data-sp-k]'); if (b && !S.done) { S.a[b.dataset.spI] = b.dataset.spK; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    if (t.closest('[data-sp-check]')) { const c = S.c, ok = c.items.filter((it, i) => S.a[i] === it.k).length, sc = Math.round(ok / c.items.length * 100); S.done = true; L.result('soap', c.id, sc); L.fx(sc >= 80); L.award('soap', Math.round(sc / 25)); paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-sp-next]')) { const i = D.indexOf(S.c); start(D[(i + 1) % D.length].id); return; }
  }
  window.LabMods.soap = { render, _S: () => S };
})();
