/* Layout + Customize (feat/layout/layout.js, v111). The navigation engine, the block-built home and the Customize screen.
   One state object (localStorage 'layout.v1', synced through the app's record sync as progress record id 'layout') holds:
   nav style, tabs, home blocks, theme, custom themes, accent, text size, corners, density, menu group order.
   Every nav style is data (NAV below) read by one engine: bar (bottom/top/edge/dock...), menu (drawer/sheet/full...),
   menu content (groups/fold/columns/search/grid/list), trigger (header, floating button, title), rail.
   window.Layout = { state, set, open(menuKind), close, customize(section), home(el), NAV, BLOCKS, reset } */
(function () {
  'use strict';
  if (window.Layout || !window.LT) return;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const de = document.documentElement, KEY = LT.KEY;
  const P = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
    grip: '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>', brush: '<path d="M14 4 20 10l-7.5 7.5-6-6z"/><path d="M6.5 11.5 4 14c-1 1-1 4 0 5s4 1 5 0l2.5-2.5"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.5 2 3 0-3 0-5.5.5-8z"/>', ring: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', chev: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'
  };
  const ic = (n, s, w) => P[n] ? `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="${w || 1.9}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>` : (window.Shell && Shell.svg ? Shell.svg(n, s, w) : '');
  const toast = m => { try { if (typeof window.toast === 'function') window.toast(m, 2200); } catch (e) {} };
  const haptic = () => { try { if (window.Prefs && Prefs.haptic) Prefs.haptic(); } catch (e) {} };
  const curView = () => (typeof view !== 'undefined' ? view : 'home');

  /* ---------- places the bars, rail and quick menus can point at ---------- */
  const TG = {
    home: ['Today', 'home', () => Shell.switchTab('home')],
    study: ['Study', 'study', () => Shell.switchTab('study')],
    learn: ['Learn', 'learn', () => Shell.switchTab('learn')],
    lab: ['Lab', 'lab', () => Shell.switchTab('lab')],
    more: ['More', 'more', () => Shell.switchTab('more')],
    library: ['Library', 'books', () => Shell.openDoc('nav:library')],
    stats: ['Progress', 'stats', () => Shell.openDoc('nav:stats')],
    weak: ['Weak', 'target', () => Shell.openDoc('nav:weak')],
    doc: ['Doctordle', 'steth', () => go('doc')],
    daily: ['Daily', 'timer', () => Shell.open('daily')],
    search: ['Search', 'search', () => { if (window.Search) Search.open(); }],
    review: ['Review', 'play', () => startReview()],
    menu: ['Menu', 'menu', () => openMenu()],
    you: ['You', 'person', () => openMenu()],
    explore: ['Explore', 'compass', () => openMenu()],
    customize: ['Customize', 'brush', () => customize()]
  };
  const TAB_CHOICES = ['home', 'study', 'learn', 'lab', 'library', 'stats', 'weak', 'doc', 'daily', 'search', 'review', 'more', 'menu'];
  function startReview() { try { studyDeck = '*'; undoStack = []; } catch (e) {} go('study'); }
  function activeKey() {
    const v = curView(), m = window.Shell ? Shell.mod : null;
    if (v === 'home') return 'home';
    if (v === 'library') return 'library'; if (v === 'stats') return 'stats'; if (v === 'weak') return 'weak'; if (v === 'doc') return 'doc';
    if (['decks', 'browse', 'study', 'add'].includes(v)) return 'study';
    if (v === 'learn') return 'learn';
    if (v === 'x') { if (m === 'lab') return 'lab'; if (m === 'tools') return 'more'; if (m === 'daily') return 'daily'; if (m === 'customize') return 'customize'; const t = window.Shell && Shell.tab; return t === 'lab' ? 'lab' : t === 'more' ? 'more' : ''; }
    return '';
  }
  // a style's target that has no exact screen lights up its parent
  function isOn(k, act, keys) { if (k === act) return true; if (keys.includes(act)) return false; return (k === 'study' && ['weak', 'stats'].includes(act)) || (k === 'learn' && act === 'library') || ((k === 'menu' || k === 'you' || k === 'explore' || k === 'more') && ['more', 'customize', 'daily'].includes(act) && !keys.includes('more')); }

  /* ---------- nav styles (data; one engine draws all of them) ---------- */
  // bar: tabs | text | fab | dock | pill | top | seg | edge | head | handle ; menu: drawer | drawer-r | full | sheet | grid | palette | dropdown | speed | radial
  // content: groups | fold | cols | search | list | grid ; trig: left | right | title | fab | fab-l | fab-c ; rail: icons | labels ; crumbs ; home: suggested blocks
  const NAV = [
    { id: '03a', fam: 'Side drawer', name: 'Drawer, colored sections', desc: 'Menu button opens five colored groups with counts.', menu: 'drawer', content: 'groups', trig: 'left', home: ['hero', 'daily:s', 'doc:s'] },
    { id: '03b', fam: 'Side drawer', name: 'Drawer + 3 tabs', desc: 'Today, Study and Lab at the bottom; Menu opens the drawer.', bar: 'tabs', tabs: ['home', 'study', 'lab', 'menu'], menu: 'drawer', content: 'groups', home: ['hero', 'continue', 'weak:s', 'daily:s'] },
    { id: '03c', fam: 'Side drawer', name: 'Icon rail', desc: 'A thin rail of icons stays on the left; the top button opens the menu.', rail: 'icons', tabs: ['home', 'study', 'learn', 'lab', 'doc', 'stats'], menu: 'drawer', content: 'groups', home: ['review', 'xp'] },
    { id: '03d', fam: 'Side drawer', name: 'Drawer with search', desc: 'The menu opens on a search box and your recent places.', menu: 'drawer', content: 'search', trig: 'left', home: ['hero', 'recent'] },
    { id: '03e', fam: 'Side drawer', name: 'Folding groups', desc: 'Groups fold open; every tool is listed inside.', menu: 'drawer', content: 'fold', trig: 'left', home: ['checklist', 'hero:s', 'streak:s'] },
    { id: '03f', fam: 'Side drawer', name: 'Full-screen menu', desc: 'The menu covers the screen in two columns.', menu: 'full', content: 'cols', trig: 'left', home: ['ring', 'review'] },
    { id: '01', fam: 'Concepts', name: 'Four tabs', desc: 'Today, Study, Lab and You at the bottom.', bar: 'tabs', tabs: ['home', 'study', 'lab', 'you'], menu: 'full', content: 'cols', home: ['hero', 'decks'] },
    { id: '02', fam: 'Concepts', name: 'Six tiles', desc: 'No tab bar. Home is six big tiles.', menu: 'grid', content: 'grid', trig: 'left', home: ['tiles'] },
    { id: '03', fam: 'Concepts', name: 'Drawer, calm home', desc: 'Home shows today; one plain menu holds the rest.', menu: 'drawer', content: 'list', trig: 'left', home: ['hero'] },
    { id: '04', fam: 'Concepts', name: 'Search first', desc: 'A search box on home and three tabs.', bar: 'tabs', tabs: ['home', 'study', 'search', 'menu'], menu: 'palette', content: 'search', home: ['search', 'hero', 'recent'] },
    { id: '05', fam: 'Concepts', name: 'Today checklist', desc: 'Home is today’s steps; Browse holds everything else.', bar: 'tabs', tabs: ['home', 'menu'], labels: { menu: 'Browse' }, menu: 'sheet', content: 'fold', home: ['checklist'] },
    { id: '06', fam: 'Concepts', name: 'Study, Library, Progress', desc: 'A switch at the top replaces the tab bar.', bar: 'seg', tabs: ['home', 'study', 'library', 'stats'], menu: 'drawer', content: 'groups', trig: 'left', home: ['hero', 'decks'] },
    { id: '07', fam: 'Concepts', name: 'Center review button', desc: 'Four tabs and a big review button in the middle.', bar: 'fab', tabs: ['home', 'learn', 'review', 'lab', 'menu'], menu: 'sheet', content: 'groups', home: ['hero:s', 'streak:s', 'decks'] },
    { id: '08', fam: 'Concepts', name: 'Study and Explore', desc: 'Two modes at the top: review, or explore everything.', bar: 'seg', tabs: ['home', 'explore'], labels: { home: 'Study' }, menu: 'full', content: 'cols', home: ['hero', 'continue'] },
    { id: '09', fam: 'Concepts', name: 'Contents page', desc: 'Home is a contents list; tabs on the edge switch sections.', bar: 'edge', tabs: ['home', 'study', 'learn', 'lab', 'you'], menu: 'full', content: 'cols', home: ['contents'] },
    { id: '10', fam: 'Concepts', name: 'Pull-up sheet', desc: 'A goal ring and one button; pull up for everything.', bar: 'handle', menu: 'sheet', content: 'grid', home: ['ring', 'review'] },
    { id: 'x01', fam: 'More styles', name: 'Top tab strip', desc: 'Scrollable sections under the title.', bar: 'top', tabs: ['home', 'study', 'learn', 'lab', 'library', 'stats', 'you'], menu: 'drawer', content: 'groups', home: ['hero', 'decks'] },
    { id: 'x02', fam: 'More styles', name: 'Floating button', desc: 'A round button opens a quick list of places.', trig: 'fab', menu: 'speed', content: 'list', home: ['hero', 'daily:s', 'weak:s'] },
    { id: 'x03', fam: 'More styles', name: 'Radial menu', desc: 'A center button fans out your main places.', trig: 'fab-c', menu: 'radial', content: 'groups', tabs: ['study', 'learn', 'lab', 'doc', 'stats'], home: ['hero', 'labs'] },
    { id: 'x04', fam: 'More styles', name: 'Dock', desc: 'A floating dock of icons.', bar: 'dock', tabs: ['home', 'study', 'learn', 'lab', 'menu'], menu: 'sheet', content: 'grid', home: ['hero', 'heatmap'] },
    { id: 'x05', fam: 'More styles', name: 'Right drawer', desc: 'The menu slides in from the right.', menu: 'drawer-r', content: 'groups', trig: 'right', home: ['hero', 'daily:s', 'doc:s'] },
    { id: 'x06', fam: 'More styles', name: 'Classic five tabs', desc: 'Today, Study, Learn, Lab and More, as before.', bar: 'tabs', tabs: ['home', 'study', 'learn', 'lab', 'more'], menu: 'drawer', content: 'groups', trig: 'left', home: ['hero', 'continue', 'labs'] },
    { id: 'x07', fam: 'More styles', name: 'Breadcrumbs', desc: 'The top shows where you are; tap a step to go back.', crumbs: true, menu: 'drawer', content: 'groups', trig: 'left', home: ['hero', 'recent'] },
    { id: 'x08', fam: 'More styles', name: 'Rail + tabs', desc: 'An icon rail plus three bottom tabs.', rail: 'icons', bar: 'tabs', tabs: ['home', 'study', 'lab'], railTabs: ['learn', 'library', 'doc', 'stats', 'search'], menu: 'drawer', content: 'groups', home: ['hero', 'decks'] },
    { id: 'x09', fam: 'More styles', name: 'Minimal', desc: 'No bars. Tap the title for the menu.', trig: 'title', menu: 'dropdown', content: 'list', home: ['hero'] },
    { id: 'x10', fam: 'More styles', name: 'Launcher grid', desc: 'The menu is a full screen of icons.', menu: 'grid', content: 'grid', trig: 'left', home: ['hero', 'labs'] },
    { id: 'x11', fam: 'More styles', name: 'Floating pill', desc: 'A small pill with three buttons.', bar: 'pill', tabs: ['home', 'study', 'menu'], menu: 'sheet', content: 'groups', home: ['hero', 'streak:s', 'xp:s'] },
    { id: 'x12', fam: 'More styles', name: 'Header icons', desc: 'Main places as icons in the header.', bar: 'head', tabs: ['home', 'study', 'learn', 'lab'], menu: 'drawer-r', content: 'groups', trig: 'right', home: ['hero', 'decks'] },
    { id: 'x13', fam: 'More styles', name: 'Command search', desc: 'One search window lists every screen and tool.', menu: 'palette', content: 'search', trig: 'right', home: ['search', 'hero'] },
    { id: 'x14', fam: 'More styles', name: 'One-hand', desc: 'A button in the bottom corner opens big targets near your thumb.', trig: 'fab-l', menu: 'sheet', content: 'grid', home: ['hero', 'review'] },
    { id: 'x15', fam: 'More styles', name: 'Labeled rail', desc: 'A rail with icons and names.', rail: 'labels', tabs: ['home', 'study', 'learn', 'lab', 'library', 'stats'], menu: 'drawer', content: 'fold', home: ['hero', 'continue'] },
    { id: 'x16', fam: 'More styles', name: 'Header switch', desc: 'Study, Learn, Lab and You as a switch at the top.', bar: 'seg', tabs: ['study', 'learn', 'lab', 'you'], menu: 'full', content: 'cols', trig: 'left', home: ['hero', 'decks'] },
    { id: 'x17', fam: 'More styles', name: 'Text tabs', desc: 'Bottom tabs with words only.', bar: 'text', tabs: ['home', 'study', 'learn', 'lab', 'menu'], menu: 'drawer', content: 'groups', home: ['hero', 'decks'] },
    { id: 'x18', fam: 'More styles', name: 'Corner menu', desc: 'A menu button in the bottom corner opens the drawer.', trig: 'fab-l', menu: 'drawer', content: 'groups', home: ['hero', 'labs'] },
    { id: 'x19', fam: 'More styles', name: 'Drop-down menu', desc: 'The menu drops down from the top.', menu: 'dropdown', content: 'groups', trig: 'left', home: ['hero', 'recent'] },
    { id: 'x20', fam: 'More styles', name: 'Tabs + drawer', desc: 'Four tabs plus a menu button in the header.', bar: 'tabs', tabs: ['home', 'study', 'learn', 'lab'], menu: 'drawer', content: 'groups', trig: 'left', home: ['hero', 'continue', 'decks'] }
  ];
  const NAVBY = Object.fromEntries(NAV.map(n => [n.id, n]));


  /* ---------- home blocks ---------- */
  const num = f => { try { return f(); } catch (e) { return 0; } };
  const dueN = () => num(() => window.Home && Home.dueCards ? Home.dueCards() : 0);
  const weakN = () => num(() => window.Weak ? Weak.dueCount() : 0);
  const streakN = () => num(() => Hub.streak());
  const todayH = () => { try { return Hub.today(); } catch (e) { return { xp: 0, goal: 50, pct: 0 }; } };
  const levelH = () => { try { return Hub.level(); } catch (e) { return { level: 1, pct: 0, into: 0, need: 100 }; } };
  const lastDeck = () => { try { const id = localStorage.getItem('lt.lastDeck'); const d = id && M.decks.get(id); return d && !d.del ? d : null; } catch (e) { return null; } };
  const lastLesson = () => { try { let b = null; for (const r of M.progress.values()) if (r && !r.del && r.ctitle && r.lid && (!b || (r.at || 0) > (b.at || 0))) b = r; return b; } catch (e) { return null; } };
  const dateLine = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const cardBtn = (act, inner, cls) => `<button type="button" class="lt-bk ${cls || ''}" data-lt-act="${act}">${inner}</button>`;
  const BLOCKS = {
    hero: { name: 'Due today', desc: 'Cards due, minutes, streak and a Start button', render: s => { const n = dueN(), t = todayH(), mins = Math.max(1, Math.round(n * 8 / 60));
      return s === 's' ? cardBtn('review', `<span class="lt-k">Due today</span><b class="lt-big1">${n}</b><small>${n ? 'About ' + mins + ' min' : 'All caught up'}</small>`)
        : `<div class="lt-hero"><div class="lt-k">${esc(dateLine())}</div><div class="lt-due">${n}</div><div class="lt-dl">${n === 1 ? 'card due' : 'cards due'}</div><div class="lt-mut">${n ? 'About ' + mins + ' min' : 'All caught up for now'}</div><div class="lt-chips"><span class="lt-chip">${ic('flame', 15, 2)} ${streakN()}-day streak</span><span class="lt-chip">${t.xp} / ${t.goal} XP today</span></div><button type="button" class="lt-cta" data-lt-act="review">${n ? 'Start review' : 'Study anyway'}</button></div>`; } },
    due: { name: 'Due count', desc: 'Just the number of cards due', render: () => cardBtn('review', `<span class="lt-k">Due</span><b class="lt-big1">${dueN()}</b><small>cards</small>`) },
    streak: { name: 'Streak', desc: 'Days in a row', render: () => cardBtn('stats', `<span class="lt-k">Streak</span><b class="lt-big1">${streakN()}</b><small>days in a row</small>`) },
    review: { name: 'Study button', desc: 'One big button to start reviewing', render: s => `<button type="button" class="lt-bigbtn" data-lt-act="review">${ic('play', 22, 2.2)}<span>Study now</span><small>${dueN()} due</small></button>` },
    daily: { name: 'Daily Challenge', desc: '12 cards in 90 seconds', render: () => { let b = null; try { b = Lab.best('daily'); } catch (e) {} return cardBtn('daily', `<span class="lt-k">Daily Challenge</span><b class="lt-t2">12 cards, 90 s</b><small>${b != null ? 'Best ' + esc(b) : 'Set your first score'}</small>`); } },
    doc: { name: 'Doctordle', desc: 'Today’s case', render: () => { const open = num(() => window.Doctordle && Doctordle.badge()); return cardBtn('doc', `<span class="lt-k">Doctordle</span><b class="lt-t2">${open ? 'Today’s case is ready' : 'Solved today'}</b><small>${open ? '6 clues' : 'Free play'}</small>`); } },
    continue: { name: 'Continue deck', desc: 'Pick up the last deck you studied', render: s => { const d = lastDeck(); let c = { n: 0, l: 0, r: 0 }; try { if (d) c = deckCounts(d.id); } catch (e) {}
      return d ? cardBtn('continue', `<span class="lt-k">Continue</span><b class="lt-t2">${esc(d.name)}</b><small>${c.n + c.l + c.r} due</small>`) : cardBtn('decks', `<span class="lt-k">Continue</span><b class="lt-t2">Your decks</b><small>Study a deck and it shows here</small>`); } },
    weak: { name: 'Weak cards', desc: 'Cards you keep missing', render: () => cardBtn('weak', `<span class="lt-k">Weak cards</span><b class="lt-big1">${weakN()}</b><small>to fix</small>`) },
    decks: { name: 'Deck list', desc: 'Your decks with due counts', render: () => { let ds = []; try { ds = decks().slice(0, 6); } catch (e) {}
      return `<div class="lt-panelb"><div class="lt-bh"><span class="lt-k">Decks</span><button type="button" class="lt-lnk" data-lt-act="decks">All</button></div>${ds.length ? ds.map(d => { let c = { n: 0, l: 0, r: 0 }; try { c = deckCounts(d.id); } catch (e) {} return `<button type="button" class="lt-li" data-lt-deck="${esc(d.id)}"><span>${esc(d.name)}</span><span class="lt-cnt"><i class="n">${c.n}</i><i class="l">${c.l}</i><i class="r">${c.r}</i></span></button>`; }).join('') : `<button type="button" class="lt-li" data-lt-act="library"><span>Get a deck from the library</span><span>${ic('chev', 15, 2.2)}</span></button>`}</div>`; } },
    course: { name: 'Course', desc: 'Continue your last course', render: () => { const l = lastLesson(); return cardBtn('learn', `<span class="lt-k">Course</span><b class="lt-t2">${esc(l ? l.ctitle : 'Medical courses')}</b><small>${esc(l ? 'Last: ' + l.title : 'Lessons with quizzes')}</small>`); } },
    heatmap: { name: 'Activity', desc: 'Last 15 weeks of study', render: () => { let days = {}; try { days = Hub._S().days || {}; } catch (e) {}
      const goal = todayH().goal || 50, W = 15, cells = []; const now = Date.now(), dk = t => { try { return Hub.dayKey(t); } catch (e) { return ''; } };
      for (let i = W * 7 - 1; i >= 0; i--) { const x = (days[dk(now - i * 864e5)] || {}).xp || 0; const lv = x <= 0 ? 0 : x < goal * .34 ? 1 : x < goal * .67 ? 2 : x < goal ? 3 : 4; cells.push(`<i class="h${lv}"></i>`); }
      return `<div class="lt-panelb" data-lt-act="stats"><div class="lt-bh"><span class="lt-k">Activity</span><span class="lt-mut">${streakN()}-day streak</span></div><div class="lt-heat">${cells.join('')}</div></div>`; } },
    xp: { name: 'XP and level', desc: 'Level progress and today’s goal', render: () => { const L = levelH(), t = todayH(); return cardBtn('stats', `<span class="lt-k">Level ${L.level}</span><div class="lt-bar2"><i style="width:${L.pct}%"></i></div><small>${t.xp} / ${t.goal} XP today</small>`); } },
    labs: { name: 'Lab shortcuts', desc: 'Your four favorite Lab tools', render: () => { const ids = (S.labTools || []).slice(0, 4);
      return `<div class="lt-panelb"><div class="lt-bh"><span class="lt-k">Lab</span><button type="button" class="lt-lnk" data-lt-act="lab">All tools</button></div><div class="lt-l4">${ids.map(id => { const f = Shell.feat(id); return f ? `<button type="button" class="lt-l4b" data-lt-tool="${esc(id)}"><span>${Shell.iconOf(f, 22)}</span><b>${esc(f.title)}</b></button>` : ''; }).join('')}</div></div>`; } },
    search: { name: 'Search box', desc: 'Find any deck, card, course or tool', render: () => `<button type="button" class="lt-searchb" data-search-open>${ic('search', 18, 2.2)}<span>Search decks, cards, courses, tools</span></button>` },
    recent: { name: 'Jump back in', desc: 'Places you opened lately', render: () => { const r = (Shell.recent() || []).slice(0, 4).map(id => Shell.feat(id)).filter(Boolean);
      return `<div class="lt-panelb"><div class="lt-bh"><span class="lt-k">Jump back in</span></div>${r.length ? r.map(f => `<button type="button" class="lt-li" data-lt-tool="${esc(f.id)}"><span class="lt-lii">${Shell.iconOf(f, 18)}</span><span>${esc(f.title)}</span>${ic('chev', 15, 2.2)}</button>`).join('') : '<p class="lt-mut lt-pad">Tools you open show up here.</p>'}</div>`; } },
    tiles: { name: 'Six tiles', desc: 'Big tiles for the main places', render: () => `<div class="lt-six">${[['decks', 'Study', 'study', dueN() + ' due'], ['learn', 'Learn', 'learn', 'Courses'], ['lab', 'Lab', 'lab', 'Tools'], ['doc', 'Doctordle', 'steth', 'Daily case'], ['library', 'Library', 'books', 'Decks'], ['stats', 'Progress', 'stats', streakN() + '-day streak']].map(([a, t, i, s], k) => `<button type="button" class="lt-six-b" data-lt-act="${a}" style="--c:var(--lt-g${k % 5 + 1})"><span>${ic(i, 26)}</span><b>${t}</b><small>${esc(s)}</small></button>`).join('')}</div>` },
    checklist: { name: 'Today checklist', desc: 'Today’s steps, in order', render: () => { const n = dueN(), w = weakN(); let dc = false; try { dc = !!(Lab.bestOf && Lab.result) && false; } catch (e) {} const docOpen = num(() => window.Doctordle && Doctordle.badge());
      const steps = [['review', 'Review due cards', n ? n + ' due' : 'Done', !n], ['weak', 'Fix weak cards', w ? w + ' left' : 'Done', !w], ['daily', 'Daily Challenge', '90 seconds', dc], ['doc', 'Doctordle', docOpen ? 'Today’s case' : 'Done', !docOpen], ['learn', 'One lesson', 'Courses', false]];
      return `<div class="lt-panelb"><div class="lt-bh"><span class="lt-k">Today</span><span class="lt-mut">${steps.filter(s => s[3]).length} of ${steps.length} done</span></div>${steps.map(([a, t, s, d], i) => `<button type="button" class="lt-step${d ? ' done' : ''}" data-lt-act="${a}"><span class="lt-sn">${d ? ic('check', 15, 2.6) : i + 1}</span><span class="lt-st"><b>${t}</b><small>${esc(s)}</small></span>${ic('chev', 15, 2.2)}</button>`).join('')}</div>`; } },
    contents: { name: 'Contents page', desc: 'Every section as a contents list', render: () => `<div class="lt-panelb lt-toc"><div class="lt-bh"><span class="lt-k">Contents</span></div>${groupsNow().filter(g => g.on).map((g, i) => `<button type="button" class="lt-li" data-lt-menu-g="${g.id}"><span class="lt-tocn" style="color:${g.color}">${i + 1}</span><span>${esc(g.name)}</span><span class="lt-dots"></span><span class="lt-mut">${(g.items || g.subs.flatMap(s => s.items)).length}</span></button>`).join('')}</div>` },
    ring: { name: 'Goal ring', desc: 'Today’s XP goal as a ring', render: () => { const t = todayH(), p = Math.min(100, t.pct || 0), C = 2 * Math.PI * 52;
      return `<div class="lt-ringb" data-lt-act="stats"><svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--fill2)" stroke-width="10"/><circle cx="60" cy="60" r="52" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * p / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/></svg><div class="lt-ringt"><b>${t.xp}</b><small>of ${t.goal} XP</small></div><div class="lt-mut">${dueN()} cards due · ${streakN()}-day streak</div></div>`; } }
  };
  const BLOCK_ORDER = ['hero', 'due', 'streak', 'review', 'daily', 'doc', 'continue', 'weak', 'decks', 'course', 'heatmap', 'xp', 'labs', 'search', 'recent', 'tiles', 'checklist', 'contents', 'ring'];
  const WIDE_ONLY = new Set(['decks', 'heatmap', 'labs', 'search', 'recent', 'tiles', 'checklist', 'contents', 'ring']);
  function blockHTML(b, i) {
    const B = BLOCKS[b.id]; if (!B) return ''; const sz = WIDE_ONLY.has(b.id) ? 'w' : b.size;
    let inner = ''; try { inner = B.render(sz, b.opt); } catch (e) { console.warn('block', b.id, e); inner = ''; }
    return `<div class="lt-blk lt-blk-${b.id} lt-sz-${sz}" data-i="${i}">${inner}</div>`;
  }
  function homeTopHTML() {
    const n = nav(), trig = trigOf(n), keys = tabsOf(n);
    const menuBtn = `<button type="button" class="lt-hb" data-lt-menu aria-label="Open menu">${ic('menu', 22, 2)}</button>`;
    const left = trig === 'left' ? menuBtn : '<span class="lt-hsp"></span>';
    let acct = '', trial = ''; try { if (window.Account && Account.on) acct = Account.homeBtn() || ''; } catch (e) {} try { if (window.Pro && Pro.trialBadge) trial = Pro.trialBadge() || ''; } catch (e) {}
    const right = acct + `<button type="button" class="lt-hb" data-search-open aria-label="Search">${ic('search', 21, 2.1)}</button><button type="button" class="lt-hb" data-lt-act="customize" aria-label="Customize home">${ic('pencil', 20, 2)}</button>${trig === 'right' ? menuBtn : ''}`;
    return `<div id="ltHomeTop" class="lt-htop"><div class="lt-hrow">${left}<span class="lt-brand${trig === 'title' ? ' lt-titlebtn' : ''}"${trig === 'title' ? ' data-lt-menu role="button" tabindex="0"' : ''}>Synapse${trig === 'title' ? ' ' + ic('down', 15, 2.4) : ''}</span><span class="lt-hr">${n.bar === 'head' ? `<span class="lt-headtabs">${barHTML(n, keys)}</span>` : ''}${right}</span></div>${trial ? `<div class="lt-trial">${trial}</div>` : ''}${n.bar === 'top' || n.bar === 'seg' ? `<div class="lt-strip lt-s-${n.bar}"><div class="lt-sc">${barHTML(n, keys)}</div></div>` : ''}</div>`;
  }
  function renderHome(el) {
    el = el || $('#v-home'); if (!el) return false;
    const bl = S.blocks.length ? S.blocks : [];
    let extra = ''; try { if (window.HomeExtras) extra = HomeExtras.map(f => { try { return f() || ''; } catch (e) { return ''; } }).join(''); } catch (e) {}
    el.innerHTML = homeTopHTML() + `<div class="lt-home">${bl.map(blockHTML).join('')}${bl.length ? '' : `<button type="button" class="lt-empty" data-lt-act="customize">${ic('plus', 22, 2)}<span>Add blocks to your home</span></button>`}</div>` + (extra ? `<div class="lt-extras">${extra}</div>` : '');
    return true;
  }
  /* ---------- state ---------- */
  const DEF = () => ({ v: 1, at: 0, nav: '03a', tabs: null, blocks: [{ id: 'hero', size: 'w' }, { id: 'daily', size: 's' }, { id: 'doc', size: 's' }], theme: 'notebook', accent: '', text: '', corners: '', density: 'comfy', groups: null, custom: [], labTools: ['ecg', 'labs', 'receptor', 'sim'], hidden: {} });
  function clean(s) {
    const d = DEF(); s = s && typeof s === 'object' ? s : {};
    const o = Object.assign(d, s);
    if (!NAVBY[o.nav]) o.nav = '03a';
    o.blocks = (Array.isArray(o.blocks) ? o.blocks : d.blocks).filter(b => b && BLOCKS[b.id]).map(b => ({ id: b.id, size: b.size === 's' ? 's' : 'w', opt: b.opt || undefined }));
    if (o.tabs && (!Array.isArray(o.tabs) || !o.tabs.length)) o.tabs = null; if (o.tabs) o.tabs = o.tabs.filter(k => TG[k]).slice(0, 6);
    if (!Array.isArray(o.custom)) o.custom = []; o.custom = o.custom.filter(c => c && /^c-/.test(c.id)).slice(0, 30);
    if (o.theme && o.theme.indexOf('c-') === 0 && !o.custom.some(c => c.id === o.theme)) o.theme = 'notebook';
    if (o.theme && o.theme.indexOf('c-') !== 0 && !LT.THEMES[o.theme]) o.theme = 'notebook';
    if (!Array.isArray(o.labTools)) o.labTools = d.labTools;
    return o;
  }
  let S = clean(LT.state());
  const subs = [];
  function save(remote) {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    try { LT.apply(S); } catch (e) { console.warn(e); }
    paintAll(); subs.forEach(f => { try { f(remote); } catch (e) {} });
    if (!remote) pushSoon();
  }
  function set(patch) { S = clean(Object.assign({}, S, typeof patch === 'function' ? patch(S) : patch)); S.at = Date.now(); save(false); }
  function reset() { const keep = S.custom; S = DEF(); S.custom = keep; S.at = Date.now(); save(false); }
  // sync: progress record 'layout' (newest 'at' wins), same path as settings
  let pushT = 0;
  function pushSoon() { clearTimeout(pushT); pushT = setTimeout(() => { try { if (typeof write === 'function' && typeof M !== 'undefined') write([['progress', { ...(M.progress.get('layout') || {}), id: 'layout', t: 'layout', data: S, at: S.at, del: 0 }]]); } catch (e) { console.warn('layout push', e); } }, 1200); }
  function pull() { try { if (typeof M === 'undefined') return; const r = M.progress.get('layout'); if (r && !r.del && r.data && (r.at || 0) > (S.at || 0)) { S = clean(r.data); S.at = r.at; save(true); } } catch (e) {} }

  /* ---------- the full menu: five groups that hold every screen and tool ---------- */
  const GROUPS = [['study', 'Study', 'study'], ['learn', 'Learn', 'learn'], ['lab', 'Lab', 'lab'], ['tools', 'Tools', 'bolt'], ['you', 'You', 'person']];
  const CORE = {
    home: { t: 'Today', icn: 'home', go: () => Shell.switchTab('home') },
    decks: { t: 'My decks', icn: 'study', go: () => Shell.openDoc('nav:decks'), n: () => { try { return decks().length; } catch (e) { return ''; } } },
    weak: { t: 'Weak cards', icn: 'target', go: () => Shell.openDoc('nav:weak'), n: () => window.Weak ? Weak.dueCount() || '' : '' },
    library: { t: 'Deck library', icn: 'books', go: () => Shell.openDoc('nav:library') },
    browse: { t: 'Browse cards', icn: 'list', go: () => Shell.openDoc('nav:browse') },
    learn: { t: 'Courses', icn: 'learn', go: () => Shell.openDoc('nav:learn') },
    exam: { t: 'Exam mode', icn: 'timer', go: () => { if (window.Exam && Exam.open) Exam.open(); else Shell.openDoc('nav:learn'); } },
    stats: { t: 'Stats', icn: 'stats', go: () => Shell.openDoc('nav:stats') },
    search: { t: 'Search everything', icn: 'search', go: () => { if (window.Search) Search.open(); } },
    customize: { t: 'Customize', icn: 'brush', go: () => customize() },
    account: { t: 'Account and sync', icn: 'cloud', go: () => { if (window.Account && Account.on) Account.open(); else Shell.open('sync'); } }
  };
  const GROUP_ITEMS = {
    study: ['decks', 'daily', 'weak', 'doc', 'library', 'browse'],
    learn: ['learn', 'exam', 'anat', 'plan'],
    you: ['stats', 'badges', 'account', 'sync', 'customize', 'prefs', 'share', 'help', 'about']
  };
  function item(id) {
    const c = CORE[id]; if (c) return { id, title: c.t, icon: ic(c.icn, 19), go: c.go, n: c.n ? c.n() : '', keys: c.t };
    const f = window.Shell && Shell.feat(id); if (!f) return null;
    return { id, title: f.title, sub: f.sub, icon: Shell.iconOf(f, 19), go: () => Shell.open(id), n: '', keys: f.title + ' ' + (f.sub || '') + ' ' + (f.keys || '') };
  }
  // lab + tools come from the Shell's registry, so a tool added there shows up here too
  function subGroups(g) {
    if (!window.Shell) return [];
    if (g === 'lab') return Shell.list('lab').map(x => ({ g: x.g, hub: 'lab', name: x.name, items: x.items.map(f => item(f.id)).filter(Boolean) }));
    if (g === 'tools') return Shell.list('more').filter(x => x.g !== 'you').map(x => ({ g: x.g, hub: 'more', name: x.name, items: x.items.map(f => item(f.id)).filter(Boolean) }));
    return [];
  }
  function groupsNow() {
    const order = (S.groups && S.groups.length ? S.groups : GROUPS.map(g => ({ id: g[0], on: true })));
    const seen = new Set(), out = [];
    order.concat(GROUPS.map(g => ({ id: g[0], on: true }))).forEach(o => { if (seen.has(o.id)) return; seen.add(o.id); const g = GROUPS.find(x => x[0] === o.id); if (g) out.push({ id: g[0], name: g[1], icn: g[2], on: o.on !== false }); });
    return out.map((g, i) => Object.assign(g, { color: 'var(--lt-g' + (GROUPS.findIndex(x => x[0] === g.id) + 1) + ')', items: GROUP_ITEMS[g.id] ? GROUP_ITEMS[g.id].map(item).filter(Boolean) : null, subs: subGroups(g.id) }));
  }
  const allItems = gs => { const out = [], seen = new Set(); gs.forEach(g => { (g.items || []).forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); out.push(Object.assign({ grp: g.name }, x)); } }); g.subs.forEach(s => s.items.forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); out.push(Object.assign({ grp: g.name + ' · ' + s.name }, x)); } })); }); return out; };
  const REG = new Map(); // id -> go (for data-lt-go clicks)
  function reg(x) { REG.set(x.id, x.go); return x.id; }
  const row = (x, extra) => `<button type="button" class="lt-row" data-lt-go="${reg(x)}" data-hay="${esc((x.keys || x.title).toLowerCase())}"><span class="lt-ri">${x.icon}</span><span class="lt-rt"><b>${esc(x.title)}</b>${extra && x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>${x.n !== '' && x.n != null ? `<span class="lt-rn">${esc(x.n)}</span>` : ''}</button>`;
  const ghead = g => `<div class="lt-gh"><span class="lt-gsq" style="background:${g.color}">${ic(g.icn, 16, 2)}</span><span>${esc(g.name)}</span></div>`;
  function who() {
    let lvl = '', st = 0, name = 'Synapse'; try { lvl = Hub.level().level; st = Hub.streak(); } catch (e) {}
    try { const u = window.Account && Account.user && Account.user(); if (u && u.email) name = u.email.split('@')[0]; } catch (e) {}
    return `<div class="lt-who"><span class="lt-av">${esc((name[0] || 'S').toUpperCase())}</span><span><b>${esc(name)}</b><small>Level ${esc(lvl || 1)} · ${st} day streak</small></span></div>`;
  }
  const CONTENT = {
    groups(gs) {
      return who() + gs.map(g => `<section class="lt-g">${ghead(g)}<div class="lt-gl">${g.items ? g.items.map(x => row(x)).join('') : g.subs.map(s => { const k = 'hub:' + s.hub + ':' + s.g; REG.set(k, () => Shell.openHub(s.hub, s.g)); return `<button type="button" class="lt-row" data-lt-go="${k}" data-hay="${esc((s.name + ' ' + s.items.map(i => i.keys).join(' ')).toLowerCase())}"><span class="lt-rt"><b>${esc(s.name)}</b></span><span class="lt-rn">${s.items.length}</span></button>`; }).join('')}</div></section>`).join('');
    },
    fold(gs) {
      const open = CONTENT._open || (CONTENT._open = new Set(['study']));
      return who() + gs.map(g => { const list = g.items || g.subs.flatMap(s => s.items); const on = open.has(g.id); return `<section class="lt-g lt-fold${on ? ' on' : ''}" data-lt-fold="${g.id}"><button type="button" class="lt-gh lt-fh" data-lt-fold-t="${g.id}" aria-expanded="${on}"><span class="lt-gsq" style="background:${g.color}">${ic(g.icn, 16, 2)}</span><span>${esc(g.name)}</span><span class="lt-rn">${list.length}</span><span class="lt-fc">${ic('down', 16, 2.2)}</span></button><div class="lt-gl">${g.subs.length ? g.subs.map(s => `<div class="lt-sub">${esc(s.name)}</div>` + s.items.map(x => row(x)).join('')).join('') : list.map(x => row(x)).join('')}</div></section>`; }).join('');
    },
    cols(gs) { return `<div class="lt-cols">${gs.map(g => `<section class="lt-g">${ghead(g)}<div class="lt-gl">${(g.items || g.subs.flatMap(s => s.items)).map(x => row(x)).join('')}</div></section>`).join('')}</div>`; },
    list(gs) {
      const top = ['home', 'decks', 'weak', 'daily', 'doc', 'learn', 'library', 'stats'].map(item).filter(Boolean);
      const hubs = [['lab', 'Lab tools', 'lab'], ['more', 'Study tools and settings', 'more']].map(([h, t, i]) => { REG.set('hub:' + h, () => Shell.switchTab(h)); return `<button type="button" class="lt-row" data-lt-go="hub:${h}"><span class="lt-ri">${ic(i, 19)}</span><span class="lt-rt"><b>${t}</b></span><span class="lt-rn">${ic('chev', 15, 2.2)}</span></button>`; }).join('');
      return `<div class="lt-gl lt-plain">${top.map(x => row(x)).join('')}${hubs}${row(item('customize'))}${row(item('prefs') || item('customize'))}</div>`;
    },
    grid(gs) {
      return gs.map(g => `<section class="lt-g">${ghead(g)}<div class="lt-tiles">${(g.items || g.subs.flatMap(s => s.items)).map(x => `<button type="button" class="lt-tile" data-lt-go="${reg(x)}" data-hay="${esc((x.keys || x.title).toLowerCase())}"><span class="lt-ti" style="color:${g.color}">${x.icon}</span><span>${esc(x.title)}</span></button>`).join('')}</div></section>`).join('');
    },
    search(gs) {
      const rec = (window.Shell ? Shell.recent() : []).slice(0, 5).map(item).filter(Boolean);
      return `<label class="lt-find">${ic('search', 17, 2.2)}<input type="search" data-lt-filter placeholder="Find a screen or tool" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Find a screen or tool"></label>
        ${rec.length ? `<div class="lt-sub lt-rec-h">Recent</div><div class="lt-gl lt-rec">${rec.map(x => row(x)).join('')}</div>` : ''}
        <div class="lt-all">${gs.map(g => `<section class="lt-g">${ghead(g)}<div class="lt-gl">${(g.items || g.subs.flatMap(s => s.items)).map(x => row(x)).join('')}</div></section>`).join('')}</div>
        <button type="button" class="lt-row lt-deep" data-lt-deep><span class="lt-ri">${ic('search', 19)}</span><span class="lt-rt"><b>Search cards and lessons too</b></span></button>`;
    }
  };

  /* ---------- menu overlay (one element, many shapes) ---------- */
  function nav() { return NAVBY[S.nav] || NAV[0]; }
  function tabsOf(n) { n = n || nav(); return (S.tabs && S.tabs.length ? S.tabs : n.tabs || []).filter(k => TG[k]); }
  function label(k, n) { n = n || nav(); return (n.labels && n.labels[k]) || TG[k][0]; }
  let menuEl = null;
  function openMenu(kind) {
    closeMenu(true);
    const n = nav(), type = kind || n.menu || 'drawer', gs = groupsNow().filter(g => g.on);
    REG.clear();
    let inner;
    if (type === 'speed' || type === 'radial') {
      const keys = (type === 'radial' ? tabsOf(n) : ['home', 'study', 'learn', 'lab', 'doc', 'search']).slice(0, 6);
      keys.forEach(k => REG.set('t:' + k, TG[k][2]));
      REG.set('menu:full', () => openMenu(n.content === 'grid' ? 'grid' : 'drawer'));
      inner = `<div class="lt-q">${keys.map((k, i) => `<button type="button" class="lt-qb" style="--i:${i};--n:${keys.length}" data-lt-go="t:${k}"><span>${ic(TG[k][1], 22)}</span><b>${esc(label(k, n))}</b></button>`).join('')}<button type="button" class="lt-qb lt-qall" style="--i:${keys.length};--n:${keys.length}" data-lt-go="menu:full"><span>${ic('grid', 22)}</span><b>Everything</b></button></div>`;
    } else {
      const content = type === 'palette' ? 'search' : type === 'grid' ? 'grid' : n.content || 'groups';
      inner = `<div class="lt-ph"><b>${type === 'palette' ? 'Go to' : 'Menu'}</b><button type="button" class="lt-x" data-lt-close aria-label="Close menu">${ic('x', 20, 2.2)}</button></div><div class="lt-pc lt-c-${content}">${CONTENT[content](gs)}</div>`;
    }
    menuEl = document.createElement('div');
    menuEl.className = 'lt-menu lt-m-' + type; menuEl.setAttribute('role', 'dialog'); menuEl.setAttribute('aria-modal', 'true'); menuEl.setAttribute('aria-label', 'Menu');
    menuEl.innerHTML = `<div class="lt-scrim" data-lt-close></div><div class="lt-panel">${inner}</div>`;
    document.body.appendChild(menuEl); de.classList.add('lt-open');
    requestAnimationFrame(() => requestAnimationFrame(() => menuEl && menuEl.classList.add('in')));
    haptic();
    const f = menuEl.querySelector('[data-lt-filter]'); if (f && type === 'palette') setTimeout(() => { try { f.focus(); } catch (e) {} }, 60);
  }
  function closeMenu(now) {
    const m = menuEl; menuEl = null; if (!m) return;
    m.classList.remove('in'); m.classList.add('out');
    if (!document.querySelector('.lt-menu:not(.out)')) de.classList.remove('lt-open');
    if (now) m.remove(); else setTimeout(() => m.remove(), 220);
  }
  function filterMenu(inp) {
    const q = inp.value.trim().toLowerCase(), root = inp.closest('.lt-pc'); if (!root) return;
    root.querySelectorAll('.lt-all .lt-row, .lt-all .lt-tile').forEach(r => { r.hidden = !!q && !q.split(/\s+/).every(w => (r.dataset.hay || '').includes(w)); });
    root.querySelectorAll('.lt-all .lt-g').forEach(g => { g.hidden = ![...g.querySelectorAll('.lt-row')].some(r => !r.hidden); });
    const rec = root.querySelector('.lt-rec'), rh = root.querySelector('.lt-rec-h'); if (rec) rec.hidden = !!q; if (rh) rh.hidden = !!q;
  }

  /* ---------- chrome: bars, rail, triggers ---------- */
  function barHTML(n, keys, cls) {
    const act = activeKey();
    return keys.map(k => { const on = isOn(k, act, keys), big = n.bar === 'fab' && k === 'review';
      return `<button type="button" class="lt-tab${on ? ' on' : ''}${big ? ' lt-big' : ''}" data-lt-t="${k}" aria-label="${esc(label(k, n))}"${on ? ' aria-current="page"' : ''}><span class="lt-tic">${ic(TG[k][1], big ? 28 : 24, on ? 2.3 : 1.9)}</span><span class="lt-tl">${esc(label(k, n))}</span></button>`; }).join('');
  }
  function railHTML(n) {
    const keys = n.railTabs || tabsOf(n), act = activeKey();
    return `<button type="button" class="lt-rb lt-rmenu" data-lt-menu aria-label="Open menu">${ic('menu', 22, 2)}${n.rail === 'labels' ? '<span>Menu</span>' : ''}</button>` + keys.map(k => `<button type="button" class="lt-rb${isOn(k, act, keys) ? ' on' : ''}" data-lt-t="${k}" aria-label="${esc(label(k, n))}">${ic(TG[k][1], 22)}${n.rail === 'labels' ? `<span>${esc(label(k, n))}</span>` : ''}</button>`).join('') + `<button type="button" class="lt-rb lt-rsearch" data-lt-t="search" aria-label="Search">${ic('search', 21)}${n.rail === 'labels' ? '<span>Search</span>' : ''}</button>`;
  }
  // trigger: where the menu button lives. A style with no bar item that reaches the menu always gets one.
  function trigOf(n) {
    if (n.trig) return n.trig; if (n.rail) return 'rail';
    const keys = tabsOf(n); if (n.bar === 'handle' || keys.some(k => ['menu', 'you', 'explore', 'more'].includes(k))) return 'bar';
    return 'left';
  }
  function crumbs() {
    if (!window.Shell) return '';
    const st = Shell.stack, act = activeKey(); const parts = [['home', 'Today']];
    const v = curView(); if (v !== 'home') { const t = ($('#title') || {}).textContent || ''; st.slice(0, -1).forEach((e, i) => { const tt = e.v === 'home' ? '' : e.v === 'x' ? (e.m === 'lab' ? 'Lab' : e.m === 'tools' ? 'More' : '') : ({ decks: 'Study', learn: 'Learn', library: 'Library', stats: 'Stats', weak: 'Weak', browse: 'Browse', doc: 'Doctordle' })[e.v] || ''; if (tt) parts.push(['back:' + (st.length - 1 - i), tt]); }); parts.push(['', t || 'Here']); }
    return parts.map(([k, t], i) => (i ? '<span class="lt-cs">›</span>' : '') + (k ? `<button type="button" data-lt-crumb="${k}">${esc(t)}</button>` : `<b>${esc(t)}</b>`)).join('');
  }
  const setHTML = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };
  function paintAll() {
    const B = document.body; if (!B || !window.Shell) return;
    const n = nav(), keys = tabsOf(n), trig = trigOf(n), v = curView(), hideBars = B.classList.contains('sh-hide-tabs');
    const want = ['lt-on', 'lt-nav-' + n.id, 'lt-trig-' + trig].concat(n.bar ? ['lt-bar-' + n.bar] : [], n.rail ? ['lt-rail-' + n.rail] : [], n.crumbs ? ['lt-crumbs'] : [], hideBars ? ['lt-hidebars'] : []);
    [...B.classList].filter(c => /^lt-/.test(c) && !want.includes(c)).forEach(c => B.classList.remove(c));
    want.forEach(c => { if (!B.classList.contains(c)) B.classList.add(c); });
    // bottom / floating bars
    let bar = $('#ltBar'); const bottom = ['tabs', 'text', 'fab', 'dock', 'pill', 'handle'].includes(n.bar);
    if (bottom) {
      if (!bar) { bar = document.createElement('nav'); bar.id = 'ltBar'; bar.setAttribute('aria-label', 'Main'); document.body.appendChild(bar); }
      if (bar.className !== 'lt-bar lt-b-' + n.bar) bar.className = 'lt-bar lt-b-' + n.bar;
      setHTML(bar, n.bar === 'handle' ? `<button type="button" class="lt-handle" data-lt-menu aria-label="Open menu"><i></i><span>Everything</span></button>` : barHTML(n, keys));
    } else if (bar) bar.remove();
    // edge tabs
    let edge = $('#ltEdge');
    if (n.bar === 'edge') { if (!edge) { edge = document.createElement('nav'); edge.id = 'ltEdge'; edge.className = 'lt-edge'; edge.setAttribute('aria-label', 'Sections'); document.body.appendChild(edge); } setHTML(edge, barHTML(n, keys)); } else if (edge) edge.remove();
    // rail
    let rail = $('#ltRail');
    if (n.rail) { if (!rail) { rail = document.createElement('nav'); rail.id = 'ltRail'; rail.setAttribute('aria-label', 'Main'); document.body.appendChild(rail); } rail.className = 'lt-rail lt-rail-' + n.rail; setHTML(rail, railHTML(n)); } else if (rail) rail.remove();
    // floating menu button
    let fab = $('#ltFab');
    if (/^fab/.test(trig)) { if (!fab) { fab = document.createElement('button'); fab.id = 'ltFab'; fab.type = 'button'; fab.setAttribute('data-lt-menu', ''); fab.setAttribute('aria-label', 'Open menu'); document.body.appendChild(fab); } if (fab.className !== 'lt-fab lt-' + trig) fab.className = 'lt-fab lt-' + trig; setHTML(fab, ic(n.menu === 'radial' ? 'plus' : 'menu', 26, 2.2)); } else if (fab) fab.remove();
    // header pieces (non-home screens)
    const top = $('header.top');
    if (top) {
      let tb = $('#ltTrig'); const wantL = trig === 'left', wantR = trig === 'right';
      if (wantL || wantR) { if (!tb) { tb = document.createElement('button'); tb.id = 'ltTrig'; tb.type = 'button'; tb.className = 'sh-hbtn lt-trig'; tb.setAttribute('data-lt-menu', ''); tb.setAttribute('aria-label', 'Open menu'); tb.innerHTML = ic('menu', 23, 2); }
        if (wantL) { const br = top.querySelector('.brand'); if (tb.parentNode !== br) br.insertBefore(tb, br.firstChild); } else { const tr = top.querySelector('.topr'); if (tb.parentNode !== tr || tr.lastElementChild !== tb) tr.appendChild(tb); } }
      else if (tb) tb.remove();
      let hi = $('#ltHeadTabs');
      if (n.bar === 'head') { if (!hi) { hi = document.createElement('div'); hi.id = 'ltHeadTabs'; hi.className = 'lt-headtabs'; const tr = top.querySelector('.topr'); tr.insertBefore(hi, tr.firstChild); } setHTML(hi, barHTML(n, keys)); } else if (hi) hi.remove();
      let strip = $('#ltStrip');
      if (n.bar === 'top' || n.bar === 'seg') { if (!strip) { strip = document.createElement('div'); strip.id = 'ltStrip'; top.appendChild(strip); } strip.className = 'lt-strip lt-s-' + n.bar; setHTML(strip, `<div class="lt-sc">${barHTML(n, keys)}</div>`); } else if (strip) strip.remove();
      let cr = $('#ltCrumbs');
      if (n.crumbs && v !== 'home') { if (!cr) { cr = document.createElement('div'); cr.id = 'ltCrumbs'; cr.className = 'lt-crumbbar'; top.appendChild(cr); } setHTML(cr, crumbs()); } else if (cr) cr.remove();
      const tl = $('#title'); if (tl) { tl.classList.toggle('lt-titlebtn', trig === 'title'); if (trig === 'title') tl.setAttribute('data-lt-menu', ''); else tl.removeAttribute('data-lt-menu'); }
    }
    const homeTop = $('#ltHomeTop'); if (homeTop && v === 'home') { const h = homeTopHTML(); if (homeTop._h !== h && homeTop.outerHTML !== h) { homeTop.outerHTML = h; const nt = $('#ltHomeTop'); if (nt) nt._h = h; } }
  }

  /* ---------- Customize screen (Lab-style full screen: XView module 'customize') ---------- */
  const CZ = { sec: 'home', edit: null, share: null };
  const SECS = [['home', 'Home'], ['style', 'Layout'], ['theme', 'Theme'], ['colors', 'My colors'], ['text', 'Text & shape'], ['menu', 'Menu']];
  function customize(sec) { if (sec) CZ.sec = sec; closeMenu(true); if (window.XView) XView.open('customize'); else go('x'); }
  const seg = (name, opts, cur) => `<div class="lt-seg" role="radiogroup">${opts.map(([v, t]) => `<button type="button" role="radio" aria-checked="${String(cur) === String(v)}" class="${String(cur) === String(v) ? 'on' : ''}" data-cz-set="${name}" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>`;
  function schematic(n) {
    const tb = n.bar, m = n.menu || 'drawer', tr = trigOf(Object.assign({}, n, { tabs: n.tabs }));
    return `<div class="lt-sch lt-sch-${tb || 'none'}${n.rail ? ' r' : ''}" aria-hidden="true"><i class="s-hd">${tr === 'left' ? '<i class="s-mb"></i>' : ''}${tr === 'right' ? '<i class="s-mb s-r"></i>' : ''}${tb === 'head' ? '<i class="s-hi"></i>' : ''}</i>${tb === 'top' || tb === 'seg' ? '<i class="s-strip"></i>' : ''}${n.crumbs ? '<i class="s-crumb"></i>' : ''}${n.rail ? `<i class="s-rail${n.rail === 'labels' ? ' w' : ''}"></i>` : ''}${tb === 'edge' ? '<i class="s-edge"></i>' : ''}<i class="s-body"><i></i><i></i><i class="h"></i></i>${['tabs', 'text', 'fab', 'dock', 'pill', 'handle'].includes(tb) ? `<i class="s-bar s-${tb}">${tb === 'fab' ? '<i class="s-c"></i>' : ''}</i>` : ''}${/^fab/.test(tr) ? `<i class="s-fab s-${tr}"></i>` : ''}<i class="s-m s-m-${m}"></i></div>`;
  }
  function themeCard(id, th, cur) {
    const c = th.c || { bg: 'var(--bg)', card: 'var(--card)', acc: 'var(--acc)', tx: 'var(--tx)', line: 'var(--line)' }, F = LT.FONTS;
    return `<button type="button" class="lt-thc${cur ? ' on' : ''}" data-cz-theme="${esc(id)}" aria-pressed="${cur}" style="--a:${c.bg};--b:${c.card};--c:${c.acc};--d:${c.tx};--e:${c.line};--f:${F[th.head] || F.sans};--r2:${Math.min(14, th.r == null ? 10 : th.r)}px"><span class="lt-thp"><span class="lt-thk"><b>Aa</b><i></i><i class="s"></i></span><span class="lt-thb"></span></span><span class="lt-thn">${esc(th.name)}</span>${th.desc ? `<small>${esc(th.desc)}</small>` : ''}</button>`;
  }
  function toHex(v) { if (LT.hex(v)) return v.length === 4 ? '#' + v.slice(1).replace(/./g, '$&$&') : v; const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(v || ''); return m ? '#' + [m[1], m[2], m[3]].map(x => (+x).toString(16).padStart(2, '0')).join('') : '#888888'; }
  function secHome() {
    const n = nav();
    const rows = S.blocks.map((b, i) => { const B = BLOCKS[b.id]; const wide = WIDE_ONLY.has(b.id);
      return `<div class="lt-brow" data-bi="${i}"><button type="button" class="lt-grip" data-cz-grip aria-label="Drag to move ${esc(B.name)}">${ic('grip', 20, 2)}</button><span class="lt-bn"><b>${esc(B.name)}</b><small>${wide ? 'Full width' : b.size === 's' ? 'Small' : 'Wide'}</small></span>${wide ? '' : `<button type="button" class="lt-sz" data-cz-size="${i}" aria-label="Size">${b.size === 's' ? 'Small' : 'Wide'}</button>`}<button type="button" class="lt-ib" data-cz-move="${i}" data-d="-1" aria-label="Move up"${i ? '' : ' disabled'}>${ic('up', 18, 2.2)}</button><button type="button" class="lt-ib" data-cz-move="${i}" data-d="1" aria-label="Move down"${i < S.blocks.length - 1 ? '' : ' disabled'}>${ic('down', 18, 2.2)}</button><button type="button" class="lt-ib lt-del" data-cz-del="${i}" aria-label="Remove">${ic('x', 18, 2.2)}</button></div>`; }).join('');
    const have = new Set(S.blocks.map(b => b.id));
    const add = BLOCK_ORDER.map(id => `<button type="button" class="lt-addb" data-cz-add="${id}"${have.has(id) ? ' disabled' : ''}><b>${esc(BLOCKS[id].name)}</b><small>${have.has(id) ? 'On your home' : esc(BLOCKS[id].desc)}</small></button>`).join('');
    const labs = have.has('labs') ? `<h4>Lab shortcuts (pick 4)</h4><div class="lt-chipsel">${Object.keys((window.Lab && Lab.F) || {}).filter(k => Lab.F[k].ready && Shell.feat(k) && Lab.F[k].hub !== 'tools').map(k => `<button type="button" class="lt-cs2${S.labTools.includes(k) ? ' on' : ''}" data-cz-lab="${k}">${esc(Shell.feat(k).title)}</button>`).join('')}</div>` : '';
    return `<div class="lt-prevw"><div class="lt-prev" data-cz-prev><div class="lt-prev-in"><div class="lt-home">${S.blocks.map(blockHTML).join('')}</div></div></div><p class="lt-mut lt-c">Live preview</p></div>
      <h4>Your home blocks</h4><p class="lt-mut">Drag the handle or use the arrows to reorder. Tap the size to switch between small and wide.</p>
      <div class="lt-blist" data-cz-list>${rows || '<p class="lt-mut">No blocks yet. Add some below.</p>'}</div>${labs}
      <h4>Add a block</h4><div class="lt-addg">${add}</div>
      <button type="button" class="lt-btn2" data-cz-stylehome>Use the suggested home for “${esc(n.name)}”</button>`;
  }
  function secStyle() {
    const n = nav(), fams = [...new Set(NAV.map(x => x.fam))];
    const keys = tabsOf(n), canTabs = !!(n.bar || n.rail || n.menu === 'radial');
    return fams.map(f => `<h4>${esc(f)}</h4><div class="lt-stg">${NAV.filter(x => x.fam === f).map(x => `<button type="button" class="lt-stc${x.id === n.id ? ' on' : ''}" data-cz-nav="${x.id}" aria-pressed="${x.id === n.id}">${schematic(x)}<span class="lt-stn"><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></span></button>`).join('')}</div>`).join('')
      + (canTabs && n.bar !== 'handle' ? `<h4>${n.rail ? 'Rail buttons' : 'Tabs'} for this layout</h4><p class="lt-mut">Tap to add or remove, up to ${n.bar === 'top' ? 7 : 5}. The menu always stays reachable.</p><div class="lt-chipsel">${TAB_CHOICES.map(k => `<button type="button" class="lt-cs2${keys.includes(k) ? ' on' : ''}" data-cz-tab="${k}">${keys.includes(k) ? (keys.indexOf(k) + 1) + '. ' : ''}${esc(label(k, n))}</button>`).join('')}</div>${S.tabs ? '<button type="button" class="lt-btn2" data-cz-tabsreset>Use this layout’s tabs</button>' : ''}` : '');
  }
  function secTheme() {
    const cur = S.theme || 'notebook';
    return `<div class="lt-thg">${LT.ORDER.map(id => themeCard(id, LT.THEMES[id], cur === id)).join('')}</div>`
      + (S.custom.length ? `<h4>My themes</h4><div class="lt-thg">${S.custom.map(c => themeCard(c.id, LT.themeOf(Object.assign({}, S, { theme: c.id })), cur === c.id)).join('')}</div>` : '')
      + `<button type="button" class="lt-btn2" data-cz-new>Make my own theme</button>`;
  }
  function secColors() {
    if (CZ.edit) { const c = S.custom.find(x => x.id === CZ.edit); if (c) return editor(c); CZ.edit = null; }
    const list = S.custom.map(c => { const th = LT.themeOf(Object.assign({}, S, { theme: c.id })); return `<div class="lt-crow"><span class="lt-sw">${['bg', 'card', 'acc', 'tx'].map(k => `<i style="background:${th.c[k]}"></i>`).join('')}</span><b>${esc(c.name || 'My theme')}</b><span class="lt-cra"><button type="button" class="lt-btn3" data-cz-theme="${c.id}">${S.theme === c.id ? 'In use' : 'Use'}</button><button type="button" class="lt-btn3" data-cz-edit="${c.id}">Edit</button><button type="button" class="lt-btn3" data-cz-share="${c.id}">Share</button><button type="button" class="lt-btn3 lt-del" data-cz-cdel="${c.id}">Delete</button></span>${CZ.share === c.id ? `<div class="lt-code"><input readonly value="${esc(exportCode(c))}" data-cz-codeout aria-label="Theme code"><button type="button" class="lt-btn3" data-cz-copy>Copy</button></div>` : ''}</div>`; }).join('');
    return `<p class="lt-mut">Make a theme with your own color for everything: background, cards, text, buttons, borders, the menu and each menu group, and the four answer buttons. Themes sync to your other devices and can be shared as a code.</p>
      <button type="button" class="lt-cta2" data-cz-new>New theme from the current look</button>
      ${list ? `<h4>My themes</h4><div class="lt-clist">${list}</div>` : ''}
      <h4>Add a shared theme</h4><div class="lt-code"><input data-cz-codein placeholder="Paste a theme code" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Theme code"><button type="button" class="lt-btn3" data-cz-import>Add</button></div>`;
  }
  function editor(c) {
    const th = LT.themeOf(Object.assign({}, S, { theme: c.id })), cc = th.c;
    const font = (k, v) => `<select data-cz-ef="${k}">${[['sans', 'System'], ['serif', 'Serif'], ['rounded', 'Rounded'], ['mono', 'Monospace']].map(([a, b]) => `<option value="${a}"${v === a ? ' selected' : ''}>${b}</option>`).join('')}</select>`;
    return `<div class="lt-edh"><button type="button" class="lt-btn3" data-cz-done>Done</button><span class="lt-mut">Changes show live and save as you go</span></div>
      <label class="lt-fl"><span>Name</span><input data-cz-ename value="${esc(c.name || '')}" maxlength="40" placeholder="My theme"></label>
      <label class="lt-fl"><span>Start from</span><select data-cz-ebase>${LT.ORDER.filter(x => x !== 'classic').map(id => `<option value="${id}"${c.base === id ? ' selected' : ''}>${esc(LT.THEMES[id].name)}</option>`).join('')}</select></label>
      <div class="lt-fl"><span>Mode</span>${seg('emode', [['light', 'Light'], ['dark', 'Dark']], th.mode)}</div>
      <h4>Colors</h4><div class="lt-toks">${LT.TOKENS.map(([k, lab]) => `<label class="lt-tok"><input type="color" value="${toHex(cc[k] || '#888888')}" data-cz-tok="${k}" aria-label="${esc(lab)}"><span>${esc(lab)}</span><input class="lt-hex" value="${esc(toHex(cc[k] || ''))}" data-cz-hex="${k}" maxlength="7" aria-label="${esc(lab)} hex" autocapitalize="off" spellcheck="false"></label>`).join('')}</div>
      <h4>Type and shape</h4>
      <label class="lt-fl"><span>Body font</span>${font('font', th.font)}</label><label class="lt-fl"><span>Heading font</span>${font('head', th.head)}</label>
      <label class="lt-fl"><span>Corner radius <b data-cz-rv>${th.r == null ? 14 : th.r}px</b></span><input type="range" min="0" max="28" step="1" value="${th.r == null ? 14 : th.r}" data-cz-er></label>
      <label class="lt-fl"><span>Shadows</span><select data-cz-esh>${[['none', 'None'], ['soft', 'Soft'], ['hard', 'Hard offset'], ['brutal', 'Thick'], ['glow', 'Glow']].map(([a, b]) => `<option value="${a}"${th.shadow === a ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
      <label class="lt-fl"><span>Card style</span><select data-cz-edeco>${[['none', 'Plain'], ['notebook', 'Ruled paper'], ['glass', 'Frosted glass'], ['brutal', 'Thick outline'], ['chart', 'Graph paper'], ['neon', 'Glow edge'], ['gradient', 'Gradient buttons'], ['terminal', 'Terminal'], ['contrast', 'Bold outline']].map(([a, b]) => `<option value="${a}"${th.deco === a ? ' selected' : ''}>${b}</option>`).join('')}</select></label>
      <div class="lt-edf"><button type="button" class="lt-btn3" data-cz-share="${c.id}">Share code</button><button type="button" class="lt-btn3 lt-del" data-cz-cdel="${c.id}">Delete theme</button></div>
      ${CZ.share === c.id ? `<div class="lt-code"><input readonly value="${esc(exportCode(c))}" data-cz-codeout aria-label="Theme code"><button type="button" class="lt-btn3" data-cz-copy>Copy</button></div>` : ''}`;
  }
  function secText() {
    const acc = S.accent || '', A = (window.Prefs && Prefs.ACCENTS) || [];
    return `<div class="lt-fl"><span>Text size</span>${seg('text', [['', 'Default'], ['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']], S.text || '')}</div>
      <div class="lt-fl"><span>Card corners</span>${seg('corners', [['', 'Theme'], ['sharp', 'Sharp'], ['soft', 'Soft'], ['round', 'Round'], ['pill', 'Extra round']], S.corners || '')}</div>
      <div class="lt-fl"><span>Density</span>${seg('density', [['comfy', 'Comfortable'], ['compact', 'Compact']], S.density || 'comfy')}</div>
      <div class="lt-fl"><span>Accent color</span><div class="lt-accs"><button type="button" class="lt-acc0${acc ? '' : ' on'}" data-cz-acc="" aria-label="Theme color">Theme</button>${A.map(([n, h]) => `<button type="button" class="lt-acc${acc.toLowerCase() === h ? ' on' : ''}" style="background:${h}" data-cz-acc="${h}" aria-label="${esc(n)}"></button>`).join('')}<label class="lt-acc lt-accc" aria-label="Pick any color"><input type="color" value="${toHex(acc || '#2b3a8c')}" data-cz-accc>${ic('plus', 16, 2.4)}</label></div></div>`;
  }
  function secMenu() {
    const gs = groupsNow();
    return `<p class="lt-mut">Order and show or hide the menu groups. Hidden groups stay reachable from search and the More screen.</p><div class="lt-blist">${gs.map((g, i) => `<div class="lt-brow"><span class="lt-gsq" style="background:${g.color}">${ic(g.icn, 16, 2)}</span><span class="lt-bn"><b>${esc(g.name)}</b><small>${(g.items || g.subs.flatMap(s => s.items)).length} items</small></span><button type="button" class="lt-sw2${g.on ? ' on' : ''}" role="switch" aria-checked="${g.on}" data-cz-gon="${g.id}" aria-label="Show ${esc(g.name)}"><i></i></button><button type="button" class="lt-ib" data-cz-gmove="${i}" data-d="-1" aria-label="Move up"${i ? '' : ' disabled'}>${ic('up', 18, 2.2)}</button><button type="button" class="lt-ib" data-cz-gmove="${i}" data-d="1" aria-label="Move down"${i < gs.length - 1 ? '' : ' disabled'}>${ic('down', 18, 2.2)}</button></div>`).join('')}</div><button type="button" class="lt-btn2" data-cz-preview-menu>Preview the menu</button>`;
  }
  function renderCZ(el) {
    el = el || $('#v-x'); if (!el) return;
    const y = window.scrollY;
    const body = { home: secHome, style: secStyle, theme: secTheme, colors: secColors, text: secText, menu: secMenu }[CZ.sec] || secHome;
    el.innerHTML = `<div class="lt-cz" data-cz><div class="lt-czh"><h2 class="lb-title">Customize</h2><p class="lt-mut">Build your home from blocks and choose the layout, theme and colors. Changes apply right away and sync to your other devices.</p></div>
      <div class="lt-tabs2" role="tablist">${SECS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${CZ.sec === k}" class="${CZ.sec === k ? 'on' : ''}" data-cz-sec="${k}">${t}</button>`).join('')}</div>
      <div class="lt-czb">${body()}</div>
      <div class="lt-czf"><button type="button" class="lt-btn2 lt-reset" data-cz-reset>Reset to default</button><p class="lt-mut">Default: Drawer with colored sections, Notebook theme. Your saved themes are kept.</p></div></div>`;
    window.scrollTo(0, y);
  }
  const rerender = () => { if (curView() === 'x' && window.Shell && Shell.mod === 'customize') renderCZ(); };
  // share codes: SYN1-<base64url JSON>
  function exportCode(c) { const o = { n: c.name || '', b: c.base, m: c.mode, c: c.c || {}, f: c.font, h: c.head, r: c.r, s: c.shadow, d: c.deco }; const j = JSON.stringify(o); return 'SYN1-' + btoa(unescape(encodeURIComponent(j))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function importCode(code) {
    const m = /^SYN1-([A-Za-z0-9_-]{10,6000})$/.exec(String(code || '').trim()); if (!m) return null;
    let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
    if (!o || typeof o !== 'object') return null;
    const okC = v => typeof v === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(v.trim());
    const c = {}; LT.TOKENS.forEach(([k]) => { if (o.c && okC(o.c[k])) c[k] = o.c[k].trim(); });
    const pick = (v, list, d) => list.includes(v) ? v : d;
    return { id: 'c-' + Date.now().toString(36), name: String(o.n || 'Shared theme').replace(/[<>]/g, '').slice(0, 40), base: LT.THEMES[o.b] && o.b !== 'classic' ? o.b : 'notebook', mode: pick(o.m, ['light', 'dark'], undefined), c, font: pick(o.f, ['sans', 'serif', 'rounded', 'mono'], undefined), head: pick(o.h, ['sans', 'serif', 'rounded', 'mono'], undefined), r: Number.isFinite(+o.r) ? Math.max(0, Math.min(28, +o.r)) : undefined, shadow: pick(o.s, ['none', 'soft', 'hard', 'brutal', 'glow'], undefined), deco: pick(o.d, ['none', 'notebook', 'glass', 'brutal', 'chart', 'neon', 'gradient', 'terminal', 'contrast'], undefined) };
  }
  function newCustom() {
    const th = LT.themeOf(S), baseId = S.theme && S.theme.indexOf('c-') === 0 ? ((S.custom.find(c => c.id === S.theme) || {}).base || 'notebook') : (S.theme === 'classic' ? 'notebook' : S.theme || 'notebook');
    const src = th.c ? th : LT.THEMES[baseId];
    const c = { id: 'c-' + Date.now().toString(36), name: 'My theme ' + (S.custom.length + 1), base: baseId, mode: src.mode, c: Object.assign({}, src.c), font: src.font, head: src.head, r: src.r, shadow: src.shadow, deco: src.deco };
    set({ custom: S.custom.concat([c]), theme: c.id }); CZ.edit = c.id; CZ.sec = 'colors'; rerender();
  }
  function editCustom(id, fn) { set(s => ({ custom: s.custom.map(c => c.id === id ? fn(Object.assign({}, c, { c: Object.assign({}, c.c) })) : c) })); }

  /* ---------- events ---------- */
  function act(a) {
    closeMenu(true);
    const map = { review: startReview, decks: () => Shell.openDoc('nav:decks'), weak: () => Shell.openDoc('nav:weak'), stats: () => Shell.openDoc('nav:stats'), daily: () => Shell.open('daily'), doc: () => go('doc'), learn: () => Shell.openDoc('nav:learn'), library: () => Shell.openDoc('nav:library'), lab: () => Shell.switchTab('lab'), customize: () => customize('home'),
      continue: () => { const d = lastDeck(); if (!d) return Shell.openDoc('nav:decks'); try { studyDeck = d.id; undoStack = []; } catch (e) {} go('study'); } };
    (map[a] || (() => {}))();
  }
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest) return;
    let b;
    if ((b = t.closest('[data-lt-close]'))) { closeMenu(); return; }
    if ((b = t.closest('[data-lt-go]'))) { const f = REG.get(b.dataset.ltGo); closeMenu(true); if (f) try { f(); } catch (er) { console.warn(er); } return; }
    if ((b = t.closest('[data-lt-deep]'))) { closeMenu(true); if (window.Search) Search.open(); return; }
    if ((b = t.closest('[data-lt-fold-t]'))) { const id = b.dataset.ltFoldT, sec = b.closest('.lt-fold'), o = CONTENT._open || (CONTENT._open = new Set()); if (o.has(id)) o.delete(id); else o.add(id); sec.classList.toggle('on', o.has(id)); b.setAttribute('aria-expanded', o.has(id)); return; }
    if ((b = t.closest('[data-lt-menu]'))) { e.preventDefault(); if (menuEl) closeMenu(); else openMenu(); return; }
    if ((b = t.closest('[data-lt-menu-g]'))) { openMenu(nav().menu === 'speed' || nav().menu === 'radial' ? 'drawer' : null); return; }
    if ((b = t.closest('[data-lt-t]'))) { const k = b.dataset.ltT; closeMenu(true); haptic(); try { TG[k][2](); } catch (er) { console.warn(er); } return; }
    if ((b = t.closest('[data-lt-crumb]'))) { const k = b.dataset.ltCrumb; if (k === 'home') Shell.switchTab('home'); else { let n = +k.split(':')[1] || 1; while (n-- > 0 && Shell.back()); } return; }
    if ((b = t.closest('[data-lt-act]'))) { act(b.dataset.ltAct); return; }
    if ((b = t.closest('[data-lt-deck]'))) { try { studyDeck = b.dataset.ltDeck; undoStack = []; } catch (er) {} go('study'); return; }
    if ((b = t.closest('[data-lt-tool]'))) { Shell.open(b.dataset.ltTool); return; }
    if (!t.closest('[data-cz]')) return;
    // ----- customize controls -----
    if ((b = t.closest('[data-cz-sec]'))) { CZ.sec = b.dataset.czSec; CZ.share = null; renderCZ(); window.scrollTo(0, 0); return; }
    if ((b = t.closest('[data-cz-size]'))) { const i = +b.dataset.czSize; set(s => ({ blocks: s.blocks.map((x, j) => j === i ? { id: x.id, size: x.size === 's' ? 'w' : 's' } : x) })); rerender(); return; }
    if ((b = t.closest('[data-cz-move]'))) { const i = +b.dataset.czMove, d = +b.dataset.d; moveBlock(i, i + d); return; }
    if ((b = t.closest('[data-cz-del]'))) { const i = +b.dataset.czDel; set(s => ({ blocks: s.blocks.filter((x, j) => j !== i) })); rerender(); return; }
    if ((b = t.closest('[data-cz-add]'))) { const id = b.dataset.czAdd; set(s => ({ blocks: s.blocks.concat([{ id, size: WIDE_ONLY.has(id) || id === 'hero' ? 'w' : 's' }]) })); rerender(); toast(BLOCKS[id].name + ' added to your home'); return; }
    if ((b = t.closest('[data-cz-lab]'))) { const k = b.dataset.czLab; set(s => { let l = s.labTools.slice(); if (l.includes(k)) l = l.filter(x => x !== k); else { l.push(k); if (l.length > 4) l.shift(); } return { labTools: l }; }); rerender(); return; }
    if ((b = t.closest('[data-cz-stylehome]'))) { set({ blocks: (nav().home || ['hero']).map(x => { const [id, sz] = x.split(':'); return { id, size: sz === 's' ? 's' : 'w' }; }) }); rerender(); toast('Home blocks updated'); return; }
    if ((b = t.closest('[data-cz-nav]'))) { set({ nav: b.dataset.czNav, tabs: null }); haptic(); rerender(); return; }
    if ((b = t.closest('[data-cz-tab]'))) { const k = b.dataset.czTab, n = nav(), max = n.bar === 'top' ? 7 : 5; let l = tabsOf(n).slice(); if (l.includes(k)) { if (l.length > 1) l = l.filter(x => x !== k); } else if (l.length < max) l.push(k); else { toast('Up to ' + max + ' tabs'); return; } set({ tabs: l }); rerender(); return; }
    if ((b = t.closest('[data-cz-tabsreset]'))) { set({ tabs: null }); rerender(); return; }
    if ((b = t.closest('[data-cz-theme]'))) { set({ theme: b.dataset.czTheme }); haptic(); rerender(); return; }
    if ((b = t.closest('[data-cz-new]'))) { newCustom(); return; }
    if ((b = t.closest('[data-cz-edit]'))) { CZ.edit = b.dataset.czEdit; CZ.share = null; set({ theme: CZ.edit }); rerender(); return; }
    if ((b = t.closest('[data-cz-done]'))) { CZ.edit = null; CZ.share = null; rerender(); return; }
    if ((b = t.closest('[data-cz-share]'))) { CZ.share = CZ.share === b.dataset.czShare ? null : b.dataset.czShare; rerender(); return; }
    if ((b = t.closest('[data-cz-copy]'))) { const i = b.parentNode.querySelector('input'); try { navigator.clipboard.writeText(i.value).then(() => toast('Theme code copied'), () => { i.select(); toast('Select and copy the code'); }); } catch (er) { i.select(); } return; }
    if ((b = t.closest('[data-cz-cdel]'))) { const id = b.dataset.czCdel; if (!confirm('Delete this theme?')) return; CZ.edit = null; CZ.share = null; set(s => ({ custom: s.custom.filter(c => c.id !== id), theme: s.theme === id ? 'notebook' : s.theme })); rerender(); return; }
    if ((b = t.closest('[data-cz-import]'))) { const i = $('[data-cz-codein]'); const c = importCode(i && i.value); if (!c) { toast('That code doesn’t look right'); return; } set(s => ({ custom: s.custom.concat([c]), theme: c.id })); toast('Theme added'); rerender(); return; }
    if ((b = t.closest('[data-cz-set]'))) { const k = b.dataset.czSet, v = b.dataset.v; if (k === 'emode') editCustom(CZ.edit, c => (c.mode = v, c)); else set({ [k]: v }); rerender(); return; }
    if ((b = t.closest('[data-cz-acc]'))) { set({ accent: b.dataset.czAcc }); rerender(); return; }
    if ((b = t.closest('[data-cz-gon]'))) { const id = b.dataset.czGon; const gs = groupsNow().map(g => ({ id: g.id, on: g.id === id ? !g.on : g.on })); if (!gs.some(g => g.on)) { toast('Keep at least one group'); return; } set({ groups: gs }); rerender(); return; }
    if ((b = t.closest('[data-cz-gmove]'))) { const i = +b.dataset.czGmove, j = i + +b.dataset.d; const gs = groupsNow().map(g => ({ id: g.id, on: g.on })); if (j < 0 || j >= gs.length) return; [gs[i], gs[j]] = [gs[j], gs[i]]; set({ groups: gs }); rerender(); return; }
    if ((b = t.closest('[data-cz-preview-menu]'))) { openMenu(); return; }
    if ((b = t.closest('[data-cz-reset]'))) { if (!confirm('Reset the layout, theme, colors and home blocks to the default? Your saved themes are kept.')) return; CZ.edit = null; reset(); rerender(); toast('Back to the default look'); return; }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.matches && t.matches('[data-lt-filter]')) { filterMenu(t); return; }
    if (!t.closest || !t.closest('[data-cz]')) return;
    if (t.matches('[data-cz-tok]')) { const k = t.dataset.czTok, v = t.value; editCustom(CZ.edit, c => (c.c[k] = v, c)); const h = $(`[data-cz-hex="${k}"]`); if (h) h.value = v; return; }
    if (t.matches('[data-cz-hex]')) { const k = t.dataset.czHex, v = t.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { editCustom(CZ.edit, c => (c.c[k] = v, c)); const p = $(`[data-cz-tok="${k}"]`); if (p) p.value = v; } return; }
    if (t.matches('[data-cz-ename]')) { const v = t.value.replace(/[<>]/g, '').slice(0, 40); editCustom(CZ.edit, c => (c.name = v, c)); return; }
    if (t.matches('[data-cz-er]')) { const v = +t.value; editCustom(CZ.edit, c => (c.r = v, c)); const o = $('[data-cz-rv]'); if (o) o.textContent = v + 'px'; return; }
    if (t.matches('[data-cz-accc]')) { set({ accent: t.value }); return; }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!t.closest || !t.closest('[data-cz]')) return;
    if (t.matches('[data-cz-ebase]')) { const b = LT.THEMES[t.value]; if (!b || !confirm('Start from ' + b.name + '? This replaces this theme’s colors.')) { rerender(); return; } editCustom(CZ.edit, c => Object.assign(c, { base: t.value, mode: b.mode, c: Object.assign({}, b.c), font: b.font, head: b.head, r: b.r, shadow: b.shadow, deco: b.deco })); rerender(); return; }
    if (t.matches('[data-cz-ef]')) { const k = t.dataset.czEf; editCustom(CZ.edit, c => (c[k] = t.value, c)); return; }
    if (t.matches('[data-cz-esh]')) { editCustom(CZ.edit, c => (c.shadow = t.value, c)); return; }
    if (t.matches('[data-cz-edeco]')) { editCustom(CZ.edit, c => (c.deco = t.value, c)); return; }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuEl) closeMenu(); });
  function moveBlock(i, j) { if (j < 0 || j >= S.blocks.length || i === j) return; set(s => { const l = s.blocks.slice(); const [x] = l.splice(i, 1); l.splice(j, 0, x); return { blocks: l }; }); rerender(); }
  // touch drag on the handle (pointer events; the page keeps scrolling everywhere else)
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest && e.target.closest('[data-cz-grip]'); if (!g) return;
    const rowEl = g.closest('.lt-brow'), list = rowEl.parentNode; e.preventDefault();
    const rows = [...list.querySelectorAll('.lt-brow')], r0 = rowEl.getBoundingClientRect();
    drag = { el: rowEl, from: rows.indexOf(rowEl), to: rows.indexOf(rowEl), y0: e.clientY, rows, mids: rows.map(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }), h: r0.height + 8, id: e.pointerId };
    try { g.setPointerCapture(e.pointerId); } catch (er) {}
    rowEl.classList.add('drag'); haptic();
  });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return; e.preventDefault();
    const dy = e.clientY - drag.y0; drag.el.style.transform = `translateY(${dy}px)`;
    const c = drag.mids[drag.from] + dy; let to = drag.from;
    drag.mids.forEach((m, i) => { if (i < drag.from && c < m) to = Math.min(to, i); if (i > drag.from && c > m) to = Math.max(to, i); });
    drag.to = to;
    drag.rows.forEach((r, i) => { if (r === drag.el) return; let s = 0; if (drag.from < to && i > drag.from && i <= to) s = -drag.h; if (drag.from > to && i >= to && i < drag.from) s = drag.h; r.style.transform = s ? `translateY(${s}px)` : ''; });
  }, { passive: false });
  const endDrag = e => { if (!drag || (e && e.pointerId !== drag.id)) return; const d = drag; drag = null; d.rows.forEach(r => { r.style.transform = ''; }); d.el.classList.remove('drag'); if (d.to !== d.from) moveBlock(d.from, d.to); };
  document.addEventListener('pointerup', endDrag); document.addEventListener('pointercancel', endDrag);

  /* ---------- hooks into the app ---------- */
  function register() { if (window.XView && XView.MODS && !XView.MODS.customize) XView.MODS.customize = { title: 'Customize', render: el => renderCZ(el) }; }
  let pt = 0; const paintSoon = () => { clearTimeout(pt); pt = setTimeout(paintAll, 40); };
  function boot() {
    register();
    try { LT.apply(S); } catch (e) {}
    if (window.Prefs && Prefs.onChange) Prefs.onChange(() => { try { LT.apply(S); } catch (e) {} });
    try { changeHooks.push(pull); } catch (e) {}
    pull();
    if (typeof window.go === 'function' && !window.go._lt) { const og = window.go; window.go = function (v) { if (v === 'study') { try { if (studyDeck && studyDeck !== '*') localStorage.setItem('lt.lastDeck', studyDeck); } catch (e) {} } if (menuEl) closeMenu(true); const r = og.apply(this, arguments); paintSoon(); return r; }; window.go._lt = 1; try { go = window.go; } catch (e) {} }
    if (window.XView && XView.open && !XView.open._lt) { const oo = XView.open; XView.open = function () { if (menuEl) closeMenu(true); const r = oo.apply(this, arguments); paintSoon(); return r; }; XView.open._lt = 1; }
    if (window.Shell && Shell.paint && !Shell.paint._lt) { const op = Shell.paint; Shell.paint = function () { const r = op.apply(this, arguments); paintSoon(); return r; }; Shell.paint._lt = 1; }
    paintAll();
    if (curView() === 'home') renderHome();
    try { if (window.Hub && Hub.onChange) Hub.onChange(() => { if (curView() === 'home') renderHome(); }); } catch (e) {}
  }
  // the old home calls this first: true = the block home drew it
  function home(el) { try { return renderHome(el); } catch (e) { console.warn('layout home', e); return false; } }
  subs.push(remote => { if (curView() === 'home') renderHome(); if (remote) rerender(); });
  window.Layout = { get state() { return JSON.parse(JSON.stringify(S)); }, set, reset, open: openMenu, close: closeMenu, customize, home, paint: paintAll, NAV, BLOCKS, TG, importCode, exportCode };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
