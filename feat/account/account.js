/* Accounts (optional): email + password sign-in that syncs study progress and carries Synapse Pro to every device.
   Nothing here sends a request until someone signs in; logged out, the app works exactly as before and nothing nags.
   The session is an httpOnly cookie the page can't read. localStorage 'acct.v1' only caches {email, pro, owner, checked}.
   Sync reuses the app's record sync (app.js push/pull): signed in, the session picks the account's sync space instead of a sync code.
   window.Account = { on, user(), open(view), refresh(), homeBtn(), label() } */
(function () {
  'use strict';
  if (window.Account) return;
  var ON = !window.__ODIN_CFG; // a website feature: the session cookie belongs to this site
  var KEY = 'acct.v1', SUPPORT = 'northpeak.support@gmail.com', GRACE = 30 * 864e5;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var toast = function (m) { try { if (typeof window.toast === 'function') window.toast(m, 2600); } catch (e) {} };
  var ICON = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2c.9-3.7 3.7-5.7 7.2-5.7s6.3 2 7.2 5.7"/></svg>';
  var X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  if (!ON) { window.Account = { on: false, user: function () { return null; }, open: function () {}, refresh: function () { return Promise.resolve(null); }, homeBtn: function () { return ''; }, label: function () { return ''; } }; return; }

  function st() { try { var s = JSON.parse(localStorage.getItem(KEY)); return s && s.email ? s : null; } catch (e) { return null; } }
  function save(u) { try { localStorage.setItem(KEY, JSON.stringify({ email: u.email, pro: !!u.pro, owner: !!u.owner, since: u.since || 0, trial: u.trial || 0, aaCode: u.aaCode || null, checked: Date.now() })); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); localStorage.removeItem('acct.tok'); } catch (e) {} }
  function user() { return st(); }
  function device() {
    var d = ''; try { d = localStorage.getItem('pro.dev') || ''; } catch (e) {}
    if (!/^[a-z0-9]{16,40}$/.test(d)) { d = ''; var a = new Uint8Array(12); crypto.getRandomValues(a); a.forEach(function (x) { d += (x % 36).toString(36); }); d += Date.now().toString(36); try { localStorage.setItem('pro.dev', d); } catch (e) {} }
    return d;
  }
  function call(path, body) {
    var h = body ? { 'content-type': 'application/json' } : {}; if (window.SYN_REMOTE) h['x-syn-bearer'] = '1'; // GitHub Pages copy: a bearer token instead of the cookie (host.js sends it)
    return fetch('/api/auth/' + path, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = j.http || r.status; if (j.token) { try { localStorage.setItem('acct.tok', j.token); } catch (e) {} delete j.token; } return j; }); });
  }
  function notify() {
    try { if (window.Pro && Pro.accountChanged) Pro.accountChanged(); } catch (e) {}
    try { if (typeof changed === 'function') changed(); } catch (e) {}
    try { if (typeof view !== 'undefined' && view === 'settings' && typeof rSettings === 'function') rSettings(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('account:change', { detail: { user: st() } })); } catch (e) {}
    document.querySelectorAll('[data-acct-open]').forEach(function (b) { b.classList.toggle('in', !!st()); b.setAttribute('aria-label', st() ? 'Account' : 'Sign in to sync'); });
  }

  /* ---------- sync: the account replaces the sync code on this device while signed in ---------- */
  function appReady() { return typeof meta !== 'undefined' && typeof idb !== 'undefined' && idb && typeof setMeta === 'function'; }
  function whenReady() { return new Promise(function (res) { var n = 0; (function w() { if (appReady() || n++ > 60) res(appReady()); else setTimeout(w, 250); })(); }); }
  async function markDirty() { // everything this device made or studied goes up once (library/seed records stay clean: mod 1)
    var t = idb.transaction('dirty', 'readwrite'), s = t.objectStore('dirty');
    ['decks', 'notes', 'cards', 'revlog', 'progress'].forEach(function (n) { M[n].forEach(function (o) { if (o && o.mod > 1) s.put(o.mod, KINDOF[n] + ':' + o.id); }); });
    await txDone(t);
  }
  async function startSync(email) {
    if (!(await whenReady())) return;
    if (meta.acct !== email) {
      if (meta.code) await setMeta('codeOld', meta.code);
      await setMeta('code', null); await setMeta('acct', email); await setMeta('cursor', 0);
      await markDirty();
    }
    try { await syncNow(true); } catch (e) {}
  }
  async function stopSync() {
    if (!(await whenReady())) return;
    await setMeta('acct', null); await setMeta('cursor', 0);
    if (meta.codeOld) { await setMeta('code', meta.codeOld); await setMeta('codeOld', null); }
    try { setPill(); } catch (e) {}
  }
  /* np-email-change v1: the account's email changed (here or on another device). The account and its sync space are the same,
     so this device just relabels its cached copy; it doesn't start a fresh sync. */
  async function emailChanged(j) {
    var was = (st() || {}).email || '';
    save(j.user); notify();
    try { if (was && was !== j.user.email && (await whenReady()) && meta.acct === was) await setMeta('acct', j.user.email); } catch (e) {}
  }
  function refresh() {
    if (!st()) return Promise.resolve(null);
    return call('me').then(async function (j) {
      if (j.ok && j.user) { if (j.user.email !== (st() || {}).email) await emailChanged(j); else save(j.user); notify(); return j.user; }
      if (j.ok && j.user === null) { clear(); await stopSync(); notify(); toast('You were signed out. Sign in again to keep syncing.'); }
      return null;
    }).catch(function () { return st(); });
  }

  /* ---------- the sheet ---------- */
  var cur = '';
  function logo() { var l = document.querySelector('link[rel=apple-touch-icon]'); return l ? l.getAttribute('href') : 'apple-touch-icon.png'; }
  function head(t, sub) { return '<button type="button" class="pw-x" data-ac-close aria-label="Close">' + X + '</button><div class="pw-hero pw-hero-sm"><img class="pw-logo" src="' + esc(logo()) + '" alt=""><h2 id="acT">' + esc(t) + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>'; }
  function field(name, label, type, ac, extra) { return '<label>' + esc(label) + '<input name="' + name + '" type="' + type + '" autocomplete="' + ac + '" ' + (extra || '') + ' required></label>'; }
  var ERR = '<p class="pw-fine pw-err" data-ac-err hidden></p>';
  var PRIV = '<p class="pw-fine ac-priv">We store your email, a hashed password and your study progress so it can sync. Nothing is sold. You can delete your account in Settings. <a href="privacy/" target="_blank" rel="noopener">Privacy policy</a></p>';
  function proLine(u) {
    if (u.owner) return 'Synapse Pro \u00b7 owner'; if (u.pro) return 'Synapse Pro \u00b7 active';
    var l = window.Pro && Pro.trialLeft ? Pro.trialLeft() : null; if (l == null) return 'Free';
    return l > 0 ? (l < 864e5 ? 'Free trial \u00b7 ends today' : 'Free trial \u00b7 ' + Math.ceil(l / 864e5) + ' day' + (Math.ceil(l / 864e5) === 1 ? '' : 's') + ' left') : 'Trial ended';
  }
  function lastSync() { try { return meta.lastSync ? 'Last synced ' + new Date(meta.lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not synced yet'; } catch (e) { return ''; } }
  function body(v) {
    var u = st();
    if (v === 'account' && !u) v = 'signin';
    if (v === 'signin') return head('Sign in to sync', 'Keep your decks, progress and Synapse Pro on every device.' + (window.Pro && Pro.web ? ' Your 3-day free trial lives on your account.' : ' Optional: the app works fully without an account.'))
      + '<form class="pw-form" data-ac-form="login" novalidate>' + field('email', 'Email', 'email', 'username', 'inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254"') + field('password', 'Password', 'password', 'current-password', 'maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta">Sign in</button></form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="signup">Create an account</button><button type="button" data-ac-go="forgot">Forgot password?</button></div>';
    if (v === 'signup') return head('Create an account', (window.Pro && Pro.web ? 'Your 3-day free trial starts when you make your account. ' : '') + 'Sync your decks, stats, streak and course progress, and keep Synapse Pro on every device you sign in on.')
      + '<form class="pw-form" data-ac-form="signup" novalidate>' + field('email', 'Email', 'email', 'username', 'inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254"') + field('password', 'Password (8 or more characters)', 'password', 'new-password', 'minlength="8" maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta">Create account</button>' + PRIV + '</form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="signin">I have an account</button></div>';
    if (v === 'forgot') return head('Forgot password?')
      + '<div class="ac-box"><p>Contact <a href="mailto:' + SUPPORT + '?subject=' + encodeURIComponent('Synapse password reset') + '">' + SUPPORT + '</a> from the email you signed up with. You\u2019ll get a one-time reset code.</p></div>'
      + '<button type="button" class="pw-cta" data-ac-go="reset">I have a reset code</button>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="signin">Back to sign in</button></div>';
    if (v === 'reset') return head('Reset your password')
      + '<form class="pw-form" data-ac-form="reset" novalidate>' + field('email', 'Email', 'email', 'username', 'inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254"') + field('code', 'Reset code', 'text', 'one-time-code', 'autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="XXXX-XXXX"') + field('password', 'New password (8 or more characters)', 'password', 'new-password', 'minlength="8" maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta">Set new password</button></form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="signin">Back to sign in</button></div>';
    if (v === 'password') return head('Change password')
      + '<form class="pw-form" data-ac-form="password" novalidate>' + field('old', 'Current password', 'password', 'current-password', 'maxlength="200"') + field('password', 'New password (8 or more characters)', 'password', 'new-password', 'minlength="8" maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta">Change password</button></form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="account">Back</button></div>';
    if (v === 'email') return head('Change email', 'Your account, Pro, owner status and synced progress move to the new email. The old email stops working for sign-in, here and in Axon and Liminal.')
      + '<form class="pw-form" data-ac-form="email" novalidate>' + field('email', 'New email', 'email', 'username', 'inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254"') + field('password', 'Password', 'password', 'current-password', 'maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta">Change email</button></form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="account">Back</button></div>';
    if (v === 'delete') return head('Delete account')
      + '<div class="ac-box ac-warn"><p>This deletes your account, its synced progress and its share links from our server right away. It can\u2019t be undone. Cards on this device stay here.</p></div>'
      + '<form class="pw-form" data-ac-form="delete" novalidate>' + field('password', 'Password', 'password', 'current-password', 'maxlength="200"') + ERR
      + '<button type="submit" class="pw-cta ac-danger">Delete my account</button></form>'
      + '<div class="pw-links ac-links"><button type="button" data-ac-go="account">Cancel</button></div>';
    // account
    return head('Account')
      + '<div class="ac-card"><div class="ac-row"><span>Email</span><b class="ac-email">' + esc(u.email) + '</b></div>'
      + '<div class="ac-row"><span>Plan</span><b class="ac-plan' + (u.pro ? ' pro' : '') + '">' + esc(proLine(u)) + '</b></div>'
      + '<div class="ac-row"><span>Sync</span><b class="ac-sync" data-ac-last>' + esc(lastSync()) + '</b></div></div>'
      + '<button type="button" class="pw-cta" data-ac-act="sync">Sync now</button>'
      + '<p class="pw-fine">Your decks, reviews, stats, streak, course progress and settings sync to every device you sign in on.' + (u.pro ? '' : ' Unlock Synapse Pro while signed in and it follows your account.') + '</p>'
      + '<div class="ac-list"><button type="button" data-ac-go="email">Change email</button><button type="button" data-ac-go="password">Change password</button><button type="button" data-ac-act="logout">Log out</button><button type="button" class="ac-del" data-ac-go="delete">Delete account</button></div>';
  }
  function open(v) {
    var w = document.querySelector('.ac-sheet:not(.pw-out)');
    if (!w) {
      w = document.createElement('div'); w.className = 'pw ac-sheet'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'acT');
      w.innerHTML = '<div class="pw-in"></div>'; document.body.appendChild(w);
      document.documentElement.classList.add('pw-open');
      requestAnimationFrame(function () { w.classList.add('in'); });
    }
    cur = v || (st() ? 'account' : 'signin');
    var inn = w.querySelector('.pw-in'); inn.innerHTML = body(cur); w.scrollTop = 0;
    var first = inn.querySelector('input'); if (first && cur !== 'account') try { first.focus({ preventScroll: true }); } catch (e) {}
  }
  function close() {
    var w = document.querySelector('.ac-sheet:not(.pw-out)'); if (!w) return;
    if (!document.querySelector('.pw:not(.ac-sheet):not(.pw-out)')) document.documentElement.classList.remove('pw-open');
    w.classList.remove('in'); w.classList.add('pw-out'); setTimeout(function () { w.remove(); if (!document.querySelector('.pw')) document.documentElement.classList.remove('pw-open'); }, 180);
  }
  function err(f, m) { var e = f.querySelector('[data-ac-err]'); if (e) { e.textContent = m; e.hidden = !m; } }
  function busy(f, on, txt) { var b = f.querySelector('button[type=submit]'); if (b) { if (!b.dataset.t) b.dataset.t = b.textContent; b.disabled = on; b.textContent = on ? (txt || 'One moment\u2026') : b.dataset.t; } }
  var OFF = 'You look offline. Try again when you\u2019re connected.', SLOW = 'Too many tries. Wait a few minutes and try again.';
  async function signedIn(j, msg) {
    save(j.user); notify(); close(); toast(msg);
    await startSync(j.user.email); notify();
  }
  function submit(f) {
    var kind = f.dataset.acForm, v = function (n) { return f.elements[n] ? f.elements[n].value : ''; };
    var email = v('email').trim(), pw = v('password');
    if ((kind === 'login' || kind === 'signup' || kind === 'reset' || kind === 'email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err(f, 'Enter your email address.');
    if (kind === 'email' && !pw) return err(f, 'Enter your password.');
    if (kind === 'email' && st() && email.toLowerCase() === String(st().email || '').toLowerCase()) return err(f, 'That\u2019s already your email.');
    if (kind === 'login' && !pw) return err(f, 'Enter your password.');
    if ((kind === 'signup' || kind === 'reset' || kind === 'password') && pw.length < 8) return err(f, 'Use at least 8 characters for the password.');
    if (kind === 'reset' && v('code').replace(/[^0-9a-z]/gi, '').length !== 8) return err(f, 'Enter the 8-character reset code.');
    if ((kind === 'password' && !v('old')) || (kind === 'delete' && !pw)) return err(f, 'Enter your password.');
    err(f, ''); busy(f, true);
    var p = kind === 'login' ? call('login', { email: email, password: pw, device: device() })
      : kind === 'signup' ? call('signup', { email: email, password: pw, device: device() })
      : kind === 'reset' ? call('reset', { email: email, code: v('code'), password: pw, device: device() })
      : kind === 'password' ? call('password', { old: v('old'), password: pw })
      : kind === 'email' ? call('email', { email: email, password: pw })
      : call('delete', { password: pw });
    p.then(async function (j) {
      if (j.ok) {
        if (kind === 'login') return signedIn(j, 'Signed in. Syncing your progress\u2026');
        if (kind === 'signup') return signedIn(j, 'Account created. Your progress now syncs.');
        if (kind === 'reset') return signedIn(j, 'Password changed. You\u2019re signed in.');
        if (kind === 'password') { toast('Password changed. Other devices were signed out.'); open('account'); return; }
        if (kind === 'email') {
          await emailChanged(j);
          var mv = {}; try { if (window.NPEmail && j.moves) { busy(f, true, 'Updating Axon and Liminal\u2026'); mv = await window.NPEmail.apply(j.moves, pw); } } catch (e) {}
          var also = mv.axon && mv.liminal ? ' Axon and Liminal changed too.' : mv.axon ? ' Axon changed too.' : mv.liminal ? ' Liminal changed too.' : '';
          toast('Email changed to ' + j.user.email + '.' + also + ' Sign in with it from now on.'); open('account'); return;
        }
        if (kind === 'delete') { clear(); await stopSync(); notify(); close(); toast('Your account was deleted.'); return; }
      }
      busy(f, false);
      if (j.status === 429) return err(f, SLOW);
      if (j.status === 401 && j.error === 'signed_out') { clear(); await stopSync(); notify(); open('signin'); return; }
      err(f, kind === 'login' ? 'Wrong email or password.'
        : kind === 'signup' ? (j.error === 'exists' ? 'That email can\u2019t be used for a new account. If it\u2019s yours, sign in instead.' : j.error === 'bad_email' ? 'Enter a valid email address.' : 'Couldn\u2019t create the account. Try again.')
        : kind === 'reset' ? 'That reset code didn\u2019t work. Check the email and code, or ask for a new code.'
        : kind === 'email' ? (j.error === 'exists' ? 'That email already has a Northpeak account.' : j.error === 'email_locked' ? 'This account\u2019s email is locked (owner and bot accounts keep theirs).' : j.error === 'bad_email' ? 'Enter a valid email address.' : j.status === 401 ? 'Wrong password.' : 'That didn\u2019t work. Try again.')
        : j.error === 'bad_password_new' ? 'Use at least 8 characters for the new password.' : j.status === 401 ? 'Wrong password.' : 'That didn\u2019t work. Try again.');
    }).catch(function () { busy(f, false); err(f, OFF); });
  }
  function act(a, b) {
    if (a === 'sync') { b.disabled = true; b.textContent = 'Syncing\u2026'; Promise.resolve(startSync((st() || {}).email)).then(refresh).then(function () { b.disabled = false; b.textContent = 'Sync now'; var l = document.querySelector('[data-ac-last]'); if (l) l.textContent = lastSync(); }); return; }
    if (a === 'logout') {
      if (!confirm('Log out on this device? Your cards stay here. Pro from your account turns off on this device until you sign in again.')) return;
      b.disabled = true;
      call('logout', {}).catch(function () {}).then(async function () { clear(); await stopSync(); notify(); close(); toast('Logged out.'); });
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-acct-open]'); if (t) { e.preventDefault(); open(); return; }
    if (!e.target.closest('.ac-sheet')) return;
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-ac-close')) { close(); return; }
    if (b.dataset.acGo) { open(b.dataset.acGo); return; }
    if (b.dataset.acAct) act(b.dataset.acAct, b);
  });
  document.addEventListener('submit', function (e) { var f = e.target.closest('[data-ac-form]'); if (!f) return; e.preventDefault(); submit(f); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.querySelector('.ac-sheet')) close(); });

  function homeBtn() { var u = st(); return '<button class="iconbtn ac-home' + (u ? ' in' : '') + '" data-acct-open type="button" aria-label="' + (u ? 'Account' : 'Sign in to sync') + '" title="' + (u ? 'Account' : 'Sign in to sync') + '">' + ICON + '</button>'; }
  function label() { var u = st(); return u ? u.email : ''; }
  window.Account = { on: true, user: user, open: open, close: close, refresh: refresh, homeBtn: homeBtn, label: label, pro: function () { var u = st(); return !!(u && u.pro && Date.now() - (u.checked || 0) < GRACE); }, owner: function () { var u = st(); return !!(u && u.owner && Date.now() - (u.checked || 0) < GRACE); } };

  // signed in: re-check the session (and Pro) once per launch, and keep this device on the account's sync space
  if (st()) whenReady().then(function (ok) { if (!ok) return; var u = st(); if (u && meta.acct !== u.email) startSync(u.email); return refresh(); });
  else whenReady().then(function (ok) { if (ok && meta.acct) stopSync(); });
})();
