/* Cards: offline-first spaced repetition (FSRS-5) with device sync. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
let VERSION = '118'; // v118: replaced at start-up by the number in sw.js CACHE (the one place the version lives)
const rid = () => { const a = new Uint8Array(9); crypto.getRandomValues(a); return [...a].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 14); };
let clock = 0; const stamp = () => { const t = Date.now(); clock = t > clock ? t : clock + 1; return clock; };
const isTouch = matchMedia('(pointer: coarse)').matches; if (isTouch) document.documentElement.classList.add('touch');

/* ---------------- storage (IndexedDB) ---------------- */
const KIND = { d: 'decks', n: 'notes', c: 'cards', r: 'revlog', p: 'progress' };
const KINDOF = { decks: 'd', notes: 'n', cards: 'c', revlog: 'r', progress: 'p' };
const M = { decks: new Map(), notes: new Map(), cards: new Map(), revlog: new Map(), progress: new Map() };
let meta = {}; let idb;
function idbOpen() {
  return new Promise((res, rej) => {
    const q = indexedDB.open('cards-db', 2);
    q.onupgradeneeded = () => { const db = q.result, has = n => db.objectStoreNames.contains(n); for (const s of ['decks', 'notes', 'cards', 'revlog', 'progress']) if (!has(s)) db.createObjectStore(s, { keyPath: 'id' }); if (!has('dirty')) db.createObjectStore('dirty'); if (!has('meta')) db.createObjectStore('meta'); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function txDone(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort')); }); }
async function loadAll() {
  const t = idb.transaction(['decks', 'notes', 'cards', 'revlog', 'progress', 'meta'], 'readonly');
  for (const s of ['decks', 'notes', 'cards', 'revlog', 'progress']) for (const o of await reqP(t.objectStore(s).getAll())) M[s].set(o.id, o);
  const keys = await reqP(t.objectStore('meta').getAllKeys()), vals = await reqP(t.objectStore('meta').getAll());
  keys.forEach((k, i) => { meta[k] = vals[i]; });
}
function setMeta(k, v) { meta[k] = v; const t = idb.transaction('meta', 'readwrite'); t.objectStore('meta').put(v, k); return txDone(t); }
// write records: list of [store, obj]; marks dirty for sync unless opts.clean
async function write(list, opts = {}) {
  if (!list.length) return;
  const t = idb.transaction(['decks', 'notes', 'cards', 'revlog', 'progress', 'dirty'], 'readwrite');
  for (const [s, o] of list) {
    if (!opts.keepMod) o.mod = stamp();
    M[s].set(o.id, o); t.objectStore(s).put(o);
    if (!opts.clean) t.objectStore('dirty').put(o.mod, KINDOF[s] + ':' + o.id);
  }
  await txDone(t);
  if (!opts.clean) { if (syncOn() && navigator.onLine && !syncing) setPill('busy'); changed(); scheduleSync(1500); }
}
let changeHooks = [];
function changed() { changeHooks.forEach(f => f()); }

/* ---------------- helpers ---------------- */
const live = m => [...m.values()].filter(o => !o.del);
const decks = () => live(M.decks).sort((a, b) => a.name.localeCompare(b.name));
function dayStart(t = Date.now()) { const d = new Date(t - 4 * HOUR); d.setHours(0, 0, 0, 0); return d.getTime() + 4 * HOUR; }
const dayIdx = t => Math.floor((dayStart(t) - dayStart(0)) / DAY + 0.5);
function toast(msg, ms = 2200) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms); }
function fmtIvl(ms) {
  if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + 'm';
  if (ms < DAY) return Math.round(ms / HOUR) + 'h';
  const d = ms / DAY; if (d < 30) return Math.round(d) + 'd';
  if (d < 365) return (Math.round(d / 30.4 * 10) / 10).toString().replace(/\.0$/, '') + 'mo';
  return (Math.round(d / 365 * 10) / 10).toString().replace(/\.0$/, '') + 'y';
}
function stripHtml(h) { const d = document.createElement('div'); d.innerHTML = sanitize(String(h || '').replace(/<br\s*\/?>/gi, ' ').replace(/<img[^>]*>/gi, ' [image] ')); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
const OK_TAGS = new Set('B I U EM STRONG BR DIV SPAN P SUB SUP UL OL LI IMG HR TABLE TBODY THEAD TR TD TH SMALL BIG CODE PRE BLOCKQUOTE H1 H2 H3 H4 FONT S STRIKE'.split(' '));
function sanitize(html) {
  const doc = new DOMParser().parseFromString('<div id="x">' + String(html || '') + '</div>', 'text/html');
  const root = doc.getElementById('x'); if (!root) return '';
  const walk = el => {
    for (const c of [...el.children]) {
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'AUDIO', 'VIDEO', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(c.tagName.toUpperCase())) { c.remove(); continue; }
      walk(c);
      if (!OK_TAGS.has(c.tagName.toUpperCase())) { c.replaceWith(...c.childNodes); continue; }
      for (const a of [...c.attributes]) {
        const n = a.name.toLowerCase();
        if (c.tagName === 'IMG' && n === 'src' && /^(data:image\/|blob:)/i.test(a.value)) continue;
        if (n === 'class' && a.value === 'cloze') continue;
        c.removeAttribute(a.name);
      }
      if (c.tagName === 'IMG' && !c.getAttribute('src')) c.remove();
    }
  };
  walk(root); return root.innerHTML;
}
// plain text from the editor ↔ stored html
const looksHtml = s => /<\/?(b|i|u|div|span|p|br|img|ul|ol|li|table|sub|sup|em|strong|font|hr)\b/i.test(s);
function textToHtml(s) { s = String(s || '').replace(/\r/g, ''); return looksHtml(s) ? sanitize(s.replace(/\n/g, '<br>')) : esc(s).replace(/\n/g, '<br>'); }
function htmlToText(h) {
  h = String(h || ''); const plain = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?div>/gi, m => m[1] === '/' ? '\n' : '');
  if (/<[a-z]/i.test(plain)) return h; // keep rich html as-is
  const d = document.createElement('textarea'); d.innerHTML = plain; return d.value.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '');
}

/* ---------------- FSRS-5 ---------------- */
const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5, FACTOR = 19 / 81, RETAIN = 0.9, LEARN = [1, 10], RELEARN = [10], MAXIVL = 36500;
const clampD = d => Math.min(10, Math.max(1, d));
const retr = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
const ivlDays = s => Math.min(MAXIVL, Math.max(1, Math.round(s / FACTOR * (Math.pow(RETAIN, 1 / DECAY) - 1))));
const S0 = g => Math.max(0.1, W[g - 1]);
const D0 = g => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
const nextD = (d, g) => { const d2 = d + (-W[6] * (g - 3)) * (10 - d) / 9; return clampD(W[7] * (W[4] - Math.exp(W[5] * 3) + 1) + (1 - W[7]) * d2); };
const sRecall = (d, s, r, g) => s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
const sForget = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
const sShort = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));
function graduate(n, now, days) { n.st = 2; n.step = 0; n.ivl = days; n.due = dayStart(now) + days * DAY; }
function schedule(c, g, now = Date.now()) {
  const n = { ...c }; n.reps = (c.reps || 0) + 1; n.last = now;
  const st = c.st || 0;
  if (st === 0) {
    n.d = D0(g); n.s = S0(g);
    if (g === 4) graduate(n, now, Math.max(ivlDays(n.s), 2));
    else { n.st = 1; n.step = g === 3 ? 1 : 0; n.due = now + (g === 1 ? LEARN[0] : g === 2 ? (LEARN[0] + LEARN[1]) / 2 : LEARN[1]) * MIN; }
    return n;
  }
  if (st === 1 || st === 3) {
    const steps = st === 1 ? LEARN : RELEARN, step = Math.min(c.step || 0, steps.length - 1);
    n.d = nextD(c.d || D0(3), g); n.s = sShort(c.s || S0(3), g);
    if (g === 1) { n.step = 0; n.due = now + steps[0] * MIN; }
    else if (g === 2) { n.step = step; n.due = now + (step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[step]) * MIN; }
    else if (g === 3) { if (step + 1 >= steps.length) graduate(n, now, ivlDays(n.s)); else { n.step = step + 1; n.due = now + steps[step + 1] * MIN; } }
    else { const good = ivlDays(sShort(c.s || S0(3), 3)); graduate(n, now, Math.max(ivlDays(n.s), good + 1)); }
    return n;
  }
  // review
  const t = Math.max(0, (dayStart(now) - dayStart(c.last || now)) / DAY), s = c.s || 1, d = c.d || 5, r = retr(t, s);
  n.d = nextD(d, g);
  if (g === 1) { n.s = sForget(d, s, r); n.st = 3; n.step = 0; n.lapses = (c.lapses || 0) + 1; n.due = now + RELEARN[0] * MIN; return n; }
  const sh = sRecall(d, s, r, 2), sg = sRecall(d, s, r, 3), se = sRecall(d, s, r, 4);
  let ih = ivlDays(sh), ig = ivlDays(sg), ie = ivlDays(se);
  ih = Math.min(ih, ig); ig = Math.max(ig, ih + 1); ie = Math.max(ie, ig + 1);
  n.s = g === 2 ? sh : g === 3 ? sg : se; graduate(n, now, g === 2 ? ih : g === 3 ? ig : ie);
  return n;
}

