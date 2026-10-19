/* ECG strip trainer: rhythm strips drawn as SVG from a small waveform model (6 s, 25 mm/s, 10 mm/mV), fresh parameters every time. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  const G = (t, c, w, a) => a * Math.exp(-((t - c) * (t - c)) / (2 * w * w));
  const rnd = (a, b) => a + Math.random() * (b - a);
  // one beat centred on the R wave at time r
  function qrs(t, r, o) {
    o = o || {}; const wide = o.wide || 0, amp = o.amp || 1.1;
    let v = 0;
    if (!wide) { v += G(t, r - 0.022, 0.008, -0.12) + G(t, r, 0.011, amp) + G(t, r + 0.026, 0.01, -0.28); }
    else { v += G(t, r - 0.03, 0.03, amp * (o.inv ? -0.4 : 0.35)) + G(t, r + 0.02, 0.035, amp * (o.inv ? 1.1 : -0.9)) + G(t, r + 0.07, 0.03, amp * (o.inv ? -0.2 : 0.4)); }
    if (o.st) v += o.st * (1 / (1 + Math.exp(-(t - r - 0.04) / 0.012))) * (1 / (1 + Math.exp((t - r - 0.24) / 0.03)));
    const tw = o.tAmp != null ? o.tAmp : 0.28, tc = r + (o.qt || 0.3), tWid = o.tW || 0.055;
    if (tw) v += G(t, tc, tWid, wide && !o.keepT ? -Math.abs(tw) * 1.4 : tw);
    return v;
  }
  const P = (t, c, a) => G(t, c, 0.025, a == null ? 0.14 : a);
  function beatsSum(t, list) { let v = 0; for (const b of list) if (Math.abs(t - b.r) < 0.7) v += b.f(t); return v; }
  function wander(t, k) { return 0.03 * Math.sin(2 * Math.PI * 0.25 * t + k) + (Math.random() - 0.5) * 0.012; }
  // ---------- rhythms ----------
  function sinus(rr, o) {
    o = o || {}; const list = [], pr = o.pr || 0.16, start = rnd(0.2, rr);
    for (let r = start; r < 6.6; r += rr * rnd(0.97, 1.03)) list.push({ r, f: t => P(t, r - pr + 0.03, o.pAmp) + qrs(t, r, o) });
    return list;
  }
  const R = {
    nsr: { name: 'Normal sinus rhythm', gen: () => sinus(rnd(0.75, 0.95)), info: ['Rate 60–100', 'Regular', 'A P wave before every QRS', 'PR 0.12–0.20 s', 'Narrow QRS (<0.12 s)'], why: 'Every beat starts in the sinus node: upright P, then a narrow QRS after a normal PR interval, at 60–100 per minute.', tx: 'Nothing to treat.' },
    brady: { name: 'Sinus bradycardia', gen: () => sinus(rnd(1.25, 1.6)), info: ['Rate < 60', 'Regular', 'Normal P before each QRS', 'Normal PR', 'Narrow QRS'], why: 'Normal-looking sinus beats, just slow. Normal in athletes and during sleep; also from beta-blockers, hypothyroidism, raised intracranial pressure (Cushing reflex) or an ageing sinus node.', tx: 'Only if symptomatic: treat the cause; atropine (anticholinergic) or pacing if unstable.' },
    tachy: { name: 'Sinus tachycardia', gen: () => sinus(rnd(0.46, 0.56), { pr: 0.13 }), info: ['Rate 100–150', 'Regular', 'P waves present (may merge with T)', 'Normal PR', 'Narrow QRS'], why: 'Sinus node firing fast in response to something: fever, pain, dehydration, blood loss, anxiety, PE, hyperthyroidism. It speeds up and slows down gradually.', tx: 'Treat the cause, not the rhythm.' },
    afib: { name: 'Atrial fibrillation', gen: () => { const list = []; let r = rnd(0.1, 0.4); const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6)]; while (r < 6.6) { const rr = rnd(0.42, 1.05); const rr0 = r; list.push({ r: rr0, f: t => qrs(t, rr0) }); r += rr; } list.fib = t => 0.045 * Math.sin(2 * Math.PI * 6.1 * t + ph[0]) + 0.035 * Math.sin(2 * Math.PI * 7.7 * t + ph[1]) + 0.025 * Math.sin(2 * Math.PI * 4.9 * t + ph[2]); return list; }, info: ['Rate often 100–160', 'Irregularly irregular', 'No P waves, wavy baseline', 'No PR interval', 'Narrow QRS'], why: 'Chaotic electrical activity in the atria (often from the pulmonary veins) replaces P waves with a fibrillating baseline. The AV node lets impulses through at random, so the beats are irregularly irregular.', tx: 'Rate control (beta-blockers, non-dihydropyridine calcium channel blockers), rhythm control (cardioversion, antiarrhythmics) and stroke prevention with anticoagulants.' },
    flutter: { name: 'Atrial flutter', gen: () => { const ratio = Math.random() < 0.5 ? 2 : 4, F = 0.2, off = rnd(0, 0.2); const list = []; for (let k = 0; ; k++) { const r = off + k * F * ratio + 0.12; if (r > 6.6) break; list.push({ r, f: t => qrs(t, r, { tAmp: 0.15 }) }); } list.fib = t => { const x = ((t - off) / F) % 1, y = x < 0 ? x + 1 : x; return -0.22 * (y < 0.75 ? y / 0.75 : (1 - y) / 0.25) + 0.11; }; list.ratio = ratio; return list; }, info: ['Atrial rate ~300', 'Ventricular rate often 150 (2:1) or 75 (4:1)', 'Sawtooth flutter waves', 'Regular', 'Narrow QRS'], why: 'A big re-entry circuit spins around the right atrium (around the tricuspid valve) about 300 times a minute, making sawtooth F waves. The AV node blocks some, so you get 2:1 or 4:1 conduction. A regular rate of exactly ~150 should make you look for flutter.', tx: 'Rate control, cardioversion, anticoagulation; catheter ablation of the circuit is often curative.' },
    svt: { name: 'Supraventricular tachycardia (SVT)', gen: () => { const rr = rnd(0.3, 0.36); const list = []; for (let r = rnd(0.1, 0.3); r < 6.6; r += rr) list.push({ r, f: t => qrs(t, r, { tAmp: 0.22, qt: 0.2, tW: 0.04 }) }); return list; }, info: ['Rate 150–250', 'Very regular', 'P waves hidden or just after QRS', 'Narrow QRS'], why: 'Usually AV nodal re-entry: an extra pathway in or near the AV node makes a tiny loop, so the heart races suddenly at 150–250, perfectly regular, with narrow QRS and no visible P waves. Starts and stops abruptly.', tx: 'Vagal manoeuvres first, then adenosine (briefly blocks the AV node); synchronised cardioversion if unstable; ablation long-term.' },
    vt: { name: 'Ventricular tachycardia', gen: () => { const rr = rnd(0.33, 0.42); const list = []; for (let r = rnd(0.1, 0.3); r < 6.6; r += rr) list.push({ r, f: t => qrs(t, r, { wide: 1, amp: 1.5, tAmp: 0.5, qt: 0.26, tW: 0.07 }) }); return list; }, info: ['Rate 120–250', 'Regular', 'No P waves linked to QRS', 'Wide, bizarre QRS (>0.12 s)'], why: 'Rapid beats from a focus or scar circuit in the ventricle. Impulses spread muscle-to-muscle instead of through the fast conduction system, so the QRS is wide. Can degenerate into VF.', tx: 'Pulseless: CPR and defibrillation. With a pulse but unstable: synchronised cardioversion. Stable: antiarrhythmics (amiodarone class). Long term: implantable defibrillator.' },
    vf: { name: 'Ventricular fibrillation', gen: () => { const ph = [rnd(0, 6), rnd(0, 6), rnd(0, 6), rnd(0, 6)], a = rnd(0.35, 0.6); const list = []; list.fib = t => a * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t + ph[3])) * (0.55 * Math.sin(2 * Math.PI * 4.3 * t + ph[0]) + 0.35 * Math.sin(2 * Math.PI * 6.7 * t + ph[1]) + 0.25 * Math.sin(2 * Math.PI * 2.9 * t + ph[2])); return list; }, info: ['No organised rate', 'Chaotic', 'No P, QRS or T waves'], why: 'The ventricles quiver chaotically and pump no blood: cardiac arrest. Commonly from an acute heart attack.', tx: 'Immediate CPR and defibrillation (shock), then adrenaline (epinephrine) and antiarrhythmics per ACLS.' },
    av1: { name: 'First-degree AV block', gen: () => sinus(rnd(0.85, 1.0), { pr: rnd(0.28, 0.36) }), info: ['Rate normal', 'Regular', 'P before every QRS', 'PR > 0.20 s, constant', 'Narrow QRS'], why: 'Every impulse gets through, just slowly: the AV node delays conduction so the PR interval is long but constant. Often harmless (athletes, beta-blockers).', tx: 'Usually none; review AV-node-slowing drugs.' },
    mob1: { name: 'Second-degree AV block, Mobitz I (Wenckebach)', gen: () => { const pp = rnd(0.72, 0.82), prs = [0.16, 0.26, 0.34], list = []; let p = rnd(0.1, 0.3), k = 0; while (p < 6.6) { const i = k % 4, pc = p; if (i < 3) { const r = pc + prs[i] - 0.03 + 0.03; list.push({ r, f: t => P(t, pc) + qrs(t, r) }); } else list.push({ r: pc, f: t => P(t, pc) }); p += pp; k++; } return list; }, info: ['Atrial rate regular', 'Grouped beats', 'PR gets longer and longer…', '…until a P wave is not followed by a QRS', 'Narrow QRS'], why: 'The AV node gets progressively tired: each PR is longer than the one before until one P wave is blocked, then the cycle resets. Usually at the AV node, often benign (athletes, sleep, inferior MI).', tx: 'Often none; atropine or pacing if symptomatic.' },
    mob2: { name: 'Second-degree AV block, Mobitz II', gen: () => { const pp = rnd(0.72, 0.85), pr = 0.18, list = []; let p = rnd(0.1, 0.3), k = 0; const drop = Math.random() < 0.5 ? 3 : 4; while (p < 6.6) { const pc = p; if (k % drop !== drop - 1) { const r = pc + pr; list.push({ r, f: t => P(t, pc) + qrs(t, r, { wide: 0 }) }); } else list.push({ r: pc, f: t => P(t, pc) }); p += pp; k++; } return list; }, info: ['Atrial rate regular', 'PR constant', 'Sudden dropped QRS without warning', 'QRS often wide'], why: 'The block is below the AV node (His-Purkinje system). Conducted beats have the same PR, then suddenly a P wave isn\'t followed by a QRS. Dangerous: it can progress to complete heart block.', tx: 'Pacemaker (temporary, then permanent).' },
    av3: { name: 'Third-degree (complete) heart block', gen: () => { const pp = rnd(0.62, 0.75), rr = rnd(1.4, 1.75), list = []; for (let p = rnd(0.05, 0.4); p < 6.6; p += pp) { const pc = p; list.push({ r: pc, f: t => P(t, pc) }); } for (let r = rnd(0.3, 1.0); r < 6.6; r += rr) { const rc = r; list.push({ r: rc, f: t => qrs(t, rc, { wide: 1, amp: 1.0, tAmp: 0.35, qt: 0.32, tW: 0.07 }) }); } return list; }, info: ['P rate faster than QRS rate', 'Both regular but unrelated', 'PR varies at random', 'Slow escape rhythm (30–45), often wide'], why: 'No impulses cross from atria to ventricles. The atria keep their sinus rate; the ventricles are driven by a slow escape pacemaker, so P waves march through the QRS complexes with no relationship (AV dissociation).', tx: 'Pacing: transcutaneous right away if unstable, then a permanent pacemaker.' },
    pvc: { name: 'Sinus rhythm with PVCs', gen: () => { const rr = rnd(0.8, 0.92), list = []; let r = rnd(0.2, 0.5), k = 0; const every = Math.random() < 0.5 ? 3 : 4; while (r < 6.6) { const rc = r; if (k % every === every - 1) { const rp = rc - rr * 0.38; list.push({ r: rp, f: t => qrs(t, rp, { wide: 1, amp: 1.4, tAmp: 0.4, qt: 0.3, tW: 0.07 }) }); } else list.push({ r: rc, f: t => P(t, rc - 0.13) + qrs(t, rc) }); r += rr; k++; } return list; }, info: ['Underlying sinus rhythm', 'Early beats', 'Early beat is wide and bizarre, no P wave', 'T wave points the opposite way', 'Compensatory pause after'], why: 'A ventricular cell fires early, before the next sinus beat. The impulse spreads slowly through muscle, giving a wide, odd-shaped QRS with an opposite T wave, followed by a full compensatory pause. Common and usually benign; many in a row = VT.', tx: 'Usually reassurance; cut caffeine; treat low potassium/magnesium; beta-blockers if bothersome.' },
    stemi: { name: 'ST-elevation MI pattern', gen: () => sinus(rnd(0.7, 0.9), { st: rnd(0.32, 0.45), tAmp: 0.35, qt: 0.28, tW: 0.07 }), info: ['Usually sinus rhythm', 'ST segment raised above baseline', 'Tombstone or convex shape', 'In leads facing the infarct (reciprocal depression elsewhere)'], why: 'A blocked coronary artery causes full-thickness (transmural) ischemia. Injured cells change their resting potential, which lifts the ST segment in the leads over the injured wall. Single strips can only hint at it: a 12-lead ECG decides.', tx: 'Emergency reperfusion: PCI (stent) or thrombolytics; antiplatelets, anticoagulants, nitrates, beta-blockers, statins.' },
    hyperk: { name: 'Hyperkalemia (peaked T waves)', gen: () => sinus(rnd(0.75, 0.95), { tAmp: rnd(0.75, 0.95), tW: 0.03, qt: 0.26, pAmp: 0.07 }), info: ['Tall, narrow, peaked T waves', 'Flattened P waves', 'QRS widens as K⁺ rises', 'Can end in a sine-wave pattern'], why: 'High extracellular potassium speeds repolarisation (tall peaked T), then slows conduction (flat P, wide QRS) and can cause cardiac arrest. Causes: kidney failure, some drugs, tissue breakdown, DKA.', tx: 'Stabilise the heart with IV calcium, shift potassium into cells (insulin with glucose, inhaled beta-agonists), remove it (potassium binders, diuretics, dialysis).' }
  };
  const IDS = Object.keys(R);
  const SIM = { nsr: ['brady', 'tachy', 'av1'], brady: ['nsr', 'av1', 'av3'], tachy: ['svt', 'nsr', 'flutter'], afib: ['flutter', 'pvc', 'mob1'], flutter: ['afib', 'svt', 'tachy'], svt: ['tachy', 'flutter', 'vt'], vt: ['svt', 'vf', 'pvc'], vf: ['vt', 'afib', 'flutter'], av1: ['mob1', 'nsr', 'mob2'], mob1: ['mob2', 'av3', 'av1'], mob2: ['mob1', 'av3', 'av1'], av3: ['mob2', 'mob1', 'brady'], pvc: ['afib', 'vt', 'mob2'], stemi: ['hyperk', 'nsr', 'pvc'], hyperk: ['stemi', 'nsr', 'av1'] };
  // ---------- drawing ----------
  const PXS = 100, PXMV = 40, H = 140, BASE = 92; // 25 mm/s at 4 px/mm; 10 mm/mV
  function strip(list, t0, t1) {
    const W = (t1 - t0) * PXS; let d = '', k = Math.random() * 6;
    for (let i = 0; i <= W; i += 1) { const t = t0 + i / PXS; let v = beatsSum(t, list) + (list.fib ? list.fib(t) : 0) + wander(t, k); const y = BASE - v * PXMV; d += (i ? 'L' : 'M') + i + ' ' + y.toFixed(1); }
    let grid = '';
    for (let x = 0; x <= W; x += 4) grid += `<path d="M${x} 0V${H}" class="${x % 20 ? 'eg-s' : 'eg-b'}"/>`;
    for (let y = 0; y <= H; y += 4) grid += `<path d="M0 ${y}H${W}" class="${y % 20 ? 'eg-s' : 'eg-b'}"/>`;
    return `<svg class="eg-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="ECG strip">${grid}<path d="${d}" class="eg-line"/></svg>`;
  }
  function stripHTML(list) { return `<div class="eg-strip">${strip(list, 0, 3)}${strip(list, 3, 6)}<div class="eg-cap">6 s · 25 mm/s · each big box = 0.2 s · count QRS in 6 s × 10 = rate</div></div>`; }
  let S = null;
  function render(el) { S = { el, mode: 'menu' }; if (!el.__eg) { el.__eg = 1; el.addEventListener('click', onClick); } paint(); }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('ecg');
      h = L.top('ECG trainer', st ? `avg ${st.avg}%` : '', 'lab') + `<p class="muted lb-p">Name the rhythm. Every strip is freshly generated, so you can't memorise the picture, only the pattern. ${IDS.length} rhythms.</p>
        <div class="lb-card lz-intro"><b>Read every strip the same way</b><ul><li>Rate: QRS complexes in 6 s × 10.</li><li>Rhythm: regular, regularly irregular or irregularly irregular?</li><li>P waves: present? one per QRS?</li><li>PR interval: normal 3–5 small boxes, constant?</li><li>QRS: narrow (< 3 small boxes) or wide?</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-eg-start="10" type="button">Round of 10</button><button class="btn" data-eg-learn type="button">Learn the rhythms</button></div>`;
    } else if (S.mode === 'learn') {
      h = `<div class="lb-top"><button class="lb-back" type="button" data-eg-menu>${ic('back', 18)}<span>ECG</span></button><span class="lb-tr"></span></div><h2 class="lb-title">The ${IDS.length} rhythms</h2>` + IDS.map(k => `<div class="lb-card eg-learn"><h3>${esc(R[k].name)}</h3>${stripHTML(R[k].gen())}<ul>${R[k].info.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="small">${esc(R[k].why)}</p></div>`).join('');
    } else if (S.mode === 'end') {
      const pct = Math.round(100 * S.ok / S.q.length);
      h = `${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.ok}/${S.q.length}</div><div class="sim-verd ${pct >= 70 ? 'ok' : 'bad'}">${pct >= 70 ? 'Nice reading' : 'Keep practising'}</div></div>${S.miss.length ? `<div class="lb-card sim-sec"><h3>Review</h3><ul>${[...new Set(S.miss)].map(k => `<li>${esc(R[k].name)}</li>`).join('')}</ul></div>` : ''}<div class="lb-btns"><button class="btn" data-eg-menu type="button">Done</button><button class="btn pri" data-eg-start="10" type="button">Another round</button></div>`;
    } else {
      const k = S.q[S.i], done = S.ans != null, r = R[k];
      h = `${L.top('', `${S.i + 1} / ${S.q.length} · ${S.ok} right`, 'lab')}<div class="rx-bar lb-bar"><i style="width:${100 * S.i / S.q.length}%"></i></div>
        <div class="lb-card eg-card"><span class="lz-k">Name the rhythm</span>${S.strip}</div>
        <div class="sim-opts">${S.opts.map(o => `<button type="button" class="sim-o dx${done ? (o === k ? ' good' : o === S.ans ? ' badc' : '') : ''}" data-eg-opt="${o}" ${done ? 'disabled' : ''}><span class="sim-q">${esc(R[o].name)}</span></button>`).join('')}</div>
        ${done ? `<div class="lb-card lz-fb2 lb-anchor"><div class="lz-ans ${S.ans === k ? 'ok' : 'bad'}">${S.ans === k ? ic('check', 17) + ' Right' : ic('x', 17) + ' It\'s ' + esc(r.name)}</div><ul class="eg-crit">${r.info.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="lz-why">${esc(r.why)}</p><p class="lz-why muted"><b>Treatment:</b> ${esc(r.tx)}</p></div><button class="btn pri lb-wide" data-eg-next type="button">${S.i + 1 < S.q.length ? 'Next strip →' : 'See results'}</button>` : ''}`;
    }
    S.el.innerHTML = `<div class="lb eg">${h}</div>`;
    if (S.mode === 'play' && S.ans != null) { const a = S.el.querySelector('.lb-anchor'); if (a) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function prep() { const k = S.q[S.i]; S.ans = null; S.strip = stripHTML(R[k].gen()); S.opts = L.shuffle([k].concat(L.shuffle(SIM[k]).slice(0, 3))); S.t0 = Date.now(); }
  function start() { let q = L.shuffle(IDS).slice(0, 10); S.q = q; S.i = 0; S.ok = 0; S.miss = []; S.mode = 'play'; prep(); paint(); window.scrollTo(0, 0); }
  function onClick(e) {
    if (!S) return; const t = e.target;
    if (t.closest('[data-eg-start]')) { start(); return; }
    if (t.closest('[data-eg-learn]')) { S.mode = 'learn'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-eg-menu]')) { S.mode = 'menu'; paint(); return; }
    const o = t.closest('[data-eg-opt]'); if (o && S.ans == null) { const k = S.q[S.i], ok = o.dataset.egOpt === k; S.ans = o.dataset.egOpt; if (ok) S.ok++; else S.miss.push(k); L.result('ecg', k, ok ? 100 : 0); L.mastery({ id: 'ECG:' + k, tags: ['medicine'], ok, ms: Date.now() - S.t0, choices: 4, label: 'ECG: ' + R[k].name, src: 'ecg' }); L.fx(ok); paint(); return; }
    if (t.closest('[data-eg-next]')) { if (S.i + 1 < S.q.length) { S.i++; prep(); paint(); window.scrollTo(0, 0); } else { L.award('ecg', 2 * S.ok); S.mode = 'end'; paint(); window.scrollTo(0, 0); } return; }
  }
  window.LabMods.ecg = { render, R, stripHTML, _S: () => S };
})();
