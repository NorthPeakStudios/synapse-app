/* Synapse native boot. Ships inside the Android/iOS app and is never live-updated, so keep it small.
   1) sets the app flags (site, store mode, no service worker)
   2) picks the page source: a downloaded update ("overlay", see native/app.js → OdinUpdate) or the bundled copy
   3) rewrites the page's files that the update changed to their downloaded copies, patches fetch the same way,
      and points /api/ calls at the live site
   4) rolls back an update that never finishes booting (2 tries). */
(function () {
  'use strict';
  var CFG = window.__ODIN_CFG || {}, SITE = CFG.site || 'https://odin-cards.sites.tab.bot';
  window.ODIN_SITE = SITE; window.ODIN_API = SITE; window.ODIN_STORE = !!CFG.store; window.NO_SW = true;
  var N = window.OdinNative = window.OdinNative || {}; N.cfg = CFG;
  var LS = window.localStorage, KEY = 'ou.state', st = null;
  try { st = JSON.parse(LS.getItem(KEY) || 'null'); } catch (e) { st = null; }
  st = st || {};
  function save() { try { LS.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function html(v, page) { try { return LS.getItem('ou.html.' + v + '.' + page); } catch (e) { return null; } }
  // a staged update becomes active on this launch
  if (st.next && st.next.v) { st.prev = st.active || null; st.active = st.next; st.next = null; st.trial = { v: st.active.v, boots: 0 }; save(); }
  // an update that started twice without reporting ready is rolled back
  if (st.trial && st.active && st.trial.v === st.active.v) {
    st.trial.boots = (st.trial.boots || 0) + 1;
    if (st.trial.boots > 2) { st.bad = st.active.v; st.active = st.prev && st.prev.v !== st.bad ? st.prev : null; st.prev = null; st.trial = null; st.rolledBack = Date.now(); }
    save();
  }
  var A = st.active && st.active.v && st.active.base && st.active.files ? st.active : null;
  N.overlay = A ? { v: A.v, at: A.at || 0 } : null; N.rolledBack = st.rolledBack || 0;
  var F = A ? A.files : null, BASE = A ? A.base : '';
  var path = location.pathname.replace(/^\/+/, ''); if (!path || /\/$/.test(path)) path += 'index.html';
  var dir = path.indexOf('/') >= 0 ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  function norm(rel) { // relative URL in this page → site path, or null
    if (!rel || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(rel) || rel.charAt(0) === '#') return null;
    var p = rel.charAt(0) === '/' ? rel.slice(1) : dir + rel;
    var parts = [], segs = p.split('/');
    for (var i = 0; i < segs.length; i++) { var s = segs[i]; if (s === '..') parts.pop(); else if (s !== '.' && s !== '') parts.push(s); }
    return parts.join('/');
  }
  function enc(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function over(p) { return F && p && F[p] ? BASE + enc(p) : null; }
  N.overURL = function (rel) { var p = norm(rel); return over(p); };
  // fetch: /api/ → live site; changed files → downloaded copy; store build only lists library decks with an open licence
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var lib = false;
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var u = new URL(url, location.href);
      if (u.origin === location.origin && u.pathname.indexOf('/_capacitor_') !== 0) {
        var nu = null;
        if (u.pathname.indexOf('/api/') === 0) { nu = SITE + u.pathname + u.search; lib = window.ODIN_STORE && u.pathname === '/api/lib/index'; }
        else { var o = over(decodeURIComponent(u.pathname.slice(1))); if (o) nu = o + u.search; }
        if (nu) input = typeof input === 'string' || input instanceof URL ? nu : new Request(nu, input);
      }
    } catch (e) {}
    var pr = _fetch(input, init);
    if (!lib) return pr;
    return pr.then(function (r) {
      return r.clone().json().then(function (j) {
        if (j && Array.isArray(j.decks)) j.decks = j.decks.filter(function (d) { var l = (d.source && d.source.license) || ''; return /\b(CC0|CC[ -]BY|creative commons|public domain|MIT|Apache|GPL)\b/i.test(l) && !/no licen[cs]e stated/i.test(l); });
        return new Response(JSON.stringify(j), { status: r.status, headers: { 'content-type': 'application/json' } });
      }).catch(function () { return r; });
    });
  };
  // page source
  var src = (A && html(A.v, path)) || (window.__ODIN_PAGES || {})[path];
  if (!src) { document.write('<p style="font:16px system-ui;padding:40px">This page isn’t part of the app.</p>'); return; }
  // CSP: allow the live site for API calls and images
  src = src.replace(/connect-src 'self'/, "connect-src 'self' " + SITE).replace(/img-src 'self'/, "img-src 'self' " + SITE);
  // changed files → downloaded copies
  if (F) src = src.replace(/(\s(?:src|href)=")([^"]+)(")/g, function (m, a, rel, b) { var o = over(norm(rel.split(/[?#]/)[0])); return o ? a + o + rel.slice(rel.split(/[?#]/)[0].length) + b : m; });
  // native glue first, its stylesheet last in <head>
  var app = over('native/app.js') || 'native/app.js', css = over('native/native.css') || 'native/native.css';
  var rel = dir ? dir.split('/').filter(Boolean).map(function () { return '..'; }).join('/') + '/' : '';
  if (app.indexOf('://') < 0) app = rel + app; if (css.indexOf('://') < 0) css = rel + css;
  src = src.replace(/<script\b/i, '<script src="' + app + '"></script><script');
  src = src.replace(/<\/head>/i, '<link rel="stylesheet" href="' + css + '"></head>');
  // iOS sideload build: re-sign reminder (native-only file, never live-updated)
  if (CFG.resign) src = src.replace(/<\/head>/i, '<script src="' + rel + 'native/resign.js"></script></head>');
  src = src.replace(/^\s*<!doctype[^>]*>/i, '');
  document.write(src);
})();
