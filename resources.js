/* Free Resources inside the Library: open textbooks, official free courses, creator-uploaded videos,
   PDFs, games and tools for each topic. Data is lazy-loaded from resources.json; nothing is downloaded
   into the app except that list. Videos with embedding allowed play in-app via youtube-nocookie. */
'use strict';
(function () {
  const SEGS = [['decks', 'Decks'], ['textbook', 'Textbooks'], ['video', 'Videos'], ['pdf', 'PDFs'], ['game', 'Games'], ['site', 'Courses & tools']];
  const TYPE_LABEL = { textbook: 'Textbook', video: 'Videos', pdf: 'PDF', game: 'Game', site: 'Course / tool' };
  const TYPE_IC = { textbook: '📖', video: '▶️', pdf: '📄', game: '🎮', site: '🧭' };
  const LS = k => { try { return localStorage.getItem('res.' + k) || ''; } catch { return ''; } };
  const LSset = (k, v) => { try { localStorage.setItem('res.' + k, v); } catch {} };
  const S = { mode: LS('mode') || 'decks', topic: LS('topic'), q: '', data: null, err: null, loading: null, open: {} };
  if (!SEGS.some(s => s[0] === S.mode)) S.mode = 'decks';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function load() {
    if (S.data || S.loading) return S.loading;
    S.loading = fetch('resources.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { S.data = j; S.err = null; S.loading = null; return j; }, e => { S.err = e.message || String(e); S.loading = null; throw e; });
    return S.loading;
  }
  function segHTML() {
    return `<div class="rs-segs" role="tablist" aria-label="Library sections">${SEGS.map(([k, l]) => `<button type="button" role="tab" aria-selected="${S.mode === k}" class="rs-seg${S.mode === k ? ' on' : ''}" data-rsmode="${k}">${l}</button>`).join('')}</div>`;
  }
  function segScroll(el) { const on = el.querySelector('.rs-seg.on'); if (on && on.parentNode) on.parentNode.scrollLeft = Math.max(0, on.offsetLeft - on.parentNode.offsetLeft - 24); }
  function decorate(el) { if (!el.querySelector('.rs-segs')) el.insertAdjacentHTML('afterbegin', segHTML()); segScroll(el); }
  function ytSrc(it) { return it.yt.startsWith('PL') ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(it.yt)}&rel=0&playsinline=1` : `https://www.youtube-nocookie.com/embed/${encodeURIComponent(it.yt)}?rel=0&playsinline=1`; }
  function item(it) {
    const canEmbed = it.yt && !it.noembed, open = !!S.open[it.id];
    return `<div class="rs-item${it.start ? ' start' : ''}" data-rsid="${esc(it.id)}">
      <div class="rs-top"><span class="rs-ic" aria-hidden="true">${TYPE_IC[it.type] || '•'}</span><div class="rs-txt">
        <div class="rs-name">${esc(it.title)}</div>
        <div class="rs-meta">${it.start ? '<span class="rs-start">★ Start here</span>' : ''}<span class="rs-lvl">${esc(it.level)}</span>${it.count ? `<span>${it.count} videos</span>` : ''}</div>
        <div class="rs-why">${esc(it.why)}</div>
        <div class="rs-src">${esc(it.source)} · ${esc(it.license)}</div>
      </div></div>
      ${open && canEmbed ? `<div class="rs-embed"><iframe src="${esc(ytSrc(it))}" title="${esc(it.title)}" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>` : ''}
      <div class="rs-actions">${canEmbed ? `<button type="button" class="btn small${open ? '' : ' pri'}" data-rswatch="${esc(it.id)}">${open ? 'Close player' : '▶ Watch here'}</button>` : ''}<a class="btn small${canEmbed ? '' : ' pri'}" href="${esc(it.url)}"${window.Settings && Settings.get('res.openIn') === 'app' && (navigator.standalone || matchMedia('(display-mode: standalone)').matches) ? '' : ' target="_blank"'} rel="noopener noreferrer">${it.type === 'pdf' && /\.pdf($|\?)/i.test(it.url) ? 'Open PDF ↗' : canEmbed ? 'YouTube ↗' : 'Open ↗'}</a></div>
    </div>`;
  }

  /* ---- built-in mini-game: Speed Match (pairs from your own basic cards) ---- */
  const G = { deck: LS('gdeck'), state: null };
  const txt = h => { try { return (new DOMParser().parseFromString(String(h || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch { return ''; } };
  const firstLine = h => txt(String(h || '').split(/<br\s*\/?>|<\/div>|<\/p>|\n/i).find(x => txt(x)) || '');
  function pairsFor(deckId) {
    const M = window.__cards && __cards.M; if (!M) return [];
    const out = [], seen = new Set();
    for (const n of M.notes.values()) {
      if (n.del || n.deck !== deckId || n.type !== 'basic') continue;
      const a = firstLine(n.front), b = firstLine(n.back);
      if (!a || !b || a.length > 60 || b.length > 60 || a === b || seen.has(a) || seen.has(b)) continue;
      seen.add(a); seen.add(b); out.push([a, b]);
    }
    return out;
  }
  function gameDecks() {
    const M = window.__cards && __cards.M; if (!M) return [];
    return [...M.decks.values()].filter(d => !d.del).map(d => ({ id: d.id, name: d.name, n: pairsFor(d.id).length })).filter(d => d.n >= 6).sort((a, b) => a.name.localeCompare(b.name));
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startGame(deckId) {
    const ps = shuffle(pairsFor(deckId)).slice(0, 6); if (ps.length < 6) return;
    const tiles = shuffle(ps.flatMap((p, i) => [{ k: i, t: p[0], side: 0 }, { k: i, t: p[1], side: 1 }])).map((x, i) => ({ ...x, id: i, done: false }));
    G.deck = deckId; LSset('gdeck', deckId);
    G.state = { tiles, sel: null, bad: [], t0: Date.now(), end: 0, miss: 0 };
    clearInterval(G.tick); G.tick = setInterval(() => { const el = document.getElementById('rsClock'); if (!G.state || G.state.end) { clearInterval(G.tick); return; } if (el) el.textContent = ((Date.now() - G.state.t0) / 1000).toFixed(1) + 's'; else clearInterval(G.tick); }, 100);
  }
  function gameCard() {
    const ds = gameDecks();
    if (!ds.length) return `<div class="rs-item rs-game"><div class="rs-name">🎮 Speed Match <span class="rs-lvl">built in</span></div><div class="rs-why">Match terms to answers against the clock, using your own decks. Add a deck with short cards (like drug name suffixes) to play.</div></div>`;
    const cur = ds.find(d => d.id === G.deck) || ds[0];
    const best = +LS('best.' + cur.id) || 0;
    return `<div class="rs-item rs-game"><div class="rs-name">🎮 Speed Match <span class="rs-lvl">built in</span></div>
      <div class="rs-why">6 pairs from your own cards. Tap a term, then its match. Beat your time.</div>
      <select id="rsGdeck" aria-label="Deck to play">${ds.map(d => `<option value="${esc(d.id)}"${d.id === cur.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
      <div class="rs-actions"><button type="button" class="btn small pri" data-rsplay="${esc(cur.id)}">Play</button></div>
      ${best ? `<div class="rs-src">Best on this deck: ${(best / 1000).toFixed(1)}s</div>` : ''}</div>`;
  }
  function gameHTML() {
    const g = G.state, left = g.tiles.filter(t => !t.done).length;
    if (g.end) {
      const ms = g.end - g.t0, key = 'best.' + G.deck, best = +LS(key) || 0, rec = !best || ms < best; if (rec) LSset(key, String(ms));
      return `<div class="rs-gameplay"><div class="rs-gdone"><div class="rs-big">${(ms / 1000).toFixed(1)}s</div><div>${rec ? '🏆 New best!' : 'Best: ' + (best / 1000).toFixed(1) + 's'} · ${g.miss} miss${g.miss === 1 ? '' : 'es'}</div></div>
        <div class="rs-actions"><button type="button" class="btn small pri" data-rsplay="${esc(G.deck)}">Play again</button><button type="button" class="btn small" data-rsquit>Done</button></div></div>`;
    }
    return `<div class="rs-gameplay"><div class="rs-ghead"><b id="rsClock">${((Date.now() - g.t0) / 1000).toFixed(1)}s</b><span class="muted small">${left / 2} pair${left === 2 ? '' : 's'} left</span><button type="button" class="btn small" data-rsquit>Quit</button></div>
      <div class="rs-grid">${g.tiles.map(t => `<button type="button" class="rs-tile${t.done ? ' done' : ''}${g.sel === t.id ? ' sel' : ''}${g.bad.includes(t.id) ? ' bad' : ''}" data-rstile="${t.id}"${t.done ? ' disabled' : ''}>${esc(t.t)}</button>`).join('')}</div></div>`;
  }
  function tap(id) {
    const g = G.state; if (!g || g.end) return; const t = g.tiles[id]; if (!t || t.done) return;
    g.bad = [];
    if (g.sel == null || g.sel === id) { g.sel = g.sel === id ? null : id; }
    else { const a = g.tiles[g.sel]; if (a.k === t.k && a.side !== t.side) { a.done = t.done = true; } else { g.miss++; g.bad = [a.id, t.id]; } g.sel = null; }
    if (g.tiles.every(x => x.done)) g.end = Date.now();
    rerender();
  }
  function render(el) {
    el = el || document.getElementById('v-library'); if (!el) return;
    if (!S.data) {
      el.innerHTML = segHTML() + `<div class="empty">${S.err ? 'Could not load the resource list. ' + esc(S.err) + ' <br><button class="btn small" data-rsretry>Try again</button>' : 'Loading free resources…'}</div>`;
      if (!S.err) load().then(() => { if (S.mode !== 'decks' && isOpen()) render(); }, () => { if (isOpen()) render(); });
      return;
    }
    if (S.mode === 'game' && G.state) { el.innerHTML = segHTML() + gameHTML(); segScroll(el); return; }
    const d = S.data, topics = d.topics, q = S.q.trim().toLowerCase();
    const ofType = d.items.filter(it => it.type === S.mode);
    const list = ofType.filter(it => (!S.topic || it.topic === S.topic) && (!q || [it.title, it.why, it.source, it.topic, it.level].join(' ').toLowerCase().includes(q)));
    const byTopic = {}; for (const it of list) (byTopic[it.topic] = byTopic[it.topic] || []).push(it);
    for (const t in byTopic) byTopic[t].sort((a, b) => (b.start ? 1 : 0) - (a.start ? 1 : 0));
    const label = (SEGS.find(s => s[0] === S.mode) || [])[1] || '';
    el.innerHTML = segHTML() + `
      <div class="lib-head">
        <p class="muted">${ofType.length} free ${esc(label.toLowerCase())} for your topics. All free and legal; ★ = start here.</p>
        <input type="search" id="rsQ" placeholder="Search ${esc(label.toLowerCase())}" value="${esc(S.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Search resources">
        <div class="lib-topics"><button class="chipbtn${!S.topic ? ' on' : ''}" data-rstopic="">All</button>${topics.map(t => { const n = ofType.filter(i => i.topic === t).length; return n ? `<button class="chipbtn${S.topic === t ? ' on' : ''}" data-rstopic="${esc(t)}">${esc(t)} <small>${n}</small></button>` : ''; }).join('')}</div>
      </div>
      ${S.mode === 'game' && !q ? gameCard() : ''}
      ${list.length ? topics.filter(t => byTopic[t]).map(t => `<h3 class="lib-topic">${esc(t)}</h3><div class="lib-list">${byTopic[t].map(item).join('')}</div>`).join('') : '<div class="empty">Nothing matches.</div>'}
      <p class="muted small lib-foot">Links open the official site. Videos play from YouTube's privacy-enhanced player. Nothing here is pirated or paywalled; a few sites have optional paid extras you never need.</p>`;
    segScroll(el);
    const qEl = document.getElementById('rsQ');
    qEl.oninput = () => { S.q = qEl.value; const keep = qEl.selectionStart; render(); const n = document.getElementById('rsQ'); if (n) { n.focus(); try { n.setSelectionRange(keep, keep); } catch {} } };
  }
  function isOpen() { const el = document.getElementById('v-library'); return el && !el.hidden; }
  function rerender() { if (window.Library) Library.render(); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-rsmode],[data-rstopic],[data-rswatch],[data-rsretry],[data-rsplay],[data-rstile],[data-rsquit]'); if (!t) return;
    if (t.dataset.rsplay != null) { const sel = document.getElementById('rsGdeck'); startGame(sel && !G.state ? sel.value : t.dataset.rsplay); rerender(); window.scrollTo(0, 0); return; }
    if (t.dataset.rstile != null) { tap(+t.dataset.rstile); return; }
    if (t.dataset.rsquit != null) { G.state = null; clearInterval(G.tick); rerender(); return; }
    if (t.dataset.rsmode != null) { const m = t.dataset.rsmode; if (m !== S.mode) { G.state = null; clearInterval(G.tick); S.mode = m; S.q = ''; LSset('mode', m); rerender(); const el = document.getElementById('v-library'); if (el) el.scrollIntoView({ block: 'start' }); window.scrollTo(0, 0); } return; }
    if (t.dataset.rstopic != null) { S.topic = t.dataset.rstopic; LSset('topic', S.topic); rerender(); return; }
    if (t.dataset.rswatch != null) { const id = t.dataset.rswatch; S.open = S.open[id] ? {} : { [id]: true }; rerender(); return; }
    if (t.dataset.rsretry != null) { S.err = null; rerender(); }
  });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'rsGdeck') { G.deck = e.target.value; LSset('gdeck', G.deck); rerender(); } });
  window.Resources = { mode: () => S.mode, render, decorate, load, _S: S, _G: G };
})();