/* ---------------- notes → cards ---------------- */
function clozeNums(text) { const s = new Set(); String(text || '').replace(/\{\{c(\d+)::/g, (m, n) => { s.add(+n); return m; }); return [...s].sort((a, b) => a - b); }
function ordsFor(note) { if (note.type === 'cloze') { const n = clozeNums(note.front); return n.length ? n : [1]; } return note.type === 'reversed' ? [0, 1] : [0]; }
function cardsForNote(note, posBase) {
  const out = [], want = new Set(ordsFor(note).map(String));
  ordsFor(note).forEach((o, i) => {
    const id = note.id + '~' + o, ex = M.cards.get(id);
    if (!ex || ex.del) out.push(['cards', { id, nid: note.id, deck: note.deck, ord: o, st: 0, due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0, step: 0, pos: (posBase || Date.now()) + i }]);
    else if (ex.deck !== note.deck) out.push(['cards', { ...ex, deck: note.deck }]);
  });
  for (const c of M.cards.values()) if (c.nid === note.id && !c.del && !want.has(String(c.ord))) out.push(['cards', { ...c, del: 1 }]);
  return out;
}
const cardsOfNote = nid => live(M.cards).filter(c => c.nid === nid);
function clozeRender(text, num, reveal) {
  return String(text || '').replace(/\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g, (m, n, ans, hint) => +n === num ? (reveal ? `<span class="cloze">${ans}</span>` : `<span class="cloze">[${hint ? hint : '…'}]</span>`) : ans);
}
function renderCard(card) {
  const note = M.notes.get(card.nid); if (!note) return { q: '', a: '' };
  const img = note.img ? `<img src="${esc(note.img)}" alt="">` : '';
  const side = note.imgSide || 'back', cred = note.img && note.imgCredit ? `<div class="img-cred">${esc(note.imgCredit)}</div>` : '';
  let q, a;
  if (note.type === 'cloze') { q = clozeRender(note.front, card.ord, false); a = clozeRender(note.front, card.ord, true) + (note.back ? '<hr>' + note.back : ''); }
  else if (card.ord === 1) { q = note.back; a = note.back + '<hr>' + note.front; }
  else { q = note.front; a = note.front + '<hr>' + note.back; }
  if (img && side === 'front') { q += img; a = a.replace('<hr>', img + '<hr>'); } else if (img) a += img;
  return { q: sanitize(q) + (img && side === 'front' ? cred : ''), a: sanitize(a) + cred };
}

/* ---------------- tags ---------------- */
const tagHit = (tags, x) => { x = String(x || '').toLowerCase().replace(/^#/, ''); if (!x) return true; return (tags || []).some(t => ('::' + t.toLowerCase() + '::').includes('::' + x + '::') || (x.endsWith('*') && t.toLowerCase().startsWith(x.slice(0, -1)))); };
function tagTree() {
  const root = { kids: new Map(), n: 0 };
  for (const n of live(M.notes)) { const d = M.decks.get(n.deck); if (!d || d.del) continue; const seen = new Set();
    for (const t of n.tags || []) { let node = root, path = []; for (const part of t.split('::').filter(Boolean)) { path.push(part); const key = path.join('::'); let k = node.kids.get(part); if (!k) node.kids.set(part, k = { name: part, path: key, kids: new Map(), n: 0 }); if (!seen.has(key)) { k.n++; seen.add(key); } node = k; } } }
  return root;
}
const cardInScope = (c, scope) => !scope.startsWith('tag:') || tagHit((M.notes.get(c.nid) || {}).tags, scope.slice(4));
const scopeDecks = scope => scope === '*' || scope.startsWith('tag:') ? new Set(decks().map(d => d.id)) : new Set([scope]);
function scopeName(scope) { return scope === '*' ? 'All decks' : scope.startsWith('tag:') ? '#' + scope.slice(4) : (M.decks.get(scope) || {}).name || 'Study'; }
function scopeCounts(scope, now = Date.now()) {
  if (!scope.startsWith('tag:')) { const done = todayDone(now); return [...scopeDecks(scope)].reduce((a, id) => { const c = deckCounts(id, now, done); a.n += c.n; a.l += c.l; a.r += c.r; return a; }, { n: 0, l: 0, r: 0 }); }
  const end = dayStart(now) + DAY, ids = scopeDecks(scope); let n = 0, l = 0, r = 0;
  for (const c of M.cards.values()) { if (c.del || c.susp || !ids.has(c.deck) || !cardInScope(c, scope)) continue; if (c.st === 0) n++; else if (c.due < end) { if (c.st === 2) r++; else l++; } }
  return { n, l, r };
}

/* ---------------- queues ---------------- */
function deckOpt(id) { const d = M.decks.get(id); return { newPerDay: d && Number.isFinite(d.newPerDay) ? d.newPerDay : (window.Prefs ? Prefs.v.cards.newPerDay : 20), revPerDay: d && Number.isFinite(d.revPerDay) ? d.revPerDay : 200 }; }
function todayDone(now = Date.now()) {
  const ds = dayStart(now), out = {};
  for (const r of M.revlog.values()) { if (r.del || r.t < ds) continue; const o = out[r.deck] || (out[r.deck] = { n: 0, r: 0 }); if (r.ps === 0) o.n++; else if (r.ps === 2) o.r++; }
  return out;
}
function deckCounts(deckId, now = Date.now(), done = todayDone(now)) {
  const end = dayStart(now) + DAY, o = deckOpt(deckId), dd = done[deckId] || { n: 0, r: 0 };
  let n = 0, l = 0, r = 0;
  for (const c of M.cards.values()) {
    if (c.del || c.deck !== deckId || c.susp) continue;
    if (c.st === 0) n++; else if (c.st === 2) { if (c.due < end) r++; } else if (c.due < end) l++;
  }
  return { n: Math.max(0, Math.min(n, o.newPerDay - dd.n)), l, r: Math.max(0, Math.min(r, o.revPerDay - dd.r)) };
}
function nextCard(deckId, now = Date.now()) {
  const ids = scopeDecks(deckId), tagMode = deckId.startsWith('tag:');
  const end = dayStart(now) + DAY, done = todayDone(now);
  const lrn = [], rev = [], nw = [];
  for (const c of M.cards.values()) {
    if (c.del || c.susp || !ids.has(c.deck) || !M.decks.get(c.deck) || M.decks.get(c.deck).del || (tagMode && !cardInScope(c, deckId))) continue;
    if (c.st === 0) nw.push(c); else if (c.st === 2) { if (c.due < end) rev.push(c); } else if (c.due < end) lrn.push(c);
  }
  lrn.sort((a, b) => a.due - b.due); rev.sort((a, b) => a.due - b.due); nw.sort((a, b) => a.pos - b.pos || (a.id < b.id ? -1 : 1));
  const revLeft = {}, newLeft = {};
  for (const id of ids) { const o = deckOpt(id), dd = done[id] || { n: 0, r: 0 }; revLeft[id] = tagMode ? 1e9 : o.revPerDay - dd.r; newLeft[id] = tagMode ? 1e9 : o.newPerDay - dd.n; }
  const dueL = lrn.find(c => c.due <= now); if (dueL) return { card: dueL };
  const r = rev.find(c => revLeft[c.deck] > 0); if (r) return { card: r };
  const nn = nw.find(c => newLeft[c.deck] > 0); if (nn) return { card: nn };
  const ahead = lrn.find(c => c.due <= now + 20 * MIN); if (ahead) return { card: ahead };
  if (lrn.length) return { wait: lrn[0].due - now };
  return {};
}

/* ---------------- views ---------------- */
let view = 'decks', studyDeck = null, cur = null, shown = false, shownAt = 0, undoStack = [], editId = null;
window.curCard = () => cur;
const TITLES = { home: 'Home', doc: 'Doctordle', weak: 'Weak Spots', anat: 'Anatomy', library: 'Library', learn: 'Learn', decks: 'Decks', study: 'Study', add: 'Add card', browse: 'Browse', stats: 'Stats', settings: 'Sync & backup', prefs: '', x: '' };
function go(v, opts = {}) {
  if (v === 'study' && !studyDeck) studyDeck = '*'; // v176: a Study link with no deck picked yet (e.g. a cleared photo-book deck) opens All decks instead of throwing
  if (v !== view && !opts.keepSheet) { try { if (!$('#sheetWrap').hidden) closeSheet(); } catch (e) {} } // v120: a sheet never outlives the screen it was opened on
  if (v === 'add' && !opts.keepEdit) editId = null;
  if (v === 'library' && window.Resources && Resources._S) $('#title').dataset.lib = Resources._S.mode;
  view = v; $$('.view').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.body.classList.toggle('at-home', v === 'home'); document.body.classList.toggle('no-tabs', ['doc', 'anat', 'prefs', 'x'].includes(v)); if (window.Home) Home.paintTabs();
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.go === v || (v === 'study' && b.dataset.go === 'decks')));
  $('#title').textContent = v === 'add' && editId ? 'Edit card' : v === 'study' && studyDeck ? scopeName(studyDeck) : v === 'library' && window.Resources && Resources._S && Resources._S.mode !== 'decks' ? 'Resources' : TITLES[v];
  render(); window.scrollTo(0, 0);
}
function render() { ({ home: () => Home.render(), doc: () => window.Doctordle ? Doctordle.render() : Home.soon('doc'), weak: () => window.Weak ? Weak.render() : Home.soon('weak'), anat: () => window.Anatomy ? Anatomy.render() : Home.soon('anat'), library: () => Library.render(), learn: () => Learn.render(), decks: rDecks, study: rStudy, add: rAdd, browse: rBrowse, stats: () => window.Stats2 ? Stats2.render($('#v-stats')) : rStats(), settings: rSettings, prefs: () => window.PrefsUI && PrefsUI.render(), x: () => window.XView && XView.render() })[view](); }
changeHooks.push(() => { hubPull(); Home.paintTabs(); if (view === 'weak' && window.Weak && !Weak._S.run) Weak.render(); if (view === 'home') Home.render(); else if (view === 'library') Library.onChange(); else if (view === 'learn') Learn.onChange(); else if (view === 'decks' || view === 'stats') render(); else if (view === 'browse') rBrowseResults(); });

function cnt(v, cls) { return `<span class="${cls}${v ? '' : ' z'}">${v}</span>`; }
function rDecks() {
  const now = Date.now(), done = todayDone(now), ds = decks();
  let tn = 0, tl = 0, tr = 0;
  const rows = ds.map(d => { const c = deckCounts(d.id, now, done); tn += c.n; tl += c.l; tr += c.r; const total = live(M.cards).filter(x => x.deck === d.id).length;
    return `<div class="deck" data-id="${esc(d.id)}"><button class="open" data-study="${esc(d.id)}"><span style="min-width:0"><div class="name">${esc(d.name)}</div><div class="sub">${total} card${total === 1 ? '' : 's'}</div></span><span class="counts">${cnt(c.n, 'n')}${cnt(c.l, 'l')}${cnt(c.r, 'd')}</span></button><button class="more" data-opts="${esc(d.id)}" aria-label="Deck options">⋯</button></div>`; }).join('');
  const todayN = live(M.revlog).filter(r => r.t >= dayStart(now)).length, total = tn + tl + tr;
  $('#v-decks').innerHTML = `
    <div class="summary"><div><div class="big">${total}</div><div class="muted small">to study today · ${todayN} reviewed</div></div>
    <button class="btn pri" id="studyAll" ${total ? '' : 'disabled'}>Study all</button></div>
    ${ds.length ? `<div class="decklist">${rows}</div><div class="legend"><span><b style="color:var(--new)">New</b></span><span><b style="color:var(--lrn)">Learning</b></span><span><b style="color:var(--due)">Due</b></span></div>` : '<div class="empty">No decks yet. Create one, or import an Anki deck in Settings.</div>'}
    <div class="row" style="margin-top:14px"><button class="btn grow" id="newDeck">＋ New deck</button><button class="btn grow" data-goto="settings">Import</button></div>${window.Learn ? Learn.homeHTML() : ''}${window.Library ? Library.homeHTML() : ''}`;
}
function deckSheet(id) {
  const d = id ? M.decks.get(id) : null, o = deckOpt(id);
  openSheet(`<h2>${d ? 'Deck options' : 'New deck'}</h2>
    <form id="deckForm"><label class="f" for="dn">Name</label><input type="text" id="dn" value="${esc(d ? d.name : '')}" required maxlength="120" autocomplete="off">
    <div class="row"><div class="grow"><label class="f" for="dnew">New cards per day</label><input type="number" id="dnew" min="0" max="9999" value="${o.newPerDay}" inputmode="numeric"></div>
    <div class="grow"><label class="f" for="drev">Max reviews per day</label><input type="number" id="drev" min="0" max="99999" value="${o.revPerDay}" inputmode="numeric"></div></div>
    <div class="actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn pri" type="submit">Save</button></div>
    ${d && window.ImgCards ? '<div class="actions"><button type="button" class="btn wide" id="deckPics">Add pictures to cards</button></div>' : ''}
    ${d ? '<div class="actions"><button type="button" class="btn danger" id="delDeck">Delete deck</button></div>' : ''}</form>`);
  if (d && $('#deckPics')) $('#deckPics').onclick = () => ImgCards.deckPass(d.id);
  $('#deckForm').onsubmit = async e => {
    e.preventDefault(); const name = $('#dn').value.trim(); if (!name) return;
    const rec = { ...(d || { id: 'd-' + rid() }), name, newPerDay: Math.max(0, +$('#dnew').value || 0), revPerDay: Math.max(0, +$('#drev').value || 0) };
    await write([['decks', rec]]); closeSheet(); toast(d ? 'Saved' : 'Deck created');
  };
  if (d) $('#delDeck').onclick = async () => {
    if (d.lib && window.Library) { closeSheet(); return Library.remove(d.lib); }
    const notes = live(M.notes).filter(n => n.deck === id);
    if (!confirm(`Delete "${d.name}" and its ${notes.length} note${notes.length === 1 ? '' : 's'}? This syncs to your other devices.`)) return;
    const list = [['decks', { ...d, del: 1 }]];
    for (const n of notes) { list.push(['notes', { ...n, del: 1 }]); for (const c of cardsOfNote(n.id)) list.push(['cards', { ...c, del: 1 }]); }
    await write(list); closeSheet(); toast('Deck deleted');
  };
}

function rStudy() {
  const el = $('#v-study'); const now = Date.now();
  const nx = nextCard(studyDeck, now); cur = nx.card || null; shown = false; shownAt = Date.now();
  const tot = scopeCounts(studyDeck, now);
  const bar = `<div class="studybar"><button class="link lback" id="backDecks">‹ Decks</button><span class="counts labeled" aria-label="${tot.n} new, ${tot.l} learning, ${tot.r} due">${cnt(tot.n, 'n')}<small>new</small>${cnt(tot.l, 'l')}<small>learning</small>${cnt(tot.r, 'd')}<small>due</small></span><span class="row" style="gap:0"><button class="link" id="undoBtn" ${undoStack.length ? '' : 'disabled'} title="Undo (Z)">Undo</button>${cur ? '<button class="link" id="editCur" title="Edit (E)">Edit</button>' : ''}</span></div>`;
  if (!cur) {
    el.innerHTML = bar + `<div class="done"><div class="big">✓</div><h2>${nx.wait ? 'Done for now' : 'All caught up'}</h2><p class="muted">${nx.wait ? `${tot.l} learning card${tot.l === 1 ? '' : 's'} coming back in ${fmtIvl(nx.wait)}.` : (studyDeck.startsWith('tag:') ? 'Nothing else with this tag is due today.' : 'Nothing else is due in this deck today.')}</p><button class="btn" data-goto="decks" style="margin-top:14px">Back to decks</button></div>`;
    if (nx.wait) { clearTimeout(rStudy.t); rStudy.t = setTimeout(() => { if (view === 'study' && !cur) rStudy(); }, Math.min(nx.wait + 500, 10 * MIN)); }
    return;
  }
  const f = renderCard(cur);
  el.innerHTML = bar + `<div class="cardface" id="face">${f.q}</div><div class="answerbar" id="ansbar"><button class="btn pri showbtn" id="showBtn">Show answer</button><div class="kbd"><kbd>Space</kbd> show · <kbd>1</kbd>–<kbd>4</kbd> grade · <kbd>Z</kbd> undo · <kbd>E</kbd> edit</div></div>`;
}
function showAnswer() {
  if (!cur || shown) return; shown = true; const f = renderCard(cur); $('#face').innerHTML = f.a;
  { const sn = M.notes.get(cur.nid), src = sn && sn.src; if (src && src.app === 'axon' && /^https:\/\/northpeakstudios\.github\.io\/axon\/#\/n\/[\w%.-]{1,120}$/.test(String(src.url || ''))) $('#face').insertAdjacentHTML('beforeend', `<a class="srcnote" href="${esc(src.url)}" target="_blank" rel="noopener">📝 Source note in Axon${src.title ? ': ' + esc(String(src.title).slice(0, 80)) : ''}</a>`); } // cards made from an Axon note link back to it
  const now = Date.now(), lbl = ['Again', 'Hard', 'Good', 'Easy'];
  $('#ansbar').innerHTML = `<div class="grades">${[1, 2, 3, 4].map(g => { const n = schedule(cur, g, now); return `<button class="g${g}" data-grade="${g}">${lbl[g - 1]}<small>${fmtIvl(n.due - now)}</small></button>`; }).join('')}</div><div class="kbd"><kbd>1</kbd> Again · <kbd>2</kbd> Hard · <kbd>3</kbd>/<kbd>Space</kbd> Good · <kbd>4</kbd> Easy</div>`;
}
async function grade(g) {
  if (!cur || !shown) return; const now = Date.now(), prev = { ...cur }, n = schedule(cur, g, now);
  const rev = { id: 'r-' + rid(), cid: cur.id, deck: cur.deck, t: now, g, ps: prev.st || 0, ivl: n.st === 2 ? n.ivl : -Math.round((n.due - now) / MIN), took: Math.min(now - shownAt, 600000) };
  undoStack.push({ prev, rev: rev.id }); if (undoStack.length > 20) undoStack.shift();
  const gradedCard = cur;
  try { if (window.Prefs) Prefs.sound(g === 1 ? 'bad' : 'ok'); } catch (e) {}
  cur = null; await write([['cards', n], ['revlog', rev]]); rStudy();
  try { if (window.Hub) Hub.award(g === 1 ? 'again' : 'review'); if (g === 1 && window.Weak) Weak.addCard(gradedCard); } catch (e) { console.warn('hub', e); }
}
async function undo() {
  const u = undoStack.pop(); if (!u) return; const r = M.revlog.get(u.rev);
  await write([['cards', { ...u.prev }], ...(r ? [['revlog', { ...r, del: 1 }]] : [])]); toast('Undone'); rStudy();
}

/* ---------------- add / edit ---------------- */
let draft = { type: 'basic', img: null, imgSide: 'back' };
function rAdd() {
  const note = editId ? M.notes.get(editId) : null;
  if (note) draft = { type: note.type, img: note.img || null, imgSide: note.imgSide || 'back', imgCredit: note.imgCredit || null };
  const ds = decks(); const lastDeck = meta.lastDeck && M.decks.get(meta.lastDeck) && !M.decks.get(meta.lastDeck).del ? meta.lastDeck : (ds[0] || {}).id;
  const deckSel = note ? note.deck : lastDeck;
  const t = draft.type;
  $('#v-add').innerHTML = `<form id="noteForm" autocomplete="off">
    <label class="f" for="nDeck">Deck</label><select id="nDeck">${ds.map(d => `<option value="${esc(d.id)}" ${d.id === deckSel ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}<option value="__new">＋ New deck…</option></select>
    <label class="f">Type</label><div class="seg" id="nType">${[['basic', 'Basic'], ['reversed', 'Both ways'], ['cloze', 'Cloze']].map(([k, l]) => `<button type="button" data-t="${k}" class="${t === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="f" for="nFront" id="lFront">${t === 'cloze' ? 'Text' : 'Front'}</label><textarea id="nFront" placeholder="${t === 'cloze' ? 'The capital of France is {{c1::Paris}}.' : 'Question'}">${esc(note ? htmlToText(note.front) : '')}</textarea>
    <div class="row" id="clozeRow" ${t === 'cloze' ? '' : 'hidden'}><button type="button" class="btn" id="clozeBtn">[…] Make cloze</button><span class="muted small">Select text, then tap. Use c1, c2… for separate cards.</span></div>
    <label class="f" for="nBack" id="lBack">${t === 'cloze' ? 'Extra (optional)' : 'Back'}</label><textarea id="nBack" placeholder="${t === 'cloze' ? 'Shown with the answer' : 'Answer'}">${esc(note ? htmlToText(note.back) : '')}</textarea>
    <label class="f" for="nTags">Tags</label><input type="text" id="nTags" placeholder="space separated" value="${esc(note ? (note.tags || []).join(' ') : (meta.lastTags || ''))}" autocapitalize="off">
    <label class="f">Image (optional)</label>
    <div class="row" id="imgRow"><label class="btn" for="nImg" style="margin:0">Add image</label><input type="file" id="nImg" accept="image/*" hidden>${window.ImgCards ? '<button type="button" class="btn" id="findImg">Find image</button>' : ''}
      <select id="nImgSide" style="width:auto"><option value="back" ${draft.imgSide === 'back' ? 'selected' : ''}>Show on back</option><option value="front" ${draft.imgSide === 'front' ? 'selected' : ''}>Show on front</option></select></div>
    <div id="imgPrev">${imgPrevHTML()}</div>
    <div class="actions">${note ? '<button type="button" class="btn danger" id="delNote">Delete</button>' : ''}<button class="btn pri" type="submit">${note ? 'Save changes' : 'Add card'}</button></div>
    <p class="kbd" style="text-align:left">${note ? '' : '<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> to add'}</p></form>`;
  $('#nType').onclick = e => { const b = e.target.closest('button'); if (!b) return; draft.type = b.dataset.t; const keep = [$('#nFront').value, $('#nBack').value, $('#nTags').value, $('#nDeck').value]; rAdd(); [$('#nFront').value, $('#nBack').value, $('#nTags').value] = keep; if (keep[3] !== '__new') $('#nDeck').value = keep[3]; };
  $('#nDeck').onchange = async e => { if (e.target.value !== '__new') return; const name = prompt('Name for the new deck'); if (name && name.trim()) { const d = { id: 'd-' + rid(), name: name.trim() }; await write([['decks', d]]); const keep = [$('#nFront').value, $('#nBack').value, $('#nTags').value]; meta.lastDeck = d.id; rAdd(); [$('#nFront').value, $('#nBack').value, $('#nTags').value] = keep; $('#nDeck').value = d.id; } else e.target.value = deckSel || ''; };
  $('#clozeBtn').onclick = () => { const ta = $('#nFront'), s = ta.selectionStart, e = ta.selectionEnd, v = ta.value; const nums = clozeNums(v); const n = nums.length ? Math.max(...nums) + 1 : 1; const sel = v.slice(s, e) || '…'; ta.value = v.slice(0, s) + `{{c${n}::${sel}}}` + v.slice(e); ta.focus(); };
  $('#nImg').onchange = async e => { const f = e.target.files[0]; if (f) await attachImage(f); e.target.value = ''; };
  $('#nImgSide').onchange = e => { draft.imgSide = e.target.value; };
  if ($('#rmImg')) $('#rmImg').onclick = () => { draft.img = null; draft.imgCredit = null; refreshImg(); };
  if ($('#findImg')) $('#findImg').onclick = () => { const q = $('#nFront').value.trim() || $('#nBack').value.trim(); ImgCards.picker(q, (data, credit) => { draft.img = data; draft.imgCredit = credit; draft.imgSide = $('#nImgSide') ? $('#nImgSide').value : 'back'; refreshImg(); toast('Image attached'); }); };
  for (const ta of [$('#nFront'), $('#nBack')]) ta.addEventListener('paste', async e => { const it = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); await attachImage(it.getAsFile()); } });
  $('#noteForm').onsubmit = e => { e.preventDefault(); saveNote(); };
  $('#noteForm').onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveNote(); } };
  if (note) $('#delNote').onclick = async () => { if (!confirm('Delete this note and its cards?')) return; await write([['notes', { ...note, del: 1 }], ...cardsOfNote(note.id).map(c => ['cards', { ...c, del: 1 }])]); editId = null; toast('Deleted'); go(meta.returnTo || 'browse'); };
}
function imgPrevHTML() { return draft.img ? `<div class="imgprev"><img src="${esc(draft.img)}" alt=""><button type="button" id="rmImg" aria-label="Remove image">✕</button>${draft.imgCredit ? `<div class="img-cred">${esc(draft.imgCredit)}</div>` : ''}</div>` : '<p class="muted small">You can also paste an image into a text box.</p>'; }
function refreshImg() { $('#imgPrev').innerHTML = imgPrevHTML(); if ($('#rmImg')) $('#rmImg').onclick = () => { draft.img = null; draft.imgCredit = null; refreshImg(); }; }
async function shrinkImage(blob, max = 900, budget = 160000) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight; const k = Math.min(1, max / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
    let q = 0.8, out = cv.toDataURL('image/jpeg', q);
    while (out.length > budget && q > 0.35) { q -= 0.12; out = cv.toDataURL('image/jpeg', q); }
    if (out.length > budget) { cv.width = Math.round(w / 2); cv.height = Math.round(h / 2); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); out = cv.toDataURL('image/jpeg', 0.6); }
    return out;
  } finally { URL.revokeObjectURL(url); }
}
async function attachImage(file) { try { draft.img = await shrinkImage(file); draft.imgCredit = null; draft.imgSide = $('#nImgSide') ? $('#nImgSide').value : 'back'; refreshImg(); toast('Image attached'); } catch { toast('That image could not be read'); } }
async function saveNote() {
  const deck = $('#nDeck').value, front = $('#nFront').value.trim(), back = $('#nBack').value.trim(), tags = $('#nTags').value.trim().split(/\s+/).filter(Boolean);
  if (!deck || deck === '__new') { toast('Pick a deck first'); return; }
  if (!front) { toast(draft.type === 'cloze' ? 'Add some text first' : 'The front is empty'); $('#nFront').focus(); return; }
  if (draft.type === 'cloze' && !clozeNums(front).length) { toast('Mark a cloze like {{c1::answer}}'); return; }
  const old = editId ? M.notes.get(editId) : null;
  const note = { ...(old || { id: 'n-' + rid(), created: Date.now() }), deck, type: draft.type, front: textToHtml(front), back: textToHtml(back), tags, img: draft.img || null, imgSide: draft.imgSide || 'back', imgCredit: draft.img ? (draft.imgCredit || null) : null };
  M.notes.set(note.id, note); // so card generation sees the new note
  await write([['notes', note], ...cardsForNote(note)]);
  setMeta('lastDeck', deck); setMeta('lastTags', tags.join(' '));
  if (old) { toast('Saved'); editId = null; go(meta.returnTo || 'browse'); return; }
  const n = ordsFor(note).length; toast(n > 1 ? `Added ${n} cards` : 'Card added');
  draft = { type: draft.type, img: null, imgSide: draft.imgSide, imgCredit: null }; $('#nFront').value = ''; $('#nBack').value = ''; refreshImg(); $('#nFront').focus();
}
function editNote(id, returnTo) { editId = id; meta.returnTo = returnTo; go('add', { keepEdit: true }); }

