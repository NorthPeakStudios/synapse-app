/* Ask a tutor: a chat on any card. It is a RETRIEVAL tutor (no AI model is wired to the site, and no keys live in it): it answers only with sentences it finds in the card itself, your Learn lessons and the Wikipedia summary (via the app's /api/wiki proxy), shows where each came from, and says "I don't know" when nothing matches well. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css3();
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const STOP = new Set('the a an and or of to in on at by for with from as is are was were be been this that these those it its into what which who whom how why when where does do did can could would should will not no your you me my i we they them there their than then so if about tell explain mean means meaning work works happen happens der die das und ein eine ist sind le la les un une et est el los las y es son de del more much many some any very just also like get got make made use used one two'.split(' '));
  const toks = s => [...new Set(fold(s).split(/[^a-z0-9α-ω]+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1')))];
  const sents = t => plain(t).split(/(?<=[.!?])\s+(?=[A-Z0-9(])/).map(x => x.trim().replace(/^[-•]\s*/, '').replace(/:\s+-\s+/g, ': ')).filter(x => x.length > 25 && x.length < 420);
  let manP = null;
  const manifest = () => manP || (manP = fetch('learn/manifest.json').then(r => r.json()).catch(e => { manP = null; throw e; }));
  const ccache = {};
  const course = (k, id) => ccache[k + id] || (ccache[k + id] = fetch('learn/' + k + '/' + id + '.json').then(r => r.ok ? r.json() : null).catch(() => null));
  async function learnSents(qt) {
    const man = await manifest(); const cand = [];
    for (const tp of man.topics) for (const c of tp.courses) {
      const hay = fold([c.title, c.summary, (c.lessons || []).join(' '), JSON.stringify(c.targets || {})].join(' '));
      let s = 0; for (const w of qt) if (hay.includes(w)) s += w.length > 6 ? 2 : 1;
      if (s) cand.push({ s, tp, c });
    }
    cand.sort((a, b) => b.s - a.s); const out = [];
    for (const k of cand.slice(0, 3)) {
      const co = await course(k.tp.key, k.c.id); if (!co) continue;
      for (const ls of co.lessons || []) {
        const lvl = ls.levels || {}; const txt = [(ls.keyPoints || []).join('. '), lvl.hs || '', lvl.college || ''].join(' ');
        for (const x of sents(txt)) out.push({ t: x, src: 'Learn · ' + co.title + ' · ' + ls.title });
      }
    }
    return out;
  }
  async function wikiSents(terms) {
    for (const t of terms.slice(0, 3)) {
      try { const r = await fetch('/api/wiki/summary?t=' + encodeURIComponent(t)); if (!r.ok) continue; const j = await r.json(); if (j && j.found) return sents(j.extract).map(x => ({ t: x, src: 'Wikipedia · ' + j.title, url: j.url })); } catch (e) {}
    }
    return [];
  }
  function phrases(q) {
    const Q = q.replace(/[?.!]+$/, '');
    const m = /(?:what|who)\s+(?:is|are|was|were|does)\s+(?:an?\s+|the\s+)?(.{3,50}?)(?:\s+do|\s+mean)?$/i.exec(Q) || /(?:about|explain|define)\s+(?:an?\s+|the\s+)?(.{3,50})$/i.exec(Q);
    const out = []; if (m) out.push(m[1].trim());
    const caps = q.match(/\b[A-Z][a-zA-Z-]{2,}(?:\s+[A-Z][a-zA-Z-]{2,}){0,2}\b/g) || []; for (const c of caps) if (!STOP.has(c.toLowerCase())) out.push(c);
    out.push(...toks(q).sort((a, b) => b.length - a.length).slice(0, 2));
    return [...new Set(out)];
  }
  function rank(pool, qt, ct) {
    const scored = [];
    for (const p of pool) {
      const st = new Set(toks(p.t)); let s = 0, hit = 0;
      for (const w of qt) if (st.has(w)) { s += w.length > 6 ? 3 : 2; hit++; }
      for (const w of ct) if (st.has(w)) s += 0.5;
      if (hit) scored.push(Object.assign({ s, hit }, p));
    }
    const seen = new Set(); return scored.sort((a, b) => b.s - a.s).filter(x => { const k = x.t.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  async function answer(q, card) {
    const qt = toks(q), ct = toks(card.q + ' ' + card.a);
    if (!qt.length) return { idk: true, why: 'Ask a full question, like “why does this drug cause dry mouth?”' };
    const terms = phrases(q).concat(phrases(card.a)).filter(Boolean);
    const [ls, ws] = await Promise.all([learnSents(qt.concat(ct.slice(0, 3))).catch(() => []), wikiSents(terms).catch(() => [])]);
    const pool = [{ t: card.q + ' → ' + card.a, src: 'This card' }].concat(ls, ws);
    const r = rank(pool, qt, ct); const need = Math.min(2, qt.length);
    const good = r.filter(x => x.hit >= need && x.s >= 4).slice(0, 3);
    if (!good.length) return { idk: true, why: 'I don\'t know that one from your card, your Learn lessons or Wikipedia. Try other words, or text me the question.' };
    return { idk: false, hits: good };
  }
  let C = null;
  function open(card) {
    const note = card && M.notes.get(card.nid); if (!note) return;
    const q = plain(note.type === 'cloze' ? note.front.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '[…]') : card.ord === 1 ? note.back : note.front);
    const a = plain(note.type === 'cloze' ? ((new RegExp('\\{\\{c' + card.ord + '::([\\s\\S]*?)(?:::|\\}\\})').exec(note.front) || [])[1] || '') : card.ord === 1 ? note.front : note.back);
    C = { q, a, msgs: [{ me: 0, html: 'Ask me anything about this card. I answer only from <b>this card</b>, <b>your Learn lessons</b> and <b>Wikipedia</b>, and I\'ll tell you when I don\'t know.' }], busy: false };
    paint();
  }
  function paint() {
    const sug = ['Why is this true?', 'What does ' + (toks(C.a)[0] || 'this') + ' mean?', 'How is it treated?'];
    openSheet(`<div class="xp tu"><h2>Ask a tutor</h2><div class="xp-card"><div class="xp-q">${esc(C.q)}</div><div class="xp-a">${esc(C.a)}</div></div>
      <div class="tu-log">${C.msgs.map(m => `<div class="tu-m ${m.me ? 'me' : ''}">${m.html}</div>`).join('')}${C.busy ? '<div class="tu-m">Looking it up…</div>' : ''}</div>
      ${C.msgs.length < 2 ? `<div class="tu-sug">${sug.map(s => `<button type="button" data-tu-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      <form class="xp-f" data-tu-form autocomplete="off"><input type="text" id="tuQ" placeholder="Ask a question…" autocapitalize="sentences" enterkeyhint="send"><button class="btn pri" type="submit">Ask</button></form>
      <div class="actions"><button class="btn" data-close type="button">Close</button></div></div>`);
    const fm = document.querySelector('[data-tu-form]'); if (fm) fm.onsubmit = e => { e.preventDefault(); const v = document.getElementById('tuQ').value.trim(); if (v) ask(v); };
    const lg = document.querySelector('.tu-log'); if (lg) lg.scrollTop = lg.scrollHeight;
  }
  async function ask(v) {
    if (!C || C.busy) return; C.msgs.push({ me: 1, html: esc(v) }); C.busy = true; paint();
    let r; try { r = await answer(v, C); } catch (e) { r = { idk: true, why: 'Something went wrong looking that up. Check your connection.' }; }
    C.busy = false;
    if (r.idk) C.msgs.push({ me: 0, html: `<b>I don't know.</b> ${esc(r.why)}` });
    else C.msgs.push({ me: 0, html: r.hits.map(h => `<p>${esc(h.t)}</p><div class="tu-src">${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.src)}</a> · CC BY-SA` : esc(h.src)}</div>`).join('') });
    try { if (window.Hub) Hub.award('lib', 1); } catch (e) {}
    paint();
  }
  document.addEventListener('click', e => { const s = e.target.closest('[data-tu-s]'); if (s) ask(s.dataset.tuS); });
  window.LabMods.tutor = { open, answer, toks, _C: () => C };
})();
