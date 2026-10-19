/* Exam planner: set a test name, date and decks; it builds a day-by-day review plan and puts today's target on the home screen. Saved on-device + synced (progress record lab:plan). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null;
  const P = L.plan;
  function render(el) {
    S = { el, mode: 'list', edit: null };
    if (!el.__pl) { el.__pl = 1; el.addEventListener('click', onClick); el.addEventListener('submit', e => { e.preventDefault(); save(); }); }
    paint();
  }
  const fmt = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); };
  function paint() {
    if (!S || !S.el.isConnected) return; let h = ''; const st = P.get();
    if (S.mode === 'list') {
      h = L.top('Exam planner', '', 'tools') + `<p class="muted lb-p">Tell it when your test is and which decks it covers. It spreads the new cards over the days you have, keeps the last day for review, and puts today's target on the home screen.</p>`;
      const ex = st.exams.slice().sort((a, b) => a.date < b.date ? -1 : 1);
      if (!ex.length) h += '<div class="lb-empty">No exams planned yet.</div>';
      h += ex.map(x => { const c = P.calc(x); return `<div class="pl-card"><div class="pl-h"><b>${esc(x.name)}</b><span>${c.past ? 'done' : c.days === 0 ? 'TODAY' : c.days + ' day' + (c.days === 1 ? '' : 's')}</span></div><div class="muted small">${fmt(x.date)} · ${c.decks.map(d => esc(d.name)).join(', ') || 'no decks'}</div>
        ${c.past ? '' : `<div class="pl-today">Today: <b>${c.today}</b> cards (${c.newToday} new + ${c.due} due)</div><div class="pl-days">${c.plan.slice(0, 14).map(p => `<div class="${p.k === c.todayKey ? 'on' : ''}"><span>${esc(fmt(p.k))}</span><span>${p.exam ? '📝 exam' : p.review ? 'review everything due' : p.n + ' new + due'}</span></div>`).join('')}</div>`}
        <div class="lb-btns">${c.past ? '' : `<button class="btn pri" data-pl-study="${x.id}" type="button">Study now</button>`}<button class="btn" data-pl-edit="${x.id}" type="button">Edit</button><button class="btn" data-pl-del="${x.id}" type="button">${c.past ? 'Remove' : 'Delete'}</button></div></div>`; }).join('');
      h += `<div class="lb-btns"><button class="btn pri" data-pl-new type="button">+ Plan an exam</button></div>`;
    } else {
      const x = S.edit, decks = [...M.decks.values()].filter(d => !d.del).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      h = `<div class="lb-top"><button class="lb-back" type="button" data-pl-list>${ic('back', 18)}<span>Planner</span></button><span class="lb-tr"></span></div><h2 class="lb-title">${x.id ? 'Edit exam' : 'New exam'}</h2>
        <form class="pl-form" autocomplete="off"><label>Name<input data-pl-name type="text" value="${esc(x.name)}" placeholder="e.g. Biology unit test" maxlength="60"></label>
        <label>Date<input data-pl-date type="date" value="${esc(x.date)}" min="${P.todayKey()}"></label>
        <div class="pl-dk"><span>Decks it covers</span>${decks.length ? decks.map(d => `<label class="pl-ck"><input type="checkbox" data-pl-deck="${esc(d.id)}" ${x.decks.includes(d.id) ? 'checked' : ''}> ${esc(d.name)}</label>`).join('') : '<p class="muted small">Make a deck first.</p>'}</div>
        <button class="btn pri lb-wide" type="submit">Save plan</button></form>`;
    }
    S.el.innerHTML = `<div class="lb pl">${h}</div>`;
  }
  function save() {
    const f = S.el; const name = f.querySelector('[data-pl-name]').value.trim() || 'Exam', date = f.querySelector('[data-pl-date]').value, decks = [...f.querySelectorAll('[data-pl-deck]:checked')].map(i => i.dataset.plDeck);
    if (!date) { try { toast('Pick a date'); } catch (e) {} return; }
    const st = P.get(); const x = Object.assign(S.edit, { name, date, decks }); if (!x.id) { x.id = 'ex' + Date.now().toString(36); x.created = Date.now(); st.exams.push(x); } else { const i = st.exams.findIndex(e => e.id === x.id); if (i >= 0) st.exams[i] = x; }
    P.set(st); try { window.Hub && Hub.award('lib', 2); } catch (e) {} S.mode = 'list'; paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-pl-list]')) { S.mode = 'list'; paint(); return; }
    if (t.closest('[data-pl-new]')) { const d = new Date(Date.now() + 7 * 864e5); S.edit = { id: '', name: '', date: P.key(d), decks: [] }; S.mode = 'edit'; paint(); window.scrollTo(0, 0); return; }
    const ed = t.closest('[data-pl-edit]'); if (ed) { S.edit = JSON.parse(JSON.stringify(P.get().exams.find(x => x.id === ed.dataset.plEdit))); S.mode = 'edit'; paint(); window.scrollTo(0, 0); return; }
    const dl = t.closest('[data-pl-del]'); if (dl) { const st = P.get(); st.exams = st.exams.filter(x => x.id !== dl.dataset.plDel); P.set(st); paint(); return; }
    const sd = t.closest('[data-pl-study]'); if (sd) { P.study(sd.dataset.plStudy); return; }
  }
  window.LabMods.plan = { render, _S: () => S };
})();
