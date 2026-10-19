/* Receptor drop: drag a drug onto its receptor / enzyme / channel target; it animates as agonist, antagonist, blocker or inhibitor. Mechanisms only, no doses. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let S = null, D = null, drag = null;
  const VERB = { agonist: 'ACTIVATES', antagonist: 'BLOCKS', blocker: 'BLOCKS', inhibitor: 'INHIBITS', modulator: 'BOOSTS' };
  const KIND = { agonist: 'Agonist', antagonist: 'Antagonist', blocker: 'Channel blocker', inhibitor: 'Inhibitor', modulator: 'Positive modulator' };
  function shape(kind) { // simple membrane pictograms
    const mem = '<path d="M4 40h72" stroke="var(--mut2)" stroke-width="6" stroke-linecap="round" opacity=".55"/>';
    const sig = '<g class="rc-sig"><path d="M40 50v10m-4-4 4 4 4-4" stroke="var(--acc)" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>';
    const pulse = '<circle class="rc-pulse" cx="40" cy="18" r="12" fill="none" stroke="var(--good)" stroke-width="3" opacity="0"/>';
    let body;
    if (kind === 'receptor') body = '<path d="M30 52V30c0-6-6-8-6-14M50 52V30c0-6 6-8 6-14" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M32 18a8 8 0 0 0 16 0" stroke="currentColor" stroke-width="3" fill="none" opacity=".6"/>';
    else if (kind === 'channel') body = '<rect x="22" y="22" width="12" height="34" rx="5" fill="currentColor"/><rect x="46" y="22" width="12" height="34" rx="5" fill="currentColor"/><path d="M40 14v8" stroke="currentColor" stroke-width="2" stroke-dasharray="2 3"/>';
    else if (kind === 'transporter') body = '<path d="M24 56V26a16 14 0 0 1 32 0v30" stroke="currentColor" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="40" cy="30" r="4" fill="currentColor"/>';
    else body = '<path d="M20 34c0-12 10-20 22-18 9 1 4 10 12 10 8 0 8 18-4 22-9 3-30 2-30-14z" fill="currentColor" opacity=".9"/><path d="M42 24a7 7 0 0 0 0 10" stroke="var(--card)" stroke-width="3" fill="none"/>';
    return `<svg viewBox="0 0 80 64" width="76" height="60" aria-hidden="true" style="color:var(--mut)">${kind === 'enzyme' ? '' : mem}${body}${pulse}${kind === 'receptor' || kind === 'channel' ? sig : ''}</svg>`;
  }
  function render(el) {
    S = { el, mode: 'menu' };
    if (!el.__rc) { el.__rc = 1; el.addEventListener('click', onClick); el.addEventListener('pointerdown', onDown); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/receptor.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('receptor');
      h = L.top('Receptor drop', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Every drug works by hitting a target: a receptor, an enzyme, a channel or a transporter. Drag each drug onto its target and watch what it does. ${D.drugs.length} drugs, ${Object.keys(D.targets).length} targets.</p>
        <div class="lb-card"><ul><li><b style="color:var(--good)">Agonist</b>: switches a receptor ON</li><li><b style="color:var(--again)">Antagonist / blocker</b>: sits in the way, switches it OFF</li><li><b style="color:var(--hard)">Inhibitor</b>: stops an enzyme or transporter working</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-rc-start type="button">Start a round</button><button class="btn" data-rc-list type="button">All drugs</button></div><p class="lb-foot">Mechanisms only. No doses. Not medical advice.</p>`;
    } else if (S.mode === 'list') {
      h = `<div class="lb-top"><button class="lb-back" type="button" data-rc-menu>${ic('back', 18)}<span>Receptors</span></button><span class="lb-tr"></span></div><h2 class="lb-title">All ${D.drugs.length} drugs</h2><div class="lb-group">${D.drugs.map(d => `<div class="mt-li"><b>${esc(d[0])}</b><span>${esc(KIND[d[3]])} · ${esc(D.targets[d[2]][0])}</span><i>${esc(d[4])}</i></div>`).join('')}</div>`;
    } else if (S.mode === 'end') {
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.score}%</div><div class="sim-verd ${S.score >= 70 ? 'ok' : 'bad'}">${S.first}/${S.set.length} on the first try</div></div>
        <div class="lb-card sim-sec"><h3>This round</h3><ul>${S.set.map(d => `<li><b>${esc(d[0])}</b> ${VERB[d[3]].toLowerCase()} ${esc(D.targets[d[2]][0])}: ${esc(d[4])}</li>`).join('')}</ul></div>
        <div class="lb-btns"><button class="btn" data-rc-menu type="button">Done</button><button class="btn pri" data-rc-start type="button">Another round</button></div>`;
    } else {
      const fb = S.fb;
      h = `${L.top('', `${S.done.size}/${S.set.length} placed`, 'lab')}<p class="mt-h">Drag each drug onto its target (or tap a drug, then a target)</p>
        <div class="rc-board">${S.tg.map(k => { const t = D.targets[k], hit = S.hits[k]; return `<div class="rc-t${hit ? ' hit ' + hit[3] : ''}" data-rc-t="${k}">${hit ? `<span class="rc-badge ${hit[3]}">${VERB[hit[3]]}</span>` : ''}${shape(t[1])}<span class="rc-n">${esc(t[0])}</span><span class="rc-w">${esc(t[2])}</span>${hit ? `<span class="rc-drug">${esc(hit[0])}</span>` : ''}</div>`; }).join('')}</div>
        ${fb ? `<div class="lb-card rc-fb"><span class="lr-kind">${esc(KIND[fb[3]])}</span><b>${esc(fb[0])}</b> <span class="muted">(${esc(fb[1])})</span><p style="margin-top:6px">${esc(fb[4])}</p><p class="muted" style="font-size:13.5px;margin-top:6px">Normal job of the target: ${esc(D.targets[fb[2]][3])}</p></div>` : ''}
        ${S.done.size < S.set.length ? `<div class="rc-tray">${S.set.map((d, i) => `<button type="button" class="rc-pill${S.done.has(i) ? ' gone' : ''}${S.sel === i ? ' sel' : ''}" data-rc-d="${i}">${esc(d[0])}</button>`).join('')}</div>` : `<div class="lb-btns sticky"><button class="btn pri" data-rc-fin type="button">See score</button></div>`}`;
    }
    S.el.innerHTML = `<div class="lb rc">${h}</div>`;
  }
  function start() {
    const used = new Set(), set = [];
    for (const d of L.shuffle(D.drugs)) { if (used.has(d[2])) continue; used.add(d[2]); set.push(d); if (set.length === 4) break; }
    const extra = L.shuffle(Object.keys(D.targets).filter(k => !used.has(k))).slice(0, 2);
    S.set = set; S.tg = L.shuffle([...used].concat(extra)); S.done = new Set(); S.hits = {}; S.wrong = new Set(); S.sel = null; S.fb = null; S.first = 0; S.mode = 'play'; paint(); window.scrollTo(0, 0);
  }
  function drop(i, k) {
    const d = S.set[i]; if (!d || S.done.has(i)) return;
    if (d[2] === k) {
      S.done.add(i); S.hits[k] = d; S.fb = d; S.sel = null; if (!S.wrong.has(i)) S.first++; L.fx(true);
      L.mastery({ id: 'RC:' + d[0], tags: ['pharmacology'], ok: !S.wrong.has(i), choices: 6, label: d[0] + ' → ' + D.targets[k][0], src: 'receptor' });
      const y = window.scrollY; paint(); window.scrollTo(0, y);
    } else {
      S.wrong.add(i); try { Prefs.sound('bad'); } catch (e) {}
      const el = S.el.querySelector(`[data-rc-t="${k}"]`); if (el) { el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 400); }
    }
  }
  function finish() { S.score = Math.round(100 * S.first / S.set.length); S.mode = 'end'; L.result('receptor', 'day-' + new Date().toISOString().slice(0, 10), S.score); L.award('receptor', 2 * S.first); paint(); window.scrollTo(0, 0); }
  function tgAt(x, y) { const e = document.elementFromPoint(x, y); return e && e.closest && e.closest('[data-rc-t]'); }
  function onDown(e) {
    const p = e.target.closest('[data-rc-d]'); if (!p || !S || S.mode !== 'play') return;
    drag = { i: +p.dataset.rcD, x0: e.clientX, y0: e.clientY, moved: false, g: null, over: null, src: p };
    try { p.setPointerCapture(e.pointerId); } catch (er) {}
    const mv = ev => {
      if (!drag) return; const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      if (!drag.moved) { drag.moved = true; const g = p.cloneNode(true); g.classList.add('rc-ghost'); g.removeAttribute('data-rc-d'); document.body.appendChild(g); drag.g = g; p.style.opacity = '.35'; }
      ev.preventDefault(); drag.g.style.left = ev.clientX + 'px'; drag.g.style.top = ev.clientY + 'px';
      const t = tgAt(ev.clientX, ev.clientY); if (drag.over && drag.over !== t) drag.over.classList.remove('over'); if (t) t.classList.add('over'); drag.over = t;
    };
    const upf = ev => {
      p.removeEventListener('pointermove', mv); p.removeEventListener('pointerup', upf); p.removeEventListener('pointercancel', upf);
      const d = drag; drag = null; if (!d) return;
      if (d.g) d.g.remove(); p.style.opacity = '';
      if (d.over) d.over.classList.remove('over');
      if (d.moved) { const t = tgAt(ev.clientX, ev.clientY); if (t) drop(d.i, t.dataset.rcT); S.__noclick = Date.now(); }
    };
    p.addEventListener('pointermove', mv); p.addEventListener('pointerup', upf); p.addEventListener('pointercancel', upf);
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-rc-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-rc-list]')) { S.mode = 'list'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-rc-start]')) { start(); return; }
    if (t.closest('[data-rc-fin]')) { finish(); return; }
    if (S.mode !== 'play' || (S.__noclick && Date.now() - S.__noclick < 350)) return;
    const d = t.closest('[data-rc-d]'); if (d) { const i = +d.dataset.rcD; S.sel = S.sel === i ? null : i; const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    const g = t.closest('[data-rc-t]'); if (g && S.sel != null) { drop(S.sel, g.dataset.rcT); return; }
  }
  window.LabMods.receptor = { render, _S: () => S, drop };
})();
