/* Image occlusion: pick a picture (your photo or a free Wikimedia Commons image), draw boxes over labels, name each box. Every box becomes a card: the question shows the picture with that box hidden (red "?"), the answer is its name. Images are shrunk and stored in the note so they sync. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null;
  function render(el) {
    S = { el, img: null, w: 0, h: 0, boxes: [], mode: 'one', credit: '', deck: localStorage.getItem('occl.deck') || '', sel: -1 };
    if (!el.__oc) { el.__oc = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); }
    paint();
  }
  function decks() { return [...M.decks.values()].filter(d => !d.del).sort((a, b) => String(a.name).localeCompare(String(b.name))); }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = L.top('Image occlusion', S.boxes.length ? S.boxes.length + ' boxes' : '', 'tools');
    if (!S.img) {
      if (S.done) h += `<div class="lb-card sim-res"><div class="sim-verd ok">✓ ${S.done} card${S.done === 1 ? '' : 's'} added</div><p class="muted small" style="margin:6px 0 0">Each one shows the picture with one box hidden.</p><div class="lb-btns"><button class="btn pri" data-oc-study type="button">Study them now</button></div></div>`;
      h += `<p class="muted lb-p">Turn any labelled diagram into cards. Pick a picture, drag boxes over the labels, name each one. Each box becomes its own card.</p>
        <div class="lb-btns"><label class="btn pri oc-file">📷 Choose a photo<input type="file" accept="image/*" data-oc-file hidden></label><button class="btn" data-oc-commons type="button">Search free images</button></div>`;
    } else {
      h += `<p class="muted small">Drag on the picture to draw a box over a label. Tap a box to select it.</p>
        <div class="oc-stage" data-oc-stage><img src="${S.img}" alt="" draggable="false">${S.boxes.map((b, i) => `<div class="oc-box${i === S.sel ? ' sel' : ''}" data-oc-b="${i}" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%"><span>${i + 1}</span></div>`).join('')}${S.drag ? `<div class="oc-box drawing" style="left:${S.drag.x * 100}%;top:${S.drag.y * 100}%;width:${S.drag.w * 100}%;height:${S.drag.h * 100}%"></div>` : ''}</div>
        ${S.credit ? `<p class="at-cr">${esc(S.credit)}</p>` : ''}
        <div class="oc-list">${S.boxes.map((b, i) => `<div class="oc-row${i === S.sel ? ' sel' : ''}"><i>${i + 1}</i><input type="text" data-oc-lbl="${i}" value="${esc(b.t)}" placeholder="What's under box ${i + 1}?" maxlength="80"><button type="button" data-oc-del="${i}" aria-label="Delete box">✕</button></div>`).join('') || '<p class="muted small">No boxes yet.</p>'}</div>
        <div class="oc-opts"><div class="at-tabs"><button type="button" data-oc-mode="one" class="${S.mode === 'one' ? 'on' : ''}">Hide one, show others</button><button type="button" data-oc-mode="all" class="${S.mode === 'all' ? 'on' : ''}">Hide all</button></div>
        <label class="oc-deck">Deck <select data-oc-deck><option value="">+ New deck “Image occlusion”</option>${decks().map(d => `<option value="${esc(d.id)}" ${d.id === S.deck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label></div>
        <div class="lb-btns sticky"><button class="btn" data-oc-reset type="button">New picture</button><button class="btn pri" data-oc-make type="button" ${S.boxes.length && S.boxes.every(b => b.t.trim()) ? '' : 'disabled'}>Make ${S.boxes.length || ''} card${S.boxes.length === 1 ? '' : 's'}</button></div>`;
    }
    S.el.innerHTML = `<div class="lb oc">${h}</div>`;
    const st = S.el.querySelector('[data-oc-stage]'); if (st) bindStage(st);
  }
  function bindStage(st) {
    let start = null;
    const pos = e => { const r = st.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
    st.onpointerdown = e => { if (e.target.closest('[data-oc-b]')) return; e.preventDefault(); start = pos(e); st.setPointerCapture(e.pointerId); S.drag = { x: start.x, y: start.y, w: 0, h: 0 }; };
    st.onpointermove = e => { if (!start) return; const p = pos(e); S.drag = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }; let d = st.querySelector('.drawing'); if (!d) { d = document.createElement('div'); d.className = 'oc-box drawing'; st.appendChild(d); } Object.assign(d.style, { left: S.drag.x * 100 + '%', top: S.drag.y * 100 + '%', width: S.drag.w * 100 + '%', height: S.drag.h * 100 + '%' }); };
    st.onpointerup = e => { if (!start) return; start = null; const d = S.drag; S.drag = null; if (d && d.w > 0.02 && d.h > 0.015) { S.boxes.push(Object.assign({ t: '' }, d)); S.sel = S.boxes.length - 1; } const y = window.scrollY; paint(); window.scrollTo(0, y); const i = S.el.querySelector(`[data-oc-lbl="${S.sel}"]`); if (i && d && d.w > 0.02) i.focus({ preventScroll: true }); };
  }
  async function setImage(blob, credit) {
    try { S.img = await shrinkImage(blob, 900, 200000); } catch (e) { toast('Couldn\'t read that picture'); return; }
    const im = new Image(); im.onload = () => { S.w = im.naturalWidth; S.h = im.naturalHeight; S.boxes = []; S.done = 0; S.credit = credit || ''; paint(); }; im.src = S.img;
  }
  async function masked(k) {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = S.img; });
    const scale = Math.min(1, 720 / Math.max(im.naturalWidth, im.naturalHeight)); const w = Math.round(im.naturalWidth * scale), h = Math.round(im.naturalHeight * scale);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.drawImage(im, 0, 0, w, h);
    S.boxes.forEach((b, i) => {
      const r = [b.x * w, b.y * h, b.w * w, b.h * h];
      if (i === k) { cx.fillStyle = '#e5484d'; cx.fillRect(...r); cx.fillStyle = '#fff'; cx.font = `bold ${Math.max(12, Math.min(r[3] * 0.7, 40))}px -apple-system,system-ui,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', r[0] + r[2] / 2, r[1] + r[3] / 2); }
      else if (S.mode === 'all') { cx.fillStyle = '#f2c14e'; cx.fillRect(...r); }
    });
    let q = 0.82, out = cv.toDataURL('image/jpeg', q); while (out.length > 140000 && q > 0.4) { q -= 0.08; out = cv.toDataURL('image/jpeg', q); }
    return out;
  }
  async function make() {
    let did = S.deck;
    const ops = [];
    if (!did || !M.decks.get(did)) { did = 'd-io-' + Date.now().toString(36); ops.push(['decks', { id: did, name: 'Image occlusion', created: Date.now(), del: 0 }]); }
    const grp = 'io' + Date.now().toString(36); let n = 0;
    for (let k = 0; k < S.boxes.length; k++) {
      const img = await masked(k);
      const note = { id: 'n-' + grp + '-' + k, created: Date.now() + k, deck: did, type: 'basic', front: 'What is hidden under the red box?', back: esc(S.boxes[k].t.trim()), img, imgSide: 'front', imgCredit: S.credit || '', tags: ['image-occlusion'], del: 0 };
      M.notes.set(note.id, note); ops.push(['notes', note], ...cardsForNote(note, Date.now() + k)); n++;
    }
    await write(ops); localStorage.setItem('occl.deck', did); S.deck = did;
    try { window.Hub && Hub.award('lib', 2 * n); } catch (e) {} try { toast(n + ' card' + (n === 1 ? '' : 's') + ' added'); } catch (e) {}
    S.done = n; S.img = null; S.boxes = []; paint();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-oc-commons]')) { if (window.ImgCards) ImgCards.picker('labelled diagram', (dataUrl, credit) => { fetch(dataUrl).then(r => r.blob()).then(b => setImage(b, credit)); }); return; }
    const b = t.closest('[data-oc-b]'); if (b) { S.sel = +b.dataset.ocB; paint(); return; }
    const d = t.closest('[data-oc-del]'); if (d) { S.boxes.splice(+d.dataset.ocDel, 1); S.sel = -1; paint(); return; }
    const m = t.closest('[data-oc-mode]'); if (m) { S.mode = m.dataset.ocMode; paint(); return; }
    if (t.closest('[data-oc-study]')) { const d = S.deck; try { studyDeck = d; undoStack = []; go('study'); } catch (err) { go('decks'); } return; }
    if (t.closest('[data-oc-reset]')) { S.img = null; S.boxes = []; S.done = 0; paint(); return; }
    if (t.closest('[data-oc-make]')) { make().catch(err => { console.warn(err); toast('Couldn\'t make the cards'); }); return; }
  }
  function onChange(e) {
    const f = e.target.closest('[data-oc-file]'); if (f && f.files && f.files[0]) { setImage(f.files[0], ''); return; }
    const d = e.target.closest('[data-oc-deck]'); if (d) { S.deck = d.value; return; }
  }
  function onInput(e) { const i = e.target.closest('[data-oc-lbl]'); if (i) { S.boxes[+i.dataset.ocLbl].t = i.value; const mk = S.el.querySelector('[data-oc-make]'); if (mk) mk.disabled = !(S.boxes.length && S.boxes.every(b => b.t.trim())); } }
  window.LabMods.occl = { render, _S: () => S, setImage, masked };
})();
