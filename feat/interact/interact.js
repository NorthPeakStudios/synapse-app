/* Interactions: a class-level drug-interaction game. Data in pairs.js (window.INTERACT_DATA).
   Modes: Risky or fine? · Mechanism (multiple choice) · 60-second round · Browse all pairs.
   window.Interact = { render(el) }. XP via Hub.award('rx'); best scores in progress record id 'rx:best' (t:'rx');
   misses go to Weak Spots via Weak.addQuestion(key, 'rx', q, label). Educational only: no doses. */
(function () {
  'use strict';
  if (window.Interact) return;
  const D = () => window.INTERACT_DATA || { MECH: {}, P: [] };
  const e_ = s => (window.esc ? window.esc(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const IP = {
    chev: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    cog: '<path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="m11 13.73-4 6.93"/>',
    timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
    list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
  };
  const ic = (n, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IP[n]}</svg>`;
  const RF_N = 12, MECH_N = 10, TIME = 60;

  /* ---------- records ---------- */
  const BEST_ID = 'rx:best';
  const bestRec = () => { try { return (typeof M !== 'undefined' && M.progress.get(BEST_ID)) || null; } catch (e) { return null; } };
  const best = () => { const r = bestRec(); return (r && !r.del && r.best) || {}; };
  async function saveResult(mode, score, right, total) {
    try {
      if (typeof write !== 'function' || typeof M === 'undefined') return false;
      const o = bestRec() || { id: BEST_ID, t: 'rx', best: {}, played: 0, right: 0, answered: 0 };
      const b = { ...(o.best || {}) }, isBest = !(b[mode] >= score); if (isBest) b[mode] = score;
      await write([['progress', { ...o, del: 0, best: b, played: (o.played || 0) + 1, right: (o.right || 0) + right, answered: (o.answered || 0) + total, last: Date.now() }]]);
      return isBest;
    } catch (e) { console.warn('rx save', e); return false; }
  }
  const award = (xp, n) => { try { if (window.Hub) return Hub.award('rx', xp, n); } catch (e) {} return 0; };
  const fx = k => { try { if (window.Prefs) { Prefs.sound(k); if (k !== 'tap') Prefs.haptic(); } } catch (e) {} };
  function toWeak(p, mode, choices, answer) {
    try {
      if (!window.Weak || typeof Weak.addQuestion !== 'function') return;
      const q = mode === 'mech'
        ? { type: 'mc', q: `Why is **${p.a} + ${p.b}** risky?`, choices, answer, explain: `${p.fx}. ${p.why}` }
        : { type: 'mc', q: `**${p.a}** (${p.ae || 'drug'}) **+ ${p.b}**${p.be ? ' (' + p.be + ')' : ''}: risky or fine?`, choices: ['Risky', 'Fine'], answer: p.risky ? 0 : 1, explain: `${p.fx}. ${p.why}` };
      Weak.addQuestion('rx:' + p.id + ':' + (mode === 'mech' ? 'm' : 'r'), 'rx', q, 'Interactions');
    } catch (e) { console.warn('rx weak', e); }
  }

  /* ---------- shared bits ---------- */
  const pairHTML = p => `<div class="rx-pair"><div class="rx-drug"><b>${e_(p.a)}</b>${p.ae ? `<span>${e_(p.ae)}</span>` : ''}</div><div class="rx-plus">${ic('plus', 18)}</div><div class="rx-drug"><b>${e_(p.b)}</b>${p.be ? `<span>${e_(p.be)}</span>` : ''}</div></div>`;
  const kindLabel = p => p.kind === 'PD' ? 'Pharmacodynamic' : p.kind === 'PK' ? 'Pharmacokinetic' : 'No interaction';
  const tagsHTML = p => `<div class="rx-tags"><span class="rx-tag ${p.risky ? (p.sev === 'major' ? 'maj' : 'mod') : 'ok'}">${p.risky ? (p.sev === 'major' ? 'Major' : 'Moderate') : 'Fine'}</span>${p.risky ? `<span class="rx-tag">${kindLabel(p)}</span>` : ''}</div>`;
  const explainHTML = p => `<div class="rx-exp">${tagsHTML(p)}<div class="rx-fx">${e_(p.fx)}</div>${p.risky ? `<div class="rx-mech">${e_(D().MECH[p.m] || '')}</div>` : ''}<p>${e_(p.why)}</p></div>`;
  const bar = (i, n) => `<div class="rx-bar"><i style="width:${(i / n) * 100}%"></i></div>`;

  let S = null;
  function render(el) {
    if (S && S.timer) clearInterval(S.timer);
    S = { el, mode: 'home' };
    if (!el.__rx) { el.__rx = true; el.addEventListener('click', onClick); }
    paint();
  }
  function paint() {
    if (!S || !S.el.isConnected) { if (S && S.timer) clearInterval(S.timer); return; }
    ({ home: pHome, rf: pRF, mech: pMech, timed: pTimed, end: pEnd, browse: pBrowse })[S.mode]();
  }

  /* ---------- home ---------- */
  function pHome() {
    const b = best(), P = D().P;
    const row = (m, icn, t, s, v) => `<button class="rx-row" data-rx="start" data-mode="${m}"><span class="rx-ic">${ic(icn)}</span><span class="rx-rt"><span class="t1">${t}</span><span class="t2">${s}</span></span>${v != null ? `<span class="rx-best">${v}</span>` : ''}<span class="rx-chev">${ic('chev', 16)}</span></button>`;
    S.el.innerHTML = `<div class="rx"><div class="rx-head"><h2>Interactions</h2><p class="muted">Which drug classes clash, why, and what happens. ${P.length} pairs.</p></div>
      <div class="rx-group">
        ${row('rf', 'shield', 'Risky or fine?', `${RF_N} pairs, with the reason after each`, b.rf != null ? b.rf + '%' : null)}
        ${row('mech', 'cog', 'Mechanism', `${MECH_N} questions: PK or PD, which enzyme`, b.mech != null ? b.mech + '%' : null)}
        ${row('timed', 'timer', '60-second round', 'As many as you can', b.timed != null ? b.timed : null)}
      </div>
      <div class="rx-group">${row('browse', 'list', 'All pairs', 'Read every interaction by mechanism', null)}</div>
      <p class="rx-foot">Class-level teaching examples, not medical advice. Real prescribing checks the specific drugs, doses and patient.</p></div>`;
  }

  /* ---------- risky or fine ---------- */
  function startRF() {
    const P = D().P, risky = shuffle(P.filter(p => p.risky)), fine = shuffle(P.filter(p => !p.risky));
    const nf = Math.min(fine.length, 3 + Math.floor(Math.random() * 3));
    S = { ...S, mode: 'rf', list: shuffle(risky.slice(0, RF_N - nf).concat(fine.slice(0, nf))), i: 0, ans: null, right: 0, miss: [] };
  }
  function pRF() {
    const p = S.list[S.i], a = S.ans;
    S.el.innerHTML = `<div class="rx rx-play">${topBar('Risky or fine?', `${S.i + 1} / ${S.list.length}`)}${bar(S.i, S.list.length)}
      <div class="rx-card">${pairHTML(p)}${a ? `<div class="rx-verdict ${a.ok ? 'good' : 'bad'}">${ic(a.ok ? 'check' : 'x', 18)}<span>${a.ok ? 'Correct' : 'Not quite'} \u00b7 ${p.risky ? 'risky' : 'fine'}</span></div>${explainHTML(p)}` : ''}</div>
      <div class="rx-acts">${a ? `<button class="btn pri wide" data-rx="next">${S.i + 1 < S.list.length ? 'Next' : 'See score'}</button>`
        : `<button class="btn rx-risky" data-rx="rf" data-v="1">Risky</button><button class="btn rx-fine" data-rx="rf" data-v="0">Fine</button>`}</div></div>`;
  }

  /* ---------- mechanism ---------- */
  function mechChoices(p) {
    const M_ = D().MECH, P = D().P;
    const same = shuffle([...new Set(P.filter(x => x.risky && x.kind === p.kind && x.m !== p.m).map(x => x.m))]);
    const other = shuffle([...new Set(P.filter(x => x.risky && x.kind !== p.kind && x.m !== p.m).map(x => x.m))]);
    const ds = same.slice(0, 2).concat(other).filter((m, i, a) => a.indexOf(m) === i).slice(0, 3);
    const ms = shuffle([p.m, ...ds]);
    return { choices: ms.map(m => M_[m]), answer: ms.indexOf(p.m) };
  }
  function startMech() {
    const list = shuffle(D().P.filter(p => p.risky)).slice(0, MECH_N).map(p => ({ p, ...mechChoices(p) }));
    S = { ...S, mode: 'mech', list, i: 0, ans: null, right: 0, miss: [] };
  }
  function pMech() {
    const q = S.list[S.i], p = q.p, a = S.ans;
    S.el.innerHTML = `<div class="rx rx-play">${topBar('Mechanism', `${S.i + 1} / ${S.list.length}`)}${bar(S.i, S.list.length)}
      <div class="rx-card">${pairHTML(p)}<div class="rx-q"><span class="muted">Leads to</span> ${e_(p.fx)}. <b>Why?</b></div>
        <div class="rx-ch">${q.choices.map((c, j) => `<button class="rx-choice ${a ? (j === q.answer ? 'right' : j === a.given ? 'wrong' : 'dim') : ''}" data-rx="mc" data-j="${j}" ${a ? 'disabled' : ''}>${e_(c)}</button>`).join('')}</div>
        ${a ? `<div class="rx-exp">${tagsHTML(p)}<p>${e_(p.why)}</p></div>` : ''}</div>
      ${a ? `<div class="rx-acts"><button class="btn pri wide" data-rx="next">${S.i + 1 < S.list.length ? 'Next' : 'See score'}</button></div>` : ''}</div>`;
  }

  /* ---------- timed ---------- */
  function startTimed() {
    const P = D().P;
    let deck = []; for (let k = 0; k < 4; k++) deck = deck.concat(shuffle(P));
    S = { ...S, mode: 'timed', list: deck, i: 0, right: 0, wrong: 0, miss: [], left: TIME, flash: '', t0: Date.now() };
    S.timer = setInterval(() => {
      if (!S || S.mode !== 'timed') return;
      if (!S.el.isConnected) { clearInterval(S.timer); return; }
      S.left = Math.max(0, TIME - Math.floor((Date.now() - S.t0) / 1000));
      const t = S.el.querySelector('.rx-clock'); if (t) { t.textContent = S.left + 's'; t.classList.toggle('low', S.left <= 10); }
      if (S.left <= 0) endTimed();
    }, 250);
  }
  function pTimed() {
    const p = S.list[S.i];
    S.el.innerHTML = `<div class="rx rx-play rx-timed">${topBar('60-second round', `<span class="rx-clock${S.left <= 10 ? ' low' : ''}">${S.left}s</span>`)}
      <div class="rx-score"><b>${S.right}</b><span>correct</span>${S.wrong ? `<em>${S.wrong} wrong</em>` : ''}</div>
      <div class="rx-card ${S.flash}">${pairHTML(p)}</div>
      <div class="rx-acts"><button class="btn rx-risky" data-rx="tm" data-v="1">Risky</button><button class="btn rx-fine" data-rx="tm" data-v="0">Fine</button></div></div>`;
  }
  async function endTimed() {
    clearInterval(S.timer); S.timer = null;
    const total = S.right + S.wrong;
    const xp = award(Math.min(30, S.right), S.right);
    const nb = await saveResult('timed', S.right, S.right, total);
    S = { ...S, mode: 'end', from: 'timed', score: S.right, total, xp, nb };
    paint();
  }

  /* ---------- end ---------- */
  async function endRound(mode) {
    const n = S.list.length, pct = Math.round(S.right / n * 100);
    const nb = await saveResult(mode, pct, S.right, n);
    if (S.right === n) award(5, 0);
    S = { ...S, mode: 'end', from: mode, score: pct, total: n, nb };
    paint();
  }
  function pEnd() {
    const timed = S.from === 'timed', miss = S.miss || [];
    const big = timed ? S.score : S.score + '%';
    const sub = timed ? `${S.total} answered in ${TIME} seconds` : `${S.right} of ${S.total} right`;
    S.el.innerHTML = `<div class="rx rx-play">${topBar(S.from === 'rf' ? 'Risky or fine?' : S.from === 'mech' ? 'Mechanism' : '60-second round', '')}
      <div class="rx-card rx-endc"><div class="rx-big">${big}</div><div class="muted">${sub}</div>${S.nb ? '<div class="rx-nb">New best</div>' : ''}</div>
      ${miss.length ? `<h3>To review${window.Weak ? ' \u00b7 added to Weak Spots' : ''}</h3><div class="rx-group rx-miss">${miss.map(p => `<details class="rx-mi"><summary><span><b>${e_(p.a)}</b> + <b>${e_(p.b)}</b></span><span class="rx-mfx">${e_(p.fx)}</span></summary>${explainHTML(p)}</details>`).join('')}</div>` : ''}
      <div class="rx-acts"><button class="btn" data-rx="home">Done</button><button class="btn pri" data-rx="start" data-mode="${S.from}">Play again</button></div></div>`;
  }

  /* ---------- browse ---------- */
  function pBrowse() {
    const { MECH, P } = D(), groups = {};
    for (const p of P) (groups[p.m] = groups[p.m] || []).push(p);
    const order = Object.keys(groups).sort((a, b) => (a === 'none') - (b === 'none') || groups[b].length - groups[a].length);
    S.el.innerHTML = `<div class="rx rx-play">${topBar('All pairs', P.length + '')}
      ${order.map(m => `<h3>${e_(m === 'none' ? 'Fine together' : MECH[m])}</h3><div class="rx-group rx-miss">${groups[m].map(p => `<details class="rx-mi"><summary><span><b>${e_(p.a)}</b> + <b>${e_(p.b)}</b></span><span class="rx-mfx">${e_(p.fx)}</span></summary>${explainHTML(p)}</details>`).join('')}</div>`).join('')}
      <p class="rx-foot">Class-level teaching examples, not medical advice.</p></div>`;
  }

  const topBar = (t, r) => `<div class="rx-top"><button class="rx-back" data-rx="home" aria-label="Back">${ic('back', 20)}<span>Interactions</span></button><span class="rx-tr">${r}</span></div><div class="rx-title">${e_(t)}</div>`;

  /* ---------- input ---------- */
  function onClick(ev) {
    const b = ev.target.closest('[data-rx]'); if (!b || !S) return;
    const a = b.dataset.rx;
    if (a === 'home') { if (S.timer) { clearInterval(S.timer); S.timer = null; } S.mode = 'home'; paint(); window.scrollTo(0, 0); return; }
    if (a === 'start') { const m = b.dataset.mode; if (m === 'rf') startRF(); else if (m === 'mech') startMech(); else if (m === 'timed') startTimed(); else S.mode = 'browse'; paint(); window.scrollTo(0, 0); return; }
    if (a === 'rf' && S.mode === 'rf' && !S.ans) {
      const p = S.list[S.i], ok = (b.dataset.v === '1') === p.risky; S.ans = { ok };
      if (ok) { S.right++; award(); fx('ok'); } else { S.miss.push(p); toWeak(p, 'rf'); fx('bad'); }
      return paint();
    }
    if (a === 'mc' && S.mode === 'mech' && !S.ans) {
      const q = S.list[S.i], j = +b.dataset.j, ok = j === q.answer; S.ans = { given: j, ok };
      if (ok) { S.right++; award(); fx('ok'); } else { S.miss.push(q.p); toWeak(q.p, 'mech', q.choices, q.answer); fx('bad'); }
      return paint();
    }
    if (a === 'next') { if (S.i + 1 < S.list.length) { S.i++; S.ans = null; paint(); window.scrollTo(0, 0); } else endRound(S.mode); return; }
    if (a === 'tm' && S.mode === 'timed' && S.left > 0) {
      const p = S.list[S.i], ok = (b.dataset.v === '1') === p.risky;
      if (ok) { S.right++; S.flash = 'fl-ok'; fx('tap'); } else { S.wrong++; S.flash = 'fl-bad'; if (!S.miss.includes(p)) { S.miss.push(p); toWeak(p, 'rf'); } fx('bad'); }
      S.i = (S.i + 1) % S.list.length; paint();
      clearTimeout(S.ft); S.ft = setTimeout(() => { const c = S.el.querySelector('.rx-card'); if (c) c.classList.remove('fl-ok', 'fl-bad'); S.flash = ''; }, 260);
    }
  }

  window.Interact = { render, _data: D };
})();
