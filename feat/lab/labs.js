/* Lab panel reader: realistic CBC/BMP/ABG/LFT panels. Flag what's high/low, pick the likely cause, then the explanation. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let S = null, D = null;
  const flagOf = r => r[1] < r[3] ? 'l' : r[1] > r[4] ? 'h' : '';
  const fmt = v => String(v);
  function render(el) {
    S = { el, mode: 'menu', ranges: false };
    if (!el.__lr) { el.__lr = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/labs.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('labs'), groups = ['CBC', 'BMP', 'ABG', 'LFT'];
      const names = { CBC: 'Complete blood count', BMP: 'Basic metabolic panel', ABG: 'Arterial blood gas', LFT: 'Liver function tests' };
      h = L.top('Lab panel reader', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Read a real-looking lab report like a doctor: flag every value that's high or low, then pick the most likely cause. ${D.length} panels.</p>
        <button class="btn pri lb-wide" data-lr-rand type="button">Random panel</button>` +
        groups.map(g => `<h3>${names[g]} (${g})</h3><div class="lb-group">${D.filter(p => p.panel === g).map(p => { const b = L.bestOf('labs', p.id); return `<button class="lb-row" data-lr-go="${p.id}" type="button"><span class="lb-rt"><span class="t1">${esc(p.title)}</span><span class="t2">${esc(p.stem)}</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>`).join('') +
        '<p class="lb-foot">Teaching panels with typical adult reference ranges. Labs vary a bit between hospitals. Not medical advice.</p>';
    } else {
      const p = S.p, done = S.mode !== 'flag';
      const rows = p.rows.map((r, i) => {
        const want = flagOf(r), got = S.fl[i] || '', cls = done ? (want === got ? ' r-ok' : ' r-bad') : '';
        const rng = (S.ranges || done) ? `<small>ref ${fmt(r[3])}–${fmt(r[4])}${r[2] ? ' ' + esc(r[2]) : ''}</small>` : (r[2] ? `<small>${esc(r[2])}</small>` : '');
        const right = done ? `<span class="lr-tag ${want}">${want === 'h' ? 'HIGH' : want === 'l' ? 'LOW' : 'normal'}</span>` :
          `<span class="lr-fl"><button type="button" class="l${got === 'l' ? ' on' : ''}" data-lr-f="${i}:l" aria-label="${esc(r[0])} low">L</button><button type="button" class="h${got === 'h' ? ' on' : ''}" data-lr-f="${i}:h" aria-label="${esc(r[0])} high">H</button></span>`;
        return `<div class="lr-row${cls}"><span class="lr-n">${esc(r[0])}${rng}</span><span class="lr-v">${fmt(r[1])}</span>${right}</div>`;
      }).join('');
      h = `<div class="lb-top"><button class="lb-back" type="button" data-lr-menu>${ic('back', 18)}<span>Panels</span></button><span class="lb-tr">${S.mode === 'flag' ? 'Step 1 of 2' : S.mode === 'cause' ? 'Step 2 of 2' : S.score + '%'}</span></div>
        <h2 class="lb-title"><span class="lr-kind">${p.panel}</span>${esc(p.title)}</h2><p class="lr-pt">${esc(p.stem)}</p>`;
      if (S.mode === 'flag') h += `<p class="mt-h">Tap <b>L</b> or <b>H</b> on every abnormal value. Leave normal ones alone.</p><label class="lr-chk"><input type="checkbox" data-lr-rng ${S.ranges ? 'checked' : ''}> Show reference ranges</label>`;
      h += `<div class="lr-tbl">${rows}</div>`;
      if (S.mode === 'flag') h += `<div class="lb-btns sticky"><button class="btn pri" data-lr-check type="button">Check my flags</button></div>`;
      if (S.mode !== 'flag') h += `<div class="lb-card"><b>Flags: ${S.fhit}/${p.rows.length} right</b>${S.fmiss.length ? `<p class="muted" style="font-size:14px;margin-top:4px">Missed: ${S.fmiss.map(esc).join(', ')}</p>` : ''}</div>`;
      if (S.mode === 'cause') h += `<p class="mt-h">${esc(p.q)}</p><div class="sim-opts">${S.order.map(i => `<button type="button" class="sim-o" data-lr-c="${i}"><span class="sim-q">${esc(p.opts[i])}</span></button>`).join('')}</div>`;
      if (S.mode === 'end') {
        h += `<div class="sim-opts">${S.order.map(i => `<div class="sim-o ${i === p.ans ? 'good' : i === S.pick ? 'badc' : ''}"><span class="sim-q">${esc(p.opts[i])}</span></div>`).join('')}</div>
          <div class="lb-card sim-sec"><h3>${S.pick === p.ans ? 'Right cause' : 'The answer: ' + esc(p.opts[p.ans])}</h3><p>${esc(p.why)}</p></div>
          <div class="lb-card pearl"><h3>Pearl</h3><p>${esc(p.pearl)}</p></div>
          <div class="lb-btns"><button class="btn" data-lr-menu type="button">All panels</button><button class="btn pri" data-lr-rand type="button">Next panel</button></div>`;
      }
    }
    S.el.innerHTML = `<div class="lb lr">${h}</div>`;
  }
  function go(id) { const p = D.find(x => x.id === id); if (!p) return; S.p = p; S.fl = {}; S.mode = 'flag'; S.order = L.shuffle(p.opts.map((o, i) => i)); paint(); window.scrollTo(0, 0); }
  function check() {
    const p = S.p; let hit = 0; const miss = [];
    p.rows.forEach((r, i) => { const w = flagOf(r), g = S.fl[i] || ''; if (w === g) hit++; else miss.push(r[0] + (w ? (w === 'h' ? ' (high)' : ' (low)') : ' (normal)')); });
    S.fhit = hit; S.fmiss = miss; S.mode = 'cause'; L.fx(hit === p.rows.length); paint();
    const t = S.el.querySelector('.mt-h:last-of-type'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function cause(i) {
    const p = S.p; S.pick = i; const ok = i === p.ans; L.fx(ok);
    S.score = Math.round(60 * S.fhit / p.rows.length + (ok ? 40 : 0)); S.mode = 'end';
    L.result('labs', p.id, S.score);
    L.mastery({ id: 'LR:' + p.id, tags: ['medicine', 'labs'], ok: ok && S.fhit === p.rows.length, choices: 4, label: p.panel + ': ' + p.title, src: 'labs' });
    L.award('labs', 2 + Math.round(S.score / 10)); paint(); window.scrollTo(0, 0);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-lr-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-lr-rand]')) { const pool = D.filter(p => !S.p || p.id !== S.p.id); go(pool[Math.floor(Math.random() * pool.length)].id); return; }
    const g = t.closest('[data-lr-go]'); if (g) { go(g.dataset.lrGo); return; }
    const f = t.closest('[data-lr-f]'); if (f && S.mode === 'flag') { const [i, k] = f.dataset.lrF.split(':'); S.fl[i] = S.fl[i] === k ? '' : k; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    if (t.closest('[data-lr-rng]')) { S.ranges = !S.ranges; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    if (t.closest('[data-lr-check]')) { check(); return; }
    const c = t.closest('[data-lr-c]'); if (c && S.mode === 'cause') { cause(+c.dataset.lrC); return; }
  }
  window.LabMods.labs = { render, _S: () => S, flagOf };
})();
