/* Image quizzes: surgical instruments, rash photos (derm), histology slides. Openly licensed Wikimedia Commons images, credit line on each. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let D = null; const ST = {};
  const KIND = {
    inst: { t: 'Instrument ID', b: 'Name the surgical and exam instrument from the photo, then learn what it\'s for.', q: 'Which instrument is this?', tag: 'surgery' },
    derm: { t: 'Rash quiz', b: 'Real skin photos. Spot the pattern (shape, colour, where it is) and name it.', q: 'What\'s the most likely diagnosis?', tag: 'dermatology' },
    histo: { t: 'Histology slides', b: 'Real microscope slides. Name the tissue from what the cells look like.', q: 'Which tissue is this?', tag: 'histology' } };
  const credit = x => `<p class="sd-cred">Photo: ${esc(x.artist)}, ${esc(x.lic)}, via <a href="${esc(x.src)}" target="_blank" rel="noopener">Wikimedia Commons</a> (resized)</p>`;
  function mk(kind) {
    return { render(el) {
      const S = ST[kind] = { el, mode: 'menu' };
      if (!el.__px) { el.__px = 1; el.addEventListener('click', e => onClick(kind, e)); }
      el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
      L.json('feat/lab/media.json').then(d => { D = d; if (ST[kind] === S) paint(kind); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
    }, _S: () => ST[kind] };
  }
  const img = x => `${x.img}?v=${L.VER}`;
  function paint(kind) {
    const S = ST[kind]; if (!S || !S.el.isConnected) return; let h = ''; const K = KIND[kind], all = D[kind];
    if (S.mode === 'menu') {
      const st = L.stat(kind);
      h = L.top(K.t, st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">${K.b} ${all.length} images.</p>
        <div class="lb-btns"><button class="btn pri" data-px-quiz type="button">Quiz me</button><button class="btn" data-px-study type="button">Study all</button></div>
        <div class="px-grid">${all.map((x, i) => `<button type="button" class="px-th" data-px-one="${i}"><img src="${img(x)}" alt="" loading="lazy" decoding="async"><span>${esc(x.name)}</span></button>`).join('')}</div>
        <p class="lb-foot">Openly licensed photos from Wikimedia Commons; each shows its credit. Not medical advice.</p>`;
    } else if (S.mode === 'study') {
      const x = all[S.i];
      h = `<div class="lb-top"><button class="lb-back" type="button" data-px-menu>${ic('back', 18)}<span>${K.t}</span></button><span class="lb-tr">${S.i + 1}/${all.length}</span></div>
        <div class="px-img"><img src="${img(x)}" alt="${esc(x.name)}"></div><div class="lb-card sim-sec"><h3>${esc(x.name)}</h3><p>${esc(x.use || x.desc)}</p>${x.tip ? `<p class="muted" style="margin-top:6px;font-size:14px">${esc(x.tip)}</p>` : ''}${credit(x)}</div>
        <div class="lb-btns sticky"><button class="btn" data-px-prev type="button" ${S.i ? '' : 'disabled'}>Previous</button><button class="btn pri" data-px-nx type="button">${S.i + 1 < all.length ? 'Next' : 'Done'}</button></div>`;
    } else if (S.mode === 'end') {
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.right}/${S.q.length} right</div></div>
        ${S.missed.length ? `<div class="lb-card"><h3>Review</h3><ul>${S.missed.map(x => `<li><b>${esc(x.name)}</b></li>`).join('')}</ul></div>` : ''}
        <div class="lb-btns"><button class="btn" data-px-menu type="button">Done</button><button class="btn pri" data-px-quiz type="button">Again</button></div>`;
    } else {
      const x = S.q[S.i], done = S.pick != null;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-px-menu>${ic('back', 18)}<span>${K.t}</span></button><span class="lb-tr">${S.i + 1}/${S.q.length} · ${S.right} right</span></div>
        <div class="px-img"><img src="${img(x)}" alt="Quiz image"></div><p class="mt-h">${K.q}</p>
        <div class="sim-opts">${S.opts.map(o => { const y = all.find(z => z.id === o); return `<button type="button" class="sim-o${done ? (o === x.id ? ' good' : o === S.pick ? ' badc' : '') : ''}" data-px-o="${o}" ${done ? 'disabled' : ''}><span class="sim-q">${esc(y.name)}</span></button>`; }).join('')}</div>
        ${done ? `<div class="lb-card sim-sec"><h3>${S.pick === x.id ? 'Right' : 'It\'s: ' + esc(x.name)}</h3><p>${esc(x.use || x.desc)}</p>${x.tip ? `<p class="muted" style="margin-top:6px;font-size:14px">${esc(x.tip)}</p>` : ''}${credit(x)}</div><div class="lb-btns sticky"><button class="btn pri" data-px-next type="button">${S.i + 1 < S.q.length ? 'Next' : 'Finish'}</button></div>` : ''}`;
    }
    S.el.innerHTML = `<div class="lb px">${h}</div>`;
  }
  function quiz(kind) { const S = ST[kind], all = D[kind]; S.q = L.shuffle(all).slice(0, 10); S.i = 0; S.right = 0; S.missed = []; S.mode = 'play'; setQ(kind); }
  function setQ(kind) { const S = ST[kind], x = S.q[S.i], all = D[kind]; S.pick = null; S.opts = L.shuffle([x.id].concat(L.shuffle(all.filter(z => z.id !== x.id)).slice(0, 3).map(z => z.id))); paint(kind); window.scrollTo(0, 0); }
  function onClick(kind, e) {
    const S = ST[kind]; if (!S || !D) return; const t = e.target, all = D[kind];
    if (t.closest('[data-px-menu]')) { S.mode = 'menu'; paint(kind); window.scrollTo(0, 0); return; }
    if (t.closest('[data-px-quiz]')) { quiz(kind); return; }
    if (t.closest('[data-px-study]')) { S.mode = 'study'; S.i = 0; paint(kind); window.scrollTo(0, 0); return; }
    const one = t.closest('[data-px-one]'); if (one) { S.mode = 'study'; S.i = +one.dataset.pxOne; paint(kind); window.scrollTo(0, 0); return; }
    if (t.closest('[data-px-prev]')) { S.i = Math.max(0, S.i - 1); paint(kind); window.scrollTo(0, 0); return; }
    if (t.closest('[data-px-nx]')) { if (S.i + 1 < all.length) S.i++; else S.mode = 'menu'; paint(kind); window.scrollTo(0, 0); return; }
    const o = t.closest('[data-px-o]'); if (o && S.mode === 'play' && S.pick == null) {
      const x = S.q[S.i]; S.pick = o.dataset.pxO; const ok = S.pick === x.id; if (ok) S.right++; else S.missed.push(x); L.fx(ok);
      L.mastery({ id: 'PX:' + kind + ':' + x.id, tags: [KIND[kind].tag], ok, choices: 4, label: KIND[kind].t + ': ' + x.name, src: kind });
      const y = window.scrollY; paint(kind); window.scrollTo(0, y); return;
    }
    if (t.closest('[data-px-next]')) {
      if (S.i + 1 >= S.q.length) { S.score = Math.round(100 * S.right / S.q.length); S.mode = 'end'; L.result(kind, 'quiz-' + new Date().toISOString().slice(0, 10), S.score); L.award(kind, 2 * S.right); paint(kind); window.scrollTo(0, 0); return; }
      S.i++; setQ(kind); return;
    }
  }
  window.LabMods.inst = mk('inst'); window.LabMods.derm = mk('derm'); window.LabMods.histo = mk('histo');
})();
