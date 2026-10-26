/* Doctor Lab + Study tools: hubs, lazy module loader, shared scores (synced as progress record lab:scores), Explain sheet hook.
   Heavy modules live in feat/lab/<name>.js and load on first open (not in the service-worker precache). */
(function () {
  'use strict';
  if (window.Lab) return;
  const VER = '148';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const IC = {
    steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
    brain: '<path d="M12 5.5a3 3 0 0 0-5.6-1.3A3 3 0 0 0 4 8.8a3.3 3.3 0 0 0 .3 5.6A3.2 3.2 0 0 0 8 19.4a2.8 2.8 0 0 0 4 .6m0-14.5a3 3 0 0 1 5.6-1.3A3 3 0 0 1 20 8.8a3.3 3.3 0 0 1-.3 5.6 3.2 3.2 0 0 1-3.7 5 2.8 2.8 0 0 1-4 .6m0-14.5v14.5"/>',
    ecg: '<path d="M2.5 12h4l2-5 3.5 11 2.5-8 1.5 2h5.5"/>',
    scan: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><ellipse cx="12" cy="12" rx="4.5" ry="5.5"/><path d="M12 6.5v11"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    camera: '<path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/>',
    ear: '<path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 3-2.5 4-3 6.5-.4 2-1.8 3.5-3.8 3.5"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.4-1.5 2-1.5 3.5"/>',
    verb: '<path d="M4 6h10M4 12h7M4 18h10"/><path d="m16 9 2.5 6L21 9"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4"/>',
    chev: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    flask: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 14h9"/>',
    rank: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5.5l1.5-1v4M3.8 13.2c.3-.8 2.2-1 2.2.3 0 .9-2.2 1.8-2.2 2.5H6M4 18h1.3c1 0 1 1.6 0 1.6H4"/>',
    abc: '<path d="M3 17l3.5-10L10 17M4.2 13.5h4.6"/><path d="M13 7v10h3.2a2.5 2.5 0 0 0 0-5H13h2.7a2.5 2.5 0 0 0 0-5z"/><path d="M21.5 8.5a3.2 3.2 0 1 0 0 7"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>', book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>'
  };
  const ic = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 20}" height="${s || 20}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
  // feature registry. wave tells which are shipped (rows with ready:false are hidden)
  const F = {
    sim: { title: 'Patient sim', sub: 'History → exam → tests → diagnosis', ic: 'steth', hub: 'lab', file: 'sim', ready: true },
    lesion: { title: 'Lesion locator', sub: 'Symptoms → tap where the lesion is', ic: 'brain', hub: 'lab', file: 'lesion', ready: true },
    ecg: { title: 'ECG trainer', sub: 'Name the rhythm: 15 rhythms', ic: 'ecg', hub: 'lab', file: 'ecg', ready: true },
    scan: { title: 'CT / MRI reader', sub: 'Real head scans, swipe the slices', ic: 'scan', hub: 'lab', file: 'scan', ready: true },
    match: { title: 'Drug class matcher', sub: 'Mechanism → class → example', ic: 'pill', hub: 'lab', file: 'match', ready: true },
    ocr: { title: 'Snap a page', sub: 'Photo of a textbook → flashcards', ic: 'camera', hub: 'tools', file: 'ocr', ready: true },
    hands: { title: 'Hands-free review', sub: 'Reads cards out, you answer out loud', ic: 'ear', hub: 'tools', file: 'hands', ready: true },
    neuro: { title: 'Neuro exam sim', sub: 'Test cranial nerves, reflexes, strength: localise it', ic: 'brain', hub: 'lab', file: 'neuro', ready: true },
    surg: { title: 'Surgery steps', sub: 'Put craniotomy, VP shunt, LP… in order', ic: 'rank', hub: 'lab', file: 'surg', ready: true },
    atlas: { title: 'Brain slice atlas', sub: 'Real MRI: tap to label, then quiz yourself', ic: 'brain', hub: 'lab', file: 'atlas', ready: true },
    code: { title: 'Code blue', sub: 'Run ACLS on a crashing monitor', ic: 'ecg', hub: 'lab', file: 'code', ready: true },
    bugs: { title: 'Bug ID', sub: 'Name the microbe from stain, lab test and disease', ic: 'flask', hub: 'lab', file: 'bugs', ready: true },
    pk: { title: 'PK sim', sub: 'Dose, half-life, steady state: keep a pretend drug in the window', ic: 'pill', hub: 'lab', file: 'pk', ready: true },
    pun: { title: 'Punnett squares', sub: 'Build a cross, read the odds, quiz yourself', ic: 'abc', hub: 'lab', file: 'pun', ready: true },
    vit: { title: 'Vitals interpreter', sub: 'What each number means + MAP, shock index, qSOFA, NEWS2', ic: 'ecg', hub: 'lab', file: 'vit', ready: true },
    soap: { title: 'SOAP note practice', sub: 'Sort a patient visit into S, O, A and P', ic: 'steth', hub: 'lab', file: 'soap', ready: true },
    spot: { title: 'Spot the difference', sub: 'Normal brain scan vs sick one: tap what changed', ic: 'scan', hub: 'lab', file: 'spot', ready: true },
    speed: { title: 'Anatomy speed run', sub: '60 seconds: name as many brain parts as you can', ic: 'brain', hub: 'lab', file: 'speed', ready: true },
    dle: { title: 'Doctordle: 6 clues', sub: 'Our nightly rounds + archive + new ones', ic: 'steth', hub: 'doc', file: 'dle', ready: true, open: () => toDoc() }, // lives inside the main Doctordle section now (v75)
    druglab: { title: 'Drug Lab', sub: 'Invent a drug, run the trials, get it approved', ic: 'pill', hub: 'lab', file: 'druglab', ready: true },
    labs: { title: 'Lab panel reader', sub: 'CBC · BMP · ABG · LFT: flag it, find the cause', ic: 'flask', hub: 'lab', file: 'labs', ready: true },
    ddx: { title: 'Differential builder', sub: 'Rank the top 5 diagnoses vs an expert', ic: 'rank', hub: 'lab', file: 'ddx', ready: true },
    words: { title: 'Medical word builder', sub: 'Prefixes, roots, suffixes: build + break', ic: 'abc', hub: 'lab', file: 'words', ready: true },
    receptor: { title: 'Receptor drop', sub: 'Drag a drug onto its target, watch it act', ic: 'key', hub: 'lab', file: 'receptor', ready: true },
    history: { title: 'Medicine timeline', sub: 'Put discoveries in order', ic: 'clock', hub: 'lab', file: 'history', ready: true },
    heart: { title: 'Heart sounds', sub: 'Real stethoscope recordings: rhythms + murmurs', ic: 'ear', hub: 'lab', file: 'sounds', ready: true },
    lung: { title: 'Lung sounds', sub: 'Wheeze, crackles, stridor, whoop', ic: 'ear', hub: 'lab', file: 'sounds', ready: true },
    inst: { title: 'Instrument ID', sub: 'Name the surgical tool from a photo', ic: 'steth', hub: 'lab', file: 'pics', ready: true },
    derm: { title: 'Rash quiz', sub: 'Real skin photos: name the rash', ic: 'scan', hub: 'lab', file: 'pics', ready: true },
    histo: { title: 'Histology slides', sub: 'Name the tissue under the microscope', ic: 'scan', hub: 'lab', file: 'pics', ready: true },
    mnemo: { title: 'Memory hooks', sub: 'Mnemonics for the cards you keep missing', ic: 'bolt', hub: 'tools', file: 'mnemo', ready: true },
    badges: { title: 'Badges + levels', sub: 'Your level + 30 Doctor Lab badges', ic: 'bolt', hub: 'tools', file: 'badges', ready: true },
    plan: { title: 'Exam planner', sub: 'Set a test date: daily plan on home', ic: 'clock', hub: 'tools', file: 'plan', ready: true },
    pbook: { title: 'Pharm book cards', sub: '299 cards auto-made from your own book', ic: 'pill', hub: 'tools', file: 'pbook', ready: true },
    anki: { title: 'Import from Anki', sub: '.apkg, .colpkg or .txt — on your phone, sound left out', ic: 'key', hub: 'tools', file: 'anki', ready: true },
    occl: { title: 'Image occlusion', sub: 'Hide labels on a diagram: each box = a card', ic: 'camera', hub: 'tools', file: 'occl', ready: true },
    fc: { title: '30-day forecast', sub: 'Reviews coming up each day, per deck', ic: 'timer', hub: 'tools', file: 'fc', ready: true },
    vn: { title: 'Voice notes', sub: 'Record yourself on cards (stays on this phone)', ic: 'ear', hub: 'tools', file: 'vn', ready: true },
    daily: { title: 'Daily challenge', sub: '12 of your cards, 90 seconds, personal bests', ic: 'timer', hub: 'tools', file: 'daily', ready: true },
    amb: { title: 'Study sounds', sub: 'Rain, brown noise, café… made on your phone', ic: 'ear', hub: 'tools', file: 'amb', ready: true },
    themes: { title: 'Themes', sub: 'Any color, background tints, fonts; save your own', ic: 'book', hub: 'tools', file: 'themes', ready: true },
    share: { title: 'Share a deck', sub: 'Read-only link you can turn off anytime', ic: 'book', hub: 'tools', file: 'share', ready: true },
    mix: { title: 'Mix-ups', sub: 'Cards you confuse, drilled head to head', ic: 'verb', hub: 'tools', file: 'mix', ready: true },
    body: { title: 'Body map', sub: 'Every card mapped onto a body', ic: 'steth', hub: 'tools', file: 'body', ready: true },
    recall: { title: 'Exam-day recall', sub: 'What you would still know on test day', ic: 'clock', hub: 'tools', file: 'recall', ready: true },
    focus: { title: 'Focus timer', sub: 'Pomodoro with cards on the break', ic: 'timer', hub: 'tools', open: () => XView.open('focus'), ready: true }
  };
  const HUBS = { lab: { title: 'Doctor Lab', blurb: 'Practice like a doctor: cases, labs, differentials, neuro localisation, rhythms, scans, drugs and medical words.' }, tools: { title: 'Study tools', blurb: 'Faster ways to make and review cards.' } };
  window.LabMods = window.LabMods || {};
  let curV = null;
  function load(name) {
    const f = F[name]; if (!f || !f.file) return Promise.resolve();
    if (window.LabMods[name]) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'feat/lab/' + f.file + '.js?v=' + VER; s.onload = res; s.onerror = () => rej(new Error('load')); document.head.appendChild(s); });
  }
  function host(name) {
    return el => {
      curV = name; window.scrollTo(0, 0);
      el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
      load(name).then(() => { if (!el.isConnected) return; const m = window.LabMods[name]; if (!m) throw new Error('missing'); m.render(el); })
        .catch(e => { console.warn(e); if (el.isConnected) el.innerHTML = `<div class="lb"><div class="lb-empty">Couldn't load this. Check your connection and try again.<br><button class="btn pri" data-lab-retry="${name}">Try again</button></div></div>`; });
    };
  }
  function hubHTML(h) {
    const H = HUBS[h], rows = Object.entries(F).filter(([, f]) => f.hub === h && f.ready);
    return `<div class="lb"><div class="lb-head"><h2>${H.title}</h2><p class="muted">${H.blurb}</p></div>
      <div class="lb-group">${rows.map(([k, f]) => { const b = best(k); return `<button class="lb-row" data-lab-open="${k}" type="button"><span class="lb-ic">${ic(f.ic, 19)}</span><span class="lb-rt"><span class="t1">${f.title}</span><span class="t2">${f.sub}</span></span>${b != null ? `<span class="lb-best">${b}</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>
      ${h === 'lab' ? '<p class="lb-foot">Teaching cases and drug classes only. No doses. Not medical advice.</p>' : ''}</div>`;
  }
  function toDoc(m) { try { localStorage.setItem('doc.mode', m || 'six'); } catch (e) {} if (typeof go === 'function') go('doc'); }
  function open(name) { const f = F[name]; if (!f) return; if (f.open) return f.open(); XView.open(name); }
  function register() {
    if (!window.XView || !XView.MODS) return;
    XView.MODS.lab = { title: 'Doctor Lab', render: el => { curV = 'lab'; el.innerHTML = hubHTML('lab'); window.scrollTo(0, 0); } };
    XView.MODS.tools = { title: 'Study tools', render: el => { curV = 'tools'; el.innerHTML = hubHTML('tools'); window.scrollTo(0, 0); } };
    for (const [k, f] of Object.entries(F)) if (f.file && f.ready) XView.MODS[k] = { title: f.title, render: host(k) };
    XView.MODS.dle = { title: 'Doctordle', render: el => { el.innerHTML = ''; setTimeout(() => toDoc(), 0); } };
    const o = XView.open; if (!o._lab) { XView.open = function (n) { curV = n; try { window.LabMods.sounds && LabMods.sounds.stop(); } catch (e) {} return o.apply(this, arguments); }; XView.open._lab = 1; }
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lab-open]'); if (a) { open(a.dataset.labOpen); return; }
    const r = e.target.closest('[data-lab-retry]'); if (r) { XView.open(r.dataset.labRetry); return; }
    const b = e.target.closest('[data-lab-hub]'); if (b) { XView.open(b.dataset.labHub); return; }
  });
  // section menu (☰) entries while a lab screen is open
  function menuFor() {
    if (!curV) return null; const f = F[curV]; const hub = HUBS[curV] ? curV : f && f.hub; if (!hub) return null;
    const items = [[hub === 'lab' ? 'doc' : 'play', HUBS[hub].title, () => XView.open(hub)]];
    for (const [k, x] of Object.entries(F)) if (x.hub === hub && x.ready) items.push([{ sim: 'doc', lesion: 'brain', ecg: 'play', scan: 'layers', match: 'quiz', ocr: 'add', hands: 'play', conj: 'learn', focus: 'play', labs: 'quiz', ddx: 'doc', words: 'learn', receptor: 'quiz', history: 'layers', druglab: 'quiz', neuro: 'brain', occl: 'add', pbook: 'learn', anki: 'add', bugs: 'quiz', pk: 'play', pun: 'quiz', vit: 'doc', soap: 'learn', spot: 'brain', speed: 'play', gen: 'learn', rp: 'learn', tc: 'learn', share: 'learn', themes: 'learn', amb: 'play', daily: 'quiz', vn: 'play', fc: 'learn', paste: 'add', phr: 'learn', badges: 'play', plan: 'learn', dict: 'play', mnemo: 'learn', mix: 'quiz', body: 'doc', recall: 'learn', dle: 'doc', surg: 'layers', atlas: 'brain', code: 'play', heart: 'play', lung: 'play', inst: 'quiz', derm: 'quiz', histo: 'layers' }[k] || 'play', x.title, () => open(k)]);
    items.push([hub === 'lab' ? 'play' : 'doc', hub === 'lab' ? 'Study tools' : 'Doctor Lab', () => XView.open(hub === 'lab' ? 'tools' : 'lab')]);
    return { t: HUBS[hub].title, items };
  }


  /* ---------- exam planner store + home row (the editor screen lives in feat/lab/plan.js) ---------- */
  const PKEY = 'plan.v1';
  const pad2 = n => String(n).padStart(2, '0');
  const pkey = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const todayKey = () => pkey(new Date(Date.now() - 4 * 36e5));
  function pget() { let o = null; try { o = JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) {} o = o && o.exams ? o : { exams: [], at: 0 }; try { const r = M.progress && M.progress.get('lab:plan'); if (r && r.data && (r.data.at || 0) > (o.at || 0)) { o = r.data; localStorage.setItem(PKEY, JSON.stringify(o)); } } catch (e) {} return o; }
  function pset(o) { o.at = Date.now(); try { localStorage.setItem(PKEY, JSON.stringify(o)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: 'lab:plan', t: 'lab', data: o, at: o.at, del: 0 }]]); } catch (e) {} }
  function pcalc(x) {
    const tk = todayKey(), [y, m, d] = x.date.split('-').map(Number), [ty, tm, td] = tk.split('-').map(Number);
    const days = Math.round((new Date(y, m - 1, d, 12) - new Date(ty, tm - 1, td, 12)) / 864e5);
    const decks = (x.decks || []).map(id => M.decks.get(id)).filter(dk => dk && !dk.del);
    const ids = new Set(decks.map(dk => dk.id)); let nw = 0, due = 0; const end = (typeof dayStart === 'function' ? dayStart(Date.now()) + DAY : Date.now() + 864e5);
    for (const c of M.cards.values()) { if (c.del || c.susp || !ids.has(c.deck)) continue; if (!c.st) nw++; else if (c.due < end) due++; }
    const newDays = days >= 3 ? days - 1 : Math.max(1, days); const per = days > 0 ? Math.ceil(nw / newDays) : 0;
    const plan = []; let left = nw;
    for (let i = 0; i <= Math.max(0, days) && i < 60; i++) { const dt = new Date(ty, tm - 1, td + i, 12); const k = pkey(dt); if (i === days) plan.push({ k, exam: 1 }); else if (i >= newDays) plan.push({ k, review: 1 }); else { const n = Math.min(left, per); left -= n; plan.push({ k, n }); } }
    const newToday = days > 0 && newDays > 0 ? Math.min(nw, per) : 0;
    return { days, past: days < 0, decks, nw, due, per, newToday, today: newToday + due, plan, todayKey: tk };
  }
  function pstudy(id) { const x = pget().exams.find(e => e.id === id); if (!x) return; const c = pcalc(x); const dk = c.decks[0]; if (!dk) { XView.open('plan'); return; } try { studyDeck = c.decks.length > 1 ? '*' : dk.id; undoStack = []; go('study'); } catch (e) { go('decks'); } }
  const plan = { get: pget, set: pset, calc: pcalc, study: pstudy, todayKey, key: pkey };
  window.HomeExtras = window.HomeExtras || [];
  HomeExtras.push(() => { try { const ex = pget().exams.filter(x => pcalc(x).days >= 0).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 2); return ex.map(x => { const c = pcalc(x); return `<button class="recap-row" data-lab-open="plan" type="button"><span class="bt-ic">${ic('clock', 20)}</span><span class="plan-t"><span>${esc(x.name)} · ${c.days === 0 ? 'today' : 'in ' + c.days + ' day' + (c.days === 1 ? '' : 's')}</span><small>Today: ${c.today} cards (${c.newToday} new + ${c.due} due)</small></span>${ic('chev', 16)}</button>`; }).join(''); } catch (e) { return ''; } });

  /* ---------- scores: localStorage + one synced progress record ---------- */
  const KEY = 'lab.v1';
  let S = (() => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.sc) return o; } catch (e) {} return { sc: {}, h: [], at: 0 }; })();
  function save() { S.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} pushSoon(); }
  let pt = 0;
  function pushSoon() { clearTimeout(pt); pt = setTimeout(() => { try { if (typeof write === 'function' && typeof M !== 'undefined' && M.progress) write([['progress', { id: 'lab:scores', t: 'lab', data: S, at: S.at, del: 0 }]]); } catch (e) { console.warn('lab push', e); } }, 2500); }
  function pull() {
    try {
      const o = typeof M !== 'undefined' && M.progress && M.progress.get('lab:scores'); if (!o || !o.data || !o.data.sc) return;
      const R = o.data; let ch = false;
      for (const src in R.sc) { const a = S.sc[src] || (S.sc[src] = {}); for (const id in R.sc[src]) { const x = a[id], y = R.sc[src][id]; if (!x || (y.n || 0) > (x.n || 0)) { a[id] = y; ch = true; } } }
      if (R.h && R.h.length) { const have = new Set(S.h.map(e => e.t + e.s + e.id)); const add = R.h.filter(e => !have.has(e.t + e.s + e.id)); if (add.length) { S.h = S.h.concat(add).sort((a, b) => a.t - b.t).slice(-400); ch = true; } }
      if (ch) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    } catch (e) {}
  }
  // src: sim|lesion|ecg|scan|match|conj ; score 0..100
  function result(src, id, score, extra) {
    const a = S.sc[src] || (S.sc[src] = {}), x = a[id] || (a[id] = { b: 0, l: 0, n: 0, t: 0 });
    score = Math.max(0, Math.min(100, Math.round(score)));
    x.b = Math.max(x.b, score); x.l = score; x.n++; x.t = Date.now();
    S.h.push(Object.assign({ s: src, id: String(id).slice(0, 40), sc: score, t: Date.now() }, extra || {})); if (S.h.length > 400) S.h = S.h.slice(-400);
    save();
    return x;
  }
  function stat(src) { const a = S.sc[src] || {}, ids = Object.keys(a); if (!ids.length) return null; const avg = Math.round(ids.reduce((s, k) => s + a[k].l, 0) / ids.length); return { n: ids.length, avg, best: Math.max(...ids.map(k => a[k].b)) }; }
  function best(name) { const s = stat(name); if (!s) return null; return s.avg + '%'; }
  function bestOf(src, id) { const a = S.sc[src] || {}; return a[id] || null; }
  // mastery + XP + feedback
  function mastery(ev) { try { if (window.Mastery) return Mastery.record(ev); } catch (e) { console.warn(e); } }
  function award(kind, xp) { try { if (window.Hub) Hub.award(kind, xp); } catch (e) {} }
  function fx(ok) { try { if (window.Prefs) { Prefs.sound(ok ? 'ok' : 'bad'); Prefs.haptic(); } } catch (e) {} }
  function top(title, right, backTo) { return `<div class="lb-top"><button class="lb-back" type="button" data-lab-hub="${backTo || 'lab'}">${ic('back', 18)}<span>${backTo === 'tools' ? 'Tools' : backTo && F[backTo] ? F[backTo].title : 'Lab'}</span></button><span class="lb-tr">${right || ''}</span></div>${title ? `<h2 class="lb-title">${title}</h2>` : ''}`; }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const jcache = {};
  function json(path) { return jcache[path] || (jcache[path] = fetch(path + (path.includes('?') ? '&' : '?') + 'v=' + VER).then(r => { if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).catch(e => { delete jcache[path]; throw e; })); }

  /* ---------- Explain this card (button under the revealed card; module loads on tap) ---------- */
  function explainBtn() {
    const v = document.getElementById('v-study'); if (!v || v.hidden) return;
    const revealed = v.querySelector('#ansbar [data-grade]'), has = v.querySelector('.lb-xbtn');
    if (revealed && !has) { const face = v.querySelector('#face'); if (face) face.insertAdjacentHTML('afterend', `<div class="lb-xrow"><button class="lb-xbtn" type="button" data-lab-explain>${ic('book', 16)} Explain this card</button><button class="lb-xbtn" type="button" data-lab-tutor>${ic('steth', 16)} Ask a tutor</button><button class="lb-xbtn" type="button" data-lab-voice>🎙️ Voice note</button><button class="lb-xbtn" type="button" data-lab-mix>⇄ Mixed it up?</button>${(() => { try { const c = window.curCard && window.curCard(); return c && (c.lapses || 0) >= 2 ? '<button class="lb-xbtn" type="button" data-lab-mnemo>💡 Memory hook</button>' : ''; } catch (e) { return ''; } })()}</div>`); }
    else if (!revealed && has) { const row = has.closest('.lb-xrow'); (row || has).remove(); }
  }
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lab-explain]')) return;
    const card = typeof window.curCard === 'function' ? window.curCard() : null; if (!card) return;
    if (!window.LabMods.explain) { const s = document.createElement('script'); s.src = 'feat/lab/explain.js?v=' + VER; s.onload = () => window.LabMods.explain.open(card); s.onerror = () => toast('Couldn\'t load. Check your connection.'); document.head.appendChild(s); }
    else window.LabMods.explain.open(card);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lab-tutor]')) return;
    const card = typeof window.curCard === 'function' ? window.curCard() : null; if (!card) return;
    if (!window.LabMods.tutor) { const s = document.createElement('script'); s.src = 'feat/lab/tutor.js?v=' + VER; s.onload = () => window.LabMods.tutor.open(card); s.onerror = () => toast('Couldn\'t load. Check your connection.'); document.head.appendChild(s); }
    else window.LabMods.tutor.open(card);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lab-mix]')) return;
    const card = typeof window.curCard === 'function' ? window.curCard() : null; if (!card) return;
    load('mix').then(() => window.LabMods.mix.pick(card)).catch(() => toast('Couldn\'t load. Check your connection.'));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lab-mnemo]')) return;
    const card = typeof window.curCard === 'function' ? window.curCard() : null; if (!card) return;
    load('mnemo').then(() => window.LabMods.mnemo.open(card)).catch(() => toast('Couldn\'t load. Check your connection.'));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-lab-voice]')) return;
    const card = typeof window.curCard === 'function' ? window.curCard() : null; if (!card) return;
    load('vn').then(() => window.LabMods.vn.open(card)).catch(() => toast('Couldn\'t load. Check your connection.'));
  });
  function boot() {
    register();
    const sv = document.getElementById('v-study'); if (sv && window.MutationObserver) new MutationObserver(explainBtn).observe(sv, { childList: true, subtree: true });
    if (typeof changeHooks !== 'undefined' && Array.isArray(changeHooks) && !boot.h) { changeHooks.push(pull); boot.h = 1; }
    setTimeout(pull, 1800);
    setTimeout(() => { load('badges').then(() => window.LabMods.badges && LabMods.badges.watch()).catch(() => {}); }, 5000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  let css2done = false;
  let css3done = false;
  function css3() { if (css3done) return; css3done = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'feat/lab/lab3.css?v=' + VER; document.head.appendChild(l); }
  function css2() { if (css2done) return; css2done = true; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'feat/lab/lab2.css?v=' + VER; document.head.appendChild(l); }
  window.Lab = { toDoc, plan, css2, css3, F, HUBS, ic, esc, open, load, result, stat, best, bestOf, mastery, award, fx, top, shuffle, json, menuFor, cur: () => curV, _S: () => S, VER, register };
})();