/* ---------------- browse ---------------- */
let bq = '', bdeck = '';
function rBrowse() {
  $('#v-browse').innerHTML = `<div class="row"><input type="search" id="bq" class="grow" placeholder="Search cards and tags" value="${esc(bq)}" style="flex:1 1 200px"><select id="bdeck" style="flex:1 1 140px;width:auto"><option value="">All decks</option>${decks().map(d => `<option value="${esc(d.id)}" ${d.id === bdeck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div><details class="tagbox" id="tagbox" ${meta.tagsOpen ? 'open' : ''}><summary>Tags</summary><div id="tagtree"></div></details><div class="row" style="margin-top:10px;justify-content:space-between"><span class="muted small" id="bcount"></span><button class="btn" id="studyTag" hidden>Study these</button></div><div class="results" id="bres"></div>`;
  $('#tagbox').ontoggle = e => { meta.tagsOpen = e.target.open; };
  $('#tagtree').onclick = e => { const tg = e.target.closest('[data-tog]'); if (tg) { const k = tg.dataset.tog; openTags.has(k) ? openTags.delete(k) : openTags.add(k); rTagTree(); return; } const b = e.target.closest('[data-tag]'); if (b) { bq = 'tag:' + b.dataset.tag; $('#bq').value = bq; rBrowseResults(); rTagTree(); } };
  $('#studyTag').onclick = () => { const t = tagQuery(); if (t) { studyDeck = 'tag:' + t; undoStack = []; go('study'); } };
  rTagTree();
  $('#bq').oninput = e => { bq = e.target.value; rBrowseResults(); rTagTree(); }; $('#bdeck').onchange = e => { bdeck = e.target.value; rBrowseResults(); };
  rBrowseResults();
}
const openTags = new Set();
const tagQuery = () => { const m = /^\s*(?:tag:|#)(\S+)\s*$/i.exec(bq); return m ? m[1] : null; };
function rTagTree() {
  const el = $('#tagtree'); if (!el) return; const root = tagTree(); const act = (tagQuery() || '').toLowerCase();
  const rows = (node, depth) => [...node.kids.values()].sort((a, b) => a.name.localeCompare(b.name)).map(k => {
    const has = k.kids.size > 0, open = openTags.has(k.path);
    return `<div class="tagrow" style="padding-left:${depth * 18}px">${has ? `<button class="tog" data-tog="${esc(k.path)}" aria-label="${open ? 'Collapse' : 'Expand'}">${open ? '▾' : '▸'}</button>` : '<span class="tog"></span>'}<button class="tagbtn${act === k.path.toLowerCase() ? ' on' : ''}" data-tag="${esc(k.path)}">${esc(k.name)} <span class="muted">${k.n}</span></button></div>` + (has && open ? rows(k, depth + 1) : '');
  }).join('');
  el.innerHTML = root.kids.size ? rows(root, 0) : '<p class="muted small" style="margin:8px 0">No tags yet.</p>';
}
function rBrowseResults() {
  if (!$('#bres')) return;
  const words = bq.toLowerCase().split(/\s+/).filter(Boolean);
  const all = live(M.notes).filter(n => (!bdeck || n.deck === bdeck) && M.decks.get(n.deck) && !M.decks.get(n.deck).del);
  const hits = all.filter(n => { if (!words.length) return true; const hay = (stripHtml(n.front) + ' ' + stripHtml(n.back)).toLowerCase(); return words.every(w => /^(tag:|#)./.test(w) ? tagHit(n.tags, w.replace(/^(tag:|#)/, '')) : (hay.includes(w) || (n.tags || []).some(t => t.toLowerCase().includes(w)))); })
    .sort((a, b) => (b.created || 0) - (a.created || 0) || (a.id < b.id ? -1 : 1));
  const shown = hits.slice(0, 200);
  const tq = tagQuery(); if ($('#studyTag')) { $('#studyTag').hidden = !(tq && hits.length); $('#studyTag').textContent = tq ? `Study #${tq.split('::').pop()}` : 'Study these'; }
  $('#bcount').textContent = `${hits.length} note${hits.length === 1 ? '' : 's'}${hits.length > 200 ? ' · showing the first 200' : ''}`;
  $('#bres').innerHTML = shown.map(n => `<button class="res" data-edit="${esc(n.id)}"><div class="q">${esc(stripHtml(n.type === 'cloze' ? n.front.replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/g, '[$1]') : n.front)) || '(empty)'}</div><div class="meta">${esc(stripHtml(n.back)).slice(0, 120) || '&nbsp;'}</div><div class="meta">${esc((M.decks.get(n.deck) || {}).name || '')}${n.type !== 'basic' ? `<span class="chip">${n.type === 'cloze' ? 'cloze' : 'reversed'}</span>` : ''}${(n.tags || []).length ? ' · ' + esc(n.tags.join(' ')) : ''}</div></button>`).join('') || '<div class="empty">No matching cards.</div>';
}

/* ---------------- stats ---------------- */
function rStats() {
  const now = Date.now(), ds0 = dayStart(now), revs = live(M.revlog);
  const today = revs.filter(r => r.t >= ds0);
  const days = new Set(revs.map(r => dayIdx(r.t))); let streak = 0, d = dayIdx(now); if (!days.has(d)) d--; while (days.has(d)) { streak++; d--; }
  const mature = revs.filter(r => r.ps === 2 && r.t >= now - 30 * DAY); const ret = mature.length ? Math.round(mature.filter(r => r.g > 1).length / mature.length * 100) : null;
  const tAcc = today.length ? Math.round(today.filter(r => r.g > 1).length / today.length * 100) : null;
  const cards = live(M.cards).filter(c => M.decks.get(c.deck) && !M.decks.get(c.deck).del);
  const fc = Array(7).fill(0); let month = 0;
  for (const c of cards) { if (c.st === 0) continue; const k = Math.max(0, Math.floor((dayStart(c.due) - ds0) / DAY + 0.5)); if (k < 7) fc[k]++; if (k < 30) month++; }
  const hist = Array(14).fill(0); for (const r of revs) { const k = dayIdx(now) - dayIdx(r.t); if (k >= 0 && k < 14) hist[13 - k]++; }
  const wd = i => new Date(ds0 + i * DAY + 12 * HOUR).toLocaleDateString('en-US', { weekday: 'short' });
  const bars = (arr, lab) => { const mx = Math.max(1, ...arr); return `<div class="bars">${arr.map((v, i) => `<div class="b"><span class="nv">${v || ''}</span><div class="bar" style="height:${Math.round(v / mx * 85)}%"></div><span class="lb">${lab(i)}</span></div>`).join('')}</div>`; };
  const cn = { n: cards.filter(c => c.st === 0).length, l: cards.filter(c => c.st === 1 || c.st === 3).length, y: cards.filter(c => c.st === 2 && (c.ivl || 0) < 21).length, m: cards.filter(c => c.st === 2 && (c.ivl || 0) >= 21).length };
  $('#v-stats').innerHTML = `<div class="tiles">
    <div class="tile"><div class="v">${today.length}</div><div class="k">Reviews today${tAcc != null ? ` · ${tAcc}% correct` : ''}</div></div>
    <div class="tile"><div class="v">${streak}<span class="muted" style="font-size:16px"> day${streak === 1 ? '' : 's'}</span></div><div class="k">Streak</div></div>
    <div class="tile"><div class="v">${ret == null ? '–' : ret + '%'}</div><div class="k">Retention (30 days)</div></div>
    <div class="tile"><div class="v">${month}</div><div class="k">Due in the next 30 days</div></div></div>
    <h3>Due forecast · next 7 days</h3>${bars(fc, i => i === 0 ? 'Today' : wd(i))}
    <h3>Reviews · last 14 days</h3>${bars(hist, i => { const dd = new Date(ds0 - (13 - i) * DAY + 12 * HOUR); return i % 2 ? '' : (dd.getMonth() + 1) + '/' + dd.getDate(); })}
    <h3>Cards</h3><div class="tiles"><div class="tile"><div class="v" style="color:var(--new)">${cn.n}</div><div class="k">New</div></div><div class="tile"><div class="v" style="color:var(--lrn)">${cn.l}</div><div class="k">Learning</div></div><div class="tile"><div class="v" style="color:var(--due)">${cn.y}</div><div class="k">Young</div></div><div class="tile"><div class="v">${cn.m}</div><div class="k">Mature (21+ days)</div></div></div>`;
}

/* ---------------- settings, import, export ---------------- */
const fmtCode = c => c ? c.match(/.{1,4}/g).join('-') : '';
function rSettings() {
  const paired = !!meta.code, acctU = meta.acct && window.Account ? Account.user() : null;
  $('#v-settings').innerHTML = `<h3 style="margin-top:4px">Sync</h3><div class="panel">${acctU ? `
      <p><b>Syncing with your account.</b> <span class="muted">${esc(acctU.email)}</span></p>
      <p class="muted small" id="lastSync">${meta.lastSync ? 'Last synced ' + new Date(meta.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : ''}</p>
      <div class="row" style="margin-top:12px"><button class="btn grow" id="acctBtn">Account</button><button class="btn grow" id="syncNowBtn">Sync now</button></div>` : paired ? `
      <p><b>This device is synced.</b> <span class="muted" id="lastSync">${meta.lastSync ? 'Last synced ' + new Date(meta.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.' : ''}</span></p>
      <p class="muted small">Changes sync automatically whenever you're online. To add another device, open this app there, go to Settings → Use a sync code, and enter your code.</p>
      <div class="row" style="margin-top:12px"><button class="btn grow" id="showCode">Show sync code</button><button class="btn grow" id="syncNowBtn">Sync now</button></div>
      <div class="row" style="margin-top:10px"><button class="btn danger grow" id="unpair">Stop syncing on this device</button></div>` : `
      ${window.Account && Account.on ? `<p><b>Sign in to sync.</b> <span class="muted small">Optional. Keeps your decks, progress and Synapse Pro on every device.</span></p><button class="btn pri wide" id="acctBtn" style="margin:10px 0 16px">Sign in or create an account</button><p class="muted small"><b>Or use a sync code</b> (no account):</p>` : ''}
      ${window.Account && Account.on ? '' : '<p><b>Sync between your phone and computer.</b></p>'}
      <p class="muted small">Tap “Create sync code” on this device and you get a 12-character code. Enter it on your other device and both stay in sync whenever you're online.</p>
      <button class="btn ${window.Account && Account.on ? '' : 'pri '}wide" id="createAcct" style="margin-top:12px">Create sync code</button>
      <label class="f" for="joinCode">Use a sync code</label>
      <div class="row"><input type="text" id="joinCode" class="grow" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="16" style="flex:1 1 180px;text-transform:uppercase"><button class="btn" id="joinBtn">Connect</button></div>`}
    </div>
    <h3>Import</h3><div class="panel"><p class="muted small">Anki decks (.apkg), CSV or TSV (front, back, tags), or a JSON backup from this app.</p>
      <label class="btn wide" for="impFile" style="margin-top:10px">Choose a file…</label><input type="file" id="impFile" accept=".apkg,.colpkg,.csv,.tsv,.txt,.json,application/zip,text/csv,text/plain,application/json" hidden>
      <p class="muted small" id="impStatus" style="margin-top:10px"></p></div>
    <h3>Export</h3><div class="panel"><div class="row" style="align-items:stretch"><button class="btn grow" id="expCsv">Export CSV</button><button class="btn grow" id="expJson">Full backup</button></div><p class="muted small" style="margin:8px 0 0">CSV is your cards only. Full backup saves everything (decks, cards, progress) as one file you can import later.</p></div>
    <h3>About</h3><div class="panel"><p class="muted small">Scheduling uses FSRS, aiming for 90% recall. A study day starts at 4 AM. Everything works offline. Version ${VERSION}.</p></div>`;
  if ($('#acctBtn')) $('#acctBtn').onclick = () => Account.open();
  if (acctU) { $('#syncNowBtn').onclick = () => syncNow(true); }
  else if (paired) {
    $('#showCode').onclick = () => showCodeSheet(meta.code, false);
    $('#syncNowBtn').onclick = () => syncNow(true);
    $('#unpair').onclick = async () => { if (!confirm('Stop syncing on this device? Your cards stay here, and you can reconnect with your code.')) return; await setMeta('code', null); await setMeta('cursor', 0); setPill(); rSettings(); };
  } else {
    $('#createAcct').onclick = createAccount;
    $('#joinBtn').onclick = () => joinAccount($('#joinCode').value);
    $('#joinCode').onkeydown = e => { if (e.key === 'Enter') joinAccount($('#joinCode').value); };
    if (pendingPair) { $('#joinCode').value = fmtCode(pendingPair); pendingPair = null; }
  }
  $('#impFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
  $('#expCsv').onclick = exportCsv; $('#expJson').onclick = exportJson;
}
const loaded = {};
function loadScript(src) { return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = (window.OdinNative && OdinNative.overURL && OdinNative.overURL(src)) || src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); })); }
async function showCodeSheet(code, fresh) {
  const url = (window.ODIN_SITE && !window.SYN_REMOTE ? window.ODIN_SITE + '/' : location.origin + location.pathname) + '#pair=' + code; // native builds link to the website
  openSheet(`<h2>${fresh ? 'Sync account created' : 'Your sync code'}</h2>
    <p class="muted small">On your other device, open this app, go to Settings → Use a sync code, and enter:</p>
    <div class="code" id="codeBox">${fmtCode(code)}</div>
    <div class="qr" id="qr"></div>
    <p class="muted small">Scanning the QR code opens the app in the browser with the code filled in. On iPhone, if you use the home-screen app, type the code in there instead (the home-screen app keeps its own storage).</p>
    <p class="muted small">Keep this code private: anyone with it can see and change your cards.</p>
    <div class="actions"><button class="btn pri" data-close>Done</button></div>`);
  try { await loadScript('vendor/qrcode.js'); const q = qrcode(0, 'M'); q.addData(url); q.make(); const n = q.getModuleCount(), cv = document.createElement('canvas'), k = 6; cv.width = cv.height = n * k; const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cx.fillRect(c * k, r * k, k, k); cv.setAttribute('aria-label', 'QR code for pairing'); $('#qr').appendChild(cv); } catch { $('#qr').hidden = true; }
}
const CODECHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() { const a = new Uint8Array(12); crypto.getRandomValues(a); return [...a].map(b => CODECHARS[b % 32]).join(''); }
async function api(path, opts = {}, code = meta.code) {
  const headers = { ...(opts.headers || {}) }; if (code) headers['x-sync-code'] = code; if (opts.body) headers['content-type'] = 'application/json';
  let r; try { r = await fetch(path, { ...opts, headers, cache: 'no-store' }); } catch (e) { const err = new Error('offline'); err.offline = true; throw err; }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok || !j || !j.ok) { const err = new Error((j && j.error) || ('http_' + r.status)); err.status = r.status; throw err; }
  return j;
}
async function createAccount() {
  const b = $('#createAcct'); b.disabled = true; b.textContent = 'Creating…';
  try {
    let code; for (let i = 0; i < 4; i++) { code = newCode(); try { await api('/api/create', { method: 'POST', body: JSON.stringify({ code }) }, null); break; } catch (e) { if (e.status !== 409 || i === 3) throw e; } }
    await setMeta('code', code); await setMeta('cursor', 0); rSettings(); showCodeSheet(code, true); syncNow();
  } catch (e) { toast(e.offline ? "You're offline. Connect to the internet to create a sync account." : 'Could not create the account. Try again.'); b.disabled = false; b.textContent = 'Create sync account'; }
}
async function joinAccount(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0');
  if (code.length !== 12) { toast('A sync code has 12 characters'); return; }
  const b = $('#joinBtn'); if (b) { b.disabled = true; b.textContent = 'Connecting…'; }
  try { await api('/api/check', {}, code); await setMeta('code', code); await setMeta('cursor', 0); toast('Connected. Syncing your cards…'); rSettings(); await syncNow(true); }
  catch (e) { toast(e.offline ? "You're offline. Try again when you're connected." : e.status === 403 ? "That code doesn't match a sync account." : 'Could not connect. Try again.'); if (b) { b.disabled = false; b.textContent = 'Connect'; } }
}

