/* Make flashcards from a lesson: one tap turns a Learn lesson's **bold** terms, key points and test questions into
   cards in a deck named after the course. Preview sheet with checkboxes; note ids are deterministic so the same
   lesson never makes the same card twice. Uses app.js's own note/card shape (cardsForNote) so the scheduler takes them. */
'use strict';
(function () {
  const S = { cands: null, ctx: null };
  const hash = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  const clean = s => String(s || '').replace(/\r/g, '').replace(/\s+/g, ' ').trim();
  const strip = s => clean(s).replace(/\*\*/g, '');
  const fmt = s => esc(clean(s)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); // markdown bold → html, everything else escaped
  const LVN = { kid: "Like I'm 5", hs: 'High school', college: 'College', phd: 'PhD', expert: 'Doctor / Expert' };
  const deckIdFor = course => 'd-mk-' + course.id;
  const nid = (lid, kind, front) => 'n-mk-' + lid + '-' + kind[0] + hash(strip(front).toLowerCase());

  // split a lesson text into sentences/list items (keeps **bold** markers)
  function chunks(text) {
    const out = [];
    for (const line of String(text || '').replace(/\r/g, '').split(/\n+/)) {
      const l = line.replace(/^\s*[-•]\s+/, '').trim(); if (!l) continue;
      // split on sentence ends that are outside bold markers
      const parts = l.match(/[^.!?]+(?:\*\*[^*]*\*\*[^.!?]*)*[.!?]*|[^.!?]+$/g) || [l];
      let buf = '';
      for (const p of parts) { buf += p; const open = (buf.match(/\*\*/g) || []).length % 2; if (!open) { if (buf.trim()) out.push(buf.trim()); buf = ''; } }
      if (buf.trim()) out.push(buf.trim());
    }
    return out;
  }
  // "**term** = meaning", "**term** (meaning)", "**term** — meaning", "**term**: meaning"
  function defOf(s) {
    s = s.replace(/^[^*:=]{1,32}:\s*(?=\*\*)/, ''); // "Purpose: **Estudio para…** = …" → drop the label
    let m = s.match(/^\*\*([^*]{1,80})\*\*\s*(?:=|→|—|–|:)\s*(.{2,200})$/);
    if (m) return [m[1].trim(), m[2].replace(/\*\*/g, '').trim()];
    m = s.match(/^\*\*([^*]{1,80})\*\*\s*\(([^)]{2,120})\)\s*[.;]?$/);
    if (m) return [m[1].trim(), m[2].trim()];
    m = s.match(/^([^*=]{1,60}?)\s+=\s+(.{2,200})$/); // plain "a = b" (key points often look like this)
    if (m && !/\d\s*$/.test(m[1])) return [m[1].trim(), m[2].replace(/\*\*/g, '').trim()];
    return null;
  }
  function build(lesson, lvl, topic, course) {
    const lid = lesson.id, out = [], seen = new Set();
    const push = c => { const k = strip(c.front).toLowerCase(); if (!k || seen.has(k)) return; seen.add(k); c.id = nid(lid, c.kind, c.type === 'cloze' ? c.front + '|' + c.term : c.front); out.push(c); };
    // 1) bold terms in the chosen level's text, then key points
    const texts = [...chunks(lesson.levels && lesson.levels[lvl])];
    for (const s of texts) {
      if (s.length > 260) continue;
      const pairs = [...s.matchAll(/\*\*([^*]{1,60})\*\*\s*(?:=|→)\s*([^*]+?)(?=[,;]\s*\*\*|\s*$)/g)];
      if (pairs.length >= 2) { for (const m of pairs) push({ kind: 'term', type: 'basic', front: m[1].trim(), back: m[2].replace(/[,;.]\s*$/, '').trim() }); continue; }
      const d = defOf(s);
      if (d) { push({ kind: 'term', type: 'basic', front: d[0], back: d[1] }); continue; }
      const bolds = [...s.matchAll(/\*\*([^*]{2,60})\*\*/g)].map(m => m[1].trim());
      if (bolds.length && s.replace(/\*\*/g, '').length >= 30) {
        const term = bolds[0];
        if (term.split(' ').length > 6) continue;
        const front = s.replace('**' + bolds[0] + '**', '{{c1::' + term + '}}');
        push({ kind: 'term', type: 'cloze', front, term, back: '' });
      }
    }
    for (const k of lesson.keyPoints || []) {
      const s = clean(k); const d = defOf(s);
      if (d) { push({ kind: 'key', type: 'basic', front: d[0], back: d[1] }); continue; }
      const b = s.match(/\*\*([^*]{2,60})\*\*/);
      if (b) { push({ kind: 'key', type: 'cloze', front: s.replace(b[0], '{{c1::' + b[1].trim() + '}}'), term: b[1].trim(), back: '' }); continue; }
      const num = s.match(/(?<![\w.])(\d+(?:[.,]\d+)?(?:\s?(?:%|mmol\/L|kPa|mmHg|ms|mV|years?|days?|hours?|minutes?|cm|mm|kg|°C))?)(?![\w])/);
      if (num && s.length > 25) { push({ kind: 'key', type: 'cloze', front: s.replace(num[1], '{{c1::' + num[1] + '}}'), term: num[1], back: '' }); continue; }
      const cap = (s.slice(1).match(/\b[A-Z][A-Za-zÀ-ÿ'-]{3,}(?:\s[A-Z][A-Za-zÀ-ÿ'-]+)*/) || [])[0];
      if (cap && s.length > 25) { push({ kind: 'key', type: 'cloze', front: s.replace(cap, '{{c1::' + cap + '}}'), term: cap, back: '' }); continue; }
      push({ kind: 'key', type: 'basic', front: 'Key point: ' + lesson.title, back: s }); // still useful as a recall prompt
    }
    // 3) test questions (the level's own test)
    const test = lvl === 'kid' && (lesson.kidTest || []).length ? lesson.kidTest : (lvl === 'phd' || lvl === 'expert') && lesson.advancedTest ? [...(lesson.test || []), ...lesson.advancedTest] : (lesson.test || []);
    for (const q of test) {
      if (!q || !q.q) continue;
      const ans = q.type === 'mc' ? (q.choices || [])[q.answer] : q.answer; if (ans == null || ans === '') continue;
      push({ kind: 'question', type: 'basic', front: clean(q.q), back: '**' + clean(ans) + '**' + (q.explain ? '\n\n' + clean(q.explain) : '') });
    }
    return out;
  }
  function noteOf(c, deck, tags, i) {
    const front = c.type === 'cloze' ? fmt(c.front) : fmt(c.front);
    const back = String(c.back || '').split('\n\n').map(fmt).join('<br><br>');
    return { id: c.id, deck, type: c.type, front, back, tags, img: null, imgSide: 'back', created: Date.now() + i };
  }
  const exists = id => { const n = M.notes.get(id); return !!(n && !n.del); };
  const KLABEL = { term: 'Term', key: 'Key point', question: 'Question' };
  const showFront = c => c.type === 'cloze' ? esc(strip(c.front)).replace(/\{\{c1::([\s\S]*?)\}\}/, '<span class="mk-blank">$1</span>') : esc(strip(c.front));

  function fromLesson(lesson, lvl, topic, course) {
    if (!lesson || !course) { toast('Open a lesson first'); return; }
    lvl = lvl || 'hs'; topic = topic || { name: '', tag: '' };
    const all = build(lesson, lvl, topic, course), fresh = all.filter(c => !exists(c.id)), dup = all.length - fresh.length;
    const deckName = (topic.name ? topic.name + ' ' + course.n + ' · ' : '') + course.title;
    S.cands = fresh; S.ctx = { lesson, lvl, topic, course, deckName }; S.on = new Set(fresh.map((_, i) => i));
    if (!fresh.length) { toast(all.length ? 'Cards from this lesson are already in your decks' : 'Nothing to make cards from in this lesson'); return; }
    openSheet(`<div class="mk"><div class="mk-head"><h2>Make flashcards</h2><div class="mk-sub">${esc(lesson.title)} · ${esc(LVN[lvl] || lvl)}</div></div>
      <div class="mk-deck">${window.Prefs && Prefs.icon ? Prefs.icon('decks', 18) : ''}<span>Deck</span><b>${esc(deckName)}</b></div>
      <div class="mk-bar"><span class="mk-count" data-mk-count></span><button type="button" class="mk-link" data-mk-all>Select none</button></div>
      <div class="mk-list">${fresh.map((c, i) => `<label class="mk-row"><input type="checkbox" checked data-mk-i="${i}"><span class="mk-chk" aria-hidden="true"></span><span class="mk-tx"><span class="mk-k">${KLABEL[c.kind]}${c.type === 'cloze' ? ' · fill in' : ''}</span><span class="mk-f">${showFront(c)}</span>${c.type === 'basic' ? `<span class="mk-b">${esc(strip(c.back).slice(0, 160))}</span>` : ''}</span></label>`).join('')}</div>
      ${dup ? `<p class="mk-note">${dup} card${dup === 1 ? ' is' : 's are'} already in your decks from this lesson and won't be added again.</p>` : ''}
      <div class="mk-actions"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn pri" data-mk-add></button></div></div>`);
    paintCount();
  }
  function paintCount() {
    const n = S.on.size, b = document.querySelector('[data-mk-add]'), c = document.querySelector('[data-mk-count]'), a = document.querySelector('[data-mk-all]');
    if (b) { b.textContent = n ? `Add ${n} card${n === 1 ? '' : 's'}` : 'Add cards'; b.disabled = !n; }
    if (c) c.textContent = `${n} of ${S.cands.length} selected`;
    if (a) a.textContent = n === S.cands.length ? 'Select none' : 'Select all';
  }
  async function add() {
    const { course, topic, lesson, deckName } = S.ctx, deck = deckIdFor(course), list = [];
    const d = M.decks.get(deck);
    if (!d || d.del) list.push(['decks', { ...(d || {}), id: deck, name: deckName, del: 0 }]);
    const tags = [...new Set([topic.tag || topic.name, 'Learn::Made::' + (topic.tag || topic.name || 'Lesson').replace(/\s+/g, '_'), ...(lesson.cardTags || []).slice(0, 2)].filter(Boolean))];
    let added = 0; const base = Date.now();
    [...S.on].sort((a, b) => a - b).forEach((i, k) => {
      const c = S.cands[i]; if (!c || exists(c.id)) return;
      const note = noteOf(c, deck, tags, k); M.notes.set(note.id, note);
      list.push(['notes', note], ...cardsForNote(note, base + k * 2)); added++;
    });
    if (list.length) await write(list);
    closeSheet();
    const short = deckName.split(' · ')[0];
    toast(added ? `Added ${added} card${added === 1 ? '' : 's'} to “${short}”` : 'Already in your cards', 2600);
    try { window.Prefs && Prefs.sound && Prefs.sound('ok'); window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (e) {}
    return added;
  }
  document.addEventListener('change', e => { const t = e.target; if (!t.matches || !t.matches('[data-mk-i]')) return; const i = +t.dataset.mkI; if (t.checked) S.on.add(i); else S.on.delete(i); paintCount(); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-mk-add],[data-mk-all],[data-mkcards]'); if (!t) return;
    if (t.hasAttribute('data-mk-add')) { t.disabled = true; add(); }
    else if (t.hasAttribute('data-mk-all')) { const all = S.on.size !== S.cands.length; S.on = new Set(all ? S.cands.map((_, i) => i) : []); document.querySelectorAll('[data-mk-i]').forEach(x => { x.checked = all; }); paintCount(); }
    else if (t.hasAttribute('data-mkcards')) fromRoute(); // the button on the Learn lesson page
  });
  // read the open lesson from Learn's own state (used by the lesson-page button)
  function fromRoute() {
    if (!window.Learn || !Learn._S) return; const L = Learn._S, r = L.route || {}, c = L.courses.get(r.cid); if (!c) return;
    const t = L.manifest && L.manifest.topics.find(x => x.courses.some(cc => cc.id === r.cid));
    fromLesson(c.lessons[r.li], r.lvl, t, c);
  }
  window.MakeCards = { fromLesson, fromRoute, build, _S: S };
})();
