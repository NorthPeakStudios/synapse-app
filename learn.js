/* Learn mode: topic folders (4 × 50 course banners, plus 'deep' folders of 10 courses × 5 lessons) × 5 levels. Content is lazy-loaded JSON (learn/manifest.json + one file per course). */
'use strict';
(function () {
const LVN = { kid: "Like I'm 5", hs: 'High school', college: 'College', phd: 'PhD', expert: 'Doctor' }; // v120: short names under the level badges
const LEVELS = [
  { k: 'kid', name: "Like I'm 5", short: '5', ic: '<i class="lvm">5</i>' },
  { k: 'hs', name: 'High school', short: 'HS', ic: '<i class="lvm">HS</i>' },
  { k: 'college', name: 'College', short: 'Col', ic: '<i class="lvm">Col</i>' },
  { k: 'phd', name: 'PhD', short: 'PhD', ic: '<i class="lvm">PhD</i>' },
  { k: 'expert', name: 'Doctor / Expert', short: 'Dr', ic: '<i class="lvm">Dr</i>' }
];
const TMARK = { german: ['t', 'DE'], french: ['t', 'FR'], spanish: ['t', 'ES'], medicine: ['i', 'doc'], medchem: ['i', 'flask'], pharmacology: ['i', 'pill'], neurology: ['i', 'brain'],
  pharmacognosy: ['s', 'leaf'], drughistory: ['i', 'library'], cogneuro: ['i', 'brain'], headneck: ['i', 'anat'], biochem: ['i', 'flask'], pharmaceutics: ['i', 'pill'], neuromethods: ['i', 'bolt'], neurogenetics: ['s', 'dna'], histology: ['i', 'layers'], medgerman: ['t', 'DE'],
  virology: ['s', 'virus'], hematology: ['s', 'drop'], ophthent: ['i', 'eye'], molbio: ['s', 'dna'], embryology: ['s', 'egg'], medroots: ['t', 'LA'], orgchem: ['s', 'hex'], trunk: ['i', 'steth'], limbs: ['i', 'anat'], intphys: ['i', 'flame'], medspanish: ['t', 'ES'] };
const SIC = { leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>', dna: '<path d="M7 3c0 6 10 6 10 12s-10 6-10 6"/><path d="M17 3c0 6-10 6-10 12s10 6 10 6"/><path d="M8 7h8M8 17h8"/>', virus: '<circle cx="12" cy="12" r="5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>', drop: '<path d="M12 3c3.5 4.5 6 8 6 11a6 6 0 0 1-12 0c0-3 2.5-6.5 6-11z"/>', egg: '<path d="M12 3c4 0 7 6 7 11a7 7 0 0 1-14 0c0-5 3-11 7-11z"/>', hex: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/><circle cx="12" cy="12" r="3.5"/>' };
const tmark = t => { const m = TMARK[t.key]; if (!m || !window.Prefs) return t.icon; if (m[0] === 's') return `<svg class="ic-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIC[m[1]]}</svg>`; return m[0] === 't' ? `<b class="tmono">${m[1]}</b>` : Prefs.icon(m[1], 22); };
const lessonCount = t => t.courses.reduce((a, c) => a + (c.status === 'ready' ? c.lessons.length : 0), 0);
const LV = Object.fromEntries(LEVELS.map(l => [l.k, l]));
const PASS = 80;
const S = { manifest: null, loading: null, courses: new Map(), route: { page: 'home' }, test: null, err: null };
const P = () => [...M.progress.values()].filter(o => !o.del);
const lessonRecs = () => P().filter(o => o.t === 'lesson');
const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

/* ---------- data ---------- */
function refreshManifest() {
  if (!S.manifest || Date.now() - (S.mAt || 0) < 60000 || !navigator.onLine) return;
  S.mAt = Date.now();
  fetch('learn/manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(j => { if (j && JSON.stringify(j) !== JSON.stringify(S.manifest)) { S.manifest = j; if (view === 'learn' && ['home', 'topic'].includes(S.route.page)) render(); } }).catch(() => {});
}
async function getManifest() {
  if (S.manifest) return S.manifest;
  if (!S.loading) S.loading = fetch('learn/manifest.json').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); })
    .then(j => { S.manifest = j; S.mAt = Date.now(); S.err = null; return j; }).catch(e => { S.loading = null; S.err = e; throw e; });
  return S.loading;
}
const topicOf = k => S.manifest.topics.find(t => t.key === k);
const courseMeta = id => { for (const t of S.manifest.topics) for (const c of t.courses) if (c.id === id) return [t, c]; return [null, null]; };
async function getCourse(id) {
  if (S.courses.has(id)) return S.courses.get(id);
  const [, c] = courseMeta(id); if (!c || !c.file) throw new Error('not built');
  const r = await fetch(c.file); if (!r.ok) throw new Error('course ' + r.status);
  const j = await r.json(); S.courses.set(id, j); return j;
}
function testFor(lesson, lvl) {
  if (lvl === 'kid' && lesson.kidTest && lesson.kidTest.length) return lesson.kidTest;
  if ((lvl === 'phd' || lvl === 'expert') && lesson.advancedTest) return [...lesson.test, ...lesson.advancedTest];
  return lesson.test;
}

/* ---------- progress ---------- */
const recOf = (lid, lvl) => { const o = M.progress.get(lid + '@' + lvl); return o && !o.del ? o : null; };
function courseLevelStats(c, lvl) {
  const n = c.lessons.length; let passed = 0, read = 0;
  for (let i = 1; i <= n; i++) { const o = recOf(c.id + '-l' + String(i).padStart(2, '0'), lvl); if (o) { if (o.passed) passed++; if (o.read || o.at) read++; } }
  return { n, passed, read, done: n > 0 && passed === n };
}
function topicStats(t) {
  const recs = lessonRecs().filter(o => o.topic === t.key);
  let versions = 0, started = 0;
  for (const c of t.courses) for (const l of LEVELS) { const s = courseLevelStats(c, l.k); if (s.done) versions++; if (s.read) started++; }
  return { passed: recs.filter(o => o.passed).length, versions, started, built: t.courses.filter(c => c.status === 'ready').length };
}
function streak() {
  const days = new Set(); for (const o of lessonRecs()) { for (const t of [o.at, o.read]) if (t) days.add(dayStart(t)); }
  let d = dayStart(Date.now()), n = 0; if (!days.has(d)) d -= DAY;
  while (days.has(d)) { n++; d -= DAY; }
  return n;
}
function recent(limit) {
  return lessonRecs().filter(o => o.at).map(o => ({ o, t: o.at })).sort((a, b) => b.t - a.t).slice(0, limit).map(x => x.o);
}
async function saveRec(patch) {
  const id = patch.lid + '@' + patch.lvl, ex = M.progress.get(id);
  const base = ex && !ex.del ? ex : { id, t: 'lesson', tries: 0, best: null, passed: 0 };
  const rec = { ...base, ...patch, id, t: 'lesson' }; delete rec.del;
  await write([['progress', rec]]);
  return rec;
}
async function setLastLevel(cid, lvl) {
  const id = 'lv:' + cid, ex = M.progress.get(id);
  if (ex && !ex.del && ex.lvl === lvl) return;
  await write([['progress', { id, t: 'pref', cid, lvl }]]);
}
const lastLevel = cid => { const o = M.progress.get('lv:' + cid); return o && !o.del ? o.lvl : null; };

/* ---------- text ---------- */
function md(s) {
  const fmt = x => esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  return String(s || '').replace(/\r/g, '').split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-•]\s+/.test(l))) return '<ul>' + lines.map(l => '<li>' + fmt(l.replace(/^\s*[-•]\s+/, '')) + '</li>').join('') + '</ul>';
    const out = []; let ul = [];
    for (const l of lines) { if (/^\s*[-•]\s+/.test(l)) ul.push('<li>' + fmt(l.replace(/^\s*[-•]\s+/, '')) + '</li>'); else { if (ul.length) { out.push('<ul>' + ul.join('') + '</ul>'); ul = []; } out.push('<p>' + fmt(l) + '</p>'); } }
    if (ul.length) out.push('<ul>' + ul.join('') + '</ul>');
    return out.join('');
  }).join('');
}
const norm = s => String(s || '').normalize('NFC').toLowerCase().replace(/[\u2019\u2018`´]/g, "'").replace(/[\u201c\u201d«»"]/g, '').replace(/\s+/g, ' ').trim().replace(/[.!?;,:…]+$/, '').replace(/^[¿¡]+/, '').trim();
function isRight(q, given) {
  const g = norm(given); if (!g) return false;
  const opts = [q.answer, ...(q.accept || [])].map(norm);
  if (opts.includes(g)) return true;
  if (opts.map(o => o.replace(/ß/g, 'ss')).includes(g.replace(/ß/g, 'ss'))) return true;
  return window.Settings ? Settings.matchTyped(g, opts) : false;
}
const testCap = () => { const n = window.Settings ? +Settings.get('learn.testLen') : 0; return n > 0 ? n : 0; };
const capTest = qs => { const n = testCap(); return n && qs && qs.length > n ? qs.slice(0, n) : qs; };
const testLen = (l, lvl) => { const n = testFor(l, lvl).length, c = testCap(); return c ? Math.min(c, n) : n; };

/* ---------- listen (on-device speech, no network) ---------- */
const VOICE_LANG = { german: 'de-DE', french: 'fr-FR', spanish: 'es-ES' };
const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const VX = { ready: false, voices: [] };
function loadVoices() {
  if (!canSpeak()) { VX.ready = true; return; }
  const v = window.speechSynthesis.getVoices() || [];
  if (v.length) { VX.voices = v; VX.ready = true; }
}
function pickVoice(lang) {
  const pre = lang.slice(0, 2).toLowerCase(), L = x => String(x.lang || '').replace('_', '-').toLowerCase();
  const m = VX.voices.filter(x => L(x).startsWith(pre)); if (!m.length) return null;
  const score = x => (L(x) === lang.toLowerCase() ? 5 : 0) + (/enhanced|premium|neural|natural|siri/i.test(x.name) ? 3 : 0) + (x.localService ? 1 : 0) + (x.default ? 0.5 : 0);
  return m.slice().sort((a, b) => score(b) - score(a))[0];
}
// null = still loading (buttons stay), true/false once the voice list is known
function hasVoice(lang) { if (!canSpeak()) return false; if (!VX.ready || !VX.voices.length) return null; return !!pickVoice(lang); } // no voice list (iOS PWA) = keep the button, speak by lang
if (canSpeak()) {
  loadVoices();
  try { window.speechSynthesis.addEventListener('voiceschanged', () => { const was = VX.ready; loadVoices(); applyVoiceVis(); if (!was && S.route && S.route.page === 'lesson') rLesson(); }); } catch (e) {}
  // some engines never fire voiceschanged when they have no voices at all
  setTimeout(() => { if (!VX.ready) { loadVoices(); VX.ready = true; applyVoiceVis(); } }, 2500);
}
function applyVoiceVis() {
  document.querySelectorAll('[data-vlang]').forEach(n => { n.hidden = hasVoice(n.dataset.vlang) === false; });
}
const isSlow = () => { try { return localStorage.getItem('learn.slow') === '1'; } catch (e) { return false; } };
const cleanSay = t => String(t).replace(/\([^)]*\)/g, ' ').replace(/\s+[=\u2192]\s+.*$/, '').replace(/[\u2013\u2014]/g, ', ').replace(/\s+/g, ' ').trim();
// speak target-language text only — called from a tap handler, never on its own
function speak(texts, lang, slow) {
  if (!canSpeak()) { toast('Listening isn\'t supported in this browser'); return; }
  // everything below stays synchronous inside the tap (iOS only speaks from a user gesture)
  try { window.TTSAudio && TTSAudio.hold(); } catch (e) {} // plays with the silent switch on
  const ss = window.speechSynthesis; if (!VX.voices.length) loadVoices();
  const v = pickVoice(lang), rate = (slow === undefined ? isSlow() : slow) ? 0.7 : 1;
  try { if (ss.speaking || ss.pending) ss.cancel(); } catch (e) {}
  try { if (ss.paused) ss.resume(); } catch (e) {}
  const parts = [];
  for (const t of [].concat(texts)) { const s = cleanSay(t); if (!s) continue; if (s.length <= 180) parts.push(s); else (s.match(/[^.!?;:]+[.!?;:]*\s*/g) || [s]).forEach(x => { x = x.trim(); if (x) parts.push(x); }); }
  for (const s of parts) { const u = new SpeechSynthesisUtterance(s); u.lang = lang; u.rate = rate; if (v && String(v.lang || '').slice(0, 2).toLowerCase() === lang.slice(0, 2).toLowerCase()) u.voice = v; ss.speak(u); }
  try { ss.resume(); } catch (e) {} // iOS can sit in a stuck paused state
}
// target-language terms worth a listen button in a language lesson (never the English gloss)
const LANG_MARK = { german: /[äöüßÄÖÜ]/, french: /[éèêëàâçîïôûùœÉÈÊÀÇÔŒ]/, spanish: /[ñáéíóúü¿¡ÑÁÉÍÓÚ]/ };
const EN_STOP = new Set('the is are of for with and to you your this that it its means mean when use used not be or by from has have will word words verb verbs noun nouns english like how what which they he she we there their these those than then into only also just because say said sound sounds letter letters end vs versus writing written spelled'.split(' '));
function sayTerms(l, key, lvl) {
  const toks = s => String(s).toLowerCase().normalize('NFC').match(/[\p{L}']+/gu) || [];
  const vocab = new Set(), mark = LANG_MARK[key];
  (l.examples || []).forEach(e => toks(e.src).forEach(w => w.length > 1 && vocab.add(w)));
  [...(l.test || []), ...(l.kidTest || []), ...(l.advancedTest || [])].forEach(q => { if (q.type !== 'mc') [q.answer, ...(q.accept || [])].forEach(x => toks(x).forEach(w => w.length > 1 && vocab.add(w))); });
  const english = w => { const n = w.filter(x => EN_STOP.has(x)).length; return n && n / w.length >= 0.25; };
  const out = [], seen = new Set();
  const add = (s, force) => {
    const c = cleanSay(s).replace(/^(?:vs\.?|versus)\s+/i, '').replace(/^[\s,;:*"'“”]+|[\s,;:"'“”]+$/g, ''); if (!c || c.length > 80 || /^\/|\//.test(c)) return;
    const w = toks(c); if (!w.length || english(w)) return;
    if (!force && !(mark && mark.test(c)) && w.filter(x => vocab.has(x)).length / w.length < 0.5) return;
    const k = c.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(c); }
  };
  const text = String(l.levels[lvl] || '');
  // **bold** terms
  const re = /\*\*(.+?)\*\*(\s*(=|\(|\u2013|\u2014|:)?)/g; let m;
  while ((m = re.exec(text))) { const b = m[1].trim(), f = m[3]; if (/[.:]$/.test(b) && !f) continue; add(b, f === '=' || (toks(b).length === 1 && b.length <= 4)); }
  // sound items: word /ipa/ and /ipa/ (word, word)
  for (const x of text.matchAll(/([\p{L}'-]+(?: [\p{L}'-]+)?) \/[^/\s][^/]{0,14}\//gu)) add(x[1], true);
  for (const x of text.matchAll(/\/[^/\s][^/]{0,14}\/\s*\(([^)]{1,40})\)/gu)) x[1].split(/,\s*|\s+and\s+/).forEach(y => add(y, true));
  // bullet lines written in the target language
  for (const ln of text.split('\n')) { const t = ln.match(/^\s*[-•]\s+(?!\*[^*])(.+)$/); if (!t) continue; const s = t[1].replace(/\*\*/g, '').split(/\s(?:=|\u2192|\u2014|\u2013)\s/)[0]; if (toks(s).length <= 12) add(s); }
  // key points: "term = gloss" pairs
  (l.keyPoints || []).forEach(k => { for (const x of String(k).replace(/\*\*/g, '').matchAll(/(?:^|[;,:]\s+)([^;,:=]{1,40}?)\s=\s/g)) add(x[1], true); });
  return out.slice(0, 48);
}

/* ---------- views ---------- */
const el = () => $('#v-learn');
function nav(route) { S.route = route; render(); window.scrollTo(0, 0); }
function back() {
  const r = S.route;
  if (r.page === 'result' || r.page === 'test') nav({ page: 'lesson', cid: r.cid, lvl: r.lvl, li: r.li });
  else if (r.page === 'lesson') nav({ page: 'course', cid: r.cid, lvl: r.lvl });
  else if (r.page === 'course') nav({ page: 'topic', topic: courseMeta(r.cid)[0].key });
  else nav({ page: 'home' });
}
const backBar = label => `<button class="lback" data-lback>‹ ${esc(label)}</button>`;
function ring(pct, color) { return `<span class="ring" style="--p:${Math.round(pct)};--c:${color}"><span>${Math.round(pct)}%</span></span>`; }
function dots(c) { return `<span class="ldots" aria-label="levels completed">${LEVELS.map(l => { const s = c.status === 'ready' ? courseLevelStats(c, l.k) : null; return `<i class="${s && s.done ? 'on' : s && s.read ? 'half' : ''}" title="${esc(l.name)}"></i>`; }).join('')}</span>`; }
// v127: pick-up-where-you-left-off card on the Learn home (the recent list only showed tested lessons)
function continueHTML() {
  try {
    const recs = lessonRecs().filter(o => o.read || o.at).map(o => ({ o, t: Math.max(o.read || 0, o.at || 0) })).sort((a, b) => b.t - a.t);
    if (!recs.length) return '';
    const o = recs[0].o, tc = courseMeta(o.cid); if (!tc || !tc[1]) return '';
    const t = tc[0], c = tc[1], lvn = (LV[o.lvl] || {}).name || o.lvl;
    let label = 'Continue', title = o.title || o.lid, lid = o.lid, sub = o.at && !o.passed ? 'Not passed yet · retake the test' : 'Finish reading, then take the test';
    if (o.passed) {
      const li = parseInt(String(o.lid).split('-l').pop(), 10); const nt = c.lessons && c.lessons[li];
      if (!nt) return '';
      label = 'Next up'; title = nt; lid = String(o.lid).replace(/\d+$/, n => String(li + 1).padStart(n.length, '0')); sub = 'Lesson ' + (li + 1) + ' of ' + c.lessons.length;
    }
    return `<h3>${label}</h3><div class="lrecent"><button class="lrow lcont" data-lopen="${esc(o.cid)}|${esc(o.lvl)}|${esc(lid)}"><span class="num">▶</span><span class="tx"><span class="t1">${esc(title)}</span><span class="t2">${esc(t.name)} · Course ${c.n} · ${esc(lvn)} · ${esc(sub)}</span></span></button></div>`;
  } catch (e) { return ''; }
}
function recentList(limit) {
  const r = recent(limit);
  if (!r.length) return '<div class="empty small">Nothing completed yet. Open a folder, pick a course and a level, read a lesson and take its test.</div>';
  return '<div class="lrecent">' + r.map(o => {
    const t = S.manifest ? topicOf(o.topic) : null;
    const score = o.at ? `<span class="sc ${o.last >= PASS ? 'ok' : 'bad'}">${o.last}%</span>` : '<span class="sc rd">read</span>';
    return `<button class="lrow" data-lopen="${esc(o.cid)}|${esc(o.lvl)}|${esc(o.lid)}">${score}<span class="tx"><span class="t1">${esc(o.title || o.lid)}</span><span class="t2">${esc(t ? t.name : o.tname || o.topic)} · Course ${o.cn || ''} · ${esc((LV[o.lvl] || {}).name || o.lvl)} · ${fmtDate(Math.max(o.at || 0, o.read || 0))}</span></span></button>`;
  }).join('') + '</div>';
}
function stopReading() { try { speechSynthesis.cancel(); } catch (e) {} S.reading = false; clearInterval(S.readT); const b = el() && el().querySelector('[data-lread]'); if (b) { b.textContent = '🔊 Listen'; b.setAttribute('aria-pressed', 'false'); } }
function render() {
  if (!el()) return;
  if (S.reading) stopReading();
  if (!S.manifest) {
    el().innerHTML = S.err ? `<div class="empty">Couldn't load courses${navigator.onLine ? '' : ' (offline, not cached yet)'}.<br><button class="btn" data-lretry style="margin-top:12px">Try again</button></div>` : '<div class="empty">Loading courses…</div>';
    getManifest().then(render, () => render());
    return;
  }
  const r = S.route; if (r.page === 'home' || r.page === 'topic') refreshManifest();
  try { ({ home: rHome, topic: rTopic, course: rCourse, lesson: rLesson, test: rTest, result: rResult })[r.page](); }
  catch (e) { console.error(e); el().innerHTML = '<div class="empty">Something went wrong. <button class="btn" data-lhome>Back to Learn</button></div>'; }
}
function rHome() {
  const m = S.manifest, st = streak(), recs = lessonRecs();
  const passed = recs.filter(o => o.passed).length, built = m.topics.reduce((a, t) => a + t.courses.filter(c => c.status === 'ready').length, 0);
  el().innerHTML = `
    <div class="summary lsum"><div><div class="big">${st}<span class="unit"> day${st === 1 ? '' : 's'}</span></div><div class="muted small">learning streak · ${passed} lesson test${passed === 1 ? '' : 's'} passed</div></div><div class="muted small" style="text-align:right">${built} of ${m.topics.reduce((a, t) => a + t.courses.length, 0)} courses ready<br>× 5 levels each</div></div>
    ${continueHTML()}
    ${window.Exam ? Exam.entryHTML() : ''}
    <h3>Folders</h3>
    <div class="folders">${m.topics.filter(t => !t.deep).map(folderBtn).join('')}</div>
    ${m.topics.some(t => t.deep) ? `<h3>Deep dives <span class="muted small">· 50 lessons each</span></h3>
    <div class="folders">${m.topics.filter(t => t.deep).map(folderBtn).join('')}</div>` : ''}
    <h3>Recently completed</h3>${recentList(12)}`;
}
function folderBtn(t) {
  const s = topicStats(t), tot = t.courses.reduce((a, c) => a + (c.status === 'ready' ? c.lessons.length * 5 : 0), 0);
  return `<button class="folder" data-ltopic="${t.key}" style="--c:${t.color}"><span class="fic">${tmark(t)}</span><span class="fname">${esc(t.name)}</span><span class="fsub">${t.deep ? `${lessonCount(t)} lessons` : `${s.built} of ${t.courses.length} ready`} · ${s.versions} done</span><span class="fbar"><b style="width:${tot ? Math.min(100, s.passed / tot * 100) : 0}%"></b></span></button>`;
}
function rTopic() {
  const t = topicOf(S.route.topic); if (!t) return nav({ page: 'home' });
  const s = topicStats(t); let band = null; const parts = [];
  for (const c of t.courses) {
    if (c.band !== band) { band = c.band; parts.push(`<div class="bandh">${esc(band)}</div>`); }
    const ready = c.status === 'ready';
    const best = ready ? Math.max(0, ...LEVELS.map(l => { const x = courseLevelStats(c, l.k); return x.n ? x.passed / x.n * 100 : 0; })) : 0;
    parts.push(`<button class="banner ${ready ? '' : 'soon'}" data-lb="${c.id}" style="--c:${t.color}"><span class="bn">${c.n}</span><span class="bt"><span class="b1">${esc(c.title)}</span><span class="b2">${ready ? `${c.lessons.length} lessons` : 'Coming soon'} · ${esc(c.band)}</span>${dots(c)}</span>${ready ? ring(best, t.color) : '<span class="soonb">Soon</span>'}</button>`);
  }
  el().innerHTML = `${backBar('Learn')}
    <div class="thead" style="--c:${t.color}"><span class="fic">${tmark(t)}</span><div><h2>${esc(t.name)}</h2><div class="muted small">${esc(t.path || '')} · ${t.deep ? `${t.courses.length} courses · ${lessonCount(t)} lessons` : `${s.built} of ${t.courses.length} courses ready`} · ${s.passed} lessons passed</div></div></div>
    <div class="row" style="margin-bottom:12px"><button class="btn grow" data-loffline="${t.key}">⤓ Save ready courses for offline</button></div>
    <div class="banners">${parts.join('')}</div>`;
}
function bannerSheet(cid) {
  const [t, c] = courseMeta(cid); if (!c) return;
  const sug = window.Mastery ? Mastery.suggestLevel(cid) : {}, ready = c.status === 'ready', last = lastLevel(cid) || sug.lvl || (window.Prefs ? Prefs.v.learn.level : null);
  const tg = c.targets || {};
  const targ = [['Grammar', tg.grammar], ['Vocabulary', tg.vocab], ['Objectives', tg.objectives]].filter(x => x[1] && x[1].length).map(x => `<p class="small"><b>${x[0]}:</b> ${esc(x[1].join(', '))}</p>`).join('');
  openSheet(`<div class="lsheet" style="--c:${t.color}"><div class="muted small">${esc(t.name)} · Course ${c.n} · ${esc(c.band)}</div><h2>${esc(c.title)}</h2><p class="muted">${esc(c.summary || '')}</p>${targ}
    ${ready ? `<h3>Pick a difficulty</h3><div class="lvls">${LEVELS.map(l => { const s = courseLevelStats(c, l.k); return `<button class="lvl ${last === l.k ? 'last' : ''}" data-lgo="${cid}|${l.k}"><span class="li">${l.ic}</span><span class="ln">${esc(l.name)}</span><span class="lp">${s.done ? '✓ complete' : s.passed ? s.passed + '/' + s.n + ' passed' : s.read ? 'started' : sug.lvl === l.k ? '<b class="ms-sug">Your level</b>' : last === l.k ? 'last pick' : ''}</span></button>`; }).join('')}</div>`
      : `<div class="soonbox">Coming soon. This course is mapped out but not written yet.</div>`}
    <h3>Lessons</h3><ol class="louts">${c.lessons.map((x, i) => ready ? `<li><button class="lout" data-lopen="${cid}|${last || 'hs'}|${cid}-l${String(i + 1).padStart(2, '0')}">${esc(x)}</button></li>` : `<li>${esc(x)}</li>`).join('')}</ol>${ready ? `<p class="muted small">Tap a lesson to open it at ${esc((LV[last] || LV.hs).name)} level.</p>` : ''}
    <div class="actions"><button class="btn" data-close>Close</button></div></div>`);
}
async function withCourse(cid, fn) {
  if (S.courses.has(cid)) return fn(S.courses.get(cid));
  el().innerHTML = '<div class="empty">Loading course…</div>';
  try { const c = await getCourse(cid); fn(c); } catch (e) { el().innerHTML = `${backBar('Back')}<div class="empty">Couldn't load this course${navigator.onLine ? '' : ' (you\'re offline and it isn\'t saved yet)'}.<br><button class="btn" data-lretry style="margin-top:12px">Try again</button></div>`; }
}
function rCourse() {
  const { cid, lvl } = S.route, [t, cm] = courseMeta(cid);
  if (window.Pro && Pro.blockLevel(el(), lvl)) return; // store build: higher levels are Synapse Pro
  withCourse(cid, c => {
    const s = courseLevelStats(cm, lvl);
    el().innerHTML = `${backBar(t.name)}
      <div class="chead" style="--c:${t.color}"><div class="muted small">${esc(t.name)} · Course ${c.n} · ${esc(c.band || '')}</div><h2>${esc(c.title)}</h2>
      <div class="row wrapr"><button class="chip lvchip" data-lb="${cid}">${LV[lvl].ic} ${esc(LV[lvl].name)} ▾</button><span class="muted small">${s.passed}/${s.n} lessons passed${s.done ? ' · ✓ course complete' : ''}</span></div></div>
      <div class="lessons">${c.lessons.map((l, i) => { const o = recOf(l.id, lvl);
        const st = o && o.passed ? `<span class="sc ok">✓ ${o.best}%</span>` : o && o.at ? `<span class="sc bad">${o.best}%</span>` : o && o.read ? '<span class="sc rd">read</span>' : '<span class="sc nw">new</span>';
        return `<button class="lrow" data-lles="${i}"><span class="num">${i + 1}</span><span class="tx"><span class="t1">${esc(l.title)}</span><span class="t2">${testLen(l, lvl)}-question test</span></span>${st}</button>`; }).join('')}</div>`;
  });
}
function rLesson() {
  const { cid, lvl, li } = S.route, [t] = courseMeta(cid);
  if (window.Pro && Pro.blockLevel(el(), lvl)) return;
  withCourse(cid, c => {
    const l = c.lessons[li]; if (!l) return nav({ page: 'course', cid, lvl });
    const o = recOf(l.id, lvl);
    if (!o || !o.read) { saveRec({ lid: l.id, lvl, cid, topic: t.key, tname: t.name, cn: c.n, title: l.title, ctitle: c.title, read: Date.now() }); try { window.Hub && Hub.award('lesson'); } catch (e) {} }
    const tags = (l.cardTags || []).map(g => [g, live(M.notes).filter(n => tagHit(n.tags, g)).length]).filter(x => x[1]);
    if (!tags.length) { const root = t.tag; const n = live(M.notes).filter(x => tagHit(x.tags, root)).length; if (n) tags.push([root, n]); }
    const vl = VOICE_LANG[t.key], hv = vl ? hasVoice(vl) : false, sv = vl && hv !== false;
    const terms = sv ? sayTerms(l, t.key, lvl) : [];
    const slowBtn = sv ? `<button class="chip slowt${isSlow() ? ' on' : ''}" data-lslow data-vlang="${vl}" aria-pressed="${isSlow()}">🐢 Slow ${isSlow() ? 'on' : 'off'}</button>` : '';
    const words = terms.length ? `<h3>Listen</h3><div class="sayw" data-vlang="${vl}">${terms.map((w, j) => `<button class="saychip" data-lw="${j}" lang="${vl}">🔊 ${esc(w)}</button>`).join('')}</div>` : '';
    const ex = (l.examples || []).length ? `<h3>Examples${sv ? ` <button class="chip saymore" data-lsayall data-vlang="${vl}">🔊 Play all</button>` : ''}</h3><div class="lex">${l.examples.map((e, j) => `<div class="exr${sv ? ' has-say' : ''}">${sv ? `<button class="say" data-lsay="${j}" data-vlang="${vl}" aria-label="Listen: ${esc(e.src)}">🔊</button>` : ''}<div><div class="src" lang="${vl || ''}">${esc(e.src)}</div><div class="tr">${esc(e.tr)}</div></div></div>`).join('')}</div>` : '';
    S.sayTerms = terms;
    el().innerHTML = `${backBar(c.title)}
      <div class="muted small">Lesson ${li + 1} of ${c.lessons.length} · Course ${c.n} · ${Math.max(1, Math.round(String((l.levels || {})[lvl] || '').split(/\s+/).length / 180))} min read</div><h2>${esc(l.title)}</h2>
      <div class="seg" role="tablist" aria-label="Level">${LEVELS.map(x => `<button role="tab" class="${x.k === lvl ? 'on' : ''}" data-llv="${x.k}" aria-selected="${x.k === lvl}">${x.ic}<span class="lvn">${esc(LVN[x.k] || x.name)}</span></button>`).join('')}</div>
      <div class="row wrapr lvrow"><div class="lvname" style="--c:${t.color}">${esc(LV[lvl].name)} version</div>${slowBtn}${canSpeak() ? `<button class="chip slowt lread" data-lread aria-pressed="false">🔊 Listen</button>` : ''}</div>
      <article class="ltext" id="ltext">${md(l.levels[lvl])}</article>
      ${words}
      <h3>Key points</h3><ul class="kp">${(l.keyPoints || []).map(k => `<li>${md(k).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>
      ${ex}
      ${vl && window.Speak && (l.examples || []).length ? `<button class="btn wide" data-lspeak style="margin-top:12px">Practice saying these</button>` : ''}
      ${tags.length ? `<h3>Related flashcards</h3><div class="rtags">${tags.map(([g, n]) => `<button class="chip" data-ltag="${esc(g)}">#${esc(g)} <b>${n}</b></button>`).join('')}</div>` : ''}
      ${window.MakeCards ? `<button class="btn wide mk-lbtn" data-mkcards type="button">${window.Prefs ? Prefs.icon('add', 18) : ''}Make flashcards</button>` : ''}
      <button class="btn pri wide" data-lstart style="margin-top:12px">Take the test · ${testLen(l, lvl)} questions</button>
      <p class="muted small" style="text-align:center">Pass mark ${PASS}%. Retakes allowed.</p>`;
  });
}
// v138: multiple-choice options are shuffled each time a test starts, so the right answer isn't always in the same spot and a retake can't be passed from memory of positions.
// Questions with "all/none of the above" or "both A and B" style options, or all-number options, keep their written order.
function shuffleChoices(q) {
  if (!q || q.type !== 'mc' || !Array.isArray(q.choices) || q.choices.length < 3 || !Number.isInteger(q.answer)) return q;
  if (q.choices.some(ch => /\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/i.test(ch)) || q.choices.every(ch => /^\s*[-<>≥≤~]?\d/.test(ch))) return q;
  const idx = q.choices.map((_, j) => j); for (let j = idx.length - 1; j > 0; j--) { const k = Math.floor(Math.random() * (j + 1)); [idx[j], idx[k]] = [idx[k], idx[j]]; }
  const o = Object.create(Object.getPrototypeOf(q)); Object.assign(o, q);
  if (q._m !== undefined) Object.defineProperty(o, '_m', { value: q._m, enumerable: false });
  o.choices = idx.map(j => q.choices[j]); o.answer = idx.indexOf(q.answer);
  return o;
}
function startTest() {
  const { cid, lvl, li } = S.route; const c = S.courses.get(cid), l = c.lessons[li];
  S.test = { cid, lvl, li, qs: (capTest((window.Mastery && Mastery.learnTest(l, lvl, c, li)) || testFor(l, lvl)) || []).map(shuffleChoices), i: 0, ans: [] };
  nav({ page: 'test', cid, lvl, li });
}
function rTest() {
  const T = S.test; if (!T || T.cid !== S.route.cid) return back();
  const q = T.qs[T.i], a = T.ans[T.i], n = T.qs.length;
  const c = S.courses.get(T.cid), l = c.lessons[T.li];
  let body;
  if (q.type === 'mc') body = `<div class="choices">${q.choices.map((ch, j) => { let cls = ''; if (a) { if (j === q.answer) cls = 'right'; else if (j === a.given) cls = 'wrong'; } return `<button class="choice ${cls}" data-lch="${j}" ${a ? 'disabled' : ''}>${esc(ch)}</button>`; }).join('')}</div>`;
  else body = `<form id="ltyped" class="typed" autocomplete="off"><input type="text" id="lans" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="${q.type === 'cloze' ? 'Fill the blank' : 'Type your answer'}" value="${a ? esc(a.given) : ''}" ${a ? 'disabled' : ''} class="${a ? (a.ok ? 'right' : 'wrong') : ''}"><button class="btn pri" ${a ? 'disabled' : ''}>Check</button></form>${a && !a.ok ? `<div class="corr">Answer: <b>${esc(q.answer)}</b></div>` : ''}`;
  el().innerHTML = `${backBar('Quit test')}
    <div class="tprog"><span>Question ${T.i + 1} of ${n}</span><span class="muted">${esc(l.title)}</span></div><div class="pbar"><b style="width:${(T.i + (a ? 1 : 0)) / n * 100}%"></b></div>
    <div class="qcard"><div class="qtype">${q.type === 'mc' ? 'Multiple choice' : q.type === 'cloze' ? 'Fill in the blank' : 'Type the answer'}</div><div class="qq">${md(q.q)}</div>${body}
    ${a ? `<div class="expl ${a.ok ? 'ok' : 'bad'}"><b>${a.ok ? 'Correct.' : 'Not quite.'}</b> ${md(q.explain).replace(/^<p>|<\/p>$/g, '')}</div><button class="btn pri wide" data-lnext style="margin-top:14px">${T.i + 1 < n ? 'Next question' : 'See results'}</button>` : ''}</div>`;
  if (!a && q.type !== 'mc') { const f = $('#ltyped'); f.onsubmit = e => { e.preventDefault(); const v = $('#lans').value; if (!v.trim()) return; T.ans[T.i] = { given: v, ok: isRight(q, v) }; rTest(); }; if (!isTouch) $('#lans').focus(); }
}
async function finishTest() {
  const T = S.test, c = S.courses.get(T.cid), l = c.lessons[T.li], [t] = courseMeta(T.cid);
  const right = T.ans.filter(a => a && a.ok).length, score = Math.round(right / T.qs.length * 100), passed = score >= PASS;
  const ex = recOf(l.id, T.lvl);
  await saveRec({ lid: l.id, lvl: T.lvl, cid: T.cid, topic: t.key, tname: t.name, cn: c.n, title: l.title, ctitle: c.title, read: (ex && ex.read) || Date.now(), at: Date.now(), last: score, best: Math.max(score, (ex && ex.best) || 0), passed: (ex && ex.passed) || passed ? 1 : 0, tries: ((ex && ex.tries) || 0) + 1 });
  T.score = score; T.passed = passed; T.done = true;
  try { if (window.Hub) Hub.award('test', 10 + Math.round(score / 10) + (passed ? 10 : 0)); } catch (e) {} try { if (window.Mastery) Mastery.learnResult(T, c, l, t); } catch (e) { console.warn('mastery', e); }
  try { if (window.Weak) Weak.addLearnMisses(T, c, l, t); } catch (e) { console.warn('weak', e); }
  nav({ page: 'result', cid: T.cid, lvl: T.lvl, li: T.li });
}
function missNote(q, l, T, t) {
  const h = [...(l.id + '|' + q.q)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
  const ans = q.type === 'mc' ? q.choices[q.answer] : q.answer;
  return { id: 'n-lm-' + l.id + '-' + h, deck: MISS_DECK, type: 'basic', front: textToHtml(q.q + (q.type === 'mc' ? '\n\n' + q.choices.map((c, i) => String.fromCharCode(65 + i) + ') ' + c).join('\n') : '')), back: textToHtml(ans + '\n\n' + q.explain), tags: [...new Set([...(l.cardTags || []).slice(0, 2), 'Learn::Missed::' + t.tag])], img: null, imgSide: 'back', created: Date.now() };
}
const MISS_DECK = 'd-learn-missed';
async function addMisses(idxs) {
  const T = S.test, c = S.courses.get(T.cid), l = c.lessons[T.li], [t] = courseMeta(T.cid);
  const list = []; const d = M.decks.get(MISS_DECK);
  if (!d || d.del) list.push(['decks', { ...(d || {}), id: MISS_DECK, name: 'Learn · Missed questions', newPerDay: 50, revPerDay: 500, del: 0 }]);
  let added = 0;
  for (const i of idxs) { const note = missNote(T.qs[i], l, T, t), ex = M.notes.get(note.id); if (ex && !ex.del) continue; M.notes.set(note.id, note); list.push(['notes', note], ...cardsForNote(note)); added++; T.added = T.added || new Set(); T.added.add(i); }
  for (const i of idxs) { T.added = T.added || new Set(); T.added.add(i); }
  if (list.length) await write(list);
  toast(added ? `Added ${added} card${added === 1 ? '' : 's'} to “Learn · Missed questions”` : 'Already in your cards');
  rResult();
}
function rResult() {
  const T = S.test; if (!T || !T.done) return back();
  const c = S.courses.get(T.cid), l = c.lessons[T.li];
  const miss = T.qs.map((q, i) => [q, i]).filter(([, i]) => !(T.ans[i] && T.ans[i].ok));
  const added = T.added || new Set(), next = c.lessons[T.li + 1];
  el().innerHTML = `${backBar(l.title)}
    <div class="result ${T.passed ? 'pass' : 'fail'}"><div class="big">${T.score}%</div><div class="rl">${T.passed ? '✓ Passed' : 'Not passed yet'}</div><div class="muted small">${T.qs.length - miss.length} of ${T.qs.length} correct · pass mark ${PASS}% · ${esc(LV[T.lvl].name)}</div></div>
${window.Mastery ? Mastery.nudgeHTML(T) : ''}    <div class="row" style="margin:14px 0"><button class="btn grow" data-lretake>↻ Retake</button>${T.passed && next ? `<button class="btn pri grow" data-lnextles>Next lesson ›</button>` : `<button class="btn grow" data-lcourse>Course</button>`}</div>
    ${miss.length ? `<h3>Missed (${miss.length})</h3><button class="btn wide" data-laddall ${miss.every(([, i]) => added.has(i)) ? 'disabled' : ''}>＋ Add all ${miss.length} to my flashcards</button>
      <div class="misses">${miss.map(([q, i]) => `<div class="miss"><div class="qq">${md(q.q)}</div><div class="ma">Answer: <b>${esc(q.type === 'mc' ? q.choices[q.answer] : q.answer)}</b>${T.ans[i] ? ` · you said “${esc(q.type === 'mc' ? q.choices[T.ans[i].given] : T.ans[i].given)}”` : ''}</div><div class="muted small">${md(q.explain).replace(/^<p>|<\/p>$/g, '')}</div><button class="btn small" data-ladd="${i}" ${added.has(i) ? 'disabled' : ''}>${added.has(i) ? '✓ In your cards' : '＋ Add to cards'}</button></div>`).join('')}</div>` : '<div class="empty small">Perfect score. Nothing to review.</div>'}`;
}

/* ---------- offline ---------- */
async function saveOffline(key) {
  const t = topicOf(key), files = t.courses.filter(c => c.file).map(c => c.file);
  let ok = 0; for (const f of files) { try { const r = await fetch(f); if (r.ok) { ok++; if (!S.courses.has(f)) { /* parsed on open */ } } } catch {} }
  toast(ok === files.length ? `${ok} course${ok === 1 ? '' : 's'} saved for offline` : `Saved ${ok} of ${files.length}; try again online`);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lread],[data-lback],[data-ltopic],[data-lb],[data-lgo],[data-lles],[data-llv],[data-lstart],[data-lch],[data-lnext],[data-lretake],[data-lnextles],[data-lcourse],[data-ladd],[data-laddall],[data-ltag],[data-lopen],[data-lretry],[data-lsay],[data-lsayall],[data-lw],[data-lslow],[data-lhome],[data-loffline],[data-lgolearn],[data-lspeak]');
  if (!b) return; const d = b.dataset;
  if ('lback' in d) return back();
  if ('lhome' in d) return nav({ page: 'home' });
  if ('lgolearn' in d) { S.route = { page: 'home' }; go('learn'); return; }
  if ('lretry' in d) { S.err = null; return render(); }
  if (d.ltopic) return nav({ page: 'topic', topic: d.ltopic });
  if (d.lb) return bannerSheet(d.lb);
  if (d.lgo) { const [cid, lvl] = d.lgo.split('|'); closeSheet(); setLastLevel(cid, lvl); if (view !== 'learn') { S.route = { page: 'course', cid, lvl }; go('learn'); } else nav({ page: 'course', cid, lvl }); return; }
  if (d.lles) return nav({ page: 'lesson', cid: S.route.cid, lvl: S.route.lvl, li: +d.lles });
  if (d.llv) { setLastLevel(S.route.cid, d.llv); S.route = { ...S.route, lvl: d.llv }; rLesson(); return; }
  if ('lstart' in d) return startTest();
  if ('lspeak' in d) { const [t] = courseMeta(S.route.cid), c = S.courses.get(S.route.cid), l = c && c.lessons[S.route.li]; if (l && window.Speak) Speak.forLesson(l, VOICE_LANG[t.key]); return; }
  if ('lread' in d) { // v134: read the lesson aloud (English voice), tap again to stop
    if (S.reading) { stopReading(); return; }
    try {
      const { cid, lvl, li } = S.route, c = S.courses.get(cid), l = c && c.lessons[li]; if (!l) return;
      const plain = String(l.levels[lvl] || '').replace(/```[\s\S]*?```/g, ' ').replace(/^#+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+=\s+/g, ' equals ').replace(/\u2192/g, ' to ').replace(/([.!?:;])\s*\n+/g, '$1 ').replace(/\n+/g, '. ');
      const parts = [l.title].concat((plain.match(/[^.!?]+[.!?]+\s*/g) || [plain]).map(x => x.trim()).filter(Boolean)).concat(['Key points.'], (l.keyPoints || []).map(k => String(k).replace(/\*\*|__|`/g, '')));
      speak(parts, 'en-US', false); S.reading = true; b.textContent = '⏹ Stop'; b.setAttribute('aria-pressed', 'true');
      clearInterval(S.readT); S.readT = setInterval(() => { try { if (!speechSynthesis.speaking && !speechSynthesis.pending) stopReading(); } catch (e) { stopReading(); } }, 500);
    } catch (e) { stopReading(); }
    return;
  }
  if ('lslow' in d) { try { localStorage.setItem('learn.slow', isSlow() ? '0' : '1'); } catch (e) {} const on = isSlow(); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.textContent = '🐢 Slow ' + (on ? 'on' : 'off'); return; }
  if (d.lw !== undefined) { const [t] = courseMeta(S.route.cid), w = (S.sayTerms || [])[+d.lw]; if (w && VOICE_LANG[t.key]) speak([w], VOICE_LANG[t.key]); return; }
  if (d.lsay || 'lsayall' in d) { const [t] = courseMeta(S.route.cid), c = S.courses.get(S.route.cid), l = c && c.lessons[S.route.li]; if (!l) return; const ex = l.examples || []; if (!VOICE_LANG[t.key]) return; speak(d.lsay ? [ex[+d.lsay].src] : ex.map(e => e.src), VOICE_LANG[t.key]); return; }
  if (d.lch) { const T = S.test, q = T.qs[T.i]; if (T.ans[T.i]) return; T.ans[T.i] = { given: +d.lch, ok: +d.lch === q.answer }; return rTest(); }
  if ('lnext' in d) { const T = S.test; if (T.i + 1 < T.qs.length) { T.i++; rTest(); window.scrollTo(0, 0); } else finishTest(); return; }
  if ('lretake' in d) { const T = S.test; S.route = { page: 'lesson', cid: T.cid, lvl: T.lvl, li: T.li }; return startTest(); }
  if ('lnextles' in d) { const T = S.test; return nav({ page: 'lesson', cid: T.cid, lvl: T.lvl, li: T.li + 1 }); }
  if ('lcourse' in d) { const T = S.test; return nav({ page: 'course', cid: T.cid, lvl: T.lvl }); }
  if (d.ladd) return addMisses([+d.ladd]);
  if ('laddall' in d) { const T = S.test; return addMisses(T.qs.map((q, i) => i).filter(i => !(T.ans[i] && T.ans[i].ok))); }
  if (d.ltag) { studyDeck = 'tag:' + d.ltag; undoStack = []; go('study'); return; }
  if (d.loffline) return saveOffline(d.loffline);
  if (d.lopen) { const [cid, lvl, lid] = d.lopen.split('|'); try { closeSheet(); } catch (e) {} setLastLevel(cid, lvl); const li = Math.max(0, parseInt(lid.split('-l').pop(), 10) - 1); S.route = { page: 'lesson', cid, lvl, li }; if (view !== 'learn') go('learn'); else { render(); window.scrollTo(0, 0); } }
});

/* ---------- public ---------- */
function homeHTML() {
  const st = streak(), r = recent(3);
  return `<h3>Recently completed</h3><div class="panel lhome"><div class="row" style="justify-content:space-between;align-items:center"><span><b>${st}</b> day learning streak</span><button class="btn small" data-lgolearn>Open Learn ›</button></div>${r.length ? recentList(3) : '<p class="muted small">Finish a lesson test in Learn and it shows up here.</p>'}</div>`;
}
function onChange() { if (view !== 'learn') return; const p = S.route.page; if (p === 'home' || p === 'topic' || p === 'course') render(); }
window.Learn = { shuffleChoices, getManifest, getCourse, speak, sayTerms, hasVoice, pickVoice, VX, VOICE_LANG, render, homeHTML, onChange, LEVELS, isRight, norm, md, _S: S };
})();