/* ---------------- sync engine ---------------- */
let syncing = false, again = false, syncTimer = null, pillState = '';
function setPill(st, msg) {
  if (!st) st = !syncOn() ? 'local' : !navigator.onLine ? 'off' : 'ok';
  pillState = st; const p = $('#syncPill');
  const T = { local: ['', 'Not synced'], off: ['off', 'Offline'], busy: ['busy', 'Syncing…'], ok: ['ok', 'Synced ✓'], err: ['err', msg || 'Sync error'] }[st];
  p.className = 'pill ' + T[0]; $('.txt', p).textContent = T[1]; p.dataset.state = st;
}
const syncOn = () => !!(meta.code || meta.acct); // a sync code, or a signed-in account (feat/account)
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); if (syncOn()) syncTimer = setTimeout(() => syncNow(), ms); }
async function syncNow(loud) {
  if (!syncOn()) { setPill(); return; }
  if (!navigator.onLine) { setPill('off'); return; }
  if (syncing) { again = true; return; }
  syncing = true; setPill('busy');
  try {
    await push(); const got = await pull();
    if (window.Library) { try { await Library.afterSync(); } catch (e) { console.warn('library', e); } }
    await setMeta('lastSync', Date.now()); setPill('ok');
    if ($('#lastSync')) $('#lastSync').textContent = 'Last synced ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.';
    if (got) { changed(); if (view === 'study' && !cur) rStudy(); if (loud && got) toast(`Synced ${got} change${got === 1 ? '' : 's'}`); }
    else if (loud) toast('Up to date');
  } catch (e) {
    if (e.offline) setPill('off'); else setPill('err', e.status === 403 ? (meta.acct ? 'Signed out' : 'Code not found') : 'Sync error');
    if (e.status === 403 && meta.acct && window.Account) Account.refresh();
  } finally { syncing = false; if (again) { again = false; scheduleSync(300); } }
}
async function push() {
  const t = idb.transaction('dirty', 'readonly'); const st = t.objectStore('dirty');
  const keys = await reqP(st.getAllKeys());
  if (!keys.length) return;
  let batch = [], size = 0; const sent = [];
  const flush = async () => {
    if (!batch.length) return;
    await api('/api/push', { method: 'POST', body: JSON.stringify({ recs: batch.map(x => x.r) }) });
    const t2 = idb.transaction('dirty', 'readwrite'), s2 = t2.objectStore('dirty');
    for (const x of batch) { const o = M[KIND[x.r.k]].get(x.r.i); if (!o || o.mod === x.r.m) s2.delete(x.key); }
    await txDone(t2); batch = []; size = 0;
  };
  for (const key of keys) {
    const k = key[0], id = key.slice(2), o = M[KIND[k]] && M[KIND[k]].get(id); if (!o) continue;
    const d = JSON.stringify(o); if (d.length > 1400000) continue;
    if (batch.length >= 300 || size + d.length > 2500000) await flush();
    batch.push({ key, r: { k, i: id, m: o.mod, d } }); size += d.length + 60;
  }
  await flush();
}
async function pull() {
  let n = 0;
  for (let guard = 0; guard < 500; guard++) {
    const j = await api('/api/pull?since=' + (meta.cursor || 0));
    const list = [];
    for (const r of j.recs) {
      const s = KIND[r.k]; if (!s) continue; const loc = M[s].get(r.i);
      if (loc && loc.mod >= r.m) continue;
      let o; try { o = JSON.parse(r.d); } catch { continue; } o.mod = r.m; list.push([s, o]);
    }
    if (list.length) {
      const t = idb.transaction(['decks', 'notes', 'cards', 'revlog', 'progress', 'dirty'], 'readwrite');
      for (const [s, o] of list) { M[s].set(o.id, o); t.objectStore(s).put(o); t.objectStore('dirty').delete(KINDOF[s] + ':' + o.id); }
      await txDone(t); n += list.length;
    }
    await setMeta('cursor', j.cursor);
    if (!j.more) break;
  }
  return n;
}

