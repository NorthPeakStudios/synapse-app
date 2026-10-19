/* Stats2: stats with graphs, weekly recap and achievements for the Cards app.
   window.Stats2 = { render(el, opts), recap(el, opts), recapDue(), achievements(el, opts), check(), count() }
   Reads: Hub (per-day XP/counts), M.progress (lesson / doc / docday / ws / ach records), M.revlog, M.cards, M.decks.
   Writes: progress records t:'ach' (id 'ach:<key>', key, at) through write(); a local mirror in localStorage 'stats2.v1'.
   Pure inline SVG, theme tokens only. No dependencies. */
(function () {
  'use strict';
  if (window.Stats2) return;
  const LS = 'stats2.v1';
  const DAYMS = 864e5;
  const PASS = 80;
  const pad = n => String(n).padStart(2, '0');
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hasM = () => typeof M !== 'undefined' && M && M.progress;
  const liveVals = m => { const o = []; if (m) for (const v of m.values()) if (!v.del) o.push(v); return o; };
  const fmt = n => n >= 1e4 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'k' : n.toLocaleString('en-US');
  const ls = { get() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }, set(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} } };

  /* ---------- days (same 4 AM boundary as Hub) ---------- */
  const dayKey = t => window.Hub ? Hub.dayKey(t) : (d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()))(new Date((t || Date.now()) - 4 * 36e5));
  const keyDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (k, n) => { const x = keyDate(k); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
  const hubDays = () => { try { return (window.Hub && Hub._S().days) || {}; } catch (e) { return {}; } };
  const hubGoal = () => { try { return (window.Hub && Hub._S().goal) || 50; } catch (e) { return 50; } };
  const isActive = d => { if (!d) return false; if ((d.xp || 0) > 0) return true; for (const c in d.c || {}) if (d.c[c] > 0) return true; return false; };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const short = k => { const d = keyDate(k); return MON[d.getMonth()] + ' ' + d.getDate(); };
  const long = k => { const d = keyDate(k); return WD[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate(); };

  /* ---------- icons (monoline, 24 box) ---------- */
  const G = {
    flame: 'M12 3c.6 3.2 5 5.2 5 10.2A5 5 0 0 1 7 13.2c0-2.3 1.1-3.8 2.2-4.8.1 2 1 3.2 2.2 3.4C11 9 10.6 6 12 3z',
    level: 'M7 13.5l5-5 5 5M7 18.5l5-5 5 5M9 5h6',
    bolt: 'M13 3L5.5 13.5h5.5L10 21l8-11h-5.6L13 3z',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    target: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zM12 11.6v.8',
    trophy: 'M8 4h8v5.5a4 4 0 0 1-8 0zM8 6H5.5a2.8 2.8 0 0 0 2.8 3.8M16 6h2.5a2.8 2.8 0 0 1-2.8 3.8M12 13.5V17M8.5 20h7M9.5 17h5',
    cards: 'M6.5 8h10a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 19V9.5A1.5 1.5 0 0 1 6.5 8zM8 4.5h10.5A1.5 1.5 0 0 1 20 6v10',
    book: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5zM5 20.5A2.5 2.5 0 0 0 7.5 21H19M9 7.5h6',
    check: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM8.2 12.3l2.6 2.6 5-5.4',
    flag: 'M6 21V4M6 4.5h11l-2.2 4 2.2 4H6',
    layers: 'M12 3.5l8.5 4.3L12 12 3.5 7.8zM3.5 12l8.5 4.3 8.5-4.3M3.5 16.2l8.5 4.3 8.5-4.3',
    globe: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.8 3.2 2.8 13.8 0 17M12 3.5c-2.8 3.2-2.8 13.8 0 17',
    grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
    steth: 'M6 3.5v4.8a4 4 0 0 0 8 0V3.5M10 12.3v2.2a4.5 4.5 0 0 0 9 0v-2M18.5 9.3a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z',
    aim: 'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21',
    cal: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4M9 14.5h2M13 14.5h2',
    shield: 'M12 3.5l7 2.8v5.2c0 4.6-3 7.5-7 9-4-1.5-7-4.4-7-9V6.3zM9 12l2.2 2.2L15.3 10',
    body: 'M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 9.5h12M12 9.5v5.5M9 21l3-6 3 6',
    pawn: 'M12 3.5a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zM9.8 10.5h4.4l1.3 6.5h-7zM7 20.5h10M8.2 17h7.6',
    sunrise: 'M3.5 17.5h17M6.5 17.5a5.5 5.5 0 0 1 11 0M12 5v3M5.3 9.8l1.6 1.4M18.7 9.8l-1.6 1.4M8.5 21h7',
    books: 'M5 4.5h3.2v15.5H5zM10.4 4.5h3.2v15.5h-3.2zM15.6 5.6l3-.8 3 14.6-3 .8z',
    chev: 'M9 6l6 6-6 6', back: 'M15 6l-6 6 6 6', lock: 'M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3'
  };
  const ic = (n, s, sw) => `<svg class="s2-ic" width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${G[n] || ''}"/></svg>`;

  /* ---------- one pass over everything ---------- */
  let memo = null, memoAt = 0;
  function gather() {
    const now = Date.now();
    if (memo && now - memoAt < 400) return memo;
    const lessons = [], docs = [], docdays = [], ws = [], ach = {};
    if (hasM()) for (const o of M.progress.values()) {
      if (o.del) continue;
      if (o.t === 'lesson') lessons.push(o); else if (o.t === 'doc') docs.push(o); else if (o.t === 'docday') docdays.push(o); else if (o.t === 'ws') ws.push(o); else if (o.t === 'ach' && o.key) ach[o.key] = o.at || o.mod || 1;
    }
    const revs = hasM() ? liveVals(M.revlog) : [];
    const days = hubDays();
    memo = { lessons, docs, docdays, ws, ach, revs, days, goal: hubGoal() }; memoAt = now;
    return memo;
  }

  /* ---------- metrics ---------- */
  function metrics(D) {
    D = D || gather();
    const m = {};
    m.streak = window.Hub ? Hub.streak() : 0; m.best = window.Hub ? Math.max(Hub.best(), m.streak) : 0;
    const L = window.Hub ? Hub.level() : { level: 1, xp: 0 }; m.level = L.level; m.xp = L.xp;
    let bigDay = 0, goalDays = 0, activeDays = 0; const kinds = {};
    for (const k in D.days) { const d = D.days[k]; if (isActive(d)) activeDays++; bigDay = Math.max(bigDay, d.xp || 0); if ((d.xp || 0) >= D.goal) goalDays++; for (const c in d.c || {}) kinds[c] = (kinds[c] || 0) + (d.c[c] || 0); }
    m.bigDay = bigDay; m.goalDays = goalDays; m.activeDays = activeDays; m.kinds = kinds;
    m.reviews = Math.max(D.revs.length, (kinds.review || 0) + (kinds.again || 0));
    let early = 0; for (const r of D.revs) { const h = new Date(r.t).getHours(); if (h >= 4 && h < 7) { early = 1; break; } }
    m.early = early;
    // learn
    const passed = D.lessons.filter(o => o.passed), tested = D.lessons.filter(o => o.at);
    m.lessonsRead = D.lessons.filter(o => o.read || o.at).length; m.passed = passed.length; m.tests = D.lessons.reduce((a, o) => a + (o.tries || (o.at ? 1 : 0)), 0);
    m.perfect = tested.some(o => (o.best || 0) >= 100) ? 1 : 0;
    const lvls = {}, byCourse = {}, topics = new Set(), langs = new Set();
    for (const o of passed) { (lvls[o.lid] = lvls[o.lid] || new Set()).add(o.lvl); const ck = o.cid + '@' + o.lvl; byCourse[ck] = (byCourse[ck] || 0) + 1; if (o.topic) topics.add(o.topic); if (/^(german|french|spanish)$/.test(o.topic)) langs.add(o.topic); }
    m.fiveLevels = Object.values(lvls).reduce((a, s) => Math.max(a, s.size), 0);
    m.topics = topics.size; m.langs = langs.size;
    m.courseDone = 0;
    const man = manifestSync();
    if (man) { const size = {}; for (const t of man.topics || []) for (const c of t.courses || []) size[c.id] = (c.lessons || []).length; for (const ck in byCourse) { const cid = ck.split('@')[0]; if (size[cid] && byCourse[ck] >= size[cid]) m.courseDone++; } }
    // doctordle
    m.docWins = D.docs.reduce((a, o) => a + (o.wins || 0), 0); m.docPlays = D.docs.reduce((a, o) => a + (o.plays || 0), 0);
    m.docCases = D.docs.filter(o => o.wins).length;
    m.docSharp = D.docs.some(o => o.best && o.best <= 2) ? 1 : 0;
    m.docDaily = D.docdays.filter(o => o.win).length;
    m.wsCleared = D.ws.filter(o => o.done).length;
    m.anat = kinds.anat || 0; m.chess = kinds.chess || 0; m.lib = kinds.lib || 0;
    // weekend: Sat + following Sun both active
    m.weekend = 0; for (const k in D.days) { if (keyDate(k).getDay() === 6 && isActive(D.days[k]) && isActive(D.days[addDays(k, 1)])) { m.weekend = 1; break; } }
    return m;
  }

  /* learn manifest (shared SW cache); loaded once, used for "course complete" + topic names */
  let MAN = null, manP = null;
  function manifestSync() { if (!MAN && !manP) manP = fetch('learn/manifest.json').then(r => r.ok ? r.json() : null).then(j => { MAN = j; return j; }).catch(() => null); return MAN; }
  const manifest = () => { manifestSync(); return MAN ? Promise.resolve(MAN) : manP; };

  /* ---------- achievements ---------- */
  // [key, group, glyph, name, how, metric, goal, tier-label]
  const DEFS = [
    ['streak3', 'Streaks', 'flame', 'Warming up', 'Keep a 3-day streak.', 'best', 3, '3'],
    ['streak7', 'Streaks', 'flame', 'One week', 'Keep a 7-day streak.', 'best', 7, '7'],
    ['streak30', 'Streaks', 'flame', 'Habit formed', 'Keep a 30-day streak.', 'best', 30, '30'],
    ['streak100', 'Streaks', 'flame', 'Unbreakable', 'Keep a 100-day streak.', 'best', 100, '100'],
    ['weekend', 'Streaks', 'cal', 'Weekend shift', 'Study on a Saturday and the Sunday after it.', 'weekend', 1],
    ['early', 'Streaks', 'sunrise', 'Early rounds', 'Review a card before 7 AM.', 'early', 1],
    ['lv5', 'Levels & XP', 'level', 'Level 5', 'Reach level 5.', 'level', 5, '5'],
    ['lv10', 'Levels & XP', 'level', 'Level 10', 'Reach level 10.', 'level', 10, '10'],
    ['lv25', 'Levels & XP', 'level', 'Level 25', 'Reach level 25.', 'level', 25, '25'],
    ['xp1k', 'Levels & XP', 'star', '1,000 XP', 'Earn 1,000 XP in total.', 'xp', 1000, '1K'],
    ['xp10k', 'Levels & XP', 'star', '10,000 XP', 'Earn 10,000 XP in total.', 'xp', 10000, '10K'],
    ['goal1', 'Levels & XP', 'target', 'On target', 'Hit your daily goal.', 'goalDays', 1],
    ['goal7', 'Levels & XP', 'target', 'Seven for seven', 'Hit your daily goal on 7 days.', 'goalDays', 7, '7'],
    ['bigday', 'Levels & XP', 'bolt', 'Big day', 'Earn 200 XP in one day.', 'bigDay', 200, '200'],
    ['rev100', 'Flashcards', 'cards', 'Hundred cards', 'Review 100 flashcards.', 'reviews', 100, '100'],
    ['rev1k', 'Flashcards', 'cards', 'Thousand cards', 'Review 1,000 flashcards.', 'reviews', 1000, '1K'],
    ['rev5k', 'Flashcards', 'cards', 'Card shark', 'Review 5,000 flashcards.', 'reviews', 5000, '5K'],
    ['lesson1', 'Learn', 'book', 'First lesson', 'Open and read a Learn lesson.', 'lessonsRead', 1],
    ['pass10', 'Learn', 'book', 'Ten passed', 'Pass 10 lesson tests.', 'passed', 10, '10'],
    ['pass50', 'Learn', 'book', 'Fifty passed', 'Pass 50 lesson tests.', 'passed', 50, '50'],
    ['perfect', 'Learn', 'check', 'Perfect score', 'Score 100% on a lesson test.', 'perfect', 1],
    ['course', 'Learn', 'flag', 'Course complete', 'Pass every lesson test in one course at one level.', 'courseDone', 1],
    ['fivelv', 'Learn', 'layers', 'All the way down', 'Pass one lesson at all 5 levels, kid to expert.', 'fiveLevels', 5, '5'],
    ['alltopics', 'Learn', 'grid', 'Well rounded', 'Pass a test in all 4 Learn topics.', 'topics', 4, '4'],
    ['doc1', 'Doctordle', 'steth', 'First diagnosis', 'Solve a Doctordle case.', 'docWins', 1],
    ['doc10', 'Doctordle', 'steth', 'Ten diagnoses', 'Solve 10 Doctordle cases.', 'docWins', 10, '10'],
    ['doc50', 'Doctordle', 'steth', 'Attending', 'Solve 50 Doctordle cases.', 'docWins', 50, '50'],
    ['docsharp', 'Doctordle', 'aim', 'Sharp eye', 'Solve a case in 1 or 2 guesses.', 'docSharp', 1],
    ['docdaily7', 'Doctordle', 'cal', 'Daily rounds', 'Solve 7 daily cases.', 'docDaily', 7, '7'],
    ['ws7', 'More', 'shield', 'Patched up', 'Clear 7 weak spots.', 'wsCleared', 7, '7'],
    ['ws50', 'More', 'shield', 'No weak spots', 'Clear 50 weak spots.', 'wsCleared', 50, '50'],
    ['anat1', 'More', 'body', 'Explorer', 'Explore a structure in Anatomy.', 'anat', 1],
    ['anat50', 'More', 'body', 'Cartographer', 'Explore 50 structures in Anatomy.', 'anat', 50, '50'],
    ['lib1', 'More', 'books', 'Librarian', 'Add a deck from the Library.', 'lib', 1]
  ].map(a => ({ key: a[0], group: a[1], glyph: a[2], name: a[3], how: a[4], metric: a[5], goal: a[6], tier: a[7] || '' }));
  const DEF = Object.fromEntries(DEFS.map(d => [d.key, d]));

  function unlockedMap(D) { const loc = ls.get().ach || {}; const out = { ...loc }; for (const k in (D || gather()).ach) out[k] = out[k] || D.ach[k]; return out; }
  let checking = false;
  function check() {
    if (checking) return [];
    checking = true;
    try {
      const D = gather(), m = metrics(D), have = unlockedMap(D), st = ls.get(), first = !st.init;
      const now = Date.now(), fresh = [], recs = [];
      st.ach = st.ach || {}; st.seen = st.seen || {};
      for (const d of DEFS) {
        if (have[d.key]) { if (!st.ach[d.key]) st.ach[d.key] = have[d.key]; continue; }
        if ((m[d.metric] || 0) >= d.goal) { st.ach[d.key] = now; fresh.push({ key: d.key, name: d.name, how: d.how }); recs.push(['progress', { id: 'ach:' + d.key, t: 'ach', key: d.key, at: now, del: 0 }]); }
      }
      // tell the server about badges this device unlocked before another device synced them in
      for (const k in st.ach) if (!D.ach[k] && DEF[k] && !recs.some(r => r[1].key === k) && hasM()) recs.push(['progress', { id: 'ach:' + k, t: 'ach', key: k, at: st.ach[k], del: 0 }]);
      if (first) { for (const f of fresh) st.seen[f.key] = 1; st.init = now; }
      ls.set(st);
      if (recs.length && typeof write === 'function' && hasM()) { try { const p = write(recs); if (p && p.catch) p.catch(() => {}); } catch (e) {} memo = null; }
      fresh.initial = first; // first run on this device: everything already earned unlocks at once — show one summary toast, not one each
      return fresh;
    } finally { checking = false; }
  }
  function count() { const u = unlockedMap(gather()); let n = 0; for (const d of DEFS) if (u[d.key]) n++; return { unlocked: n, total: DEFS.length }; }

  function badgeSVG(d, on, size) {
    const s = size || 64, tier = d.tier;
    return `<svg class="s2-badge${on ? ' on' : ''}" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" class="bg"/><circle cx="32" cy="32" r="30" class="ring" fill="none" stroke-width="1.5"/>
      ${on ? '<circle cx="32" cy="32" r="25.5" class="ring2" fill="none" stroke-width="1"/>' : ''}
      <g transform="translate(${tier ? '17 10.5' : '17 17'}) scale(1.25)" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="${G[d.glyph]}"/></g>
      ${tier ? `<text x="32" y="52" text-anchor="middle" class="tier">${tier}</text>` : ''}
    </svg>`;
  }

  function achievements(el, opts) {
    opts = opts || {};
    check();
    const D = gather(), m = metrics(D), u = unlockedMap(D), st = ls.get(); st.seen = st.seen || {};
    const groups = []; for (const d of DEFS) { let g = groups.find(x => x.name === d.group); if (!g) groups.push(g = { name: d.group, items: [] }); g.items.push(d); }
    const n = DEFS.filter(d => u[d.key]).length;
    el.innerHTML = `<div class="s2">
      ${backRow(opts)}
      <div class="s2-hero"><div class="s2-hero-n">${n}<span> of ${DEFS.length}</span></div><div class="s2-hero-l">badges earned</div>
        <div class="s2-meter" role="progressbar" aria-valuenow="${n}" aria-valuemax="${DEFS.length}"><i style="width:${Math.round(n / DEFS.length * 100)}%"></i></div></div>
      ${groups.map(g => `<h3 class="s2-h">${E(g.name)}</h3><div class="s2-badges">${g.items.map(d => { const on = !!u[d.key], nw = on && !st.seen[d.key]; return `<button class="s2-bd${on ? ' on' : ''}" data-ach="${d.key}" aria-label="${E(d.name)}${on ? ', earned' : ', locked'}">${badgeSVG(d, on)}${nw ? '<span class="s2-new" aria-hidden="true"></span>' : ''}<span class="s2-bn">${E(d.name)}</span></button>`; }).join('')}</div>`).join('')}
    </div>`;
    el.querySelectorAll('[data-ach]').forEach(b => b.onclick = () => {
      const d = DEF[b.dataset.ach], on = !!u[d.key], cur = Math.min(m[d.metric] || 0, d.goal);
      const s = ls.get(); s.seen = s.seen || {}; if (on && !s.seen[d.key]) { s.seen[d.key] = 1; ls.set(s); const dot = b.querySelector('.s2-new'); if (dot) dot.remove(); }
      const when = on && typeof u[d.key] === 'number' && u[d.key] > 1 ? new Date(u[d.key]).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
      sheet(`<div class="s2 s2-sheet">${badgeSVG(d, on, 112)}<h2>${E(d.name)}</h2><p class="s2-how">${E(d.how)}</p>
        ${on ? `<p class="s2-when">${when ? 'Earned ' + E(when) : 'Earned'}</p>` : d.goal > 1 ? `<div class="s2-prog"><div class="s2-meter"><i style="width:${Math.round(cur / d.goal * 100)}%"></i></div><span>${fmt(cur)} / ${fmt(d.goal)}</span></div>` : '<p class="s2-when">Not earned yet</p>'}
        <button class="s2-done" type="button" data-s2-close>Done</button></div>`);
    });
  }

  /* ---------- sheet (uses the app's bottom sheet when present) ---------- */
  function sheet(html) {
    if (typeof openSheet === 'function' && document.getElementById('sheet')) { openSheet(html); const c = document.querySelector('#sheet [data-s2-close]'); if (c) c.onclick = () => closeSheet(); return; }
    let w = document.getElementById('s2Sheet');
    if (!w) { w = document.createElement('div'); w.id = 's2Sheet'; w.className = 's2-sheetwrap'; document.body.appendChild(w); w.addEventListener('click', e => { if (e.target === w) w.hidden = true; }); }
    w.innerHTML = `<div class="s2-sheetbox" role="dialog" aria-modal="true">${html}</div>`; w.hidden = false;
    const c = w.querySelector('[data-s2-close]'); if (c) c.onclick = () => { w.hidden = true; };
  }
  const backRow = opts => opts.back === false ? '' : `<button class="s2-back" type="button" data-s2-back>${ic('back', 18, 2.2)}<span>${E(opts.backLabel || 'Stats')}</span></button>`;

  /* ---------- charts ---------- */
  // XP per day, last N days. Bars are tappable / scrubbable; the caption shows the selected day.
  function xpChart(keys, days, goal) {
    const vals = keys.map(k => (days[k] && days[k].xp) || 0), mx = Math.max(goal, ...vals, 10);
    const W = 300, H = 128, top = 8, bh = H - top - 18, n = keys.length, slot = W / n, bw = Math.max(3, slot - 3);
    const gy = top + bh - goal / mx * bh;
    let bars = '';
    vals.forEach((v, i) => { const h = v ? Math.max(2, v / mx * bh) : 0, x = i * slot + (slot - bw) / 2; bars += `<rect class="s2-bar${v >= goal ? ' hit' : ''}" data-i="${i}" x="${x.toFixed(1)}" y="${(top + bh - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(2.5, bw / 2).toFixed(1)}"/>`; if (!v) bars += `<rect class="s2-bar0" x="${x.toFixed(1)}" y="${(top + bh - 2).toFixed(1)}" width="${bw.toFixed(1)}" height="2" rx="1"/>`; });
    const labs = [0, Math.floor(n / 2), n - 1].map(i => `<text x="${(i * slot + slot / 2).toFixed(1)}" y="${H - 3}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" class="s2-ax">${i === n - 1 ? 'Today' : short(keys[i])}</text>`).join('');
    return `<svg class="s2-chart" data-chart="xp" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="XP per day, last ${n} days">
      <line x1="0" x2="${W}" y1="${gy.toFixed(1)}" y2="${gy.toFixed(1)}" class="s2-goal"/>
      ${bars}<rect class="s2-sel" x="0" y="${top}" width="${slot.toFixed(1)}" height="${bh}" rx="3" visibility="hidden"/>${labs}</svg>`;
  }
  function wireXP(el, keys, days) {
    const svg = el.querySelector('[data-chart=xp]'), cap = el.querySelector('[data-cap=xp]'); if (!svg || !cap) return;
    const def = cap.innerHTML, n = keys.length, sel = svg.querySelector('.s2-sel');
    const pick = e => { const r = svg.getBoundingClientRect(); const i = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))); const k = keys[i], d = days[k] || {}; cap.innerHTML = `<b>${fmt(d.xp || 0)} XP</b> · ${long(k)}${describe(d)}`; sel.setAttribute('x', (i * 300 / n).toFixed(1)); sel.setAttribute('visibility', 'visible'); svg.querySelectorAll('.s2-bar.on').forEach(b => b.classList.remove('on')); const b = svg.querySelector(`.s2-bar[data-i="${i}"]`); if (b) b.classList.add('on'); };
    let down = false;
    svg.addEventListener('pointerdown', e => { down = true; try { svg.setPointerCapture(e.pointerId); } catch (x) {} pick(e); });
    svg.addEventListener('pointermove', e => { if (down) { e.preventDefault(); pick(e); } });
    const up = () => { down = false; };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    el.addEventListener('click', e => { if (!svg.contains(e.target) && sel.getAttribute('visibility') === 'visible') { sel.setAttribute('visibility', 'hidden'); svg.querySelectorAll('.s2-bar.on').forEach(b => b.classList.remove('on')); cap.innerHTML = def; } });
  }
  const KL1 = { lesson: 'lesson', test: 'test', doc: 'solve', weak: 'weak spot', anat: 'anatomy', chess: 'chess' };
  const KL = { review: 'reviews', again: 'missed', lesson: 'lessons', test: 'tests', doc: 'solves', docfail: 'doctordle tries', weak: 'weak spots', anat: 'anatomy', chess: 'chess', lib: 'library', photo: 'photos' };
  function describe(d) { const c = d.c || {}, parts = []; const rv = (c.review || 0) + (c.again || 0); if (rv) parts.push(rv + ' card' + (rv === 1 ? '' : 's')); for (const k of ['lesson', 'test', 'doc', 'weak', 'anat', 'chess']) if (c[k]) parts.push(c[k] + ' ' + (c[k] === 1 ? KL1[k] : KL[k])); return parts.length ? `<br><span>${parts.slice(0, 4).join(' · ')}</span>` : ''; }

  // GitHub-style heatmap: weeks × 7 (Mon top). Level by share of the daily goal.
  function heatmap(days, goal, weeks) {
    const today = dayKey(), td = keyDate(today), dow = (td.getDay() + 6) % 7; // 0 = Monday
    const start = addDays(today, -dow - (weeks - 1) * 7);
    const cs = 13, gap = 3, left = 16, topm = 14, W = left + weeks * (cs + gap) - gap, H = topm + 7 * (cs + gap) - gap;
    let cells = '', months = '', lastM = -1;
    for (let w = 0; w < weeks; w++) {
      const wk = addDays(start, w * 7), md = keyDate(wk).getMonth();
      if (md !== lastM) { if (w < weeks - 2 || lastM === -1) months += `<text x="${left + w * (cs + gap)}" y="9" class="s2-ax">${MON[md]}</text>`; lastM = md; }
      for (let r = 0; r < 7; r++) {
        const k = addDays(wk, r); if (k > today) continue;
        const d = days[k], xp = (d && d.xp) || 0, lv = !isActive(d) ? 0 : xp >= goal ? 4 : xp >= goal * .6 ? 3 : xp >= goal * .3 ? 2 : 1;
        cells += `<rect class="s2-hm l${lv}${k === today ? ' td' : ''}" data-k="${k}" x="${left + w * (cs + gap)}" y="${topm + r * (cs + gap)}" width="${cs}" height="${cs}" rx="3"/>`;
      }
    }
    const dl = ['M', '', 'W', '', 'F', '', ''].map((t, r) => t ? `<text x="0" y="${topm + r * (cs + gap) + 10}" class="s2-ax">${t}</text>` : '').join('');
    return `<svg class="s2-chart s2-heat" data-chart="hm" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Activity, last ${weeks} weeks">${months}${dl}${cells}</svg>`;
  }
  function wireHM(el, days) {
    const svg = el.querySelector('[data-chart=hm]'), cap = el.querySelector('[data-cap=hm]'); if (!svg || !cap) return;
    const def = cap.innerHTML;
    const pick = e => { const t = document.elementFromPoint(e.clientX, e.clientY); const r = t && t.closest && t.closest('.s2-hm'); if (!r) return; svg.querySelectorAll('.s2-hm.on').forEach(x => x.classList.remove('on')); r.classList.add('on'); const d = days[r.dataset.k] || {}; cap.innerHTML = isActive(d) ? `<b>${fmt(d.xp || 0)} XP</b> · ${long(r.dataset.k)}${describe(d)}` : `<b>No activity</b> · ${long(r.dataset.k)}`; };
    svg.addEventListener('click', pick);
    el.addEventListener('click', e => { if (!svg.contains(e.target) && svg.querySelector('.s2-hm.on')) { svg.querySelectorAll('.s2-hm.on').forEach(x => x.classList.remove('on')); cap.innerHTML = def; } });
  }
  function miniBars(vals, labels, hiIdx, boldIdx) { // 7 small bars for the recap
    const mx = Math.max(1, ...vals), W = 280, H = 96, bh = 66, slot = W / vals.length, bw = 22;
    return `<svg class="s2-chart" viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true">${vals.map((v, i) => { const h = v ? Math.max(3, v / mx * bh) : 2, x = i * slot + (slot - bw) / 2; return `<rect class="${v ? 's2-bar' : 's2-bar0'}${i === hiIdx && v ? ' hit' : ''}" x="${x.toFixed(1)}" y="${(4 + bh - h).toFixed(1)}" width="${bw}" height="${h.toFixed(1)}" rx="5"/><text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="s2-ax${i === (boldIdx == null ? vals.length - 1 : boldIdx) ? ' b' : ''}">${labels[i]}</text>`; }).join('')}</svg>`;
  }

  /* ---------- accuracy ---------- */
  function topicName(key, fallback) { if (MAN) { const t = (MAN.topics || []).find(x => x.key === key); if (t) return t.name; } return fallback || (key ? key[0].toUpperCase() + key.slice(1) : 'Learn'); }
  function accuracy(D, since) {
    const rows = [], by = {};
    for (const o of D.lessons) { if (!o.at || (since && o.at < since)) continue; const b = by[o.topic] || (by[o.topic] = { s: 0, n: 0, name: o.tname }); b.s += (since ? o.last : o.best) || 0; b.n++; }
    for (const k in by) rows.push({ key: k, name: topicName(k, by[k].name), pct: Math.round(by[k].s / by[k].n), n: by[k].n, unit: 'test' });
    const rv = since ? D.revs.filter(r => r.t >= since) : D.revs;
    if (rv.length) rows.push({ key: 'cards', name: 'Flashcards', pct: Math.round(rv.filter(r => r.g > 1).length / rv.length * 100), n: rv.length, unit: 'review' });
    if (!since) { const p = D.docs.reduce((a, o) => a + (o.plays || 0), 0), w = D.docs.reduce((a, o) => a + (o.wins || 0), 0); if (p) rows.push({ key: 'doc', name: 'Doctordle', pct: Math.round(w / p * 100), n: p, unit: 'case' }); }
    return rows.sort((a, b) => b.pct - a.pct);
  }
  const accRows = rows => rows.length ? `<div class="s2-list">${rows.map(r => `<div class="s2-acc"><div class="s2-acc-t"><span>${E(r.name)}</span><b>${r.pct}%</b></div><div class="s2-acc-m"><i style="width:${Math.max(2, r.pct)}%"></i></div><div class="s2-acc-s">${fmt(r.n)} ${r.unit}${r.n === 1 ? '' : 's'}</div></div>`).join('')}</div>` : `<div class="s2-list"><div class="s2-empty">Take a lesson test or review some cards to see your accuracy.</div></div>`;

  /* ---------- the stats screen ---------- */
  function render(el, opts) {
    opts = opts || {};
    el.__s2 = { opts };
    manifestSync();
    const D = gather(), m = metrics(D), goal = D.goal, days = D.days, today = dayKey();
    const keys30 = []; for (let i = 29; i >= 0; i--) keys30.push(addDays(today, -i));
    const x30 = keys30.reduce((a, k) => a + ((days[k] && days[k].xp) || 0), 0), act30 = keys30.filter(k => isActive(days[k])).length;
    const cnt = count();
    // time of day
    const tod = [0, 0, 0, 0]; const bucket = t => { const h = new Date(t).getHours(); return h >= 5 && h < 12 ? 0 : h >= 12 && h < 17 ? 1 : h >= 17 && h < 22 ? 2 : 3; };
    for (const r of D.revs) tod[bucket(r.t)]++; for (const o of D.lessons) { if (o.read) tod[bucket(o.read)]++; if (o.at) tod[bucket(o.at)]++; }
    const todN = tod.reduce((a, b) => a + b, 0), TOD = ['Morning', 'Afternoon', 'Evening', 'Night'], TOD_W = ['in the morning', 'in the afternoon', 'in the evening', 'at night'];
    // cards
    const cardSec = cardsSection(D);
    const due = recapDue();
    el.innerHTML = `<div class="s2">
      <div class="s2-sum">
        <div><b>${m.streak}</b><span>day streak</span></div>
        <div><b>${m.level}</b><span>level</span></div>
        <div><b>${fmt(m.xp)}</b><span>total XP</span></div>
      </div>
      <div class="s2-list s2-nav">
        <button type="button" class="s2-row" data-s2-open="recap">${ic('cal', 22)}<span class="s2-rt">Weekly recap${due ? '<i class="s2-dot" aria-label="new"></i>' : ''}</span><span class="s2-rv">${E(weekRange())}</span>${ic('chev', 16, 2.2)}</button>
        <button type="button" class="s2-row" data-s2-open="ach">${ic('trophy', 22)}<span class="s2-rt">Achievements</span><span class="s2-rv">${cnt.unlocked} of ${cnt.total}</span>${ic('chev', 16, 2.2)}</button>
      </div>
      <h3 class="s2-h">XP per day</h3>
      <div class="s2-card"><div class="s2-cap" data-cap="xp"><b>${fmt(x30)} XP</b> · last 30 days<br><span>${Math.round(x30 / 30)} a day on average · goal line at ${goal}</span></div>${xpChart(keys30, days, goal)}</div>
      <h3 class="s2-h">Activity</h3>
      <div class="s2-card"><div class="s2-cap" data-cap="hm"><b>${m.activeDays} day${m.activeDays === 1 ? '' : 's'}</b> active · longest streak ${m.best}<br><span>Tap a day for details</span></div>${heatmap(days, goal, 20)}
        <div class="s2-legend"><span>Less</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>Goal</span></div></div>
      <h3 class="s2-h">Accuracy</h3>
      <div data-s2-acc>${accRows(accuracy(D))}</div>
      ${cardSec}
      <h3 class="s2-h">Totals</h3>
      <div class="s2-list">
        ${row('cards', 'Cards reviewed', fmt(m.reviews))}
        ${row('book', 'Lessons read', fmt(m.lessonsRead))}
        ${row('check', 'Tests passed', fmt(m.passed) + '<span class="s2-of"> of ' + fmt(m.tests) + ' taken</span>')}
        ${row('steth', 'Doctordles solved', fmt(m.docWins) + (m.docPlays ? '<span class="s2-of"> of ' + fmt(m.docPlays) + '</span>' : ''))}
        ${row('shield', 'Weak spots cleared', fmt(m.wsCleared))}
        ${row('target', 'Daily goal hit', fmt(m.goalDays) + ' day' + (m.goalDays === 1 ? '' : 's'))}
        ${row('bolt', 'Best day', fmt(m.bigDay) + ' XP')}
      </div>
      ${todN ? `<h3 class="s2-h">When you study</h3><div class="s2-card"><div class="s2-cap"><b>Mostly ${TOD_W[tod.indexOf(Math.max(...tod))]}</b><br><span>From ${fmt(todN)} reviews, lessons and tests</span></div><div class="s2-tod">${tod.map((v, i) => `<div><b>${Math.round(v / todN * 100)}%</b><i style="height:${Math.max(3, Math.round(v / Math.max(...tod) * 56))}px"${v === Math.max(...tod) ? ' class="hi"' : ''}></i><span>${TOD[i]}</span></div>`).join('')}</div></div>` : ''}
    </div>`;
    wireXP(el, keys30, days); wireHM(el, days);
    el.querySelectorAll('[data-s2-open]').forEach(b => b.onclick = () => {
      const w = b.dataset.s2Open;
      if (w === 'recap') { if (opts.onRecap) opts.onRecap(); else { recap(el, { onBack: () => render(el, opts) }); scrollTop(el); } }
      else { if (opts.onAchievements) opts.onAchievements(); else { achievementsWrapped(el, { onBack: () => render(el, opts) }); scrollTop(el); } }
    });
    if (!MAN && manP) manP.then(j => { if (j && el.__s2 && el.isConnected && el.querySelector('[data-s2-acc]')) { memo = null; el.querySelector('[data-s2-acc]').innerHTML = accRows(accuracy(gather())); } });
  }
  const scrollTop = () => { try { window.scrollTo(0, 0); } catch (e) {} };
  const row = (g, t, v) => `<div class="s2-row">${ic(g, 22)}<span class="s2-rt">${t}</span><span class="s2-rv">${v}</span></div>`;

  function cardsSection(D) {
    if (!hasM() || typeof dayStart !== 'function') return '';
    const now = Date.now(), ds0 = dayStart(now);
    const cards = liveVals(M.cards).filter(c => { const d = M.decks.get(c.deck); return d && !d.del; });
    if (!cards.length) return '';
    const todayR = D.revs.filter(r => r.t >= ds0), acc = todayR.length ? Math.round(todayR.filter(r => r.g > 1).length / todayR.length * 100) : null;
    const mature = D.revs.filter(r => r.ps === 2 && r.t >= now - 30 * DAYMS), ret = mature.length ? Math.round(mature.filter(r => r.g > 1).length / mature.length * 100) : null;
    const fc = Array(7).fill(0); for (const c of cards) { if (c.st === 0) continue; const k = Math.max(0, Math.floor((dayStart(c.due) - ds0) / DAYMS + .5)); if (k < 7) fc[k]++; }
    const cn = [['New', cards.filter(c => c.st === 0).length, 'new'], ['Learning', cards.filter(c => c.st === 1 || c.st === 3).length, 'lrn'], ['Young', cards.filter(c => c.st === 2 && (c.ivl || 0) < 21).length, 'due'], ['Mature', cards.filter(c => c.st === 2 && (c.ivl || 0) >= 21).length, 'mat']];
    const tot = cards.length;
    const lab = i => i === 0 ? 'Today' : WD[new Date(ds0 + i * DAYMS + 12 * 36e5).getDay()].slice(0, 2);
    return `<h3 class="s2-h">Flashcards</h3>
      <div class="s2-card">
        <div class="s2-pair"><div><b>${todayR.length}</b><span>reviews today${acc != null ? ' · ' + acc + '%' : ''}</span></div><div><b>${ret == null ? '–' : ret + '%'}</b><span>retention, 30 days</span></div></div>
        <div class="s2-sub">Due in the next 7 days${fc.some(v => v) ? '' : ': nothing yet'}</div>${fc.some(v => v) ? miniBars(fc, fc.map((_, i) => lab(i)), -1, 0) : ''}
        <div class="s2-stack" aria-label="Card states">${cn.map(c => c[1] ? `<i class="${c[2]}" style="flex:${c[1]}"></i>` : '').join('')}</div>
        <div class="s2-keys">${cn.map(c => `<span><i class="${c[2]}"></i>${c[0]} <b>${fmt(c[1])}</b></span>`).join('')}</div>
        <div class="s2-sub s2-r">${fmt(tot)} cards</div>
      </div>`;
  }

  /* ---------- weekly recap ---------- */
  function weekKeys(offset) { const t = dayKey(), out = []; for (let i = 6; i >= 0; i--) out.push(addDays(t, -i - offset * 7)); return out; }
  function weekRange() { const k = weekKeys(0); return short(k[0]) + ' – ' + short(k[6]).replace(MON[keyDate(k[0]).getMonth()] + ' ', ''); }
  function weekStats(keys, D) {
    const s = { xp: 0, active: 0, best: null, bestXP: 0, cards: 0, right: 0, lessons: 0, tests: 0, testSum: 0, docs: 0, topics: {} };
    const a = keyDate(keys[0]), from = (typeof dayStart === 'function' ? dayStart(a.getTime()) : a.getTime() - 8 * 36e5), to = from + 7 * DAYMS;
    for (const k of keys) { const d = D.days[k]; if (!d) continue; s.xp += d.xp || 0; if (isActive(d)) s.active++; if ((d.xp || 0) > s.bestXP) { s.bestXP = d.xp; s.best = k; } s.docs += (d.c && d.c.doc) || 0; }
    for (const r of D.revs) if (r.t >= from && r.t < to) { s.cards++; if (r.g > 1) s.right++; }
    for (const o of D.lessons) {
      const tk = o.topic || 'learn';
      if (o.read >= from && o.read < to) { s.topics[tk] = (s.topics[tk] || 0) + 1; }
      if (o.at >= from && o.at < to) { s.tests++; s.testSum += o.last || 0; if ((o.last || 0) >= PASS) s.lessons++; s.topics[tk] = (s.topics[tk] || 0) + 2; }
    }
    s.acc = s.cards ? Math.round(s.right / s.cards * 100) : null; s.testAvg = s.tests ? Math.round(s.testSum / s.tests) : null;
    return s;
  }
  function delta(a, b, unit) { if (b == null || a == null) return ''; const d = a - b; if (!d) return `<span class="s2-d">same as last week</span>`; return `<span class="s2-d ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${unit || ''} vs last week</span>`; }
  function recap(el, opts) {
    opts = opts || {};
    manifestSync();
    const st = ls.get(); st.recap = weekId(); ls.set(st);
    const D = gather(), k0 = weekKeys(0), k1 = weekKeys(1), a = weekStats(k0, D), b = weekStats(k1, D), streak = window.Hub ? Hub.streak() : 0;
    const vals = k0.map(k => (D.days[k] && D.days[k].xp) || 0), bi = a.best ? k0.indexOf(a.best) : -1;
    const top = Object.entries(a.topics).sort((x, y) => y[1] - x[1])[0];
    // focus: the weakest topic by test average (needs 2+ tests), else the most-missed weak-spot source
    const all = accuracy(D).filter(r => r.key !== 'doc' && r.key !== 'cards' && r.n >= 2), weak = all.length ? all[all.length - 1] : null;
    const pct = b.xp ? Math.round((a.xp - b.xp) / b.xp * 100) : null;
    const headline = !a.active ? 'A quiet week. One review gets the streak going again.' : a.xp && b.xp ? `You earned ${fmt(a.xp)} XP, ${pct > 0 ? 'up ' + pct + '%' : pct < 0 ? 'down ' + Math.abs(pct) + '%' : 'the same as'}${pct ? ' from' : ''} last week.` : `You earned ${fmt(a.xp)} XP this week.`;
    const tile = (label, val, sub) => `<div class="s2-tile"><span class="s2-tl">${label}</span><b>${val}</b>${sub || ''}</div>`;
    el.innerHTML = `<div class="s2 s2-recap">
      ${opts.onBack || opts.back !== false ? backRow(opts) : ''}
      <div class="s2-rh"><span>Weekly recap</span><h2>${E(weekRange())}</h2><p>${E(headline)}</p></div>
      <div class="s2-card">${miniBars(vals, k0.map(k => WD[keyDate(k).getDay()][0]), bi)}</div>
      <div class="s2-tiles">
        ${tile('XP', fmt(a.xp), delta(a.xp, b.xp))}
        ${tile('Days active', a.active + '<small>/7</small>', delta(a.active, b.active))}
        ${tile('Streak', streak + '<small> day' + (streak === 1 ? '' : 's') + '</small>', '')}
        ${tile('Best day', a.best ? WDL[keyDate(a.best).getDay()].slice(0, 3) : '–', a.best ? `<span class="s2-d">${fmt(a.bestXP)} XP</span>` : '')}
        ${tile('Lessons passed', fmt(a.lessons), delta(a.lessons, b.lessons))}
        ${tile('Card accuracy', a.acc == null ? '–' : a.acc + '%', a.acc != null && b.acc != null ? delta(a.acc, b.acc, ' pts') : a.cards ? `<span class="s2-d">${fmt(a.cards)} reviews</span>` : '')}
      </div>
      <div class="s2-list">
        <div class="s2-row">${ic('star', 22)}<span class="s2-rt">Top topic</span><span class="s2-rv">${top ? E(topicName(top[0])) : '–'}</span></div>
        ${a.testAvg != null ? `<div class="s2-row">${ic('check', 22)}<span class="s2-rt">Test average</span><span class="s2-rv">${a.testAvg}%<span class="s2-of"> · ${a.tests} test${a.tests === 1 ? '' : 's'}</span></span></div>` : ''}
        ${a.docs ? `<div class="s2-row">${ic('steth', 22)}<span class="s2-rt">Doctordles solved</span><span class="s2-rv">${a.docs}</span></div>` : ''}
        <div class="s2-row">${ic('aim', 22)}<span class="s2-rt">Focus next</span><span class="s2-rv">${weak ? E(weak.name) + '<span class="s2-of"> · ' + weak.pct + '%</span>' : '–'}</span></div>
      </div>
      ${weak ? `<p class="s2-foot">${E(weak.name)} is your lowest test average. A few lessons there this week will move it fastest.</p>` : ''}
    </div>`;
    const bk = el.querySelector('[data-s2-back]'); if (bk) bk.onclick = () => opts.onBack ? opts.onBack() : render(el, el.__s2 ? el.__s2.opts : {});
  }
  // week id = the Sunday that starts the recap window (Sun/Mon both map to the same Sunday)
  function weekId() { const t = dayKey(), d = keyDate(t).getDay(); return addDays(t, d === 1 ? -1 : -d); }
  function recapDue() {
    const t = dayKey(), d = keyDate(t).getDay(); { const rd = window.Settings && Settings.get('notify.recapDay') === 'mon' ? 1 : 0; if (d !== rd && d !== (rd + 1) % 7) return false; }
    if (ls.get().recap === weekId()) return false;
    const D = gather(); return weekKeys(0).some(k => isActive(D.days[k])) || weekKeys(1).some(k => isActive(D.days[k]));
  }

  // achievements back button
  const _ach = achievements;
  function achievementsWrapped(el, opts) { opts = opts || {}; _ach(el, opts); const bk = el.querySelector('[data-s2-back]'); if (bk) bk.onclick = () => opts.onBack ? opts.onBack() : render(el, el.__s2 ? el.__s2.opts : {}); }

  window.Stats2 = { render, recap, recapDue, achievements: achievementsWrapped, check, count, defs: DEFS, _metrics: () => metrics(gather()), _reset: () => { memo = null; } };
  // keep the toast cheap: invalidate the memo whenever Hub changes
  if (window.Hub) Hub.onChange(() => { memo = null; });
})();
