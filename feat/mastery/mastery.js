/* Mastery: one knowledge model for every quiz in the app (feat/mastery/mastery.js).
   window.Mastery = { record(ev), recordMany(list), predict(item), pick(pool, opts), order(pool, opts), suggestLevel(courseOrTopic),
                      learnTest(lesson, lvl, course, li), learnResult(T, course, lesson, topic), nudgeHTML(T),
                      docPick(cases), docResult(case, win, guesses, hard), anatQuiz(src, nameOf, region), anatAnswer(part, ok, ms),
                      anatView(part), weakOrder(list), weakAnswer(rec, ok), level(tags), topics(), summary(), fading(n), recent(n), growth(days), on(fn), cfg() }
   Model: Elo / 1-PL IRT. Each topic has an ability theta (logits), each item a difficulty b. P(correct) = g + (1-g)·σ(θ − b), g = 1/choices for
   multiple choice. Both move after every answer (K shrinks with evidence). Items also carry a memory stability (days); recall = 2^(−Δt/S),
   so items fade and come back as spaced review. Topic ability decays slowly when a topic is idle.
   Storage: localStorage 'mastery.v1' (compact arrays, capped), synced through the app's D1 sync as progress records t:'ms'
   (id 'ms:core' + item shards 'ms:i0'…'ms:i7'); merge keeps the entry with more answers / the later answer, so devices converge. */
