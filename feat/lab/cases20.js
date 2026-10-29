/* Case modes (v179): Night shift, Differential duel and Study squad (pass-and-play on one phone), Zebra of the week,
   Case remix, Misdiagnosis museum, Symptom-first browse, Wrong-guess autopsy and Ghost attending.
   All built on the Doctordle case library (doctordle/cases.json). Everything is saved on this phone only (localStorage l20.*);
   nothing new is synced or sent anywhere. The attending is scripted from each case's own teaching notes, not AI. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  if (!document.getElementById('l20css')) { const l = document.createElement('link'); l.id = 'l20css'; l.rel = 'stylesheet'; l.href = 'feat/lab/labs20.css?v=' + L.VER; document.head.appendChild(l); }
  const CL = [['complaint', 'Complaint'], ['history', 'History'], ['vitals', 'Vitals'], ['exam', 'Exam'], ['labs', 'Labs'], ['imaging', 'Imaging & tests']];
  function store(key) { const lk = 'l20.' + key; return { get(def) { try { const o = JSON.parse(localStorage.getItem(lk) || 'null'); return o && typeof o === 'object' ? o : def; } catch (e) { return def; } }, set(o) { o.at = Date.now(); try { localStorage.setItem(lk, JSON.stringify(o)); } catch (e) {} } }; }
  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = (t = Date.now()) => { const d = new Date(t - 4 * 36e5); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
  const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const award = xp => L.award('doc', xp);
  let CASES = null;
  const loadCases = () => CASES ? Promise.resolve(CASES) : L.json('doctordle/cases.json').then(d => (CASES = (d && d.cases) || []));
  const byId = id => (CASES || []).find(c => c.id === id) || null;
  const clueText = (c, k) => k === 'complaint' ? c.complaint : (c.clues && c.clues[k]) || '';
  const titleCase = s => String(s).replace(/\b([a-z])/g, m => m.toUpperCase());
  // a "near miss" name → the library case that matches it (so we can use its full name), else the name itself
  function nearCase(key) { const k = norm(key); return (CASES || []).find(c => norm(c.dx) === k || (c.aliases || []).some(a => norm(a) === k)) || null; }
  function nearLabel(key) { const c = nearCase(key); return c ? c.dx : titleCase(key); }
  // n answer choices: the right one, its near misses, then same-system cases
  function options(c, n = 4) {
    const out = [{ label: c.dx, ok: 1, key: null }], seen = new Set([norm(c.dx)]);
    for (const k of L.shuffle(Object.keys(c.near || {}))) { const lab = nearLabel(k); if (seen.has(norm(lab))) continue; seen.add(norm(lab)); out.push({ label: lab, ok: 0, key: k }); if (out.length >= n) break; }
    const pool = L.shuffle(CASES.filter(x => x.id !== c.id)).sort((a, b) => (b.system === c.system) - (a.system === c.system));
    for (const x of pool) { if (out.length >= n) break; if (seen.has(norm(x.dx))) continue; seen.add(norm(x.dx)); out.push({ label: x.dx, ok: 0, key: null }); }
    return L.shuffle(out);
  }
  /* ---------- wrong-guess autopsy ---------- */
  const STOP = new Set('the a an and or of to in on for with by is are was were be been it its this that there no not but she he his her has had have they them their than then from into out also more most very can cant doesnt dont isnt would could should which what when where while who think about after before over under only just like here would'.split(' '));
  const terms = s => [...new Set(norm(s).split(' ').filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/(ing|ed|es|s)$/, '')))];
  // which clue held the tell: the clue that shares the most words with the teaching note on why the guess was wrong
  function tell(c, key) {
    const why = key && c.near ? c.near[key] : '', ref = terms(why + ' ' + (why ? '' : (c.explain && c.explain.confirm) || '') + ' ' + (c.pearl || ''));
    let best = null, bs = -1;
    for (const [k, name] of CL) { if (k === 'complaint') continue; const tx = clueText(c, k); if (!tx) continue; const tw = new Set(terms(tx)); const sc = ref.filter(w => tw.has(w)).length; if (sc > bs) { bs = sc; best = { k, name, text: tx, words: ref.filter(w => tw.has(w)) }; } }
    return best;
  }
  function mark(text, words) { // highlight the shared words (text is escaped first)
    let h = esc(text); if (!words || !words.length) return h;
    const rx = new RegExp('\\b(' + words.map(w => w.replace(/[^a-z0-9]/g, '')).filter(Boolean).join('|') + ')[a-z]*', 'gi');
    return h.replace(rx, m => '<mark>' + m + '</mark>');
  }
  const WS = store('wrong');
  function logWrong(c, opt, mode) { if (!c || !opt || opt.ok) return; const D = WS.get({ log: [] }); D.log.push({ id: c.id, g: String(opt.label).slice(0, 120), k: opt.key || '', m: mode, t: Date.now() }); D.log = D.log.slice(-200); WS.set(D); }
  function autopsyHTML(c, opt) {
    if (!c) return '';
    const key = opt && opt.key, why = key && c.near ? c.near[key] : '', t = tell(c, key);
    return `<div class="lb-card l20-aut"><h3>Wrong-guess autopsy</h3>
      <p class="small muted">You said <b>${esc(opt ? opt.label : '?')}</b>. It was <b>${esc(c.dx)}</b>.</p>
      ${why ? `<p class="l20-why"><b>Why not ${esc(opt.label)}:</b> ${esc(why)}</p>` : `<p class="l20-why">${esc(opt ? opt.label : 'That')} isn't one of this case's classic look-alikes, so the case's own key fact is below.</p>`}
      ${t ? `<div class="l20-tell"><div class="l20-k">The clue that should have tipped you: ${esc(t.name)}</div><p>${mark(t.text, t.words)}</p></div>` : ''}
      ${c.pearl ? `<p class="small"><b>Pearl:</b> ${esc(c.pearl)}</p>` : ''}</div>`;
  }
  function explainHTML(c) { const e = c.explain || {}; return `<details class="lb-card l20-ex"><summary>Read the full explanation</summary>${e.patho ? `<p><b>What's going on.</b> ${esc(e.patho)}</p>` : ''}${e.confirm ? `<p><b>How it's confirmed.</b> ${esc(e.confirm)}</p>` : ''}${e.treat ? `<p><b>Treatment.</b> ${esc(e.treat)}</p>` : ''}</details>`; }
  function cluesHTML(c, n, hl) { return `<div class="l20-clues">${CL.slice(0, n).map(([k, name], i) => `<div class="l20-clue${hl === k ? ' hl' : ''}"><div class="l20-k">${i + 1}. ${esc(name)}</div><p>${esc(clueText(c, k))}</p></div>`).join('')}</div>`; }
  const optsHTML = (opts, attr, picked) => `<div class="l20-opts">${opts.map((o, i) => `<button type="button" class="btn l20-opt${picked != null ? (o.ok ? ' ok' : i === picked ? ' bad' : '') : ''}" ${picked != null ? 'disabled' : ''} ${attr}="${i}">${esc(o.label)}</button>`).join('')}</div>`;
  const loading = el => { el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>'; };
  const failed = el => { el.innerHTML = `<div class="lb">${L.top('', '', 'lab')}<div class="lb-empty">Couldn't load the case library. Check your connection and try again.</div></div>`; };
  function boot(el, key, fn) { el.__l20 = key; loading(el); loadCases().then(() => { if (el.isConnected && el.__l20 === key) fn(); }).catch(() => { if (el.isConnected) failed(el); }); }
  function mount(el, key, onClick) { if (el['__l20m' + key]) return; el['__l20m' + key] = 1; el.addEventListener('click', e => { if (el.__l20 === key) onClick(e); }); }
  const head = (t, p, back) => L.top(t, '', back || 'lab') + (p ? `<p class="muted lb-p">${p}</p>` : '');

  /* ---------- 1. Night shift ---------- */
  const NS = store('night');
  const night = { render(el) {
    night.el = el; night.R = null; clearInterval(night.tk);
    mount(el, 'night', e => {
      const t = e.target.closest('[data-ns]'); if (!t) return; const a = t.dataset.ns, R = night.R;
      if (a === 'start') { const n = +t.dataset.n || 5; night.R = { ids: L.shuffle(CASES).slice(0, n).map(c => c.id), i: 0, res: [], score: 0 }; nsCase(); return; }
      if (a === 'clue' && R && R.cur && R.cur.pick == null) { R.cur.n = Math.min(6, R.cur.n + 1); nsDraw(); return; }
      if (a === 'pick' && R && R.cur && R.cur.pick == null) { nsPick(+t.dataset.i); return; }
      if (a === 'next' && R) { R.i++; if (R.i >= R.ids.length) nsEnd(); else nsCase(); return; }
      if (a === 'aut' && R) { const r = R.res[+t.dataset.i]; if (r) { R.aut = r; nsDraw(); } return; }
      if (a === 'home') { clearInterval(night.tk); night.R = null; nsDraw(); }
    });
    boot(el, 'night', nsDraw);
  } };
  const NS_T = 60, NS_REVEAL = 8;
  function nsCase() {
    const R = night.R, c = byId(R.ids[R.i]); R.aut = null;
    R.cur = { c, opts: options(c, 4), n: 1, pick: null, t0: Date.now(), left: NS_T };
    clearInterval(night.tk);
    night.tk = setInterval(() => {
      if (!night.el || !night.el.isConnected || night.el.__l20 !== 'night' || !night.R || !night.R.cur || night.R.cur.pick != null) { clearInterval(night.tk); return; }
      const cu = night.R.cur, el2 = (Date.now() - cu.t0) / 1000; cu.left = Math.max(0, Math.ceil(NS_T - el2));
      const want = Math.min(6, 1 + Math.floor(el2 / NS_REVEAL)); if (want > cu.n) { cu.n = want; nsDraw(); }
      const tm = night.el.querySelector('[data-ns-t]'); if (tm) { tm.textContent = cu.left + 's'; tm.classList.toggle('low', cu.left <= 10); }
      if (cu.left <= 0) nsPick(-1);
    }, 250);
    nsDraw();
  }
  function nsPick(i) {
    const R = night.R, cu = R.cur; clearInterval(night.tk); cu.pick = i;
    const o = cu.opts[i], ok = !!(o && o.ok), secs = Math.round((Date.now() - cu.t0) / 1000);
    const pts = ok ? Math.max(10, 100 - (cu.n - 1) * 12) + Math.max(0, NS_T - secs) : 0;
    R.score += pts; R.res.push({ id: cu.c.id, ok, n: cu.n, secs, pts, opt: o || { label: 'Ran out of time', ok: 0, key: null } });
    if (!ok) logWrong(cu.c, o || { label: 'Ran out of time', ok: 0, key: null }, 'night');
    L.fx(ok); if (ok) award(4);
    nsDraw();
  }
  function nsEnd() {
    const R = night.R, D = NS.get({ best: 0, runs: 0 }); R.done = 1; R.newBest = R.score > (D.best || 0);
    D.best = Math.max(D.best || 0, R.score); D.runs = (D.runs || 0) + 1; NS.set(D); nsDraw();
  }
  function nsDraw() {
    const el = night.el, R = night.R; if (!el || !el.isConnected) return; let h;
    if (!R) {
      const D = NS.get({ best: 0, runs: 0 });
      h = head('Night shift', 'Back-to-back mini cases on the clock, like an ER rush. A new clue drops every 8 seconds; diagnose as early as you dare. Fewer clues and a faster call score more.') +
        `<div class="lb-card"><p>Best shift: <b>${D.best || 0}</b> points · ${D.runs || 0} shift${D.runs === 1 ? '' : 's'} worked</p></div>
        <div class="lb-btns"><button type="button" class="btn pri" data-ns="start" data-n="5">5 cases</button><button type="button" class="btn" data-ns="start" data-n="10">10 cases</button></div>`;
    } else if (R.done) {
      const ok = R.res.filter(r => r.ok).length;
      h = head('Shift over', '') + `<div class="lb-card"><h3>${R.score} points${R.newBest ? ' · new best!' : ''}</h3><p>${ok}/${R.res.length} diagnosed.</p></div>
        <div class="lb-group">${R.res.map((r, i) => { const c = byId(r.id); return `<div class="lb-row l20-res ${r.ok ? 'ok' : 'bad'}"><span class="lb-rt"><span class="t1">${esc(c.dx)}</span><span class="t2">${r.ok ? `${r.n} clue${r.n === 1 ? '' : 's'} · ${r.secs}s · +${r.pts}` : `you said ${esc(r.opt.label)}`}</span></span>${r.ok ? '' : `<button type="button" class="btn sm" data-ns="aut" data-i="${i}">Autopsy</button>`}</div>`; }).join('')}</div>
        ${R.aut ? autopsyHTML(byId(R.aut.id), R.aut.opt) : ''}
        <div class="lb-btns"><button type="button" class="btn pri" data-ns="start" data-n="${R.ids.length}">Another shift</button><button type="button" class="btn" data-ns="home">Done</button></div>`;
    } else {
      const cu = R.cur, c = cu.c, o = cu.pick != null ? cu.opts[cu.pick] : null;
      h = L.top('', `<span class="l20-timer" data-ns-t>${cu.pick == null ? cu.left + 's' : ''}</span>`, 'lab') +
        `<div class="l20-prog"><span>Case ${R.i + 1} / ${R.ids.length}</span><span>${R.score} pts</span></div>${cluesHTML(c, cu.n)}`;
      if (cu.pick == null) h += `${cu.n < 6 ? `<button type="button" class="btn lb-wide" data-ns="clue">Next clue now</button>` : ''}<div class="l20-k">Your call</div>${optsHTML(cu.opts, 'data-ns-i')}`.replace(/data-ns-i="(\d+)"/g, 'data-ns="pick" data-i="$1"');
      else {
        const last = R.res[R.res.length - 1];
        h += optsHTML(cu.opts, 'data-x', cu.pick) + `<div class="lb-card ${last.ok ? 'l20-good' : 'l20-badc'}"><h3>${last.ok ? `Right: +${last.pts}` : cu.pick < 0 ? 'Out of time' : 'Not this time'}</h3><p>${esc(c.dx)}</p></div>` +
          (last.ok ? '' : autopsyHTML(c, last.opt)) + `<button type="button" class="btn pri lb-wide" data-ns="next">${R.i + 1 >= R.ids.length ? 'End shift' : 'Next patient'}</button>`;
      }
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 2. Differential duel (pass-and-play) ---------- */
  const DS = store('duel');
  const dailyCase = salt => { const k = dayKey(), ids = CASES.map(c => c.id).sort(); return byId(ids[hash(salt + k) % ids.length]); };
  const duel = { render(el) {
    duel.el = el; duel.R = null;
    mount(el, 'duel', e => {
      const t = e.target.closest('[data-du]'); if (!t) return; const a = t.dataset.du, R = duel.R;
      if (a === 'start') { const prev = DS.get({ names: [] }).names || [], names = [0, 1].map(i => { const inp = el.querySelector('[data-du-name="' + i + '"]'); return ((inp ? inp.value : prev[i]) || '').trim().slice(0, 24) || 'Player ' + (i + 1); }); const D = DS.get({ names: [], log: [] }); D.names = names; DS.set(D); const c = t.dataset.c === 'rand' ? L.shuffle(CASES)[0] : dailyCase('duel'); duel.R = { c, names, p: 0, ph: 'pass', opts: options(c, 6), pl: [{ n: 1, wrong: [], done: 0 }, { n: 1, wrong: [], done: 0 }] }; duDraw(); return; }
      if (!R) return;
      const P = R.pl[R.p];
      if (a === 'ready') { R.ph = 'play'; duDraw(); return; }
      if (a === 'clue') { if (P.n < 6) P.n++; duDraw(); return; }
      if (a === 'pick') { const i = +t.dataset.i, o = R.opts[i]; if (o.ok) { P.done = 1; P.score = P.n + P.wrong.length; L.fx(true); } else { P.wrong.push(i); L.fx(false); logWrong(R.c, o, 'duel'); if (P.n >= 6 && P.wrong.length >= 3) { P.done = 1; P.score = 99; } } if (P.done) { R.ph = 'turnover'; } duDraw(); return; }
      if (a === 'giveup') { P.done = 1; P.score = 99; R.ph = 'turnover'; duDraw(); return; }
      if (a === 'next') { if (R.p === 0) { R.p = 1; R.ph = 'pass'; } else { R.ph = 'result'; duSave(); } duDraw(); return; }
      if (a === 'aut') { R.aut = +t.dataset.i; duDraw(); return; }
      if (a === 'home') { duel.R = null; duDraw(); }
    });
    boot(el, 'duel', duDraw);
  } };
  function duSave() { const R = duel.R, D = DS.get({ names: [], log: [] }), [a, b] = R.pl; const w = a.score === b.score ? -1 : a.score < b.score ? 0 : 1; R.win = w; D.log.push({ id: R.c.id, d: dayKey(), names: R.names, s: [a.score, b.score], w, t: Date.now() }); D.log = D.log.slice(-60); DS.set(D); if (w >= 0) award(5); }
  const scoreTxt = s => s >= 99 ? 'no diagnosis' : s + ' clue' + (s === 1 ? '' : 's');
  function duDraw() {
    const el = duel.el, R = duel.R; if (!el || !el.isConnected) return; let h;
    if (!R) {
      const D = DS.get({ names: [], log: [] }), n = D.names || [];
      h = head('Differential duel', 'Two players, one phone, the same case. Each of you takes a secret turn: open clues one at a time and diagnose as early as you can. Every clue opened counts 1 and every wrong guess counts 1. Fewest wins.') +
        `<div class="lb-card"><label class="l20-lab">Player 1<input class="l20-in" data-du-name="0" maxlength="24" value="${esc(n[0] || '')}" placeholder="Name"></label><label class="l20-lab">Player 2<input class="l20-in" data-du-name="1" maxlength="24" value="${esc(n[1] || '')}" placeholder="Name"></label></div>
        <div class="lb-btns"><button type="button" class="btn pri" data-du="start">Today's duel case</button><button type="button" class="btn" data-du="start" data-c="rand">Random case</button></div>` +
        (D.log && D.log.length ? `<div class="mx-h">Recent duels</div><div class="lb-group">${D.log.slice(-6).reverse().map(x => `<div class="lb-row"><span class="lb-rt"><span class="t1">${x.w < 0 ? 'Tie' : esc(x.names[x.w]) + ' won'}</span><span class="t2">${esc(x.names[0])} ${scoreTxt(x.s[0])} · ${esc(x.names[1])} ${scoreTxt(x.s[1])} · ${esc(x.d)}</span></span></div>`).join('')}</div>` : '') +
        `<p class="lb-foot">Played on one phone. Racing a friend on their own phone would need a server, which Synapse doesn't have for this yet.</p>`;
    } else if (R.ph === 'pass') {
      h = head('Differential duel', '') + `<div class="lb-card l20-pass"><h3>Pass the phone to ${esc(R.names[R.p])}</h3><p class="muted">${esc(R.names[1 - R.p])}, no peeking.</p></div><button type="button" class="btn pri lb-wide" data-du="ready">I'm ${esc(R.names[R.p])}, start</button>`;
    } else if (R.ph === 'play') {
      const P = R.pl[R.p];
      h = L.top('', `<span class="l20-chip">${esc(R.names[R.p])}: ${P.n + P.wrong.length}</span>`, 'lab') + cluesHTML(R.c, P.n) +
        `${P.n < 6 ? `<button type="button" class="btn lb-wide" data-du="clue">Open next clue (+1)</button>` : ''}<div class="l20-k">Diagnose (wrong guess +1)</div>
        <div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt${P.wrong.includes(i) ? ' bad' : ''}" ${P.wrong.includes(i) ? 'disabled' : ''} data-du="pick" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>
        <button type="button" class="btn ghost lb-wide" data-du="giveup">Give up</button>`;
    } else if (R.ph === 'turnover') {
      const P = R.pl[R.p];
      h = head('Differential duel', '') + `<div class="lb-card"><h3>${esc(R.names[R.p])}: ${scoreTxt(P.score)}</h3><p class="muted">${R.p === 0 ? `Don't say the answer out loud. Hand it over to ${esc(R.names[1])}.` : 'Both turns done.'}</p></div><button type="button" class="btn pri lb-wide" data-du="next">${R.p === 0 ? 'Hide and pass' : 'See who won'}</button>`;
    } else {
      const [a, b] = R.pl, wr = [];
      R.pl.forEach((P, pi) => P.wrong.forEach(i => wr.push({ pi, i })));
      h = head(R.win < 0 ? 'It’s a tie' : esc(R.names[R.win]) + ' wins', '') +
        `<div class="lb-card"><p><b>${esc(R.names[0])}</b>: ${scoreTxt(a.score)}${a.wrong.length ? ` (incl. ${a.wrong.length} wrong)` : ''}<br><b>${esc(R.names[1])}</b>: ${scoreTxt(b.score)}${b.wrong.length ? ` (incl. ${b.wrong.length} wrong)` : ''}</p><p style="margin-top:8px">Answer: <b>${esc(R.c.dx)}</b></p></div>` +
        (wr.length ? `<div class="l20-k">Wrong guesses</div><div class="l20-opts">${wr.map((w, j) => `<button type="button" class="btn sm" data-du="aut" data-i="${j}">${esc(R.names[w.pi])}: ${esc(R.opts[w.i].label)}</button>`).join('')}</div>` : '') +
        (R.aut != null && wr[R.aut] ? autopsyHTML(R.c, R.opts[wr[R.aut].i]) : '') + explainHTML(R.c) +
        `<div class="lb-btns"><button type="button" class="btn pri" data-du="start" data-c="rand">Rematch (new case)</button><button type="button" class="btn" data-du="home">Done</button></div>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 3. Study squad (pass-and-play vote) ---------- */
  const QS = store('squad');
  const squad = { render(el) {
    squad.el = el; squad.R = null;
    mount(el, 'squad', e => {
      const t = e.target.closest('[data-sq]'); if (!t) return; const a = t.dataset.sq, R = squad.R;
      if (a === 'start') { const names = [...el.querySelectorAll('[data-sq-name]')].map(i => i.value.trim().slice(0, 24)).filter(Boolean); if (names.length < 2) { toast('Add at least 2 names'); return; } const D = QS.get({ names: [], log: [] }); D.names = names; QS.set(D); const c = L.shuffle(CASES)[0]; squad.R = { c, names, n: 1, ph: 'clues', opts: options(c, 5), votes: [], v: 0 }; sqDraw(); return; }
      if (!R) return;
      if (a === 'clue') { R.n = Math.min(6, R.n + 1); sqDraw(); return; }
      if (a === 'vote') { R.ph = 'pass'; R.v = 0; sqDraw(); return; }
      if (a === 'ready') { R.ph = 'cast'; sqDraw(); return; }
      if (a === 'cast') { R.votes[R.v] = +t.dataset.i; R.v++; R.ph = R.v >= R.names.length ? 'reveal' : 'pass'; if (R.ph === 'reveal') sqSave(); sqDraw(); return; }
      if (a === 'home') { squad.R = null; sqDraw(); }
    });
    boot(el, 'squad', sqDraw);
  } };
  function sqSave() { const R = squad.R, D = QS.get({ names: [], log: [] }), right = R.votes.filter(i => R.opts[i].ok).length; D.log.push({ id: R.c.id, n: R.names.length, right, t: Date.now() }); D.log = D.log.slice(-60); QS.set(D); R.votes.forEach(i => { if (!R.opts[i].ok) logWrong(R.c, R.opts[i], 'squad'); }); if (right) award(3); }
  function sqDraw() {
    const el = squad.el, R = squad.R; if (!el || !el.isConnected) return; let h;
    if (!R) {
      const D = QS.get({ names: [], log: [] }), n = (D.names || []).concat(['', '', '', '', '', '']).slice(0, 6);
      h = head('Study squad cases', 'Huddle round one phone. Open the clues together, talk it through, then everyone votes in secret. Reveal the votes against the real answer.') +
        `<div class="lb-card"><div class="l20-k">Who's playing (2 to 6)</div>${n.map((x, i) => `<input class="l20-in" data-sq-name="${i}" maxlength="24" value="${esc(x)}" placeholder="Name ${i + 1}">`).join('')}</div>
        <button type="button" class="btn pri lb-wide" data-sq="start">Start a case</button>` +
        (D.log && D.log.length ? `<p class="muted small">Last ${Math.min(5, D.log.length)} cases: ${D.log.slice(-5).map(x => `${x.right}/${x.n} right`).join(' · ')}</p>` : '') +
        `<p class="lb-foot">Everyone plays on this phone. Voting from your own phones would need a server, which Synapse doesn't have for this yet.</p>`;
    } else if (R.ph === 'clues') {
      h = L.top('', `<span class="l20-chip">${R.names.length} players</span>`, 'lab') + cluesHTML(R.c, R.n) +
        `${R.n < 6 ? `<button type="button" class="btn lb-wide" data-sq="clue">Open next clue</button>` : ''}<button type="button" class="btn pri lb-wide" data-sq="vote">Discussed it: vote now</button>`;
    } else if (R.ph === 'pass') {
      h = head('Secret vote', '') + `<div class="lb-card l20-pass"><h3>Pass to ${esc(R.names[R.v])}</h3><p class="muted">Vote ${R.v + 1} of ${R.names.length}</p></div><button type="button" class="btn pri lb-wide" data-sq="ready">I'm ${esc(R.names[R.v])}</button>`;
    } else if (R.ph === 'cast') {
      h = head(esc(R.names[R.v]) + ', your diagnosis', '') + `<div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt" data-sq="cast" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    } else {
      const tally = R.opts.map((o, i) => ({ o, i, who: R.names.filter((_, j) => R.votes[j] === i) })).filter(x => x.who.length).sort((a, b) => b.who.length - a.who.length);
      const right = R.votes.filter(i => R.opts[i].ok).length, topWrong = tally.find(x => !x.o.ok);
      h = head(right === R.names.length ? 'Whole squad got it' : right ? `${right} of ${R.names.length} got it` : 'Squad missed this one', '') +
        `<div class="lb-card"><p>Answer: <b>${esc(R.c.dx)}</b></p></div><div class="lb-group">${tally.map(x => `<div class="lb-row l20-res ${x.o.ok ? 'ok' : 'bad'}"><span class="lb-rt"><span class="t1">${esc(x.o.label)} · ${x.who.length}</span><span class="t2">${x.who.map(esc).join(', ')}</span></span></div>`).join('')}</div>` +
        (topWrong ? autopsyHTML(R.c, topWrong.o) : '') + explainHTML(R.c) +
        `<div class="lb-btns"><button type="button" class="btn pri" data-sq="home">New case</button></div>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 4. Zebra of the week ---------- */
  const ZEBRAS = ['dx-kawasaki-disease', 'dx-subacute-combined-degeneration', 'dx-normal-pressure-hydrocephalus', 'dx-guillain-barre-syndrome', 'dx-myasthenia-gravis', 'dx-idiopathic-intracranial-hypertension', 'dx-als', 'dx-addisonian-crisis', 'dx-hsv-encephalitis', 'dx-hypertrophic-cardiomyopathy', 'dx-cauda-equina-syndrome', 'dx-trigeminal-neuralgia'];
  const ZS = store('zebra');
  function weekKey(t = Date.now()) { const d = new Date(t - 4 * 36e5); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const y = d.getFullYear(), w1 = new Date(y, 0, 4, 12); return y + '-W' + pad2(1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7)); }
  const zebraOf = wk => { const ids = ZEBRAS.filter(id => byId(id)); return byId(ids[hash('zebra' + wk) % ids.length]); };
  const zebra = { render(el) {
    zebra.el = el; zebra.R = null;
    mount(el, 'zebra', e => {
      const t = e.target.closest('[data-zb]'); if (!t) return; const a = t.dataset.zb, R = zebra.R;
      if (a === 'play') { const wk = weekKey(), c = zebraOf(wk); zebra.R = { wk, c, n: 1, opts: options(c, 6), wrong: [], done: 0 }; zbDraw(); return; }
      if (!R) return;
      if (a === 'clue') { R.n = Math.min(6, R.n + 1); zbDraw(); return; }
      if (a === 'pick') { const i = +t.dataset.i, o = R.opts[i]; if (o.ok) { R.done = 1; R.ok = 1; L.fx(true); } else { R.wrong.push(i); L.fx(false); logWrong(R.c, o, 'zebra'); if (R.wrong.length >= 3) R.done = 1; } if (R.done) zbSave(); zbDraw(); return; }
      if (a === 'aut') { R.aut = +t.dataset.i; zbDraw(); return; }
      if (a === 'home') { zebra.R = null; zbDraw(); }
    });
    boot(el, 'zebra', zbDraw);
  } };
  function zbSave() { const R = zebra.R, D = ZS.get({ weeks: {}, badges: [] }); if (!D.weeks[R.wk]) { D.weeks[R.wk] = { id: R.c.id, ok: R.ok ? 1 : 0, n: R.n, w: R.wrong.length, t: Date.now() }; if (R.ok && !D.badges.includes(R.c.id)) { D.badges.push(R.c.id); R.newBadge = 1; award(25); } } ZS.set(D); }
  function zbDraw() {
    const el = zebra.el, R = zebra.R; if (!el || !el.isConnected) return; let h;
    const D = ZS.get({ weeks: {}, badges: [] }), wk = weekKey(), done = D.weeks[wk];
    if (!R) {
      const shelf = ZEBRAS.filter(id => byId(id)).map(id => { const has = D.badges.includes(id), c = byId(id); return `<div class="l20-badge${has ? ' on' : ''}" title="${has ? esc(c.dx) : 'Not found yet'}"><span>${has ? '🦓' : '?'}</span><small>${has ? esc(c.dx.replace(/\s*\(.*\)$/, '')) : 'Locked'}</small></div>`; }).join('');
      h = head('Rare disease of the week', 'One zebra case a week: the diagnosis you only see a few times in a career. Three guesses. Solve it to add its badge to your shelf. A new zebra every Monday.') +
        (done ? `<div class="lb-card"><h3>This week (${esc(wk)}): ${done.ok ? 'solved' : 'missed'}</h3><p>${esc(byId(done.id) ? byId(done.id).dx : '')}. ${done.ok ? `You took ${done.n} clue${done.n === 1 ? '' : 's'}.` : 'The next zebra arrives Monday.'}</p></div>` : `<button type="button" class="btn pri lb-wide" data-zb="play">Open this week's zebra</button>`) +
        `<div class="mx-h">Your zebra shelf · ${D.badges.length}/${ZEBRAS.length}</div><div class="l20-shelf">${shelf}</div>`;
    } else if (!R.done) {
      h = L.top('', `<span class="l20-chip">${3 - R.wrong.length} guess${3 - R.wrong.length === 1 ? '' : 'es'} left</span>`, 'lab') + `<h2 class="lb-title">This week's zebra</h2>` + cluesHTML(R.c, R.n) +
        `${R.n < 6 ? `<button type="button" class="btn lb-wide" data-zb="clue">Next clue</button>` : ''}<div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt${R.wrong.includes(i) ? ' bad' : ''}" ${R.wrong.includes(i) ? 'disabled' : ''} data-zb="pick" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
    } else {
      h = head(R.ok ? 'Zebra caught 🦓' : 'It got away', '') + `<div class="lb-card ${R.ok ? 'l20-good' : 'l20-badc'}"><h3>${esc(R.c.dx)}</h3><p>${R.ok ? (R.newBadge ? 'Badge added to your shelf.' : 'Solved.') : 'No badge this week. A new zebra comes Monday.'}</p></div>` +
        (R.wrong.length ? `<div class="l20-opts">${R.wrong.map((i, j) => `<button type="button" class="btn sm" data-zb="aut" data-i="${j}">Autopsy: ${esc(R.opts[i].label)}</button>`).join('')}</div>` : '') +
        (R.aut != null ? autopsyHTML(R.c, R.opts[R.wrong[R.aut]]) : '') + explainHTML(R.c) + `<button type="button" class="btn pri lb-wide" data-zb="home">Back to the shelf</button>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 5. Case remix ---------- */
  // Same patient, one change: each change turns the library case into a different library case (so the explanation is real).
  const REMIX = [
    { base: 'dx-acute-asthma', ch: [
      { clue: 'history', what: 'Make her 68', text: 'She is 68, has smoked 20 a day for 50 years, and has coughed up sputum most mornings for years. No eczema or hay fever. This week her cough and breathlessness got worse after a cold.', to: 'dx-copd-exacerbation', why: 'Same wheeze, different person: an older long-term smoker with a chronic productive cough points to a COPD exacerbation, not asthma.' }] },
    { base: 'dx-primary-spontaneous-pneumothorax', ch: [
      { clue: 'vitals', what: 'Crash the vitals', text: 'HR 140/min, BP 78/40 mmHg, RR 36/min, SpO2 84% and falling. Trachea pushed away from the bad side, neck veins bulging. Getting worse by the minute.', to: 'dx-tension-pneumothorax', why: 'A pneumothorax plus low blood pressure, tracheal shift and distended neck veins is a tension pneumothorax: decompress first, no time for an X-ray.' }] },
    { base: 'dx-stemi-anterior', ch: [
      { clue: 'imaging', what: 'Change the ECG', text: 'ECG: widespread concave (saddle-shaped) ST elevation in most leads with PR depression. The pain is sharp, worse lying flat and better sitting forward. He had a cold last week.', to: 'dx-pericarditis', why: 'ST elevation everywhere (not in one artery’s territory) with PR depression and positional sharp pain is pericarditis.' },
      { clue: 'imaging', what: 'Swap the ST change', text: 'ECG: ST depression and T-wave inversion in V4 to V6, no ST elevation anywhere. Troponin is raised and rising.', to: 'dx-nstemi', why: 'Heart-muscle damage (rising troponin) without ST elevation is an NSTEMI.' }] },
    { base: 'dx-dka', ch: [
      { clue: 'labs', what: 'Older patient, different labs', text: 'He is 72 with type 2 diabetes and a week of thirst and growing confusion. Glucose 48 mmol/L, serum osmolality 365 mOsm/kg, blood ketones only 0.6 mmol/L, pH 7.36, bicarbonate 22.', to: 'dx-hhs', why: 'Very high glucose and osmolality with almost no ketones and a normal pH is the hyperosmolar hyperglycaemic state, not DKA.' }] },
    { base: 'dx-epidural-haematoma', ch: [
      { clue: 'history', what: 'Make him 84 on warfarin', text: 'He is 84, takes warfarin, and had a minor fall three weeks ago. Since then he has been slowly more muddled and unsteady. No lucid interval, no big blow.', to: 'dx-subdural-haematoma', why: 'An elderly anticoagulated patient drifting into confusion weeks after a trivial fall is the classic chronic subdural (a crescent on CT).' }] },
    { base: 'dx-hashimoto', ch: [
      { clue: 'labs', what: 'Flip the thyroid labs', text: 'TSH suppressed (below 0.01 mU/L), free T4 high, TSH-receptor antibodies positive. She has lost weight, feels hot and shaky, and her eyes look prominent.', to: 'dx-graves', why: 'Low TSH with high T4, positive TSH-receptor antibodies and eye signs is Graves’ disease: the thyroid is overactive, not failing.' }] },
    { base: 'dx-pyelonephritis', ch: [
      { clue: 'vitals', what: 'Drop the blood pressure', text: 'Temp 39.4 °C, HR 128/min, BP 82/48 mmHg despite fluids, RR 28/min, newly confused. Lactate 4.6 mmol/L.', to: 'dx-urosepsis', why: 'A kidney infection with low blood pressure, confusion and a high lactate has become sepsis from a urinary source.' }] },
    { base: 'dx-migraine-with-aura', ch: [
      { clue: 'history', what: 'Change how it started', text: 'No aura and no headache history. The headache hit like a thunderclap, the worst of her life, at full strength within a minute, then she vomited and her neck became stiff.', to: 'dx-sah', why: 'A sudden thunderclap headache, maximal within a minute, with neck stiffness is a subarachnoid haemorrhage until proven otherwise.' }] },
    { base: 'dx-community-acquired-pneumonia', ch: [
      { clue: 'history', what: 'Change the story', text: 'No cough or fever. Ten days after a long-haul flight she had sudden sharp pain on breathing in and became breathless. Her left calf is swollen. Chest X-ray is clear.', to: 'dx-pulmonary-embolism', why: 'Sudden pleuritic pain and breathlessness after a long flight with a swollen calf and a clear X-ray points to a pulmonary embolism.' }] }
  ];
  const RS = store('remix');
  const remix = { render(el) {
    remix.el = el; remix.R = null;
    mount(el, 'remix', e => {
      const t = e.target.closest('[data-rm]'); if (!t) return; const a = t.dataset.rm, R = remix.R;
      if (a === 'go') { const sets = REMIX.filter(s => byId(s.base) && s.ch.every(x => byId(x.to))); const all = []; sets.forEach(s => s.ch.forEach(x => all.push({ s, x }))); const D = RS.get({ done: {} }); const fresh = all.filter(p => !D.done[p.s.base + '>' + p.x.to]); const p = L.shuffle(fresh.length ? fresh : all)[0]; const base = byId(p.s.base), to = byId(p.x.to); const labs = [{ label: base.dx, ok: 0, key: null }, { label: to.dx, ok: 1, key: null }]; p.s.ch.forEach(x => { if (x !== p.x && byId(x.to)) labs.push({ label: byId(x.to).dx, ok: 0, key: null }); }); for (const o of options(to, 6)) { if (labs.length >= 5) break; if (!labs.some(l => norm(l.label) === norm(o.label))) labs.push({ ...o, ok: 0 }); } remix.R = { p, base, to, opts: L.shuffle(labs), pick: null }; rmDraw(); return; }
      if (a === 'pick' && R && R.pick == null) { R.pick = +t.dataset.i; const ok = !!R.opts[R.pick].ok; L.fx(ok); if (ok) award(4); const D = RS.get({ done: {} }); D.done[R.p.s.base + '>' + R.p.x.to] = ok ? 1 : 0; RS.set(D); rmDraw(); return; }
      if (a === 'home') { remix.R = null; rmDraw(); }
    });
    boot(el, 'remix', rmDraw);
  } };
  function rmDraw() {
    const el = remix.el, R = remix.R; if (!el || !el.isConnected) return; let h;
    if (!R) {
      const D = RS.get({ done: {} }), tot = REMIX.reduce((s, x) => s + x.ch.length, 0), got = Object.values(D.done).filter(Boolean).length;
      h = head('Case remix', 'You get a case with its answer. Then one thing changes (age, a drug, a lab, the ECG) and you call the new diagnosis. Trains you to notice which detail really decides it.') +
        `<div class="lb-card"><p>${got}/${tot} remixes solved</p></div><button type="button" class="btn pri lb-wide" data-rm="go">Remix a case</button>`;
    } else {
      const x = R.p.x, nm = (CL.find(c => c[0] === x.clue) || [, 'Clue'])[1];
      h = L.top('', '', 'lab') + `<div class="l20-k">Original case: ${esc(R.base.dx)}</div><div class="lb-card l20-orig"><p>${esc(R.base.complaint)}</p><p class="small muted"><b>${esc(nm)}:</b> ${esc(clueText(R.base, x.clue))}</p></div>
        <div class="l20-k">One change: ${esc(x.what)}</div><div class="l20-clue hl"><div class="l20-k">${esc(nm)} (new)</div><p>${esc(x.text)}</p></div><div class="l20-k">Same patient otherwise. New diagnosis?</div>`;
      if (R.pick == null) h += `<div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt" data-rm="pick" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
      else { const ok = R.opts[R.pick].ok; h += optsHTML(R.opts, 'data-x', R.pick) + `<div class="lb-card ${ok ? 'l20-good' : 'l20-badc'}"><h3>${ok ? 'Right' : 'It’s ' + esc(R.to.dx)}</h3><p>${esc(x.why)}</p>${R.to.pearl ? `<p class="small" style="margin-top:6px"><b>Pearl:</b> ${esc(R.to.pearl)}</p>` : ''}</div>` + explainHTML(R.to) + `<div class="lb-btns"><button type="button" class="btn pri" data-rm="go">Another remix</button><button type="button" class="btn" data-rm="home">Done</button></div>`; }
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 6. Misdiagnosis museum ---------- */
  // Real, widely reported cases, kept to what is on the public record. Teaching only.
  const MUSEUM = [
    { id: 'zion', title: 'The Libby Zion case', where: 'New York, 1984', see: 'An 18-year-old arrives at night with a fever, agitation and jerky movements. She takes the antidepressant phenelzine (an MAO inhibitor). She is given pethidine (meperidine) for the shaking, becomes more agitated, is restrained, and her temperature climbs very high.', q: 'With an MAO inhibitor on board, what should the new drug have made everyone worry about?', opts: ['Serotonin syndrome', 'Bacterial meningitis', 'Anaphylaxis', 'Heat stroke'], a: 0, story: 'She died within hours. Her death was widely attributed to serotonin syndrome from combining an MAO inhibitor with pethidine; the exact cause was argued over for years.', lesson: 'Always check the full medication list before adding a drug. MAO inhibitors plus pethidine (and other serotonergic drugs) can trigger serotonin syndrome: fever, agitation, clonus.', changed: 'A New York grand jury review and the Bell Commission led to state rules in 1989 limiting junior doctors’ working hours and requiring closer senior supervision.' },
    { id: 'staunton', title: 'Rory Staunton', where: 'New York, 2012', see: 'A 12-year-old cut his arm diving for a ball in a school gym. The next day: high fever, vomiting, leg pain, a fast heart rate and blotchy skin. He was seen and sent home with a diagnosis of a stomach bug.', q: 'What does fever, a fast pulse and mottled skin after a skin wound suggest?', opts: ['Sepsis', 'Gastroenteritis', 'Growing pains', 'Dehydration'], a: 0, story: 'He died days later of septic shock from a streptococcal infection that entered through the cut.', lesson: 'Gastroenteritis is a diagnosis of exclusion. A fast heart rate, fever and mottled skin, especially after a wound, are sepsis signs: check lactate, give antibiotics early.', changed: '“Rory’s Regulations” (2013) made New York the first US state to require every hospital to use sepsis protocols.' },
    { id: 'duncan', title: 'Thomas Eric Duncan', where: 'Dallas, 2014', see: 'A man in his 40s comes to an emergency department with fever and abdominal pain. He mentions he has recently arrived from Liberia, during the West African Ebola outbreak. He is given antibiotics and sent home.', q: 'Which single detail should have changed the whole plan?', opts: ['His recent travel from an Ebola outbreak area', 'His age', 'The abdominal pain', 'That he had a fever'], a: 0, story: 'He came back two days later much sicker, was diagnosed with Ebola, and died. Two nurses who cared for him were infected and survived.', lesson: 'Take and act on a travel history. Fever plus travel from an outbreak zone means isolate first, then test.', changed: 'Emergency departments across the US added travel-history screening at triage, and airports began entry screening for travellers from affected countries.' },
    { id: 'ritter', title: 'John Ritter', where: 'Burbank, 2003', see: 'A 54-year-old actor collapses on a TV set with sudden chest pain, sweating and vomiting. He is treated at first as a heart attack.', q: 'Sudden severe chest pain treated as a heart attack: which deadly mimic must you rule out first?', opts: ['Aortic dissection', 'Pericarditis', 'Panic attack', 'Pneumonia'], a: 0, story: 'The cause was an aortic dissection, a tear in the wall of the aorta. He died that night. A later lawsuit over his care ended with a jury finding the doctors were not negligent.', lesson: 'Aortic dissection can look exactly like a heart attack. Tearing pain into the back, unequal arm blood pressures or a wide mediastinum mean scan the aorta before giving clot-busting or blood-thinning drugs.', changed: 'His family started the John Ritter Foundation for Aortic Health to raise awareness of dissection and its warning signs.' }
  ];
  const MS = store('museum');
  const museum = { render(el) {
    museum.el = el; museum.cur = null; museum.pick = null; el.__l20 = 'museum';
    mount(el, 'museum', e => {
      const t = e.target.closest('[data-mu]'); if (!t) return; const a = t.dataset.mu;
      if (a === 'open') { museum.cur = MUSEUM.find(x => x.id === t.dataset.id); museum.pick = null; museum.order = L.shuffle(museum.cur ? museum.cur.opts.map((o, i) => i) : []); muDraw(); window.scrollTo(0, 0); return; }
      if (a === 'pick' && museum.cur && museum.pick == null) { museum.pick = +t.dataset.i; const D = MS.get({ seen: {} }); const right = museum.order[museum.pick] === museum.cur.a; D.seen[museum.cur.id] = right ? 1 : 0; MS.set(D); L.fx(right); muDraw(); return; }
      if (a === 'home') { museum.cur = null; muDraw(); }
    });
    muDraw();
  } };
  function muDraw() {
    const el = museum.el, x = museum.cur; if (!el || !el.isConnected) return; let h;
    const D = MS.get({ seen: {} });
    if (!x) h = head('Misdiagnosis museum', 'Famous real cases where the diagnosis was missed, told as a case first. Each one changed how medicine is practised. Kept to what is on the public record.') +
      `<div class="lb-group">${MUSEUM.map(m => `<button type="button" class="lb-row" data-mu="open" data-id="${m.id}"><span class="lb-rt"><span class="t1">${esc(m.title)}</span><span class="t2">${esc(m.where)}</span></span>${m.id in D.seen ? `<span class="lb-best">${D.seen[m.id] ? '✓' : '✗'}</span>` : ''}</button>`).join('')}</div><p class="lb-foot">Teaching summaries of publicly reported cases. Not medical advice.</p>`;
    else {
      h = L.top('', '', 'lab') + `<h2 class="lb-title">${esc(x.title)}</h2><p class="muted lb-p">${esc(x.where)}</p><div class="lb-card"><p>${esc(x.see)}</p></div><div class="l20-k">${esc(x.q)}</div>`;
      const ord = museum.order && museum.order.length === x.opts.length ? museum.order : x.opts.map((o, i) => i); const opts = ord.map(j => ({ label: x.opts[j], ok: j === x.a ? 1 : 0 })); // shown in a shuffled order (the right answer is not always first)
      if (museum.pick == null) h += `<div class="l20-opts">${opts.map((o, i) => `<button type="button" class="btn l20-opt" data-mu="pick" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
      else h += optsHTML(opts, 'data-x', museum.pick) + `<div class="lb-card"><h3>What happened</h3><p>${esc(x.story)}</p></div><div class="lb-card"><h3>The lesson</h3><p>${esc(x.lesson)}</p></div><div class="lb-card"><h3>What changed</h3><p>${esc(x.changed)}</p></div><button type="button" class="btn pri lb-wide" data-mu="home">Back to the museum</button>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 7. Symptom-first browse ---------- */
  const SYM = [
    ['Chest pain', /chest pain|chest tight|pain in (his|her|the) chest|central chest|pain across (his|her) chest/],
    ['Breathlessness', /breathless|short of breath|shortness of breath|dyspn|can'?t catch|out of breath/],
    ['Headache', /headache/], ['Fever', /\bfever|febrile|temp(erature)? 3[89]|temp(erature)? 4[01]/], ['Cough', /cough/],
    ['Vomiting', /vomit/], ['Abdominal pain', /abdominal pain|tummy pain|stomach pain|belly|epigastr|iliac fossa|upper abdomen|abdomen hurts/],
    ['Weakness', /\bweak/], ['Confusion', /confus|drowsy|disorient|muddled/], ['Seizure', /seiz|convuls/], ['Rash', /\brash|petechi|purpur/],
    ['Palpitations', /palpitat|heart (is )?racing|racing heart|pounding heart/], ['Collapse / fainting', /collaps|faint|syncop|passed out|blacked out/],
    ['Back pain', /back pain|low back|lower back|pain in (his|her) back/], ['Leg swelling', /swollen (left |right )?(leg|calf|ankle)|leg swelling|ankle swelling|calf swelling|oedema/],
    ['Weight loss', /weight loss|lost weight|losing weight|lost \d+ ?kg/], ['Tiredness', /tired|fatigue|exhaust|letharg/],
    ['Numbness / tingling', /numb|tingl|pins and needles/], ['Vision problems', /vision|visual|blurr|double vision|diplopia/], ['Wheeze', /wheez/],
    ['Diarrhoea', /diarrh/], ['Thirst / passing lots of urine', /thirst|polyuri|passing (a lot of |lots of )?urine|weeing/],
    ['Bleeding', /bleed|blood in|haematemesis|melaena|black (tarry )?stool|coffee.ground/], ['Neck stiffness', /neck stiff|stiff neck|neck is stiff/],
    ['Facial droop', /facial (droop|weakness|palsy)|face (is )?droop|drooping/], ['Tremor', /tremor/], ['Joint pain', /joint pain|swollen joint|arthralg/],
    ['Jaundice', /jaundic|yellow (skin|eyes)/]
  ];
  const caseText = c => (c.complaint + ' ' + CL.slice(1).map(([k]) => clueText(c, k)).join(' ')).toLowerCase();
  const plain = h => String(h || '').replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g, '$1').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const sx = { render(el) {
    sx.el = el; sx.sym = null; sx.play = null;
    mount(el, 'sx', e => {
      const t = e.target.closest('[data-sx]'); if (!t) return; const a = t.dataset.sx;
      if (a === 'sym') { sx.sym = +t.dataset.i; sx.play = null; sxDraw(); window.scrollTo(0, 0); return; }
      if (a === 'case') { const c = byId(t.dataset.id); if (c) { sx.play = { c, n: 1, opts: options(c, 4), pick: null }; sxDraw(); window.scrollTo(0, 0); } return; }
      if (a === 'clue' && sx.play) { sx.play.n = Math.min(6, sx.play.n + 1); sxDraw(); return; }
      if (a === 'pick' && sx.play && sx.play.pick == null) { sx.play.pick = +t.dataset.i; const o = sx.play.opts[sx.play.pick]; L.fx(!!o.ok); if (!o.ok) logWrong(sx.play.c, o, 'browse'); else award(3); sxDraw(); return; }
      if (a === 'back') { if (sx.play) sx.play = null; else sx.sym = null; sxDraw(); return; }
      if (a === 'card') { const c = M.cards.get(t.dataset.id); if (c && typeof editNote === 'function') { try { editNote(c.nid, 'browse'); } catch (er) { console.warn(er); } } }
    });
    boot(el, 'sx', sxDraw);
  } };
  function sxIndex() { if (sx.idx) return sx.idx; const txt = CASES.map(c => [c, caseText(c)]); sx.idx = SYM.map(([name, rx]) => ({ name, rx, cases: txt.filter(([, t]) => rx.test(t)).map(([c]) => c) })).filter(s => s.cases.length); return sx.idx; }
  function myCards(rx) { const out = []; try { for (const n of M.notes.values()) { if (n.del) continue; const d = M.decks.get(n.deck); if (!d || d.del) continue; const tx = (plain(n.front) + ' ' + plain(n.back)).toLowerCase(); if (rx.test(tx)) { const c = [...M.cards.values()].find(x => x.nid === n.id && !x.del); if (c) out.push({ c, q: plain(n.front).slice(0, 110), deck: d.name }); if (out.length >= 25) break; } } } catch (e) {} return out; }
  function sxDraw() {
    const el = sx.el; if (!el || !el.isConnected) return; let h; const idx = sxIndex();
    if (sx.play) {
      const p = sx.play, o = p.pick != null ? p.opts[p.pick] : null;
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sx="back">${L.ic('back', 18)}<span>${esc(idx[sx.sym] ? idx[sx.sym].name : 'Symptoms')}</span></button><span class="lb-tr"></span></div>` + cluesHTML(p.c, p.n);
      if (p.pick == null) h += `${p.n < 6 ? `<button type="button" class="btn lb-wide" data-sx="clue">Next clue</button>` : ''}<div class="l20-k">Diagnosis?</div><div class="l20-opts">${p.opts.map((x, i) => `<button type="button" class="btn l20-opt" data-sx="pick" data-i="${i}">${esc(x.label)}</button>`).join('')}</div>`;
      else h += optsHTML(p.opts, 'data-x', p.pick) + (o.ok ? `<div class="lb-card l20-good"><h3>Right: ${esc(p.c.dx)}</h3>${p.c.pearl ? `<p class="small">${esc(p.c.pearl)}</p>` : ''}</div>` : autopsyHTML(p.c, o)) + explainHTML(p.c);
    } else if (sx.sym != null && idx[sx.sym]) {
      const s = idx[sx.sym], bySys = {};
      s.cases.forEach(c => { (bySys[c.system] = bySys[c.system] || []).push(c); });
      const near = new Map(); s.cases.forEach(c => Object.keys(c.near || {}).forEach(k => { const lab = nearLabel(k); if (!s.cases.some(x => norm(x.dx) === norm(lab))) near.set(norm(lab), lab); }));
      const mine = myCards(s.rx);
      h = `<div class="lb-top"><button class="lb-back" type="button" data-sx="back">${L.ic('back', 18)}<span>Symptoms</span></button><span class="lb-tr"></span></div><h2 class="lb-title">${esc(s.name)}</h2><p class="muted lb-p">${s.cases.length} cause${s.cases.length === 1 ? '' : 's'} in Synapse's case library. Tap one to work it up as a case.</p>` +
        Object.keys(bySys).sort().map(k => `<div class="mx-h">${esc(k)}</div><div class="lb-group">${bySys[k].map(c => `<button type="button" class="lb-row" data-sx="case" data-id="${esc(c.id)}"><span class="lb-rt"><span class="t1">${esc(c.dx)}</span><span class="t2">${esc(c.complaint)}</span></span><span class="lb-chev">${L.ic('chev', 16)}</span></button>`).join('')}</div>`).join('') +
        (near.size ? `<div class="mx-h">Also on the differential (look-alikes named in those cases)</div><div class="lb-card"><p class="small">${[...near.values()].sort().map(esc).join(' · ')}</p></div>` : '') +
        `<div class="mx-h">Your cards that mention it (${mine.length})</div>` + (mine.length ? `<div class="lb-group">${mine.map(m => `<button type="button" class="lb-row" data-sx="card" data-id="${esc(m.c.id)}"><span class="lb-rt"><span class="t1">${esc(m.q)}</span><span class="t2">${esc(m.deck)}</span></span></button>`).join('')}</div>` : `<div class="lb-card"><p class="small muted">None of your cards mention this yet.</p></div>`) +
        `<p class="lb-foot">“Every cause” here means every cause in Synapse's ${CASES.length}-case library, not every cause in medicine.</p>`;
    } else {
      h = head('Symptom-first browse', 'Start from what the patient walks in with and branch out to every diagnosis in the case library that presents with it, plus your own cards that mention it.') +
        `<div class="l20-syms">${idx.map((s, i) => `<button type="button" class="l20-sym" data-sx="sym" data-i="${i}">${esc(s.name)}<small>${s.cases.length}</small></button>`).join('')}</div>`;
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 8. Wrong-guess autopsy (history of misses across these modes) ---------- */
  const MODE = { night: 'Night shift', duel: 'Duel', squad: 'Squad', zebra: 'Zebra', browse: 'Symptom browse', ghost: 'Ghost attending' };
  const wrong = { render(el) {
    wrong.el = el; wrong.i = null;
    mount(el, 'wrong', e => { const t = e.target.closest('[data-wg]'); if (!t) return; if (t.dataset.wg === 'open') { wrong.i = +t.dataset.i; wgDraw(); window.scrollTo(0, 0); } else if (t.dataset.wg === 'back') { wrong.i = null; wgDraw(); } else if (t.dataset.wg === 'clear') { if (confirm('Clear your list of wrong guesses?')) { WS.set({ log: [] }); wgDraw(); } } });
    boot(el, 'wrong', wgDraw);
  } };
  function wgDraw() {
    const el = wrong.el; if (!el || !el.isConnected) return; const log = WS.get({ log: [] }).log.slice().reverse(); let h;
    if (wrong.i != null && log[wrong.i]) { const x = log[wrong.i], c = byId(x.id); h = `<div class="lb-top"><button class="lb-back" type="button" data-wg="back">${L.ic('back', 18)}<span>All misses</span></button><span class="lb-tr"></span></div>` + (c ? cluesHTML(c, 6, (tell(c, x.k) || {}).k) + autopsyHTML(c, { label: x.g, key: x.k, ok: 0 }) + explainHTML(c) : '<div class="lb-empty">That case is no longer in the library.</div>'); }
    else {
      const cnt = {}; log.forEach(x => { const c = byId(x.id); if (c) cnt[c.system] = (cnt[c.system] || 0) + 1; });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
      h = head('Wrong-guess autopsy', 'Every case you got wrong in Night shift, Duel, Squad, Zebra, Ghost attending and Symptom browse. Open one to see why your guess didn’t fit and which clue should have tipped you.') +
        (log.length ? (top.length ? `<div class="lb-card"><p class="small">Most misses: ${top.map(([k, n]) => `${esc(k)} (${n})`).join(' · ')}</p></div>` : '') + `<div class="lb-group">${log.slice(0, 60).map((x, i) => { const c = byId(x.id); return c ? `<button type="button" class="lb-row" data-wg="open" data-i="${i}"><span class="lb-rt"><span class="t1">${esc(c.dx)}</span><span class="t2">You said ${esc(x.g)} · ${esc(MODE[x.m] || x.m)} · ${new Date(x.t).toLocaleDateString()}</span></span><span class="lb-chev">${L.ic('chev', 16)}</span></button>` : ''; }).join('')}</div><button type="button" class="btn ghost lb-wide" data-wg="clear">Clear list</button>` : `<div class="lb-empty">No wrong guesses yet. Play Night shift or a Duel and any miss lands here with its autopsy.</div>`);
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  /* ---------- 9. Ghost attending ---------- */
  // Scripted, not AI: at clue 3 and clue 5 the attending stops you and asks why. The answers come from the case's own teaching notes.
  const GS = store('ghost');
  const ghost = { render(el) {
    ghost.el = el; ghost.R = null;
    mount(el, 'ghost', e => {
      const t = e.target.closest('[data-gh]'); if (!t) return; const a = t.dataset.gh, R = ghost.R;
      if (a === 'start') { const c = L.shuffle(CASES)[0]; ghost.R = { c, n: 1, opts: options(c, 5), stop: null, lead: null, pick: null, asked: {} }; ghDraw(); return; }
      if (!R) return;
      if (a === 'clue') { R.n = Math.min(6, R.n + 1); if ((R.n === 3 || R.n === 5) && !R.asked[R.n]) { R.asked[R.n] = 1; R.stop = { n: R.n, lead: null, shown: 0 }; } ghDraw(); return; }
      if (a === 'lead' && R.stop) { R.stop.lead = +t.dataset.i; R.stop.why = (el.querySelector('[data-gh-why]') || {}).value || ''; ghDraw(); return; }
      if (a === 'reveal' && R.stop) { R.stop.shown = 1; ghDraw(); return; }
      if (a === 'self' && R.stop) { const D = GS.get({ ok: 0, n: 0 }); D.n++; if (t.dataset.v === '1') D.ok++; GS.set(D); R.stop = null; ghDraw(); return; }
      if (a === 'pick' && R.pick == null) { R.pick = +t.dataset.i; const o = R.opts[R.pick]; L.fx(!!o.ok); if (!o.ok) logWrong(R.c, o, 'ghost'); else award(5); ghDraw(); return; }
      if (a === 'home') { ghost.R = null; ghDraw(); }
    });
    boot(el, 'ghost', ghDraw);
  } };
  function ghChallenge(R) { // what the attending asks: "why not X?" for a near miss of the right answer (or of the student's lead)
    const st = R.stop, lead = st.lead != null ? R.opts[st.lead] : null, keys = Object.keys(R.c.near || {});
    if (lead && !lead.ok && lead.key) return { q: `You're leaning ${lead.label}. Why might that be wrong here?`, a: R.c.near[lead.key] };
    if (lead && !lead.ok) { const t = tell(R.c, null); return { q: `${lead.label}? Re-read the ${t ? t.name.toLowerCase() : 'clues'}. What doesn't fit?`, a: t ? t.text : R.c.pearl }; }
    const k = keys[(R.n + R.c.id.length) % Math.max(1, keys.length)];
    return k ? { q: `Fine, but convince me. Why not ${nearLabel(k)}?`, a: R.c.near[k] } : { q: 'What is the single finding that makes you most sure?', a: R.c.pearl };
  }
  function ghDraw() {
    const el = ghost.el, R = ghost.R; if (!el || !el.isConnected) return; let h;
    if (!R) { const D = GS.get({ ok: 0, n: 0 }); h = head('Ghost attending', 'A case with a tough attending at your shoulder. Twice during the case they stop you: “Why?” Commit to your leading diagnosis, say your reason, then hear theirs. Grade yourself honestly.') + `<div class="lb-card"><p>${D.n ? `You defended yourself well in ${D.ok} of ${D.n} interruptions.` : 'No rounds yet.'}</p></div><button type="button" class="btn pri lb-wide" data-gh="start">Start rounds</button><p class="lb-foot">The attending is scripted from each case's teaching notes (its look-alikes and pearl), not an AI: it can't read what you type, so you grade yourself.</p>`; }
    else if (R.stop) {
      const st = R.stop;
      h = L.top('', '', 'lab') + cluesHTML(R.c, R.n) + `<div class="lb-card l20-ghost"><div class="l20-k">👻 Attending</div>`;
      if (st.lead == null) h += `<p><b>Stop. What's top of your list right now, and why?</b></p><textarea class="l20-in" data-gh-why rows="2" maxlength="300" placeholder="Your reason (optional, stays on this phone)"></textarea><div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt" data-gh="lead" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
      else { const ch = ghChallenge(R); h += `<p><b>${esc(ch.q)}</b></p>${st.why ? `<p class="small muted">You said: “${esc(st.why)}”</p>` : ''}` + (st.shown ? `<p class="l20-why">${esc(ch.a)}</p><p class="small">Did your reasoning hold up?</p><div class="lb-btns"><button type="button" class="btn" data-gh="self" data-v="0">Not really</button><button type="button" class="btn pri" data-gh="self" data-v="1">Yes</button></div>` : `<p class="small muted">Answer it in your head (or out loud), then hear the attending.</p><button type="button" class="btn pri lb-wide" data-gh="reveal">Hear the attending</button>`); }
      h += `</div>`;
    } else {
      h = L.top('', '', 'lab') + cluesHTML(R.c, R.n);
      if (R.pick == null) h += `${R.n < 6 ? `<button type="button" class="btn lb-wide" data-gh="clue">Next clue</button>` : ''}<div class="l20-k">Final diagnosis</div><div class="l20-opts">${R.opts.map((o, i) => `<button type="button" class="btn l20-opt" data-gh="pick" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>`;
      else { const o = R.opts[R.pick]; h += optsHTML(R.opts, 'data-x', R.pick) + (o.ok ? `<div class="lb-card l20-good"><h3>👻 “Good. ${esc(R.c.dx)}.”</h3>${R.c.pearl ? `<p class="small">${esc(R.c.pearl)}</p>` : ''}</div>` : autopsyHTML(R.c, o)) + explainHTML(R.c) + `<div class="lb-btns"><button type="button" class="btn pri" data-gh="start">Next case</button><button type="button" class="btn" data-gh="home">Done</button></div>`; }
    }
    el.innerHTML = `<div class="lb">${h}</div>`;
  }

  Object.assign(window.LabMods, { night, duel, squad, zebra, remix, museum, sx, wrong, ghost });
  window.LabCases20 = { options, tell, weekKey, REMIX, MUSEUM, ZEBRAS }; // for tests / other modules
})();
