/* Home: today's summary, the daily plan and the apps. Layout, order, hidden tiles and header stats come from Prefs. */
'use strict';
(function () {
  const I = (n, s) => Prefs.icon(n, s);
  const ME_URL = '/me/'; // Me lives inside the app now (same storage as the installed app)
  const WORK_URL = '';
  const TILES = [
    { k: 'cards', tab: 1, name: 'Cards', ic: 'cards', go: () => go('decks'), sub: () => { const n = dueCards(), w = window.Weak ? Weak.dueCount() : 0; return n ? n + ' due' + (w ? ' · ' + w + ' weak' : '') : w ? w + ' weak spots' : 'All caught up'; }, badge: () => dueCards() + (window.Weak ? Weak.dueCount() : 0) },
    { k: 'doc', tab: 1, name: 'Doctordle', ic: 'doc', go: () => go('doc'), sub: () => { const b = window.Doctordle ? Doctordle.badge() : ''; return b ? "Today's case is ready" : 'Free play'; }, badge: () => window.Doctordle ? Doctordle.badge() : '' },
    { k: 'anat', name: 'Anatomy', ic: 'anat', go: () => go('anat'), sub: () => window.Anatomy && Anatomy.sub ? Anatomy.sub() : '3D body', badge: () => window.Anatomy && Anatomy.badge ? Anatomy.badge() : '' },
    { k: 'me', name: 'Me', ic: 'me', href: ME_URL, sub: () => 'Your profile', when: () => false },
    { k: 'rx', name: 'Interactions', ic: 'pill', go: () => XView.open('rx'), sub: () => { try { const r = M.progress.get('rx:best'); return r && r.best && r.best.timed != null ? 'Best ' + r.best.timed + ' in 60s' : 'Drug-interaction game'; } catch (e) { return 'Drug-interaction game'; } } },
    { k: 'lab', tab: 1, name: 'Doctor Lab', ic: 'brain', go: () => XView.open('lab'), sub: () => { const s = window.Lab && Lab.stat('sim'); return s ? s.n + ' cases · avg ' + s.avg + '%' : 'Patient sim · lesions · more'; } },
    { k: 'tools', tab: 1, name: 'Study tools', ic: 'bolt', go: () => XView.open('tools'), sub: () => 'Snap a page · focus timer' },
    { k: 'work', name: 'Files', ic: 'folder', href: WORK_URL, plain: true, ext: true, sub: () => 'Folder', when: () => false }
  ];
  function openLib(mode) {
    if (window.Resources && Resources._S) { Resources._S.mode = mode; try { localStorage.setItem('res.mode', mode); } catch (e) {} }
    go('library');
    if (mode !== 'decks' && window.Hub) Hub.award('lib', 1);
  }
  // single pass over all cards (deckCounts per deck would be decks × cards)
  function dueCards() {
    const now = Date.now(), end = dayStart(now) + DAY, done = todayDone(now), per = {};
    for (const c of M.cards.values()) {
      if (c.del || c.susp) continue; const d = M.decks.get(c.deck); if (!d || d.del) continue;
      const o = per[c.deck] || (per[c.deck] = { n: 0, l: 0, r: 0 });
      if (c.st === 0) o.n++; else if (c.due < end) { if (c.st === 2) o.r++; else o.l++; }
    }
    let t = 0;
    for (const id in per) { const o = per[id], op = deckOpt(id), dd = done[id] || { n: 0, r: 0 }; t += Math.max(0, Math.min(o.n, op.newPerDay - dd.n)) + o.l + Math.max(0, Math.min(o.r, op.revPerDay - dd.r)); }
    return t;
  }
  function ring(pct, size, w) {
    const r = (size - w) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, pct) / 100);
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="${w}"/><circle class="ring-v" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--acc)" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
  function dateLine() { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
  function headerHTML() {
    const P = Prefs.v.home.stats, t = Hub.today(), L = Hub.level(), s = Hub.streak(), fz = Hub.freezes ? Hub.freezes() : { have: 0 };
    const due = dueCards() + (window.Weak ? Weak.dueCount() : 0);
    const cells = [];
    if (P.streak) cells.push(`<div class="w-cell" data-hub-streak><div class="w-k">Streak</div><div class="w-v"><span class="w-flame${t.done ? ' on' : ''}">${I('flame', 17)}</span><b>${s}</b><span class="w-u">day${s === 1 ? '' : 's'}</span></div><div class="w-s">${fz.have ? fz.have + ' freeze' + (fz.have === 1 ? '' : 's') + ' saved' : t.done ? 'Done today' : 'Not yet today'}</div></div>`);
    if (P.level) cells.push(`<div class="w-cell"><div class="w-k">Level</div><div class="w-v"><b>${L.level}</b></div>${P.xp ? `<div class="w-bar"><b style="width:${L.pct}%"></b></div><div class="w-s">${L.into} / ${L.need} XP</div>` : ''}</div>`);
    cells.push(`<div class="w-cell" data-w-due><div class="w-k">Due</div><div class="w-v"><b>${due}</b></div><div class="w-s">${due ? 'to review' : 'All caught up'}</div></div>`);
    const goal = P.goal ? `<button class="w-goal" id="hhGoal" type="button" aria-label="Daily goal ${t.xp} of ${t.goal} XP">${ring(t.pct, 64, 7)}<span class="w-goal-t"><b>${t.xp}</b><small>/${t.goal}</small></span></button>` : '';
    return `<div class="h-top"><div><div class="h-date">${esc(dateLine())}</div><h1 class="h-title">Today</h1>${window.Pro && Pro.trialBadge ? Pro.trialBadge() : ''}</div><div class="h-act">${window.Account && Account.on ? Account.homeBtn() : ''}${window.Search ? `<button class="iconbtn" data-search-open type="button" aria-label="Search">${Search.icon(21)}</button>` : ''}</div></div>
      <div class="w-card${goal ? ' has-goal' : ''}">${goal}<div class="w-cells c${cells.length}">${cells.join('')}</div></div>`;
  }
  // daily plan: a few concrete things for today, checked off from real activity
  function planHTML() {
    const c = Hub.today().counts || {}, due = dueCards(), weak = window.Weak ? Weak.dueCount() : 0;
    const rev = (c.review || 0) + (c.again || 0), target = Math.min(20, rev + due);
    const items = [];
    if (target > 0) items.push({ k: 'cards', t: target > rev ? `Review ${target} cards` : `Reviewed ${rev} cards`, s: due ? due + ' due now' : 'Deck clear', done: due === 0 || rev >= 20, go: "decks" });
    items.push({ k: 'learn', t: 'Read a lesson', s: c.lesson ? c.lesson + ' read today' : 'Pick up where you left off', done: !!c.lesson, go: 'learn' });
    if (weak || c.weak) items.push({ k: 'weak', t: 'Clear weak spots', s: weak ? weak + ' waiting' : 'All cleared', done: !weak, go: 'weak' });
    const n = items.filter(x => x.done).length;
    return `<div class="sec-h"><h3>Plan</h3><span class="sec-n">${n} of ${items.length}</span></div><div class="plan">${items.map(x => `<button class="plan-i${x.done ? ' done' : ''}" data-plan="${x.go}" type="button"><span class="plan-c">${x.done ? I('check', 15) : ''}</span><span class="plan-t"><span>${esc(x.t)}</span><small>${esc(x.s)}</small></span>${I('chev', 16, 'plan-ch')}</button>`).join('')}</div>`;
  }
  function tileHTML(t, style) {
    let b = ''; try { b = t.badge ? t.badge() : ''; } catch (e) { b = ''; }
    let sub = ''; try { sub = t.sub ? t.sub() : ''; } catch (e) {}
    const badge = b === '' || b == null || b === 0 || b === 'building' ? '' : `<span class="tb">${typeof b === 'number' && b > 999 ? '999+' : esc(b)}</span>`;
    const inner = `<span class="bt-ic" aria-hidden="true">${I(t.ic, style === 'list' ? 20 : 24)}</span><span class="bt-tx"><span class="bt-n">${esc(t.name)}</span><span class="bt-s">${esc(sub)}</span></span>${badge}${style === 'list' ? I(t.ext ? 'ext' : 'chev', 16, 'bt-ch') : ''}`;
    return t.href ? `<a class="btile" data-tile="${t.k}" href="${t.href}"${t.ext && !t.plain ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>` : `<button class="btile" data-tile="${t.k}" type="button">${inner}</button>`;
  }
  function tilesInOrder() { const H = Prefs.v.home; return H.order.map(k => TILES.find(t => t.k === k)).filter(t => t && !t.tab && !H.hidden.includes(t.k) && (!t.when || t.when())); }
  // hero: the one thing to do next
  function heroHTML() {
    const due = dueCards(), weak = window.Weak ? Weak.dueCount() : 0, mins = Math.max(1, Math.round(due * 8 / 60));
    if (due) return `<button class="h-hero" data-h-study type="button"><span class="h-hero-t"><span class="h-k">Continue studying</span><b>${due} card${due === 1 ? '' : 's'} due</b><small>About ${mins} min${weak ? ' · ' + weak + ' weak spot' + (weak === 1 ? '' : 's') : ''}</small></span><span class="h-go">${I('chev', 22)}</span></button>`;
    if (weak) return `<button class="h-hero" data-plan="weak" type="button"><span class="h-hero-t"><span class="h-k">Cards all done</span><b>${weak} weak spot${weak === 1 ? '' : 's'}</b><small>Clear the ones you keep missing</small></span><span class="h-go">${I('chev', 22)}</span></button>`;
    return `<button class="h-hero done" data-plan="learn" type="button"><span class="h-hero-t"><span class="h-k">All caught up ${I('check', 15)}</span><b>Learn something new</b><small>Pick up a lesson where you left off</small></span><span class="h-go">${I('chev', 22)}</span></button>`;
  }
  function dailyRec() { try { const o = JSON.parse(localStorage.getItem('daily.v1') || 'null'); const d = new Date(), k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return { today: o && o.days && o.days[k], best: o && o.best }; } catch (e) { return {}; } }
  function duoHTML() {
    const dr = dailyRec(), docB = window.Doctordle ? Doctordle.badge() : '';
    const dSub = dr.today ? 'Done today' + (dr.today.score != null ? ' · ' + dr.today.score + '/12' : '') : dr.best && dr.best.score ? 'Best ' + dr.best.score + '/12' : '12 cards · 90 sec';
    return `<div class="h-duo"><button class="h-mini" data-h-feat="daily" type="button"><span class="h-mi">${I('timer', 20)}</span><b>Daily challenge</b><small>${esc(dSub)}</small>${dr.today ? '' : '<i class="h-new"></i>'}</button>
      <button class="h-mini" data-h-feat="doc" type="button"><span class="h-mi">${I('doc', 20)}</span><b>Doctordle</b><small>${docB ? "Today's case is ready" : 'Solved today · free play'}</small>${docB ? '<i class="h-new"></i>' : ''}</button></div>`;
  }
  function recentHTML() {
    if (!window.Shell) return ''; const r = Shell.recent().filter(id => id !== 'daily' && id !== 'doc').slice(0, 6); if (!r.length) return '';
    return `<div class="sec-h"><h3>Jump back in</h3></div><div class="h-recent">${r.map(id => { const f = Shell.feat(id); return `<button class="h-rc" data-h-feat="${id}" type="button"><span class="h-rci">${Shell.iconOf(f, 20)}</span><span>${esc(f.title)}</span></button>`; }).join('')}</div>`;
  }
  function render() {
    const el = $('#v-home'); if (!el) return;
    if (window.Layout && Layout.home && Layout.home(el)) return; // v111: the block-built home (feat/layout)
    const style = Prefs.v.home.style;
    let extra = '';
    try { if (window.HomeExtras) extra = HomeExtras.map(f => { try { return f() || ''; } catch (e) { return ''; } }).join(''); } catch (e) {}
    const tiles = tilesInOrder();
    el.innerHTML = headerHTML() + heroHTML() + duoHTML() + planHTML() + extra + recentHTML() + (tiles.length ? `<div class="sec-h"><h3>Shortcuts</h3></div><div class="btiles h-short ${style === 'list' ? 'as-list' : 'as-grid'}">${tiles.map(t => tileHTML(t, style)).join('')}</div>` : '');
    paintTabs();
  }
  // Weak Spots lives inside Cards as a tab; its tab carries the due count
  function paintTabs() { const b = document.querySelector('#tabs [data-go=weak]'); if (!b || !window.Weak) return; const n = Weak.dueCount(); let s = b.querySelector('.tdot'); if (!s) { s = document.createElement('i'); s.className = 'tdot'; b.appendChild(s); } s.textContent = n > 99 ? '99+' : n; s.hidden = !n; }
  function goalSheet() {
    const g = Hub.today().goal;
    openSheet(`<h2>Daily goal</h2><p class="muted small">XP per day. Reviews give 2, lessons 10, tests 10+, a Doctordle solve up to 40, weak spots 3.</p>
      <div class="goals">${[20, 50, 100, 150, 250].map(n => `<button class="btn${n === g ? ' pri' : ''}" data-hgoal="${n}">${n}</button>`).join('')}</div>
      <div class="actions"><button class="btn" data-close>Close</button></div>`);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-tile]');
    if (t) { const def = TILES.find(x => x.k === t.dataset.tile); if (def && def.go) { e.preventDefault(); def.go(); } return; }
    const p = e.target.closest('[data-plan]'); if (p) { go(p.dataset.plan); return; }
    if (e.target.closest('[data-h-study]')) { studyDeck = '*'; undoStack = []; go('study'); return; }
    const hf = e.target.closest('[data-h-feat]'); if (hf) { if (window.Shell) Shell.open(hf.dataset.hFeat); return; }
    if (e.target.closest('[data-go-prefs]')) { go('prefs'); return; }
    if (e.target.closest('[data-focus]')) { XView.open('focus'); return; }
    if (e.target.closest('#hhGoal')) { goalSheet(); return; }
    const g = e.target.closest('[data-hgoal]'); if (g) { Hub.setGoal(+g.dataset.hgoal); closeSheet(); if (view === 'home') render(); return; }
  });
  function soon(v) {
    const m = { doc: ['doc', 'Doctordle', 'Guess the diagnosis. Full cases with history, vitals, exam, labs and imaging, plus the 6-clue rounds from our texts and every past round. Up to 6 guesses.'], weak: ['weak', 'Weak Spots', 'Every Learn question you miss and every card you press Again on comes back here on a 1·3·7-day schedule until you get it right twice in a row.'], anat: ['anat', 'Anatomy', 'A 3D body you can spin, zoom and tap. Every body system is its own layer, and every structure gets a lesson.'] }[v];
    $('#v-' + v).innerHTML = `<div class="soon"><div class="soon-ic">${I(m[0], 34)}</div><h2>${m[1]}</h2><p class="muted">${m[2]}</p><p class="small muted">Being built right now.</p><button class="btn pri" data-goto-home>Back to home</button></div>`;
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-goto-home]')) go('home'); });
  if (window.Hub) Hub.onChange(() => { if (typeof view !== 'undefined' && view === 'home') render(); });
  Prefs.onChange(() => { if (typeof view !== 'undefined' && view === 'home') render(); });
  // weekly recap entry (Sunday/Monday until opened)
  window.HomeExtras = window.HomeExtras || [];
  HomeExtras.push(() => window.Stats2 && Stats2.recapDue() ? `<button class="recap-row" data-recap type="button"><span class="bt-ic">${I('stats', 20)}</span><span class="plan-t"><span>Your week in review</span><small>XP, streak, best day and what to focus on</small></span>${I('chev', 16, 'plan-ch')}</button>` : '');
  document.addEventListener('click', e => { if (e.target.closest('[data-recap]')) { go('stats'); Stats2.recap($('#v-stats'), { onBack: () => Stats2.render($('#v-stats')) }); } });
  window.Home = { render, soon, dueCards, paintTabs, TILES, openLib };
})();