(function () {
  'use strict';
  if (window.Mastery) return;
  const KEY = 'mastery.v1', NSH = 8, ICAP = 3000, ECAP = 300, LCAP = 400, VCAP = 1700, DAYMS = 864e5, MINMS = 6e4;
  const now = () => Date.now();
  const sig = x => 1 / (1 + Math.exp(-x));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r3 = x => Math.round(x * 1000) / 1000;
  const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  const shardOf = id => parseInt(hash(id).slice(-2), 36) % NSH;
  const dk = t => window.Hub ? Hub.dayKey(t) : new Date(t - 4 * 36e5).toISOString().slice(0, 10);

  /* ---------- topics ---------- */
  const TOPIC = {
    german: ['German', 'lang'], french: ['French', 'lang'], spanish: ['Spanish', 'lang'], medicine: ['Medicine', 'sci'], neurology: ['Neurology', 'sci'],
    pharmacology: ['Pharmacology', 'sci'], medchem: ['Med Chem', 'sci'], cards: ['Other cards', 'cards'], doctordle: ['Doctordle', 'doc']
  };
  const SYS = { skeletal: 'Skeletal', muscular: 'Muscular', nervous: 'Nervous', cardiovascular: 'Heart & vessels', respiratory: 'Respiratory', digestive: 'Digestive', urinary: 'Urinary', endocrine: 'Endocrine', lymphatic: 'Lymphatic', skin: 'Skin' };
  const REG = { head: 'Head & neck', brain: 'Brain', skull: 'Skull', spine: 'Spine', thorax: 'Chest', abdomen: 'Abdomen', pelvis: 'Pelvis', 'arm-l': 'Left arm', 'arm-r': 'Right arm', 'hand-l': 'Left hand', 'hand-r': 'Right hand', 'leg-l': 'Left leg', 'leg-r': 'Right leg', 'foot-l': 'Left foot', 'foot-r': 'Right foot', body: 'Whole body' };
  function tname(k) {
    if (TOPIC[k]) return TOPIC[k][0];
    if (k.startsWith('anat.sys.')) return SYS[k.slice(9)] || k.slice(9);
    if (k.startsWith('anat.reg.')) return REG[k.slice(9)] || k.slice(9);
    if (k.startsWith('doc.')) return k.slice(4);
    return k;
  }
  function deckTopic(name) {
    const n = String(name || '').toLowerCase();
    if (/german|deutsch|goethe/.test(n)) return 'german'; if (/french|fran[cç]/.test(n)) return 'french'; if (/spanish|espa[nñ]ol/.test(n)) return 'spanish';
    if (/med ?chem|medicinal/.test(n)) return 'medchem'; if (/pharm|drug/.test(n)) return 'pharmacology'; if (/neuro|brain/.test(n)) return 'neurology';
    if (/anat|a&p|physio/.test(n)) return 'anat.sys.skeletal'; if (/med|clinic|path|usmle|doctor/.test(n)) return 'medicine';
    return 'cards';
  }
  const LEVELS = [['kid', "Like I'm 5", -1.6], ['hs', 'High school', -0.6], ['college', 'College', 0.25], ['phd', 'PhD', 1.0], ['expert', 'Expert', 1.7]];
  const LVB = Object.fromEntries(LEVELS.map(l => [l[0], l[2]]));
  function levelOfTheta(th) { let k = 0; for (let i = 0; i < LEVELS.length; i++) if (th >= LEVELS[i][2] - 0.35) k = i; return k; }

  /* ---------- state ---------- */
  // T[topic] = [theta, n, ok, last]   I[item] = [b, n, ok, last, stab, lastOk, topic, choices]   L[item] = [label, src, at]
  // V[partId] = firstSeen   H[day] = {topic: theta}   D[day] = [answers, correct]   E = [[t, item, score, ms]]
  function blank() { return { v: 1, T: {}, I: {}, L: {}, V: {}, H: {}, D: {}, E: [], mod: 0, sh: {} }; }
  let S = load();
  function load() { try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 1) return Object.assign(blank(), o); } catch (e) {} return blank(); }
  let saveT = 0, dirty = new Set(), coreDirty = false;
  function save() { S.mod = now(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { prune(true); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e2) {} } }, 250); pushSoon(); emit(); }
  function flush() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  addEventListener('pagehide', flush);
  addEventListener('storage', e => { if (e.key === KEY) { S = load(); emit(); } });
  const subs = new Set();
  function emit() { subs.forEach(f => { try { f(); } catch (e) {} }); }

  /* ---------- config (Settings keys: adapt.on, adapt.strength) ---------- */
  const DEF = { 'adapt.on': true, 'adapt.strength': 'balanced' };
  function installDefaults() { try { if (window.Settings && Settings.DEF) for (const k in DEF) if (!(k in Settings.DEF)) Settings.DEF[k] = DEF[k]; } catch (e) {} }
  installDefaults();
  function getCfg(k) {
    try { if (window.Settings) { const v = Settings.get(k); if (v !== undefined) return v; } } catch (e) {}
    try { const o = JSON.parse(localStorage.getItem('mastery.cfg') || '{}'); if (k in o) return o[k]; } catch (e) {}
    return DEF[k];
  }
  function setCfg(k, v) {
    if (window.Settings && Settings.set) { Settings.set(k, v); return; }
    try { const o = JSON.parse(localStorage.getItem('mastery.cfg') || '{}'); o[k] = v; localStorage.setItem('mastery.cfg', JSON.stringify(o)); } catch (e) {}
    emit();
  }
  const TARGET = { gentle: 0.85, balanced: 0.77, challenge: 0.68 };
  function cfg() { const on = getCfg('adapt.on') !== false, st = getCfg('adapt.strength') || 'balanced'; return { on, strength: st, target: TARGET[st] || 0.77 }; }

  /* ---------- core math ---------- */
  function topicTheta(k, t = now()) {
    const o = S.T[k]; if (!o) return 0;
    const idle = Math.max(0, (t - o[3]) / DAYMS);
    // slow decay after a week idle, at most −0.6
    return o[0] - Math.min(0.6, idle > 7 ? 0.12 * Math.log2(idle / 7 + 1) : 0);
  }
  // tags with more evidence count more, so a sparse sub-topic (a new Doctordle system, an unvisited region) leans on its broader tags
  function abilityFor(tags, t) { if (!tags || !tags.length) return 0; let s = 0, w = 0; for (const k of tags) { const n = S.T[k] ? S.T[k][1] : 0, wk = 0.12 + n / (n + 4); s += wk * topicTheta(k, t); w += wk; } return s / w; }
  function recallOf(it, t = now()) { if (!it || !it[1]) return null; const days = (t - it[3]) / DAYMS; return Math.pow(2, -days / Math.max(0.2, it[4] || 0.5)); }
  // the probability he gets this item right now
  function predictRaw(id, tags, b0, choices, t = now()) {
    const it = S.I[id], b = it ? it[0] : (b0 || 0), g = choices > 1 ? 1 / choices : 0;
    const p = g + (1 - g) * sig(abilityFor(tags, t) - b);
    if (!it || !it[1]) return p;
    const r = recallOf(it, t);
    return it[5] ? r * Math.max(p, 0.96) + (1 - r) * p : p * 0.85; // missed last time: a bit lower than ability alone
  }
  function record(ev) {
    // ev = { id, tags:[topic…], ok (bool) or score 0..1, ms, b (prior difficulty), choices, label, src, t }
    if (!ev || !ev.id) return null;
    const t = ev.t || now(), id = String(ev.id), tags = (ev.tags || []).filter(Boolean);
    let s = ev.score != null ? clamp(+ev.score, 0, 1) : ev.ok ? 1 : 0;
    if (s === 1 && ev.ms && ev.ms > (ev.choices > 1 ? 25000 : 45000)) s = 0.85; // slow right answer = weaker evidence
    const it = S.I[id] || (S.I[id] = [ev.b != null ? r3(ev.b) : 0, 0, 0, 0, 0, 0, tags[0] || '', ev.choices || 0]);
    const choices = ev.choices || it[7] || 0, g = choices > 1 ? 1 / choices : 0;
    const th = abilityFor(tags, t), p = g + (1 - g) * sig(th - it[0]);
    const err = s - p;
    // topic abilities
    for (const k of tags) {
      const o = S.T[k] || (S.T[k] = [0, 0, 0, t]);
      o[0] = topicTheta(k, t); // bank the decay
      const K = Math.max(0.18, 0.7 / (1 + o[1] / 30)) * (1 - g * 0.5);
      o[0] = r3(clamp(o[0] + K * err, -3.5, 4)); o[1]++; o[2] += s >= 0.5 ? 1 : 0; o[3] = t; coreDirty = true;
    }
    // item difficulty
    const Kb = 0.3 / (1 + it[1] / 2);
    it[0] = r3(clamp(it[0] - Kb * err, -4, 4.5));
    // memory: stability grows on success (more if it had faded), collapses on a miss
    const r = recallOf(it, t);
    if (s >= 0.5) { const gap = it[1] ? (t - it[3]) / DAYMS : 0; it[4] = r3(clamp(it[1] ? Math.max(it[4], 0.3) * (1.8 + 1.4 * (1 - (r == null ? 1 : r))) + gap * 0.3 : 1, 0.3, 365)); it[5] = 1; }
    else { it[4] = r3(Math.max(0.15, (it[4] || 0.5) * 0.35)); it[5] = 0; }
    it[1]++; it[2] += s >= 0.5 ? 1 : 0; it[3] = t; if (tags[0]) it[6] = tags[0]; if (choices) it[7] = choices;
    if (ev.label) { S.L[id] = [String(ev.label).slice(0, 70), ev.src || '', t]; }
    else if (S.L[id]) S.L[id][2] = t;
    S.E.push([t, id, s, ev.ms || 0]); if (S.E.length > ECAP) S.E.splice(0, S.E.length - ECAP);
    const d = dk(t), dd = S.D[d] || (S.D[d] = [0, 0]); dd[0]++; if (s >= 0.5) dd[1]++;
    snapshot(t, tags);
    dirty.add(shardOf(id));
    if (Object.keys(S.I).length > ICAP || Object.keys(S.L).length > LCAP) prune(false);
    save();
    return { p: r3(p), s, theta: r3(abilityFor(tags, t)), b: it[0] };
  }
  function recordMany(list) { const out = []; for (const e of list) out.push(record(e)); return out; }
  function snapshot(t, tags) { const d = dk(t), h = S.H[d] || (S.H[d] = {}); for (const k of (tags || Object.keys(S.T))) if (S.T[k]) h[k] = S.T[k][0]; const keys = Object.keys(S.H).sort(); if (keys.length > 120) for (const k of keys.slice(0, keys.length - 120)) delete S.H[k]; const dks = Object.keys(S.D).sort(); if (dks.length > 400) for (const k of dks.slice(0, dks.length - 400)) delete S.D[k]; }
  function prune(hard) {
    const cap = hard ? ICAP * 0.6 : ICAP;
    const ids = Object.keys(S.I);
    if (ids.length > cap) {
      // drop the least useful first: old, well-known items (their evidence already lives in the topic ability)
      ids.sort((a, b) => keepScore(S.I[a]) - keepScore(S.I[b]));
      for (const id of ids.slice(0, ids.length - cap)) { delete S.I[id]; delete S.L[id]; dirty.add(shardOf(id)); }
    }
    const ls = Object.keys(S.L); if (ls.length > LCAP) { ls.sort((a, b) => S.L[a][2] - S.L[b][2]); for (const id of ls.slice(0, ls.length - LCAP)) delete S.L[id]; }
    const vs = Object.keys(S.V); if (vs.length > VCAP) { vs.sort((a, b) => S.V[a] - S.V[b]); for (const id of vs.slice(0, vs.length - VCAP)) delete S.V[id]; }
    if (hard && S.E.length > 100) S.E = S.E.slice(-100);
  }
  function keepScore(it) { return it[3] / DAYMS - (it[5] ? 0 : 30) - Math.min(20, it[1]); }

  /* ---------- selection ---------- */
  // pool: any objects. opts: { id(x), tags(x)|tags, b(x) prior difficulty, choices(x)|choices, n, review (0..1 share of fading items), novelty }
  function scoreItem(x, o, t, target) {
    const id = String(o.id(x)), tags = typeof o.tags === 'function' ? o.tags(x) : o.tags || [], b0 = o.b ? o.b(x) : 0;
    const ch = typeof o.choices === 'function' ? o.choices(x) : o.choices || 0;
    const p = predictRaw(id, tags, b0, ch, t), it = S.I[id];
    const rec = it && it[1] ? recallOf(it, t) : null;
    const fading = !!(it && it[1] && (it[5] ? rec < 0.6 : (t - it[3]) > 10 * MINMS));
    const tooSoon = it && t - it[3] < 4 * MINMS;
    let w = Math.exp(-Math.pow((p - target) / 0.13, 2)) + 0.008;
    if (!it) w *= o.novelty || 1.15;
    if (it && it[5] && rec > 0.9) w *= 0.35; // solid and fresh: little to gain
    if (tooSoon) w *= 0.05;
    return { x, id, p, w, fading, seen: !!it };
  }
  function pick(pool, opts = {}) {
    const n = opts.n == null ? 1 : opts.n, t = opts.now || now(), C = cfg(), target = opts.target || C.target;
    if (n <= 0) return [];
    const o = Object.assign({ id: x => x.id }, opts);
    if (!pool || !pool.length) return [];
    if (!C.on) { const a = pool.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
    const sc = pool.map(x => scoreItem(x, o, t, target));
    const out = [], take = arr => { let tot = 0; for (const s of arr) tot += s.w; let r = Math.random() * tot; for (let i = 0; i < arr.length; i++) { r -= arr[i].w; if (r <= 0) return arr.splice(i, 1)[0]; } return arr.pop(); };
    // a fixed share of review (fading items, most faded first), the rest aimed at the target success rate
    const share = opts.review != null ? opts.review : 0.25, rv = sc.filter(s => s.fading), fresh = sc.filter(s => !s.fading);
    rv.forEach(s => { s.w = 0.2 + (1 - (S.I[s.id][5] ? recallOf(S.I[s.id], t) : 0)); });
    let nrev = Math.floor(n * share); if (Math.random() < n * share - nrev) nrev++;
    nrev = Math.min(nrev, rv.length); if (fresh.length < n - nrev) nrev = Math.min(rv.length, n - fresh.length);
    for (let i = 0; i < nrev; i++) out.push(take(rv));
    while (out.length < n && fresh.length) out.push(take(fresh));
    while (out.length < n && rv.length) out.push(take(rv));
    if (opts.withMeta) return out;
    // warm up: easiest first, hardest in the middle-late, a review item every few
    return out.sort((a, b) => b.p - a.p).map(s => s.x);
  }
  function order(pool, opts = {}) {
    // for queues that must keep every item (Weak Spots): lowest predicted recall first, sources interleaved
    const o = Object.assign({ id: x => x.id }, opts), t = now();
    if (!cfg().on) return pool.slice();
    const sc = pool.map(x => { const s = scoreItem(x, o, t, 0.5); return s; }).sort((a, b) => a.p - b.p);
    const grp = opts.group ? new Map() : null;
    if (!grp) return sc.map(s => s.x);
    for (const s of sc) { const g = opts.group(s.x); if (!grp.has(g)) grp.set(g, []); grp.get(g).push(s); }
    const lists = [...grp.values()], out = [];
    while (lists.some(l => l.length)) for (const l of lists) if (l.length) out.push(l.shift().x);
    return out;
  }
  function predict(item) { return predictRaw(String(item.id), item.tags || [], item.b || 0, item.choices || 0); }

  /* ---------- Learn ---------- */
  const LTOP = { de: 'german', fr: 'french', es: 'spanish', med: 'medicine', neuro: 'neurology', pharm: 'pharmacology', mchem: 'medchem' };
  function courseTopic(cid) {
    try { if (window.Learn && Learn.courseMeta) { const m = Learn.courseMeta(cid); if (m && m[0] && m[0].key) return m[0].key; } } catch (e) {}
    const pre = String(cid || '').split('-')[0];
    if (LTOP[pre]) return LTOP[pre];
    for (const k in TOPIC) if (String(cid).startsWith(k)) return k;
    return pre || 'cards';
  }
  function suggestLevel(cidOrTopic) {
    const tp = TOPIC[cidOrTopic] ? cidOrTopic : courseTopic(cidOrTopic), o = S.T[tp];
    if (!o || o[1] < 4) return { lvl: null, topic: tp, n: o ? o[1] : 0 };
    const th = topicTheta(tp) * (o[1] / (o[1] + 6)); // shrink toward 0 while evidence is thin
    const i = levelOfTheta(th);
    return { lvl: LEVELS[i][0], name: LEVELS[i][1], topic: tp, theta: r3(th), n: o[1] };
  }
  function qid(lesson, q) { return 'L:' + lesson.id + ':' + hash(q.q); }
  function qPrior(q, src) { return (src === 'kid' ? -1.4 : src === 'adv' ? 1.2 : 0) + (q.type === 'typed' ? 0.45 : 0) + Math.min(0.4, String(q.q || '').length / 600); }
  function learnTest(lesson, lvl, course, li) {
    const base = lesson.test || [];
    let N = (lvl === 'kid' && lesson.kidTest && lesson.kidTest.length ? lesson.kidTest : (lvl === 'phd' || lvl === 'expert') && lesson.advancedTest ? base.concat(lesson.advancedTest) : base).length;
    try { if (window.Settings) { const tl = +Settings.get('learn.testLen'); if (tl) N = Math.min(N, tl); } } catch (e) {}
    const tp = course && course.id ? courseTopic(course.id) : courseTopic(lesson.id);
    const tag = q => { const o = Object.create(Object.getPrototypeOf(q)); Object.assign(o, q); Object.defineProperty(o, '_m', { value: q._m, enumerable: false }); return o; };
    const pool = [];
    const have = new Set(), add = (arr, src, les, lvB) => (arr || []).forEach(q => { if (!q || !q.q || have.has(q.q)) return; have.add(q.q); const c = Object.assign({}, q); Object.defineProperty(c, '_m', { value: { id: qid(les, q), b: qPrior(q, src) + lvB, src, lid: les.id }, enumerable: false }); pool.push(c); });
    const lvShift = (LVB[lvl] || 0) * 0.35;
    if (lvl === 'kid') add(lesson.kidTest, 'kid', lesson, lvShift); add(base, 'std', lesson, lvShift); add(lesson.advancedTest, 'adv', lesson, lvShift); add(lesson.kidTest, 'kid', lesson, lvShift);
    if (!cfg().on || pool.length <= 1) return null;
    // the level he chose still frames the test: keep most questions from that level's own set
    const own = new Set((lvl === 'kid' && lesson.kidTest && lesson.kidTest.length ? lesson.kidTest : (lvl === 'phd' || lvl === 'expert') && lesson.advancedTest ? base.concat(lesson.advancedTest) : base).map(q => q.q));
    const meta = { id: x => x._m.id, tags: [tp], b: x => x._m.b, choices: x => x.type === 'mc' && x.choices ? x.choices.length : 0 };
    // spaced review from earlier lessons in this course that he has seen and is fading
    const rev = [];
    if (course && course.lessons && li > 0) for (let i = 0; i < li; i++) { const L = course.lessons[i]; [...(L.test || []), ...(L.advancedTest || [])].forEach(q => { const id = qid(L, q), it = S.I[id]; if (it && (it[5] ? recallOf(it) < 0.55 : true)) { const c = Object.assign({}, q); Object.defineProperty(c, '_m', { value: { id, b: it[0], src: 'review', lid: L.id }, enumerable: false }); rev.push(c); } }); }
    const nRev = Math.min(rev.length, N >= 5 ? 2 : 1);
    const ownPool = pool.filter(q => own.has(q.q)), extra = pool.filter(q => !own.has(q.q));
    const nExtra = (S.T[tp] && S.T[tp][1] >= 6) ? Math.min(extra.length, Math.max(0, Math.round(N * 0.3))) : 0; // no evidence yet: stay inside the level he chose
    const picks = [...pick(rev, Object.assign({ n: nRev, review: 1 }, meta)), ...pick(extra, Object.assign({ n: nExtra }, meta))];
    const seen = new Set(picks.map(q => q.q));
    const rest = pick(ownPool.filter(q => !seen.has(q.q)), Object.assign({ n: Math.max(0, N - picks.length) }, meta));
    const all = [...rest, ...picks.filter(q => !rest.some(r => r.q === q.q))].slice(0, Math.max(N, 1));
    // order: easy → hard by prediction, review items early
    const pr = q => predictRaw(q._m.id, [tp], q._m.b, meta.choices(q));
    all.sort((a, b) => (b._m.src === 'review') - (a._m.src === 'review') || pr(b) - pr(a));
    return all.length ? all : null;
  }
  function learnResult(T, course, lesson, topic) {
    if (!T || !T.qs) return;
    const tp = (topic && topic.key) || (course && course.id ? courseTopic(course.id) : courseTopic(T.cid)), t = now();
    T.qs.forEach((q, i) => {
      const a = T.ans[i]; if (!a) return;
      const m = q._m || { id: qid(lesson, q), b: qPrior(q, 'std') + (LVB[T.lvl] || 0) * 0.35 };
      record({ id: m.id, tags: [tp], ok: !!a.ok, ms: a.ms || (T._ms && T._ms[i]) || 0, b: m.b, choices: q.type === 'mc' && q.choices ? q.choices.length : 0, label: (lesson.title || '') + ': ' + q.q, src: 'learn', t: t + i });
    });
  }
  function nudgeHTML(T) {
    if (!T || !cfg().on) return '';
    const s = suggestLevel(T.cid); if (!s.lvl) return '';
    const cur = LEVELS.findIndex(l => l[0] === T.lvl), sug = LEVELS.findIndex(l => l[0] === s.lvl);
    if (sug > cur && T.score >= 80) return `<div class="ms-nudge"><div><b>Ready for ${s.name}</b><span>Your ${tname(s.topic)} level grew. Try this lesson one step up.</span></div><button class="btn small" data-llv="${s.lvl}">Try it</button></div>`;
    if (sug < cur && T.score < 50) return `<div class="ms-nudge"><div><b>Build it up first</b><span>${LEVELS[sug][1]} will lock this in faster, then step back up.</span></div><button class="btn small" data-llv="${s.lvl}">Switch</button></div>`;
    return '';
  }


  /* ---------- Learn response times (no hook needed: watches the test's own buttons) ---------- */
  function lt() { try { return window.Learn && Learn._S && Learn._S.test; } catch (e) { return null; } }
  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-lch],[data-lstart],[data-lnext],[data-lretake]'); if (!t) return; const T0 = lt();
    if (t.hasAttribute('data-lch')) { if (T0 && !T0.ans[T0.i]) { (T0._ms || (T0._ms = []))[T0.i] = now() - (T0._qAt || now()); } return; }
    setTimeout(() => { const T = lt(); if (T) T._qAt = now(); }, 0);
  }, true);
  document.addEventListener('submit', () => { const T = lt(); if (T && !T.ans[T.i]) (T._ms || (T._ms = []))[T.i] = now() - (T._qAt || now()); }, true);

  /* ---------- Doctordle ---------- */
  const docTags = c => ['doc.' + (c.system || 'General'), 'doctordle', c.area === 'Neuro' || /neuro/i.test(c.system || '') ? 'neurology' : 'medicine'];
  const docB = c => ({ 1: -0.7, 2: 0.3, 3: 1.2 }[c.difficulty] || 0);
  function docPick(cases) {
    const r = pick(cases, { n: 1, id: c => 'D:' + c.id, tags: docTags, b: docB, novelty: 1.6, review: 0 });
    return r[0] || null;
  }
  function docResult(c, win, guesses, hard) {
    if (!c) return;
    const score = win ? clamp(1.05 - 0.09 * Math.max(0, (guesses || 1) - 1) + (hard ? 0.05 : 0), 0.5, 1) : 0;
    return record({ id: 'D:' + c.id, tags: docTags(c), score, b: docB(c), label: c.dx, src: 'doc' });
  }

  /* ---------- Weak Spots ---------- */
  function weakTags(o) {
    if (o.src === 'learn' && o.topic) return [o.topic];
    if (o.src === 'doc') return ['doctordle', 'medicine'];
    if (o.src === 'anat') return ['anat.sys.' + (o.sys || 'skeletal')];
    if (o.src === 'card') { try { const d = M.decks.get((M.cards.get(o.cid) || {}).deck); return [deckTopic(d && d.name)]; } catch (e) { return ['cards']; } }
    if (o.src === 'rx') return ['pharmacology'];
    return ['cards'];
  }
  const weakB = o => 0.4 + 0.3 * Math.min(3, (o.misses || 1) - 1);
  function weakOrder(list) { return order(list, { id: o => 'W:' + o.id, tags: weakTags, b: weakB, choices: o => o.q && o.q.type === 'mc' && o.q.choices ? o.q.choices.length : 0, group: o => o.src }); }
  function weakAnswer(o, ok) {
    if (!o) return;
    const lbl = o.q && o.q.q ? o.q.q : o.label || 'Weak spot';
    record({ id: 'W:' + o.id, tags: weakTags(o), ok, b: weakB(o), choices: o.q && o.q.type === 'mc' && o.q.choices ? o.q.choices.length : 0, label: lbl, src: 'weak' });
    // the original item learns too: a fixed weak spot counts for its Learn question
    if (o.src === 'learn' && o.lid && o.q && o.q.q) record({ id: 'L:' + o.lid + ':' + hash(o.q.q), tags: weakTags(o), ok, choices: o.q.type === 'mc' && o.q.choices ? o.q.choices.length : 0, src: 'learn' });
  }

  /* ---------- Cards ---------- */
  function cardTags(c) { try { const d = M.decks.get(c.deck); return [deckTopic(d && d.name)]; } catch (e) { return ['cards']; } }
  function cardAnswer(card, g, ms) {
    if (!card) return;
    const ok = g >= 2, score = g === 1 ? 0 : g === 2 ? 0.6 : 1;
    let lbl = ''; try { const n = M.notes.get(card.nid); lbl = n ? String(n.front || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''; } catch (e) {}
    record({ id: 'C:' + card.id, tags: cardTags(card), score, ok, ms, b: card.st === 0 ? 0.2 : -0.2, label: lbl || 'Card', src: 'card' });
  }
  // new-card pace: more new cards when recent recall in that topic is strong, fewer when it is slipping
  function newFactor(deckId) {
    if (!cfg().on) return 1;
    try {
      const d = M.decks.get(deckId), tp = deckTopic(d && d.name), cut = now() - 7 * DAYMS; let n = 0, ok = 0;
      for (let i = S.E.length - 1; i >= 0 && n < 60; i--) { const e = S.E[i]; if (e[0] < cut) break; if (!e[1].startsWith('C:')) continue; const it = S.I[e[1]]; if (!it || it[6] !== tp) continue; n++; ok += e[2] >= 0.5 ? 1 : 0; }
      if (n < 15) return 1;
      const acc = ok / n, st = cfg().strength, top = st === 'challenge' ? 1.5 : st === 'gentle' ? 1.15 : 1.3;
      return acc >= 0.92 ? top : acc >= 0.85 ? 1.1 : acc >= 0.75 ? 1 : acc >= 0.65 ? 0.7 : 0.45;
    } catch (e) { return 1; }
  }
  function installCards() {
    if (typeof window.grade === 'function' && !window.grade._ms) {
      const og = window.grade;
      window.grade = async function (g) {
        let c = null, ms = 0; try { if (typeof cur !== 'undefined' && cur && typeof shown !== 'undefined' && shown) { c = cur; ms = typeof shownAt !== 'undefined' ? Date.now() - shownAt : 0; } } catch (e) {}
        const r = await og.apply(this, arguments);
        if (c) try { cardAnswer(c, g, ms); } catch (e) { console.warn('mastery', e); }
        return r;
      };
      window.grade._ms = 1;
    }
    if (typeof window.deckOpt === 'function' && !window.deckOpt._ms) {
      const od = window.deckOpt;
      window.deckOpt = function (id) { const o = od.apply(this, arguments); try { const d = M.decks.get(id); if (!(d && Number.isFinite(d.newPerDay))) o.newPerDay = Math.round(o.newPerDay * newFactor(id)); } catch (e) {} return o; };
      Object.keys(od).forEach(k => { window.deckOpt[k] = od[k]; }); window.deckOpt._ms = 1;
    }
  }

  /* ---------- Anatomy ---------- */
  const words = s => String(s || '').toLowerCase().replace(/\b(left|right|of|the|and|part|to)\b/g, ' ').split(/[^a-z0-9]+/).filter(w => w.length > 2);
  const dist = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 9;
  const mainReg = p => (p.tags || []).find(t => t !== 'skull' && t !== 'brain' && t !== 'spine') || (p.tags || [])[0] || 'body';
  const anatTags = p => ['anat.sys.' + p.sys, 'anat.reg.' + mainReg(p)].concat((p.tags || []).includes('brain') ? ['anat.reg.brain', 'neurology'] : []);
  function anatB(p) {
    const n = String(p.n || '').toLowerCase(); let b = 0.2;
    if (p.sys === 'skeletal') b -= 0.5; if (p.sys === 'digestive' || p.sys === 'respiratory') b -= 0.4; if (p.sys === 'cardiovascular') b += 0.35;
    if (/branch|tributar|segment|gyrus|sulcus|nucleus|part of|lobule|division|plexus/.test(n)) b += 0.6;
    b += Math.min(0.6, Math.max(0, n.split(' ').length - 3) * 0.15);
    if (/^(left |right )?(femur|humerus|tibia|heart|liver|stomach|skull|sternum|biceps|deltoid|lung|kidney|brain|patella|radius|ulna|clavicle|scapula|pelvis|spleen)/.test(n)) b -= 0.9;
    return r3(b);
  }
  function anatView(p) {
    if (!p || !p.id) return; const t = now();
    if (!S.V[p.id]) { S.V[p.id] = Math.round(t / 1000); dirty.add(shardOf('V:' + p.id)); coreDirty = true;
      for (const k of anatTags(p)) { const o = S.T[k] || (S.T[k] = [0, 0, 0, t]); o[3] = Math.max(o[3], t); }
      save(); }
  }
  function anatQuiz(src, nameOf, region) {
    if (!src || src.length < 4 || !cfg().on) return null;
    const t = now(), nm = p => (nameOf ? nameOf(p) : p.n);
    // what he already knows: viewed or answered parts → the quiz expands outward from there
    const known = src.filter(p => S.V[p.id] || (S.I['A:' + p.id] && S.I['A:' + p.id][2] > 0));
    const kc = known.map(p => p.c).filter(Boolean).slice(0, 400);
    const near = p => { if (!kc.length) return 0; let m = 9; for (const c of kc) { const d = dist(c, p.c); if (d < m) m = d; } return m; };
    const front = p => S.I['A:' + p.id] || S.V[p.id] ? 1 : kc.length ? 0.15 + 1.6 * Math.exp(-near(p) / 0.09) : (anatB(p) < 0 ? 1.4 : 0.6);
    const sample = src.length > 500 ? src.filter((p, i) => S.I['A:' + p.id] || S.V[p.id] || Math.random() < 500 / src.length) : src;
    const meta = { id: p => 'A:' + p.id, tags: anatTags, b: anatB, choices: 4 };
    const scored = pick(sample, Object.assign({ n: Math.min(12, sample.length), withMeta: true }, meta));
    if (!scored.length) return null;
    // weight the shortlist by frontier distance, then draw one
    let tot = 0; scored.forEach(s => { s.w2 = s.w * front(s.x); tot += s.w2; });
    let r = Math.random() * tot, ans = scored[0].x; for (const s of scored) { r -= s.w2; if (r <= 0) { ans = s.x; break; } }
    // distractors get closer to the answer as his level in that system rises
    const ev = anatTags(ans).reduce((a, k) => a + (S.T[k] ? S.T[k][1] : 0), 0), th = abilityFor(anatTags(ans), t) * (ev / (ev + 8)), lvl = clamp((th + 0.8) / 3.2, 0, 1); // 0 = beginner, 1 = expert
    const aw = new Set(words(nm(ans))), an = nm(ans);
    const cands = src.filter(p => p !== ans && nm(p) !== an).map(p => {
      const w = words(nm(p)); let j = 0; w.forEach(x => { if (aw.has(x)) j++; }); const jac = j / Math.max(1, new Set([...w, ...aw]).size);
      const sim = 2.2 * jac + (p.sys === ans.sys ? 1 : 0) + 1.2 * Math.exp(-dist(p.c, ans.c) / 0.08) + (mainReg(p) === mainReg(ans) ? 0.4 : 0);
      return { p, sim };
    });
    // beginner: aim for low-similarity options (other systems); expert: the most confusable ones
    const aim = 0.6 + lvl * 3.4;
    cands.forEach(c => { c.k = -Math.abs(c.sim - aim) + Math.random() * 0.6; });
    cands.sort((a, b) => b.k - a.k);
    const opts = [ans]; const used = new Set([an]);
    for (const c of cands) { if (opts.length >= 4) break; const n = nm(c.p); if (used.has(n)) continue; used.add(n); opts.push(c.p); }
    if (opts.length < 4) return null;
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return { ans, opts, level: r3(lvl), at: t };
  }
  function anatAnswer(p, ok, ms, nameOf) {
    if (!p) return;
    anatView(p);
    return record({ id: 'A:' + p.id, tags: anatTags(p), ok, ms, b: anatB(p), choices: 4, label: nameOf ? nameOf(p) : p.n, src: 'anat' });
  }
  let partsP = null;
  function anatParts() { return partsP || (partsP = fetch('anat/v2/parts.json').then(r => r.ok ? r.json() : null).then(d => { const out = []; if (d && d.parts) for (const id in d.parts) { const p = d.parts[id]; out.push({ id, n: p[0], sys: Array.isArray(p) ? p[1] : p.sys, tags: Array.isArray(p) ? p[2] : p.tags }); } return out; }).catch(() => { partsP = null; return []; })); }


  // 0 (beginner) … 1 (expert) for a set of topic tags: modules use it to make distractors closer (same drug class, neighbouring parts)
  function level(tags) { if (!cfg().on) return 0.4; const ev = tags.reduce((a, k) => a + (S.T[k] ? S.T[k][1] : 0), 0); return r3(clamp((abilityFor(tags) * (ev / (ev + 8)) + 0.8) / 3.2, 0, 1)); }

  /* ---------- read side (for the What I know screen) ---------- */
  function topicPct(k, t = now()) { const o = S.T[k]; if (!o) return 0; const th = topicTheta(k, t) * (o[1] / (o[1] + 5)); return Math.round(100 * sig(1.1 * (th + 0.2))); }
  function topics() {
    const t = now(), out = [];
    for (const k in S.T) { const o = S.T[k]; if (!o[1] && !k.startsWith('anat.')) continue; const th = topicTheta(k, t) * (o[1] / (o[1] + 5)); const lv = LEVELS[levelOfTheta(th)];
      const wk = histTheta(k, 7); out.push({ k, name: tname(k), n: o[1], ok: o[2], acc: o[1] ? Math.round(100 * o[2] / o[1]) : 0, theta: r3(th), pct: topicPct(k, t), level: lv[1], lvl: lv[0], last: o[3], trend: wk == null ? 0 : r3(o[0] - wk) }); }
    return out;
  }
  function histTheta(k, daysAgo) { const d = dk(now() - daysAgo * DAYMS), ks = Object.keys(S.H).filter(x => x <= d).sort(); for (let i = ks.length - 1; i >= 0; i--) if (S.H[ks[i]][k] != null) return S.H[ks[i]][k]; return null; }
  function fading(n = 8) {
    const t = now(), out = [];
    for (const id in S.I) { const it = S.I[id]; if (!it[1]) continue; const r = recallOf(it, t); if (it[5] ? r < 0.6 : true) out.push({ id, r: it[5] ? r : 0, missed: !it[5], label: (S.L[id] || [])[0] || '', src: (S.L[id] || [])[1] || id[0], topic: it[6], last: it[3] }); }
    return out.filter(x => x.label).sort((a, b) => a.r - b.r || b.last - a.last).slice(0, n);
  }
  function recent(n = 8) {
    const out = [], seen = new Set();
    for (let i = S.E.length - 1; i >= 0 && out.length < n; i--) { const e = S.E[i]; if (seen.has(e[1]) || e[2] < 0.5) continue; seen.add(e[1]); const it = S.I[e[1]], L = S.L[e[1]]; if (!it || !L) continue; out.push({ id: e[1], label: L[0], src: L[1], topic: it[6], at: e[0], strong: it[5] && it[4] >= 3 }); }
    return out;
  }
  function growth(days = 30) {
    const out = [], t = now(), cur = {}, first = dk(t - (days - 1) * DAYMS);
    // carry each topic's last known ability forward day by day
    for (const d of Object.keys(S.H).sort()) { if (d >= first) break; Object.assign(cur, S.H[d]); }
    for (let i = days - 1; i >= 0; i--) {
      const d = dk(t - i * DAYMS); if (S.H[d]) Object.assign(cur, S.H[d]);
      const ks = Object.keys(cur).filter(k => !k.startsWith('anat.reg.') && k !== 'doctordle');
      const avg = ks.length ? ks.reduce((a, k) => a + cur[k], 0) / ks.length : null;
      out.push({ d, theta: avg == null ? null : r3(avg), n: (S.D[d] || [0, 0])[0], ok: (S.D[d] || [0, 0])[1] });
    }
    return out;
  }
  function summary() {
    const ids = Object.keys(S.I); let strong = 0, learning = 0, fade = 0; const t = now();
    for (const id of ids) { const it = S.I[id]; if (!it[1]) continue; const r = recallOf(it, t); if (it[5] && it[4] >= 7 && r > 0.6) strong++; else if (it[5] && r >= 0.6) learning++; else fade++; }
    let wk = 0, wok = 0; for (let i = 0; i < 7; i++) { const x = S.D[dk(t - i * DAYMS)]; if (x) { wk += x[0]; wok += x[1]; } }
    const g = growth(30).filter(x => x.theta != null), lvl = g.length ? g[g.length - 1].theta : 0;
    return { items: ids.length, strong, learning, fading: fade, week: wk, weekAcc: wk ? Math.round(100 * wok / wk) : 0, viewed: Object.keys(S.V).length, level: lvl, answers: Object.values(S.T).reduce((a, o) => a + o[1], 0) };
  }

  /* ---------- sync through D1 (progress records t:'ms') ---------- */
  let pushT = 0;
  function pushSoon() { clearTimeout(pushT); pushT = setTimeout(push, 4000); }
  function shardData(i) { const I = {}, L = {}, V = {}; for (const id in S.I) if (shardOf(id) === i) I[id] = S.I[id]; for (const id in S.L) if (shardOf(id) === i && I[id]) L[id] = S.L[id]; for (const id in S.V) if (shardOf('V:' + id) === i) V[id] = S.V[id]; return { I, L, V }; }
  function push() {
    try {
      if (typeof write !== 'function' || typeof M === 'undefined' || !M.progress) return;
      const list = [];
      if (coreDirty || dirty.size) list.push(['progress', { id: 'ms:core', t: 'ms', T: S.T, H: S.H, D: S.D, E: S.E.slice(-120), del: 0 }]);
      for (const i of dirty) list.push(['progress', Object.assign({ id: 'ms:i' + i, t: 'ms', del: 0 }, shardData(i))]);
      dirty = new Set(); coreDirty = false;
      if (list.length) { list.forEach(([, o]) => { seen[o.id] = Infinity; }); write(list).then(() => list.forEach(([, o]) => { seen[o.id] = (M.progress.get(o.id) || {}).mod || 0; })); }
    } catch (e) { console.warn('mastery push', e); }
  }
  const seen = {};
  function pull() {
    if (typeof M === 'undefined' || !M.progress) return;
    let changed = false;
    for (const o of M.progress.values()) {
      if (o.t !== 'ms' || o.del || !(o.id in seen ? (o.mod || 0) > seen[o.id] : true)) continue;
      seen[o.id] = o.mod || 0;
      if (o.T) for (const k in o.T) { const a = S.T[k], b = o.T[k]; if (!a || b[1] > a[1] || (b[1] === a[1] && b[3] > a[3])) { S.T[k] = b; changed = true; } }
      if (o.H) for (const d in o.H) { S.H[d] = Object.assign({}, o.H[d], S.H[d] || {}); }
      if (o.D) for (const d in o.D) { const a = S.D[d], b = o.D[d]; if (!a || b[0] > a[0]) { S.D[d] = b; changed = true; } }
      if (o.E && o.E.length) { const have = new Set(S.E.map(e => e[0] + e[1])); const add = o.E.filter(e => !have.has(e[0] + e[1])); if (add.length) { S.E = S.E.concat(add).sort((a, b) => a[0] - b[0]).slice(-ECAP); changed = true; } }
      if (o.I) for (const id in o.I) { const a = S.I[id], b = o.I[id]; if (!a || b[1] > a[1] || (b[1] === a[1] && b[3] > a[3])) { S.I[id] = b; changed = true; } }
      if (o.L) for (const id in o.L) { const a = S.L[id], b = o.L[id]; if (!a || b[2] > a[2]) S.L[id] = b; }
      if (o.V) for (const id in o.V) if (!S.V[id]) { S.V[id] = o.V[id]; changed = true; }
    }
    if (changed) { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} emit(); }
  }

  /* ---------- boot ---------- */
  function boot() {
    installDefaults(); installCards();
    if (typeof changeHooks !== 'undefined' && Array.isArray(changeHooks) && !boot.h) { changeHooks.push(pull); boot.h = 1; }
    setTimeout(pull, 1500);
    if (window.XView && XView.MODS && !XView.MODS.know) XView.MODS.know = { title: 'What I know', render: el => window.Know && Know.render(el) };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);

  window.Mastery = {
    record, recordMany, predict, pick, order, suggestLevel, courseTopic, learnTest, learnResult, nudgeHTML, docPick, docResult,
    anatQuiz, anatAnswer, anatView, anatParts, anatTags, weakOrder, weakAnswer, cardAnswer, newFactor, deckTopic,
    topics, topicPct, summary, fading, recent, growth, cfg, setCfg, tname, level, hash, LEVELS, SYS, REG, TOPIC,
    on: f => { subs.add(f); return () => subs.delete(f); }, flush, pull, push, _S: () => S, _reset: () => { S = blank(); flush(); emit(); }
  };
})();
