/* Chess puzzle progress → D1 sync (v56). /chess/ writes its puzzle summary to localStorage 'chess.sync.v1'; this mirrors it into a
   progress record {id:'chess-pz', t:'chesspz', s:<summary>, cmod} that rides the normal sync code, and writes newer copies from other
   devices back. Rating/n/w/peak/hist come from the copy with the larger mod; daily.days are unioned. Loaded after app.js. */
(function () {
  'use strict';
  const KEY = 'chess.sync.v1', ID = 'chess-pz';
  const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);
  const readLocal = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && typeof o === 'object' && o.v === 1 ? o : null; } catch (e) { return null; } };
  const dk = off => { const t = new Date(); t.setDate(t.getDate() + off); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  function streakOf(days) {
    const ks = Object.keys(days).filter(k => days[k] > 0).sort(); if (!ks.length) return { streak: 0, best: 0 };
    const nx = k => { const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d + 1, 12); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
    let best = 1, run = 1; for (let i = 1; i < ks.length; i++) { run = nx(ks[i - 1]) === ks[i] ? run + 1 : 1; if (run > best) best = run; }
    return { streak: run, best };
  }
  function merge(a, b) {
    if (!a) return b; if (!b) return a;
    const n = (a.mod || 0) >= (b.mod || 0) ? a : b, o = n === a ? b : a;
    const days = { ...((o.daily || {}).days || {}) }; for (const [k, v] of Object.entries((n.daily || {}).days || {})) days[k] = Math.max(days[k] || 0, v || 0);
    const keep = Object.keys(days).sort().slice(-120), dd = {}; for (const k of keep) dd[k] = days[k];
    const sk = streakOf(dd), nd = n.daily || {};
    const last = keep[keep.length - 1], recent = last && (last === dk(0) || last === dk(-1));
    return { ...n, daily: { ...nd, days: dd, streak: Math.max(nd.streak || 0, recent ? sk.streak : 0), best: Math.max(nd.best || 0, ((o.daily || {}).best) || 0, sk.best) } };
  }
  let busy = false;
  async function run() {
    if (busy || typeof M === 'undefined' || !M.progress || typeof write !== 'function') return; busy = true;
    try {
      const L = readLocal(), rec = M.progress.get(ID), R = rec && !rec.del && rec.s && rec.s.v === 1 ? rec.s : null;
      if (!L && !R) return;
      const m = merge(L, R), cm = canon(m);
      if (!L || canon(L) !== cm) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
      if (!R || canon(R) !== cm) await write([['progress', { ...(rec || {}), id: ID, t: 'chesspz', s: m, cmod: m.mod || 0, del: 0 }]]);
    } catch (e) { console.warn('chess sync', e); } finally { busy = false; }
  }
  let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(run, 400); };
  function init() {
    try { changeHooks.push(soon); } catch (e) {}
    addEventListener('storage', e => { if (e.key === KEY) soon(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') soon(); });
    soon();
  }
  window.ChessSync = { init, run, merge };
})();
