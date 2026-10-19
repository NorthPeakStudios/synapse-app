/* Streak reminders (Web Push) — Settings section + background activity reports.
   window.Push = { render(el), report(), state() }. Server: /api/notify/* (feat/push/api.js). Needs the 'push' +
   'notificationclick' handlers in sw.js. iOS: works only in the installed Home Screen app (iOS 16.4+), and the
   permission prompt must come from a tap, so turnOn() calls pushManager.subscribe() straight from the click. */
(function () {
  'use strict';
  if (window.Push) return;
  const LS = 'push.v1', DEF_REMIND = 20 * 60;
  const S = (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })();
  if (!Number.isInteger(S.remind)) S.remind = DEF_REMIND;
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };
  const ua = navigator.userAgent || '';
  const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'; } catch (e) { return 'America/Los_Angeles'; } };
  const code = () => { try { return typeof meta !== 'undefined' && meta && meta.code || null; } catch (e) { return null; } }; // app.js sync code, if paired
  const unb64 = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const ICON = {
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  };
  const ic = n => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const fmt = m => { const h = Math.floor(m / 60), mm = m % 60; return new Date(2000, 0, 1, h, mm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const haptic = () => { try { window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (e) {} };

  async function api(path, body) {
    const h = { 'content-type': 'application/json' }, c = code(); if (c) h['x-sync-code'] = c;
    const r = await fetch('/api/notify/' + path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h });
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { status: r.status, ...j };
  }
  // what the server needs to judge "studied today": the last active day (Hub day key) and the streak on that day
  // v56: second reminder + quiet hours from Settings (minutes after midnight; null = off)
  const hm = v => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v || '')); return m ? (+m[1] % 24) * 60 + (+m[2] % 60) : null; };
  function extra() {
    if (!window.Settings) return {};
    const q = !!Settings.get('notify.quiet');
    return { remind2: hm(Settings.get('notify.second')), quiet_from: q ? hm(Settings.get('notify.quietFrom')) : null, quiet_to: q ? hm(Settings.get('notify.quietTo')) : null };
  }
  function activity() {
    if (!window.Hub) return {};
    const t = Hub.today(), st = Hub.streak();
    if (t.done) return { active: Hub.dayKey(), streak: st };
    if (st > 0) return { active: Hub.dayKey(Date.now() - 864e5), streak: st };
    return { streak: 0 };
  }

  /* ---- prefetch so the tap can call subscribe() synchronously (iOS wants the prompt inside the gesture) ---- */
  const pre = { key: S.key || null, reg: null, sub: null };
  let preP = null;
  function prefetch() {
    if (preP) return preP;
    preP = (async () => {
      if (!supported()) return;
      try { pre.reg = await navigator.serviceWorker.getRegistration('/') || null; } catch (e) {}
      try { if (pre.reg) pre.sub = await pre.reg.pushManager.getSubscription(); } catch (e) {}
      try { const k = await api('key'); if (k.ok && k.key) { pre.key = k.key; if (S.key !== k.key) { S.key = k.key; save(); } } } catch (e) {}
    })();
    return preP;
  }

  let ui = null, busy = false, msg = '';
  function status() {
    if (!supported()) {
      if (isIOS && !standalone()) return { tone: 'note', text: 'Open the app from its Home Screen icon to turn these on.' };
      return { tone: 'note', text: 'This browser can’t show notifications.' };
    }
    if (Notification.permission === 'denied') return { tone: 'warn', text: 'Blocked. Allow them in iPhone Settings → Notifications → Cards.' };
    if (msg) return { tone: 'note', text: msg };
    if (!S.sid) return { tone: '', text: 'Off' };
    const done = window.Hub && Hub.today().done;
    const r2 = extra().remind2; return { tone: 'on', text: done ? `Done for today. No reminder tonight.` : r2 != null ? `If you haven’t studied by ${fmt(S.remind)}, you’ll get a reminder, and another at ${fmt(r2)} if you still haven’t.` : `If you haven’t studied by ${fmt(S.remind)}, you’ll get one reminder.` };
  }
  function paint() {
    if (!ui || !ui.isConnected) return;
    const on = !!S.sid, st = status(), can = supported() && Notification.permission !== 'denied';
    const sw = ui.querySelector('.pu-sw');
    sw.setAttribute('aria-checked', String(on)); sw.disabled = busy || !can; sw.classList.toggle('busy', busy);
    const s = ui.querySelector('.pu-st'); s.textContent = st.text; s.dataset.tone = st.tone;
    ui.querySelector('.pu-time').value = hhmm(S.remind);
    ui.querySelector('.pu-trow').classList.toggle('dim', !on);
    ui.querySelector('.pu-test').hidden = !on;
    ui.querySelector('.pu-foot').hidden = !isIOS;
  }
  function render(el) {
    el.innerHTML = `<section class="pu" aria-label="Reminders">
      <h3 class="pu-h">Reminders</h3>
      <div class="pu-group">
        <div class="pu-row">
          <span class="pu-ic">${ic('bell')}</span>
          <span class="pu-l"><span class="pu-t" id="pu-lbl">Streak reminder</span><span class="pu-st" aria-live="polite"></span></span>
          <button type="button" class="pu-sw" role="switch" aria-checked="false" aria-labelledby="pu-lbl"><span class="pu-knob"></span></button>
        </div>
        <label class="pu-row pu-trow">
          <span class="pu-ic">${ic('clock')}</span>
          <span class="pu-l"><span class="pu-t">Remind me at</span></span>
          <input type="time" class="pu-time" step="300" value="${hhmm(S.remind)}">
        </label>
        <button type="button" class="pu-row pu-test" hidden>
          <span class="pu-ic">${ic('send')}</span>
          <span class="pu-l"><span class="pu-t pu-acc">Send a test notification</span></span>
        </button>
      </div>
      <p class="pu-foot" hidden>Reminders only come on days you haven’t studied yet. Works in the Home Screen app. If the switch does nothing, turn on Sync first, then delete the app icon and add it again from Safari (Share → Add to Home Screen).</p>
    </section>`;
    ui = el.querySelector('.pu');
    ui.querySelector('.pu-sw').addEventListener('click', () => { haptic(); S.sid ? turnOff() : turnOn(); });
    ui.querySelector('.pu-time').addEventListener('change', e => setTime(e.target.value));
    ui.querySelector('.pu-test').addEventListener('click', test);
    paint();
    prefetch().then(() => { reconcile(); paint(); });
  }

  function turnOn() {
    if (busy) return;
    if (!supported()) { paint(); return; }
    busy = true; msg = ''; paint();
    const opts = k => ({ userVisibleOnly: true, applicationServerKey: unb64(k) });
    let p;
    if (pre.sub) p = Promise.resolve(pre.sub);                                     // already subscribed on this device
    else if (pre.reg && pre.key) p = pre.reg.pushManager.subscribe(opts(pre.key)); // called inside the tap: shows the prompt
    else p = Notification.requestPermission().then(async perm => {                 // fallback: prompt first, then subscribe
      if (perm !== 'granted') throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      await prefetch(); const reg = pre.reg || await navigator.serviceWorker.ready;
      if (!pre.key) throw new Error('no_key');
      return reg.pushManager.subscribe(opts(pre.key));
    });
    p.catch(async e => {
      // a subscription made with an older server key: drop it and make a fresh one (permission is already granted)
      if (e && e.name === 'InvalidStateError' && pre.reg && pre.key) { const old = await pre.reg.pushManager.getSubscription(); if (old) await old.unsubscribe(); return pre.reg.pushManager.subscribe(opts(pre.key)); }
      throw e;
    }).then(async sub => {
      pre.sub = sub;
      const r = await api('subscribe', { sub: sub.toJSON(), tz: tz(), remind: S.remind, ...activity() });
      if (!r.ok) throw new Error(r.error || 'server');
      S.sid = r.sid; S.endpoint = sub.endpoint; S.sent = ''; save(); report(true);
      msg = ''; if (window.toast) toast('Reminders on');
    }).catch(e => {
      const denied = e && (e.name === 'NotAllowedError' || Notification.permission === 'denied');
      msg = denied ? (Notification.permission === 'denied' ? '' : 'Not allowed. Tap the switch again and choose Allow.')
        : !navigator.onLine ? 'You’re offline. Try again when you’re connected.'
        : 'Couldn’t turn on reminders. Try again in a moment.';
      console.warn('push on', e);
    }).finally(() => { busy = false; paint(); });
  }
  async function turnOff() {
    if (busy) return; busy = true; msg = ''; paint();
    const sid = S.sid;
    try { if (sid) await api('unsubscribe', { sid }); } catch (e) {}
    try { const sub = pre.sub || (pre.reg && await pre.reg.pushManager.getSubscription()); if (sub) await sub.unsubscribe(); } catch (e) {}
    pre.sub = null; delete S.sid; delete S.endpoint; delete S.sent; save();
    busy = false; paint();
  }
  async function setTime(v) {
    const m = /^(\d{1,2}):(\d{2})/.exec(v || ''); if (!m) return;
    const min = (+m[1]) * 60 + (+m[2]); if (!(min >= 0 && min < 1440)) return;
    S.remind = min; save(); paint();
    if (S.sid) { try { const r = await api('update', { sid: S.sid, remind: min, tz: tz() }); if (r.status === 404) lost(); } catch (e) {} }
  }
  async function test() {
    if (!S.sid) return;
    const b = ui && ui.querySelector('.pu-test .pu-t'); if (b) b.textContent = 'Sending…';
    let r = {}; try { r = await api('test', { sid: S.sid }); } catch (e) { r = { error: 'offline' }; }
    if (r.status === 404 || r.status === 410) { lost(); }
    msg = r.ok ? 'Sent. It should show up in a few seconds.' : r.status === 429 ? 'Just sent one. Give it a moment.' : r.status === 404 || r.status === 410 ? '' : 'Couldn’t send a test right now.';
    if (b) b.textContent = 'Send a test notification';
    paint(); clearTimeout(test.t); test.t = setTimeout(() => { msg = ''; paint(); }, 6000);
  }
  function lost() { delete S.sid; delete S.endpoint; save(); msg = 'Reminders were switched off on this device. Turn them on again.'; paint(); }

  /* ---- keep the server's copy honest: same device subscription, today's activity, timezone ---- */
  async function reconcile() {
    if (!S.sid || !supported()) return;
    try {
      const sub = pre.sub || (pre.reg && await pre.reg.pushManager.getSubscription());
      if (!sub) { // iOS dropped it (app removed / permission reset)
        if (Notification.permission === 'granted' && pre.reg && pre.key) { const n = await pre.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64(pre.key) }).catch(() => null); if (n) return resub(n); }
        try { await api('unsubscribe', { sid: S.sid }); } catch (e) {} lost(); return;
      }
      if (sub.endpoint !== S.endpoint) return resub(sub);
    } catch (e) {}
    report(true);
  }
  async function resub(sub) {
    const r = await api('subscribe', { sub: sub.toJSON(), tz: tz(), remind: S.remind, ...activity() }).catch(() => ({}));
    if (r.ok) { pre.sub = sub; S.sid = r.sid; S.endpoint = sub.endpoint; S.sent = ''; save(); paint(); }
  }
  let rt = null;
  function report(now) {
    if (!S.sid) return;
    clearTimeout(rt);
    rt = setTimeout(async () => {
      const a = activity(), z = tz(), x = extra(), sig = [a.active || '', a.streak || 0, z, code() ? 1 : 0, x.remind2, x.quiet_from, x.quiet_to].join('|');
      if (sig === S.sent) return;
      try {
        const r = await api('update', { sid: S.sid, tz: z, ...a, ...x });
        if (r.ok) { S.sent = sig; save(); } else if (r.status === 404) lost();
      } catch (e) { /* offline: tries again on the next change or app open */ }
      paint();
    }, now ? 50 : 1500);
  }
  function boot() {
    if (window.Hub && Hub.onChange) Hub.onChange(() => { report(); paint(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { S.sent = ''; report(); } });
    addEventListener('online', () => report());
    try { if (window.Settings && Settings.on) Settings.on('notify.*', () => report(true)); } catch (e) {}
    if (S.sid) prefetch().then(reconcile);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.Push = { render, report, state: () => ({ on: !!S.sid, remind: S.remind, supported: supported(), standalone: standalone(), permission: 'Notification' in window ? Notification.permission : 'unsupported' }) };
})();
