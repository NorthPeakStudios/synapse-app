/* Pharm-book cards: auto-made from Odin's own book (appendices: glossary, abbreviations, drug-class quick reference). Filtered: no doses, nothing recreational/abuse, no reproductive or STI topics. Adds them as normal cards (synced), skipping any already added. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null;
  const SECS = [['Glossary', 'Key terms and their definitions'], ['Abbreviations', 'What the book’s abbreviations stand for'], ['Drug classes', 'Mechanism, examples and key adverse effects, both directions']];
  function render(el) {
    S = { el, on: JSON.parse(localStorage.getItem('pbook.on') || '{"Glossary":1,"Abbreviations":1,"Drug classes":1}'), peek: null, done: 0 };
    if (!el.__pb) { el.__pb = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/pbook.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const nid = c => 'n-pb-' + c.id;
  const have = c => { const n = M.notes.get(nid(c)); return n && !n.del; };
  function front(c) { return c.s === 'Abbreviations' ? 'What does <b>' + esc(c.f) + '</b> stand for?' : c.s === 'Glossary' ? 'Define: <b>' + esc(c.f) + '</b>' : esc(c.f); }
  function back(c) { return c.s === 'Drug classes' ? c.b : esc(c.b); }
  function paint() {
    if (!S || !S.el.isConnected) return;
    const tot = D.cards.length, added = D.cards.filter(have).length;
    let h = L.top('Pharm book cards', added ? added + '/' + tot + ' added' : tot + ' cards', 'tools');
    h += `<p class="muted lb-p">Cards made automatically from your book <i>Pharmacology &amp; Medicinal Chemistry</i>: the glossary, the abbreviation list and the drug-class quick reference. No doses.</p>`;
    if (S.done) h += `<div class="lb-card sim-res"><div class="sim-verd ok">✓ ${S.done} card${S.done === 1 ? '' : 's'} added to “Pharm book”</div><div class="lb-btns"><button class="btn pri" data-pb-study type="button">Study them now</button></div></div>`;
    h += `<div class="lb-group">${SECS.map(([k, sub]) => { const cs = D.cards.filter(c => c.s === k), a = cs.filter(have).length; return `<label class="lb-row pb-row"><input type="checkbox" data-pb-on="${k}" ${S.on[k] ? 'checked' : ''} style="width:22px;height:22px;margin-right:10px;flex:none"><span class="lb-rt"><span class="t1">${k} · ${cs.length}</span><span class="t2">${sub}${a ? ` · ${a} added` : ''}</span></span><button class="btn" type="button" data-pb-peek="${k}" style="flex:none;min-height:36px;padding:6px 10px">Preview</button></label>`; }).join('')}</div>`;
    const todo = D.cards.filter(c => S.on[c.s] && !have(c)).length;
    h += `<div class="lb-btns sticky"><button class="btn pri" data-pb-add type="button" ${todo ? '' : 'disabled'}>${todo ? 'Add ' + todo + ' card' + (todo === 1 ? '' : 's') : 'All added'}</button></div>`;
    if (S.peek) { const cs = D.cards.filter(c => c.s === S.peek).slice(0, 40); h += `<h3 style="margin:18px 0 8px">${esc(S.peek)} preview</h3><div class="pb-list">${cs.map(c => `<div class="lb-card" style="padding:10px 12px;margin-bottom:8px"><div style="font-weight:600">${front(c)}</div><div class="muted small" style="margin-top:4px">${back(c)}</div></div>`).join('')}</div>`; }
    h += `<p class="lb-foot">Source: ${esc(D.src)}.</p>`;
    S.el.innerHTML = `<div class="lb pb">${h}</div>`;
  }
  async function add() {
    let did = localStorage.getItem('pbook.deck'); const ops = [];
    if (!did || !M.decks.get(did) || M.decks.get(did).del) { did = 'd-pb-' + Date.now().toString(36); ops.push(['decks', { id: did, name: 'Pharm book', created: Date.now(), del: 0 }]); }
    const list = D.cards.filter(c => S.on[c.s] && !have(c)); let k = 0;
    for (const c of list) {
      const note = { id: nid(c), created: Date.now() + k, deck: did, type: 'basic', front: front(c), back: back(c), tags: ['pharm-book', c.s.toLowerCase().replace(/ /g, '-')], del: 0 };
      M.notes.set(note.id, note); ops.push(['notes', note], ...cardsForNote(note, Date.now() + k)); k++;
    }
    await write(ops); localStorage.setItem('pbook.deck', did);
    try { window.Hub && Hub.award('lib', Math.min(40, k)); } catch (e) {} try { toast(k + ' cards added'); } catch (e) {}
    S.done = k; paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    const p = t.closest('[data-pb-peek]'); if (p) { e.preventDefault(); S.peek = S.peek === p.dataset.pbPeek ? null : p.dataset.pbPeek; paint(); return; }
    if (t.closest('[data-pb-add]')) { add().catch(err => { console.warn(err); toast('Couldn\'t add the cards'); }); return; }
    if (t.closest('[data-pb-study]')) { try { studyDeck = localStorage.getItem('pbook.deck'); undoStack = []; go('study'); } catch (err) { go('decks'); } return; }
  }
  function onChange(e) { const c = e.target.closest('[data-pb-on]'); if (c) { S.on[c.dataset.pbOn] = c.checked ? 1 : 0; localStorage.setItem('pbook.on', JSON.stringify(S.on)); paint(); } }
  window.LabMods.pbook = { render, _S: () => S };
})();
