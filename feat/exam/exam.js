/* Exam mode: a mixed, timed test across topics. Questions come from lessons the person has opened (topics with none
   opened fall back to ready courses, loaded lazily). No feedback until the end; then a by-topic breakdown with every miss
   explained. Misses go to Weak Spots, XP through Hub.award('test'), results sync as progress records t:'exam'.
   A run in progress survives the app being closed (localStorage 'exam.run.v1'; the clock keeps running). */
'use strict';
(function () {
  const RUN_KEY = 'exam.run.v1', CFG_KEY = 'exam.cfg.v1';
  const LV = [['kid', '5'], ['hs', 'HS'], ['college', 'Col'], ['phd', 'PhD'], ['expert', 'Dr']];
  const LVN = { kid: "Like I'm 5", hs: 'High school', college: 'College', phd: 'PhD', expert: 'Doctor / Expert' };
  const LANG = { german: 1, french: 1, spanish: 1 };
  const S = { el: null, cfg: null, run: null, res: null, busy: null, tick: 0, err: '' };
  const hash = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36); // same as weak.js, so ids match Learn misses
  const md = s => (window.Learn && Learn.md ? Learn.md(s) : '<p>' + esc(s) + '</p>');
  const mdi = s => md(s).replace(/^<p>|<\/p>$/g, '');
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  /* ---------- data ---------- */
  let manifest = null;
  async function getManifest() {
    if (window.Learn && Learn._S && Learn._S.manifest) return (manifest = Learn._S.manifest);
    if (manifest) return manifest;
    const r = await fetch('learn/manifest.json'); if (!r.ok) throw new Error('manifest'); manifest = await r.json();
    if (window.Learn && Learn._S && !Learn._S.manifest) Learn._S.manifest = manifest;
    return manifest;
  }
  const courseMeta = id => { for (const t of manifest.topics) for (const c of t.courses) if (c.id === id) return [t, c]; return [null, null]; };
  async function getCourse(id) {
    const cache = window.Learn && Learn._S && Learn._S.courses; if (cache && cache.has(id)) return cache.get(id);
    const [, c] = courseMeta(id); if (!c || !c.file) throw new Error('not built');
    const r = await fetch(c.file); if (!r.ok) throw new Error('course ' + r.status); const j = await r.json();
    if (cache) cache.set(id, j); return j;
  }
  function testFor(l, lvl) {
    if (lvl === 'kid' && l.kidTest && l.kidTest.length) return l.kidTest;
    if ((lvl === 'phd' || lvl === 'expert') && l.advancedTest) return [...(l.test || []), ...l.advancedTest];
    return l.test || [];
  }
  const opened = () => { const o = {}; for (const r of M.progress.values()) if (r.t === 'lesson' && !r.del && (r.read || r.at) && r.cid && r.lid) (o[r.cid] || (o[r.cid] = new Set())).add(r.lid); return o; };
  function sourceInfo(cfg) { // per topic: how many opened lessons
    const op = opened(), out = {};
    for (const t of manifest.topics) { let n = 0; for (const c of t.courses) if (op[c.id]) n += op[c.id].size; out[t.key] = n; }
    return out;
  }
  function loadCfg() { let c = null; try { c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) {} const all = manifest ? manifest.topics.map(t => t.key) : [];
    c = c || {}; return { topics: (c.topics || all).filter(k => all.includes(k)).length ? (c.topics || all).filter(k => all.includes(k)) : all, lvl: c.lvl || (window.Prefs && Prefs.v && Prefs.v.learn && Prefs.v.learn.level) || 'hs', n: c.n || 20, min: c.min || 20 }; }
  const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(S.cfg)); } catch (e) {} };

  // build the question list: round-robin across topics so every picked topic is represented
  async function buildExam(cfg) {
    const op = opened(), per = {}, fails = [];
    const need = Math.ceil(cfg.n / cfg.topics.length) + 2;
    const jobs = [];
    for (const key of cfg.topics) {
      const t = manifest.topics.find(x => x.key === key); if (!t) continue;
      const ready = t.courses.filter(c => c.status === 'ready' && c.file);
      let mine = ready.filter(c => op[c.id]);
      const fallback = !mine.length; // nothing opened in this topic: draw from ready courses
      if (fallback) mine = shuffle(ready.slice(0, Math.max(6, Math.min(ready.length, 12)))).slice(0, 3);
      else mine = shuffle(mine).slice(0, 8);
      per[key] = { t, fallback, pool: [] };
      for (const c of mine) jobs.push([key, c, fallback ? null : op[c.id]]);
    }
    let done = 0; S.busy = { done, total: jobs.length }; paint();
    await Promise.all(jobs.map(async ([key, cm, lids]) => {
      try {
        const c = await getCourse(cm.id);
        c.lessons.forEach((l, li) => { if (lids && !lids.has(l.id)) return; testFor(l, cfg.lvl).forEach(q => { if (q && q.q && (q.type === 'mc' ? Array.isArray(q.choices) && q.choices[q.answer] != null : q.answer != null)) { const qq = { ...q, topic: key, cid: cm.id, lid: l.id, li, lt: l.title, ct: c.title }; per[key].pool.push(window.Learn && Learn.shuffleChoices ? Learn.shuffleChoices(qq) : qq); } }); });
      } catch (e) { fails.push(cm.id); }
      S.busy = { done: ++done, total: jobs.length }; paint();
    }));
    // if a topic's opened lessons are thin, top it up from its other ready courses
    for (const key of Object.keys(per)) {
      const P = per[key]; if (P.fallback || P.pool.length >= need) continue;
      const extra = shuffle(P.t.courses.filter(c => c.status === 'ready' && c.file && !op[c.id])).slice(0, 2);
      for (const cm of extra) { try { const c = await getCourse(cm.id); c.lessons.forEach((l, li) => testFor(l, cfg.lvl).forEach(q => { if (q && q.q) P.pool.push({ ...q, topic: key, cid: cm.id, lid: l.id, li, lt: l.title, ct: c.title }); })); } catch (e) {} }
    }
    // pick: mix mc and typed (aim ~1/3 typed when available), no repeats, spread across lessons
    const qs = [], keys = cfg.topics.filter(k => per[k] && per[k].pool.length), seen = new Set();
    for (const k of keys) { const P = per[k]; P.typed = shuffle(P.pool.filter(q => q.type !== 'mc')); P.mc = shuffle(P.pool.filter(q => q.type === 'mc')); }
    let typedN = 0, guard = 0;
    const take = arr => { while (arr.length) { const q = arr.shift(), id = q.lid + '|' + q.q; if (!seen.has(id)) { seen.add(id); return q; } } return null; };
    while (qs.length < cfg.n && guard++ < 5000) {
      let moved = false;
      for (const k of shuffle(keys.slice())) {
        if (qs.length >= cfg.n) break; const P = per[k];
        const wantTyped = typedN < Math.round((qs.length + 1) / 3); // about a third typed, when the lessons have them
        const q = (wantTyped ? take(P.typed) || take(P.mc) : take(P.mc) || take(P.typed));
        if (q) { qs.push(q); if (q.type !== 'mc') typedN++; moved = true; }
      }
      if (!moved) break;
    }
    S.busy = null;
    if (!qs.length) throw new Error(navigator.onLine ? 'No questions found for those topics yet.' : "You're offline and those courses aren't saved yet.");
    return { qs: shuffle(qs), fallback: Object.keys(per).filter(k => per[k].fallback), fails };
  }

  /* ---------- grading ---------- */
  function lev(a, b) { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c.push(Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))); p = c; } return p[n]; }
  function grade(q, given) {
    if (q.type === 'mc') return { ok: given === q.answer };
    if (given == null || !String(given).trim()) return { ok: false };
    if (window.Learn && Learn.isRight ? Learn.isRight(q, given) : false) return { ok: true };
    const n = window.Learn && Learn.norm ? Learn.norm : (s => String(s || '').toLowerCase().trim());
    const g = n(given), opts = [q.answer, ...(q.accept || [])].map(n);
    if (!window.Learn && opts.includes(g)) return { ok: true };
    // small typos count outside language topics (spelling IS the skill in German/French/Spanish)
    if (!LANG[q.topic] && opts.some(o => o.length >= 6 && lev(g, o) <= 1)) return { ok: true, typo: 1 };
    return { ok: false };
  }

  /* ---------- run lifecycle ---------- */
  const saveRun = () => { try { if (S.run) localStorage.setItem(RUN_KEY, JSON.stringify(S.run)); else localStorage.removeItem(RUN_KEY); } catch (e) {} };
  function loadRun() { try { const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); return r && Array.isArray(r.qs) && r.qs.length ? r : null; } catch (e) { return null; } }
  async function start() {
    S.err = ''; saveCfg();
    try {
      const ex = await buildExam(S.cfg);
      S.run = { id: 'exam:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cfg: { ...S.cfg }, qs: ex.qs, ans: ex.qs.map(() => null), i: 0, t0: Date.now(), end: Date.now() + S.cfg.min * 60e3, fallback: ex.fallback };
      saveRun(); paint(); window.scrollTo(0, 0); startTick();
      try { window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (e) {}
    } catch (e) { S.busy = null; S.err = e.message || 'Could not build the exam.'; paint(); }
  }
  function startTick() { clearInterval(S.tick); S.tick = setInterval(() => { if (!S.run) return clearInterval(S.tick); if (!S.el || !S.el.isConnected) return; const left = S.run.end - Date.now(); paintTimer(left); if (left <= 0) finish(true); }, 500); }
  function paintTimer(left) {
    if (!S.el) return; const R = S.run; if (!R) return; const tot = R.cfg.min * 60e3, pct = Math.max(0, Math.min(100, left / tot * 100));
    const b = S.el.querySelector('.ex-tbar b'), tx = S.el.querySelector('.ex-time');
    if (b) { b.style.width = pct + '%'; b.parentNode.classList.toggle('low', left < 60e3); }
    if (tx) { tx.textContent = mmss(left); tx.classList.toggle('low', left < 60e3); }
  }
  async function finish(timeUp) {
    const R = S.run; if (!R || R.done) return; R.done = 1; clearInterval(S.tick);
    const res = R.qs.map((q, i) => ({ q, a: R.ans[i], ...grade(q, R.ans[i]) }));
    const right = res.filter(x => x.ok).length, n = res.length, score = Math.round(right / n * 100);
    const by = {}; for (const x of res) { const b = by[x.q.topic] || (by[x.q.topic] = [0, 0]); b[1]++; if (x.ok) b[0]++; }
    const dur = Math.min(Date.now(), R.end) - R.t0;
    const rec = { id: R.id, t: 'exam', at: Date.now(), lvl: R.cfg.lvl, n, right, score, min: R.cfg.min, dur, timeUp: timeUp ? 1 : 0, topics: R.cfg.topics, by, del: 0 };
    S.res = { rec, res, timeUp }; S.run = null; saveRun();
    try { await write([['progress', rec]]); } catch (e) { console.warn('exam save', e); }
    // XP: like a lesson test (10 + score/10 + 10 for passing), scaled by exam length
    const xp = Math.round((10 + score / 10 + (score >= 70 ? 10 : 0)) * Math.max(1, n / 10) * (R.cfg.lvl === 'phd' || R.cfg.lvl === 'expert' ? 1.2 : 1));
    try { if (window.Hub) Hub.award('test', xp, 1); } catch (e) {}
    S.res.xp = xp;
    // misses → Weak Spots (same id scheme as Learn, so a question missed in both lands once)
    let added = 0;
    if (window.Weak && Weak.addQuestion) for (const x of res) if (!x.ok) {
      const q = x.q, t = manifest.topics.find(tt => tt.key === q.topic);
      try { if (await Weak.addQuestion(q.lid + ':' + hash(q.q), 'learn', { q: q.q, type: q.type, choices: q.choices, answer: q.answer, accept: q.accept, explain: q.explain }, (t ? t.name : '') + ' · ' + q.lt)) added++; } catch (e) {}
    }
    S.res.weak = res.filter(x => !x.ok).length;
    try { window.Prefs && Prefs.sound && Prefs.sound(score >= 70 ? 'ok' : 'tap'); } catch (e) {}
    paint(); window.scrollTo(0, 0);
  }

  /* ---------- views ---------- */
  function paint() { if (!S.el || !S.el.isConnected) return; if (!manifest) return loading(); if (S.run) return rRun(); if (S.res) return rResult(); return rSetup(); }
  function loading() { S.el.innerHTML = '<div class="ex"><div class="empty">Loading…</div></div>'; getManifest().then(() => { S.cfg = S.cfg || loadCfg(); paint(); }).catch(() => { S.el.innerHTML = `<div class="ex">${backBtn()}<div class="empty">Couldn't load courses${navigator.onLine ? '' : " (you're offline)"}.</div></div>`; }); }
  const backBtn = () => S.noBack ? '' : `<button type="button" class="lback ex-back" data-ex-exit>‹ Back</button>`;
  function history() { return [...M.progress.values()].filter(o => o.t === 'exam' && !o.del).sort((a, b) => b.at - a.at); }
  function rSetup() {
    const C = S.cfg, src = sourceInfo(C), H = history();
    const tchips = manifest.topics.map(t => { const on = C.topics.includes(t.key); return `<button type="button" class="ex-tp${on ? ' on' : ''}" data-ex-topic="${t.key}" aria-pressed="${on}"><span class="ex-tp-c">${on ? (window.Prefs ? Prefs.icon('check', 14) : '') : ''}</span><span class="ex-tp-n">${esc(t.name)}</span><span class="ex-tp-s">${src[t.key] ? src[t.key] + ' opened' : 'not started'}</span></button>`; }).join('');
    const seg = (name, opts, cur) => `<div class="seg ex-seg" role="radiogroup">${opts.map(([v, l]) => `<button type="button" role="radio" class="${String(cur) === String(v) ? 'on' : ''}" aria-checked="${String(cur) === String(v)}" data-ex-${name}="${v}">${esc(l)}</button>`).join('')}</div>`;
    const fresh = C.topics.filter(k => !src[k]).map(k => manifest.topics.find(t => t.key === k).name);
    const allOn = C.topics.length === manifest.topics.length;
    S.el.innerHTML = `<div class="ex">${backBtn()}
      <h2 class="ex-h">Exam</h2><p class="ex-lead">A timed, mixed test across your topics. No answers shown until you finish.</p>
      <div class="ex-sh"><span>Topics</span><button type="button" class="ex-link" data-ex-alltopics>${allOn ? 'Clear' : 'Select all'}</button></div>
      <div class="ex-topics">${tchips}</div>
      ${fresh.length && C.topics.length ? `<p class="ex-note">${fresh.length > 2 ? fresh.length + ' topics have' : esc(fresh.join(' and ')) + (fresh.length > 1 ? ' have' : ' has')} no opened lessons yet, so those questions come from the first ready courses.</p>` : ''}
      <div class="ex-sh"><span>Level</span><span class="ex-sv">${esc(LVN[C.lvl])}</span></div>${seg('lvl', LV, C.lvl)}
      <div class="ex-sh"><span>Questions</span></div>${seg('n', [[10, '10'], [20, '20'], [40, '40']], C.n)}
      <div class="ex-sh"><span>Time</span></div>${seg('min', [[10, '10 min'], [20, '20 min'], [30, '30 min']], C.min)}
      ${S.err ? `<p class="ex-err" role="alert">${esc(S.err)}</p>` : ''}
      <button type="button" class="btn pri wide ex-go" data-ex-start ${C.topics.length && !S.busy ? '' : 'disabled'}>${S.busy ? `Preparing… ${S.busy.total ? S.busy.done + '/' + S.busy.total : ''}` : `Start · ${C.n} questions · ${C.min} min`}</button>
      ${H.length ? `<div class="ex-sh"><span>Past exams</span></div><div class="ex-hist">${H.slice(0, 6).map(o => `<div class="ex-hrow"><span class="ex-hs ${o.score >= 70 ? 'ok' : ''}">${o.score}%</span><span class="ex-ht"><span class="ex-h1">${o.right}/${o.n} · ${esc(LVN[o.lvl] || o.lvl)}</span><span class="ex-h2">${esc((o.topics || []).length === manifest.topics.length ? 'All topics' : (o.topics || []).map(k => (manifest.topics.find(t => t.key === k) || { name: k }).name).join(', '))} · ${new Date(o.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></span></div>`).join('')}</div>` : ''}
    </div>`;
  }
  function rRun() {
    const R = S.run, q = R.qs[R.i], a = R.ans[R.i], n = R.qs.length, t = manifest.topics.find(x => x.key === q.topic), left = R.end - Date.now();
    const answered = R.ans.filter(x => x != null && x !== '').length;
    let body;
    if (q.type === 'mc') body = `<div class="ex-choices" role="radiogroup">${q.choices.map((c, j) => `<button type="button" role="radio" aria-checked="${a === j}" class="ex-ch${a === j ? ' on' : ''}" data-ex-ch="${j}"><span class="ex-ch-k">${String.fromCharCode(65 + j)}</span><span class="ex-ch-t">${esc(c)}</span></button>`).join('')}</div>`;
    else body = `<form class="ex-typed" data-ex-form autocomplete="off"><input type="text" id="exAns" value="${esc(a || '')}" placeholder="${q.type === 'cloze' ? 'Fill the blank' : 'Type your answer'}" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next" aria-label="Your answer"></form>`;
    S.el.innerHTML = `<div class="ex ex-run">
      <div class="ex-top"><button type="button" class="ex-quit" data-ex-quit>End</button><span class="ex-pos">${R.i + 1} <span>of ${n}</span></span><span class="ex-time${left < 60e3 ? ' low' : ''}" aria-label="Time left">${mmss(left)}</span></div>
      <div class="ex-tbar${left < 60e3 ? ' low' : ''}" aria-hidden="true"><b style="width:${Math.max(0, left / (R.cfg.min * 60e3) * 100)}%"></b></div>
      <div class="ex-dots" aria-hidden="true">${R.qs.map((_, i) => `<i class="${i === R.i ? 'cur' : R.ans[i] != null && R.ans[i] !== '' ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ex-q"><div class="ex-qk">${esc(t ? t.name : '')} · ${q.type === 'mc' ? 'Multiple choice' : q.type === 'cloze' ? 'Fill in the blank' : 'Type the answer'}</div><div class="ex-qq">${md(q.q)}</div>${body}</div>
      <div class="ex-nav"><button type="button" class="btn" data-ex-prev ${R.i ? '' : 'disabled'}>Back</button>${R.i + 1 < n ? `<button type="button" class="btn pri" data-ex-next>${a != null && a !== '' ? 'Next' : 'Skip'}</button>` : `<button type="button" class="btn pri" data-ex-finish>Finish</button>`}</div>
      <p class="ex-foot">${answered} of ${n} answered${R.i + 1 < n ? ` · <button type="button" class="ex-link" data-ex-finish>Finish now</button>` : ''}</p>
    </div>`;
    const inp = S.el.querySelector('#exAns');
    if (inp) { inp.addEventListener('input', () => { R.ans[R.i] = inp.value; saveRun(); const nb = S.el.querySelector('[data-ex-next]'); if (nb) nb.textContent = inp.value.trim() ? 'Next' : 'Skip'; }); S.el.querySelector('[data-ex-form]').onsubmit = e => { e.preventDefault(); move(1); }; if (typeof isTouch !== 'undefined' && !isTouch) inp.focus(); }
  }
  function move(d) { const R = S.run; if (!R) return; const inp = S.el.querySelector('#exAns'); if (inp) R.ans[R.i] = inp.value; R.i = Math.max(0, Math.min(R.qs.length - 1, R.i + d)); saveRun(); rRun(); }
  function rResult() {
    const { rec, res, xp, weak, timeUp } = S.res, miss = res.filter(x => !x.ok);
    const rows = Object.entries(rec.by).map(([k, [r, n]]) => { const t = manifest.topics.find(x => x.key === k), p = Math.round(r / n * 100); return `<div class="ex-brow"><span class="ex-bn">${esc(t ? t.name : k)}</span><span class="ex-bbar"><b style="width:${p}%" class="${p >= 70 ? 'ok' : p >= 40 ? 'mid' : 'bad'}"></b></span><span class="ex-bs${p < 40 ? ' bad' : ''}">${r}/${n}</span></div>`; }).join('');
    const yours = x => x.q.type === 'mc' ? (x.a == null ? 'No answer' : x.q.choices[x.a]) : (x.a && String(x.a).trim() ? x.a : 'No answer');
    const correct = q => q.type === 'mc' ? q.choices[q.answer] : q.answer;
    S.el.innerHTML = `<div class="ex">${backBtn()}
      <div class="ex-score"><div class="ex-big">${rec.score}<span>%</span></div><div class="ex-sl">${rec.right} of ${rec.n} right · ${esc(LVN[rec.lvl])}</div><div class="ex-sm">${timeUp ? "Time's up · " : ''}${mmss(rec.dur)} used · +${xp} XP</div></div>
      <div class="ex-sh"><span>By topic</span></div><div class="ex-by">${rows}</div>
      ${miss.length ? `<div class="ex-sh"><span>Review ${miss.length} miss${miss.length === 1 ? '' : 'es'}</span><span class="ex-sv">Added to Weak Spots</span></div>
      <div class="ex-miss">${miss.map(x => { const t = manifest.topics.find(tt => tt.key === x.q.topic); return `<div class="ex-mi"><div class="ex-mk">${esc(t ? t.name : '')} · ${esc(x.q.lt)}</div><div class="ex-mq">${md(x.q.q)}</div>
        <div class="ex-ma"><span class="ex-mal">Yours</span><span class="ex-bad">${esc(yours(x))}</span></div><div class="ex-ma"><span class="ex-mal">Answer</span><span class="ex-ok">${esc(correct(x.q))}</span></div>
        ${x.q.explain ? `<div class="ex-me">${mdi(x.q.explain)}</div>` : ''}<button type="button" class="ex-link ex-open" data-ex-open="${esc(x.q.cid)}|${x.q.li}|${esc(rec.lvl)}">Open lesson</button></div>`; }).join('')}</div>` : `<p class="ex-note ex-perfect">Every question right.</p>`}
      <div class="ex-nav ex-end"><button type="button" class="btn" data-ex-exit>Done</button><button type="button" class="btn pri" data-ex-again>New exam</button></div>
    </div>`;
  }

  /* ---------- events ---------- */
  function onClick(e) {
    const b = e.target.closest('button'); if (!b || !S.el || !S.el.contains(b)) return; const d = b.dataset, C = S.cfg;
    if (d.exTopic) { const k = d.exTopic; C.topics = C.topics.includes(k) ? C.topics.filter(x => x !== k) : [...C.topics, k]; S.err = ''; saveCfg(); rSetup(); }
    else if ('exAlltopics' in d) { C.topics = C.topics.length === manifest.topics.length ? [] : manifest.topics.map(t => t.key); saveCfg(); rSetup(); }
    else if (d.exLvl) { C.lvl = d.exLvl; saveCfg(); rSetup(); }
    else if (d.exN) { C.n = +d.exN; saveCfg(); rSetup(); }
    else if (d.exMin) { C.min = +d.exMin; saveCfg(); rSetup(); }
    else if ('exStart' in d) { if (!S.busy) start(); }
    else if (d.exCh != null && S.run) { S.run.ans[S.run.i] = +d.exCh; saveRun(); try { window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (er) {} rRun(); }
    else if ('exNext' in d) move(1);
    else if ('exPrev' in d) move(-1);
    else if ('exFinish' in d) { const R = S.run; if (!R) return; const inp = S.el.querySelector('#exAns'); if (inp) R.ans[R.i] = inp.value; const un = R.ans.filter(x => x == null || x === '').length; if (un && !confirm(`${un} question${un === 1 ? ' is' : 's are'} unanswered. Finish anyway?`)) return; finish(false); }
    else if ('exQuit' in d) { if (confirm('End the exam? It will be graded as it stands.')) finish(false); }
    else if ('exAgain' in d) { S.res = null; rSetup(); window.scrollTo(0, 0); }
    else if ('exExit' in d) { if (S.run) return; S.res = null; if (S.onExit) S.onExit(); else if (typeof go === 'function') go(window.Learn ? 'learn' : 'home'); }
    else if (d.exOpen) { const [cid, li, lvl] = d.exOpen.split('|'); if (window.Learn) { S.res = null; Learn._S.route = { page: 'lesson', cid, lvl, li: +li }; go('learn'); } }
  }

  /* ---------- public ---------- */
  function render(el, opts) {
    if (S.el !== el) { if (S.el) S.el.removeEventListener('click', onClick); S.el = el; el.addEventListener('click', onClick); }
    S.onExit = opts && opts.onExit; S.noBack = !!(opts && opts.back === false);
    if (!S.run && !S.res) { const r = loadRun(); if (r) { S.run = r; } }
    if (S.run && Date.now() >= S.run.end) { getManifest().then(() => finish(true)); return; }
    if (S.run) startTick();
    if (manifest && !S.cfg) S.cfg = loadCfg();
    paint();
  }
  // convenience: show the exam in the app's spare 'x' view (see INTEGRATE.md)
  function open() {
    if (window.XView && XView.MODS && XView.open) { XView.MODS.exam = XView.MODS.exam || { title: 'Exam', render: el => render(el, { back: false }) }; return XView.open('exam'); }
    // no XView host on this build: drive #v-x directly
    window.XView = window.XView || { render: () => render(document.getElementById('v-x'), { back: false }) }; go('x'); const t = document.getElementById('title'); if (t) t.textContent = 'Exam';
  }
  const inProgress = () => !!(S.run || loadRun());
  // the entry row shown on the Learn home (hook in learn.js)
  function entryHTML() {
    const r = S.run || loadRun(), last = [...M.progress.values()].filter(o => o.t === 'exam' && !o.del).sort((a, b) => b.at - a.at)[0];
    const sub = r ? 'Exam in progress · ' + mmss(r.end - Date.now()) + ' left' : last ? 'Last: ' + last.score + '% · ' + last.right + '/' + last.n : 'Mixed timed test across every topic';
    const ic = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5M12 2.5V5"/></svg>';
    return `<button type="button" class="ex-entry" data-exam-open><span class="ex-ei">${ic}</span><span class="ex-et"><b>${r ? 'Resume exam' : 'Exam mode'}</b><span>${esc(sub)}</span></span><span class="ex-chev">${window.Prefs && Prefs.icon ? Prefs.icon('chev', 16) : '›'}</span></button>`;
  }
  document.addEventListener('click', e => { const t = e.target.closest('[data-exam-open]'); if (t) { e.preventDefault(); open(); } });
  window.Exam = { render, open, inProgress, entryHTML, grade, _S: S };
})();
