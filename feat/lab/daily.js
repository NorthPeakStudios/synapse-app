/* Daily challenge (#37): one challenge a day built from YOUR cards (same 12 for everyone on this account that day, seeded by the date). 90 seconds, pick the right answer from 4. +10 per right answer, + seconds left as a bonus. Only the first run of the day counts; replays are practice. Personal bests (best score, fastest perfect run, longest daily streak) are synced with your other progress. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  const KEY = 'daily.v1', PID = 'lab:daily', N = 12, SECS = 90;
  let S = null;
  const strip = h => String(h || '').replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  const bad = s => { try { return typeof IMPORT_BAD !== 'undefined' && IMPORT_BAD.test(s); } catch (e) { return false; } };
  const dkey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function rng(seed) { let h = 1779033703 ^ seed.length; for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function sget() { let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} o = o && o.days ? o : { days: {}, best: { score: 0, fast: 0, streak: 0 }, at: 0 }; try { const r = M.progress && M.progress.get(PID); if (r && r.data && (r.data.at || 0) > (o.at || 0)) { o = r.data; localStorage.setItem(KEY, JSON.stringify(o)); } } catch (e) {} return o; }
  function sset(o) { o.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} try { if (typeof write === 'function' && M.progress) write([['progress', { id: PID, t: 'lab', data: o, at: o.at, del: 0 }]]); } catch (e) {} }
  function streak(o) { let s = 0, d = new Date(); if (!o.days[dkey(d)]) d.setDate(d.getDate() - 1); while (o.days[dkey(d)]) { s++; d.setDate(d.getDate() - 1); } return s; }
  function pool() {
    const out = [];
    for (const n of M.notes.values()) {
      if (n.del || !M.decks.get(n.deck) || M.decks.get(n.deck).del) continue;
      let q, a;
      if (n.type === 'cloze') { const m = String(n.front).match(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/); if (!m) continue; a = strip(m[1]); q = strip(String(n.front).replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/, '[ … ]').replace(/\{\{c\d+::([\s\S]*?)(::[\s\S]*?)?\}\}/g, '$1')); }
      else { q = strip(n.front); a = strip(n.back); }
      if (!q || !a || q.length > 220 || a.length > 140 || /<img/i.test(n.front + n.back) && !q) continue;
      if (bad(q + ' ' + a)) continue;
      out.push({ id: n.id, deck: n.deck, q, a });
    }
    return out;
  }
  function build(seedKey) {
    const all = pool(); if (all.length < 4) return null; const r = rng(seedKey);
    const shuffled = all.map(x => [r(), x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const picked = [], seenA = new Set();
    for (const x of shuffled) { if (picked.length >= N) break; if (seenA.has(x.a)) continue; seenA.add(x.a); picked.push(x); }
    return picked.map(x => {
      const same = all.filter(y => y.deck === x.deck && y.a !== x.a), other = all.filter(y => y.a !== x.a);
      const src = same.length >= 3 ? same : other; const opts = new Set([x.a]); let guard = 0;
      // v131: distractors that look like the answer (numbers with numbers, short with short) instead of any random card's answer
      const shape = s => ({ num: /^[\s\d.,%<>≈~×x\-–]+\s*[a-zA-Zµ%°/]{0,6}\s*$/.test(s), len: s.length, words: s.trim().split(/\s+/).length });
      const sx = shape(x.a);
      const score = y => { const sy = shape(y.a); let d = sx.num !== sy.num ? 10 : 0; d += Math.abs(Math.log((sy.len + 4) / (sx.len + 4))) * 4; d += Math.abs(Math.log((sy.words + 1) / (sx.words + 1))) * 2; return d + r() * 0.6; };
      const ranked = src.map(y => [score(y), y]).sort((a, b) => a[0] - b[0]).map(v => v[1]).slice(0, 8);
      while (opts.size < 4 && guard++ < 40) opts.add(ranked[Math.floor(r() * ranked.length)].a);
      while (opts.size < 4 && guard++ < 80) opts.add(src[Math.floor(r() * src.length)].a);
      const o = [...opts].map(v => [r(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
      return { q: x.q, a: x.a, o, deck: (M.decks.get(x.deck) || {}).name || '' };
    });
  }
  function render(el) { S = { el, mode: 'menu' }; if (!el.__dl) { el.__dl = 1; el.addEventListener('click', onClick); } paint(); }
  function paint() {
    if (!S || !S.el.isConnected) return; const o = sget(), today = o.days[dkey()], st = streak(o);
    let h;
    if (S.mode === 'menu') {
      h = L.top('Daily challenge', '', 'tools') + `<p class="muted lb-p">${N} of your own cards, ${SECS} seconds, pick the right answer. A new set every day.</p>`;
      h += `<div class="tiles"><div class="tile"><div class="v">${today ? today.score : '–'}</div><div class="k">Today${today ? ' · ' + today.ok + '/' + today.n : ''}</div></div><div class="tile"><div class="v">${st}<span class="muted" style="font-size:15px"> day${st === 1 ? '' : 's'}</span></div><div class="k">Daily streak 🔥</div></div><div class="tile"><div class="v">${o.best.score || '–'}</div><div class="k">Best score</div></div><div class="tile"><div class="v">${o.best.fast ? o.best.fast + 's' : '–'}</div><div class="k">Fastest perfect run</div></div></div>`;
      const strip14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); const x = o.days[dkey(d)]; return `<div title="${dkey(d)}" style="flex:1;height:26px;border-radius:6px;background:${x ? (x.ok === x.n ? '#30d158' : 'rgba(10,132,255,.7)') : 'rgba(127,127,127,.18)'}"></div>`; }).join('');
      h += `<div class="lb-card"><p class="muted small" style="margin:0 0 6px">Last 14 days</p><div style="display:flex;gap:4px">${strip14}</div><p class="muted small" style="margin:6px 0 0">Longest streak: ${Math.max(o.best.streak || 0, st)} days</p></div>`;
      const can = pool().length >= 4;
      h += `<div class="lb-btns"><button class="btn pri" type="button" data-dl-go ${can ? '' : 'disabled'}>${today ? 'Practice again (doesn\'t count)' : '▶ Start today\'s challenge'}</button></div>${can ? '' : '<p class="muted small">Add a few cards first: the challenge is made from your decks.</p>'}`;
    } else if (S.mode === 'play') {
      const q = S.qs[S.i], left = Math.max(0, SECS - Math.floor((Date.now() - S.t0) / 1000));
      h = `<div class="lb-top"><button class="lb-back" type="button" data-dl-quit><span>✕ Quit</span></button><span class="lb-tr">${S.i + 1}/${S.qs.length} · <b data-dl-t>${left}s</b> · ${S.ok * 10} pts</span></div>`;
      h += `<div class="lb-card"><div class="muted small">${esc(q.deck)}</div><div style="font-size:19px;margin-top:4px">${esc(q.q)}</div></div><div style="display:grid;gap:8px;margin:10px 0">${q.o.map((v, k) => { const p = S.pick; return `<button type="button" class="btn ${p != null ? (v === q.a ? 'pri' : p === k ? 'bad' : '') : ''}" data-dl-o="${k}" ${p != null ? 'disabled' : ''} style="text-align:left;justify-content:flex-start;min-height:48px;white-space:normal">${esc(v)}</button>`; }).join('')}</div>`;
    } else {
      const r = S.res; h = L.top('Daily challenge', '', 'tools') + `<div class="lb-card sim-res"><div class="lz-big">${r.score}</div><div class="sim-verd ${r.ok === r.n ? 'ok' : ''}">${r.ok}/${r.n} right · ${r.secs}s${r.counted ? '' : ' · practice'}</div>${r.pb.length ? `<p style="margin:8px 0 0">🏆 New personal best: ${r.pb.join(', ')}</p>` : ''}</div>`;
      if (S.miss.length) h += `<div class="lb-card"><p style="margin:0 0 6px"><b>Review these</b></p>${S.miss.map(m => `<div style="padding:6px 0;border-bottom:1px solid rgba(127,127,127,.15)"><div>${esc(m.q)}</div><div class="muted small">✓ ${esc(m.a)}</div></div>`).join('')}</div>`;
      h += `<div class="lb-btns"><button class="btn" type="button" data-dl-menu>Done</button></div>`;
    }
    S.el.innerHTML = `<div class="lb dl">${h}</div>`;
  }
  function start() { const k = dkey(); const qs = build(k + (sget().days[k] ? ':' + Date.now() : '')); if (!qs) return; S = Object.assign(S, { mode: 'play', qs, i: 0, ok: 0, pick: null, miss: [], t0: Date.now(), counted: !sget().days[k] }); clearInterval(S.tm); S.tm = setInterval(() => { if (!S || S.mode !== 'play' || !S.el.isConnected) return clearInterval(S && S.tm); const left = SECS - Math.floor((Date.now() - S.t0) / 1000); const t = S.el.querySelector('[data-dl-t]'); if (t) t.textContent = Math.max(0, left) + 's'; if (left <= 0) finish(); }, 250); paint(); window.scrollTo(0, 0); }
  function finish() {
    if (!S || S.mode !== 'play') return; clearInterval(S.tm); const secs = Math.min(SECS, Math.round((Date.now() - S.t0) / 1000)), n = S.qs.length, ok = S.ok;
    for (let j = S.i + (S.pick != null ? 1 : 0); j < n; j++) S.miss.push(S.qs[j]);
    const score = ok * 10 + (ok === n ? Math.max(0, SECS - secs) : Math.max(0, Math.round((SECS - secs) * ok / n)));
    const o = sget(), pb = [];
    if (S.counted) { o.days[dkey()] = { score, ok, n, t: secs }; const st = streak(o); if (score > (o.best.score || 0)) { o.best.score = score; pb.push('score ' + score); } if (ok === n && (!o.best.fast || secs < o.best.fast)) { o.best.fast = secs; pb.push('fastest perfect run ' + secs + 's'); } if (st > (o.best.streak || 0)) { o.best.streak = st; if (st > 1) pb.push(st + '-day streak'); } const ks = Object.keys(o.days).sort(); while (ks.length > 120) delete o.days[ks.shift()]; sset(o); L.result('daily', dkey(), Math.round(100 * ok / n)); L.award('daily', 2 + ok); }
    S.res = { score, ok, n, secs, pb, counted: S.counted }; S.mode = 'done'; L.fx(ok === n); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-dl-go]')) { start(); return; }
    if (t.closest('[data-dl-menu]')) { S.mode = 'menu'; paint(); return; }
    if (t.closest('[data-dl-quit]')) { finish(); return; }
    const b = t.closest('[data-dl-o]'); if (b && S.mode === 'play' && S.pick == null) {
      const k = +b.dataset.dlO, q = S.qs[S.i]; S.pick = k; const ok = q.o[k] === q.a; if (ok) S.ok++; else S.miss.push(q); L.fx(ok); paint();
      setTimeout(() => { if (!S || S.mode !== 'play') return; S.pick = null; S.i++; if (S.i >= S.qs.length) finish(); else paint(); }, ok ? 450 : 1100);
    }
  }
  window.LabMods.daily = { render, _S: () => S, _finish: () => finish() };
})();
