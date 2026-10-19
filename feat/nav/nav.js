/* Section navigation: house Home button (top-left) + a side menu per section, opened by a swipe from the left edge or the ☰ button.
   Replaces the old edge-swipe-to-home. Reads Settings.nav() when present (menu on/off, edge width, threshold, haptic). Loaded after app.js / prefs-ui.js. */
(function () {
  'use strict';
  if (window.NavMenu) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const NS = () => { try { if (window.Settings && Settings.nav) return Settings.nav(); } catch (e) {} return { menu: true, edge: 22, threshold: 60, haptic: true }; };
  const cur = () => (typeof view !== 'undefined' ? view : 'home');
  const tick = () => { try { if (NS().haptic && window.Prefs && Prefs.haptic) Prefs.haptic(); } catch (e) {} };
  const IC = {
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h4.5v-6h4v6h4.5V9.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    cards: '<rect x="4" y="6" width="13" height="14" rx="2"/><path d="M8 3h10a2 2 0 0 1 2 2v12"/>', add: '<path d="M12 5v14M5 12h14"/>', browse: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    stats: '<path d="M5 20V11M12 20V5M19 20v-7"/>', weak: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 6.2l1.7 1.7M18.1 16.1l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.2 17.8l1.7-1.7M18.1 7.9l1.7-1.7"/>',
    learn: '<path d="M3 8.5 12 4l9 4.5-9 4.5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>', lib: '<path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1 -3.6 14.5-3.8-1"/>', res: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/>',
    doc: '<path d="M6 3v6a6 6 0 0 0 12 0V3"/><circle cx="18" cy="16" r="2.5"/><path d="M12 15v1a5 5 0 0 0 5 5"/>', play: '<path d="M7 5v14l11-7z"/>',
    body: '<circle cx="12" cy="4.5" r="2"/><path d="M8 9h8l-1 6h-6zM10 15l-1 6M14 15l1 6"/>', brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7 18a2.8 2.8 0 0 0 5 1.2V5.6A2.6 2.6 0 0 0 9 4.5z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-3 5.3 2.8 2.8 0 0 1-5 1.2"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>', quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.6v.1"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'
  };
  const svg = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 22}" height="${s || 22}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
  const ax = sel => () => { const run = () => { const b = document.querySelector(sel); if (b) b.click(); }; if (cur() !== 'anat') { go('anat'); setTimeout(run, 400); } else run(); };
  const cardsMenu = () => ({ t: 'Cards', items: [['cards', 'Decks', () => go('decks')], ['add', 'Add card', () => go('add')], ['browse', 'Browse', () => go('browse')], ['weak', 'Weak spots', () => go('weak')], ['stats', 'Stats', () => go('stats')], ['gear', 'Cards settings', () => openSet('cards')]] });
  const MENUS = {
    decks: cardsMenu, study: cardsMenu, add: cardsMenu, browse: cardsMenu, stats: cardsMenu, settings: cardsMenu, weak: cardsMenu,
    learn: () => ({ t: 'Learn', items: [['learn', 'All courses', () => { go('learn'); const b = document.querySelector('#v-learn [data-lhome]'); if (b) b.click(); }], ['weak', 'Weak spots', () => go('weak')], ['gear', 'Learn settings', () => openSet('learn')], ['gear', 'Study settings', () => openSet('study')]] }),
    library: () => ({ t: 'Library', items: [['lib', 'Deck library', () => libMode('decks')], ['res', 'Textbooks', () => libMode('textbook')], ['play', 'Videos', () => libMode('video')], ['res', 'PDFs', () => libMode('pdf')], ['quiz', 'Games', () => libMode('game')], ['learn', 'Courses & tools', () => libMode('site')], ['gear', 'Library settings', () => openSet('library')]] }),
    doc: () => ({ t: 'Doctordle', items: [['play', "Today's case", () => go('doc')], ['gear', 'Doctordle settings', () => openSet('doc')]] }),
    anat: () => ({ t: 'Anatomy', items: [['body', 'Whole body', ax('[data-axregion=body]')], ['brain', 'Brain', ax('[data-axregion=brain]')], ['search', 'Search structures', ax('[data-axfind]')], ['layers', 'Layers', ax('[data-axlayers]')], ['quiz', 'Quiz me', ax('.ax-side [data-axquiz]')], ['gear', 'Anatomy settings', () => openSet('anat')]] }),
    x: () => (window.Lab && Lab.menuFor && Lab.menuFor()) || ({ t: ($('#title') || {}).textContent || 'More', items: [['gear', 'Settings', () => openSet()]] }),
  };
  function libMode(m) { if (window.Resources && Resources._S) { Resources._S.mode = m; try { localStorage.setItem('res.mode', m); } catch (e) {} } go('library'); }
  function openSet(page) { if (window.SettingsUI && SettingsUI.open) SettingsUI.open(page); else go('prefs'); }
  let el = null, open = false;
  function build() {
    if (el) return el;
    el = document.createElement('div'); el.id = 'navMenu'; el.className = 'nm'; el.hidden = true;
    el.innerHTML = '<div class="nm-bd" data-nmclose></div><nav class="nm-p" role="dialog" aria-modal="true" aria-label="Section menu"><div class="nm-in"></div></nav>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { const c = e.target.closest('[data-nmclose]'); if (c) { close(); return; } const b = e.target.closest('[data-nmi]'); if (!b) return; const fn = el._items[+b.dataset.nmi]; tick(); close(true); setTimeout(() => { try { fn(); } catch (er) { console.warn(er); } }, 10); });
    // swipe the panel back to the left to close
    let sx = 0, dx = 0, on = false; const p = el.querySelector('.nm-p');
    p.addEventListener('touchstart', e => { sx = e.touches[0].clientX; dx = 0; on = true; p.style.transition = 'none'; }, { passive: true });
    p.addEventListener('touchmove', e => { if (!on) return; dx = Math.min(0, e.touches[0].clientX - sx); p.style.transform = `translateX(${dx}px)`; }, { passive: true });
    p.addEventListener('touchend', () => { if (!on) return; on = false; p.style.transition = ''; p.style.transform = ''; if (dx < -70) close(); });
    return el;
  }
  function paint() {
    const v = cur(); const m = (MENUS[v] || (() => ({ t: '', items: [] })))();
    const items = [['home', 'Home', () => go('home')], ...m.items];
    if (!m.items.some(i => /settings/i.test(i[1]))) items.push(['gear', 'Settings', () => openSet()]);
    el._items = items.map(i => i[2]);
    el.querySelector('.nm-in').innerHTML = `<div class="nm-h">${m.t ? `<span class="nm-k">Menu</span><b>${m.t}</b>` : '<b>Menu</b>'}</div>
      <div class="nm-list">${items.map((it, i) => `${i === 1 ? '<div class="nm-sep"></div>' : ''}<button class="nm-i${i === 0 ? ' nm-home' : ''}" data-nmi="${i}" type="button"><span class="nm-ic">${svg(it[0], 20)}</span><span>${it[1]}</span></button>`).join('')}</div>`;
  }
  function show() { if (cur() === 'home') return; build(); paint(); el.hidden = false; void el.offsetWidth; el.classList.add('on'); open = true; document.documentElement.classList.add('nm-open'); if (strip) strip.hidden = true; }
  function close(fast) { if (!el || el.hidden) return; el.classList.remove('on'); open = false; document.documentElement.classList.remove('nm-open'); setTimeout(() => { if (!open) el.hidden = true; }, fast ? 180 : 260); }
  // ☰ next to the house in the top bar
  function header() {
    const hb = $('#homeBtn'); if (!hb || hb.dataset.nav) return; hb.dataset.nav = '1';
    hb.innerHTML = svg('home', 22) + '<span class="sr">Home</span>'; hb.setAttribute('aria-label', 'Home'); hb.classList.add('nm-house');
    const mb = document.createElement('button'); mb.id = 'menuBtn'; mb.type = 'button'; mb.className = 'nm-burger'; mb.setAttribute('aria-label', 'Menu'); mb.innerHTML = svg('menu', 22);
    mb.addEventListener('click', () => { tick(); show(); }); hb.insertAdjacentElement('afterend', mb);
  }
  // edge swipe: a thin strip on the left edge owns the gesture (so the 3D canvas / lists don't), a tap on it is passed through
  let strip = null, st = null;
  function edgeOn() { const v = cur(); return v !== 'home' && v !== 'prefs' && NS().menu && !document.querySelector('#sheetWrap:not([hidden])') && !open; }
  function ensureStrip() {
    if (strip) return strip;
    strip = document.createElement('div'); strip.id = 'navEdge'; strip.className = 'nm-edge'; document.body.appendChild(strip);
    strip.addEventListener('touchstart', e => { if (!edgeOn() || e.touches.length !== 1) { st = null; return; } const t = e.touches[0]; st = { x: t.clientX, y: t.clientY, dx: 0, live: false, t0: performance.now() }; }, { passive: true });
    strip.addEventListener('touchmove', e => {
      if (!st) return; const t = e.touches[0]; st.dx = t.clientX - st.x; const dy = t.clientY - st.y;
      if (!st.live && Math.abs(dy) > 24 && Math.abs(dy) > st.dx) { st = null; return; }
      if (e.cancelable) e.preventDefault();
      if (!st.live && st.dx > 8) { st.live = true; build(); paint(); el.hidden = false; el.classList.add('drag'); }
      if (st.live) { const w = el.querySelector('.nm-p').offsetWidth || 300; const k = Math.max(0, Math.min(1, st.dx / w)); el.querySelector('.nm-p').style.transform = `translateX(${(k - 1) * 100}%)`; el.querySelector('.nm-bd').style.opacity = String(k); }
    }, { passive: false });
    strip.addEventListener('touchend', e => {
      if (!st) return; const s = st; st = null;
      if (s.live) { const p = el.querySelector('.nm-p'), bd = el.querySelector('.nm-bd'); el.classList.remove('drag'); p.style.transform = ''; bd.style.opacity = ''; if (s.dx > Math.min(NS().threshold || 60, 90)) { tick(); el.classList.add('on'); open = true; document.documentElement.classList.add('nm-open'); } else close(true); return; }
      if (Math.abs(s.dx) < 6 && performance.now() - s.t0 < 400) { const t = e.changedTouches[0]; strip.style.pointerEvents = 'none'; const under = document.elementFromPoint(t.clientX, t.clientY); strip.style.pointerEvents = ''; if (under && under.click) { e.preventDefault(); under.click(); } }
    });
    return strip;
  }
  function sync() { header(); ensureStrip(); const on = edgeOn(); strip.hidden = !on; if (open && cur() === 'home') close(true); }
  // keep in step with navigation
  const _go = window.go; if (typeof go === 'function') { window.go = function () { const r = _go.apply(this, arguments); try { sync(); } catch (e) {} return r; }; try { go = window.go; } catch (e) {} }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) close(); });
  try { if (window.Settings) Settings.on('nav.*', () => sync()); } catch (e) {}
  const boot = () => { sync(); new MutationObserver(() => { if (strip) strip.hidden = !edgeOn(); }).observe(document.getElementById('main') || document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.NavMenu = { open: show, close, sync, get isOpen() { return open; } };
})();
