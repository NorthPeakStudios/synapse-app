/* Doctordle: guess the diagnosis. History, vitals, exam, labs and imaging are free to open; each guess costs one of 6.
   Cases are lazy-loaded from doctordle/cases.json. Results sync as progress records (t:'doc'). */
'use strict';
(function () {
  const MAX = 6, CLUES = [['history', 'History', ''], ['vitals', 'Vitals', ''], ['exam', 'Exam', ''], ['labs', 'Labs', ''], ['imaging', 'Imaging & tests', '']];
  const clueOrder = () => { const o = window.Settings ? Settings.get('doc.clueOrder') : 'classic';
    if (o === 'labs') return [CLUES[3], CLUES[4], CLUES[0], CLUES[1], CLUES[2]];
    if (o === 'random') { const id = String((S.g && S.g.id) || ''); let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
      const k = x => { let v = h; for (const ch of x[0]) v = (v * 33 + ch.charCodeAt(0)) | 0; v ^= v >>> 13; v = Math.imul(v, 2654435761); return (v >>> 0) % 1009; };
      return CLUES.slice().sort((a, b) => k(a) - k(b)); }
    return CLUES; };
  const hard = () => !!(window.Prefs && Prefs.v.doc.hard), timed = () => !!(window.Prefs && Prefs.v.doc.timed), FREE_HARD = ['history', 'vitals'], TLIMIT = 180000;
  const ic = (n, s) => window.Prefs ? Prefs.icon(n, s || 18) : '';
  const S = { cases: null, loading: null, err: null, g: null, area: localStorage.getItem('doc.area') || 'all' };
  const el = () => $('#v-doc');
  const recOf = id => { const o = M.progress.get('doc:' + id); return o && !o.del ? o : null; };
  const dayRec = k => { const o = M.progress.get('docday:' + k); return o && !o.del ? o : null; };
  async function load() {
    if (S.cases) return S.cases;
    if (!S.loading) S.loading = fetch('doctordle/cases.json').then(r => { if (!r.ok) throw new Error('cases ' + r.status); return r.json(); }).then(j => { S.cases = j.cases; S.err = null; return S.cases; }).catch(e => { S.loading = null; S.err = e; throw e; });
    return S.loading;
  }
  /* ---------- matching ---------- */
  const FILL = new Set(['acute', 'the', 'a', 'an', 'of', 'with', 'and', 'disease', 'syndrome', 'disorder', 'primary', 'type', 'left', 'right', 'from', 'due', 'to', 'in', 'on']);
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’]s\b/g, 's').replace(/[^a-z0-9]+/g, ' ')
      .replace(/ae/g, 'e').replace(/oe/g, 'e').replace(/ph/g, 'f').replace(/\bhaem/g, 'hem').replace(/ise\b/g, 'ize').replace(/\s+/g, ' ').trim();
  }
  const toks = s => norm(s).split(' ').filter(w => w && !FILL.has(w));
  function lev(a, b) {
    if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
    let p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  const close = (a, b) => { if (a === b) return true; const L = Math.max(a.length, b.length); return L >= 5 && lev(a, b) <= (L >= 12 ? 3 : L >= 8 ? 2 : 1); };
  // names for one case: dx (with and without the bracket part) + aliases
  function names(c) { const n = [c.dx, c.dx.replace(/\s*\(.*?\)\s*/g, ' '), ...(c.aliases || [])]; const m = c.dx.match(/\((.*?)\)/); if (m) n.push(m[1]); return [...new Set(n.map(x => x.trim()).filter(Boolean))]; }
  // 'yes' = correct, 'near' = on the right track, '' = no
  function judge(c, guess) {
    const g = norm(guess), gt = toks(guess); if (!g) return '';
    const vocab = new Set(names(c).flatMap(toks));
    for (const n of names(c)) {
      const nn = norm(n), nt = toks(n), a = g.replace(/ /g, ''), b = nn.replace(/ /g, '');
      if (a === b || (b.length >= 5 && lev(a, b) <= 1)) return 'yes';
      // every word of a name is in the guess (typos allowed), and every extra word of the guess belongs to this case's own vocabulary
      if (nt.length && gt.length && nt.every(w => gt.some(x => close(x, w))) && gt.every(x => nt.some(w => close(x, w)) || [...vocab].some(w => close(x, w)))) return 'yes';
    }
    // token overlap with the main diagnosis → close, be more specific
    const main = toks(c.dx); const hit = gt.filter(x => x.length > 2 && main.some(w => close(x, w))).length;
    if (hit && hit >= Math.min(2, main.length) / 2) return 'near';
    return '';
  }
  function nearHint(c, guess) {
    const g = norm(guess); for (const [k, v] of Object.entries(c.near || {})) { const nk = norm(k); if (g === nk || close(g.replace(/ /g, ''), nk.replace(/ /g, '')) || (toks(k).length && toks(k).every(w => toks(guess).some(x => close(x, w))))) return v; } return '';
  }
  function suggestions(q) {
    const g = norm(q); if (g.length < 2 || !S.cases) return [];
    const out = [];
    for (const c of S.cases) for (const n of names(c)) { const nn = norm(n); const i = nn.indexOf(g); if (i >= 0) out.push([i === 0 ? 0 : 1, n.length, n]); else if (g.length >= 4 && close(g, nn.slice(0, g.length))) out.push([2, n.length, n]); }
    const seen = new Set(); return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]).filter(n => { const k = norm(n); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
  }
  /* ---------- daily ---------- */
  function dailyCase() {
    const k = Hub.dayKey(), [y, m, d] = k.split('-').map(Number), n = Math.floor(Date.UTC(y, m - 1, d) / 864e5);
    const list = [...S.cases].sort((a, b) => a.id < b.id ? -1 : 1);
    const order = list.map((c, i) => [((i + 1) * 2654435761 % 4294967296), c]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    return order[n % order.length];
  }
  function badge() { const r = dayRec(Hub.dayKey()); return r ? '' : '1'; }
  /* ---------- game ---------- */
  function newGame(c, daily) { S.g = { id: c.id, c, daily: !!daily, open: [], guesses: [], state: 'play', at: Date.now(), hard: hard(), deadline: timed() ? Date.now() + TLIMIT : 0 }; render(); window.scrollTo(0, 0); tick(); }
  let tickT = 0;
  function tick() { clearInterval(tickT); if (!S.g || !S.g.deadline) return; const paint = () => { const G = S.g; if (!G || G.state !== 'play' || !G.deadline) { clearInterval(tickT); return; } const left = Math.max(0, G.deadline - Date.now()); document.querySelectorAll('[data-doc-timer]').forEach(el => { el.textContent = Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0'); el.classList.toggle('low', left < 30000); }); if (!left) { clearInterval(tickT); finish(false); } }; paint(); tickT = setInterval(paint, 500); }
  async function finish(win) {
    const G = S.g; G.state = win ? 'won' : 'lost';
    const n = G.guesses.length, xp = win ? Math.max(15, 30 - 3 * (n - 1)) + (G.daily ? 10 : 0) : 5;
    const ex = recOf(G.id) || { id: 'doc:' + G.id, t: 'doc', plays: 0, wins: 0 };
    const list = [['progress', { ...ex, id: 'doc:' + G.id, t: 'doc', plays: (ex.plays || 0) + 1, wins: (ex.wins || 0) + (win ? 1 : 0), best: win ? Math.min(ex.best || 9, n) : ex.best || null, last: Date.now(), del: 0 }]];
    if (G.daily && !dayRec(Hub.dayKey())) list.push(['progress', { id: 'docday:' + Hub.dayKey(), t: 'docday', day: Hub.dayKey(), cid: G.id, win: win ? 1 : 0, n, del: 0 }]);
    await write(list);
    try { Hub.award(win ? 'doc' : 'docfail', xp); } catch (e) {} try { if (window.Mastery) Mastery.docResult(G.c, win, n, G.hard); } catch (e) {}
    if (!win && window.Weak) try { await Weak.addQuestion(G.id, 'doc', { q: G.c.complaint + '\n\n' + firstSentence(G.c.clues.history) + ' ' + firstSentence(G.c.clues.exam) + ' ' + firstSentence(G.c.clues.imaging) + '\n\nWhat is the diagnosis?', type: 'typed', answer: G.c.dx.replace(/\s*\(.*?\)\s*/g, ' ').trim(), accept: G.c.aliases, explain: G.c.pearl || firstSentence(G.c.explain.patho) }, 'Doctordle · ' + G.c.system); } catch (e) { console.warn(e); }
    G.xp = xp; render();
  }
  const firstSentence = s => (String(s || '').match(/^.*?[.!?](\s|$)/) || [s])[0].trim();
  function guess(v) {
    const G = S.g; if (!G || G.state !== 'play') return; v = String(v || '').trim(); if (!v) return;
    if (G.guesses.some(x => norm(x.v) === norm(v))) { toast('Already guessed'); return; }
    const r = judge(G.c, v), hint = r === 'yes' ? '' : nearHint(G.c, v) || (r === 'near' ? 'On the right track, but be more specific.' : '');
    G.guesses.push({ v, r, hint });
    if (r === 'yes') finish(true); else if (G.guesses.length >= MAX) finish(false); else render();
  }
  /* ---------- views ---------- */
  function render() {
    const root = el(); if (!root) return;
    if (!S.cases) { root.innerHTML = '<div class="empty">Loading cases…</div>'; load().then(render).catch(() => { root.innerHTML = `<div class="empty">Couldn't load cases${navigator.onLine ? '' : " (you're offline)"}.<br><button class="btn" data-doc-retry style="margin-top:12px">Try again</button></div>`; }); return; }
    if (S.g) return rGame();
    const mode = localStorage.getItem('doc.mode') || 'case';
    const modeSeg = `<div class="seg doc-modes" role="tablist" style="margin:2px 0 14px;width:100%;box-sizing:border-box;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))">${[['case', 'Full cases'], ['six', '6 clues'], ['arc', 'Past rounds']].map(([k, l]) => `<button role="tab" class="${mode === k ? 'on' : ''}" data-doc-mode="${k}" aria-selected="${mode === k}">${l}</button>`).join('')}</div>`;
    if (mode === 'six' || mode === 'arc') {
      root.innerHTML = `<div class="doc-hero"><div class="doc-ic">${ic('doc', 26)}</div><div><h2>Doctordle</h2><p class="muted small">${mode === 'arc' ? 'Every round we played by text, with how you did that night.' : 'Our nightly-text format: one clue at a time, 6 guesses.'}</p></div></div>${modeSeg}<div id="docSix"><div class="empty">Loading…</div></div>`;
      const box = $('#docSix');
      const fail = () => { if (box.isConnected) box.innerHTML = `<div class="empty">Couldn't load${navigator.onLine ? '' : " (you're offline)"}.<br><button class="btn" data-doc-retry style="margin-top:12px">Try again</button></div>`; };
      if (!window.Lab || !Lab.load) return fail();
      Lab.load('dle').then(() => { if (box.isConnected && window.LabMods && LabMods.dle) LabMods.dle.render(box, { embed: true, start: mode === 'arc' ? 'arc' : 'menu' }); else fail(); }).catch(fail);
      return;
    }
    const today = Hub.dayKey(), dr = dayRec(today), dc = dailyCase();
    const recs = S.cases.map(c => recOf(c.id)).filter(Boolean), wins = recs.filter(r => r.wins).length;
    const winsList = recs.filter(r => r.best), avg = winsList.length ? (winsList.reduce((a, r) => a + r.best, 0) / winsList.length).toFixed(1) : '–';
    let dstreak = 0; { let k = dr ? today : prev(today); while (dayRec(k) && dayRec(k).win) { dstreak++; k = prev(k); } }
    root.innerHTML = `<div class="doc-hero"><div class="doc-ic">${ic('doc', 26)}</div><div><h2>Doctordle</h2><p class="muted small">${hard() ? 'Hard mode: history and vitals are free, every other clue costs a guess.' : 'Open any clue for free.'} Each guess costs one of ${MAX}.${timed() ? ' 3-minute clock.' : ''}</p></div></div>${modeSeg}
      <button class="doc-daily" data-doc-daily><span class="t1">${ic('calendar', 17)} Daily case</span><span class="t2">${dr ? (dr.win ? `Solved in ${dr.n} ✓ · come back tomorrow` : 'Missed today · new case tomorrow') : `${esc(dc.system)} · difficulty ${'●'.repeat(dc.difficulty)}${'○'.repeat(3 - dc.difficulty)}`}</span>${dr ? '' : '<span class="go">Play ›</span>'}</button>
      <div class="doc-stats"><div><b>${wins}</b><span>of ${S.cases.length} solved</span></div><div><b>${avg}</b><span>avg guesses</span></div><div><b>${dstreak}</b><span>daily streak</span></div></div>
      <h3>Free play</h3>
      <div class="seg doc-seg" role="tablist">${[['all', 'All'], ['General', 'General'], ['Neuro', 'Neuro']].map(([k, l]) => `<button role="tab" class="${S.area === k ? 'on' : ''}" data-doc-area="${k}" aria-selected="${S.area === k}">${l}</button>`).join('')}</div>
      <button class="btn pri wide" data-doc-random style="margin-top:12px">${ic('dice', 18)} Random new case</button>
      <h3>Cases</h3><div class="doc-list">${S.cases.filter(c => S.area === 'all' || c.area === S.area).map(c => { const r = recOf(c.id); return `<button class="lrow" data-doc-case="${c.id}"><span class="num">${r && r.wins ? '✓' : r ? '✗' : '?'}</span><span class="tx"><span class="t1">${r && r.wins ? esc(c.dx) : esc(c.system) + ' case'}</span><span class="t2">${esc(r && r.wins ? c.system : c.complaint.slice(0, 70) + '…')}</span></span><span class="sc">${'●'.repeat(c.difficulty)}</span></button>`; }).join('')}</div>`;
  }
  function prev(k) { const [y, m, d] = k.split('-').map(Number); const x = new Date(y, m - 1, d - 1, 12); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function rGame() {
    const G = S.g, c = G.c, over = G.state !== 'play', left = MAX - G.guesses.length;
    const shown = over ? clueOrder().map(x => x[0]) : G.open;
    const clueCards = shown.map(k => { const d = CLUES.find(x => x[0] === k); return `<div class="doc-clue"><div class="ch">${d[2]} ${d[1]}</div><div>${esc(c.clues[k])}</div></div>`; }).join('');
    const btns = over ? '' : `<div class="doc-cbtns">${clueOrder().filter(x => !G.open.includes(x[0])).map((x, i) => `<button class="chip${i === 0 ? ' on' : ''}${G.hard && !FREE_HARD.includes(x[0]) ? ' cost' : ''}" data-doc-clue="${x[0]}">${x[1]}${G.hard && !FREE_HARD.includes(x[0]) ? ' <small>−1 guess</small>' : ''}</button>`).join('')}</div>`;
    const dots = `<div class="doc-dots" aria-label="${left} guesses left">${Array.from({ length: MAX }, (_, i) => { const g = G.guesses[i]; return `<span class="${g ? (g.r === 'yes' ? 'y' : g.r === 'near' ? 'n' : 'x') : ''}"></span>`; }).join('')}</div>`;
    const glist = G.guesses.length ? `<div class="doc-guesses">${G.guesses.map((g, i) => `<div class="doc-g ${g.r}"><b>${i + 1}.</b> ${esc(g.v)} <span>${g.r === 'yes' ? '✓' : g.r === 'near' ? '≈' : '✗'}</span>${g.hint ? `<div class="hint">${esc(g.hint)}</div>` : ''}</div>`).join('')}</div>` : '';
    const form = over ? '' : `<form id="docForm" class="typed" autocomplete="off"><input type="text" id="docIn" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="Your diagnosis…" aria-label="Your diagnosis"><button class="btn pri">Guess</button></form><div id="docSug" class="doc-sug"></div>`;
    const endBox = !over ? '' : `<div class="result ${G.state === 'won' ? 'pass' : 'fail'}"><div class="rl">${G.state === 'won' ? `✓ Solved in ${G.guesses.length}` : 'Out of guesses'}</div><div class="big doc-dx">${esc(c.dx)}</div><div class="muted small">+${G.xp} XP${G.daily ? ' · daily case' : ''}${G.state === 'lost' ? ' · added to Weak Spots' : ''}</div></div>
      <div class="doc-ex"><h3>What's happening</h3><p>${esc(c.explain.patho)}</p><h3>How it's confirmed</h3><p>${esc(c.explain.confirm)}</p><h3>Treatment</h3><p>${esc(c.explain.treat)}</p>${c.pearl ? `<div class="doc-pearl">${esc(c.pearl)}</div>` : ''}</div>
      <div class="row" style="margin-top:16px"><button class="btn grow" data-doc-back>Cases</button><button class="btn pri grow" data-doc-random>Next case ›</button></div>`;
    el().innerHTML = `<button class="lback" data-doc-back>‹ Doctordle</button>
      <div class="doc-top"><span class="muted small">${G.daily ? 'Daily case' : 'Free play'}${G.hard ? ' · Hard' : ''}${G.deadline ? ' · <b class="doc-timer" data-doc-timer></b>' : ''} · ${esc(c.system)}</span>${dots}</div>
      <div class="doc-cc"><div class="ch">Presenting complaint</div><div>${esc(c.complaint)}</div></div>
      ${clueCards}${btns}${over ? '' : `<p class="muted small doc-left">${left} guess${left === 1 ? '' : 'es'} left · ${G.hard ? 'history + vitals free' : 'clues are free'}</p>`}${glist}${form}${endBox}`;
    const f = $('#docForm'); if (f) {
      f.onsubmit = e => { e.preventDefault(); guess($('#docIn').value); };
      $('#docIn').oninput = e => { const s = suggestions(e.target.value); $('#docSug').innerHTML = s.map(n => `<button type="button" class="chip" data-doc-sug="${esc(n)}">${esc(n)}</button>`).join(''); };
    }
  }
  document.addEventListener('click', e => {
    if (view !== 'doc') return;
    const t = e.target.closest('[data-doc-daily],[data-doc-random],[data-doc-case],[data-doc-clue],[data-doc-back],[data-doc-area],[data-doc-sug],[data-doc-retry],[data-doc-mode]'); if (!t) return;
    if (t.dataset.docMode) { localStorage.setItem('doc.mode', t.dataset.docMode); S.g = null; render(); return; }
    if (t.hasAttribute('data-doc-retry')) render();
    else if (t.hasAttribute('data-doc-daily')) { if (!dayRec(Hub.dayKey())) newGame(dailyCase(), true); }
    else if (t.hasAttribute('data-doc-random')) { const pool = S.cases.filter(c => (S.area === 'all' || c.area === S.area)); const fresh = pool.filter(c => !recOf(c.id) || !recOf(c.id).wins); const list = (fresh.length ? fresh : pool).filter(c => !S.g || c.id !== S.g.id); newGame((window.Mastery && Mastery.docPick(list)) || list[Math.floor(Math.random() * list.length)] || pool[0], false); }
    else if (t.dataset.docCase) { const c = S.cases.find(x => x.id === t.dataset.docCase); if (c) newGame(c, false); }
    else if (t.dataset.docClue && S.g) { const G = S.g, k = t.dataset.docClue; if (G.hard && !FREE_HARD.includes(k)) { const nm = (CLUES.find(x => x[0] === k) || [k, k])[1]; G.guesses.push({ v: nm + ' clue', r: 'clue' }); G.open.push(k); if (G.guesses.length >= MAX) { finish(false); return; } } else G.open.push(k); rGame(); }
    else if (t.hasAttribute('data-doc-back')) { S.g = null; render(); window.scrollTo(0, 0); }
    else if (t.dataset.docArea) { S.area = t.dataset.docArea; localStorage.setItem('doc.area', S.area); render(); }
    else if (t.dataset.docSug != null) guess(t.dataset.docSug);
  });
  window.Doctordle = { render, badge, judge, load, suggestions, _S: S };
})();
