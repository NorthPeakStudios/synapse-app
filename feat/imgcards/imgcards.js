/* Image cards (v57): find a freely licensed picture on Wikimedia Commons for a flashcard, with attribution.
   window.ImgCards = { picker(query, onPick(dataUrl, credit)), deckPass(deckId), credit(r) }. Server: /api/img/search, /api/img/get (worker.js).
   Uses app.js globals: openSheet, closeSheet, shrinkImage, write, M, toast, esc, stripHtml. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = h => { try { return stripHtml(h); } catch (e) { return String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); } };
  const cache = new Map();
  async function search(q) {
    q = String(q || '').replace(/\{\{c\d+::([^}:]*)(::[^}]*)?\}\}/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!q) return [];
    if (cache.has(q)) return cache.get(q);
    const r = await fetch('/api/img/search?q=' + encodeURIComponent(q));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || 'search');
    cache.set(q, j.results || []); return j.results || [];
  }
  const thumbSrc = r => '/api/img/get?u=' + encodeURIComponent(r.thumb);
  const credit = r => `Image: ${r.author}, ${r.license}, Wikimedia Commons`;
  async function fetchData(r) {
    const res = await fetch(thumbSrc(r)); if (!res.ok) throw new Error('img');
    const blob = await res.blob();
    return shrinkImage(blob, 640, 110000); // ~80 KB jpeg as a data: URL, stored in the note so it syncs
  }
  function grid(results) {
    if (!results.length) return '<div class="ic-empty">No pictures found. Try a simpler word.</div>';
    return `<div class="ic-grid">${results.map((r, i) => `<button type="button" class="ic-cell" data-ic="${i}" aria-label="${E(r.title)}"><img src="${E(thumbSrc(r))}" alt="" loading="lazy" decoding="async"><span class="ic-lic">${E(r.license)}</span></button>`).join('')}</div>`;
  }
  /* ---- picker sheet ---- */
  function picker(query, onPick) {
    openSheet(`<div class="ic"><div class="ic-head"><h2>Find an image</h2><button type="button" class="ic-x" data-close aria-label="Close">✕</button></div>
      <form class="ic-q" id="icForm" autocomplete="off"><input type="search" id="icQ" value="${E(plain(query).slice(0, 80))}" placeholder="Search free pictures" enterkeyhint="search" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Search pictures"><button class="btn pri" type="submit">Search</button></form>
      <div id="icRes" class="ic-res"></div>
      <p class="ic-foot">Free pictures from Wikimedia Commons. The author and license are saved with the card.</p></div>`);
    let results = [];
    const run = async () => {
      const q = $('#icQ').value, box = $('#icRes'); if (!box) return;
      if (!q.trim()) { box.innerHTML = '<div class="ic-empty">Type a word to search.</div>'; return; }
      box.innerHTML = '<div class="ic-empty"><span class="ic-spin"></span> Searching…</div>';
      try { results = await search(q); if ($('#icRes') === box) box.innerHTML = grid(results); }
      catch (e) { if ($('#icRes') === box) box.innerHTML = '<div class="ic-empty">Couldn’t search right now. Check your connection and try again.</div>'; }
    };
    $('#icForm').onsubmit = e => { e.preventDefault(); $('#icQ').blur(); run(); };
    $('#icRes').onclick = async e => {
      const c = e.target.closest('[data-ic]'); if (!c) return; const r = results[+c.dataset.ic]; if (!r) return;
      c.classList.add('busy');
      try { const data = await fetchData(r); closeSheet(); onPick(data, credit(r), r); }
      catch (er) { c.classList.remove('busy'); toast('That picture didn’t load. Try another.'); }
    };
    run();
  }
  /* ---- "Add pictures" pass over a deck: one suggestion screen per card, he approves each ---- */
  const LANG = /german|deutsch|french|fran[cç]ais|spanish|espa[nñ]ol|russian|japanese|italian|latin|goethe/i;
  function candidates(deckId) {
    const d = M.decks.get(deckId); const lang = d && LANG.test(d.name || '');
    const out = [];
    for (const n of M.notes.values()) {
      if (n.del || n.deck !== deckId || n.img || n.type === 'cloze') continue;
      const f = plain(n.front), b = plain(n.back);
      const q = (lang && b && b.length <= 40 ? b : f.length <= 40 ? f : b.length <= 40 ? b : '').replace(/^(the|a|an|der|die|das|le|la|les|el|los|las|un|une|ein|eine)\s+/i, '').replace(/\(.*?\)|[;,/].*$/g, '').trim();
      if (q && q.length >= 2) out.push({ n, q, f });
    }
    return out;
  }
  function deckPass(deckId) {
    const list = candidates(deckId), d = M.decks.get(deckId);
    if (!list.length) { toast('Every card here already has a picture, or none are short enough'); return; }
    let i = 0, added = 0, results = [];
    const paint = async () => {
      if (i >= list.length) { closeSheet(); toast(added ? `Added ${added} picture${added === 1 ? '' : 's'}` : 'No pictures added'); return; }
      const it = list[i];
      openSheet(`<div class="ic"><div class="ic-head"><div><h2>Add pictures</h2><div class="ic-sub">${E(d ? d.name : '')} · ${i + 1} of ${list.length}${added ? ` · ${added} added` : ''}</div></div><button type="button" class="ic-x" id="icDone" aria-label="Done">Done</button></div>
        <div class="ic-card"><b>${E(it.f.slice(0, 80))}</b></div>
        <form class="ic-q" id="icForm" autocomplete="off"><input type="search" id="icQ" value="${E(it.q)}" enterkeyhint="search" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Search pictures"><button class="btn" type="submit">Search</button></form>
        <div id="icRes" class="ic-res"><div class="ic-empty"><span class="ic-spin"></span> Searching…</div></div>
        <div class="ic-acts"><button type="button" class="btn wide" id="icSkip">Skip this card</button></div>
        <p class="ic-foot">Tap a picture to add it. Free pictures from Wikimedia Commons, with the author and license saved on the card.</p></div>`);
      $('#icDone').onclick = () => { i = list.length; paint(); };
      $('#icSkip').onclick = () => { i++; paint(); };
      const run = async q => { const box = $('#icRes'); try { results = (await search(q)).slice(0, 9); if ($('#icRes') === box) box.innerHTML = grid(results); } catch (e) { if ($('#icRes') === box) box.innerHTML = '<div class="ic-empty">Couldn’t search right now. Skip or try again.</div>'; } };
      $('#icForm').onsubmit = e => { e.preventDefault(); $('#icQ').blur(); run($('#icQ').value); };
      $('#icRes').onclick = async e => {
        const c = e.target.closest('[data-ic]'); if (!c) return; const r = results[+c.dataset.ic]; if (!r) return; c.classList.add('busy');
        try { const data = await fetchData(r); const n = M.notes.get(it.n.id) || it.n; await write([['notes', { ...n, img: data, imgSide: n.imgSide || 'back', imgCredit: credit(r) }]]); added++; i++; paint(); }
        catch (er) { c.classList.remove('busy'); toast('That picture didn’t load. Try another.'); }
      };
      run(it.q);
    };
    paint();
  }
  // a thumbnail that fails to load is dropped from the grid (errors don't bubble, so listen in the capture phase)
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest && t.closest('.ic-cell')) t.closest('.ic-cell').remove(); }, true);
  window.ImgCards = { picker, deckPass, credit, search, _candidates: candidates };
})();
