/* Code blue sim: run ACLS on a live monitor. Rhythms come from the ECG trainer's generator. Pick the next action at each step; drugs by NAME only, no amounts. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null, D = null, E = null;
  const HR = { vf: '---', vt: '180', nsr: '84', av3: '34', svt: '200', hyperk: '78', asys: '0' };
  const PUL = { none: ['p0', 'No pulse'], weak: ['p1', 'Weak pulse'], yes: ['p2', 'Pulse present'], check: ['p1', 'Pulse: ?'] };
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__cb) { el.__cb = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    Promise.all([L.json('feat/lab/code.json'), L.load('ecg')]).then(([d]) => { D = d; E = window.LabMods.ecg; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function stripFor(r) {
    if (r === 'asys') { const ph = Math.random() * 6; const l = []; l.fib = t => 0.03 * Math.sin(2 * Math.PI * 0.4 * t + ph); return E.stripHTML(l); }
    const R = E.R[r]; return R ? E.stripHTML(R.gen()) : '';
  }
  function monitor(st) {
    if (st.r === 'none') return `<div class="cb-mon"><div class="cb-vit"><span>HR --</span><span class="p0">No pulse</span></div><div class="cb-off">Monitor not attached yet</div></div>`;
    const p = PUL[st.pulse] || PUL.none, bp = st.pulse === 'yes' ? 'BP ok' : st.pulse === 'weak' ? 'BP low' : 'BP --';
    return `<div class="cb-mon"><div class="cb-vit"><span>HR ${HR[st.r] || '--'}</span><span>${bp}</span><span class="${p[0]}">${p[1]}</span></div>${S.strip}</div>`;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('code');
      h = L.top('Code blue', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">You're running the resuscitation. Read the monitor, check the pulse, pick the next move. Follows the adult ACLS algorithms. Drug names only, no doses.</p>
        <div class="lb-card lz-intro"><b>The two big questions</b><ul><li><b>Pulse?</b> No pulse = cardiac arrest: CPR now.</li><li><b>Shockable?</b> VF and pulseless VT = shock. Asystole and PEA = no shock, CPR + epinephrine ASAP.</li><li>Shock → 2 min CPR → rhythm check. Epinephrine every 3–5 min. Amiodarone after the 3rd shock.</li><li>With a pulse: slow + unstable → atropine, pacing. Fast + unstable → synchronised cardioversion.</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-cb-go="-1" type="button">Random code</button></div>
        <div class="lb-group">${D.sc.map((c, i) => { const bo = L.bestOf('code', c.id); return `<button class="lb-row" data-cb-go="${i}" type="button"><span class="lb-rt"><span class="t1">${esc(c.t)}</span><span class="t2">${esc(c.sub)}</span></span>${bo ? `<span class="lb-best">${bo.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`;
    } else {
      const c = D.sc[S.ci];
      h = `<div class="lb-top"><button class="lb-back" type="button" data-cb-menu>${ic('back', 18)}<span>Code blue</span></button><span class="lb-tr">${esc(c.sub)}</span></div>`;
      h += `<div class="cb-prog">${c.s.map((x, i) => `<i class="${i < S.si ? (S.res[i] ? 'g' : 'r') : i === S.si && S.mode !== 'end' ? 'c' : ''}"></i>`).join('')}</div>`;
      if (S.mode === 'end') {
        const sc = S.score;
        h += `<div class="lb-card sim-res"><div class="lz-big">${sc}%</div><div class="sim-verd ${sc >= 70 ? 'ok' : 'bad'}">${S.res.filter(Boolean).length}/${c.s.length} right first time · ${S.miss} wrong move${S.miss === 1 ? '' : 's'}</div></div>
          <div class="lb-btns"><button class="btn" data-cb-go="${S.ci}" type="button">Run it again</button><button class="btn pri" data-cb-go="-1" type="button">Next code</button></div>`;
      } else {
        const st = c.s[S.si];
        h += monitor(st) + `<p class="cb-msg">${esc(st.msg)}</p>`;
        if (S.fb) h += `<div class="cb-fb ${S.fb.ok ? 'good' : 'bad'}">${esc(S.fb.t)}</div>`;
        h += `<div class="nx-opts">${S.opts.map(k => { const tried = S.tried.includes(k), right = st.a.includes(k); return `<button type="button" data-cb-a="${k}" class="${tried ? (right ? 'ok' : 'no') : ''}" ${S.solved || tried ? 'disabled' : ''}>${esc(D.act[k])}</button>`; }).join('')}</div>`;
        if (S.solved) h += `<div class="lb-btns sticky"><button class="btn pri" data-cb-next type="button">${S.si + 1 < c.s.length ? 'Next' : 'Finish'}</button></div>`;
      }
    }
    S.el.innerHTML = `<div class="lb cb">${h}</div>`;
  }
  function stage() { const st = D.sc[S.ci].s[S.si]; S.strip = st.r === 'none' ? '' : stripFor(st.r); S.opts = L.shuffle(st.opts); S.tried = []; S.fb = null; S.solved = false; }
  function start(i) {
    if (i < 0) { const o = D.sc.map((x, k) => k).filter(k => k !== S.ci); i = o[Math.floor(Math.random() * o.length)]; }
    S.ci = i; S.si = 0; S.res = []; S.miss = 0; S.mode = 'play'; stage(); paint(); window.scrollTo(0, 0);
  }
  function pick(k) {
    const st = D.sc[S.ci].s[S.si]; if (S.tried.includes(k) || S.solved) return; S.tried.push(k);
    const ok = st.a.includes(k);
    if (ok) { S.solved = true; if (S.res[S.si] == null) S.res[S.si] = S.tried.length === 1; S.fb = { ok: true, t: st.ok }; }
    else { S.miss++; S.res[S.si] = false; S.fb = { ok: false, t: (st.fb && st.fb[k]) || 'Not the best next move. Try again.' }; }
    L.fx(ok); const y = window.scrollY; paint(); window.scrollTo(0, y);
  }
  function next() {
    const c = D.sc[S.ci]; S.si++;
    if (S.si >= c.s.length) {
      S.score = Math.round(100 * S.res.filter(Boolean).length / c.s.length); S.mode = 'end'; L.fx(S.score >= 70);
      L.result('code', c.id, S.score); L.mastery({ id: 'CB:' + c.id, tags: ['ACLS', 'emergency'], ok: S.score >= 80, choices: 4, label: c.sub, src: 'code' });
      L.award('code', 3 + Math.round(S.score / 20));
    } else stage();
    paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-cb-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    const g = t.closest('[data-cb-go]'); if (g) { start(+g.dataset.cbGo); return; }
    const a = t.closest('[data-cb-a]'); if (a && S.mode === 'play') { pick(a.dataset.cbA); return; }
    if (t.closest('[data-cb-next]')) { next(); return; }
  }
  window.LabMods.code = { render, _S: () => S, _D: () => D };
})();
