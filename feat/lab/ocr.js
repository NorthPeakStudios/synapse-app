/* Snap a page → flashcards. On-device OCR (tesseract.js, self-hosted in vendor/tess, loaded only here), then sentences → Q/A + cloze drafts to review/edit before saving. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  const LANGS = [['eng', 'English']];
  const abs = p => new URL(p, location.href).href;
  // same SIMD probe tesseract uses; picks the plain .js + .wasm core (no base64 data: fetch, so the CSP stays strict)
  const simd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } };
  let S = null, tessP = null, worker = null, workerLang = '';
  function render(el) {
    S = S && S.keep ? Object.assign(S, { el }) : { el, mode: 'pick', lang: LANGS.some(x => x[0] === localStorage.getItem('ocr.lang')) ? localStorage.getItem('ocr.lang') : 'eng', text: '', cards: [], img: null };
    if (!el.__ocr) { el.__ocr = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); el.addEventListener('input', onInput); }
    paint();
  }
  function paint() {
    if (!S || !S.el.isConnected) return;
    const back = L.top('', '', 'tools');
    let h = '';
    if (S.mode === 'pick') {
      h = `<h2 class="lb-title">Snap a page</h2><p class="muted lb-p">Take a photo of a textbook page or notes. The text is read on your phone (nothing is uploaded), then turned into flashcards you can edit before saving.</p>
        <div class="lb-card"${LANGS.length < 2 ? ' hidden' : ''}><span class="lz-k">Page language</span><div class="pseg lb-seg sm">${LANGS.map(([k, l]) => `<button type="button" class="${S.lang === k ? 'on' : ''}" data-ocr-lang="${k}">${l}</button>`).join('')}</div>
        <div class="ocr-btns"><label class="btn pri ocr-file">${ic('camera', 18)} Take a photo<input type="file" accept="image/*" capture="environment" data-ocr-file hidden></label><label class="btn ocr-file">Choose from photos<input type="file" accept="image/*" data-ocr-file hidden></label></div>
        <button class="btn lb-wide ghost" data-ocr-paste type="button">Or paste text instead</button></div>
        <p class="lb-foot">Tips: flat page, good light, fill the frame with the text. The first scan downloads the reader (a few MB), after that it works offline.</p>`;
    } else if (S.mode === 'work') {
      h = `<h2 class="lb-title">Reading the page…</h2>${S.img ? `<img class="ocr-prev" src="${S.img}" alt="">` : ''}<div class="lb-card"><div class="ocr-st">${esc(S.status || 'Starting')}</div><div class="rx-bar lb-bar"><i style="width:${Math.round((S.pct || 0) * 100)}%"></i></div></div>`;
    } else if (S.mode === 'text') {
      h = `<h2 class="lb-title">Check the text</h2><p class="muted lb-p">Fix any mistakes, delete what you don't need, then make cards.${S.conf != null ? ` Reader confidence ${Math.round(S.conf)}%.` : ''}</p>
        <textarea class="ocr-text" data-ocr-text rows="12" placeholder="Paste or type text here">${esc(S.text)}</textarea>
        <div class="lb-btns"><button class="btn" data-ocr-again type="button">New photo</button><button class="btn pri" data-ocr-make type="button">Make cards</button></div>`;
    } else if (S.mode === 'cards') {
      const n = S.cards.filter(c => c.on).length;
      const ds = typeof decks === 'function' ? decks() : [];
      h = `<h2 class="lb-title">${S.cards.length} card ideas</h2><p class="muted lb-p">Untick the ones you don't want and edit the rest. Cloze cards hide the part in {{c1::double braces}}.</p>
        <label class="f">Save to deck</label><select data-ocr-deck><option value="__new">＋ New deck: Snapped pages</option>${ds.map(d => `<option value="${esc(d.id)}" ${S.deck === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <div class="ocr-list">${S.cards.map((c, i) => `<div class="lb-card ocr-c${c.on ? '' : ' off'}"><div class="ocr-ch"><label class="ocr-tick"><input type="checkbox" data-ocr-on="${i}" ${c.on ? 'checked' : ''}> Keep</label><div class="pseg sm">${[['basic', 'Q / A'], ['cloze', 'Cloze']].map(([k, l]) => `<button type="button" class="${c.type === k ? 'on' : ''}" data-ocr-type="${i}" data-t="${k}">${l}</button>`).join('')}</div></div>
          <textarea data-ocr-f="${i}" rows="${c.type === 'cloze' ? 3 : 2}" placeholder="${c.type === 'cloze' ? 'Text with {{c1::hidden part}}' : 'Question'}">${esc(c.f)}</textarea>
          ${c.type === 'basic' ? `<textarea data-ocr-b="${i}" rows="2" placeholder="Answer">${esc(c.b)}</textarea>` : ''}
          ${c.type === 'cloze' && !/\{\{c\d+::/.test(c.f) ? '<div class="ocr-warn">Mark the hidden part with {{c1::…}}</div>' : ''}</div>`).join('')}</div>
        <div class="lb-btns sticky"><button class="btn" data-ocr-backtext type="button">Back to text</button><button class="btn pri" data-ocr-save type="button" ${n ? '' : 'disabled'}>Save ${n} card${n === 1 ? '' : 's'}</button></div>`;
    } else if (S.mode === 'saved') {
      h = `<div class="lb-card sim-res"><div class="sim-verd ok">${ic('check', 18)} Saved ${S.saved} card${S.saved === 1 ? '' : 's'}</div><div class="muted small">in ${esc(S.deckName || '')}</div></div><div class="lb-btns"><button class="btn" data-ocr-again type="button">Snap another page</button><button class="btn pri" data-ocr-study type="button">Study them</button></div>`;
    }
    S.el.innerHTML = `<div class="lb ocr">${back}${h}</div>`;
  }
  function loadTess() { return tessP || (tessP = new Promise((res, rej) => { if (window.Tesseract) return res(); const s = document.createElement('script'); s.src = 'vendor/tess/tesseract.min.js'; s.onload = res; s.onerror = () => { tessP = null; rej(new Error('Could not load the text reader')); }; document.head.appendChild(s); })); }
  async function getWorker(lang) {
    await loadTess();
    if (worker && workerLang === lang) return worker;
    if (worker) { try { await worker.terminate(); } catch (e) {} worker = null; }
    worker = await Tesseract.createWorker(lang, 1, {
      workerPath: abs('vendor/tess/worker.min.js'), corePath: abs('vendor/tess/tesseract-core-' + (simd() ? 'simd-' : '') + 'lstm.js'), langPath: abs('vendor/tess/lang'), workerBlobURL: false, gzip: true,
      logger: m => { if (!S || S.mode !== 'work') return; S.status = { 'loading tesseract core': 'Loading the reader', 'initializing tesseract': 'Starting up', 'loading language traineddata': 'Loading language data', 'initializing api': 'Getting ready', 'recognizing text': 'Reading the text' }[m.status] || m.status; S.pct = m.progress || 0; const st = S.el.querySelector('.ocr-st'), b = S.el.querySelector('.lb-bar i'); if (st) st.textContent = S.status + (m.progress ? ' ' + Math.round(m.progress * 100) + '%' : ''); if (b) b.style.width = Math.round((m.progress || 0) * 100) + '%'; }
    });
    workerLang = lang; return worker;
  }
  // downscale big phone photos (12 MP) so OCR is fast and memory-safe; keep enough resolution for small print
  function prep(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file), im = new Image();
      im.onload = () => { const max = 2200, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('That image could not be opened')); };
      im.src = u;
    });
  }
  async function run(file) {
    S.mode = 'work'; S.status = 'Preparing the photo'; S.pct = 0; S.img = null; paint();
    try {
      const c = await prep(file); S.img = c.toDataURL('image/jpeg', .5); paint();
      const w = await getWorker(S.lang);
      const r = await w.recognize(c);
      S.text = clean(r.data.text || ''); S.conf = r.data.confidence;
      S.mode = 'text'; paint();
      if (!S.text.trim()) toast('No text found. Try a sharper, flatter photo.', 3200);
      try { if (window.Hub) Hub.award('photo'); } catch (e) {}
    } catch (e) { console.warn(e); S.mode = 'pick'; paint(); toast((e && e.message) || 'Could not read that photo', 3200); }
  }
  function clean(t) {
    return String(t).replace(/\r/g, '').replace(/(\w)-\n(\w)/g, '$1$2').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\u0000').replace(/\n/g, ' ').replace(/\u0000/g, '\n\n').replace(/ +([,.;:!?])/g, '$1').trim();
  }
  /* ---------- sentences → cards ---------- */
  const STOP = new Set('the a an and or but of to in on at by for with from as is are was were be been being this that these those it its into than then also which who whom whose when where what why how not no can may might will would should could has have had do does did such other more most some any each many much very their there they them he she his her our your we you i about between during after before over under up out so if because while through both either neither only same own just one two three der die das und oder ein eine ist sind war des den dem zu mit von im le la les un une et ou est sont des du de en el los las y o es son del al'.split(' '));
  const PRON = /^(it|this|that|these|those|they|he|she|there|here|which|what|es|dies|das|er|sie|il|elle|ce|cela|ils|elles|esto|eso|él|ella|ellos)$/i;
  const DEF = {
    eng: /^((?:the|an?)\s+)?(.{3,60}?)\s+(is|are|was|were|refers to|means|is called|are called|is defined as|is known as|are known as)\s+(.{6,})$/i,
    deu: /^((?:der|die|das|ein|eine)\s+)?(.{3,60}?)\s+(ist|sind|bezeichnet|heißt|nennt man)\s+(.{6,})$/i,
    fra: /^((?:le|la|les|l'|un|une)\s*)?(.{3,60}?)\s+(est|sont|désigne|signifie)\s+(.{6,})$/i,
    spa: /^((?:el|la|los|las|un|una)\s+)?(.{3,60}?)\s+(es|son|significa|se llama|se denomina)\s+(.{6,})$/i
  };
  const QW = { eng: ['What is', 'What are'], deu: ['Was ist', 'Was sind'], fra: ["Qu'est-ce que", "Que sont"], spa: ['¿Qué es', '¿Qué son'] };
  function sentences(t) { return t.split(/\n{2,}/).flatMap(p => p.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-ZÄÖÜÀ-ÝÉ¿¡0-9"“(])/)).map(s => s.trim()).filter(s => s.length >= 25 && s.length <= 260 && /[a-zà-ÿ]{3}/i.test(s) && (s.match(/[A-Za-zÀ-ÿ]/g) || []).length / s.length > 0.6); }
  function keyTerm(s, avoid) {
    const words = s.replace(/[“”"()\[\]]/g, ' ').split(/\s+/).map(w => w.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ%]+$/g, '')).filter(Boolean);
    // prefer a number+unit or a multiword capitalised term not at the start, else the longest uncommon word
    const num = s.match(/\b\d+(?:[.,]\d+)?\s?(?:%|percent|°C|years?|days?|hours?|minutes?|mmol\/L|cm|mm|kg|million|billion)\b/i); if (num) return num[0];
    const caps = [...s.matchAll(/(?:^|\s)((?:[A-ZÄÖÜ][\wÀ-ÿ-]+)(?:\s+[A-ZÄÖÜ][\wÀ-ÿ-]+){0,3})/g)].map(m => m[1]).filter((c, i) => (i > 0 || s.indexOf(c) > 0) && !STOP.has(c.toLowerCase()) && c.length > 3 && c !== avoid);
    if (caps.length) return caps.sort((a, b) => b.length - a.length)[0];
    const cand = words.filter(w => w.length >= 6 && !STOP.has(w.toLowerCase()) && w !== avoid).sort((a, b) => b.length - a.length);
    return cand[0] || null;
  }
  function makeCards(text, lang) {
    const out = [], seen = new Set();
    for (const s0 of sentences(text)) {
      const s = s0.replace(/\s+/g, ' ');
      if (seen.has(s)) continue; seen.add(s);
      const m0 = (DEF[lang] || DEF.eng).exec(s.replace(/[.!?]$/, ''));
      const m = m0 && [m0[0], m0[2], m0[3], m0[4]], art = m0 && m0[1] ? m0[1].toLowerCase() : '';
      if (m && !PRON.test(m[1].trim()) && m[1].split(' ').length <= 6 && !/\d{3,}/.test(m[1])) {
        const subj = m[1].trim(), plural = /^(are|were|sind|sont|son)$/i.test(m[2]);
        const qw = QW[lang] || QW.eng; let q = `${plural ? qw[1] : qw[0]} ${/^(the |der |die |das |le |la |les |l'|el |la |los |las )/i.test(art) ? art : ''}${subj}?`;
        if (/called|known as|heißt|nennt|se llama|se denomina/i.test(m[2])) q = (lang === 'deu' ? 'Wie heißt: ' : lang === 'fra' ? 'Comment appelle-t-on : ' : lang === 'spa' ? '¿Cómo se llama: ' : 'What is the name for: ') + m[3].replace(/[.!?]$/, '') + '?';
        const a = /called|known as|heißt|nennt|se llama|se denomina/i.test(m[2]) ? subj : m[3].replace(/[.!?]$/, '');
        out.push({ type: 'basic', f: q.replace(/\?\?$/, '?'), b: a.charAt(0).toUpperCase() + a.slice(1), on: true });
        // and a cloze on the same fact
        const k = /called|known as/i.test(m[2]) ? null : keyTerm(m[3], subj);
        if (k && out.length < 60) out.push({ type: 'cloze', f: s.replace(subj, '{{c1::' + subj + '}}'), b: '', on: false });
        continue;
      }
      const k = keyTerm(s); if (!k) continue;
      const i = s.indexOf(k); if (i < 0) continue;
      out.push({ type: 'cloze', f: s.slice(0, i) + '{{c1::' + k + '}}' + s.slice(i + k.length), b: '', on: true });
      if (out.length >= 60) break;
    }
    return out;
  }
  async function save() {
    const list = []; let deck = S.deck || '__new';
    if (deck === '__new') deck = findOrMakeDeck('Snapped pages', list);
    let n = 0; const base = Date.now();
    for (const c of S.cards) {
      if (!c.on) continue; const f = (c.f || '').trim(), b = (c.b || '').trim(); if (!f) continue;
      const type = c.type === 'cloze' && /\{\{c\d+::/.test(f) ? 'cloze' : 'basic'; if (type === 'basic' && !b) continue;
      const note = { id: 'n-' + rid(), created: base + n, deck, type, front: textToHtml(f), back: textToHtml(b), tags: ['snap'], img: null, imgSide: 'back', imgCredit: null };
      M.notes.set(note.id, note); list.push(['notes', note], ...cardsForNote(note, base + n * 3)); n++;
    }
    if (!n) { toast('Nothing to save: each Q/A card needs an answer, each cloze needs {{c1::…}}', 3500); return; }
    await write(list);
    S.saved = n; S.deckId = deck; S.deckName = (M.decks.get(deck) || {}).name || 'Snapped pages'; S.mode = 'saved'; paint();
    try { if (window.Hub) Hub.award('photo', 2 * n); } catch (e) {}
  }
  function onChange(e) {
    const f = e.target.closest('[data-ocr-file]'); if (f && f.files && f.files[0]) { run(f.files[0]); f.value = ''; return; }
    const d = e.target.closest('[data-ocr-deck]'); if (d) { S.deck = d.value; return; }
    const o = e.target.closest('[data-ocr-on]'); if (o) { S.cards[+o.dataset.ocrOn].on = o.checked; paint(); return; }
  }
  function onInput(e) {
    const t = e.target;
    if (t.matches('[data-ocr-text]')) S.text = t.value;
    else if (t.matches('[data-ocr-f]')) S.cards[+t.dataset.ocrF].f = t.value;
    else if (t.matches('[data-ocr-b]')) S.cards[+t.dataset.ocrB].b = t.value;
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const l = t.closest('[data-ocr-lang]'); if (l) { S.lang = l.dataset.ocrLang; try { localStorage.setItem('ocr.lang', S.lang); } catch (x) {} paint(); return; }
    if (t.closest('[data-ocr-paste]')) { S.text = ''; S.conf = null; S.mode = 'text'; paint(); const ta = S.el.querySelector('textarea'); if (ta) ta.focus(); return; }
    if (t.closest('[data-ocr-again]')) { S.mode = 'pick'; paint(); return; }
    if (t.closest('[data-ocr-make]')) { S.cards = makeCards(S.text, S.lang); if (!S.cards.length) { toast('No full sentences found. Add some text or fix the reading.', 3000); return; } S.mode = 'cards'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-ocr-backtext]')) { S.mode = 'text'; paint(); return; }
    const ty = t.closest('[data-ocr-type]'); if (ty) { const c = S.cards[+ty.dataset.ocrType], k = ty.dataset.t; if (c.type !== k) { if (k === 'cloze' && !/\{\{c\d+::/.test(c.f)) { const src = c.b && c.f ? c.b : c.f; const kt = keyTerm(src); c.f = kt ? src.replace(kt, '{{c1::' + kt + '}}') : src; c.b = ''; } else if (k === 'basic' && /\{\{c\d+::/.test(c.f)) { const m = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/.exec(c.f); c.b = m ? m[1] : ''; c.f = c.f.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '____'); } c.type = k; } paint(); return; }
    if (t.closest('[data-ocr-save]')) { save(); return; }
    if (t.closest('[data-ocr-study]')) { try { meta.studyScope = S.deckId; } catch (x) {} go('decks'); return; }
  }
  window.LabMods.ocr = { render, makeCards, clean, _S: () => S };
})();
