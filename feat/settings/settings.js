/* Settings API (feat/settings/settings.js) — one store for every option in the app.
   window.Settings = { get(key), set(key, value), on(key | 'prefix.*' | '*', fn) -> off(), all(), reset(), DEF, apply(),
                       anat(), nav(), weakDays(), orderCards(list, kind), matchTyped(given, accepted, strict) }
   Keys that already exist in Prefs (theme, accent, text, home.*, cards.*, learn.level, doc.* ...) read and write
   through Prefs, so old code keeps working. Everything else lives in localStorage 'settings.v2' and syncs through D1 as
   progress record id 'settings2' (t:'prefs2'), newest 'at' wins. Load right after prefs.js; app.js globals are used lazily. */
(function () {
  'use strict';
  if (window.Settings) return;
  const KEY = 'settings.v2';
  const D = {
    // appearance
    'ui.font': 'system', 'ui.bold': false, 'ui.lineSpacing': 'normal', 'ui.corners': 'rounded', 'ui.blur': true, 'ui.contrast': false,
    'ui.bg': 'solid', 'ui.tileSize': 'm', 'ui.iconStyle': 'regular', 'ui.density': 'comfortable',
    // home
    'home.greeting': true, 'home.today': true, 'home.plan': true, 'home.statsCard': false, 'home.launch': 'home', 'home.appsTitle': true,
    // navigation
    'nav.swipeMenu': true, 'nav.swipeSens': 'medium', 'nav.homeBtn': 'top-left', 'nav.haptic': true, 'nav.swipeBack': true,
    // study
    'study.session': 0, 'focus.work': 25, 'focus.brk': 5, 'focus.cards': true, 'study.reviewLimit': 200, 'study.order': 'due', 'study.autoplay': false, 'study.romanization': true,
    'study.strict': 'normal', 'study.hints': true, 'study.timer': false, 'study.intervals': true, 'weak.weight': 'balanced',
    'tts.de.rate': 1, 'tts.fr.rate': 1, 'tts.es.rate': 1, 'tts.en.rate': 1, 'tts.de.voice': '', 'tts.fr.voice': '', 'tts.es.voice': '', 'tts.en.voice': '',
    // per app
    'cards.flip': 'flip', 'cards.swipe': true,
    'learn.testLen': 0, 'learn.explain': 'always', 'learn.slow': false,
    'doc.clueOrder': 'classic',
    'anat.sex': 'm', 'anat.layers': ['skin'], 'anat.labelSize': 'm', 'anat.quality': 'high', 'anat.shadows': true, 'anat.autoRotate': false,
    'anat.sensitivity': 1, 'anat.isolate': 'ghost', 'anat.labels': true,
    'lib.mode': 'decks', 'lib.sort': 'popular', 'res.openIn': 'app',
    // notifications
    'notify.second': '', 'notify.quiet': false, 'notify.quietFrom': '22:00', 'notify.quietTo': '07:00', 'notify.recapDay': 'sun', 'notify.badge': false,
    // accessibility
    'a11y.reduceTransparency': false, 'a11y.bigTargets': false, 'a11y.dyslexia': false, 'a11y.captions': false, 'a11y.underline': false,
    // data
    'data.sync': true
  };
  // keys stored outside this store (existing modules read them there)
  const LOCAL = { 'learn.slow': ['learn.slow', v => v ? '1' : '0', s => s === '1'], 'lib.mode': ['res.mode', v => v, s => s] };
  const clone = o => JSON.parse(JSON.stringify(o));
  let S = load();
  function load() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.v) return o; } catch (e) {} return { v: {}, at: 0 }; }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function prefPath(k) { if (!window.Prefs) return false; let o = Prefs.DEF; for (const p of k.split('.')) { if (!o || typeof o !== 'object' || Array.isArray(o) || !(p in o)) return false; o = o[p]; } return true; }
  function prefGet(k) { let o = Prefs.v; for (const p of k.split('.')) o = o == null ? undefined : o[p]; return o; }
  function get(k) {
    if (k === 'study.goal') return window.Hub ? Hub.today().goal : 50;
    if (prefPath(k)) return prefGet(k);
    if (k in S.v) return S.v[k];
    if (LOCAL[k]) { try { const s = localStorage.getItem(LOCAL[k][0]); if (s != null) return LOCAL[k][2](s); } catch (e) {} }
    return k in D ? clone(D[k]) : undefined;
  }
  const subs = new Map();
  function on(k, fn) { if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(fn); return () => subs.get(k).delete(fn); }
  function emit(k, val, old, remote) {
    const run = key => { const s = subs.get(key); if (s) s.forEach(f => { try { f(val, old, k, !!remote); } catch (e) { console.warn('settings sub', e); } }); };
    run(k); const parts = k.split('.'); for (let i = parts.length - 1; i > 0; i--) run(parts.slice(0, i).join('.') + '.*'); run('*');
  }
  function set(k, val) {
    const old = get(k);
    if (JSON.stringify(old) === JSON.stringify(val)) return;
    if (k === 'study.goal') { if (window.Hub) Hub.setGoal(+val); }
    else if (prefPath(k)) { Prefs.set(k, val); if (k === 'icon') setIcon(val); }
    else { S.v[k] = val; S.at = Date.now(); persist(); if (LOCAL[k]) { try { localStorage.setItem(LOCAL[k][0], LOCAL[k][1](val)); } catch (e) {} } pushSoon(); }
    if (k === 'lib.mode' && window.Resources && Resources._S) Resources._S.mode = val;
    apply(); emit(k, val, old, false);
  }
  function setIcon(k) { const href = k === 'default' ? 'apple-touch-icon.png' : 'icons/app-' + k + '.png'; document.querySelectorAll('link[rel=apple-touch-icon]').forEach(l => { l.href = href; }); }
  function all() { const o = {}; for (const k in D) o[k] = get(k); return o; }
  function reset() { const old = S.v; S = { v: {}, at: Date.now() }; persist(); for (const k in LOCAL) try { localStorage.removeItem(LOCAL[k][0]); } catch (e) {} if (window.Prefs) Prefs.reset(); pushSoon(); apply(); Object.keys(old).forEach(k => emit(k, get(k), old[k], false)); emit('*', null, null, false); }

  /* ---------- sync through the app's D1 sync (progress record 'settings2') ---------- */
  let pushT = 0;
  function pushSoon() { clearTimeout(pushT); pushT = setTimeout(() => { try { if (typeof write !== 'function' || typeof M === 'undefined') return; write([['progress', { ...(M.progress.get('settings2') || {}), id: 'settings2', t: 'prefs2', data: S.v, at: S.at, del: 0 }]]); } catch (e) { console.warn('settings push', e); } }, 1200); }
  function pull() {
    try {
      const r = M.progress.get('settings2'); if (!r || r.del || !r.data || !((r.at || 0) > (S.at || 0))) return;
      const old = S.v; S = { v: r.data, at: r.at }; persist();
      for (const k in LOCAL) if (k in S.v) try { localStorage.setItem(LOCAL[k][0], LOCAL[k][1](S.v[k])); } catch (e) {}
      apply(); new Set([...Object.keys(old), ...Object.keys(S.v)]).forEach(k => { if (JSON.stringify(old[k]) !== JSON.stringify(S.v[k])) emit(k, get(k), old[k], true); });
    } catch (e) {}
  }

  /* ---------- apply: CSS variables + classes on :root ---------- */
  const de = document.documentElement;
  const FONTS = { system: '-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif', rounded: '"SF Pro Rounded",ui-rounded,-apple-system,system-ui,sans-serif', serif: '"New York",ui-serif,"Iowan Old Style",Georgia,serif', mono: 'ui-monospace,"SF Mono",Menlo,monospace' };
  const CORNERS = { square: [6, 4], rounded: [16, 12], round: [22, 16] };
  const SENS = { low: [14, 120], medium: [24, 90], high: [40, 60] };
  const cls = (c, on) => de.classList.toggle(c, !!on);
  let lastCls = [];
  function apply() {
    const g = get;
    const font = FONTS[g('ui.font')] ? g('ui.font') : 'system';
    de.style.setProperty('--app-font', FONTS[font]); cls('s-font', font !== 'system');
    cls('s-bold', g('ui.bold'));
    const r = CORNERS[g('ui.corners')] || CORNERS.rounded; de.style.setProperty('--r', r[0] + 'px'); de.style.setProperty('--r-sm', r[1] + 'px');
    cls('s-noblur', !g('ui.blur') || g('a11y.reduceTransparency')); cls('s-solid', g('a11y.reduceTransparency'));
    cls('s-contrast', g('ui.contrast'));
    cls('s-no-greeting', !g('home.greeting')); cls('s-no-today', !g('home.today')); cls('s-no-plan', !g('home.plan')); cls('s-no-appstitle', !g('home.appsTitle'));
    cls('s-big', g('a11y.bigTargets')); cls('s-dys', g('a11y.dyslexia')); cls('s-underline', g('a11y.underline'));
    cls('s-no-roman', !g('study.romanization')); cls('s-no-hints', !g('study.hints')); cls('s-no-ivl', !g('study.intervals'));
    // value-classes (replaced as a set)
    const vc = ['s-ls-' + g('ui.lineSpacing'), 's-bg-' + g('ui.bg'), 's-tile-' + g('ui.tileSize'), 's-ic-' + g('ui.iconStyle'), 's-dens-' + g('ui.density'),
      's-expl-' + g('learn.explain'), 's-flip-' + g('cards.flip'), 's-hb-' + g('nav.homeBtn'), 's-lbl-' + g('anat.labelSize')];
    lastCls.forEach(c => de.classList.remove(c)); vc.forEach(c => de.classList.add(c)); lastCls = vc;
    const sn = SENS[g('nav.swipeSens')] || SENS.medium; de.style.setProperty('--swipe-edge', sn[0] + 'px');
    de.style.setProperty('--anat-label-scale', { s: .85, m: 1, l: 1.2, xl: 1.4 }[g('anat.labelSize')] || 1);
  }
  function prefGetSafe(k) { try { return prefGet(k); } catch (e) { return null; } }
  apply();
  if (window.Prefs) Prefs.onChange(remote => { apply(); emit('*', null, null, remote); });

  /* ---------- helpers other modules read ---------- */
  function anat() {
    const q = get('anat.quality'), dpr = window.devicePixelRatio || 1;
    return {
      sex: get('anat.sex'), layers: get('anat.layers'), labelSize: get('anat.labelSize'), labels: !!get('anat.labels'), quality: q,
      pixelRatio: { low: Math.min(dpr, 1), medium: Math.min(dpr, 1.5), high: Math.min(dpr, 3), ultra: Math.min(dpr, 3) }[q] || Math.min(dpr, 3),
      antialias: q !== 'low', shadows: !!get('anat.shadows') && q !== 'low', shadowMapSize: { low: 0, medium: 1024, high: 2048, ultra: 4096 }[q] || 2048,
      autoRotate: !!get('anat.autoRotate'), sensitivity: +get('anat.sensitivity') || 1, isolate: get('anat.isolate'),
      ghostOpacity: { ghost: .12, dim: .35, hide: 0 }[get('anat.isolate')] ?? .12
    };
  }
  function nav() { const sn = SENS[get('nav.swipeSens')] || SENS.medium; return { menu: !!get('nav.swipeMenu'), back: !!get('nav.swipeBack'), edge: sn[0], threshold: sn[1], homeBtn: get('nav.homeBtn'), haptic: !!get('nav.haptic') }; }
  function weakDays() { return { light: [2, 5, 12], balanced: [1, 3, 7], heavy: [1, 2, 4] }[get('weak.weight')] || [1, 3, 7]; }
  // daily-stable shuffle so a reload doesn't reshuffle mid-session
  function seeded(id) { let h = 2166136261 ^ Math.floor(Date.now() / 864e5); for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return h >>> 0; }
  function orderCards(list, kind) {
    const o = get('study.order');
    if (o === 'random') list.sort((a, b) => seeded(String(a.id)) - seeded(String(b.id)));
    else if (kind === 'new' && o === 'newest') list.sort((a, b) => (b.pos || 0) - (a.pos || 0) || (a.id < b.id ? 1 : -1));
    return list;
  }
  const strip = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  function lev(a, b) { if (a === b) return 0; const m = a.length, n = b.length; if (!m || !n) return m || n; let p = Array.from({ length: n + 1 }, (_, i) => i); for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[n]; }
  // given + accepted are already normalized by the caller; returns true/false
  function matchTyped(given, accepted, strict) {
    const mode = strict || get('study.strict');
    if (mode === 'exact') return accepted.includes(given);
    if (accepted.includes(given)) return true;
    if (mode === 'lenient') return accepted.some(a => { const x = strip(a), y = strip(given); return x === y || lev(x, y) <= Math.max(1, Math.floor(x.length / 6)); });
    const soft = s => strip(s).replace(/^(the|a|an) /, '').replace(/[-\u2010-\u2014\s]+/g, '');
    const plural = (x, y) => x === y || x + 's' === y || y + 's' === x || x + 'es' === y || y + 'es' === x;
    return accepted.some(a => strip(a) === strip(given) || plural(soft(a), soft(given)) || (a.length >= 8 && lev(a, given) <= 1));
  }

  /* ---------- behaviours that need no hooks in other files ---------- */
  let lastTap = 0;
  document.addEventListener('pointerdown', () => { lastTap = Date.now(); }, true);
  function boot() {
    try { changeHooks.push(pull); pull(); } catch (e) {}
    // go(): haptic on gesture navigation (button taps already tick), remember the last screen
    if (typeof window.go === 'function' && !window.go._st) {
      const og = window.go;
      window.go = function (v) { try { if (get('nav.haptic') && Date.now() - lastTap > 400 && window.Prefs && typeof view !== 'undefined' && v !== view) Prefs.haptic(); if (v && v !== 'prefs' && v !== 'x') localStorage.setItem('settings.last', v); } catch (e) {} return og.apply(this, arguments); };
      window.go._st = 1;
    }
    // sync on/off: background syncs skip while off; "Sync now" still works
    if (typeof window.syncNow === 'function' && !window.syncNow._st) {
      const os = window.syncNow;
      window.syncNow = function (loud) { if (!loud && get('data.sync') === false) return Promise.resolve(); return os.apply(this, arguments); };
      window.syncNow._st = 1;
    }
    // review limit (decks without their own limit)
    if (typeof window.deckOpt === 'function' && !window.deckOpt._st) {
      const od = window.deckOpt;
      window.deckOpt = function (id) { const o = od.apply(this, arguments); try { const d = M.decks.get(id); if (!(d && Number.isFinite(d.revPerDay))) o.revPerDay = +get('study.reviewLimit') || 200; } catch (e) {} return o; };
      window.deckOpt._st = 1;
    }
    // card order: same queue as app.js nextCard, with the chosen order
    if (typeof window.nextCard === 'function' && !window.nextCard._st) {
      const on_ = window.nextCard;
      window.nextCard = function (deckId, now = Date.now()) {
        if (get('study.order') === 'due') return on_.apply(this, arguments);
        try {
          const ids = scopeDecks(deckId), tagMode = deckId.startsWith('tag:'), end = dayStart(now) + DAY, done = todayDone(now), lrn = [], rev = [], nw = [];
          for (const c of M.cards.values()) {
            if (c.del || c.susp || !ids.has(c.deck) || !M.decks.get(c.deck) || M.decks.get(c.deck).del || (tagMode && !cardInScope(c, deckId))) continue;
            if (c.st === 0) nw.push(c); else if (c.st === 2) { if (c.due < end) rev.push(c); } else if (c.due < end) lrn.push(c);
          }
          lrn.sort((a, b) => a.due - b.due); rev.sort((a, b) => a.due - b.due); nw.sort((a, b) => a.pos - b.pos || (a.id < b.id ? -1 : 1));
          orderCards(rev, 'review'); orderCards(nw, 'new');
          const revLeft = {}, newLeft = {};
          for (const id of ids) { const o = deckOpt(id), dd = done[id] || { n: 0, r: 0 }; revLeft[id] = tagMode ? 1e9 : o.revPerDay - dd.r; newLeft[id] = tagMode ? 1e9 : o.newPerDay - dd.n; }
          const dueL = lrn.find(c => c.due <= now); if (dueL) return { card: dueL };
          const newFirst = get('study.order') === 'newfirst';
          const r = rev.find(c => revLeft[c.deck] > 0), nn = nw.find(c => newLeft[c.deck] > 0);
          if (newFirst && nn) return { card: nn }; if (r) return { card: r }; if (nn) return { card: nn };
          const ahead = lrn.find(c => c.due <= now + 20 * 60000); if (ahead) return { card: ahead };
          if (lrn.length) return { wait: lrn[0].due - now };
          return {};
        } catch (e) { return on_.apply(this, arguments); }
      };
      window.nextCard._st = 1;
    }
    launch();
    badge();
    try { if (window.Hub) Hub.onChange(badge); changeHooks.push(badge); } catch (e) {}
  }
  // default screen on launch (once per app start, only from a plain start on Home)
  function launch() {
    let to = get('home.launch'); if (to === 'last') { try { to = localStorage.getItem('settings.last') || 'home'; } catch (e) { to = 'home'; } }
    if (!to || to === 'home' || location.hash.length > 1) return;
    let n = 0; const t = setInterval(() => { n++; if (typeof view !== 'undefined' && document.querySelector('#v-home .h-top')) { clearInterval(t); if (view === 'home') try { window.go(to); } catch (e) {} } else if (n > 60) clearInterval(t); }, 100);
  }
  // app icon badge = cards due + weak spots (Home Screen app, iOS 16.4+, needs notification permission)
  let bT = 0;
  function badge() {
    clearTimeout(bT); bT = setTimeout(() => {
      try {
        if (!('setAppBadge' in navigator)) return;
        if (!get('notify.badge')) { navigator.clearAppBadge && navigator.clearAppBadge().catch(() => {}); return; }
        const n = (window.Home ? Home.dueCards() : 0) + (window.Weak ? Weak.dueCount() : 0);
        (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
      } catch (e) {}
    }, 800);
  }
  on('notify.badge', badge);
  // edge swipe back off: swallow edge touches before the app's swipe handler sees them
  window.addEventListener('touchstart', e => { try { if (get('nav.swipeBack') || e.touches.length !== 1 || e.touches[0].clientX > 24) return; if (e.target.closest && e.target.closest('#v-prefs, #navEdge, #navMenu')) return; e.stopPropagation(); } catch (x) {} }, { capture: true, passive: true });

  // text-to-speech: per-language speed + voice, and captions
  const LANGS = ['de', 'fr', 'es', 'en'];
  function voices() { try { return speechSynthesis.getVoices() || []; } catch (e) { return []; } }
  let capEl = null, capT = 0;
  function caption(text, on_) {
    if (!capEl) { capEl = document.createElement('div'); capEl.className = 'st-cap'; capEl.setAttribute('aria-live', 'polite'); document.body.appendChild(capEl); }
    clearTimeout(capT);
    if (on_) { capEl.textContent = text; capEl.classList.add('on'); capT = setTimeout(() => capEl.classList.remove('on'), Math.max(2500, text.length * 90)); }
    else capT = setTimeout(() => capEl.classList.remove('on'), 600);
  }
  // iPhone silent switch: speech is muted unless the page's audio session is "playback" while it talks.
  // hold() runs inside the tap (synchronously, before speak): audioSession -> playback (iOS 16.4+), plus a looping
  // silent <audio> as the older fallback. release() puts both back once speech has finished, so the mic and other apps' audio are untouched.
  const TTSAudio = (function () {
    const SIL = 'data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
    let el = null, prev = null, offT = 0;
    function hold() {
      clearTimeout(offT);
      try { const as = navigator.audioSession; if (as && as.type !== 'playback') { if (prev === null) prev = as.type || 'auto'; as.type = 'playback'; } } catch (e) {}
      try {
        if (!el) { el = document.createElement('audio'); el.src = SIL; el.loop = true; el.preload = 'auto'; el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); try { el.disableRemotePlayback = true; } catch (e) {} }
        if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(() => {}); }
      } catch (e) {}
    }
    function release() {
      clearTimeout(offT);
      try { if (el && !el.paused) el.pause(); } catch (e) {}
      try { const as = navigator.audioSession; if (as && prev !== null) as.type = prev; } catch (e) {}
      prev = null;
    }
    function settle() { clearTimeout(offT); offT = setTimeout(() => { try { if (speechSynthesis.speaking || speechSynthesis.pending) return settle(); } catch (e) {} release(); }, 800); }
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
    return { hold, release, settle };
  })();
  window.TTSAudio = TTSAudio;
  try {
    if ('speechSynthesis' in window && !speechSynthesis._st) {
      const sp = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = function (u) {
        try { TTSAudio.hold(); u.addEventListener('end', TTSAudio.settle); u.addEventListener('error', TTSAudio.settle); } catch (e) {}
        try { if (speechSynthesis.paused) speechSynthesis.resume(); } catch (e) {}
        try {
          const l = String(u.lang || '').slice(0, 2).toLowerCase();
          if (LANGS.includes(l)) {
            u.rate = Math.max(.3, Math.min(2, (u.rate || 1) * (+get('tts.' + l + '.rate') || 1)));
            const vn = get('tts.' + l + '.voice'); if (vn) { const v = voices().find(x => x.name === vn); if (v) u.voice = v; }
          }
          if (get('a11y.captions') && u.text) { caption(u.text, true); u.addEventListener('end', () => caption('', false)); }
        } catch (e) {}
        return sp(u);
      };
      speechSynthesis._st = 1;
    }
  } catch (e) {}

  // study helpers: session length nudge, elapsed timer, swipe to grade, flip animation, autoplay
  let sessN = 0, sessView = '';
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('#v-study [data-grade]'); if (!g) return;
    const lim = +get('study.session'); if (!lim) return;
    sessN++; if (sessN === lim && typeof toast === 'function') toast('Session done: ' + lim + ' cards. Keep going or take a break.', 3200);
  }, true);
  let timerEl = null, t0 = 0, lastKey = '';
  setInterval(() => {
    try {
      const v = typeof view !== 'undefined' ? view : '';
      if (v !== sessView) { sessView = v; if (v === 'study') sessN = 0; }
      const testOn = v === 'learn' && document.querySelector('#v-learn #ltyped, #v-learn .lq, #v-learn [data-lnext]');
      const on_ = get('study.timer') && (v === 'study' || testOn || v === 'doc');
      if (!on_) { if (timerEl) timerEl.hidden = true; lastKey = ''; return; }
      const key = v + (testOn ? 't' : '');
      if (key !== lastKey) { lastKey = key; t0 = Date.now(); }
      if (!timerEl) { timerEl = document.createElement('div'); timerEl.className = 'st-timer'; document.body.appendChild(timerEl); }
      const s = Math.floor((Date.now() - t0) / 1000); timerEl.hidden = false; timerEl.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    } catch (e) {}
  }, 1000);
  // swipe on the study card: right = Good, left = Again, up = show answer
  let sw = null;
  document.addEventListener('touchstart', e => { const f = e.target.closest && e.target.closest('#v-study #face'); if (!f || !get('cards.swipe') || e.touches.length !== 1) { sw = null; return; } sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, f }; }, { passive: true });
  document.addEventListener('touchmove', e => { if (!sw) return; const dx = e.touches[0].clientX - sw.x; if (document.querySelector('#v-study [data-grade]') && Math.abs(dx) > 10) { sw.f.style.transform = `translateX(${dx * .5}px) rotate(${dx / 40}deg)`; sw.f.classList.toggle('st-sw-good', dx > 60); sw.f.classList.toggle('st-sw-again', dx < -60); } }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!sw) return; const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y, f = sw.f; sw = null;
    f.style.transform = ''; f.classList.remove('st-sw-good', 'st-sw-again');
    const graded = document.querySelector('#v-study [data-grade]');
    if (graded && Math.abs(dx) > 90 && Math.abs(dy) < 80) { const b = document.querySelector(`#v-study [data-grade="${dx > 0 ? 3 : 1}"]`); if (b) b.click(); }
    else if (!graded && dy < -70 && Math.abs(dx) < 60) { const b = document.getElementById('showBtn'); if (b) b.click(); }
  });
  // flip animation + autoplay on reveal
  const mo = new MutationObserver(ms => {
    for (const m of ms) {
      const face = m.target.id === 'face' ? m.target : null;
      if (face && document.querySelector('#v-study [data-grade]')) {
        const fl = get('cards.flip'); if (fl !== 'none' && !de.classList.contains('reduce-motion')) { face.classList.remove('st-anim-flip', 'st-anim-fade'); void face.offsetWidth; face.classList.add('st-anim-' + fl); }
        if (get('study.autoplay')) { const a = face.querySelector('audio'); if (a) a.play().catch(() => {}); else { const b = face.querySelector('[data-vlang],[data-say],.say'); if (b) b.click(); } }
      }
    }
  });
  function observe() { const v = document.getElementById('v-study'); if (v) mo.observe(v, { childList: true, subtree: true }); }

  // home "Stats" widget card (week XP)
  window.HomeExtras = window.HomeExtras || [];
  HomeExtras.push(() => {
    if (!get('home.statsCard') || !window.Hub || !Hub._S) return '';
    const S_ = Hub._S(), days = [], DAYMS = 864e5; let tot = 0, max = 1;
    for (let i = 6; i >= 0; i--) { const t = Date.now() - i * DAYMS, k = Hub.dayKey(t), x = (S_.days[k] && S_.days[k].xp) || 0; tot += x; max = Math.max(max, x); days.push([new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), x]); }
    return `<button class="st-wk" data-st-wk type="button"><span class="st-wk-h"><span>This week</span><b>${tot} XP</b></span><span class="st-wk-b">${days.map(([d, x]) => `<span><i style="height:${Math.max(6, Math.round(x / max * 100))}%" class="${x ? '' : 'z'}"></i><small>${d}</small></span>`).join('')}</span></button>`;
  });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-st-wk]')) go('stats'); });
  on('home.*', () => { try { if (typeof view !== 'undefined' && view === 'home' && window.Home) Home.render(); } catch (e) {} });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { boot(); observe(); }); else setTimeout(() => { boot(); observe(); }, 0);

  window.Settings = { get, set, on, all, reset, apply, DEF: D, FONTS, anat, nav, weakDays, orderCards, matchTyped, voices, pull, _S: () => S };
})();
