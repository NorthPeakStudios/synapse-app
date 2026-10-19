/* Hub: ONE streak + XP store for the whole app (Cards, Learn, Doctordle, Weak Spots, Anatomy, Chess, Camera, Library).
   Same-origin localStorage so /chess/ and /shot/ write to it too; the Cards app syncs it through D1
   (progress records t:'hx', one per day, merged by taking the larger count). */
(function () {
  'use strict';
  if (window.Hub) return;
  const KEY = 'hub.v1';
  const XP = { focus: 15, speak: 2, rx: 3, exam: 10, review: 2, again: 1, lesson: 10, test: 10, doc: 25, docfail: 5, weak: 3, anat: 2, chess: 5, photo: 5, lib: 2, speak: 3, rx: 2, sim: 15, lesion: 3, ecg: 2, scan: 3, match: 2, conj: 1, hands: 2 };
  const LABEL = { focus: 'focus blocks', speak: 'speaking', rx: 'interaction game', exam: 'exams', review: 'card reviews', again: 'missed cards', lesson: 'lessons', test: 'tests', doc: 'doctordles', docfail: 'doctordle tries', weak: 'weak spots', anat: 'anatomy', chess: 'chess', photo: 'photos', lib: 'library', speak: 'speaking', rx: 'interactions', sim: 'patient sims', lesion: 'lesion locator', ecg: 'ECG strips', scan: 'scan reading', match: 'drug matching', conj: 'verb drills', hands: 'hands-free review' };
  const pad = n => String(n).padStart(2, '0');
  // a "day" ends at 4 AM, like the flashcard scheduler
  const dayKey = (t = Date.now()) => { const d = new Date(t - 4 * 36e5); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const prevKey = k => { const [y, m, d] = k.split('-').map(Number); const x = new Date(y, m - 1, d - 1, 12); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) {} return {}; }
  let S = load(); norm();
  function norm() { S.days = S.days || {}; S.goal = S.goal || 50; S.dirty = S.dirty || {}; }
  const subs = new Set();
  function save(quiet) { S.mod = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} if (!quiet) emit(); }
  function emit() { subs.forEach(f => { try { f(); } catch (e) {} }); paint(); }
  addEventListener('storage', e => { if (e.key === KEY) { S = load(); norm(); emit(); } });

  const total = () => { let t = 0; for (const k in S.days) t += S.days[k].xp || 0; return t; };
  // level L starts at 25·L·(L−1) XP: 0, 50, 150, 300, 500, 750 …
  const levelOf = x => Math.floor((1 + Math.sqrt(1 + 4 * x / 25)) / 2);
  const startOf = L => 25 * L * (L - 1);
  function level() { const x = total(), L = levelOf(x), a = startOf(L), b = startOf(L + 1); return { level: L, xp: x, into: x - a, need: b - a, pct: Math.min(100, Math.round((x - a) / (b - a) * 100)) }; }
  const active = k => { const d = S.days[k]; if (!d) return false; for (const c in d.c) if (d.c[c] > 0) return true; return (d.xp || 0) > 0; };
  // streak with freezes: every 7 days in a row earns a freeze (max 2); a missed day uses one automatically. Pure function of the day data, so it syncs for free.
  const nextKey = k => { const [y, m, d] = k.split('-').map(Number); const x = new Date(y, m - 1, d + 1, 12); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  let frzCache = null;
  function freezeCalc() {
    const sig = JSON.stringify(Object.keys(S.days).length) + dayKey() + (S.days[dayKey()] ? 1 : 0) + Object.keys(S.days).filter(active).length;
    if (frzCache && frzCache.sig === sig) return frzCache;
    const ks = Object.keys(S.days).filter(active).sort(), today = dayKey(), out = { sig, have: 0, frozen: [], run: 0 };
    if (!ks.length) return (frzCache = out);
    let k = ks[0], run = 0, have = 0, guard = 0;
    while (k <= today && guard++ < 4000) {
      if (active(k)) { run++; if (run % 7 === 0) have = Math.min(2, have + 1); }
      else if (k !== today) { if (have > 0 && run > 0) { have--; out.frozen.push(k); } else run = 0; }
      k = nextKey(k);
    }
    out.have = have; out.run = run; return (frzCache = out);
  }
  function streak() { return freezeCalc().run; }
  function freezes() { const f = freezeCalc(); return { have: f.have, max: 2, frozen: f.frozen.slice() }; }
  function best() { const ks = Object.keys(S.days).filter(active).sort(); let b = 0, run = 0, last = null; for (const k of ks) { run = last && prevKey(k) === last ? run + 1 : 1; b = Math.max(b, run); last = k; } return b; }
  function today() { const d = S.days[dayKey()] || { xp: 0, c: {} }; return { xp: d.xp || 0, goal: S.goal, pct: Math.min(100, Math.round((d.xp || 0) / S.goal * 100)), counts: { ...d.c }, done: active(dayKey()) }; }
  function award(kind, xp, n) {
    const k = dayKey(), d = S.days[k] || (S.days[k] = { xp: 0, c: {} });
    const before = level().level, wasActive = active(k), wasGoal = (d.xp || 0) >= S.goal;
    xp = xp == null ? (XP[kind] || 1) : Math.max(0, Math.round(xp));
    d.xp = (d.xp || 0) + xp; d.c[kind] = (d.c[kind] || 0) + (n == null ? 1 : n); S.dirty[k] = 1; save();
    const lv = level().level;
    const msg = lv > before ? 'Level ' + lv + '!' : !wasActive ? 'Streak ' + streak() + (streak() === 1 ? ' day' : ' days') : !wasGoal && d.xp >= S.goal ? 'Daily goal done' : '';
    if (msg || (kind !== 'review' && kind !== 'again')) pop('+' + xp + ' XP', msg);
    try { if (window.Prefs) { if (msg) { Prefs.sound('xp'); Prefs.haptic(); } } } catch (e) {}
    return xp;
  }
  function setGoal(g) { S.goal = Math.max(10, Math.min(500, Math.round(g) || 50)); S.dirty.goal = 1; save(); }
  // ---- sync helpers (used by the Cards app) ----
  function takeDirty() { const out = []; for (const k in S.dirty) { if (k === 'goal') out.push({ id: 'hx:goal', t: 'hx', goal: S.goal }); else if (S.days[k]) out.push({ id: 'hx:' + k, t: 'hx', day: k, xp: S.days[k].xp || 0, c: { ...S.days[k].c } }); } S.dirty = {}; save(true); return out; }
  function merge(recs) { // recs from other devices: take the larger value per counter; mark a day dirty when ours is ahead
    let changed = false;
    for (const r of recs) {
      if (!r || r.del) continue;
      if (r.id === 'hx:goal') { if (r.goal && r.goal !== S.goal && !S.dirty.goal) { S.goal = r.goal; changed = true; } continue; }
      if (!r.day) continue;
      const l = S.days[r.day];
      if (!l) { S.days[r.day] = { xp: r.xp || 0, c: { ...(r.c || {}) } }; changed = true; continue; }
      let ahead = (l.xp || 0) > (r.xp || 0);
      if ((r.xp || 0) > (l.xp || 0)) { l.xp = r.xp; changed = true; }
      const keys = new Set([...Object.keys(l.c || {}), ...Object.keys(r.c || {})]); l.c = l.c || {};
      for (const c of keys) { const a = l.c[c] || 0, b = (r.c || {})[c] || 0; if (b > a) { l.c[c] = b; changed = true; } else if (a > b) ahead = true; }
      if (ahead) S.dirty[r.day] = 1;
    }
    if (changed) save(); else save(true);
    return changed;
  }
  function backfill(days) { // one-time: past activity from before the hub existed. days: {key: {kind: count}}
    if (S.bf) return false;
    for (const k in days) { const d = S.days[k] || (S.days[k] = { xp: 0, c: {} }); let add = 0; for (const c in days[k]) { const have = d.c[c] || 0, n = days[k][c]; if (n > have) { add += (n - have) * (XP[c] || 1); d.c[c] = n; } } if (add) { d.xp += add; S.dirty[k] = 1; } }
    S.bf = 1; save(); return true;
  }
  // ---- UI bits ----
  const flame = () => window.Prefs ? Prefs.icon('flame', 14) : '🔥';
  function badgeHTML() { const n = streak(), on = today().done; return `<span class="hub-badge${on ? ' on' : ''}" data-hub-streak title="Streak">${flame()}<b>${n}</b></span>`; }
  function paint() { document.querySelectorAll('[data-hub-streak]').forEach(el => { const n = streak(); const b = el.querySelector('b'); if (b) b.textContent = n; el.classList.toggle('on', today().done); }); document.querySelectorAll('[data-hub-paint]').forEach(el => { try { el.__hubPaint && el.__hubPaint(); } catch (e) {} }); }
  let css = false;
  function ensureCss() { if (css) return; css = true; const s = document.createElement('style'); s.textContent = `.hub-badge{display:inline-flex;align-items:center;gap:3px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.08);color:#9aa4b2;font:600 13px/1 -apple-system,system-ui,sans-serif;white-space:nowrap}.hub-badge.on{color:#ffb347;background:rgba(255,140,0,.16)}.hub-badge b{font-weight:700}
.hub-pop{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 58px);transform:translate(-50%,-8px);z-index:2147483000;pointer-events:none;background:#1d2533;color:#fff;border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 24px rgba(0,0,0,.45);border-radius:999px;padding:8px 14px;font:700 14px/1.2 -apple-system,system-ui,sans-serif;opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap}.hub-pop.show{opacity:1;transform:translate(-50%,0)}.hub-pop i{font-style:normal;color:#ffb347;margin-left:8px}`; document.head.appendChild(s); }
  let popEl, popT;
  function pop(a, b) { if (!document.body) return; ensureCss(); if (!popEl) { popEl = document.createElement('div'); popEl.className = 'hub-pop'; popEl.setAttribute('aria-live', 'polite'); document.body.appendChild(popEl); } popEl.innerHTML = a.replace(/</g, '') + (b ? '<i>' + b.replace(/</g, '') + '</i>' : ''); popEl.classList.add('show'); clearTimeout(popT); popT = setTimeout(() => popEl.classList.remove('show'), b ? 1800 : 1100); }
  if (document.readyState !== 'loading') { ensureCss(); paint(); } else document.addEventListener('DOMContentLoaded', () => { ensureCss(); paint(); });
  window.Hub = { award, freezes, streak, best, level, today, total, setGoal, takeDirty, merge, backfill, dayKey, badgeHTML, paint, onChange: f => subs.add(f), XP, LABEL, _S: () => S };
})();
