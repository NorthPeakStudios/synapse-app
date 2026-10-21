/* Deck Library: free shared Anki decks, hosted in the app's own database, added on demand.
   A library deck becomes an ordinary deck (record carries `lib`); its notes and cards are installed
   locally and never uploaded — other devices on the same sync code re-fetch the content from the
   library when the deck record arrives, while study progress (cards, review log) syncs as usual. */
'use strict';
(function () {
  const S = { index: null, indexAt: 0, q: '', topic: '', busy: {}, err: null, storage: null, open: null };
  const TOPICS = ['Medicine', 'Pharmacology', 'Neurology', 'Medicinal Chemistry'];
  const deckIdFor = lib => 'lib:' + lib;
  const fmtMB = b => !b ? '0 KB' : b < 900e3 ? Math.max(1, Math.round(b / 1e3)) + ' KB' : (b / 1e6).toFixed(b < 10e6 ? 1 : 0) + ' MB';
  const fmtN = n => (n || 0).toLocaleString();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function getIndex(force) {
    if (S.index && !force && Date.now() - S.indexAt < 120e3) return S.index;
    const r = await fetch('/api/lib/index?t=' + Math.floor(Date.now() / 60e3), { cache: 'no-cache' });
    if (!r.ok) throw new Error('library unavailable');
    const j = await r.json(); S.index = paidFilter(j.decks || []); S.indexAt = Date.now();
    try { localStorage.setItem('libIndex', JSON.stringify(S.index)); } catch {}
    return S.index;
  }
  function cachedIndex() { if (S.index) return S.index; try { const c = JSON.parse(localStorage.getItem('libIndex') || 'null'); S.index = c ? paidFilter(c) : c; } catch {} return S.index; }
  // a paid build (web-sale mode on the website; the store build filters in native/boot.js) only lists decks we may sell:
  // source.sellable: true, or an open licence. The free website and sideload builds list everything.
  const sellable = d => { const s = d.source || {}, l = s.license || ''; return s.sellable === true || (/\b(CC0|CC[ -]BY|creative commons|public domain|MIT|Apache|GPL)\b/i.test(l) && !/no licen[cs]e stated/i.test(l)); };
  const ownerCopy = () => { try { if (window.Pro && Pro.owner) return Pro.owner(); return localStorage.getItem('pro.owner') === '1'; } catch (e) { return false; } };
  const paidFilter = list => ((window.Pro && Pro.on && Pro.web) || window.ODIN_STORE) && !ownerCopy() ? list.filter(sellable) : list;
  const installed = lib => { const d = M.decks.get(deckIdFor(lib)); return d && !d.del ? d : null; };
  const noteCount = deckId => { let n = 0; for (const x of M.notes.values()) if (x.deck === deckId && !x.del) n++; return n; };

  async function fetchDeck(meta, onProgress) {
    const notes = [];
    for (let n = 0; n < meta.chunks; n++) {
      onProgress && onProgress(n, meta.chunks);
      let r; for (let a = 0; a < 3; a++) { try { r = await fetch(`/api/lib/deck/${meta.id}/${n}?v=${encodeURIComponent(meta.ver)}`); if (r.ok) break; } catch (e) { r = null; } await new Promise(s => setTimeout(s, 600 * (a + 1))); }
      if (!r || !r.ok) throw new Error('download failed');
      const part = await r.json(); for (const x of part) notes.push(x);
    }
    onProgress && onProgress(meta.chunks, meta.chunks);
    return notes;
  }
  // write notes + cards for a library deck. existing cards keep their scheduling (they may have synced in first).
  async function install(meta, notes, onProgress) {
    const deckId = deckIdFor(meta.id), t0 = Date.now(); let i = 0;
    const batch = [];
    const flush = async () => { if (batch.length) { await write(batch.splice(0), { clean: true, keepMod: true }); } };
    for (const x of notes) {
      i++;
      const note = { id: x.i, deck: deckId, type: x.t, front: x.f, back: x.b || '', tags: x.g || [], lib: meta.id, created: t0 + i, mod: 1 };
      M.notes.set(note.id, note); batch.push(['notes', note]);
      ordsFor(note).forEach((o, k) => { const id = note.id + '~' + o; const ex = M.cards.get(id); if (ex && !ex.del) return; batch.push(['cards', { id, nid: note.id, deck: deckId, ord: o, st: 0, due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0, step: 0, pos: 50000 + i * 3 + k, susp: x.s ? 1 : 0, mod: 1 }]); });
      if (batch.length >= 1500) { await flush(); onProgress && onProgress(i, notes.length); await new Promise(r => setTimeout(r)); }
    }
    await flush();
  }
  async function add(lib) {
    const idx = cachedIndex() || await getIndex(); const meta = idx.find(d => d.id === lib); if (!meta) { toast('That deck is not in the library'); return; }
    if (S.busy[lib]) return;
    if (!navigator.onLine) { toast('You are offline. Decks download when you are back online.'); return; }
    S.busy[lib] = { pct: 0, msg: 'Starting…' }; renderIfOpen();
    try {
      const notes = await fetchDeck(meta, (n, t) => { S.busy[lib] = { pct: Math.round(60 * n / t), msg: `Downloading ${n}/${t}` }; renderIfOpen(); });
      S.busy[lib] = { pct: 60, msg: 'Saving…' }; renderIfOpen();
      const ex = M.decks.get(deckIdFor(lib));
      const rec = { ...(ex || { id: deckIdFor(lib) }), name: meta.name, lib: lib, libVer: meta.ver, del: 0 };
      await write([['decks', rec]]); // synced: other devices learn the deck exists and fetch content themselves
      await install(meta, notes, (n, t) => { S.busy[lib] = { pct: 60 + Math.round(40 * n / t), msg: `Saving ${fmtN(n)}/${fmtN(t)}` }; renderIfOpen(); });
      delete S.busy[lib]; changed(); renderIfOpen(); refreshStorage();
      toast(`Added ${meta.name}`);
    } catch (e) { delete S.busy[lib]; S.err = String(e.message || e); renderIfOpen(); toast('Download failed. Try again.'); }
  }
  async function remove(lib, quiet) {
    const deckId = deckIdFor(lib), d = M.decks.get(deckId);
    if (!d) return;
    if (!quiet && !confirm(`Remove "${d.name}" from your decks? Your progress on it is cleared. You can add it again any time.`)) return;
    S.busy[lib] = { pct: 100, msg: 'Removing…' }; renderIfOpen();
    try {
      await write([['decks', { ...d, del: 1 }]]); // synced tombstone; the content itself is dropped locally only
      await dropContent(deckId);
    } finally { delete S.busy[lib]; }
    changed(); renderIfOpen(); refreshStorage(); if (!quiet) toast('Deck removed');
  }
  async function dropContent(deckId) {
    const nids = [], cids = [];
    for (const n of M.notes.values()) if (n.deck === deckId) nids.push(n.id);
    for (const c of M.cards.values()) if (c.deck === deckId) cids.push(c.id);
    for (let k = 0; k < Math.max(nids.length, cids.length); k += 3000) {
      const t = idb.transaction(['notes', 'cards', 'dirty'], 'readwrite');
      for (const id of nids.slice(k, k + 3000)) { M.notes.delete(id); t.objectStore('notes').delete(id); t.objectStore('dirty').delete('n:' + id); }
      for (const id of cids.slice(k, k + 3000)) { M.cards.delete(id); t.objectStore('cards').delete(id); t.objectStore('dirty').delete('c:' + id); }
      await txDone(t);
    }
  }
  // after a sync: install content for library decks that arrived from another device, drop content for ones removed there.
  let reconciling = false;
  async function afterSync() {
    if (reconciling) return; reconciling = true;
    try {
      for (const d of M.decks.values()) {
        if (!d.lib) continue;
        if (d.del) { if (noteCount(d.id) > 0) await dropContent(d.id); continue; }
        if (noteCount(d.id) > 0 || S.busy[d.lib] || !navigator.onLine) continue;
        let idx; try { idx = await getIndex(); } catch { break; }
        const meta = idx.find(x => x.id === d.lib); if (!meta) continue;
        S.busy[d.lib] = { pct: 0, msg: 'Downloading…' }; toast(`Downloading “${meta.name}” from the library…`, 3000);
        try {
          const notes = await fetchDeck(meta, (n, t) => { S.busy[d.lib] = { pct: Math.round(60 * n / t), msg: `Downloading ${n}/${t}` }; renderIfOpen(); });
          await install(meta, notes, (n, t) => { S.busy[d.lib] = { pct: 60 + Math.round(40 * n / t), msg: `Saving ${fmtN(n)}/${fmtN(t)}` }; renderIfOpen(); });
          delete S.busy[d.lib]; changed(); toast(`“${meta.name}” is ready`);
        } catch (e) { delete S.busy[d.lib]; }
        renderIfOpen();
      }
    } finally { reconciling = false; }
  }
  async function refreshStorage() {
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); S.storage = e; if (view === 'library') { const el = document.getElementById('libStorage'); if (el) el.innerHTML = storageHTML(); } } } catch {}
  }
  function storageHTML() {
    const libDecks = [...M.decks.values()].filter(d => d.lib && !d.del);
    const idx = cachedIndex() || [];
    let est = 0; for (const d of libDecks) { const m = idx.find(x => x.id === d.lib); if (m) est += m.bytes || 0; }
    const e = S.storage;
    return `<span>${libDecks.length} library deck${libDecks.length === 1 ? '' : 's'} on this device · about ${fmtMB(est)} of card data${e && e.usage ? ` · app storage ${fmtMB(e.usage)}${e.quota ? ` of ${fmtMB(e.quota)} available` : ''}` : ''}</span>`;
  }
  function renderIfOpen() { if (view === 'library') render(); }
  const libSort = a => { const s = window.Settings ? Settings.get('lib.sort') : 'popular';
    if (s === 'az') return a.slice().sort((x, y) => String(x.name || x.title || '').localeCompare(String(y.name || y.title || '')));
    if (s === 'cards') return a.slice().sort((x, y) => (y.cards || 0) - (x.cards || 0));
    return a; };
  function deckRow(m) {
    const inst = installed(m.id), busy = S.busy[m.id];
    const src = m.source || {};
    const btn = busy ? `<div class="lib-prog"><div class="bar"><i style="width:${busy.pct}%"></i></div><span>${esc(busy.msg)}</span></div>`
      : inst ? `<div class="lib-actions"><button class="btn small" data-study="${esc(inst.id)}">Study</button><button class="btn small" data-libremove="${esc(m.id)}">Remove</button></div>`
      : `<button class="btn pri small" data-libadd="${esc(m.id)}">Add to my decks</button>`;
    return `<div class="lib-deck${inst && !busy ? ' on' : ''}" data-lib="${esc(m.id)}">
      <button class="lib-main" data-libopen="${esc(m.id)}" aria-label="About ${esc(m.name)}">
        <div class="lib-name">${esc(m.name)}${inst ? ' <span class="chip">added</span>' : ''}</div>
        <div class="lib-sub">${esc(m.topic)} · ${fmtN(m.cards)} cards · ${fmtMB(m.bytes || 0)}${m.images ? ' · images' : ''}</div>
        <div class="lib-src">${esc(src.title || '')}${src.author ? ' · ' + esc(src.author) : ''}</div>
      </button>${btn}</div>`;
  }
  function render() { // Resources hook: the Library's top switch (Decks | Textbooks | Videos | PDFs | Games | Courses & tools) lives in resources.js
    const el = document.getElementById('v-library'); if (!el) return;
    if (window.Resources && Resources.mode() !== 'decks') { Resources.render(el); return; }
    renderDecks(); if (window.Resources) Resources.decorate(el);
  }
  function renderDecks() {
    const el = document.getElementById('v-library'); if (!el) return;
    const idx = cachedIndex();
    if (!idx) {
      el.innerHTML = `<div class="lib-head"><p class="muted">Free shared Anki decks for your topics, ready to add.</p></div><div class="empty">${S.err ? 'The library could not be loaded. ' + esc(S.err) : 'Loading the library…'}</div>`;
      getIndex().then(render, e => { S.err = e.message; render(); }); return;
    }
    if (!idx.length) { el.innerHTML = '<div class="lib-head"><p class="muted">Ready-made decks you can add with one tap.</p></div><div class="empty">New decks are on the way. Until then, the free textbooks, videos and courses in the tabs above, the Learn courses and your own decks have you covered.<div style="margin-top:14px"><button type="button" class="btn" data-rsmode="textbook">Browse free textbooks</button></div></div>'; return; }
    const q = S.q.trim().toLowerCase();
    const list = idx.filter(m => (!S.topic || m.topic === S.topic) && (!q || (m.name + ' ' + m.topic + ' ' + (m.desc || '') + ' ' + ((m.source || {}).title || '')).toLowerCase().includes(q)));
    const byTopic = {}; for (const m of list) (byTopic[m.topic] = byTopic[m.topic] || []).push(m);
    const topics = [...TOPICS.filter(t => idx.some(m => m.topic === t)), ...[...new Set(idx.map(m => m.topic))].filter(t => !TOPICS.includes(t))];
    const totalCards = idx.reduce((a, m) => a + (m.cards || 0), 0);
    el.innerHTML = `
      <div class="lib-head">
        <p class="muted">${idx.length} free deck${idx.length === 1 ? '' : 's'} · ${fmtN(totalCards)} cards. Tap a deck to add it; it downloads to this device and shows up in Decks. Your other devices fetch it from the library when they sync.</p>
        <input type="search" id="libQ" placeholder="Search decks" value="${esc(S.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Search the library">
        <div class="lib-topics"><button class="chipbtn${!S.topic ? ' on' : ''}" data-libtopic="">All</button>${topics.map(t => `<button class="chipbtn${S.topic === t ? ' on' : ''}" data-libtopic="${esc(t)}">${esc(t)} <small>${idx.filter(m => m.topic === t).length}</small></button>`).join('')}</div>
        <div class="muted small" id="libStorage">${storageHTML()}</div>
      </div>
      ${list.length ? Object.keys(byTopic).sort((a, b) => topics.indexOf(a) - topics.indexOf(b)).map(t => `<h3 class="lib-topic">${esc(t)}</h3><div class="lib-list">${libSort(byTopic[t]).map(deckRow).join('')}</div>`).join('') : '<div class="empty">No decks match.</div>'}
      <p class="muted small lib-foot">Every deck here was shared freely by its author on AnkiWeb (links in each deck's details). Audio was removed and images shrunk to keep downloads small.</p>`;
    const qEl = document.getElementById('libQ');
    qEl.oninput = () => { S.q = qEl.value; const keep = qEl.selectionStart; render(); const n = document.getElementById('libQ'); if (n) { n.focus(); try { n.setSelectionRange(keep, keep); } catch {} } };
    if (!S.storage) refreshStorage();
    getIndex().then(j => { if (j !== idx) render(); }, () => {});
  }
  function openInfo(lib) {
    const idx = cachedIndex() || []; const m = idx.find(x => x.id === lib); if (!m) return;
    const s = m.source || {}, inst = installed(lib);
    openSheet(`<h2>${esc(m.name)}</h2>
      <p class="muted">${esc(m.topic)} · ${fmtN(m.notes)} notes, ${fmtN(m.cards)} cards · ${fmtMB(m.bytes || 0)} download</p>
      ${m.desc ? `<p>${esc(m.desc)}</p>` : ''}
      <p class="small"><b>Source:</b> ${esc(s.title || '')}${s.author ? ' by ' + esc(s.author) : ''}${s.url ? ` · <a href="${esc(s.url)}" target="_blank" rel="noopener">AnkiWeb page</a>` : ''}</p>
      ${s.license ? `<p class="small muted">${esc(s.license)}</p>` : ''}
      ${m.tagsNote ? `<p class="small muted">Tags: ${esc(m.tagsNote)}</p>` : ''}
      <div class="actions"><button type="button" class="btn" data-close>Close</button>${inst ? `<button type="button" class="btn danger" data-libremove="${esc(lib)}" data-close>Remove</button>` : `<button type="button" class="btn pri" data-libadd="${esc(lib)}" data-close>Add to my decks</button>`}</div>`);
  }
  function homeHTML() {
    const libDecks = [...M.decks.values()].filter(d => d.lib && !d.del).length;
    return `<div class="lib-home"><button class="btn grow" data-go="library">📚 Deck Library${libDecks ? ` · ${libDecks} added` : ' · free Anki decks'}</button></div>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-libadd],[data-libremove],[data-libopen],[data-libtopic]'); if (!t) return;
    if (t.dataset.libadd != null) { e.stopPropagation(); add(t.dataset.libadd); return; }
    if (t.dataset.libremove != null) { e.stopPropagation(); remove(t.dataset.libremove); return; }
    if (t.dataset.libopen != null) { openInfo(t.dataset.libopen); return; }
    if (t.dataset.libtopic != null) { S.topic = t.dataset.libtopic; render(); }
  }, true);
  function onChange() { if (view === 'library') render(); }
  window.Library = { render, homeHTML, onChange, afterSync, add, remove, getIndex, _S: S };
})();
