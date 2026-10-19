/* Explain this card: a deeper sheet built from real sources only: matching Learn lesson sections (course JSON) + the Wikipedia summary
   (via the app's own /api/wiki proxy, CSP stays same-origin). Says so plainly when nothing matches. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc;
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<br\s*\/?>/gi, ' ').replace(/<hr\s*\/?>/gi, ' | ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const STOP = new Set('the a an and or of to in on at by for with from as is are was were be this that these those it its into what which who how why when where does do did can not no your you der die das und ein eine ist sind le la les un une et est el los las y es son de del'.split(' '));
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>');
  function terms(q, a) {
    const out = [];
    const clean = s => s.replace(/\(.*?\)/g, '').replace(/^[\s"“'¿¡]*(the|a|an|der|die|das|le|la|el)\s+/i, '').replace(/[?.!:;,"”]+$/g, '').trim();
    const A = clean(a.split(' | ').pop() || a), Q = clean(q);
    if (A && A.split(' ').length <= 5 && A.length <= 48) out.push(A);
    const m = /^(?:what|which|who)\s+(?:is|are|was|were)\s+(?:the\s+|an?\s+)?(.{3,50}?)\??$/i.exec(Q); if (m) out.push(m[1]);
    if (Q && Q.split(' ').length <= 5 && Q.length <= 48) out.push(Q);
    const caps = (q + ' ' + a).match(/\b[A-Z][a-zA-Z-]{3,}(?:\s+[A-Z][a-zA-Z-]{3,}){0,2}\b/g) || [];
    for (const c of caps) if (!STOP.has(c.toLowerCase())) out.push(c);
    const long = (q + ' ' + a).split(/[^A-Za-zÀ-ÿ-]+/).filter(w => w.length >= 7 && !STOP.has(w.toLowerCase())).sort((x, y) => y.length - x.length);
    out.push(...long.slice(0, 3));
    return [...new Set(out.map(s => s.trim()).filter(s => s.length >= 3))].slice(0, 6);
  }
  let manP = null;
  function manifest() { return manP || (manP = fetch('learn/manifest.json').then(r => r.json()).catch(e => { manP = null; throw e; })); }
  async function learnHits(ts) {
    const man = await manifest(), want = ts.map(fold), toks = [...new Set(want.flatMap(t => t.split(/[^a-z0-9]+/).filter(w => w.length > 3 && !STOP.has(w))))];
    if (!toks.length) return [];
    const cand = [];
    for (const tp of man.topics) for (const c of tp.courses) {
      const hay = fold([c.title, c.summary, (c.lessons || []).join(' '), JSON.stringify(c.targets || {})].join(' '));
      let s = 0; for (const t of want) if (hay.includes(t)) s += 5; for (const w of toks) if (hay.includes(w)) s += 1;
      if (s) cand.push({ s, tp, c });
    }
    cand.sort((a, b) => b.s - a.s);
    const hits = [];
    for (const k of cand.slice(0, 4)) {
      let course; try { const r = await fetch('learn/' + k.tp.key + '/' + k.c.id + '.json'); if (!r.ok) continue; course = await r.json(); } catch (e) { continue; }
      for (const ls of course.lessons || []) {
        const kp = (ls.keyPoints || []).filter(p => want.some(t => fold(p).includes(t)) || toks.filter(w => fold(p).includes(w)).length >= Math.min(2, toks.length));
        const lvl = (ls.levels && (ls.levels.college || ls.levels.hs || ls.levels.phd)) || '';
        const paras = lvl.split(/\n{2,}/).filter(p => want.some(t => fold(p).includes(t)));
        const sc = kp.length * 2 + paras.length * 3 + (want.some(t => fold(ls.title).includes(t)) ? 6 : 0);
        if (sc) hits.push({ sc, topic: k.tp.name, course: course.title, lesson: ls.title, kp: kp.slice(0, 3), para: paras[0] ? paras[0].slice(0, 700) : '' });
      }
      if (hits.length >= 6) break;
    }
    return hits.sort((a, b) => b.sc - a.sc).slice(0, 2);
  }
  async function wiki(ts) {
    for (const t of ts.slice(0, 3)) {
      try { const r = await fetch('/api/wiki/summary?t=' + encodeURIComponent(t)); if (!r.ok) continue; const j = await r.json(); if (j && j.found) return j; } catch (e) {}
    }
    return null;
  }
  let gen = 0;
  async function open(card) {
    const note = card && M.notes.get(card.nid); if (!note) return;
    const f = renderCard(card), q = plain(note.type === 'cloze' ? clozeRender(note.front, card.ord, false).replace(/\[(?:…|[^\]]*)\]/g, '…') : card.ord === 1 ? note.back : note.front);
    const a = plain(note.type === 'cloze' ? ((new RegExp('\\{\\{c' + card.ord + '::([\\s\\S]*?)(?:::|\\}\\})').exec(note.front) || [])[1] || '') : card.ord === 1 ? note.front : note.back);
    const ts = terms(q, a);
    show(q, a, ts, null);
    run(q, a, ts);
  }
  async function run(q, a, ts) {
    const my = ++gen;
    const [lh, wk] = await Promise.all([learnHits(ts).catch(() => []), wiki(ts).catch(() => null)]);
    if (my !== gen) return;
    show(q, a, ts, { lh, wk });
    try { if (window.Hub) Hub.award('lib', 1); } catch (e) {}
  }
  function show(q, a, ts, R) {
    let body;
    if (!R) body = '<div class="xp-load">Looking through your lessons and Wikipedia…</div>';
    else if (!R.lh.length && !R.wk) body = `<div class="xp-none"><b>No deeper info found</b> for ${ts.length ? '“' + esc(ts[0]) + '”' : 'this card'}. Try a different word below.</div>`;
    else {
      body = R.lh.map(h => `<div class="xp-sec"><div class="xp-src">From your Learn lessons · ${esc(h.topic)} › ${esc(h.course)} › ${esc(h.lesson)}</div>${h.para ? `<p>${md(h.para)}</p>` : ''}${h.kp.length ? `<ul>${h.kp.map(k => `<li>${md(k)}</li>`).join('')}</ul>` : ''}</div>`).join('');
      if (R.wk) body += `<div class="xp-sec"><div class="xp-src">Wikipedia · ${esc(R.wk.title)}${R.wk.desc ? ' · ' + esc(R.wk.desc) : ''}</div><p>${esc(R.wk.extract)}</p><div class="img-cred"><a href="${esc(R.wk.url)}" target="_blank" rel="noopener">Read on Wikipedia</a> · text CC BY-SA 4.0</div></div>`;
      if (R.lh.length) body += `<button class="btn lb-wide" data-xp-learn type="button">Open Learn</button>`;
    }
    openSheet(`<div class="xp"><h2>Explain this card</h2><div class="xp-card"><div class="xp-q">${esc(q)}</div><div class="xp-a">${esc(a)}</div></div>${body}
      <form class="xp-f" data-xp-form autocomplete="off"><input type="text" id="xpTerm" value="${esc(ts[0] || '')}" placeholder="Look up another word" autocapitalize="off"><button class="btn" type="submit">Look up</button></form>
      <div class="actions"><button class="btn pri" data-close type="button">Close</button></div></div>`);
    const fm = document.querySelector('[data-xp-form]'); if (fm) fm.onsubmit = e => { e.preventDefault(); const v = document.getElementById('xpTerm').value.trim(); if (v) { const t2 = [v].concat(ts.filter(x => x !== v)); show(q, a, t2, null); run(q, a, t2); } };
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-xp-learn]')) { closeSheet(); go('learn'); } });
  window.LabMods.explain = { open, terms, _gen: () => gen };
})();
