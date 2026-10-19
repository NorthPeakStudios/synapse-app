/* Synapse re-sign reminder. Ships inside the iOS sideload build only (native/, injected by boot.js);
   it is not part of the website or the live-update files, so the web/PWA version never shows it.
   Free Apple ID signing lasts 7 days. The real expiry comes from embedded.mobileprovision in the app
   (SynapseSigning plugin, AppDelegate.swift); without one it counts 7 days from this install's first launch.
   An app can't re-sign itself, so the button opens SideStore, which does it on the phone. */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || !C.getPlatform || C.getPlatform() !== 'ios') return;
  var DAY = 864e5, LS = window.localStorage, SS = 'sidestore://';
  var Sig = null; try { Sig = C.registerPlugin('SynapseSigning'); } catch (e) {}
  var info = null, exp = 0, src = 'first launch', noStore = false;

  function first() {
    var f = 0; try { f = +LS.getItem('rs.first') || 0; if (!f) { f = Date.now(); LS.setItem('rs.first', String(f)); } } catch (e) { f = Date.now(); }
    return f;
  }
  function daysLeft() { return Math.max(0, Math.ceil((exp - Date.now()) / DAY)); }
  function when() {
    var d = daysLeft();
    if (exp - Date.now() <= 0) return 'has expired';
    if (exp - Date.now() < DAY) return 'expires today';
    if (d === 1) return 'expires tomorrow';
    return 'expires in ' + d + ' days';
  }
  function dateStr() { try { return new Date(exp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }

  var css = '.rs-b{display:flex;flex-direction:column;gap:6px;margin:4px 0 14px;padding:12px 14px;border-radius:var(--r,14px);' +
    'background:var(--card,rgba(127,127,127,.12));color:var(--tx,inherit);border:1px solid var(--line,rgba(127,127,127,.2));font-size:14px;line-height:1.35}' +
    '.rs-b .rs-t{font-weight:600}.rs-b .rs-s{color:var(--mut,rgba(127,127,127,.9));font-size:13px}' +
    '.rs-b .rs-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:2px}' +
    '.rs-b button{appearance:none;border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:14px;font-weight:600;background:var(--acc,#0A84FF);color:var(--on-acc,#fff)}' +
    '.rs-b button.rs-x{background:transparent;color:var(--mut,rgba(127,127,127,.9));padding:8px 6px;font-weight:500}' +
    '.rs-b.rs-warn{border-color:var(--hard,#ff9f0a)}.rs-b .rs-no{color:var(--mut,rgba(127,127,127,.9));font-size:13px}';
  function addCss() { if (document.getElementById('rs-css')) return; var s = document.createElement('style'); s.id = 'rs-css'; s.textContent = css; (document.head || document.documentElement).appendChild(s); }

  function refresh(box) {
    var go = function () {
      if (!Sig) { location.href = SS; return Promise.resolve(); }
      return Sig.open({ url: SS }).then(function (r) { if (!r || !r.opened) missing(box); }).catch(function () { missing(box); });
    };
    if (Sig && Sig.canOpen) Sig.canOpen({ url: SS }).then(function (r) { if (r && r.value === false) missing(box); else go(); }).catch(go); else go();
  }
  function missing(box) {
    noStore = true;
    var n = box && box.querySelector('.rs-no'); if (n) n.hidden = false;
  }
  function make(kind) {
    var b = document.createElement('div');
    b.className = 'rs-b rs-' + kind + (daysLeft() <= 2 ? ' rs-warn' : '');
    b.setAttribute('data-rs', kind);
    var title = kind === 'home' ? 'Synapse ' + when() : 'App signing ' + when();
    var sub = kind === 'home'
      ? 'Refresh it in SideStore so it keeps opening.'
      : (src === 'provision' ? 'Ends ' + dateStr() + '. ' : 'About ' + dateStr() + ' (counted from first launch). ') + 'Free Apple ID apps last 7 days; refreshing in SideStore resets it. Your cards stay.';
    b.innerHTML = '<div class="rs-t"></div><div class="rs-s"></div><div class="rs-row"><button type="button" class="rs-go">Refresh in SideStore</button>' +
      (kind === 'home' ? '<button type="button" class="rs-x" aria-label="Hide for today">Later</button>' : '') + '</div>' +
      '<div class="rs-no" hidden>SideStore isn’t on this phone. Open the app you sideloaded Synapse with and refresh or reinstall it there.</div>';
    b.querySelector('.rs-t').textContent = title;
    b.querySelector('.rs-s').textContent = sub;
    if (noStore) b.querySelector('.rs-no').hidden = false;
    b.querySelector('.rs-go').addEventListener('click', function () { refresh(b); });
    var x = b.querySelector('.rs-x');
    if (x) x.addEventListener('click', function () { try { LS.setItem('rs.later', new Date().toDateString()); } catch (e) {} b.remove(); });
    return b;
  }
  function host(kind) {
    if (kind === 'home') return document.getElementById('v-home');
    // the Settings screen (feat/settings/settings-ui.js): root page body inside #v-prefs
    return document.querySelector('#v-prefs .st-pg[data-pg="root"] .st-body');
  }
  function place(kind, show) {
    var v = host(kind), stale = document.querySelectorAll('[data-rs="' + kind + '"]');
    for (var i = 0; i < stale.length; i++) if (!v || stale[i].parentNode !== v) stale[i].remove();
    if (!v) return;
    var cur = v.querySelector(':scope > [data-rs="' + kind + '"]');
    if (!show) { if (cur) cur.remove(); return; }
    if (cur && v.firstElementChild === cur && cur.querySelector('.rs-t').textContent.indexOf(when()) >= 0) return;
    if (cur) cur.remove();
    v.insertBefore(make(kind), v.firstChild);
  }
  function homeDue() {
    if (daysLeft() > 2) return false;
    try { return LS.getItem('rs.later') !== new Date().toDateString(); } catch (e) { return true; }
  }
  var busy = false;
  function render() {
    if (busy || !exp) return; busy = true;
    try { addCss(); place('set', true); place('home', homeDue()); } catch (e) {}
    busy = false;
  }
  function watch() {
    [['v-prefs', true], ['v-home', false]].forEach(function (a) {
      var v = document.getElementById(a[0]); if (!v || v.__rs) return; v.__rs = true;
      new MutationObserver(function () { if (!busy) setTimeout(render, 0); }).observe(v, { childList: true, subtree: a[1] });
    });
    render();
  }
  function start(r) {
    info = r || null;
    if (info && info.found && info.expiresMs) { exp = +info.expiresMs; src = 'provision'; }
    else { exp = first() + 7 * DAY; src = 'first launch'; }
    window.OdinNative = window.OdinNative || {};
    window.OdinNative.signing = { expires: new Date(exp).toISOString(), daysLeft: daysLeft(), source: src, profile: info };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
    setTimeout(watch, 1500);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  }
  first();
  if (Sig) Sig.info().then(start).catch(function () { start(null); }); else start(null);
})();
