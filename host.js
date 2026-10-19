/* Synapse on GitHub Pages (NorthPeakStudios/synapse-app). The app's server (accounts, sync, deck library, buy requests,
   unlock codes, reminders) and the big 3D anatomy models stay on odin-cards.sites.tab.bot; this sends those requests there.
   Signed in here, the session is a bearer token in this browser's storage (a cross-site cookie would not be sent). */
(function () {
  'use strict';
  var SITE = 'https://odin-cards.sites.tab.bot', BASE = location.pathname.replace(/[^/]*$/, '');
  window.ODIN_SITE = SITE; window.SYN_REMOTE = true;
  var REMOTE_FILES = /^anat\/(h|m2)\//; // 3D models are served by the main site
  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    try {
      var isReq = typeof Request !== 'undefined' && input instanceof Request;
      var u = new URL(isReq ? input.url : String(input), location.href);
      if (u.origin === location.origin) {
        var p = u.pathname, rel = p.indexOf(BASE) === 0 ? p.slice(BASE.length) : null;
        var api = p.indexOf('/api/') === 0 ? p : (rel !== null && rel.indexOf('api/') === 0 ? '/' + rel : null);
        if (api) {
          var o = {}; init = init || {};
          o.method = init.method || (isReq ? input.method : 'GET');
          var h = new Headers(init.headers || (isReq ? input.headers : undefined) || {});
          var tok = null; try { tok = localStorage.getItem('acct.tok'); } catch (e) {}
          if (tok && !h.has('authorization')) h.set('authorization', 'Bearer ' + tok);
          o.headers = h; o.mode = 'cors'; o.credentials = 'omit'; o.cache = init.cache || 'no-store';
          if (init.body != null) o.body = init.body;
          if (init.signal) o.signal = init.signal;
          return _fetch(SITE + api + u.search, o);
        }
        if (rel !== null && REMOTE_FILES.test(rel)) return _fetch(SITE + '/' + rel + u.search, isReq ? undefined : init);
      }
    } catch (e) {}
    return _fetch(input, init);
  };
})();
