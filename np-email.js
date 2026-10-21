/* np-email.js v1 (Oct 21, 2026): when a Northpeak account's email changes, every app's account follows it.
   Synapse holds the Northpeak identity. Changing the email there (from any app) answers signed notes {old -> new}; each other
   app's backend moves its own account only with proof the person holds it there: a session on it, or the password proof made
   on this device (the password itself never leaves the device). No secrets in this file. */
(function () {
  'use strict';
  var SYN = 'https://odin-cards.sites.tab.bot';
  var APPS = { axon: ['https://axon-sync.sites.tab.bot', 'axon-sync/v1:'], liminal: ['https://liminal-sync.sites.tab.bot', 'liminal-sync/v1:'] };
  var te = new TextEncoder();
  function hex(b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  async function call(url, body, tok, syn) {
    var h = { 'content-type': 'application/json' };
    if (tok) h.authorization = 'Bearer ' + tok;
    if (syn) h['x-syn-bearer'] = '1';
    var r;
    try { r = await fetch(url, { method: body ? 'POST' : 'GET', headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', credentials: 'omit' }); }
    catch (e) { return { status: 0, j: null }; }
    var j = null; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j: j };
  }
  /* the login proof an app's backend checks (the second half of the same PBKDF2 the app itself runs) */
  async function proof(salt, user, pass) {
    var base = await crypto.subtle.importKey('raw', te.encode(String(pass).normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    var bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: te.encode(salt + String(user || '').trim().toLowerCase()), iterations: 600000 }, base, 512));
    var a = hex(bits.slice(32)); bits.fill(0); return a;
  }
  /* move each app's account that still has an old email. opt: { skip: 'axon', only: 'liminal', tokens: { axon: '<session>' } }
     -> { axon: '<old email it moved from>', liminal: ... } for the apps that moved */
  async function apply(moves, pass, opt) {
    opt = opt || {}; var out = {};
    if (!moves || !moves.length) return out;
    for (var app in APPS) {
      if (opt.skip === app || (opt.only && opt.only !== app)) continue;
      var tok = opt.tokens && opt.tokens[app];
      for (var i = 0; i < moves.length; i++) {
        var mv = moves[i], n = mv && mv[app]; if (!n || !n.m) continue;
        var r = await call(APPS[app][0] + '/api/email-moved', { m: n.m, sig: n.sig }, tok);
        if (r.j && r.j.ok) { if (r.j.moved) { out[app] = mv.old; break; } continue; } // no account there with that email
        if (r.j && r.j.error === 'need_auth' && pass) {
          var k = await call(APPS[app][0] + '/api/kdf', { email: mv.old });
          var a = await proof(APPS[app][1], (k.j && k.j.kdf) || mv.old, pass);
          r = await call(APPS[app][0] + '/api/email-moved', { m: n.m, sig: n.sig, auth: a });
          if (r.j && r.j.moved) { out[app] = mv.old; break; }
        }
      }
    }
    return out;
  }
  /* change the Northpeak (Synapse) account's email. tok: a Synapse bearer token for the old email, if this app has one.
     -> { ok, moves, token, user } | { error: 'exists' | 'email_locked' | 'bad_password' | ... } | { skip: 'bad_login' (no Synapse account with this password) } */
  async function changeSynapse(oldEmail, newEmail, pass, tok) {
    for (var round = 0; round < 2; round++) {
      if (!tok) {
        var l = await call(SYN + '/api/auth/login', { email: oldEmail, password: String(pass) }, null, true);
        if (!l.j || !l.j.ok || !l.j.token) return { skip: (l.j && l.j.error) || 'offline' };
        tok = l.j.token;
      }
      var c = await call(SYN + '/api/auth/email', { email: newEmail, password: String(pass) }, tok, true);
      if (c.j && c.j.ok) return { ok: true, moves: c.j.moves || [], token: tok, user: c.j.user || null };
      if (c.j && c.j.error === 'signed_out' && !round) { tok = null; continue; }
      return { error: (c.j && c.j.error) || 'offline', status: c.status };
    }
    return { error: 'signed_out' };
  }
  /* the Northpeak account behind a Synapse bearer token, with its email moves (for an app that's still signed in on an old email) */
  async function synMe(tok) { var r = await call(SYN + '/api/auth/me', null, tok, true); return r.j && r.j.ok ? r.j : null; }
  window.NPEmail = { apply: apply, changeSynapse: changeSynapse, synMe: synMe, SYN: SYN };
})();
