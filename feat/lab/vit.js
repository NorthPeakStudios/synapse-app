/* Vitals interpreter: type a set of vital signs and see what each one means (adult ranges), plus MAP, shock index, qSOFA and a NEWS2 early-warning score. Pattern mode: read a set of vitals and pick the classic picture it fits. Teaching tool, not for real patients. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null;
  const DEF = { hr: 78, sbp: 120, dbp: 78, rr: 14, t: 37.0, spo2: 98, o2: false, conf: false, unit: 'C' };
  const PAT = [
    { id: 'sep', n: 'Septic shock', v: { hr: 124, sbp: 84, dbp: 46, rr: 26, t: 39.4, spo2: 93, conf: true }, why: 'Fever, fast heart and breathing, low pressure with a wide gap and confusion: infection with failing circulation (qSOFA 3).' },
    { id: 'hyp', n: 'Hypovolemic shock (bleeding)', v: { hr: 132, sbp: 82, dbp: 60, rr: 24, t: 36.2, spo2: 97 }, why: 'Fast heart, low pressure with a narrow gap, normal temperature: the tank is empty. Shock index above 1.' },
    { id: 'icp', n: 'Raised intracranial pressure (Cushing triad)', v: { hr: 48, sbp: 188, dbp: 92, rr: 8, t: 37.1, spo2: 95, conf: true }, why: 'High blood pressure with a wide gap, slow heart and slow, irregular breathing: the brain is being squeezed. A neurosurgical emergency.' },
    { id: 'ana', n: 'Anaphylaxis', v: { hr: 128, sbp: 78, dbp: 40, rr: 28, t: 36.9, spo2: 90 }, why: 'Sudden low pressure, fast heart, fast breathing and low oxygen right after an exposure: mast cells dumping histamine. IM epinephrine first.' },
    { id: 'pe', n: 'Pulmonary embolism', v: { hr: 118, sbp: 112, dbp: 72, rr: 26, t: 37.6, spo2: 89 }, why: 'Fast heart and breathing with low oxygen but a clear story of a long trip or a swollen leg; pressure holds until the clot is huge.' },
    { id: 'dka', n: 'Diabetic ketoacidosis', v: { hr: 116, sbp: 104, dbp: 64, rr: 30, t: 37.0, spo2: 99 }, why: 'Deep, fast breathing (Kussmaul) with normal oxygen: the lungs are blowing off CO₂ to fight acid. Dehydration speeds the heart.' },
    { id: 'heat', n: 'Heat stroke', v: { hr: 136, sbp: 96, dbp: 58, rr: 28, t: 41.2, spo2: 97, conf: true }, why: 'Core temperature above 40 °C with confusion. Cool first, fast.' },
    { id: 'cold', n: 'Hypothermia', v: { hr: 46, sbp: 96, dbp: 60, rr: 9, t: 32.4, spo2: 95, conf: true }, why: 'Everything slows down as the body cools: slow heart, slow breathing, confusion.' },
    { id: 'pain', n: 'Pain or anxiety (no shock)', v: { hr: 108, sbp: 148, dbp: 92, rr: 22, t: 37.0, spo2: 99 }, why: 'Sympathetic surge: fast heart and higher pressure, but oxygen and perfusion are fine.' },
    { id: 'htn', n: 'Hypertensive emergency', v: { hr: 92, sbp: 214, dbp: 128, rr: 18, t: 37.0, spo2: 97 }, why: 'Pressure above 180/120 with organ damage signs (headache, vision, chest pain). Lower it carefully, not to normal at once.' }
  ];
  function render(el) {
    S = { el, v: Object.assign({}, DEF, JSON.parse(localStorage.getItem('vit.v') || '{}')), mode: 'read', q: null, n: 0, right: 0 };
    if (!el.__vt) { el.__vt = 1; el.addEventListener('click', onClick); el.addEventListener('change', onChange); }
    paint();
  }
  const band = (x, b) => { for (const [max, s] of b) if (x <= max) return s; return b[b.length - 1][1]; };
  function news(v) {
    const rr = band(v.rr, [[8, 3], [11, 1], [20, 0], [24, 2], [1e9, 3]]), sp = band(v.spo2, [[91, 3], [93, 2], [95, 1], [1e9, 0]]), o2 = v.o2 ? 2 : 0;
    const sb = band(v.sbp, [[90, 3], [100, 2], [110, 1], [219, 0], [1e9, 3]]), hr = band(v.hr, [[40, 3], [50, 1], [90, 0], [110, 1], [130, 2], [1e9, 3]]);
    const cs = v.conf ? 3 : 0, tp = band(v.t, [[35, 3], [36, 1], [38, 0], [39, 1], [1e9, 2]]);
    const parts = { rr, sp, o2, sb, hr, cs, tp }, tot = Object.values(parts).reduce((a, b) => a + b, 0), any3 = Object.values(parts).some(x => x === 3);
    return { tot, parts, risk: tot >= 7 ? 'high' : tot >= 5 ? 'medium' : any3 ? 'low–medium (one red score)' : 'low' };
  }
  function flags(v) {
    const f = [];
    const hr = v.hr < 60 ? ['low', 'Bradycardia (under 60)'] : v.hr > 100 ? ['high', 'Tachycardia (over 100)'] : ['ok', 'Normal (60–100)']; f.push(['Heart rate', v.hr + ' /min', ...hr]);
    const bp = v.sbp >= 180 || v.dbp >= 120 ? ['high', 'Hypertensive crisis range (≥180/120)'] : v.sbp >= 130 || v.dbp >= 80 ? ['high', 'High'] : v.sbp < 90 ? ['low', 'Hypotension (systolic under 90)'] : ['ok', 'Normal (under 130/80)']; f.push(['Blood pressure', v.sbp + '/' + v.dbp, ...bp]);
    const rr = v.rr < 12 ? ['low', 'Slow (under 12)'] : v.rr > 20 ? ['high', 'Tachypnea (over 20)'] : ['ok', 'Normal (12–20)']; f.push(['Breathing', v.rr + ' /min', ...rr]);
    const tc = v.t, ts = tc < 35 ? ['low', 'Hypothermia (under 35 °C)'] : tc >= 40 ? ['high', 'Hyperthermia (40 °C and up)'] : tc >= 38 ? ['high', 'Fever (38 °C and up)'] : ['ok', 'Normal']; f.push(['Temperature', S.v.unit === 'F' ? (tc * 9 / 5 + 32).toFixed(1) + ' °F' : tc.toFixed(1) + ' °C', ...ts]);
    const sp = v.spo2 < 90 ? ['low', 'Low (under 90%): needs oxygen'] : v.spo2 < 95 ? ['low', 'A bit low (90–94%)'] : ['ok', 'Normal (95–100%)']; f.push(['Oxygen (SpO₂)', v.spo2 + '%', ...sp]);
    return f;
  }
  function derived(v) {
    const map = Math.round((v.sbp + 2 * v.dbp) / 3), si = v.hr / v.sbp, pp = v.sbp - v.dbp;
    const q = (v.rr >= 22 ? 1 : 0) + (v.sbp <= 100 ? 1 : 0) + (v.conf ? 1 : 0);
    return { map, si, pp, q };
  }
  const C = { ok: '#30a46c', low: '#4c9aff', high: '#e5484d' };
  function readout(v) {
    const d = derived(v), n = news(v);
    let h = `<div class="lb-group">${flags(v).map(([k, val, s, w]) => `<div class="lb-row"><span class="lb-rt"><span class="t1">${k}: <b>${esc(val)}</b></span><span class="t2" style="color:${C[s]}">${esc(w)}</span></span></div>`).join('')}</div>`;
    h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0">
      <div class="lb-card" style="padding:8px"><b>MAP ${d.map}</b><div class="muted small">${d.map < 65 ? '<span style="color:#e5484d">under 65: organs underfed</span>' : 'mean arterial pressure (aim ≥65)'}</div></div>
      <div class="lb-card" style="padding:8px"><b>Shock index ${d.si.toFixed(2)}</b><div class="muted small">${d.si > 1 ? '<span style="color:#e5484d">over 1: think shock</span>' : 'heart rate ÷ systolic (normal 0.5–0.7)'}</div></div>
      <div class="lb-card" style="padding:8px"><b>Pulse pressure ${d.pp}</b><div class="muted small">${d.pp > 60 ? 'wide' : d.pp < 25 ? 'narrow' : 'normal'} (systolic − diastolic)</div></div>
      <div class="lb-card" style="padding:8px"><b>qSOFA ${d.q}/3</b><div class="muted small">${d.q >= 2 ? '<span style="color:#e5484d">2+: high sepsis risk if infected</span>' : 'breathing ≥22, systolic ≤100, confusion'}</div></div></div>`;
    h += `<div class="lb-card" style="padding:10px"><b>NEWS2 score ${n.tot}</b> · <span style="color:${n.tot >= 7 ? C.high : n.tot >= 5 ? '#f2c14e' : C.ok}">${esc(n.risk)} risk</span><div class="muted small" style="margin-top:4px">The UK early-warning score nurses use to decide how fast a doctor must come. 5+ = urgent review, 7+ = emergency team.</div></div>`;
    return h;
  }
  function num(k, label, min, max, step) { const v = S.v[k]; const shown = k === 't' && S.v.unit === 'F' ? +(v * 9 / 5 + 32).toFixed(1) : v; return `<label style="display:block"><span class="muted small">${label}</span><input type="number" inputmode="decimal" data-vt="${k}" value="${shown}" min="${min}" max="${max}" step="${step}" style="width:100%;font-size:18px;padding:8px;border-radius:10px"></label>`; }
  function paint() {
    if (!S || !S.el.isConnected) return; const v = S.v;
    let h = L.top('Vitals interpreter', S.n ? `${S.right}/${S.n}` : '', 'lab');
    h += `<div class="at-tabs"><button type="button" data-vt-mode="read" class="${S.mode === 'read' ? 'on' : ''}">Read vitals</button><button type="button" data-vt-mode="quiz" class="${S.mode === 'quiz' ? 'on' : ''}">Name the pattern</button></div>`;
    if (S.mode === 'read') {
      h += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0">${num('hr', 'Heart rate', 20, 250, 1)}${num('sbp', 'Systolic', 40, 280, 1)}${num('dbp', 'Diastolic', 20, 180, 1)}${num('rr', 'Breaths/min', 4, 60, 1)}${num('t', 'Temp °' + v.unit, 25, 115, 0.1)}${num('spo2', 'SpO₂ %', 50, 100, 1)}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px"><label><input type="checkbox" data-vt-c="conf" ${v.conf ? 'checked' : ''}> New confusion</label><label><input type="checkbox" data-vt-c="o2" ${v.o2 ? 'checked' : ''}> On oxygen</label><label><input type="checkbox" data-vt-c="unit" ${v.unit === 'F' ? 'checked' : ''}> °F</label></div>`;
      h += readout(v);
    } else {
      if (!S.q) newQ(); const q = S.q, pv = Object.assign({ conf: false, o2: false }, q.p.v);
      h += `<div class="lb-card" style="margin-top:12px"><p style="margin:0;font-size:17px;line-height:1.6">HR <b>${pv.hr}</b> · BP <b>${pv.sbp}/${pv.dbp}</b> · RR <b>${pv.rr}</b><br>Temp <b>${pv.t.toFixed(1)} °C</b> · SpO₂ <b>${pv.spo2}%</b>${pv.conf ? ' · <b>confused</b>' : ''}</p></div>`;
      h += `<div style="display:grid;gap:8px;margin:12px 0">${q.opts.map(o => `<button type="button" class="btn ${q.ans ? (o.id === q.p.id ? 'pri' : o.id === q.ans ? 'bad' : '') : ''}" data-vt-a="${o.id}" ${q.ans ? 'disabled' : ''} style="text-align:left;justify-content:flex-start">${esc(o.n)}</button>`).join('')}</div>`;
      if (q.ans) { const tmp = S.v; S.v = Object.assign({}, pv, { unit: 'C' }); h += `<p class="sim-verd ${q.ans === q.p.id ? 'ok' : 'bad'}">${q.ans === q.p.id ? 'Right!' : 'It was: ' + esc(q.p.n)}</p><div class="lb-card"><p class="lb-why">${esc(q.p.why)}</p></div>` + readout(pv) + `<div class="lb-btns"><button class="btn pri" data-vt-next type="button">Next</button></div>`; S.v = tmp; }
    }
    h += `<p class="lb-foot">Adult resting ranges. A teaching tool, not for real patients.</p>`;
    S.el.innerHTML = `<div class="lb vt">${h}</div>`;
  }
  function newQ() { const p = PAT[Math.floor(Math.random() * PAT.length)]; const o = L.shuffle([p, ...L.shuffle(PAT.filter(x => x.id !== p.id)).slice(0, 3)]); S.q = { p, opts: o, ans: null }; }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const m = t.closest('[data-vt-mode]'); if (m) { S.mode = m.dataset.vtMode; paint(); return; }
    const a = t.closest('[data-vt-a]'); if (a && S.q && !S.q.ans) { S.q.ans = a.dataset.vtA; const ok = S.q.ans === S.q.p.id; S.n++; if (ok) S.right++; L.fx(ok); L.result('vit', S.q.p.id, ok ? 100 : 0); L.award('vit', ok ? 2 : 0); L.mastery({ id: 'VIT:' + S.q.p.id, tags: ['vitals'], ok, choices: 4, label: S.q.p.n, src: 'vit' }); paint(); return; }
    if (t.closest('[data-vt-next]')) { S.q = null; paint(); window.scrollTo(0, 0); return; }
  }
  function onChange(e) {
    const n = e.target.closest('[data-vt]'), c = e.target.closest('[data-vt-c]'); if (!n && !c) return;
    if (n) { let x = parseFloat(n.value); if (isNaN(x)) return; if (n.dataset.vt === 't' && S.v.unit === 'F') x = (x - 32) * 5 / 9; S.v[n.dataset.vt] = x; }
    if (c) { if (c.dataset.vtC === 'unit') S.v.unit = c.checked ? 'F' : 'C'; else S.v[c.dataset.vtC] = c.checked; }
    localStorage.setItem('vit.v', JSON.stringify(S.v)); const y = window.scrollY; paint(); window.scrollTo(0, y);
  }
  window.LabMods.vit = { render, news, derived, _S: () => S };
})();