/* ---------------- import ---------------- */
function impStatus(s) { document.querySelectorAll('#impStatus,[data-imp-status]').forEach(el => { el.textContent = s; }); }
/* content filter for imports (Odin is 14): no dosing amounts, nothing sexual/recreational/abuse, no STI or reproductive topics */
const IMPORT_BAD = /\b(sex(ual\w*|uell\w*|o|y)?|porn\w*|nud(e|ity)|naked|erotic\w*|genital\w*|penis|vagin\w*|vulva|breasts?|nipples?|testic\w*|scrot\w*|uter(us|ine)|ovar(y|ies|ian)|prostat\w*|erectile|viagra|sildenafil|contracept\w*|condoms?|reproductive|intercourse|masturbat\w*|recreational\w*|overdos\w*|abuse\w*|misuse\w*|addict\w*|getting high|euphori\w*|cocaine|heroin|meth|mdma|ecstasy|lsd|ketamine|psilocybin|marijuana|cannabis|weed|syphilis|gonorrh\w*|chlamydia|herpes|hpv|hiv|stis?|stds?|suicid\w*|self-harm)\b|breast|recreational|sexual|\d\s*(mg|mcg|µg|μg|g|ml|units?|iu)\b/i;
function importOk(...xs) { return !IMPORT_BAD.test(xs.map(x => stripHtml(String(x || ''))).join(' \n ')); }
async function importFile(f) {
  const name = f.name || 'import', ext = name.toLowerCase().split('.').pop();
  try {
    if (ext === 'apkg' || ext === 'colpkg' || ext === 'zip') await importApkg(f);
    else if (ext === 'json') await importJson(f);
    else await importCsvAsk(f);
  } catch (e) { console.warn(e); impStatus(''); toast('Import failed: ' + (e.message || 'unreadable file'), 4000); }
}
function findOrMakeDeck(name, list) {
  const ex = decks().find(d => d.name.toLowerCase() === name.toLowerCase()); if (ex) return ex.id;
  const pending = list.find(([s, o]) => s === 'decks' && o.name.toLowerCase() === name.toLowerCase()); if (pending) return pending[1].id;
  const d = { id: 'd-' + rid(), name }; list.push(['decks', d]); return d.id;
}
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, ''); const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const meta = {}; for (const m of text.matchAll(/^#(guid|notetype|deck|tags) column:(\d+)/gm)) meta[m[1]] = +m[2] - 1; // Anki "Notes in plain text" export
  const ankiTxt = Object.keys(meta).length > 0;
  const first = lines[0] || ''; const delim = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const rows = []; let row = [], f = '', q = false; const src = lines.join('\n') + '\n';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '"') { if (src[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"' && f === '') q = true;
    else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
  }
  if (ankiTxt) { const skip = new Set([meta.guid, meta.notetype, meta.deck, meta.tags].filter(x => x != null)); for (let k = 0; k < rows.length; k++) { const r = rows[k], fl = r.filter((x, j) => !skip.has(j)); rows[k] = [fl[0] || '', fl.slice(1).filter(Boolean).join('<br>'), meta.tags != null ? (r[meta.tags] || '') : '']; } }
  if (rows.length && /^(front|question|term)$/i.test((rows[0][0] || '').trim()) && /^(back|answer|definition)$/i.test((rows[0][1] || '').trim())) rows.shift();
  return rows.filter(r => (r[0] || '').trim());
}
async function importCsvAsk(f) {
  const text = await f.text(); const all = parseDelimited(text).map(r => r.map(x => String(x || '').replace(/\[sound:[^\]]*\]/g, ''))); const rows = all.filter(r => importOk(r[0], r[1], r[2])); const skippedRows = all.length - rows.length;
  if (!rows.length) throw new Error(all.length ? 'every card in that file was blocked by the content filter' : 'no cards found in that file');
  const base = (f.name || 'Imported').replace(/\.[^.]+$/, '');
  openSheet(`<h2>Import ${rows.length} card${rows.length === 1 ? '' : 's'}</h2><p class="muted small">Columns: front, back, then tags (optional).${skippedRows ? ` ${skippedRows} skipped by the content filter.` : ''}</p>
    <label class="f" for="impDeck">Into deck</label><select id="impDeck"><option value="__new">New deck: ${esc(base)}</option>${decks().map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn pri" id="impGo">Import</button></div>`);
  $('#impGo').onclick = async () => {
    const list = []; let deck = $('#impDeck').value; if (deck === '__new') deck = findOrMakeDeck(base, list);
    const t0 = Date.now();
    rows.forEach((r, i) => {
      const front = textToHtml((r[0] || '').trim()), back = textToHtml((r[1] || '').trim()), tags = (r[2] || '').trim().split(/\s+/).filter(Boolean);
      const note = { id: 'n-' + rid(), created: t0 + i, deck, type: clozeNums(front).length ? 'cloze' : 'basic', front, back, tags };
      M.notes.set(note.id, note); list.push(['notes', note], ...cardsForNote(note, t0 + i * 3));
    });
    await write(list); closeSheet(); toast(`Imported ${rows.length} card${rows.length === 1 ? '' : 's'}`); impStatus(`Imported ${rows.length} from ${f.name}.`);
  };
}
function readProtoMedia(bytes) {
  // MediaEntries { repeated MediaEntry entries = 1 } ; MediaEntry { string name = 1; ... uint32 legacy_zip_filename = 255 }
  let i = 0; const out = []; const vint = () => { let x = 0, s = 0, b; do { b = bytes[i++]; x += (b & 127) * Math.pow(2, s); s += 7; } while (b & 128); return x; };
  const dec = new TextDecoder();
  while (i < bytes.length) {
    const tag = vint(), fn = Math.floor(tag / 8), wt = tag & 7;
    if (wt === 2) { const len = vint(), end = i + len; if (fn === 1) { let name = '', zipName = null; while (i < end) { const t2 = vint(), f2 = Math.floor(t2 / 8), w2 = t2 & 7; if (w2 === 2) { const l2 = vint(); if (f2 === 1) name = dec.decode(bytes.subarray(i, i + l2)); i += l2; } else if (w2 === 0) { const v = vint(); if (f2 === 255) zipName = v; } else if (w2 === 5) i += 4; else if (w2 === 1) i += 8; } out.push({ name, zip: String(zipName != null ? zipName : out.length) }); } i = end; }
    else if (wt === 0) vint(); else if (wt === 5) i += 4; else if (wt === 1) i += 8; else break;
  }
  return out;
}
const isZstd = b => b && b.length > 4 && b[0] === 0x28 && b[1] === 0xb5 && b[2] === 0x2f && b[3] === 0xfd;
async function importApkg(f) {
  impStatus('Opening the deck…');
  await loadScript('vendor/jszip.min.js');
  const zip = await JSZip.loadAsync(f);
  let bytes, colName = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find(n => zip.file(n));
  if (!colName) throw new Error('this .apkg has no collection inside');
  bytes = await zip.file(colName).async('uint8array');
  if (isZstd(bytes)) { await loadScript('vendor/fzstd.js'); bytes = fzstd.decompress(bytes); }
  impStatus('Reading cards…');
  await loadScript('vendor/sql-wasm.js');
  const SQL = await initSqlJs({ locateFile: () => 'vendor/sql-wasm.wasm' });
  const db = new SQL.Database(bytes);
  try {
    const q = (sql) => { const r = db.exec(sql); return r.length ? r[0].values : []; };
    const dnames = {};
    try { for (const [id, name] of q('SELECT id, name FROM decks')) dnames[id] = String(name).replace(/\x1f/g, '::'); }
    catch { const col = JSON.parse(q('SELECT decks FROM col')[0][0] || '{}'); for (const k in col) dnames[k] = col[k].name; }
    // media: name -> zip entry
    const media = {}; const mf = zip.file('media');
    if (mf) {
      let mb = await mf.async('uint8array'); if (isZstd(mb)) { await loadScript('vendor/fzstd.js'); mb = fzstd.decompress(mb); }
      try { const js = JSON.parse(new TextDecoder().decode(mb)); for (const k in js) media[js[k]] = k; }
      catch { for (const e of readProtoMedia(mb)) media[e.name] = e.zip; }
    }
    const rows = q('SELECT n.id, n.guid, n.flds, n.tags, c.ord, c.did, c.queue FROM cards c JOIN notes n ON c.nid = n.id ORDER BY n.id, c.ord');
    const byNote = new Map();
    for (const [nid, guid, flds, tags, ord, did, queue] of rows) { let o = byNote.get(nid); if (!o) byNote.set(nid, o = { guid, flds: String(flds).split('\x1f'), tags: String(tags || '').trim().split(/\s+/).filter(Boolean), ords: [], did, susp: queue === -1 }); o.ords.push(ord); }
    if (!byNote.size) throw new Error('no cards in this deck');
    if (byNote.size === 1 && /update to the latest/i.test([...byNote.values()][0].flds.join(' '))) throw new Error('this export needs a newer format; in Anki, export with "Support older Anki versions" unchecked or checked and try again');
    const imgCache = {};
    const imgData = async name => {
      if (name in imgCache) return imgCache[name];
      const zn = media[name], zf = zn != null && zip.file(zn); if (!zf) return (imgCache[name] = null);
      let b = await zf.async('uint8array'); if (isZstd(b)) { await loadScript('vendor/fzstd.js'); b = fzstd.decompress(b); }
      const ext = name.split('.').pop().toLowerCase(); const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }[ext];
      if (!type || type === 'image/svg+xml') return (imgCache[name] = null);
      try { return (imgCache[name] = await shrinkImage(new Blob([b], { type }), 800, 120000)); } catch { return (imgCache[name] = null); }
    };
    const fixField = async h => {
      h = String(h || '').replace(/\[sound:[^\]]*\]/g, '').replace(/<(audio|video)\b[\s\S]*?(<\/\1>|\/>|$)/gi, '');
      const names = [...h.matchAll(/<img[^>]*src=["']?([^"'>\s]+)["']?[^>]*>/gi)];
      for (const m of names) { const src = decodeURIComponent(m[1]); const data = await imgData(src); h = h.replace(m[0], data ? `<img src="${data}">` : ''); }
      return sanitize(h);
    };
    const list = [], t0 = Date.now(); let i = 0, imgs = 0, skipped = 0;
    const deckIds = {};
    for (const [nid, o] of byNote) {
      if (++i % 200 === 0) { impStatus(`Reading cards… ${i} of ${byNote.size}`); await new Promise(r => setTimeout(r)); }
      if (!importOk(...o.flds, o.tags.join(' '))) { skipped++; continue; }
      const dn = (dnames[o.did] || 'Imported').trim() || 'Imported';
      const deck = deckIds[dn] || (deckIds[dn] = findOrMakeDeck(dn, list));
      const f0 = await fixField(o.flds[0]); const rest = []; for (const x of o.flds.slice(1)) { const v = await fixField(x); if (stripHtml(v) || /<img/i.test(v)) rest.push(v); }
      imgs += (f0.match(/<img/g) || []).length + rest.join('').split('<img').length - 1;
      const type = clozeNums(f0).length ? 'cloze' : (o.ords.includes(1) && rest.length ? 'reversed' : 'basic');
      const id = 'ak-' + String(o.guid || nid).replace(/[^A-Za-z0-9_-]/g, c => c.charCodeAt(0).toString(36)).slice(0, 40);
      const ex = M.notes.get(id);
      const note = { ...(ex && !ex.del ? ex : { id, created: t0 + i }), deck, type, front: f0, back: rest.join(type === 'cloze' ? '<br>' : '<br><br>'), tags: o.tags, del: 0 };
      M.notes.set(id, note); list.push(['notes', note]);
      for (const c of cardsForNote(note, t0 + i * 3)) { if (o.susp) c[1].susp = 1; list.push(c); }
    }
    impStatus('Saving…');
    for (let k = 0; k < list.length; k += 2000) await write(list.slice(k, k + 2000));
    const nd = Object.keys(deckIds).length;
    const got = byNote.size - skipped;
    impStatus(`Imported ${got} note${got === 1 ? '' : 's'} into ${nd} deck${nd === 1 ? '' : 's'}${imgs ? ` with ${imgs} image${imgs === 1 ? '' : 's'}` : ''}. Sound was left out.${skipped ? ` Skipped ${skipped} that didn't pass the content filter (doses or off-limits topics).` : ''} Cards start as new.`);
    toast(`Imported ${got} note${got === 1 ? '' : 's'}`);
  } finally { db.close(); }
}
async function importJson(f) {
  const j = JSON.parse(await f.text()); if (!j || j.app !== 'cards') throw new Error('not a backup from this app');
  const list = [];
  for (const s of ['decks', 'notes', 'cards', 'revlog', 'progress']) for (const o of j[s] || []) { const ex = M[s].get(o.id); if (!ex || (o.mod || 0) > (ex.mod || 0)) list.push([s, o]); }
  for (let k = 0; k < list.length; k += 2000) await write(list.slice(k, k + 2000));
  toast(`Restored ${list.length} item${list.length === 1 ? '' : 's'}`); impStatus(`Restored ${list.length} items from ${f.name}.`);
}
function download(name, text, type) { const b = new Blob([text], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
const stamp8 = () => new Date().toISOString().slice(0, 10);
function exportCsv() {
  const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';
  const rows = [['front', 'back', 'tags', 'deck', 'type'].join(',')];
  for (const n of live(M.notes)) { const d = M.decks.get(n.deck); if (!d || d.del) continue; rows.push([n.front, n.back, (n.tags || []).join(' '), d.name, n.type].map(q).join(',')); }
  download(`cards-${stamp8()}.csv`, rows.join('\r\n'), 'text/csv'); toast(`Exported ${rows.length - 1} notes`);
}
function exportJson() {
  const o = { app: 'cards', version: 1, exported: new Date().toISOString() };
  for (const s of ['decks', 'notes', 'cards', 'revlog', 'progress']) o[s] = [...M[s].values()];
  download(`cards-backup-${stamp8()}.json`, JSON.stringify(o), 'application/json'); toast('Backup saved');
}

/* ---------------- sheet ---------------- */
function openSheet(html) { $('#sheet').innerHTML = html; $('#sheetWrap').hidden = false; const f = $('#sheet input:not([type=hidden]):not([type=file])'); if (f && !isTouch) f.focus(); }
function closeSheet() { $('#sheetWrap').hidden = true; $('#sheet').innerHTML = ''; }

/* ---------------- events ---------------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button,[data-goto],[data-close]'); if (!t) { if (e.target.id === 'sheetWrap') closeSheet(); return; }
  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.dataset.goto) { closeSheet(); go(t.dataset.goto); return; }
  if (t.hasAttribute('data-close')) { closeSheet(); return; }
  if (t.dataset.study) { studyDeck = t.dataset.study; undoStack = []; go('study'); return; }
  if (t.dataset.opts) { deckSheet(t.dataset.opts); return; }
  if (t.dataset.edit) { editNote(t.dataset.edit, 'browse'); return; }
  if (t.dataset.grade) { grade(+t.dataset.grade); return; }
  switch (t.id) {
    case 'studyAll': studyDeck = '*'; undoStack = []; go('study'); break;
    case 'newDeck': deckSheet(null); break;
    case 'showBtn': showAnswer(); break;
    case 'backDecks': go('decks'); break;
    case 'undoBtn': undo(); break;
    case 'editCur': if (cur) editNote(cur.nid, 'study'); break;
    case 'syncPill': if (pillState !== 'busy') { if (syncOn()) syncNow(true); else if (window.Account && Account.on) Account.open(); else go('settings'); } break;
  }
});
document.addEventListener('keydown', e => {
  if ((e.target && e.target.closest && e.target.closest('input,textarea,select')) || e.metaKey || e.ctrlKey || e.altKey) { if (e.key === 'Escape') closeSheet(); return; }
  if (e.key === 'Escape') { closeSheet(); return; }
  if (view !== 'study' || !$('#sheetWrap').hidden) return;
  if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); showAnswer(); return; }
  if (shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); grade(+e.key); return; }
  if (shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); grade(3); return; }
  if (e.key === 'z' || e.key === 'u') { undo(); return; }
  if (e.key === 'e' && cur) editNote(cur.nid, 'study');
});
document.addEventListener('gesturestart', e => e.preventDefault());
window.addEventListener('online', () => syncNow());
window.addEventListener('offline', () => setPill('off'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { hubPush(); syncNow(); if (view === 'decks' || view === 'home') render(); } });
setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 30000);

/* ---------------- hub (shared streak + XP) sync ---------------- */
// Hub keeps its state in localStorage (so /shot/ shares it). Here it is mirrored into D1 as
// progress records t:'hx' (one per day), so the streak and XP follow the sync code to every device.
let hubSeen = 0, hubTimer = 0;
function hubPull() {
  if (!window.Hub) return; const recs = [];
  for (const o of M.progress.values()) if (o.t === 'hx' && (o.mod || 0) > hubSeen) recs.push(o);
  if (!recs.length) return; hubSeen = Math.max(hubSeen, ...recs.map(o => o.mod || 0));
  Hub.merge(recs); hubPushSoon();
}
async function hubPush() {
  if (!window.Hub) return; const recs = Hub.takeDirty(); if (!recs.length) return;
  const list = recs.map(r => ['progress', { ...(M.progress.get(r.id) || {}), ...r, del: 0 }]);
  await write(list); hubSeen = Math.max(hubSeen, ...list.map(x => x[1].mod || 0));
}
function hubPushSoon() { clearTimeout(hubTimer); hubTimer = setTimeout(() => hubPush().catch(e => console.warn('hub push', e)), 1200); }
function hubInit() {
  if (!window.Hub) return;
  hubPull();
  // one-time: count activity from before the hub existed (card reviews, lessons read, tests taken)
  const days = {}, k = t => Hub.dayKey(t), add = (t, kind) => { const d = days[k(t)] || (days[k(t)] = {}); d[kind] = (d[kind] || 0) + 1; };
  for (const r of M.revlog.values()) if (!r.del && r.t) add(r.t, r.g === 1 ? 'again' : 'review');
  for (const o of M.progress.values()) if (!o.del && o.t === 'lesson') { if (o.read) add(o.read, 'lesson'); if (o.at) add(o.at, 'test'); }
  Hub.backfill(days);
  Hub.onChange(hubPushSoon); hubPushSoon();
  if (window.Stats2) { let achT; const achCheck = () => { clearTimeout(achT); achT = setTimeout(() => { const n = Stats2.check(); if (n.length) toast(n.length === 1 ? 'Badge earned: ' + n[0].name : n.length + ' badges earned', 2800); }, 700); }; Hub.onChange(achCheck); changeHooks.push(achCheck); achCheck(); }
}

/* ---------------- boot ---------------- */
let pendingPair = null;
async function seed() {
  const S = self.SEED; if (!S) return;
  const list = [];
  for (const d of S.decks) if (!M.decks.has(d.id)) list.push(['decks', { id: d.id, name: d.name, mod: 1 }]);
  S.notes.forEach((n, i) => {
    if (M.notes.has(n.id)) return;
    const note = { id: n.id, deck: n.deck, type: n.type, front: n.front, back: n.back, tags: n.tags, created: i, mod: 1 };
    list.push(['notes', note]); M.notes.set(note.id, note);
    ordsFor(note).forEach((o, k) => { const id = note.id + '~' + o; if (!M.cards.has(id)) list.push(['cards', { id, nid: note.id, deck: note.deck, ord: o, st: 0, due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0, step: 0, pos: i * 3 + k, mod: 1 }]); });
  });
  await write(list, { clean: true, keepMod: true });
}
/* starter decks added after v1 ship in a lazy JSON file. merged once per seed version:
   only ids this device has never seen are added (tombstones stay in M, so a deck or card the
   user deleted is never brought back), and nothing goes into a deck the user deleted. seed
   records are written clean with mod 1, so any synced edit or delete (mod > 1) always wins. */
const SEED_VER = 2;
async function seedMore() {
  if ((meta.seedVer || 1) >= SEED_VER) return false;
  let j; try { const r = await fetch('seed-v2.json?v=' + SEED_VER, { cache: 'no-cache' }); if (!r.ok) return false; j = await r.json(); } catch { return false; }
  if (!j || !Array.isArray(j.decks) || !Array.isArray(j.notes)) return false;
  const list = [];
  for (const d of j.decks) if (!M.decks.has(d.id)) list.push(['decks', { id: d.id, name: d.name, mod: 1 }]);
  j.notes.forEach((n, i) => {
    if (M.notes.has(n.id)) return;
    const dk = M.decks.get(n.deck); if (dk && dk.del) return;
    const note = { id: n.id, deck: n.deck, type: n.type, front: n.front, back: n.back || '', tags: n.tags || [], created: 1000 + i, mod: 1 };
    list.push(['notes', note]); M.notes.set(note.id, note);
    ordsFor(note).forEach((o, k) => { const id = note.id + '~' + o; if (!M.cards.has(id)) list.push(['cards', { id, nid: note.id, deck: note.deck, ord: o, st: 0, due: 0, s: 0, d: 0, reps: 0, lapses: 0, last: 0, step: 0, pos: 10000 + i * 3 + k, mod: 1 }]); });
  });
  await write(list, { clean: true, keepMod: true });
  await setMeta('seedVer', SEED_VER);
  if (list.length) changed();
  return true;
}
(async function boot() {
  try { idb = await idbOpen(); await loadAll(); } catch (e) { document.body.innerHTML = '<p style="padding:24px">This browser blocked local storage, so the app cannot run here. Private browsing can cause this.</p>'; return; }
  if (!meta.seeded) { await seed(); await setMeta('seeded', 1); }
  const m = /[#&]pair=([0-9A-Za-z-]{12,16})/.exec(location.hash);
  if (m) { pendingPair = m[1].toUpperCase().replace(/-/g, ''); history.replaceState(null, '', location.pathname); }
  setPill(); hubInit(); go(pendingPair && !meta.code ? 'settings' : 'home');
  try { await seedMore(); } catch (e) { console.warn('seed merge', e); }
  syncNow();
  if ('serviceWorker' in navigator && !self.NO_SW) swAutoUpdate();
})();
/* v118: the installed app updates itself. sw.js CACHE is the single version source (Settings > Version reads it too).
   The page checks for a new sw.js on start, whenever it comes back to the foreground and every 30 min; a new worker
   takes over right away and the page reloads once (never mid-review: it waits until the review ends), then says "Updated to vN". */
function swAutoUpdate() {
  const sw = navigator.serviceWorker; let hadCtl = !!sw.controller;
  let reloading = false, pend = false;
  const verOf = t => { const m = /CACHE\s*=\s*['"]cards-v(\d+)['"]/.exec(t || ''); return m ? m[1] : ''; };
  fetch('sw.js', { cache: 'no-store' }).then(r => r.text()).then(t => { const v = verOf(t); if (v) { VERSION = v; window.APP_VER = 'v' + v; } }).catch(() => {});
  const inReview = () => view === 'study' && !!cur;
  const typing = () => { // never reload over something being typed (new card, notes, search, sign-in)
    const a = document.activeElement;
    if (a && !a.disabled && !a.readOnly && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(button|submit|reset|checkbox|radio|range|color|file|hidden)$/i.test(a.type || '')))) return true;
    return [...document.querySelectorAll('textarea')].some(t => t.offsetParent !== null && t.value && t.value !== t.defaultValue && /\S/.test(t.value));
  };
  let pendTyping = false;
  const reload = () => {
    if (reloading) return;
    if (inReview()) { pend = true; return; }
    if (typing()) { if (!pendTyping) toast('Update ready · it applies next time you open the app', 3200); pend = true; pendTyping = true; return; }
    let last = 0; try { last = +sessionStorage.getItem('swReloadAt') || 0; } catch (e) {}
    if (Date.now() - last < 20e3) return; // loop guard: at most one automatic reload per 20 s
    reloading = true;
    try { sessionStorage.setItem('swReloadAt', String(Date.now())); sessionStorage.setItem('swUpdated', '1'); } catch (e) {}
    location.reload();
  };
  sw.addEventListener('controllerchange', () => { if (hadCtl) reload(); else hadCtl = true; }); // first install (no old worker) needs no reload
  setInterval(() => { if (pend && !pendTyping && !inReview()) reload(); }, 1500); // waiting on a review: apply as soon as it ends
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pend && !inReview() && !typing()) reload(); }); // waiting on typing: apply on the next return
  try {
    if (sessionStorage.getItem('swUpdated') === '1') {
      sessionStorage.removeItem('swUpdated');
      fetch('sw.js', { cache: 'no-store' }).then(r => r.text()).then(t => { const v = verOf(t); setTimeout(() => toast(v ? 'Updated to v' + v : 'App updated', 2600), 600); }).catch(() => {});
    }
  } catch (e) {}
  sw.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    const skip = w => { try { if (w) w.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {} };
    if (reg.waiting && sw.controller) skip(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) skip(w); }); });
    let lastPing = 0; const ping = () => { if (Date.now() - lastPing < 2e3) return; lastPing = Date.now(); reg.update().catch(() => {}); };
    ping();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
    window.addEventListener('focus', ping); window.addEventListener('pageshow', ping);
    setInterval(ping, 30 * 60e3);
  }).catch(() => {});
}
self.__cards = { M, meta: () => meta, schedule, syncNow, nextCard, renderCard, seedMore };
