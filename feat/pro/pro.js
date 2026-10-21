/* Synapse Pro: freemium paywall for the Google Play build, and (off by default) web-sale mode on the website.
   Off (fully unlocked, nothing rendered, no listeners) on the website and in sideload builds, unless
   - native/config.js says store: true AND SYNAPSE_PRO.enabled (Google Play build), or
   - this is the plain website (no native config) AND SYNAPSE_PRO.web.enabled (web-sale mode, see SELL-ONLINE.md).
   Web-sale mode sells through Apple Cash requests + single-use unlock codes (/api/pro/*), or a merchant-of-record
   checkout + license keys. A device that opened the private /admin-pro/ page with the owner token is never locked.
   Billing: Google Play Billing through the open-source @capgo/native-purchases Capacitor plugin.
   No third-party account, no server. The entitlement is cached on the device and re-read from Google Play
   on launch; "Restore purchases" re-reads it on demand. (Server-side receipt checks: see BUILD.md, optional later.) */
(function () {
  'use strict';
  if (window.Pro) return;
  var C = window.SYNAPSE_PRO || {}, N = window.__ODIN_CFG || {}, W = C.web || {};
  var STORE = !!(N.store && C.enabled);
  var WEB = !STORE && !window.__ODIN_CFG && !!W.enabled;
  var CHECKOUT = WEB && W.method === 'checkout';
  var ON = STORE || WEB;
  if (!ON) {
    window.Pro = { on: false, web: false, has: function () { return true; }, locked: function () { return false; }, levelOk: function () { return true; }, blockLevel: function () { return false; }, paywall: function () {}, label: function () { return ''; } };
    return;
  }

  var KEY = WEB ? 'pro.web.v1' : 'pro.v1', SUB_GRACE = 7 * 864e5, WEB_GRACE = 30 * 864e5;
  var WC = W.copy || {};
  var PRODUCTS = WEB ? ((CHECKOUT ? (W.checkout || {}).products : W.products) || []) : (C.products || []), IDS = PRODUCTS.map(function (p) { return p.id; });
  var FREE = C.free || {}, PRO = C.pro || {}, LINKS = WEB ? (W.links || {}) : (C.links || {});
  // web-sale mode: the Deck Library only lists decks we may sell (library.js), so it is not sold as a Pro view there
  if (WEB && PRO.views) PRO = Object.assign({}, PRO, { views: PRO.views.filter(function (v) { return v !== 'library'; }) });
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var NP = function () { return window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.NativePurchases; };
  var toast = function (m) { try { if (typeof window.toast === 'function') window.toast(m, 2600); } catch (e) {} };
  var PATHS = {
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    pill: '<rect x="3.2" y="8.6" width="17.6" height="6.8" rx="3.4" transform="rotate(-35 12 12)"/><path d="m9.4 8.3 5.2 7.4"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2.5 2.5M14 9l2 2"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    learn: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c3.2 2.4 7.8 2.4 11 0v-5"/>',
    lab: '<path d="M9 3.5h6M10 3.5v6L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.5v-6"/><path d="M7.4 15h9.2"/>',
    books: '<path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1-3.6 14.5-3.8-1"/>',
    steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.5 1.6-1.5H17a3.5 3.5 0 0 0 3.5-3.5c0-4.3-3.8-7.7-8.5-7.7z"/><circle cx="7.6" cy="11" r="1"/><circle cx="10.5" cy="7.4" r="1"/><circle cx="15" cy="7.6" r="1"/>'
  };
  var svg = function (n, s, w) { return '<svg viewBox="0 0 24 24" width="' + (s || 20) + '" height="' + (s || 20) + '" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[n] || '') + '</svg>'; };

  /* ---------- entitlement ---------- */
  function st() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  /* web: no free tier when trialDays is set. A 3-day trial (the account's when signed in, else this device's), then the whole app
     is behind the paywall (gate) until the person buys, redeems a code, or signs in to a paid account. Owner devices/accounts never lock. */
  var TRIAL = WEB ? (+W.trialDays || 0) * 864e5 : 0, GATE = WEB && TRIAL > 0;
  function acct() { try { var a = JSON.parse(localStorage.getItem('acct.v1')); return a && a.email && Date.now() - (a.checked || 0) < WEB_GRACE ? a : null; } catch (e) { return null; } }
  function owner() { try { if (localStorage.getItem('pro.owner') === '1') return true; } catch (e) {} var a = acct(); return !!(a && a.owner); }
  function trialStart() { var a = acct(); return a && a.trial ? a.trial : 0; } // account-only trial (Oct 20): signed out = no trial
  function trialLeft() { var s = trialStart(); return s ? s + TRIAL - Date.now() : null; }
  function trialOn() { var l = trialLeft(); return TRIAL > 0 && l != null && l > 0; }
  function paid() {
    var a = acct(); if (a && (a.pro || a.owner)) return true;
    var w = st(); if (!w.active) return false;
    if (w.exp && w.exp < Date.now()) return false;
    return Date.now() - (w.checked || 0) < WEB_GRACE;
  }
  function device() {
    var d = ''; try { d = localStorage.getItem('pro.dev') || ''; } catch (e) {}
    if (!/^[a-z0-9]{16,40}$/.test(d)) { d = ''; var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (x, i) { a[i] = Math.random() * 256; }); a.forEach(function (x) { d += (x % 36).toString(36); }); d += Date.now().toString(36); try { localStorage.setItem('pro.dev', d); } catch (e) {} }
    return d;
  }
  function has() {
    if (WEB) return owner() || paid() || trialOn();             // codes are re-checked online at least monthly
    var s = st(); if (!s.active) return false;
    if (s.type === 'inapp') return true;                       // lifetime
    return Date.now() - (s.checked || 0) < SUB_GRACE;           // subscription: trust the cache for a week offline
  }
  function owned(list) {
    return (list || []).filter(function (t) {
      if (!t || IDS.indexOf(t.productIdentifier) < 0) return false;
      if (t.isActive === false || t.revocationDate) return false;
      if (t.purchaseState != null && String(t.purchaseState) !== '1' && String(t.purchaseState).toLowerCase() !== 'purchased') return false;
      if (t.expirationDate && Date.parse(t.expirationDate) < Date.now()) return false;
      return true;
    });
  }
  function api(path, body) {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); });
  }
  function webSave(j) {
    var was = has();
    save({ active: true, id: j.product, type: j.exp ? 'pass' : 'inapp', exp: j.exp || 0, code: j.code, kind: j.kind || 'code', checked: Date.now() });
    if (was !== has()) changed();
  }
  function webRefresh() {
    var w = st(); if (!w.code) return Promise.resolve(has());
    return api(w.kind === 'license' ? '/api/pro/license' : '/api/pro/verify', { code: w.code, key: w.code, device: device(), check: true }).then(function (j) {
      if (j.ok) { webSave({ product: j.product, exp: j.exp, code: w.code, kind: w.kind }); }
      else if (j.status === 404 || j.status === 410 || j.status === 403) { var was = has(); save({ active: false, checked: Date.now() }); if (was !== has()) changed(); }
      return has();
    }).catch(function () { return has(); });
  }
  function refresh(manual) {
    if (WEB) return webRefresh();
    var np = NP(); if (!np) return Promise.resolve(has());
    return Promise.all(['subs', 'inapp'].map(function (type) {
      return np.getPurchases({ productType: type }).then(function (r) { return owned(r && r.purchases); }).catch(function () { return null; });
    })).then(function (res) {
      if (res[0] === null && res[1] === null) return has();     // offline: keep the cached answer
      var all = (res[0] || []).concat(res[1] || []), was = has();
      var life = all.filter(function (t) { return t.productIdentifier === 'synapse_pro_lifetime' || t.productType === 'inapp'; })[0];
      var t = life || all[0];
      save(t ? { active: true, id: t.productIdentifier, type: life ? 'inapp' : 'subs', checked: Date.now() } : { active: false, checked: Date.now() });
      if (was !== has()) changed();
      return has();
    });
  }
  function changed() {
    check();
    document.querySelectorAll('.pro-lock').forEach(function (x) { x.remove(); });
    document.querySelectorAll('[data-pro-dec]').forEach(function (x) { x.removeAttribute('data-pro-dec'); });
    decorate();
    try { window.dispatchEvent(new CustomEvent('pro:change', { detail: { pro: has() } })); } catch (e) {}
    try { if (typeof changeHooks !== 'undefined') changeHooks.forEach(function (f) { try { f(); } catch (e) {} }); } catch (e) {}
  }

  /* ---------- what is locked ---------- */
  var labSet = null;
  function labIds() {
    if (labSet) return labSet;
    var s = {};
    try { if (window.Shell && Shell.list) Shell.list('lab').forEach(function (g) { g.items.forEach(function (f) { s[f.id] = 1; }); }); } catch (e) {}
    try { if (window.Lab && Lab.F) Object.keys(Lab.F).forEach(function (k) { if (Lab.F[k].hub === 'lab') s[k] = 1; }); } catch (e) {}
    if (Object.keys(s).length) labSet = s;
    return s;
  }
  function locked(id) {
    if (!id || has()) return false;
    id = String(id);
    if (id.indexOf('learn:') === 0) return !levelOk(id.slice(6));
    if (id === 'icons') return !!PRO.icons;
    if (id === 'docrandom') return !!PRO.doctordleUnlimited;
    if ((PRO.views || []).indexOf(id) >= 0) return true;
    if ((PRO.features || []).indexOf(id) >= 0) return true;
    if ((FREE.lab || []).indexOf(id) >= 0) return false;
    return !!labIds()[id];
  }
  function levelOk(lvl) { return has() || !lvl || (FREE.learnLevels || []).indexOf(lvl) >= 0; }
  var NAMES = { learn: 'Higher course levels', library: 'The Deck Library', anat: 'Anatomy 3D', icons: 'App icons', docrandom: 'Unlimited Doctordle', tc: 'Tutor call', themes: 'Themes', anki: 'Deck import', occl: 'Image occlusion' };
  function nameOf(id) {
    if (!id) return '';
    if (String(id).indexOf('learn:') === 0) return NAMES.learn;
    if (NAMES[id]) return NAMES[id];
    try { var f = window.Shell && Shell.feat && Shell.feat(id); if (f && f.title) return f.title; } catch (e) {}
    try { if (window.Lab && Lab.F && Lab.F[id]) return Lab.F[id].title; } catch (e) {}
    return '';
  }

  /* ---------- prices from Google Play (placeholders until it answers) ---------- */
  var live = {};   // id -> { price, offerToken, plan, trial }
  function loadPrices() {
    var np = NP(); if (!np) return Promise.resolve();
    var subs = PRODUCTS.filter(function (p) { return p.type === 'subs'; }), once = PRODUCTS.filter(function (p) { return p.type !== 'subs'; });
    var q = function (list, type) {
      if (!list.length) return Promise.resolve();
      return np.getProducts({ productIdentifiers: list.map(function (p) { return p.id; }), productType: type }).then(function (r) {
        (r && r.products || []).forEach(function (x) {
          var p = PRODUCTS.filter(function (y) { return y.id === x.identifier; })[0]; if (!p) return;
          if (p.plan && x.planIdentifier && x.planIdentifier !== p.plan) return;
          var cur = live[p.id], isTrial = !!x.offerId;
          // keep the base-plan price for display; remember a trial offer token when there is one
          if (!cur) cur = live[p.id] = {};
          if (!isTrial || !cur.price) cur.price = x.priceString || cur.price;
          if (isTrial && x.offerToken) { cur.trialToken = x.offerToken; cur.trial = true; }
          else if (x.offerToken && !cur.offerToken) cur.offerToken = x.offerToken;
          if (x.pricingTerms && x.pricingTerms.length) { var base = x.pricingTerms[x.pricingTerms.length - 1]; if (base && base.formattedPrice) cur.price = base.formattedPrice; }
        });
      }).catch(function () {});
    };
    return Promise.all([q(subs, 'subs'), q(once, 'inapp')]).then(function () { if (document.querySelector('.pw')) paintPlans(); });
  }
  var priceOf = function (p) { return (live[p.id] && live[p.id].price) || p.price; };

  /* ---------- buy / restore ---------- */
  var busy = false;
  function buy(p) {
    if (WEB) {
      if (CHECKOUT) { if (p.url && !/REPLACE|YOUR-STORE/.test(p.url)) { window.open(p.url, '_blank', 'noopener'); view('code'); } else toast('Checkout isn\u2019t set up yet'); return; }
      view('form'); return;
    }
    var np = NP();
    if (!np) { toast('Purchases work in the Google Play version of Synapse'); return; }
    if (busy) return; busy = true; setBusy(true);
    var L = live[p.id] || {}, opts = { productIdentifier: p.id, productType: p.type === 'subs' ? 'subs' : 'inapp' };
    if (p.type === 'subs') { opts.planIdentifier = p.plan; var tok = L.trialToken || L.offerToken; if (tok) opts.offerToken = tok; }
    np.purchaseProduct(opts).then(function (t) {
      save({ active: true, id: (t && t.productIdentifier) || p.id, type: p.type === 'subs' ? 'subs' : 'inapp', checked: Date.now() });
      busy = false; closePaywall(); changed(); toast('Welcome to Synapse Pro. Everything is unlocked.');
    }).catch(function (e) {
      busy = false; setBusy(false);
      var m = String(e && (e.message || e.code) || e);
      if (/cancel/i.test(m)) return;
      if (/already|owned/i.test(m)) { restore(); return; }
      toast('That didn’t go through. Nothing was charged. Try again in a moment.');
    });
  }
  function restore() {
    if (WEB) {
      var w = st(); if (!w.code) { view('code'); return; }
      webRefresh().then(function (ok) { if (ok) { closePaywall(); toast('Synapse Pro is active on this device.'); } else { toast('That code is no longer active. Enter a new one.'); view('code'); } });
      return;
    }
    var np = NP();
    if (!np) { toast('Restoring works in the Google Play version of Synapse'); return; }
    setBusy(true);
    (np.restorePurchases ? np.restorePurchases().catch(function () {}) : Promise.resolve()).then(function () { return refresh(true); }).then(function (ok) {
      setBusy(false);
      if (ok) { closePaywall(); toast('Synapse Pro restored. Everything is unlocked.'); }
      else toast('No Synapse Pro purchase found on this Google account.');
    });
  }

  /* ---------- paywall screen ---------- */
  var sel = (PRODUCTS.filter(function (p) { return p.best; })[0] || PRODUCTS[0] || {}).id, from = '';
  function planSub(p) {
    var pr = priceOf(p);
    if (WEB) return p.note || (p.per === 'once' ? 'Pay once, keep it forever' : pr + ' per ' + p.per);
    if (p.type !== 'subs') return 'Pay once, keep it forever';
    if (p.trialDays && (!live[p.id] || live[p.id].trial !== false)) return p.trialDays + ' days free, then ' + pr + ' per ' + p.per;
    return pr + ' per ' + p.per + ', cancel anytime';
  }
  function plansHTML() {
    if (PRODUCTS.length === 1) { var o = PRODUCTS[0]; return '<div class="pw-one"><b>' + esc(priceOf(o)) + '</b><span>' + esc(o.per === 'once' ? 'one time \u00b7 yours forever' : 'per ' + o.per) + '</span></div>'; }
    return PRODUCTS.map(function (p) {
      var on = p.id === sel;
      return '<button type="button" class="pw-plan' + (on ? ' on' : '') + (p.best ? ' best' : '') + '" role="radio" aria-checked="' + on + '" data-pw-plan="' + esc(p.id) + '">'
        + (p.best ? '<span class="pw-badge">Best value</span>' : '')
        + '<span class="pw-radio" aria-hidden="true"></span>'
        + '<span class="pw-pl"><b>' + esc(p.label) + '</b><small>' + esc(planSub(p)) + '</small></span>'
        + '<span class="pw-pr"><b>' + esc(priceOf(p)) + '</b><small>' + esc(WEB ? (p.per === 'once' ? 'once' : (CHECKOUT ? '/' : 'for 1 ') + p.per) : p.perMonth && !live[p.id] ? p.perMonth + '/mo' : p.type === 'subs' ? '/' + p.per : 'once') + '</small></span></button>';
    }).join('');
  }
  function ctaText() {
    var p = PRODUCTS.filter(function (x) { return x.id === sel; })[0] || {};
    if (WEB) return CHECKOUT ? 'Buy for ' + priceOf(p) : (WC.cta || 'Pay with Apple Cash');
    if (p.type !== 'subs') return 'Unlock for ' + priceOf(p);
    if (p.trialDays) return 'Start ' + p.trialDays + '-day free trial';
    return 'Subscribe for ' + priceOf(p) + ' per ' + p.per;
  }
  function fineText() {
    var p = PRODUCTS.filter(function (x) { return x.id === sel; })[0] || {};
    if (WEB) return CHECKOUT ? 'Secure checkout in your browser. Your license key arrives by email.' : (WC.fine || '');
    if (p.type !== 'subs') return 'One payment through Google Play. No subscription.';
    return (p.trialDays ? 'Free for ' + p.trialDays + ' days, then ' : '') + priceOf(p) + ' per ' + p.per + '. Renews automatically. Cancel anytime in Google Play.';
  }
  function paintPlans() {
    var w = document.querySelector('.pw'); if (!w) return;
    var pl = w.querySelector('.pw-plans'); if (pl) pl.innerHTML = plansHTML();
    var b = w.querySelector('[data-pw-buy]'); if (b && !busy) b.textContent = ctaText();
    var f = w.querySelector('.pw-fine'); if (f) f.textContent = fineText();
  }
  function setBusy(on) { var b = document.querySelector('.pw [data-pw-buy]'); if (b) { b.disabled = on; b.textContent = on ? (WEB ? 'One moment…' : 'Opening Google Play…') : ctaText(); } }
  function logo() { var l = document.querySelector('link[rel=apple-touch-icon]'); return l ? l.getAttribute('href') : 'icon-192.png'; }
  function paywall(id) {
    removePw();
    var g = gated(); gateOn = g;
    sel = (PRODUCTS.filter(function (p) { return p.best; })[0] || PRODUCTS[0] || {}).id;
    from = id && id !== 'trial' && !g ? nameOf(id) : '';
    lastFrom = id || '';
    var pro = WEB ? (owner() || paid()) : has(), s = st(), cur = PRODUCTS.filter(function (p) { return p.id === s.id; })[0];
    var a = acct(), started = !!trialStart(), signedOut = !a && !!window.Account && Account.on;
    var w = document.createElement('div'); w.className = 'pw' + (g ? ' pw-gate' : ''); if (g) w.dataset.gate = '1'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'pwT');
    var hero = g ? (signedOut && !started ? ['Make an account to start your ' + (W.trialDays || 3) + '\u2011day free trial', 'Everything in Synapse, free for ' + (W.trialDays || 3) + ' days once you have an account. After that, ' + (C.name || 'Synapse Pro') + ' is ' + priceLine() + ' once, yours forever.'] : started ? ['Your free trial has ended', 'Get ' + (C.name || 'Synapse Pro') + ' to keep using Synapse. ' + priceLine() + ' once, yours forever.'] : ['Try Synapse free for ' + (W.trialDays || 3) + ' days', 'Everything in Synapse, free for ' + (W.trialDays || 3) + ' days. After that, ' + (C.name || 'Synapse Pro') + ' is ' + priceLine() + ' once, yours forever.'])
      : [C.name || 'Synapse Pro', pro ? 'You have ' + C.name + '. Everything is unlocked.' : GATE && trialOn() ? trialText() + '. ' + priceLine() + ' once to keep everything.' : (C.tagline ? C.tagline.replace((C.name || 'Synapse Pro') + ' \u2014 ', '') : 'Unlock every course, tool and deck.')];
    w.innerHTML = '<div class="pw-in">'
      + (g ? '' : '<button type="button" class="pw-x" data-pw-x aria-label="Close">' + svg('x', 20, 2.2) + '</button>')
      + '<div class="pw-hero' + (g ? ' pw-hero-gate' : '') + '"><img class="pw-logo" src="' + esc(logo()) + '" alt=""><h2 id="pwT">' + esc(hero[0]) + '</h2>'
      + '<p>' + esc(hero[1]) + '</p></div>'
      + (g && !started ? (signedOut
          ? '<button type="button" class="pw-cta" data-pw-signup>Make an account</button><button type="button" class="pw-cta pw-cta2" data-pw-signin>I already have one \u2014 sign in</button>'
          : '<button type="button" class="pw-cta" data-pw-signin>Account</button>') + '<h3 class="pw-or">Or buy it now</h3>' : '')
      + (!pro && from ? '<div class="pw-from">' + svg('lock', 15, 2) + '<span>' + esc(from) + ' ' + (/s$/.test(from) && !/^The /.test(from) ? 'are' : 'is') + ' part of ' + esc(C.name) + '</span></div>' : '')
      + '<ul class="pw-ben">' + (C.benefits || []).map(function (b) { return '<li><span class="pw-bi">' + svg(b[0], 19) + '</span><span class="pw-bt"><b>' + esc(b[1]) + '</b><small>' + esc(b[2]) + '</small></span></li>'; }).join('') + '</ul>'
      + (pro
        ? (WEB ? '<p class="pw-fine">' + esc(webStatus()) + '</p>' + aaHtml() : (cur && cur.type === 'subs' ? '<a class="pw-cta" href="' + esc(LINKS.manage) + '" target="_blank" rel="noopener">Manage subscription</a>' : '') + '<p class="pw-fine">Thanks for supporting Synapse.</p>')
        : '<div class="pw-plans" role="radiogroup" aria-label="Choose a plan">' + plansHTML() + '</div>'
          + (WEB && !CHECKOUT && WC.why ? '<p class="pw-why">' + esc(WC.why) + '</p>' : '')
          + '<button type="button" class="pw-cta" data-pw-buy>' + esc(ctaText()) + '</button>'
          + '<p class="pw-fine">' + esc(fineText()) + '</p>')
      + (g && started && signedOut ? '<button type="button" class="pw-cta pw-cta2" data-pw-signin>Sign in</button>' : '')
      + (g && a ? '<p class="pw-fine">Signed in as ' + esc(a.email) + '. <button type="button" class="pw-inl" data-pw-signin>Account</button></p>' : '')
      + '<div class="pw-links">' + (WEB
          ? '<button type="button" data-pw-code>' + esc(CHECKOUT ? ((W.checkout || {}).keyTitle || 'Have a license key?') : (WC.codeTitle || 'Have an unlock code?')) + '</button>' + (st().code ? '<span aria-hidden="true">·</span><button type="button" data-pw-restore>Restore</button>' : '')
          : '<button type="button" data-pw-restore>Restore purchases</button>') + '<span aria-hidden="true">·</span>'
      + '<a href="' + esc(LINKS.terms) + '" target="_blank" rel="noopener">Terms</a><span aria-hidden="true">·</span>'
      + '<a href="' + esc(LINKS.privacy) + '" target="_blank" rel="noopener">Privacy</a></div>'
      + '</div>';
    document.body.appendChild(w);
    document.documentElement.classList.add('pw-open');
    requestAnimationFrame(function () { w.classList.add('in'); });
    w.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-pw-x]')) return closePaywall();
      var pl = t.closest('[data-pw-plan]'); if (pl) { sel = pl.dataset.pwPlan; paintPlans(); return; }
      if (t.closest('[data-pw-buy]')) { var p = PRODUCTS.filter(function (x) { return x.id === sel; })[0]; if (p) buy(p); return; }
      if (t.closest('[data-pw-restore]')) return restore();
      if (t.closest('[data-pw-code]')) return view('code');
      if (t.closest('[data-pw-back]')) return paywall(lastFrom);
      if (t.closest('[data-pw-done]')) return closePaywall();
      if (t.closest('[data-pw-trial]')) return startTrial();
      if (t.closest('[data-pw-signup]')) { if (window.Account) Account.open('signup'); return; }
      if (t.closest('[data-pw-signin]')) { if (window.Account) Account.open(); return; }
    });
    w.addEventListener('input', function (e) { var t = e.target; if (t.name === 'contact' && /\D/.test(t.value)) { t.value = t.value.replace(/\D/g, '').slice(0, 14); } var f = t.form; if (f) err(f, ''); });
    w.addEventListener('change', function (e) { var t = e.target; if (t.name === 'plan') { buyPlan = t.value; w.querySelectorAll('.pw-bplan').forEach(function (l) { var i = l.querySelector('input'); l.classList.toggle('on', !!(i && i.checked)); }); } if (t.name === 'cc') { var c = CC[+t.value] || CC[0], s = t.parentNode.querySelector('.pw-cc'); if (s) s.textContent = flag(c[0]) + ' +' + c[1]; } });
    w.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target; if (f.matches('[data-pw-form]')) sendRequest(f); else if (f.matches('[data-pw-codeform]')) sendCode(f);
    });
    loadPrices();
  }

  var BUY_PLANS = [{ id: 'synapse_lifetime', name: 'Synapse Lifetime', price: '$35', sub: 'Synapse, unlocked for good' }, { id: 'all_access', name: 'Northpeak All-Access', price: '$100', sub: 'Synapse and every Northpeak Studios app, now and later' }];
  var buyPlan = 'synapse_lifetime';
  var CC = [['US', '1', 'United States'], ['CA', '1', 'Canada'], ['MX', '52', 'Mexico'], ['CU', '53', 'Cuba'], ['GB', '44', 'United Kingdom'], ['IE', '353', 'Ireland'], ['FR', '33', 'France'], ['DE', '49', 'Germany'],
    ['ES', '34', 'Spain'], ['IT', '39', 'Italy'], ['PT', '351', 'Portugal'], ['NL', '31', 'Netherlands'], ['BE', '32', 'Belgium'], ['CH', '41', 'Switzerland'], ['AT', '43', 'Austria'], ['SE', '46', 'Sweden'],
    ['NO', '47', 'Norway'], ['DK', '45', 'Denmark'], ['FI', '358', 'Finland'], ['PL', '48', 'Poland'], ['GR', '30', 'Greece'], ['TR', '90', 'Turkey'], ['IL', '972', 'Israel'], ['AE', '971', 'United Arab Emirates'],
    ['SA', '966', 'Saudi Arabia'], ['EG', '20', 'Egypt'], ['NG', '234', 'Nigeria'], ['KE', '254', 'Kenya'], ['ZA', '27', 'South Africa'], ['IN', '91', 'India'], ['PK', '92', 'Pakistan'], ['PH', '63', 'Philippines'],
    ['CN', '86', 'China'], ['JP', '81', 'Japan'], ['KR', '82', 'South Korea'], ['VN', '84', 'Vietnam'], ['AU', '61', 'Australia'], ['NZ', '64', 'New Zealand'], ['BR', '55', 'Brazil'], ['AR', '54', 'Argentina'],
    ['CO', '57', 'Colombia'], ['PE', '51', 'Peru'], ['CL', '56', 'Chile'], ['VE', '58', 'Venezuela']];
  var flag = function (iso) { return String.fromCodePoint.apply(null, iso.split('').map(function (ch) { return 0x1F1E6 + ch.charCodeAt(0) - 65; })); };
  function ccOptions() { return CC.map(function (c, i) { return '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' + flag(c[0]) + ' +' + c[1] + ' ' + esc(c[2]) + '</option>'; }).join(''); }
  /* ---------- web-sale screens: request form, request sent, unlock code ---------- */
  var lastFrom = '';
  function aaCode() { var a = acct(), s = st(); return (a && a.aaCode) || (s.active && s.id === 'all_access' && s.code) || ''; }
  function aaHtml() { // Northpeak All-Access: the same code unlocks Axon (and every future Northpeak app)
    var c = aaCode(); if (!c) return '';
    return '<p class="pw-fine" style="margin-top:8px">You have <b>Northpeak All-Access</b>. Your code <b style="user-select:all;-webkit-user-select:all;letter-spacing:.04em">' + esc(c) + '</b> unlocks Axon too: in Axon, open <b>Settings \u203a Get Axon Pro \u203a Have an All-Access code?</b></p>';
  }
  function webStatus() {
    if (owner()) return acct() && acct().owner ? 'Your account is the owner account. Everything is unlocked.' : 'This device is unlocked as the owner\u2019s copy.';
    if (acct() && acct().pro) return 'Synapse Pro is on your account, on every device you sign in on. Thanks for supporting Synapse.';
    var s = st(), p = PRODUCTS.filter(function (x) { return x.id === s.id; })[0];
    return 'Synapse Pro is active on this device' + (s.exp ? ', until ' + new Date(s.exp).toLocaleDateString() : '') + '. Thanks for supporting Synapse.';
  }
  function head(t) { return '<button type="button" class="pw-x" data-pw-back aria-label="Back">' + svg('x', 20, 2.2) + '</button><div class="pw-hero pw-hero-sm"><img class="pw-logo" src="' + esc(logo()) + '" alt=""><h2 id="pwT">' + esc(t) + '</h2></div>'; }
  function view(v) {
    var w = document.querySelector('.pw:not(.ac-sheet)'); if (!w) { paywall(lastFrom); w = document.querySelector('.pw:not(.ac-sheet)'); if (!w) return; }
    var inn = w.querySelector('.pw-in'), h = '';
    if (v === 'form') {
      h = head(WC.formTitle || 'Request an Apple Cash payment')
        + '<form class="pw-form" data-pw-form novalidate>'
        + '<div class="pw-plans pw-bplans" role="radiogroup" aria-label="Choose a plan">' + BUY_PLANS.map(function (p, i) { var on = p.id === buyPlan;
            return '<label class="pw-plan pw-bplan' + (on ? ' on' : '') + '"><input type="radio" name="plan" value="' + esc(p.id) + '"' + (on ? ' checked' : '') + '><span class="pw-radio" aria-hidden="true"></span><span class="pw-pl"><b>' + esc(p.name) + '</b><small>' + esc(p.sub) + '</small></span><span class="pw-pp"><b>' + esc(p.price) + '</b><small>one time</small></span></label>'; }).join('') + '</div>'
        + '<p class="pw-fine">Both are one-time payments after the 3-day free trial. No subscription.</p>'
        + '<label>Name or nickname<input name="name" maxlength="60" autocomplete="nickname" required></label>'
        + '<label>Account email<input name="email" type="email" maxlength="254" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="you@example.com" value="' + esc(acct() && acct().email || '') + '" required><small class="pw-hint">Your purchase is attached to this email. Sign in with it on any device to unlock.</small></label>'
        + '<label for="pwTel">Your phone number (for the Apple Cash request)</label><div class="pw-tel"><select name="cc" aria-label="Country code" autocomplete="tel-country-code">' + ccOptions() + '</select><span class="pw-cc" aria-hidden="true">' + flag('US') + ' +1</span>'
        + '<input id="pwTel" name="contact" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="14" autocomplete="tel-national" placeholder="5305551234" required></div>'
        + '<input class="pw-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
        + (WC.why ? '<p class="pw-why">' + esc(WC.why) + '</p>' : '')
        + '<p class="pw-fine pw-err" data-pw-err hidden></p>'
        + '<button type="submit" class="pw-cta">Send request</button>'
        + '<p class="pw-fine">' + esc(WC.formNote || '') + '</p></form>';
    } else if (v === 'sent') {
      h = head('Request sent')
        + '<div class="pw-sent"><span class="pw-ok">' + svg('check', 30, 2.4) + '</span><p><b>' + esc((WC.sent || '').replace('{price}', (BUY_PLANS.filter(function (p) { return p.id === buyPlan; })[0] || BUY_PLANS[0]).price)) + '</b></p>'
        + (WC.why ? '<p class="pw-why">' + esc(WC.why) + '</p>' : '') + '</div>'
        + '<button type="button" class="pw-cta" data-pw-code>' + esc(WC.codeTitle || 'Have an unlock code?') + '</button>'
        + '<div class="pw-links"><button type="button" data-pw-done>Close</button></div>';
    } else if (v === 'code') {
      var lic = CHECKOUT, ck = W.checkout || {};
      h = head(lic ? (ck.keyTitle || 'Have a license key?') : (WC.codeTitle || 'Have an unlock code?'))
        + '<form class="pw-form" data-pw-codeform novalidate><p class="pw-fine">' + esc(lic ? (ck.keyNote || '') : (WC.codeNote || '')) + '</p>'
        + '<label>' + (lic ? 'License key' : 'Unlock code') + '<input name="code" maxlength="200" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="' + (lic ? '' : 'SYN-XXXX-XXXX') + '" required></label>'
        + '<p class="pw-fine pw-err" data-pw-err hidden></p>'
        + '<button type="submit" class="pw-cta">Unlock</button></form>'
        + '<div class="pw-links"><button type="button" data-pw-back>Back</button></div>';
    }
    inn.innerHTML = h; inn.scrollTop = 0;
    var first = inn.querySelector('input[name=name], input[name=code]'); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
  }
  function err(f, m) { var e = f.querySelector('[data-pw-err]'); if (e) { e.textContent = m; e.hidden = !m; } }
  function lock(f, on, txt) { var b = f.querySelector('button[type=submit]'); if (b) { b.disabled = on; if (txt) b.textContent = txt; } }
  /* Northpeak All-Access: the backends pass short signed notes through this page (they can't call each other directly) */
  var NP_PEERS = { synapse: '', axon: 'https://axon-sync.sites.tab.bot' };
  function npHop(j, n) {
    n = n || 0; if (!j || !j.relay || n > 3 || !(j.relay.to in NP_PEERS)) return Promise.resolve(j);
    return fetch(NP_PEERS[j.relay.to] + j.relay.path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ m: j.relay.m, sig: j.relay.sig }) })
      .then(function (r) { return r.json(); }).then(function (k) { return npHop(k, n + 1); }).catch(function () { return j; });
  }
  function sendRequest(f) {
    var pe = f.querySelector('input[name=plan]:checked'), plan = pe ? pe.value : '', name = f.elements['name'].value.trim(), contact = f.elements['contact'].value.trim(), email = f.elements['email'].value.trim().toLowerCase();
    if (!plan) return err(f, 'Choose a plan.');
    if (name.length < 1) return err(f, 'Add a name or nickname.');
    if (!/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/.test(email)) return err(f, 'Enter the email for your account.');
    var digits = contact.replace(/\D/g, ''), cc = CC[+f.elements['cc'].value] || CC[0];
    if (cc[1] === '1' ? digits.length !== 10 : (digits.length < 6 || digits.length > 14)) return err(f, cc[1] === '1' ? 'Enter your 10-digit phone number (area code first).' : 'Enter your phone number (6 to 14 digits).');
    contact = '+' + cc[1] + ' ' + digits;
    err(f, ''); lock(f, true, 'Sending\u2026');
    api('/api/pro/request', { name: name, contact: contact, plan: plan, email: email, website: f.elements['website'].value }).then(function (j) {
      if (j.ok) { npHop(j).then(function () {}, function () {}); view('sent'); return; }
      lock(f, false, 'Send request');
      err(f, j.status === 429 ? 'Too many requests from here. Try again in an hour.' : j.error === 'closed' ? 'Web purchases aren\u2019t open right now.' : j.error === 'bad_email' ? 'Enter the email for your account.' : 'That didn\u2019t send. Check the details and try again.');
    }).catch(function () { lock(f, false, 'Send request'); err(f, 'You look offline. Try again when you\u2019re connected.'); });
  }
  function sendCode(f) {
    var code = f.elements['code'].value.trim(); if (code.length < 6) return err(f, CHECKOUT ? 'Paste the whole license key.' : 'Enter the whole code.');
    err(f, ''); lock(f, true, 'Checking\u2026');
    var ownerTok = code.indexOf('#') >= 0 ? code.slice(code.indexOf('#') + 1) : code;
    if (/^[A-Za-z0-9_-]{30,120}$/.test(ownerTok)) { // the owner's private admin token (or link) marks this device as the owner's copy
      fetch('/api/pro/admin/owner-device', { method: 'POST', headers: { 'x-pro-admin': ownerTok, 'content-type': 'application/json' }, body: JSON.stringify({ device: device() }), credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok) { try { localStorage.setItem('pro.owner', '1'); } catch (e) {} if (j.account && window.Account) Account.refresh(); changed(); closePaywall(); toast(j.account ? 'Your account is now the owner account.' : 'This device is unlocked as the owner\u2019s copy.'); }
        else { lock(f, false, 'Unlock'); err(f, 'That code didn\u2019t work. Check it and try again.'); }
      }).catch(function () { lock(f, false, 'Unlock'); err(f, 'You look offline. Try again when you\u2019re connected.'); });
      return;
    }
    var path = CHECKOUT ? '/api/pro/license' : '/api/pro/redeem';
    api(path, { code: code, key: code, device: device() }).then(function (j) {
      if (j.ok) {
        if (j.bound !== false) webSave({ product: j.product, exp: j.exp, code: j.code || code, kind: CHECKOUT ? 'license' : 'code' });
        if (j.owner && j.bound !== false) { try { localStorage.setItem('pro.owner', '1'); } catch (e) {} }
        var done = function () { changed(); closePaywall(); toast(j.account ? (j.owner ? 'Owner access is on your account now.' : 'Synapse Pro is on your account now, on every device you sign in on.') : j.owner ? 'This device is unlocked as the owner\u2019s copy.' : 'Welcome to Synapse Pro. Everything is unlocked.'); };
        if (j.account && window.Account) Account.refresh().then(done, done); else done();
        return;
      }
      lock(f, false, 'Unlock');
      err(f, j.status === 429 ? 'Too many tries. Wait a bit and try again.' : j.error === 'used' ? 'That code was already used on another device. Contact support if that\u2019s wrong.' : j.error === 'expired' ? 'That pass has ended.' : j.error === 'not_configured' ? 'License keys aren\u2019t set up yet.' : 'That code didn\u2019t work. Check it and try again.');
    }).catch(function () { lock(f, false, 'Unlock'); err(f, 'You look offline. Try again when you\u2019re connected.'); });
  }
  function removePw() {
    var w = document.querySelector('.pw:not(.ac-sheet)'); if (!w) return;
    if (!document.querySelector('.ac-sheet:not(.pw-out)')) document.documentElement.classList.remove('pw-open');
    w.classList.remove('in'); w.classList.add('pw-out'); setTimeout(function () { w.remove(); if (!document.querySelector('.pw')) document.documentElement.classList.remove('pw-open'); }, 180);
  }
  function closePaywall() { if (gated()) { paywall(''); return; } gateOn = false; removePw(); }

  /* ---------- trial + gate ---------- */
  var gateOn = false;
  function gated() { return GATE && !has(); }
  function priceLine() { var p = PRODUCTS[0] || {}; return p.price || '$35'; }
  function trialText() { var l = trialLeft() || 0, d = Math.ceil(l / 864e5); return l < 864e5 ? 'Trial: ends today' : 'Trial: ' + d + ' day' + (d === 1 ? '' : 's') + ' left'; }
  function startTrial() { // the trial only exists on an account: signed out, this opens account creation
    if (!acct()) { if (window.Account) Account.open('signup'); return; }
    changed();
  }
  function syncTrial() { try { localStorage.removeItem('pro.trial'); } catch (e) {} } // old device-trial clock: no longer used, cleared
  function check() {
    if (!GATE) return;
    var g = gated(); try { if (g) localStorage.setItem('pro.locked', '1'); else localStorage.removeItem('pro.locked'); } catch (e) {}
    var w = document.querySelector('.pw:not(.ac-sheet):not(.pw-out)');
    if (g) { if (!w || !w.dataset.gate) paywall(''); }
    else if (w && w.dataset.gate) { gateOn = false; removePw(); }
    document.querySelectorAll('[data-pro-trial]').forEach(function (b) { var on = !owner() && !paid() && trialOn(); b.hidden = !on; if (on) b.textContent = trialText(); });
  }
  function trialBadge() { if (!GATE || owner() || paid() || !trialOn()) return ''; return '<button type="button" class="pro-trial" data-pro-trial data-pro-open="trial">' + esc(trialText()) + '</button>'; }

  /* a locked course level, drawn inside Learn (learn.js asks Pro.blockLevel before drawing a course or lesson) */
  function blockLevel(el, lvl) {
    if (!el || levelOk(lvl)) return false;
    el.innerHTML = '<div class="pro-wall"><span class="pro-wall-ic">' + svg('lock', 26, 2) + '</span><h3>This level is part of ' + esc(C.name) + '</h3>'
      + '<p>The first level of every course is free. ' + esc(C.name) + ' unlocks High school to Doctor level, with every test.</p>'
      + '<button type="button" class="btn pri wide" data-pro-open="learn:' + esc(lvl) + '">See ' + esc(C.name) + '</button>'
      + '<button type="button" class="btn wide" data-lback>Back</button></div>';
    return true;
  }

  /* ---------- gates: taps on locked things open the paywall instead ---------- */
  function keyOf(t) {
    var d = t.dataset || {};
    if (d.proOpen) return d.proOpen;
    if (d.shOpen) return d.shOpen;
    if (d.shFeat) return d.shFeat;
    if (d.labOpen) return d.labOpen;
    if (d.lgo) return 'learn:' + d.lgo.split('|')[1];
    if (d.llv) return 'learn:' + d.llv;
    if (d.sIcon) return d.sIcon !== 'default' ? 'icons' : '';
    if (d.shSeg === 'library') return 'library';
    if ('docRandom' in d) return 'docrandom';
    if ('labTutor' in d) return 'tc';
    return '';
  }
  var SEL = '[data-pro-open],[data-sh-open],[data-sh-feat],[data-lab-open],[data-lgo],[data-llv],[data-s-icon],[data-sh-seg="library"],[data-doc-random],[data-lab-tutor]';
  window.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest(SEL); if (!t || t.closest('.pw')) return;
    var k = keyOf(t); if (!k) return;
    if (t.dataset.proOpen || locked(k)) { e.preventDefault(); e.stopImmediatePropagation(); try { if (typeof closeSheet === 'function' && t.closest('#sheetWrap')) closeSheet(); } catch (x) {} paywall(k); }
  }, true);

  /* small lock on locked rows */
  function decorate() {
    if (has()) return;
    document.querySelectorAll(SEL).forEach(function (el) {
      if (el.hasAttribute('data-pro-dec') || el.closest('.pw') || el.dataset.proOpen) return;
      var k = keyOf(el); if (!k || !locked(k)) return;
      el.setAttribute('data-pro-dec', '');
      var lk = document.createElement('span'); lk.className = 'pro-lock'; lk.setAttribute('aria-label', 'Synapse Pro'); lk.innerHTML = svg('lock', 13, 2.2);
      var chev = el.querySelector(':scope > [class*="chev"]');
      if (chev) el.insertBefore(lk, chev); else el.appendChild(lk);
    });
  }
  var queued = false;
  new MutationObserver(function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; decorate(); }); })
    .observe(document.documentElement, { childList: true, subtree: true });

  /* backstops for screens reached another way (search, recents, Home shortcuts, deep links) */
  function wrap() {
    if (window.XView && XView.open && !XView.open._pro) {
      var xo = XView.open;
      XView.open = function (n) { if (locked(n)) { paywall(n); return; } return xo.apply(this, arguments); };
      XView.open._pro = 1;
    }
    if (typeof window.go === 'function' && !window.go._pro) {
      var og = window.go;
      var ng = function (v) { if ((v === 'library' || v === 'anat') && locked(v)) { paywall(v); return; } return og.apply(this, arguments); };
      ng._sh = og._sh; ng._pro = 1; window.go = ng; try { go = ng; } catch (e) {}
    }
  }

  window.Pro = { on: true, web: WEB, has: has, locked: locked, levelOk: levelOk, blockLevel: blockLevel, paywall: paywall, close: closePaywall, refresh: refresh, restore: restore,
    label: function () { if (GATE) return owner() ? 'Owner' : paid() ? 'Active' : trialOn() ? trialText() : 'Unlock Synapse'; return has() ? 'Active' : 'Unlock every course, tool and deck'; }, view: view,
    owner: owner, device: device, trialBadge: trialBadge, trialLeft: trialLeft, gated: gated, accountChanged: function () { changed(); } };

  function boot() {
    wrap(); decorate(); check(); syncTrial();
    if (GATE) { setInterval(check, 30000); document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); }); }
    setTimeout(function () { refresh(false); loadPrices(); }, 1500);
    try { if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App) Capacitor.Plugins.App.addListener('resume', function () { refresh(false); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
