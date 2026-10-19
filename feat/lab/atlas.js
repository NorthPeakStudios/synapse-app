/* Brain slice atlas: real openly licensed MRI slices (sagittal, axial, coronal). Explore: tap a dot to name the structure. Quiz: "tap the hippocampus". */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const TOL = 8.5, NQ = 10;
  function render(el) {
    S = { el, mode: 'menu', si: 0, sel: -1, labels: false };
    if (!el.__at) { el.__at = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/atlas.json').then(d => { D = d.slices; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const cred = s => `<p class="at-cr">Image: “${esc(s.cr.t)}” by ${esc(s.cr.a)}, ${s.cr.lu ? `<a href="${esc(s.cr.lu)}" target="_blank" rel="noopener">${esc(s.cr.l)}</a>` : esc(s.cr.l)}, via <a href="${esc(s.cr.u)}" target="_blank" rel="noopener">Wikimedia Commons</a> (contrast adjusted).</p>`;
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('atlas'), n = D.reduce((a, s) => a + s.pts.length, 0);
      h = L.top('Brain slice atlas', st ? `best ${st.best}%` : '', 'lab') + `<p class="muted lb-p">Real MRI slices of a healthy brain in all three planes. Explore them dot by dot, then take the quiz: we name it, you tap it. ${n} structures.</p>
        <div class="lb-btns"><button class="btn pri" data-at-quiz type="button">Quiz (tap ${NQ})</button><button class="btn" data-at-explore type="button">Explore slices</button></div>
        <div class="lb-card lz-intro"><b>Reading MRI like a radiologist</b><ul><li><b>Axial</b> = slices like bread, seen from the feet. <b>Coronal</b> = from the front. <b>Sagittal</b> = from the side.</li><li>Radiology convention: the patient's right is on <b>your</b> left.</li><li><b>T1</b>: fluid dark, white matter bright (anatomy). <b>T2</b>: fluid bright (pathology, swelling).</li></ul></div>`;
    } else if (S.mode === 'explore') {
      const s = D[S.si], p = S.sel >= 0 ? s.pts[S.sel] : null;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-at-menu>${ic('back', 18)}<span>Atlas</span></button><span class="lb-tr"><button class="at-tg" data-at-lab type="button">${S.labels ? 'Hide' : 'Show'} all</button></span></div>`;
      h += `<div class="at-tabs">${D.map((x, i) => `<button type="button" data-at-s="${i}" class="${i === S.si ? 'on' : ''}">${esc(x.t.split(' · ')[0])}</button>`).join('')}</div>`;
      h += `<p class="at-note">${esc(s.t)}. ${esc(s.note)}</p>`;
      h += `<div class="at-wrap"><img src="feat/lab/atlas/${esc(s.img)}?v=${L.VER}" alt="${esc(s.t)}" width="720" height="720">${s.pts.map((q, i) => `<button type="button" class="at-dot${i === S.sel ? ' sel' : ''}${S.labels ? ' num' : ''}" data-at-p="${i}" style="left:${q[1]}%;top:${q[2]}%" aria-label="${esc(q[0])}">${S.labels ? i + 1 : ''}</button>${i === S.sel ? `<span class="at-lbl${q[1] > 62 ? ' l' : ''}" style="left:${q[1]}%;top:${q[2]}%">${esc(q[0])}</span>` : ''}`).join('')}</div>`;
      h += `<div class="at-info">${p ? `<b>${esc(p[0])}</b><span>${esc(p[3])}</span>` : '<span>Tap a yellow dot.</span>'}</div>`;
      if (S.labels) h += `<div class="at-leg">${s.pts.map((q, i) => `<button type="button" data-at-p="${i}" class="${i === S.sel ? 'on' : ''}"><i>${i + 1}</i>${esc(q[0])}</button>`).join('')}</div>`;
      h += cred(s);
    } else {
      const done = S.mode === 'end', q = done ? null : S.qs[S.qi], s = q && D[q[0]], pt = q && s.pts[q[1]];
      h = `<div class="lb-top"><button class="lb-back" type="button" data-at-menu>${ic('back', 18)}<span>Atlas</span></button><span class="lb-tr">${done ? S.right + '/' + NQ : (S.qi + 1) + '/' + NQ + ' · ' + S.right + ' right'}</span></div>`;
      if (done) {
        const sc = Math.round(100 * S.right / NQ);
        h += `<div class="lb-card sim-res"><div class="lz-big">${sc}%</div><div class="sim-verd ${sc >= 70 ? 'ok' : 'bad'}">${S.right}/${NQ} structures found</div></div><div class="lb-btns"><button class="btn" data-at-explore type="button">Explore</button><button class="btn pri" data-at-quiz type="button">Again</button></div>`;
      } else {
        h += `<p class="at-q">Tap the ${esc(pt[0].toLowerCase())}</p><p class="at-note">${esc(s.t)}. ${esc(s.note)}</p>`;
        h += `<div class="at-wrap" data-at-img><img src="feat/lab/atlas/${esc(s.img)}?v=${L.VER}" alt="${esc(s.t)}" width="720" height="720">${S.tap ? `<span class="at-ring" style="left:${pt[1]}%;top:${pt[2]}%"></span><span class="at-tap${S.tap.ok ? ' good' : ''}" style="left:${S.tap.x}%;top:${S.tap.y}%"></span><span class="at-lbl${pt[1] > 62 ? ' l' : ''}" style="left:${pt[1]}%;top:${pt[2]}%">${esc(pt[0])}</span>` : ''}</div>`;
        if (S.tap) h += `<div class="at-info"><b>${S.tap.ok ? 'Yes!' : 'Not quite: it\'s in the green ring.'}</b><span>${esc(pt[3])}</span></div><div class="lb-btns"><button class="btn pri" data-at-next type="button">${S.qi + 1 < NQ ? 'Next' : 'Finish'}</button></div>`;
        h += cred(s);
      }
    }
    S.el.innerHTML = `<div class="lb at">${h}</div>`;
  }
  function quiz() {
    const all = []; D.forEach((s, i) => s.pts.forEach((p, j) => all.push([i, j])));
    S.qs = L.shuffle(all).slice(0, NQ); S.qi = 0; S.right = 0; S.tap = null; S.mode = 'quiz'; paint(); window.scrollTo(0, 0);
  }
  function tapAt(e, box) {
    const r = box.getBoundingClientRect(), x = 100 * (e.clientX - r.left) / r.width, y = 100 * (e.clientY - r.top) / r.height;
    const q = S.qs[S.qi], s = D[q[0]], pt = s.pts[q[1]];
    // nearest labelled structure decides it (so a tap closer to a neighbour counts as that neighbour)
    let best = -1, bd = 1e9; s.pts.forEach((p, i) => { const d = Math.hypot(p[1] - x, p[2] - y); if (d < bd) { bd = d; best = i; } });
    const ok = best === q[1] && bd <= TOL;
    S.tap = { x, y, ok }; if (ok) S.right++; L.fx(ok);
    L.mastery({ id: 'AT:' + pt[0], tags: ['neuroanatomy', 'MRI'], ok, choices: s.pts.length, label: pt[0], src: 'atlas' });
    paint();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-at-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-at-explore]')) { S.mode = 'explore'; S.sel = -1; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-at-quiz]')) { quiz(); return; }
    if (t.closest('[data-at-lab]')) { S.labels = !S.labels; paint(); return; }
    const sb = t.closest('[data-at-s]'); if (sb) { S.si = +sb.dataset.atS; S.sel = -1; paint(); return; }
    const pd = t.closest('[data-at-p]'); if (pd) { S.sel = +pd.dataset.atP; paint(); try { window.Prefs && Prefs.haptic(); } catch (x) {} return; }
    if (S.mode === 'quiz') {
      if (t.closest('[data-at-next]')) { S.qi++; S.tap = null; if (S.qi >= NQ) { S.mode = 'end'; const sc = Math.round(100 * S.right / NQ); L.result('atlas', 'quiz', sc); L.award('atlas', 2 + S.right); L.fx(sc >= 70); } paint(); window.scrollTo(0, 0); return; }
      const box = t.closest('[data-at-img]'); if (box && !S.tap) { tapAt(e, box); return; }
    }
  }
  window.LabMods.atlas = { render, _S: () => S, _D: () => D };
})();
