/* Mix-ups (v173): pairs of cards you confuse with each other. Flag one with "⇄ Mixed it up?" under any revealed answer,
   or accept a suggested pair (word-overlap guess, labelled as one). The Versus drill shows one card's question with BOTH
   answers and makes you pick, then shows the two side by side with the words that differ highlighted. 3 clean rounds in a row
   = untangled. Stored as progress record lab:mix (synced) + localStorage mix.v1. Does not change your FSRS schedule. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  const KEY = 'mix.v1', NEED = 3;
  let D = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { pairs: {}, at: 0 }; } catch (e) { return { pairs: {}, at: 0 }; } })();
  if (!D.pairs) D.pairs = {};
  let S = null;
  function pull() { try { const o = M.progress && M.progress.get('lab:mix'); if (o && o.data && (o.data.at || 0) > (D.at || 0)) { D = o.data; if (!D.pairs) D.pairs = {}; localStorage.setItem(KEY, JSON.stringify(D)); } } catch (e) {} }
  function save() { D.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} try { if (typeof write === 'function') write([['progress', { id: 'lab:mix', t: 'lab', data: D, at: D.at, del: 0 }]]); } catch (e) {} }
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  function qa(card) {
    if (!card) return null; const note = M.notes.get(card.nid); if (!note || note.del) return null;
    if (note.type === 'cloze') { const a = ((new RegExp('\\{\\{c' + card.ord + '::([\\s\\S]*?)(?:::|\\}\\})').exec(note.front) || [])[1] || ''); return { q: plain(note.front.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, (m, x) => x === a ? '[…]' : x)), a: plain(a) }; }
    return card.ord === 1 ? { q: plain(note.back), a: plain(note.front) } : { q: plain(note.front), a: plain(note.back) };
  }
  const card = id => { const c = M.cards.get(id); return c && !c.del && qa(c) ? c : null; };
  const pkey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const STOP = new Set('the a an of to in and or is are for on with by as at from that this which what it its be was were how why when who does do into than then'.split(' '));
  const toks = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9äöüßéèàçñ]+/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w)));
  function sim(A, B) { if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / (A.size + B.size - n); }
  function pairs(done) { return Object.entries(D.pairs).filter(([k, p]) => !p.del && !!p.done === !!done && card(k.split('|')[0]) && card(k.split('|')[1])).sort((x, y) => (y[1].n || 0) - (x[1].n || 0) || (y[1].last || 0) - (x[1].last || 0)); }
  // suggested pairs: cards you've lapsed on whose question+answer share many words (a guess, shown as one)
  function suggest() {
    const hard = []; for (const c of M.cards.values()) if (!c.del && (c.lapses || 0) >= 1) { const x = qa(c); if (x) hard.push({ c, t: toks(x.q + ' ' + x.a), a: toks(x.a) }); }
    hard.sort((x, y) => (y.c.lapses || 0) - (x.c.lapses || 0)); const H = hard.slice(0, 220), out = [];
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++) {
      if (H[i].c.nid === H[j].c.nid) continue; const k = pkey(H[i].c.id, H[j].c.id); if (D.pairs[k]) continue;
      const s = sim(H[i].t, H[j].t); if (s >= 0.34 && sim(H[i].a, H[j].a) < 0.9) out.push({ k, s, a: H[i].c, b: H[j].c });
    }
    return out.sort((x, y) => y.s - x.s).slice(0, 6);
  }
  function add(a, b, src) { const k = pkey(a, b), p = D.pairs[k] || { n: 0, streak: 0, right: 0, seen: 0, added: Date.now(), src }; p.n = (p.n || 0) + 1; p.last = Date.now(); p.del = 0; if (p.done) { p.done = 0; p.streak = 0; } D.pairs[k] = p; save(); }
  // word diff: words in x that are not in y get <mark>
  const stem = w => w.toLowerCase().replace(/(ing|ed|es|s)$/, '');
  function diff(x, y) { const X = toks(x), Y = toks(y); if (sim(X, Y) < 0.12) return esc(x); const YS = new Set([...Y].map(stem)); return esc(x).replace(/[A-Za-z0-9äöüßéèàçñ]{3,}/g, w => YS.has(stem(w)) || STOP.has(w.toLowerCase()) ? w : `<mark class="mx-d">${w}</mark>`); }

  /* ---------- picker sheet (from the ⇄ button under a revealed card) ---------- */
  let PK = null;
  function pick(c) {
    pull(); const me = qa(c); if (!me) return; PK = { c, me, mt: toks(me.q + ' ' + me.a), q: '' };
    openSheet(`<div class="xp mx-sheet"><h2>⇄ Mixed it up with…</h2><p class="muted small">Pick the card you were thinking of. Synapse pairs them and drills you on telling them apart (Study tools → Mix-ups).</p><div class="xp-card"><div class="xp-q">${esc(me.q.slice(0, 160))}</div><div class="xp-a">${esc(me.a.slice(0, 160))}</div></div><input type="search" class="mx-q" data-mx-q placeholder="Search your cards" autocomplete="off" autocapitalize="off"><div class="mx-pl" data-mx-pl></div><div class="actions"><button class="btn" data-close type="button">Cancel</button></div></div>`);
    plist();
  }
  function plist() {
    const box = document.querySelector('[data-mx-pl]'); if (!box || !PK) return; const q = PK.q.toLowerCase(), rows = [];
    for (const c of M.cards.values()) { if (c.del || c.id === PK.c.id || c.nid === PK.c.nid) continue; const x = qa(c); if (!x) continue; const hay = (x.q + ' ' + x.a).toLowerCase(); if (q && !hay.includes(q)) continue; rows.push({ c, x, s: sim(PK.mt, toks(x.q + ' ' + x.a)) + ((c.lapses || 0) ? 0.05 : 0) }); }
    rows.sort((a, b) => b.s - a.s);
    box.innerHTML = (q ? '' : '<div class="mx-h">Most alike first</div>') + (rows.slice(0, 25).map(r => `<button type="button" class="mx-pr" data-mx-pick="${esc(r.c.id)}"><span class="mx-pq">${esc(r.x.q.slice(0, 110))}</span><span class="mx-pa">${esc(r.x.a.slice(0, 90))}</span></button>`).join('') || '<div class="lb-empty" style="padding:20px">No cards match.</div>');
  }
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-mx-q]') && PK) { PK.q = e.target.value.trim(); plist(); } });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mx-pick]'); if (!b || !PK) return;
    add(PK.c.id, b.dataset.mxPick, 'you'); PK = null; closeSheet(); toast('Paired. Drill it in Study tools → Mix-ups');
  });

  /* ---------- screen ---------- */
  function render(el) {
    pull(); S = { el, run: null, sug: null };
    if (!el.__mx) { el.__mx = 1; el.addEventListener('click', onClick); }
    paint();
  }
  function prow(k, p) {
    const [a, b] = k.split('|').map(id => qa(card(id))), dots = Array.from({ length: NEED }, (_, i) => `<i class="${i < (p.streak || 0) ? 'on' : ''}"></i>`).join('');
    return `<div class="mx-pair"><div class="mx-two"><div><b>${esc(a.q.slice(0, 70))}</b><span>${esc(a.a.slice(0, 60))}</span></div><div class="mx-vs">vs</div><div><b>${esc(b.q.slice(0, 70))}</b><span>${esc(b.a.slice(0, 60))}</span></div></div>
      <div class="mx-meta"><span class="mx-dots" aria-label="${p.streak || 0} of ${NEED} clean rounds">${p.done ? '✓ untangled' : dots}</span><span class="muted small">${p.src === 'sug' ? 'suggested' : 'flagged ' + (p.n || 1) + '×'}${p.seen ? ' · ' + Math.round(100 * (p.right || 0) / p.seen) + '% right' : ''}</span>${p.done ? '' : `<button type="button" class="btn sm" data-mx-one="${esc(k)}">Drill</button>`}<button type="button" class="mx-x" data-mx-del="${esc(k)}" aria-label="Remove pair">${ic('x', 14)}</button></div></div>`;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; if (S.run) return paintRun();
    const P = pairs(false), Dn = pairs(true); if (!S.sug) S.sug = suggest();
    let h = L.top('Mix-ups', P.length ? P.length + ' to untangle' : '', 'tools') + `<p class="muted lb-p">Cards you keep confusing with each other, drilled as pairs. Tap <b>⇄ Mixed it up?</b> under any answer while you study to add one. ${NEED} clean rounds in a row and a pair counts as untangled. Drills here don't change your review schedule.</p>`;
    h += P.length ? `<button type="button" class="btn pri lb-wide" data-mx-all>Versus drill · ${P.length} pair${P.length === 1 ? '' : 's'}</button><div class="mx-list">${P.map(([k, p]) => prow(k, p)).join('')}</div>` : '<div class="lb-note">No pairs yet. Next time you get a card wrong because you were thinking of a different card, tap ⇄ Mixed it up? and pick that card.</div>';
    if (S.sug.length) h += `<h3 class="mx-sh">Maybe these?</h3><p class="muted small mx-shp">Cards you've missed that share a lot of words. This is a guess from word overlap, not proof you mix them up.</p><div class="mx-list">${S.sug.map(s => { const a = qa(s.a), b = qa(s.b); return `<div class="mx-pair sug"><div class="mx-two"><div><b>${esc(a.q.slice(0, 70))}</b><span>${esc(a.a.slice(0, 60))}</span></div><div class="mx-vs">vs</div><div><b>${esc(b.q.slice(0, 70))}</b><span>${esc(b.a.slice(0, 60))}</span></div></div><div class="mx-meta"><span class="muted small">${Math.round(s.s * 100)}% word overlap</span><button type="button" class="btn sm" data-mx-sug="${esc(s.k)}">Add pair</button></div></div>`; }).join('')}</div>`;
    if (Dn.length) h += `<h3 class="mx-sh">Untangled</h3><div class="mx-list">${Dn.map(([k, p]) => prow(k, p)).join('')}</div>`;
    S.el.innerHTML = `<div class="lb mx">${h}</div>`;
  }
  function start(keys) {
    const qs = []; for (const k of keys) { const [a, b] = k.split('|'); qs.push({ k, ask: a, other: b }, { k, ask: b, other: a }); }
    S.run = { qs: L.shuffle(qs), i: 0, pick: null, ok: 0, perPair: {} }; paint();
  }
  function paintRun() {
    const R = S.run, Q = R.qs[R.i];
    if (!Q) { // finish: update streaks per pair
      let un = 0; for (const [k, ok] of Object.entries(R.perPair)) { const p = D.pairs[k]; if (!p) continue; p.seen = (p.seen || 0) + ok.n; p.right = (p.right || 0) + ok.r; p.streak = ok.r === ok.n ? (p.streak || 0) + 1 : 0; p.lastDrill = Date.now(); if (p.streak >= NEED && !p.done) { p.done = Date.now(); un++; } }
      save(); const tot = R.qs.length;
      S.el.innerHTML = `<div class="lb mx">${L.top('Versus drill', '', 'mix')}<div class="mx-end"><div class="mx-big">${R.ok}/${tot}</div><p>${R.ok === tot ? 'Clean round. You told every pair apart.' : 'The ones you missed stay in the list for next time.'}</p>${un ? `<p class="mx-win">✓ ${un} pair${un === 1 ? '' : 's'} untangled</p>` : ''}</div><div class="lb-btns"><button class="btn" type="button" data-mx-back>Done</button><button class="btn pri" type="button" data-mx-again>Again</button></div></div>`;
      return;
    }
    const A = qa(card(Q.ask)), B = qa(card(Q.other));
    if (!R.opts || R.opts.i !== R.i) R.opts = { i: R.i, o: L.shuffle([{ id: Q.ask, t: A.a }, { id: Q.other, t: B.a }]) };
    const done = R.pick != null;
    let h = L.top('Versus drill', (R.i + 1) + ' / ' + R.qs.length, 'mix') + `<div class="mx-q1">${esc(A.q)}</div><p class="muted small">Which answer goes with this question?</p><div class="mx-opts">${R.opts.o.map(o => `<button type="button" class="mx-opt${done ? (o.id === Q.ask ? ' ok' : o.id === R.pick ? ' bad' : ' dim') : ''}" data-mx-o="${esc(o.id)}"${done ? ' disabled' : ''}>${esc(o.t)}</button>`).join('')}</div>`;
    if (done) h += `<div class="mx-cmp"><div class="mx-h">Side by side${sim(toks(A.a), toks(B.a)) >= 0.12 ? ' · <mark class="mx-d">highlighted</mark> = only in that answer' : ''}</div><div class="mx-c"><b>${esc(A.q)}</b><span>${diff(A.a, B.a)}</span></div><div class="mx-c"><b>${esc(B.q)}</b><span>${diff(B.a, A.a)}</span></div></div><button type="button" class="btn pri lb-wide" data-mx-next>${R.i + 1 < R.qs.length ? 'Next' : 'Finish'}</button>`;
    S.el.innerHTML = `<div class="lb mx">${h}</div>`;
  }
  function onClick(e) {
    const t = e.target.closest('button'); if (!t || !S) return; const d = t.dataset;
    if ('mxAll' in d) return start(pairs(false).map(x => x[0]));
    if (d.mxOne) return start([d.mxOne]);
    if (d.mxSug) { const s = (S.sug || []).find(x => x.k === d.mxSug); if (s) { add(s.a.id, s.b.id, 'sug'); S.sug = S.sug.filter(x => x.k !== d.mxSug); paint(); toast('Pair added'); } return; }
    if (d.mxDel) { if (D.pairs[d.mxDel]) { D.pairs[d.mxDel].del = 1; save(); } paint(); return; }
    if (d.mxO && S.run && S.run.pick == null) { const R = S.run, Q = R.qs[R.i]; R.pick = d.mxO; const ok = d.mxO === Q.ask; if (ok) R.ok++; const pp = R.perPair[Q.k] || (R.perPair[Q.k] = { n: 0, r: 0 }); pp.n++; if (ok) pp.r++; try { window.Prefs && Prefs.sound(ok ? 'ok' : 'bad'); } catch (x) {} paint(); return; }
    if ('mxNext' in d && S.run) { S.run.i++; S.run.pick = null; paint(); window.scrollTo(0, 0); return; }
    if ('mxAgain' in d && S.run) { const keys = [...new Set(S.run.qs.map(q => q.k))].filter(k => D.pairs[k] && !D.pairs[k].done); S.run = null; if (keys.length) start(keys); else paint(); return; }
    if ('mxBack' in d) { S.run = null; S.sug = null; paint(); return; }
    if (t.matches('.lb-back') && S.run) { e.stopPropagation(); e.preventDefault(); S.run = null; paint(); }
  }
  window.LabMods.mix = { render, pick, _suggest: suggest, _D: () => D };
})();
