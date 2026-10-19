/* Shell: the app's one navigation system (v95). Five-tab bar, one header with back + search on every screen,
   per-tab back stack, grouped Lab and More hubs with filter, feature index for global search, recents for Home.
   Loaded last; wraps go() and XView.open(). Replaces the old house button + side menu (feat/nav). */
(function () {
  'use strict';
  if (window.Shell) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const P = {
    home: '<path d="M3.5 11.2 12 4l8.5 7.2"/><path d="M5.5 9.6V20h4.6v-5.6h3.8V20h4.6V9.6"/>',
    study: '<rect x="3.5" y="6.5" width="13" height="14" rx="2.5"/><path d="M7.5 3.5h10a3 3 0 0 1 3 3v10"/>',
    learn: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c3.2 2.4 7.8 2.4 11 0v-5"/><path d="M21.5 9v5"/>',
    lab: '<path d="M9 3.5h6M10 3.5v6L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.5v-6"/><path d="M7.4 15h9.2"/>',
    more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
    search: '<circle cx="11" cy="11" r="6.8"/><path d="m20 20-4-4"/>',
    back: '<path d="m14.5 5-7 7 7 7"/>', chev: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    body: '<circle cx="12" cy="4.6" r="2"/><path d="M7 9h10M12 9v6M9.5 21l2.5-6 2.5 6"/>', person: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 0 1 4.86.83c0 1.67-2.46 2.3-2.46 3.7"/><path d="M12 17h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 6.2l1.7 1.7M18.1 16.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 17.8l1.7-1.7M18.1 7.9l1.7-1.7"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18.5z"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>', steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
    folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>', chess: '<path d="M9 20.5h6M8 17.5h8l-1-6h-6zM9.5 11.5 8 8l2.2 1L12 6l1.8 3L16 8l-1.5 3.5"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>', timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    stats: '<path d="M5 20V11M12 20V5M19 20v-7"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    books: '<path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1-3.6 14.5-3.8-1"/>', bolt: '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>'
  };
  const svg = (n, s, w) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="${w || 1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const WORK_URL = 'https://drive.google.com/drive/folders/15yMPz8UIFLLkCH5eXZzvGe9hAbR88Cin';

  /* ---------- feature registry ---------- */
  const GROUPS = {
    lab: [['diag', 'Diagnose'], ['body', 'Body & imaging'], ['pharm', 'Pharm & science']],
    more: [['make', 'Make cards'], ['review', 'Review smarter'], ['focus', 'Focus'], ['you', 'You']]
  };
  const PLACE = {
    diag: ['sim', 'doc', 'ddx', 'labs', 'vit', 'soap', 'neuro', 'lesion', 'code', 'ecg', 'heart', 'lung'],
    body: ['anat', 'scan', 'atlas', 'spot', 'speed', 'histo', 'derm', 'surg', 'inst'],
    pharm: ['druglab', 'match', 'receptor', 'rx', 'pk', 'bugs', 'pun', 'words', 'history'],
    make: ['add', 'ocr', 'occl', 'pbook', 'anki'],
    review: ['daily', 'hands', 'mnemo', 'vn', 'fc', 'plan', 'badges'],
    focus: ['focus', 'amb'],
    you: ['me', 'customize', 'themes', 'share', 'prefs', 'sync', 'help', 'about', 'work']
  };
  const EXTRA = {
    doc: { title: 'Doctordle', sub: "Guess the diagnosis: today's case + 6-clue rounds", icn: 'steth', open: () => go('doc'), keys: 'diagnosis guess case daily wordle dle clues' },
    anat: { title: 'Anatomy 3D', sub: 'Spin, zoom and tap a 3D body and brain', icn: 'body', open: () => go('anat'), keys: 'body 3d model brain organs skeleton muscles' },
    rx: { title: 'Interactions game', sub: 'Spot the drug interaction, beat your 60s best', icn: 'pill', open: () => XView.open('rx'), keys: 'drug interaction rx game pharmacology' },
    add: { title: 'Add a card', sub: 'Type a new flashcard', icn: 'plus', open: () => go('add'), keys: 'new card create flashcard' },
    me: { title: 'Me', sub: 'Your profile', icn: 'person', href: 'https://odin-cards.sites.tab.bot/me/', keys: 'profile account me', when: () => !window.ODIN_STORE },
    customize: { title: 'Customize', sub: 'Home blocks, layout, theme and colors', icn: 'gear', open: () => { if (window.Layout) Layout.customize('home'); }, keys: 'customize layout look theme themes colors colours home blocks drawer menu tabs navigation appearance style', when: () => !!window.Layout },
    help: { title: 'Help & feedback', sub: 'Questions, send a bug or idea, replay the intro', icn: 'help', open: () => { if (window.SettingsUI) SettingsUI.open('help'); }, keys: 'help faq feedback bug idea support question tour intro' },
    about: { title: 'About', sub: 'Version, credits & licenses, privacy', icn: 'info', open: () => { if (window.SettingsUI) SettingsUI.open('about'); }, keys: 'about version credits licenses license privacy made by' },
    prefs: { title: 'Settings', sub: 'Appearance, study, voices, notifications', icn: 'gear', open: () => { if (window.SettingsUI && SettingsUI.open) SettingsUI.open(); else go('prefs'); }, keys: 'settings preferences options config dark mode text size' },
    sync: { title: 'Sync & backup', sub: () => (typeof meta !== 'undefined' && meta.code ? 'Synced across your devices' : 'Not synced yet') + ' · import · export', icn: 'cloud', open: () => go('settings'), keys: 'sync code backup import export csv json devices' },
    work: { title: "Tab's Work", sub: 'Google Drive folder', icn: 'folder', href: WORK_URL, ext: true, keys: 'drive google files work folder', when: () => !window.ODIN_STORE }
  };
  const SYN = { ecg: 'ekg rhythm electrocardiogram heart monitor', themes: 'theme themes colors colour dark light fonts appearance background', share: 'share link deck friends', fc: 'forecast reviews upcoming calendar', vn: 'voice notes recording', amb: 'sounds ambient rain noise music white brown', focus: 'pomodoro timer focus', daily: 'daily challenge best score', badges: 'badges level xp achievements', plan: 'exam planner test date', anki: 'anki import apkg colpkg', ocr: 'camera photo snap scan text page', occl: 'image occlusion diagram labels', pbook: 'pharm book pharmacology', hands: 'hands free audio voice review', mnemo: 'mnemonics memory hooks', sim: 'patient simulator case history exam', ddx: 'differential diagnosis', labs: 'lab values cbc bmp abg lft blood', vit: 'vitals blood pressure heart rate map news2 qsofa', soap: 'soap note', neuro: 'neurology exam reflexes cranial nerves', lesion: 'lesion localization brain', code: 'code blue acls cpr arrest', heart: 'heart sounds murmurs stethoscope', lung: 'lung sounds wheeze crackles', scan: 'ct mri imaging radiology', atlas: 'brain atlas mri slices', spot: 'spot the difference imaging', speed: 'anatomy speed run brain parts', histo: 'histology microscope tissue', derm: 'dermatology rash skin', surg: 'surgery steps neurosurgery craniotomy', inst: 'surgical instruments tools', druglab: 'drug lab invent trials approval', match: 'drug class mechanism', receptor: 'receptor drug target', pk: 'pharmacokinetics half life', bugs: 'microbiology bacteria microbe', pun: 'genetics punnett', words: 'medical terminology prefixes roots', history: 'medicine history timeline' };
  function feat(id) {
    const x = EXTRA[id]; if (x && x.when && !x.when()) return null; if (x) return Object.assign({ id }, x, { sub: typeof x.sub === 'function' ? x.sub() : x.sub });
    const F = window.Lab && Lab.F && Lab.F[id]; if (!F) return null;
    return { id, title: F.title, sub: F.sub, lic: F.ic, open: () => Lab.open(id), keys: SYN[id] || '' };
  }
  function iconOf(f, s) { if (!f) return svg('bolt', s); if (f.lic && window.Lab && Lab.ic) return Lab.ic(f.lic, s); return svg(f.icn || 'bolt', s); }
  function groupOf(id) { for (const g in PLACE) if (PLACE[g].includes(id)) return g; return null; }
  function hubOf(id) { const g = groupOf(id); if (!g) return null; return GROUPS.lab.some(x => x[0] === g) ? 'lab' : 'more'; }
  function list(hub) {
    const out = GROUPS[hub].map(([g, name]) => ({ g, name, items: PLACE[g].map(feat).filter(Boolean) }));
    // anything registered in the Lab that this map doesn't place still shows up (nothing gets lost)
    if (window.Lab && Lab.F) { const placed = new Set(Object.values(PLACE).flat().concat(['dle'])); const left = Object.keys(Lab.F).filter(k => !placed.has(k) && Lab.F[k].ready && (Lab.F[k].hub === 'lab' ? hub === 'lab' : hub === 'more')); if (left.length) out.push({ g: 'other', name: 'Other', items: left.map(feat).filter(Boolean) }); }
    return out;
  }
  function open(id) {
    const f = feat(id); if (!f) return;
    if (f.href) { if (f.ext) window.open(f.href, '_blank', 'noopener'); else location.href = f.href; return; }
    try { f.open(); } catch (e) { console.warn(e); }
  }

  /* ---------- recents (Home "Jump back in") ---------- */
  const RK = 'shell.recent.v1';
  const recent = () => { try { return (JSON.parse(localStorage.getItem(RK) || '[]') || []).filter(id => feat(id)); } catch (e) { return []; } };
  function remember(id) { if (!id || !feat(id) || id === 'prefs' || id === 'sync') return; const r = [id, ...recent().filter(x => x !== id)].slice(0, 8); try { localStorage.setItem(RK, JSON.stringify(r)); } catch (e) {} }

  /* ---------- hubs (Lab, More) ---------- */
  const HUB = { lab: { title: 'Lab', ph: 'Search Lab tools', foot: 'For learning only, not medical advice. Teaching cases and drug classes only, no doses. Ask a doctor or pharmacist about real health questions.' }, more: { title: 'More', ph: 'Search tools and settings', foot: '' } };
  const hubState = { lab: { q: '', g: 'all' }, more: { q: '', g: 'all' } };
  function rowHTML(f) {
    let b = null; try { b = window.Lab && Lab.F && Lab.F[f.id] && Lab.best ? Lab.best(f.id) : null; } catch (e) {}
    const inner = `<span class="sh-ic">${iconOf(f, 19)}</span><span class="sh-rt"><span class="sh-t1">${esc(f.title)}</span><span class="sh-t2">${esc(f.sub || '')}</span></span>${b != null ? `<span class="sh-best">${esc(b)}</span>` : ''}<span class="sh-chev">${svg(f.ext ? 'ext' : 'chev', 15, 2.2)}</span>`;
    const hay = esc((f.title + ' ' + (f.sub || '') + ' ' + (f.keys || '') + ' ' + (SYN[f.id] || '')).toLowerCase());
    return f.href ? `<a class="sh-row" data-sh-feat="${f.id}" data-hay="${hay}" href="${esc(f.href)}"${f.ext ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<button class="sh-row" type="button" data-sh-open="${f.id}" data-hay="${hay}">${inner}</button>`;
  }
  function hubHTML(hub) {
    const H = HUB[hub], st = hubState[hub], groups = list(hub);
    return `<div class="sh-hub" data-sh-hub="${hub}">
      <label class="sh-find">${svg('search', 17, 2.2)}<input type="search" data-sh-filter="${hub}" placeholder="${H.ph}" value="${esc(st.q)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="${H.ph}"></label>
      <div class="sh-chips" role="tablist">${[['all', 'All']].concat(groups.map(x => [x.g, x.name])).map(([g, n]) => `<button type="button" role="tab" class="sh-chip${st.g === g ? ' on' : ''}" aria-selected="${st.g === g}" data-sh-chip="${g}">${esc(n)}</button>`).join('')}</div>
      ${groups.map(x => `<section class="sh-grp" data-g="${x.g}"><h3 class="sh-gh">${esc(x.name)}<span>${x.items.length}</span></h3><div class="sh-list">${x.items.map(rowHTML).join('')}</div></section>`).join('')}
      <div class="sh-none" hidden>Nothing matches. Try the search button up top to look through cards and lessons too.</div>
      ${H.foot ? `<p class="sh-foot">${H.foot}</p>` : ''}</div>`;
  }
  function applyFilter(root) {
    const hub = root.dataset.shHub, st = hubState[hub], q = st.q.trim().toLowerCase(); let any = false;
    root.querySelectorAll('.sh-grp').forEach(sec => {
      let n = 0; const okG = st.g === 'all' || st.g === sec.dataset.g || q;
      sec.querySelectorAll('.sh-row').forEach(r => { const hit = !q || q.split(/\s+/).every(w => r.dataset.hay.includes(w)); r.hidden = !hit; if (hit) n++; });
      sec.hidden = !okG || !n; if (!sec.hidden) any = true; const cnt = sec.querySelector('.sh-gh span'); if (cnt) cnt.textContent = n;
    });
    root.querySelectorAll('.sh-chip').forEach(c => { const on = !q && c.dataset.shChip === st.g; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
    const none = root.querySelector('.sh-none'); if (none) none.hidden = any;
  }
  function renderHub(hub, el) { curMod = hub === 'lab' ? 'lab' : 'tools'; el.innerHTML = hubHTML(hub); applyFilter(el.firstElementChild); window.scrollTo(0, 0); }
  function registerHubs() {
    if (!window.XView || !XView.MODS) return;
    XView.MODS.lab = { title: 'Lab', render: el => renderHub('lab', el) };
    XView.MODS.tools = { title: 'More', render: el => renderHub('more', el) };
  }

  /* ---------- stack + tabs ---------- */
  const TABS = [['home', 'Home', 'home'], ['study', 'Study', 'study'], ['learn', 'Learn', 'learn'], ['lab', 'Lab', 'lab'], ['more', 'More', 'more']];
  const ROOT = { home: { v: 'home' }, study: { v: 'decks' }, learn: { v: 'learn' }, lab: { v: 'x', m: 'lab' }, more: { v: 'x', m: 'tools' } };
  const SEGV = { decks: 'study', weak: 'study', browse: 'study', stats: 'study', learn: 'learn', library: 'learn' };
  let tab = 'home', stack = [{ v: 'home' }], restoring = 0, curMod = null, pendingMod = null;
  const cv = () => (typeof view !== 'undefined' ? view : 'home');
  const now = () => cv() === 'x' ? { v: 'x', m: curMod } : { v: cv() };
  const same = (a, b) => a && b && a.v === b.v && (a.v !== 'x' || a.m === b.m);
  function rootTabOf(e) { if (e.v === 'home') return 'home'; if (SEGV[e.v]) return SEGV[e.v]; if (e.v === 'x' && e.m === 'lab') return 'lab'; if (e.v === 'x' && e.m === 'tools') return 'more'; return null; }
  function titleOf(e) {
    if (!e) return '';
    if (e.v === 'x') { if (e.m === 'lab') return 'Lab'; if (e.m === 'tools') return 'More'; const m = window.XView && XView.MODS[e.m]; return (m && m.title) || 'Back'; }
    return ({ home: 'Home', decks: 'Study', weak: 'Study', browse: 'Study', stats: 'Study', learn: 'Learn', library: 'Learn', doc: 'Doctordle', anat: 'Anatomy', study: 'Study', add: 'Add card', settings: 'Sync & backup', prefs: 'Settings' })[e.v] || 'Back';
  }
  function onNav(pre) {
    if (restoring) return; const e = pre || now(), top = stack[stack.length - 1];
    if (same(e, top)) return;
    const rt = rootTabOf(e);
    if (rt) { tab = rt; stack = [e]; }
    else { const i = stack.findIndex(x => same(x, e)); if (i >= 0) stack = stack.slice(0, i + 1); else stack.push(e); }
    if (e.v === 'x' && e.m && e.m !== 'lab' && e.m !== 'tools') remember(e.m); else if (e.v === 'doc' || e.v === 'anat') remember(e.v);
  }
  function restore(e) { restoring++; try { if (e.v === 'x') XView.open(e.m); else go(e.v); } finally { restoring--; } paint(); }
  function switchTab(k) {
    stopSpeak();
    tab = k; const r = ROOT[k];
    if (k === 'learn' && window.Learn && Learn._S && Learn._S.route) Learn._S.route = { page: 'home' };
    stack = [r]; restore(r); window.scrollTo(0, 0);
    try { if (window.Prefs && Prefs.haptic) Prefs.haptic(); } catch (e) {}
  }
  // in-module steps: Learn's own back row and a Lab tool's own back row (same tool) take precedence over the stack
  function innerBack() {
    const v = cv();
    if (v === 'x') { const b = $('#v-x .lb-back'); if (b && b.dataset.labHub === curMod) { const s = b.querySelector('span'); return { el: b, label: (s && s.textContent.trim()) || 'Back' }; } return null; }
    const host = document.getElementById('v-' + v); if (!host || v === 'prefs') return null;
    const b = host.querySelector('.lback'); if (b) return { el: b, label: b.textContent.replace(/^\s*‹\s*/, '').trim() || 'Back' };
    return null;
  }
  function canBack() { return !!innerBack() || stack.length > 1; }
  function backLabel() { const ib = innerBack(); return ib ? ib.label : stack.length > 1 ? titleOf(stack[stack.length - 2]) : ''; }
  function back() {
    const ib = innerBack(); if (ib) { ib.el.click(); setTimeout(paint, 0); return true; }
    if (stack.length > 1) { stopSpeak(); stack.pop(); restore(stack[stack.length - 1]); return true; }
    return false;
  }
  function stopSpeak() { try { if (cv() === 'x' && curMod === 'speak' && window.Speak) Speak.stop(); } catch (e) {} }

  /* ---------- header + tab bar ---------- */
  function buildChrome() {
    const top = $('header.top'); if (top && !top.dataset.sh) {
      top.dataset.sh = '1';
      const old = $('#homeBtn'); if (old) old.remove();
      const brand = top.querySelector('.brand');
      brand.insertAdjacentHTML('afterbegin', `<button id="shBack" class="sh-back" type="button" hidden>${svg('back', 22, 2.4)}<span></span></button>`);
      const tr = top.querySelector('.topr');
      tr.insertAdjacentHTML('afterbegin', `<button id="shAct" class="sh-hbtn" type="button" hidden></button><button class="sh-hbtn" type="button" data-search-open aria-label="Search">${svg('search', 22, 2.1)}</button>`);
      top.insertAdjacentHTML('beforeend', `<div class="sh-seg" id="shSeg" hidden role="tablist"></div>`);
      top.addEventListener('click', e => {
        if (e.target.closest('#shBack')) { back(); return; }
        const a = e.target.closest('#shAct'); if (a && a.dataset.go) { go(a.dataset.go); return; }
        const s = e.target.closest('[data-sh-seg]'); if (s) { segGo(s.dataset.shSeg); }
      });
    }
    const tabs = $('#tabs'); if (tabs && !tabs.dataset.sh) {
      tabs.dataset.sh = '1'; tabs.classList.add('sh-tabs'); tabs.setAttribute('role', 'tablist');
      tabs.innerHTML = TABS.map(([k, n, ic]) => `<button type="button" role="tab" data-sh-tab="${k}" aria-label="${n}"><span class="ic">${svg(ic, 25, 1.9)}</span><span class="tl">${n}</span><i class="sh-dot" hidden></i></button>`).join('');
      tabs.addEventListener('click', e => { const b = e.target.closest('[data-sh-tab]'); if (b) switchTab(b.dataset.shTab); });
    }
  }
  const SEGS = { study: [['decks', 'Decks'], ['weak', 'Weak'], ['browse', 'Browse'], ['stats', 'Stats']], learn: [['learn', 'Courses'], ['library', 'Library']] };
  function segGo(v) {
    if (v === 'learn' && window.Learn && Learn._S) Learn._S.route = { page: 'home' };
    if (v === 'library' && window.Resources && Resources._S && !Resources._S.mode) Resources._S.mode = 'decks';
    go(v);
  }
  let pt = 0;
  function paint() {
    buildChrome();
    const v = cv(), e = now(), B = document.body;
    const ib = innerBack(), bk = $('#shBack');
    const seg = SEGV[v] && stack.length === 1 && !ib ? SEGV[v] : null;
    if (bk) { const show = !!ib || stack.length > 1; bk.hidden = !show; bk.querySelector('span').textContent = ib ? ib.label : show ? titleOf(stack[stack.length - 2]) : ''; bk.setAttribute('aria-label', 'Back to ' + bk.querySelector('span').textContent); }
    const tl = $('#title'); if (tl) { if (v === 'x') tl.textContent = titleOf(e); else if (SEGV[v] && stack.length === 1) tl.textContent = titleOf(e); B.classList.toggle('sh-dupe', !!bk && !bk.hidden && bk.querySelector('span').textContent.trim() === tl.textContent.trim()); }
    const sg = $('#shSeg'); if (sg) { sg.hidden = !seg; if (seg) sg.innerHTML = `<div class="sh-segc">${SEGS[seg].map(([k, n]) => `<button type="button" role="tab" data-sh-seg="${k}" class="${k === v ? 'on' : ''}" aria-selected="${k === v}">${n}${k === 'weak' && window.Weak && Weak.dueCount() ? `<i class="sh-cnt">${Math.min(99, Weak.dueCount())}</i>` : ''}</button>`).join('')}</div>`; }
    const act = $('#shAct'); if (act) { const study = SEGV[v] === 'study' && stack.length === 1; act.hidden = !study; if (study) { act.dataset.go = 'add'; act.innerHTML = svg('plus', 24, 2.1); act.setAttribute('aria-label', 'Add card'); } }
    B.classList.toggle('sh-sub', stack.length > 1 || !!ib);
    B.classList.toggle('sh-hide-tabs', v === 'study' || v === 'anat');
    B.classList.toggle('sh-segon', !!seg);
    B.classList.toggle('sh-largeTitle', (v === 'x' && !!$('#v-x .lb-title, #v-x .lb-head h2')) || (v === 'doc' && !!$('#v-doc .doc-hero h2')));
    document.querySelectorAll('#tabs [data-sh-tab]').forEach(b => { const on = b.dataset.shTab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    onScroll();
    if (v === 'anat') { clearTimeout(paint.rz); paint.rz = setTimeout(() => { try { const hb = Math.round($('header.top').getBoundingClientRect().bottom); if (hb !== paint.hb) { paint.hb = hb; window.dispatchEvent(new Event('resize')); } } catch (er) {} }, 30); } else paint.hb = -1;
  }
  function paintSoon() { clearTimeout(pt); pt = setTimeout(paint, 60); }
  function onScroll() { document.body.classList.toggle('sh-scrolled', window.scrollY > 36); }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- wire into go() / XView ---------- */
  function wrap() {
    if (typeof window.go === 'function' && !window.go._sh) {
      const og = window.go;
      window.go = function (v) { if (!restoring && v !== cv() && !(v === 'x')) stopSpeak(); try { if (typeof v === 'string' && (v !== 'x' || curMod)) onNav(v === 'x' ? { v: 'x', m: curMod } : { v }); } catch (e) { console.warn(e); } const r = og.apply(this, arguments); try { onNav(); paint(); } catch (e) { console.warn(e); } return r; };
      window.go._sh = 1; try { go = window.go; } catch (e) {}
    }
    if (window.XView && !XView.open._sh) {
      const oo = XView.open;
      XView.open = function (n) { if (n !== curMod) stopSpeak(); curMod = n; return oo.apply(this, arguments); };
      XView.open._sh = 1;
    }
    if (window.Lab && Lab.register && !Lab.register._sh) { const orr = Lab.register; Lab.register = function () { const r = orr.apply(this, arguments); registerHubs(); return r; }; Lab.register._sh = 1; }
    registerHubs();
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-sh-open]'); if (o) { e.preventDefault(); open(o.dataset.shOpen); return; }
    const c = e.target.closest('[data-sh-chip]'); if (c) { const root = c.closest('[data-sh-hub]'); const st = hubState[root.dataset.shHub]; st.g = c.dataset.shChip; st.q = ''; const inp = root.querySelector('[data-sh-filter]'); if (inp) inp.value = ''; applyFilter(root); c.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); return; }
    const a = e.target.closest('a[data-sh-feat]'); if (a) remember(a.dataset.shFeat);
  });
  document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('[data-sh-filter]'); if (!f) return; const root = f.closest('[data-sh-hub]'); hubState[root.dataset.shHub].q = f.value; applyFilter(root); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.querySelector('.srch, #sheetWrap:not([hidden])') && canBack()) back(); });

  // features for global search
  function searchDocs() {
    const docs = [];
    for (const hub of ['lab', 'more']) for (const g of list(hub)) for (const f of g.items) docs.push({ id: f.id, title: f.title, sub: (hub === 'lab' ? 'Lab' : 'More') + ' · ' + g.name, keys: (f.sub || '') + ' ' + (f.keys || '') + ' ' + (SYN[f.id] || '') });
    const NAV = [['nav:home', 'Home', 'Today: due cards, streak, plan', 'today dashboard start'], ['nav:decks', 'Decks', 'Study · your decks', 'cards study review flashcards'], ['nav:weak', 'Weak spots', 'Study · cards and questions you keep missing', 'mistakes missed weak'], ['nav:browse', 'Browse cards', 'Study · find and edit cards', 'edit list all cards'], ['nav:stats', 'Stats', 'Study · XP, streak, retention', 'statistics progress charts history'], ['nav:learn', 'Courses', 'Learn · 350 courses', 'courses lessons learn'], ['nav:library', 'Library', 'Learn · decks, textbooks, videos, PDFs, games', 'deck library resources textbooks videos pdf games'], ['nav:lab', 'Lab', 'Doctor Lab: every tool', 'doctor lab tools'], ['nav:more', 'More', 'Study tools, settings, you', 'tools more']];
    for (const [id, t, s, k] of NAV) docs.push({ id, title: t, sub: s, keys: k });
    return docs;
  }
  function openDoc(id) {
    if (id.startsWith('nav:')) { const k = id.slice(4); if (k === 'lab' || k === 'more' || k === 'home') return switchTab(k === 'more' ? 'more' : k); if (k === 'learn' || k === 'library') { segGo(k); return; } return go(k); }
    open(id);
  }
  function icon(id, s) { if (id && id.startsWith('nav:')) { const k = id.slice(4); return svg({ home: 'home', decks: 'study', weak: 'target', browse: 'list', stats: 'stats', learn: 'learn', library: 'books', lab: 'lab', more: 'more' }[k] || 'bolt', s); } return iconOf(feat(id), s); }

  // open the Lab or More hub on one group (the side menu's group rows)
  function openHub(hub, g) { const st = hubState[hub]; if (st) { st.g = g || 'all'; st.q = ''; } switchTab(hub === 'lab' ? 'lab' : 'more'); }
  const boot = () => {
    wrap(); buildChrome();
    stack = [now()]; tab = rootTabOf(stack[0]) || 'home';
    paint();
    new MutationObserver(paintSoon).observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.Shell = { back, canBack, backLabel, open, openDoc, openHub, switchTab, feat, list, recent, remember, icon, iconOf, searchDocs, paint, svg, get tab() { return tab; }, get stack() { return stack.slice(); }, get mod() { return curMod; } };
})();
