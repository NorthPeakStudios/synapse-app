/* Medical word builder: Build (meaning → assemble prefix/root/suffix tiles) and Break (term → meaning, then the parts). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let S = null, D = null;
  const N = 10, TYPE = { p: 'prefix', r: 'root', s: 'suffix' };
  function render(el) {
    S = { el, mode: 'menu', tab: 'build' };
    if (!el.__wb) { el.__wb = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/words.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  const P = k => D.parts[k];
  const tile = (k, i, used) => `<button type="button" class="wb-t ${P(k)[0]}${used ? ' used' : ''}" data-wb-t="${i}" ${used ? 'disabled' : ''}>${esc(k)}</button>`;
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('words');
      h = L.top('Medical word builder', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Most medical words are Lego: <b>prefix + root + suffix</b>. Learn ${Object.keys(D.parts).length} parts and you can decode words you've never seen. ${D.terms.length} terms.</p>
        <div class="lb-group">
          <button class="lb-row" data-wb-start="build" type="button"><span class="lb-ic">${ic('abc', 19)}</span><span class="lb-rt"><span class="t1">Build</span><span class="t2">Read the meaning, snap the parts together</span></span>${L.bestOf('words', 'build') ? `<span class="lb-best">${L.bestOf('words', 'build').b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>
          <button class="lb-row" data-wb-start="break" type="button"><span class="lb-ic">${ic('bolt', 19)}</span><span class="lb-rt"><span class="t1">Break</span><span class="t2">See a word, pick what it means, see its parts</span></span>${L.bestOf('words', 'break') ? `<span class="lb-best">${L.bestOf('words', 'break').b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>
          <button class="lb-row" data-wb-gl type="button"><span class="lb-ic">${ic('book', 19)}</span><span class="lb-rt"><span class="t1">All the parts</span><span class="t2">Prefixes, roots and suffixes with meanings</span></span><span class="lb-chev">${ic('chev', 16)}</span></button>
        </div>`;
    } else if (S.mode === 'gloss') {
      const grp = t => Object.entries(D.parts).filter(([, v]) => v[0] === t).sort((a, b) => a[0].localeCompare(b[0]));
      h = `<div class="lb-top"><button class="lb-back" type="button" data-wb-menu>${ic('back', 18)}<span>Words</span></button><span class="lb-tr"></span></div><h2 class="lb-title">All the parts</h2>` +
        ['p', 'r', 's'].map(t => `<h3>${{ p: 'Prefixes', r: 'Roots', s: 'Suffixes' }[t]}</h3><div class="lb-card"><div class="wb-gl">${grp(t).map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v[1])}</span>`).join('')}</div></div>`).join('');
    } else if (S.mode === 'end') {
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.right}/${N} right</div><div class="muted small">${S.kind === 'build' ? 'Build' : 'Break'} round</div></div>
        ${S.missed.length ? `<div class="lb-card"><h3>Review these</h3><ul>${S.missed.map(t => `<li><b>${esc(t[0])}</b> = ${t[1].map(esc).join(' + ')}: ${esc(t[2])}</li>`).join('')}</ul></div>` : ''}
        <div class="lb-btns"><button class="btn" data-wb-menu type="button">Done</button><button class="btn pri" data-wb-start="${S.kind}" type="button">Another round</button></div>`;
    } else {
      const t = S.q[S.i], head = `<div class="lb-top"><button class="lb-back" type="button" data-wb-menu>${ic('back', 18)}<span>Words</span></button><span class="lb-tr">${S.i + 1}/${N} · ${S.right} right</span></div>`;
      if (S.kind === 'build') {
        const st = S.state;
        h = head + `<p class="mt-h">Build the word that means</p><div class="wb-mean">${esc(t[2])}</div>
          <div class="wb-ans${st === 'ok' ? ' ok' : st === 'no' ? ' no' : ''}">${S.ans.length ? S.ans.map((ti, j) => `<button type="button" class="wb-t ${P(S.tiles[ti])[0]}" data-wb-un="${j}" ${st ? 'disabled' : ''}>${esc(S.tiles[ti])}</button>`).join('') : '<span class="muted small" style="padding:0 6px">tap parts below, in order</span>'}</div>
          <div class="wb-word">${st ? (st === 'ok' ? '✓ ' : '✗ ') + esc(t[0]) : ''}</div>
          ${st ? `<div class="wb-brk">${t[1].map(k => `<span><b>${esc(k)}</b>${esc(P(k)[1])}</span>`).join('')}</div>` : `<div class="wb-tiles">${S.tiles.map((k, i) => tile(k, i, S.ans.includes(i))).join('')}</div><div class="wb-leg"><span><i style="background:var(--easy)"></i>prefix</span><span><i style="background:var(--good)"></i>root</span><span><i style="background:var(--hard)"></i>suffix</span></div>`}
          <div class="lb-btns sticky">${st ? '<button class="btn pri" data-wb-next type="button">Next</button>' : `<button class="btn" data-wb-clear type="button">Clear</button><button class="btn pri" data-wb-check type="button" ${S.ans.length ? '' : 'disabled'}>Check</button>`}</div>`;
      } else {
        const st = S.state;
        h = head + `<p class="mt-h" style="text-align:center">What does this mean?</p><div class="wb-term">${esc(t[0])}</div>
          <div class="sim-opts">${S.opts.map((o, i) => `<button type="button" class="sim-o${st ? (o === t[2] ? ' good' : i === S.pick ? ' badc' : '') : ''}" data-wb-o="${i}" ${st ? 'disabled' : ''}><span class="sim-q">${esc(o)}</span></button>`).join('')}</div>
          ${st ? `<div class="wb-brk">${t[1].map(k => `<span><b>${esc(k)}</b>${esc(P(k)[1])}</span>`).join('')}</div><div class="lb-btns sticky"><button class="btn pri" data-wb-next type="button">Next</button></div>` : ''}`;
      }
    }
    S.el.innerHTML = `<div class="lb wb">${h}</div>`;
  }
  function start(kind) { S.kind = kind; S.q = L.shuffle(D.terms).slice(0, N); S.i = 0; S.right = 0; S.missed = []; S.mode = 'play'; setup(); }
  function setup() {
    const t = S.q[S.i]; S.state = ''; S.ans = []; S.pick = -1;
    if (S.kind === 'build') {
      const all = Object.keys(D.parts).filter(k => !t[1].includes(k)), dis = [];
      for (const ty of ['p', 'r', 's']) dis.push(...L.shuffle(all.filter(k => D.parts[k][0] === ty)).slice(0, ty === 'r' ? 2 : 1));
      S.tiles = L.shuffle(t[1].concat(dis));
    } else {
      const others = L.shuffle(D.terms.filter(x => x[0] !== t[0])).slice(0, 3).map(x => x[2]);
      S.opts = L.shuffle([t[2]].concat(others));
    }
    paint(); window.scrollTo(0, 0);
  }
  function mark(ok) {
    const t = S.q[S.i]; S.state = ok ? 'ok' : 'no'; if (ok) S.right++; else S.missed.push(t); L.fx(ok);
    L.mastery({ id: 'WB:' + t[0], tags: ['medical terminology'], ok, choices: S.kind === 'build' ? 6 : 4, label: t[0] + ' = ' + t[2], src: 'words' });
    paint();
  }
  function next() {
    if (S.i + 1 >= N) { S.score = Math.round(100 * S.right / N); S.mode = 'end'; L.result('words', S.kind, S.score); L.award('words', S.right); paint(); window.scrollTo(0, 0); return; }
    S.i++; setup();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-wb-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-wb-gl]')) { S.mode = 'gloss'; paint(); window.scrollTo(0, 0); return; }
    const s = t.closest('[data-wb-start]'); if (s) { start(s.dataset.wbStart); return; }
    if (S.mode !== 'play') return;
    if (t.closest('[data-wb-next]')) { next(); return; }
    if (S.state) return;
    const a = t.closest('[data-wb-t]'); if (a) { const i = +a.dataset.wbT; if (!S.ans.includes(i)) S.ans.push(i); paint(); return; }
    const u = t.closest('[data-wb-un]'); if (u) { S.ans.splice(+u.dataset.wbUn, 1); paint(); return; }
    if (t.closest('[data-wb-clear]')) { S.ans = []; paint(); return; }
    if (t.closest('[data-wb-check]')) { const q = S.q[S.i]; const got = S.ans.map(i => S.tiles[i]); mark(got.length === q[1].length && got.every((k, j) => k === q[1][j])); return; }
    const o = t.closest('[data-wb-o]'); if (o) { S.pick = +o.dataset.wbO; mark(S.opts[S.pick] === S.q[S.i][2]); return; }
  }
  window.LabMods.words = { render, _S: () => S };
})();
