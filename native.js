/* native app feel: no pinch / double-tap zoom anywhere except elements marked data-pinch (the 3D anatomy canvas),
   no rubber-band, no long-press callouts on chrome. Shared by / and /chess/. */
(function () {
  'use strict';
  if (window.__nativeFeel) return; window.__nativeFeel = 1;
  var de = document.documentElement;
  var standalone = (window.navigator.standalone === true) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || (window.matchMedia && matchMedia('(display-mode: fullscreen)').matches);
  if (standalone) de.classList.add('is-standalone');
  var pinchOK = function (t) { return !!(t && t.closest && t.closest('[data-pinch]')); };
  // iOS ignores user-scalable=no; these stop the gesture itself
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (!pinchOK(e.target)) e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length > 1 && !pinchOK(e.target)) e.preventDefault();
    else if (e.scale !== undefined && e.scale !== 1 && !pinchOK(e.target)) e.preventDefault();
  }, { passive: false });
  // double-tap zoom fallback (touch-action:manipulation covers most of it)
  var last = 0;
  document.addEventListener('touchend', function (e) {
    var now = Date.now(), t = e.target;
    if (now - last < 320 && !pinchOK(t) && !(t.closest && t.closest('input,textarea,select,[contenteditable]'))) e.preventDefault();
    last = now;
  }, { passive: false });
  // no long-press menu on app chrome (text you can read is still selectable where marked .sel)
  document.addEventListener('contextmenu', function (e) {
    var t = e.target; if (t.closest && t.closest('input,textarea,.sel,a[href^="http"]')) return; e.preventDefault();
  });
  // keep the page from being nudged sideways after the keyboard closes
  window.addEventListener('focusout', function () { setTimeout(function () { if (window.scrollX) window.scrollTo(0, window.scrollY); }, 50); });
  // real viewport height (iOS 100vh is wrong in Safari); --vh used by full-height screens
  var setVh = function () { de.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px'); };
  setVh(); window.addEventListener('resize', setVh);
})();
