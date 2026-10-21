/* Weak Spots: every Learn test question missed, every card pressed Again (and anatomy misses) comes back on a
   1 → 3 → 7-day schedule until it is answered right twice in a row. Stored as progress records (t:'ws'), synced via D1. */
'use strict';
(function () {
  const STEPS = [1, 3, 7]; // days
  const S = { run: null };
  const el = () => $('#v-weak');
  const items = () => [...M.progress.values()].filter(o => o.t === 'ws' && !o.del);
  const hash = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  const endToday = () => dayStart(Date.now()) + DAY;
  const isDue = o => !o.done && (o.due || 0) < endToday();
  function dueCount() { let n = 0; for (const o of M.progress.values()) if (o.t === 'ws' && !o.del && isDue(o)) n++; return n; }
  const tomorrow = () => dayStart(Date.now()) + ((window.Settings && Settings.weakDays()[0]) || 1) * DAY + 60e3; // due from tomorrow's 4 AM

  async function upsert(id, base) {
    const ex = M.progress.get(id);
    if (ex && !ex.del && !ex.done) { // missed again before it graduated: back to the start of the ladder
      await write([['progress', { ...ex, step: 0, streak: 0, due: tomorrow(), misses: (ex.misses || 0) + 1, last: Date.now() }]]); return false;
    }
    await write([['progress', { id, t: 'ws', ...base, step: 0, streak: 0, due: tomorrow(), done: 0, misses: 1, added: Date.now(), last: Date.now(), del: 0 }]]);
    return true;
  }
  // Learn: called from finishTest with the test state
  async function addLearnMisses(T, c, l, t) {
    const list = [];
    T.qs.forEach((q, i) => { if (!(T.ans[i] && T.ans[i].ok)) list.push(q); });
    let added = 0;
    for (const q of list) {
      const id = 'ws:L:' + l.id + ':' + hash(q.q);
      const qq = { q: q.q, type: q.type, choices: q.choices, answer: q.answer, explain: q.explain };
      if (await upsert(id, { src: 'learn', q: qq, label: (t.name || '') + ' · ' + l.title, topic: t.key, lid: l.id, lvl: T.lvl })) added++;
    }
    if (list.length) setTimeout(() => toast(`${list.length} missed question${list.length === 1 ? '' : 's'} → Weak Spots`), 400);
    return added;
  }
  // Cards: an Again press
  async function addCard(card) {
    if (!card || !card.id) return;
    const d = M.decks.get(card.deck);
    await upsert('ws:C:' + card.id, { src: 'card', cid: card.id, label: d ? d.name : 'Cards' });
  }
  // Anatomy / anything else: a self-contained question
  async function addQuestion(key, src, q, label) { return upsert('ws:' + src[0].toUpperCase() + ':' + key, { src, q, label }); }

  async function answer(o, right) {
    const rec = { ...o, last: Date.now(), reps: (o.reps || 0) + 1 };
    if (right) {
      rec.streak = (o.streak || 0) + 1;
      if (rec.streak >= 2) { rec.done = 1; rec.doneAt = Date.now(); }
      else { rec.step = Math.min((o.step || 0) + 1, STEPS.length - 1); rec.due = dayStart(Date.now()) + (window.Settings ? Settings.weakDays() : STEPS)[rec.step] * DAY + 60e3; }
    } else { rec.streak = 0; rec.step = 0; rec.due = tomorrow(); rec.misses = (o.misses || 0) + 1; }
    await write([['progress', rec]]);
    try { Hub.award('weak', right ? 3 : 1); } catch (e) {} try { if (window.Mastery) Mastery.weakAnswer(o, right); } catch (e) {}
    return rec;
  }

  /* ---------- UI ---------- */
  const SRC = { learn: ['🎓', 'Learn'], card: ['🃏', 'Cards'], anat: ['🫀', 'Anatomy'], doc: ['🩺', 'Doctordle'], rx: ['💊', 'Interactions'] };
  const when = t => { const d = Math.round((dayStart(t) - dayStart(Date.now())) / DAY); return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'; };
  function render() {
    if (S.run) return rQuiz();
    const all = items(), live_ = all.filter(o => !o.done), due = live_.filter(isDue).sort((a, b) => (a.due || 0) - (b.due || 0));
    const later = live_.filter(o => !isDue(o)).sort((a, b) => a.due - b.due), done = all.filter(o => o.done).length;
    const bySrc = {}; for (const o of live_) bySrc[o.src] = (bySrc[o.src] || 0) + 1;
    el().innerHTML = `<div class="ws-head"><div><div class="big">${due.length}</div><div class="muted small">due now · ${later.length} coming up · ${done} fixed</div></div>
      <button class="btn pri" data-ws-start ${due.length ? '' : 'disabled'}>Review</button></div>
      <p class="muted small">Missed Learn questions and cards you press <b>Again</b> come back after 1, 3 and 7 days. Get one right twice in a row and it's fixed.</p>
      ${!due.length && later.length ? `<button class="btn wide" data-ws-early>Practice ${Math.min(later.length, 20)} early</button>` : ''}
      ${Object.keys(bySrc).length ? `<div class="ws-src">${Object.entries(bySrc).map(([k, n]) => `<span class="chip">${(SRC[k] || ['•'])[0]} ${(SRC[k] || ['', k])[1]} <b>${n}</b></span>`).join('')}</div>` : ''}
      ${live_.length ? `<h3>Queue</h3><div class="ws-list">${[...due, ...later].slice(0, 60).map(o => `<div class="ws-row"><span class="ws-ic">${(SRC[o.src] || ['•'])[0]}</span><span class="ws-tx"><span class="t1">${esc(preview(o))}</span><span class="t2">${esc(o.label || '')}</span></span><span class="ws-when ${isDue(o) ? 'due' : ''}">${isDue(o) ? 'due' : when(o.due)}${o.streak ? ' · ✓' : ''}</span></div>`).join('')}</div>`
        : `<div class="empty">No weak spots yet. Miss a question in a Learn test or press <b>Again</b> on a card and it lands here.</div>`}`;
  }
  function preview(o) {
    if (o.src === 'card') { const c = M.cards.get(o.cid); if (!c || c.del) return '(card deleted)'; try { return stripHtml(renderCard(c).q).slice(0, 90); } catch (e) { return 'Card'; } }
    return String((o.q && o.q.q) || '').replace(/\*\*/g, '').replace(/_{2,}/g, '___').slice(0, 90);
  }
  async function fresh(list) { // re-read Learn questions from the live course so fixed keys and options apply
    if (!window.Learn || !Learn.getCourse) return list;
    try { await Learn.getManifest(); } catch (e) { return list; }
    const out = [];
    for (const o of list) {
      let r = o;
      try {
        const lid = o.lid || ((/^ws:L:(.+):[^:]+$/.exec(o.id || '') || [])[1]);
        if (o.src === 'learn' && lid && o.q && o.q.q) {
          const cid = String(lid).replace(/-l\d+$/, ''); const c = await Learn.getCourse(cid); const l = c && (c.lessons || []).find(x => x.id === lid);
          const all = l ? [...(l.test || []), ...(l.kidTest || []), ...(l.advancedTest || [])] : [];
          const n = all.find(x => x.q === o.q.q && x.type === o.q.type);
          if (n) r = Object.assign({}, o, { q: { q: n.q, type: n.type, choices: n.choices, answer: n.answer, accept: n.accept, explain: n.explain } });
        }
      } catch (e) {}
      out.push(r);
    }
    return out;
  }
  async function start(early) {
    let list = items().filter(o => !o.done && (early ? !isDue(o) : isDue(o))).sort((a, b) => (a.due || 0) - (b.due || 0));
    list = list.filter(o => o.src !== 'card' || (M.cards.get(o.cid) && !M.cards.get(o.cid).del)); if (window.Mastery) list = Mastery.weakOrder(list); list = list.slice(0, 20);
    if (!list.length) return;
    list = await fresh(list);
    if (window.Learn && Learn.shuffleChoices) list = list.map(o => (o.q && o.q.type === 'mc') ? Object.assign({}, o, { q: Learn.shuffleChoices(o.q) }) : o);
    S.run = { list, i: 0, ans: null, right: 0 }; render(); window.scrollTo(0, 0);
  }
  function rQuiz() {
    const R = S.run, o = R.list[R.i];
    if (!o) { const n = R.list.length; el().innerHTML = `<div class="result pass"><div class="big">${R.right}/${n}</div><div class="rl">Weak spots reviewed</div><div class="muted small">${R.fixed || 0} fixed for good</div></div><button class="btn pri wide" data-ws-done style="margin-top:14px">Done</button>`; return; }
    const a = R.ans, top = `<div class="tprog"><span>${R.i + 1} of ${R.list.length}</span><span class="muted">${esc(o.label || '')}</span></div><div class="pbar"><b style="width:${(R.i + (a ? 1 : 0)) / R.list.length * 100}%"></b></div>`;
    let body = '';
    if (o.src === 'card') {
      const c = M.cards.get(o.cid), f = renderCard(c);
      body = `<div class="qcard"><div class="qtype">Card</div><div class="face ws-face">${a ? f.a : f.q}</div>
        ${a ? `<div class="row" style="margin-top:12px"><button class="btn grow ws-bad" data-ws-self="0">✗ Missed</button><button class="btn pri grow" data-ws-self="1">✓ Got it</button></div>` : `<button class="btn pri wide" data-ws-show style="margin-top:12px">Show answer</button>`}</div>`;
    } else {
      const q = o.q;
      if (q.type === 'mc') body = `<div class="choices">${q.choices.map((ch, j) => { let cls = ''; if (a) { if (j === q.answer) cls = 'right'; else if (j === a.given) cls = 'wrong'; } return `<button class="choice ${cls}" data-ws-ch="${j}" ${a ? 'disabled' : ''}>${esc(ch)}</button>`; }).join('')}</div>`;
      else body = `<form id="wsTyped" class="typed" autocomplete="off"><input type="text" id="wsAns" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="${q.type === 'cloze' ? 'Fill the blank' : 'Type your answer'}" value="${a ? esc(a.given) : ''}" ${a ? 'disabled' : ''} class="${a ? (a.ok ? 'right' : 'wrong') : ''}"><button class="btn pri" ${a ? 'disabled' : ''}>Check</button></form>${a && !a.ok ? `<div class="corr">Answer: <b>${esc(q.answer)}</b></div>` : ''}`;
      body = `<div class="qcard"><div class="qtype">${q.type === 'mc' ? 'Multiple choice' : q.type === 'cloze' ? 'Fill in the blank' : 'Type the answer'}</div><div class="qq">${Learn.md(q.q)}</div>${body}
        ${a ? `<div class="expl ${a.ok ? 'ok' : 'bad'}"><b>${a.ok ? 'Correct.' : 'Not quite.'}</b> ${Learn.md(q.explain || '').replace(/^<p>|<\/p>$/g, '')}</div><button class="btn pri wide" data-ws-next style="margin-top:14px">${R.i + 1 < R.list.length ? 'Next' : 'Finish'}</button>` : ''}</div>`;
    }
    el().innerHTML = `<button class="lback" data-ws-quit>‹ Weak Spots</button>${top}${body}`;
    if (!a && o.src !== 'card' && o.q.type !== 'mc') { const f = $('#wsTyped'); f.onsubmit = e => { e.preventDefault(); const v = $('#wsAns').value; if (!v.trim()) return; grade(Learn.isRight(o.q, v), v); }; }
  }
  async function grade(ok, given) {
    const R = S.run, o = R.list[R.i]; R.ans = { ok, given };
    const rec = await answer(o, ok); if (ok) R.right++; if (rec.done) R.fixed = (R.fixed || 0) + 1;
    R.list[R.i] = rec; rQuiz();
  }
  document.addEventListener('click', e => {
    if (view !== 'weak') return;
    const t = e.target.closest('[data-ws-start],[data-ws-early],[data-ws-ch],[data-ws-show],[data-ws-self],[data-ws-next],[data-ws-quit],[data-ws-done]'); if (!t) return;
    const R = S.run;
    if (t.hasAttribute('data-ws-start')) start(false);
    else if (t.hasAttribute('data-ws-early')) start(true);
    else if (t.dataset.wsCh != null && R && !R.ans) { const o = R.list[R.i]; const j = +t.dataset.wsCh; grade(j === o.q.answer, j); }
    else if (t.hasAttribute('data-ws-show') && R) { R.ans = { shown: 1 }; rQuiz(); }
    else if (t.dataset.wsSelf != null && R) { const ok = t.dataset.wsSelf === '1'; R.ans = null; grade(ok, null).then(() => { R.i++; R.ans = null; rQuiz(); window.scrollTo(0, 0); }); }
    else if (t.hasAttribute('data-ws-next') && R) { R.i++; R.ans = null; rQuiz(); window.scrollTo(0, 0); }
    else if (t.hasAttribute('data-ws-quit') || t.hasAttribute('data-ws-done')) { S.run = null; render(); }
  });
  window.Weak = { render, dueCount, addLearnMisses, addCard, addQuestion, items, _S: S };
})();
