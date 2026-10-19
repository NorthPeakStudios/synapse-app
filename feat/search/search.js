/* Global search: one full-screen sheet over cards, courses & lessons, Doctordle cases and Library decks.
   Index is built lazily in small slices (never blocks typing); lesson terms from loaded courses persist in localStorage.
   Unsolved Doctordle cases are matched and shown by area/system/complaint only, never by diagnosis. */
'use strict';
(function () {
  const LX_KEY = 'search.lx.v1', RECENT_KEY = 'search.recent.v1';
  const S = { el: null, q: '', t: 0, sel: 0, items: [], expanded: {}, docs: null, vocab: null, building: null, notesSig: '', extraSig: '' };
  const IC = (n, s) => (window.Prefs && Prefs.icon ? Prefs.icon(n, s || 18) : '');
  const SEARCH_SVG = '<svg class="srch-mag" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>';
  const CLR_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m8.5 8.5 7 7m0-7-7 7" stroke="var(--bg2)" stroke-width="2" stroke-linecap="round"/></svg>';

  /* ---------- text ---------- */
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss');
  const plain = h => String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const words = s => fold(s).split(/[^a-z0-9]+/).filter(w => w.length > 0);
  function lev(a, b, max) { // bounded Levenshtein; returns max+1 when over
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) { const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); cur.push(v); if (v < best) best = v; }
      if (best > max) return max + 1; prev = cur;
    }
    return prev[b.length];
  }
  // how well query token q matches vocabulary word w: 0 = no match, higher = better
  function wscore(q, w) {
    if (w === q) return 10;
    if (w.startsWith(q)) return 8 - Math.min(3, (w.length - q.length) / 4);
    if (q.length >= 3 && w.includes(q)) return 4;
    if (q.length >= 4 && w[0] === q[0]) { // typo tolerance against the word (or its prefix of the same length)
      const max = q.length >= 8 ? 2 : 1;
      if (lev(q, w.slice(0, q.length), max) <= max || lev(q, w, max) <= max) return 3;
    }
    return 0;
  }

  /* ---------- sources ---------- */
  let manifest = null;
  async function getManifest() {
    if (window.Learn && Learn._S && Learn._S.manifest) return (manifest = Learn._S.manifest);
    if (manifest) return manifest;
    try { const r = await fetch('learn/manifest.json'); if (r.ok) manifest = await r.json(); } catch (e) {}
    return manifest;
  }
  function lxLoad() { try { return JSON.parse(localStorage.getItem(LX_KEY) || '{}') || {}; } catch (e) { return {}; } }
  // remember searchable terms of every course this device has loaded (bold terms + key points), small and capped
  function lxRemember() {
    if (!window.Learn || !Learn._S || !Learn._S.courses || !Learn._S.courses.size) return false;
    const lx = lxLoad(); let changed = false;
    for (const [cid, c] of Learn._S.courses) {
      if (lx[cid] || !c || !Array.isArray(c.lessons)) continue;
      lx[cid] = c.lessons.map(l => { const t = new Set(); const txt = Object.values(l.levels || {}).join('\n') + '\n' + (l.keyPoints || []).join('\n');
        for (const m of txt.matchAll(/\*\*([^*]{2,40})\*\*/g)) t.add(m[1].trim()); return [...t].slice(0, 40).join(' · '); });
      changed = true;
    }
    if (changed) { const ks = Object.keys(lx); while (ks.length > 120) delete lx[ks.shift()]; try { localStorage.setItem(LX_KEY, JSON.stringify(lx)); } catch (e) {} }
    return changed;
  }
  const solvedCase = id => { const o = M.progress.get('doc:' + id); return !!(o && !o.del && o.wins); };

  /* ---------- index: docs + inverted vocabulary ---------- */
  // doc: { g: group, id, title, sub, w: [[word, fieldBoost]], open }
  const pause = () => new Promise(r => setTimeout(r, 0));
  async function build() {
    const docs = [], vocab = new Map();
    const add = (d, fields) => { // fields: [[text, boost]]
      const idx = docs.length; docs.push(d); const seen = new Map();
      for (const [txt, boost] of fields) for (const w of words(txt)) { if (w.length > 40) continue; if ((seen.get(w) || 0) < boost) seen.set(w, boost); }
      for (const [w, b] of seen) { let a = vocab.get(w); if (!a) vocab.set(w, (a = [])); a.push(idx, b); }
    };
    // cards (sliced so typing never stalls on big libraries)
    const deckName = id => { const d = M.decks.get(id); return d && !d.del ? d.name : ''; };
    let n = 0;
    for (const note of M.notes.values()) {
      if (note.del) continue; const d = M.decks.get(note.deck); if (!d || d.del) continue;
      const f = plain(note.front), b = plain(note.back);
      add({ g: 'cards', id: note.id, title: f.slice(0, 120) || '(empty card)', sub: (b.slice(0, 90) || '') + (b ? ' · ' : '') + deckName(note.deck) }, [[f, 3], [b, 2], [(note.tags || []).join(' ').replace(/::/g, ' '), 1], [deckName(note.deck), 1]]);
      if (++n % 1500 === 0) await pause();
    }
    // courses + lessons
    const m = await getManifest(); const lx = lxLoad();
    if (m && m.topics) for (const t of m.topics) for (const c of t.courses) {
      const ready = c.status === 'ready';
      add({ g: 'courses', id: c.id, title: c.title, sub: `${t.name} · Course ${c.n} · ${c.band || ''}${ready ? '' : ' · coming soon'}`, ready, topic: t.key }, [[c.title, 3], [t.name + ' ' + (t.tag || ''), 1], [c.band, 1], [c.summary, 1], [[...(c.targets && c.targets.grammar || []), ...(c.targets && c.targets.vocab || [])].join(' '), 1]]);
      if (ready) (c.lessons || []).forEach((lt, i) => add({ g: 'lessons', id: c.id + '|' + i, title: lt, sub: `${t.name} · ${c.title}`, cid: c.id, li: i, topic: t.key }, [[lt, 3], [t.name, 1], [(lx[c.id] && lx[c.id][i]) || '', 1]]));
    }
    await pause();
    // doctordle
    try {
      const cases = window.Doctordle ? await Doctordle.load() : null;
      for (const c of cases || []) {
        const solved = solvedCase(c.id);
        add({ g: 'doc', id: c.id, title: solved ? c.dx : c.system + ' case', sub: (solved ? c.system + ' · ' : c.area + ' · ') + c.complaint, solved },
          solved ? [[c.dx, 3], [(c.aliases || []).join(' '), 2], [c.system + ' ' + c.area, 1], [c.complaint, 1]] : [[c.system + ' ' + c.area, 2], [c.complaint, 1]]);
      }
    } catch (e) {}
    // library decks (only if the index is already on this device; never a network wait)
    try {
      const idx = (window.Library && Library._S && Library._S.index) || JSON.parse(localStorage.getItem('libIndex') || 'null') || [];
      for (const d of idx) add({ g: 'lib', id: d.id, title: d.name, sub: [d.topic || d.cat || '', d.cards || d.count ? (d.cards || d.count) + ' cards' : ''].filter(Boolean).join(' · ') || 'Library deck' }, [[d.name, 3], [d.topic || d.cat || '', 1], [d.desc || d.description || '', 1]]);
    } catch (e) {}
    // features: every tab, tool and screen by name
    try { if (window.Shell) for (const f of Shell.searchDocs()) add({ g: 'feat', id: f.id, title: f.title, sub: f.sub }, [[f.title, 4], [f.keys, 2], [f.sub, 1]]); } catch (e) {}
    S.docs = docs; S.vocab = vocab; S.vlist = [...vocab.keys()];
    return docs;
  }
  const notesSig = () => M.notes.size + ':' + (window.__srchMod || 0);
  function ensureIndex(force) {
    const sig = notesSig() + '|' + [...M.progress.values()].filter(o => o.t === 'doc' && o.wins && !o.del).length;
    if (!force && S.docs && S.sig === sig) return Promise.resolve(S.docs);
    if (S.building) return S.building;
    S.building = build().then(d => { S.sig = sig; S.building = null; return d; }, e => { S.building = null; throw e; });
    return S.building;
  }

  /* ---------- query ---------- */
  function query(q) {
    const qt = [...new Set(words(q))].slice(0, 6); if (!qt.length || !S.docs) return [];
    let acc = null;
    for (const t of qt) {
      const hit = new Map();
      for (const w of S.vlist) { const s = wscore(t, w); if (!s) continue; const a = S.vocab.get(w); for (let i = 0; i < a.length; i += 2) { const v = s * a[i + 1]; if ((hit.get(a[i]) || 0) < v) hit.set(a[i], v); } }
      if (!acc) acc = hit; else { const nx = new Map(); for (const [k, v] of hit) if (acc.has(k)) nx.set(k, acc.get(k) + v); acc = nx; }
      if (!acc.size) return [];
    }
    const fq = fold(q.trim());
    return [...acc].map(([i, s]) => { const d = S.docs[i]; const ft = fold(d.title); if (ft === fq) s += 30; else if (ft.startsWith(fq)) s += 12; else if (ft.includes(fq)) s += 6; if (d.g === 'courses' && d.ready) s += 4; return [d, s]; })
      .sort((a, b) => b[1] - a[1] || a[0].title.length - b[0].title.length).map(x => x[0]);
  }

  /* ---------- UI ---------- */
  const GROUPS = [['feat', 'Features & tools'], ['lessons', 'Lessons'], ['courses', 'Courses'], ['cards', 'Cards'], ['doc', 'Doctordle'], ['lib', 'Library']];
  const GIC = { cards: 'cards', courses: 'learn', lessons: 'learn', doc: 'doc', lib: 'library' };
  function hl(text, q) { // highlight matched word prefixes
    const qt = words(q).filter(w => w.length > 1); let h = esc(text); if (!qt.length) return h;
    const parts = String(text).split(/(\s+)/); return parts.map(p => { const f = fold(p).replace(/[^a-z0-9]/g, ''); const t = qt.find(x => f.startsWith(x)); if (!t || !f) return esc(p); let k = 0, n = 0; const fp = fold(p); while (k < p.length && n < t.length) { if (/[a-z0-9]/.test(fp[k] || '')) n++; k++; } return '<mark>' + esc(p.slice(0, k)) + '</mark>' + esc(p.slice(k)); }).join('');
  }
  function recent() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; } }
  function pushRecent(q) { q = q.trim(); if (q.length < 2) return; const r = [q, ...recent().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 6); try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch (e) {} }

  function open(initial) {
    if (S.el) { S.el.querySelector('input').focus(); return; }
    const el = document.createElement('div'); el.className = 'srch'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Search');
    el.innerHTML = `<div class="srch-bar"><label class="srch-field">${SEARCH_SVG}<input type="search" id="srchIn" placeholder="Tools, cards, lessons, cases" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Search everything" aria-controls="srchRes"><button type="button" class="srch-clr" data-srch-clear aria-label="Clear" hidden>${CLR_SVG}</button></label><button type="button" class="srch-cancel" data-srch-close>Cancel</button></div><div class="srch-res" id="srchRes" role="listbox"></div>`;
    document.body.appendChild(el); S.el = el; document.documentElement.classList.add('srch-on');
    const inp = el.querySelector('input'); inp.value = initial || ''; S.q = inp.value; S.expanded = {};
    inp.addEventListener('input', () => { S.q = inp.value; el.querySelector('.srch-clr').hidden = !S.q; clearTimeout(S.t); S.t = setTimeout(paint, S.docs ? 90 : 0); });
    inp.addEventListener('keydown', onKey);
    el.addEventListener('click', onClick);
    inp.focus();
    paint();
    ensureIndex().then(() => { if (S.el) paint(); }).catch(() => {});
    if (lxRemember()) ensureIndex(true).then(() => { if (S.el) paint(); }).catch(() => {});
  }
  function close() { if (!S.el) return; pushRecent(S.q); S.el.remove(); S.el = null; document.documentElement.classList.remove('srch-on'); }
  function paint() {
    if (!S.el) return; const box = S.el.querySelector('.srch-res'), q = S.q.trim();
    S.el.querySelector('.srch-clr').hidden = !S.q;
    if (!q) {
      const r = recent();
      box.innerHTML = r.length ? `<div class="srch-h"><span>Recent</span><button type="button" class="srch-link" data-srch-forget>Clear</button></div><div class="srch-grp">${r.map(x => `<button type="button" class="srch-row srch-rec" data-srch-q="${esc(x)}"><span class="srch-ic">${SEARCH_SVG}</span><span class="srch-tx"><span class="srch-t1">${esc(x)}</span></span></button>`).join('')}</div>`
        : `<div class="srch-empty"><div class="srch-empty-t">Search everything</div><div class="srch-empty-s">Every tool and screen, your cards, every course and lesson, Doctordle cases and the deck library.</div></div>`;
      S.items = []; return;
    }
    if (!S.docs) { box.innerHTML = '<div class="srch-empty"><div class="srch-empty-s">Building the index…</div></div>'; return; }
    const all = query(q); S.items = []; S.sel = 0;
    if (!all.length) { box.innerHTML = `<div class="srch-empty"><div class="srch-empty-t">No results</div><div class="srch-empty-s">Nothing matches “${esc(q)}”. Try fewer letters or another word.</div></div>`; return; }
    let html = '';
    for (const [g, name] of GROUPS) {
      let list = all.filter(d => d.g === g); if (!list.length) continue;
      if (g === 'courses') list = [...list.filter(d => d.ready), ...list.filter(d => !d.ready)];
      const lim = S.expanded[g] ? 60 : g === 'cards' || g === 'lessons' || g === 'feat' ? 5 : 4, shown = list.slice(0, lim);
      html += `<div class="srch-h"><span>${name}</span>${list.length > lim ? `<button type="button" class="srch-link" data-srch-more="${g}">Show all ${list.length > 60 ? '60+' : list.length}</button>` : `<span class="srch-n">${list.length}</span>`}</div><div class="srch-grp">`;
      for (const d of shown) { const k = S.items.length; S.items.push(d);
        html += `<button type="button" class="srch-row" role="option" data-srch-i="${k}" id="srch-o${k}"><span class="srch-ic">${g === 'feat' && window.Shell ? Shell.icon(d.id, 18) : IC(GIC[g], 18)}</span><span class="srch-tx"><span class="srch-t1">${hl(d.title, q)}</span><span class="srch-t2">${esc(d.sub || '')}</span></span>${d.g === 'doc' && !d.solved ? '<span class="srch-tag">Unsolved</span>' : d.g === 'courses' && !d.ready ? '<span class="srch-tag">Soon</span>' : ''}</button>`; }
      html += '</div>';
    }
    box.innerHTML = html; mark();
  }
  function mark() { if (!S.el) return; S.el.querySelectorAll('.srch-row.sel').forEach(x => x.classList.remove('sel')); const r = S.el.querySelector(`[data-srch-i="${S.sel}"]`); if (r) { r.classList.add('sel'); r.scrollIntoView({ block: 'nearest' }); S.el.querySelector('input').setAttribute('aria-activedescendant', r.id); } }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' && S.items.length) { e.preventDefault(); S.sel = Math.min(S.items.length - 1, S.sel + 1); mark(); }
    else if (e.key === 'ArrowUp' && S.items.length) { e.preventDefault(); S.sel = Math.max(0, S.sel - 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); clearTimeout(S.t); if (S.docs && S.q.trim() && !S.items.length) paint(); if (S.items[S.sel]) choose(S.items[S.sel]); else e.target.blur(); }
  }
  function onClick(e) {
    const t = e.target.closest('[data-srch-close],[data-srch-clear],[data-srch-i],[data-srch-more],[data-srch-q],[data-srch-forget]'); if (!t) return;
    const inp = S.el.querySelector('input');
    if (t.hasAttribute('data-srch-close')) close();
    else if (t.hasAttribute('data-srch-clear')) { inp.value = S.q = ''; paint(); inp.focus(); }
    else if (t.dataset.srchMore) { S.expanded[t.dataset.srchMore] = 1; paint(); }
    else if (t.dataset.srchQ != null) { inp.value = S.q = t.dataset.srchQ; paint(); }
    else if (t.hasAttribute('data-srch-forget')) { try { localStorage.removeItem(RECENT_KEY); } catch (er) {} paint(); }
    else if (t.dataset.srchI != null) choose(S.items[+t.dataset.srchI]);
  }
  function lvlFor(cid) { const o = M.progress.get('lv:' + cid); return (o && !o.del && o.lvl) || (window.Prefs && Prefs.v && Prefs.v.learn && Prefs.v.learn.level) || 'hs'; }
  function choose(d) {
    if (!d) return; try { window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (e) {}
    close();
    if (d.g === 'feat') { if (window.Shell) Shell.openDoc(d.id); return; }
    if (d.g === 'cards') { if (typeof editNote === 'function') editNote(d.id, view); }
    else if (d.g === 'courses' || d.g === 'lessons') {
      if (!window.Learn) return;
      if (d.g === 'courses' && !d.ready) { Learn._S.route = { page: 'topic', topic: d.topic }; go('learn'); toast && toast('That course is coming soon'); return; }
      const cid = d.g === 'courses' ? d.id : d.cid, lvl = lvlFor(cid);
      Learn._S.route = d.g === 'courses' ? { page: 'course', cid, lvl } : { page: 'lesson', cid, lvl, li: d.li };
      if (view === 'learn') Learn.render(); else go('learn'); window.scrollTo(0, 0);
    } else if (d.g === 'doc') openCase(d.id);
    else if (d.g === 'lib') { if (window.Home && Home.openLib) Home.openLib('decks'); else go('library'); }
  }
  function openCase(id) {
    if (window.Doctordle && Doctordle.open) return Doctordle.open(id);
    if (window.Doctordle && Doctordle._S) Doctordle._S.g = null;
    go('doc');
    // Doctordle starts a case from a click on [data-doc-case]; use its own handler rather than reaching into it
    const fire = () => { const host = document.getElementById('v-doc'); if (!host) return; const b = document.createElement('button'); b.hidden = true; b.dataset.docCase = id; host.appendChild(b); b.click(); b.remove(); };
    (window.Doctordle && Doctordle.load ? Doctordle.load() : Promise.resolve()).then(() => setTimeout(fire, 0)).catch(() => {});
  }
  // keep the card index fresh after edits (cheap signature bump; rebuilt on next open)
  try { changeHooks.push(() => { window.__srchMod = (window.__srchMod || 0) + 1; }); } catch (e) {}
  const icon = (sz = 22) => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>`;
  // any element with data-search-open opens the sheet (home header button, etc.)
  document.addEventListener('click', e => { const t = e.target.closest('[data-search-open]'); if (t) { e.preventDefault(); open(); } });
  window.Search = { open, close, icon, query: q => query(q), ensureIndex, _S: S };
})();
