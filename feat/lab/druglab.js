/* Drug Lab: design a new drug (disease → target → action → molecule sliders → name) and take it through preclinical, Phase 1–3 and approval.
   Transparent teaching model with ABSTRACT exposure levels only (1–10, low/medium/high). No real doses. Pipeline saved on-device + synced (progress record lab:druglab). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2();
  let D = null, S = null;
  const KEY = 'druglab.v1';
  let P = (() => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.list) return o; } catch (e) {} return { list: [], at: 0 }; })();
  function saveP() { P.at = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} try { if (typeof write === 'function' && typeof M !== 'undefined' && M.progress) write([['progress', { id: 'lab:druglab', t: 'lab', data: P, at: P.at, del: 0 }]]); } catch (e) {} }
  function pullP() { try { const o = typeof M !== 'undefined' && M.progress && M.progress.get('lab:druglab'); if (o && o.data && o.data.list) { const have = new Set(P.list.map(x => x.id)); let ch = false; for (const x of o.data.list) if (!have.has(x.id)) { P.list.push(x); ch = true; } if (ch) { P.list.sort((a, b) => b.at - a.at); try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) {} } } } catch (e) {} }
  const ACT = { agonist: 'Agonist (switch ON)', antagonist: 'Antagonist (block)', inhibitor: 'Inhibitor', blocker: 'Channel blocker', modulator: 'Positive modulator' };
  const ROUTE = { cyp3a4: 'Liver (CYP3A4)', cyp2d6: 'Liver (CYP2D6)', kidney: 'Kidney (unchanged in urine)' };
  const SL = [['p', 'Potency', 'How tightly it binds the target'], ['s', 'Selectivity', 'Hits only its target vs. look-alikes'], ['l', 'Lipophilicity', 'Greasiness: crosses membranes and the blood-brain barrier'], ['h', 'Half-life', 'How long it lasts in the body'], ['b', 'Oral bioavailability', 'How much of a swallowed pill reaches the blood']];
  const HL = [1, 2, 3, 4, 6, 8, 12, 18, 24, 36];
  const COST = { pre: [6, 1], p1: [25, 1.5], p2: [60, 2], p3: [250, 3] };
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sig = x => 1 / (1 + Math.exp(-x));
  function actionsFor(t) { const k = D.targets[t][1], st = D.targets[t][6]; if (k === 'receptor') { const a = ['agonist', 'antagonist']; if (st.modulator) a.push('modulator'); return a; } if (k === 'channel') return ['blocker']; return ['inhibitor']; }
  function stemOf(t, a) { const s = D.targets[t] && D.targets[t][6][a]; return s ? s : ['', 'No standard stem for this kind of drug, so any name works.']; }
  const SYL = ['Ox', 'Lu', 'Tra', 'Ven', 'Zor', 'Mi', 'Cal', 'Dar', 'Fen', 'Ri', 'Sol', 'Ne', 'Vi', 'Ka', 'Bel', 'Tor', 'Ala', 'Odi', 'Qua', 'Ze', 'Pra', 'Ser', 'Lo', 'Ty'];
  function genName(t, a, r) {
    let st = stemOf(t, a)[0].replace(/\(.*?\)/g, '').split('/')[0].trim();
    if (!st || !st.startsWith('-')) st = ['-adine', '-orin', '-axil', '-enor'][Math.floor(r() * 4)];
    st = st.slice(1); const pre = SYL[Math.floor(r() * SYL.length)] + (r() < .5 ? SYL[Math.floor(r() * SYL.length)].toLowerCase() : '');
    const vow = /[aeiou]$/i.test(pre) && /^[aeiou]/i.test(st) ? pre.slice(0, -1) : pre;
    return vow + st;
  }
  /* ---------- the model ---------- */
  function fitOf(d) {
    const z = D.diseases.find(x => x.id === d.dz), g = z.good[d.t], b = z.bad[d.t];
    if (g && g[0] === d.a) return { f: g[1], why: g[2] };
    if (b && b[0] === d.a) return { f: b[1], why: b[2] };
    if (g && D.targets[d.t][1] === 'receptor' && g[0] !== d.a) return { f: -0.35, why: `This target is right, but ${d.a === 'agonist' ? 'switching it ON' : 'blocking it'} pushes the wrong way: the drug that works here is ${g[0] === 'agonist' ? 'an agonist' : g[0] === 'modulator' ? 'a positive modulator' : 'an antagonist'}.` };
    return { f: 0, why: `${D.targets[d.t][0]} doesn't drive ${z.name.toLowerCase()}, so hitting it can't fix the disease.` };
  }
  function brain(l) { return l >= 7 ? 'high' : l >= 4 ? 'moderate' : 'low'; }
  function expo(d, lvl, mods) { let bio = d.b / 10; if (d.l <= 2) bio *= .55; if (d.l >= 9) bio *= .8; return clamp(Math.round(10 * bio * ({ low: .7, med: 1, high: 1.3 }[lvl || 'med'])) + (mods || 0), 1, 10); }
  function dosing(h) { const hl = HL[h - 1]; return hl < 4 ? '3–4 times a day' : hl < 8 ? 'twice a day' : 'once a day'; }
  function core(d, E) {
    const z = D.diseases.find(x => x.id === d.dz), T = D.targets[d.t], F = fitOf(d), be = brain(d.l);
    const needBrain = z.cns === 'need' || T[3];
    const cnsF = needBrain ? { low: .2, moderate: .7, high: 1 }[be] : 1;
    const adh = z.chronic && HL[d.h - 1] < 4 ? .8 : 1;
    const pf = .35 + .65 * sig((d.p - 5) * .7 + (E - 5) * .5);
    const eff = clamp(F.f * pf * cnsF * adh, -1, 1);
    const resp = eff >= 0 ? z.plac + (z.mx - z.plac) * eff : Math.max(0, z.plac * (1 + eff));
    const ae = [], sc = E / 6;
    const offR = (d.s <= 3 ? (4 - d.s) * 7 : d.s <= 5 ? 3 : 1) * sc; ae.push({ n: T[4][0], r: offR, why: T[4][1] + (d.s <= 3 ? ' (Selectivity is low.)' : '') });
    const onR = (Math.max(0, d.p + E - 12) * 4 + 2) * (F.f > 0 ? 1 : .5); const onSer = /QT|[Bb]leeding|breathing|hypoglyc|rhythm/.test(T[5][0]);
    ae.push({ n: T[5][0], r: onR, why: T[5][1] + (d.p + E > 14 ? ' (High potency × high exposure = too much target effect.)' : ''), ser: onSer && onR >= 6 });
    if (be === 'high' && !needBrain) ae.push({ n: 'Drowsiness, dizziness', r: (d.l - 6) * 5 * sc, why: 'High lipophilicity carries the drug across the blood-brain barrier even though the disease isn\'t in the brain.' });
    if (d.l >= 8) { const r = (d.l - 7) * 2.6 * sc; ae.push({ n: 'QT prolongation on ECG', r, why: 'Very greasy molecules tend to stick in the heart\'s hERG potassium channel, delaying repolarisation (long QT, risk of torsades).', ser: r >= 6 }); }
    if (d.r !== 'kidney' && d.l >= 8) { const r = (d.l - 7) * 3 * sc; ae.push({ n: 'Raised liver enzymes', r, why: 'Heavy liver (CYP) metabolism of a very lipophilic drug can form reactive metabolites that stress liver cells.', ser: r >= 8 }); }
    if (eff < 0) ae.push({ n: 'Disease got worse', r: -eff * 35, why: F.why, ser: -eff * 35 >= 10 });
    if (d.l <= 2) ae.push({ n: 'Poor absorption (variable levels)', r: 4, why: 'Very polar molecules barely cross the gut wall, so blood levels are low and patchy.' });
    ae.forEach(x => { x.r = clamp(Math.round(x.r * 10) / 10, 0, 80); });
    return { z, T, F, be, needBrain, cnsF, adh, pf, eff, resp, ae, E };
  }
  function binom(r, n, p) { // normal approx with noise
    const m = n * p, sd = Math.sqrt(Math.max(n * p * (1 - p), .5)); let u = 0; for (let i = 0; i < 6; i++) u += r(); u = (u - 3) / Math.sqrt(.5); return clamp(Math.round(m + u * sd * .6), 0, n);
  }
  function runPre(d) {
    const c = core(d, expo(d)), notes = [], warns = []; let pass = true;
    notes.push(`Target fit: ${c.F.why}`);
    if (c.F.f === 0) { pass = false; notes.push('Result: no effect in disease models. Pick a target that actually drives the disease.'); }
    if (c.F.f < 0) { pass = false; notes.push('Result: disease models got WORSE. Trial stopped before people.'); }
    if (d.p <= 2) warns.push('Binding is weak (potency 1–2): needs high exposure to work.');
    if (c.needBrain && c.be === 'low') warns.push('This drug must act in the brain, but low lipophilicity means it barely crosses the blood-brain barrier.');
    if (d.l >= 9) warns.push('hERG channel assay flagged: very lipophilic molecules often prolong QT.');
    if (d.l <= 2) warns.push('Gut absorption assay: very polar, poor oral uptake.');
    if (d.b <= 2) warns.push('Low oral bioavailability: most of each pill never reaches the blood (first-pass metabolism).');
    return { pass, notes, warns, c };
  }
  function runP1(d, seed) {
    const r = rng(seed), lv = {}, notes = []; let mtl = null;
    for (const k of ['low', 'med', 'high']) {
      const c = core(d, expo(d, k)), n = 24, ser = c.ae.filter(x => x.ser && x.r >= 6), tot = c.ae.reduce((s, x) => s + x.r, 0);
      const evs = c.ae.map(x => ({ n: x.n, k: binom(r, n, x.r / 100), why: x.why, ser: x.ser }));
      lv[k] = { E: c.E, evs, ser: ser.length > 0, tot };
      if (!ser.length && tot <= 45) mtl = k;
    }
    notes.push(`Half-life about ${HL[d.h - 1]} h → dosing ${dosing(d.h)}${HL[d.h - 1] >= 24 ? '; it takes days to reach steady state and side effects linger after stopping' : ''}.`);
    notes.push(`Brain entry: ${brain(d.l)} (lipophilicity ${d.l}/10). Cleared by: ${ROUTE[d.r]}.`);
    if (!mtl) { const s = (lv.low.evs.find(x => x.ser) || lv.low.evs.slice().sort((a, b) => b.k - a.k)[0]); notes.push(`Serious adverse event, trial paused: ${s.n} even at the LOW exposure level. ${s.why}`); }
    else notes.push(`Highest well-tolerated exposure level: ${mtl === 'med' ? 'medium' : mtl}.`);
    return { lv, mtl, pass: !!mtl, notes };
  }
  function runP2(d, seed, mtl) {
    const r = rng(seed + 7), n = 40, z = D.diseases.find(x => x.id === d.dz), arms = [], notes = [];
    const pl = binom(r, n, z.plac / 100); arms.push({ k: 'placebo', pct: Math.round(100 * pl / n) });
    for (const k of ['low', 'med', 'high']) { if (k === 'high' && mtl !== 'high') continue; if (k === 'med' && mtl === 'low') continue; const c = core(d, expo(d, k)); const x = binom(r, n, c.resp / 100); arms.push({ k, pct: Math.round(100 * x / n), c }); }
    const best = arms.slice(1).sort((a, b) => b.pct - a.pct)[0], diff = best.pct - arms[0].pct, c = best.c;
    notes.push(`Best level: ${best.k === 'med' ? 'medium' : best.k}, ${best.pct}% ${z.end} vs ${arms[0].pct}% on placebo.`);
    if (c.needBrain && c.be !== 'high') notes.push(`Only ${c.be} brain entry, so effect was ${c.be === 'low' ? 'strongly ' : ''}limited.`);
    if (c.adh < 1) notes.push('Short half-life meant dosing 3–4 times a day; patients missed doses (adherence ↓).');
    if (c.pf < .55) notes.push('Potency × exposure was on the low side: not enough target occupancy.');
    const pass = diff >= 10;
    if (!pass) notes.push('No clear benefit over placebo. Trial stopped for futility.');
    return { arms, pass, notes, diff };
  }
  const MEDS = [['none', 0, ''], ['clarithromycin', 1, 'cyp3a4+'], ['grapefruit juice daily', 1, 'cyp3a4+g'], ['rifampin', 1, 'cyp3a4-'], ['fluoxetine', 1, 'cyp2d6+'], ['none', 0, ''], ['none', 0, '']];
  function runP3(d, seed, lvl) {
    const r = rng(seed + 13), n = 300, z = D.diseases.find(x => x.id === d.dz), c = core(d, expo(d, lvl)), notes = [];
    const pl = binom(r, n, z.plac / 100), dr = binom(r, n, c.resp / 100), pp = pl / n, pd = dr / n, pbar = (pl + dr) / (2 * n);
    const zs = (pd - pp) / Math.sqrt(Math.max(1e-6, pbar * (1 - pbar) * 2 / n));
    const evs = c.ae.map(x => ({ n: x.n, pct: Math.round(100 * binom(r, n, x.r / 100) / n), why: x.why, ser: x.ser, pl: Math.round(x.r / 6) }));
    const serious = c.ae.filter(x => x.ser && x.r >= 6), warnish = c.ae.filter(x => (x.ser || /QT|liver|[Bb]leed/.test(x.n)) && x.r >= 3 && x.r < 6);
    // patients
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const age = 18 + Math.floor(r() * 68), kid = r() < .25 ? (r() < .4 ? 'poor' : 'reduced') : 'normal', liv = r() < .15 ? 'reduced' : 'normal', med = MEDS[Math.floor(r() * MEDS.length)], asth = r() < .15;
      let mod = 0; const why = [];
      if (d.r === 'kidney' && kid !== 'normal') { mod += kid === 'poor' ? 3 : 1; why.push(`kidney function ${kid}: a kidney-cleared drug builds up`); }
      if (d.r !== 'kidney' && liv === 'reduced') { mod += 1; why.push('reduced liver function: slower CYP metabolism'); }
      if (med[2] === 'cyp3a4+' && d.r === 'cyp3a4') { mod += 3; why.push('clarithromycin blocks CYP3A4, so levels rise'); }
      if (med[2] === 'cyp3a4+g' && d.r === 'cyp3a4') { mod += 2; why.push('grapefruit blocks gut CYP3A4, so more drug gets absorbed'); }
      if (med[2] === 'cyp3a4-' && d.r === 'cyp3a4') { mod -= 3; why.push('rifampin induces CYP3A4, so the drug is burned off fast'); }
      if (med[2] === 'cyp2d6+' && d.r === 'cyp2d6') { mod += 2; why.push('fluoxetine blocks CYP2D6, so levels rise'); }
      if (age > 75) { mod += 1; why.push('age over 75: slower clearance'); }
      const ci = core(d, expo(d, lvl, mod)); let out = r() < ci.resp / 100 ? 'Responded' : 'No response', cls = out === 'Responded' ? 'ok' : 'no', ae = '';
      for (const x of ci.ae) { let rr = x.r; if (asth && /Wheez/.test(x.n)) rr = rr * 3 + 10; if (r() < rr / 100) { ae = x.n; if (x.ser && rr >= 6) { out = 'Serious adverse event (' + x.n + '): drug stopped, recovered'; cls = 'bad'; } break; } }
      if (asth && d.t === 'b1') why.push('has asthma: watch for β2 spill-over');
      pts.push({ i: i + 1, age, kid, liv, med: med[0], asth, E: ci.E, out, cls, ae, why: why.length ? why.join('; ') : 'no interactions' });
    }
    let verdict, vcls;
    if (serious.length) { verdict = 'Rejected: serious safety signal'; vcls = 'bad'; notes.push(`${serious[0].n} in ${Math.round(serious[0].r)}% of patients. ${serious[0].why}`); }
    else if (zs < 1.96 || pd - pp < .08) { verdict = 'Rejected: not enough benefit over placebo'; vcls = 'bad'; notes.push(`${Math.round(pd * 100)}% vs ${Math.round(pp * 100)}% on placebo isn't a convincing difference.`); }
    else if (warnish.length) { verdict = 'Approved with a boxed warning'; vcls = 'mid'; notes.push(`Works, but ${warnish.map(x => x.n.toLowerCase()).join(' and ')} need monitoring: regulators add a boxed warning.`); }
    else { verdict = 'Approved'; vcls = 'ok'; }
    if (vcls !== 'bad' && Math.round(pd * 100) < z.stdr - 12) notes.push(`Approved, but it's weaker than ${z.std} (${z.stdr}%), so doctors may keep using the standard.`);
    if (vcls !== 'bad' && Math.round(pd * 100) > z.stdr + 5) notes.push(`Beats ${z.std} (${z.stdr}%): this could change practice.`);
    if (pts.some(p => /cyp3a4/.test(p.why) || /CYP3A4/.test(p.why))) notes.push('Drug interactions showed up in patients on CYP3A4 blockers/inducers: a label warning is needed.');
    return { pl: Math.round(pp * 100), dr: Math.round(pd * 100), z: zs, evs, pts, verdict, vcls, notes, c };
  }
  /* ---------- molecule drawing (cosmetic) ---------- */
  function mol(d) {
    const rings = 1 + Math.round(d.l / 3.4), polar = Math.max(0, Math.round((10 - d.l) / 3)), hal = d.p >= 7 ? (d.p >= 9 ? 2 : 1) : 0, chain = 1 + Math.round(d.h / 3.5);
    const r = 15, dx = r * 1.732, cy = 55; let g = '', x0 = 30;
    const hex = (cx, cy2) => { let p = ''; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; p += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy2 + r * Math.sin(a)).toFixed(1); } return `<path d="${p}Z"/><circle cx="${cx}" cy="${cy2}" r="${r * .55}" fill="none" stroke-dasharray="${rings > 2 ? '2 2' : '0'}"/>`; };
    const cs = []; for (let i = 0; i < rings; i++) { const cx = x0 + i * (dx + 14), c2 = cy + (i % 2 ? 8 : -8); cs.push([cx, c2]); g += hex(cx, c2); if (i) g += `<path d="M${cs[i - 1][0] + r * .87} ${cs[i - 1][1]}L${cx - r * .87} ${c2}"/>`; }
    const last = cs[cs.length - 1]; let cx = last[0] + r * .87, yy = last[1];
    for (let i = 0; i < chain; i++) { const nx = cx + 13, ny = yy + (i % 2 ? -8 : 8); g += `<path d="M${cx} ${yy}L${nx} ${ny}"/>`; cx = nx; yy = ny; }
    const lab = []; const grp = ['OH', 'NH₂', 'COOH', 'OH'];
    const subs = []; for (let i = 0; i < polar; i++) subs.push([grp[i % 4], 'var(--easy)']); for (let i = 0; i < hal; i++) subs.push([i ? 'Cl' : 'F', 'var(--good)']);
    subs.slice(0, cs.length * 2).forEach((s, j) => { const c = cs[Math.floor(j / 2) % cs.length], top = j % 2 === 0; const lx = c[0] - 6, ly = top ? c[1] - r - 9 : c[1] + r + 17; g += `<path d="M${c[0]} ${top ? c[1] - r : c[1] + r}L${c[0]} ${top ? ly + 3 : ly - 11}"/>`; lab.push([lx, ly, s[0], s[1]]); });
    lab.push([cx + 4, yy + 4, d.r === 'kidney' ? 'N⁺' : 'CH₃', 'var(--hard)']);
    const w = Math.max(cx + 40, 160);
    return `<svg class="dl-mol" viewBox="0 0 ${w} 112" preserveAspectRatio="xMidYMid meet" aria-label="Your molecule (cosmetic)"><g fill="none" stroke="var(--tx)" stroke-width="2" stroke-linejoin="round">${g}</g>${lab.map(l => `<text x="${l[0]}" y="${l[1]}" font-size="11" font-weight="700" fill="${l[3]}">${l[2]}</text>`).join('')}</svg>`;
  }
  /* ---------- UI ---------- */
  function render(el) {
    pullP(); S = { el, mode: 'menu' };
    if (!el.__dl) { el.__dl = 1; el.addEventListener('click', onClick); el.addEventListener('input', onInput); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/druglab.json').then(d => { D = d; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function newDesign() { const r = rng(Date.now() & 0xffffffff); return { id: 'dl' + Date.now().toString(36), dz: null, t: null, a: null, p: 5, s: 5, l: 5, h: 5, b: 6, r: 'cyp3a4', name: '', seed: Math.floor(r() * 1e9), tries: 0 }; }
  const bar = (lbl, pct, cls) => `<div class="dl-br"><span class="dl-bl">${lbl}</span><span class="dl-bt"><i class="${cls || ''}" style="width:${clamp(pct, 0, 100)}%"></i></span><b>${pct}%</b></div>`;
  function head(back, right) { return `<div class="lb-top"><button class="lb-back" type="button" ${back}>${ic('back', 18)}<span>${back.includes('menu') ? 'Drug Lab' : 'Design'}</span></button><span class="lb-tr">${right || ''}</span></div>`; }
  function paint() {
    if (!S || !S.el.isConnected) return; let h = '';
    if (S.mode === 'menu') {
      const st = L.stat('druglab');
      h = L.top('Drug Lab', st ? `best ${st.best}` : '', 'lab') + `<p class="muted lb-p">Invent a drug. Pick a disease, a real target and how to hit it, tune the molecule, name it, then run it through preclinical tests, Phase 1, 2 and 3 trials on virtual patients. Every result comes with the pharmacology behind it.</p>
        <button class="btn pri lb-wide" data-dl-new type="button">Design a new drug</button>
        <h3>My pipeline</h3>${P.list.length ? `<div class="lb-group">${P.list.map(x => { const z = D.diseases.find(y => y.id === x.dz); return `<button class="lb-row" data-dl-open="${x.id}" type="button"><span class="lb-rt"><span class="t1">${esc(x.name)}</span><span class="t2">${esc(z ? z.name : '')} · ${esc(D.targets[x.t] ? D.targets[x.t][0] : '')} ${esc(x.a)}</span></span><span class="dl-stage ${x.vcls || ''}">${esc(x.stage || 'design')}</span><span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>` : '<div class="lb-card"><p class="muted">No drugs yet. Your designs and their trial results show up here.</p></div>'}
        <p class="lb-foot">A teaching model: exposure is shown as abstract levels (1–10, low/medium/high), never real doses. Not medical advice.</p>`;
    } else if (S.mode === 'design') {
      const d = S.d, z = d.dz && D.diseases.find(x => x.id === d.dz);
      h = head('data-dl-menu', 'Design') + `<h2 class="lb-title">Design your drug</h2>
        <div class="lb-card"><h3>1. Disease</h3><div class="dx-pool">${D.diseases.map(x => `<button type="button" class="dx-chip${d.dz === x.id ? ' dl-on' : ''}" data-dl-dz="${x.id}">${esc(x.name)}</button>`).join('')}</div></div>`;
      if (z) {
        if (!S.topts || S.topts.dz !== z.id) { const own = Object.keys(z.good).concat(Object.keys(z.bad)); const other = L.shuffle(Object.keys(D.targets).filter(k => !own.includes(k))).slice(0, 3); S.topts = { dz: z.id, list: L.shuffle([...new Set(own)].concat(other)) }; }
        h += `<div class="lb-card"><h3>2. Target</h3><p class="muted small">Which molecule in the body should your drug hit?</p><div class="dl-tg">${S.topts.list.map(k => { const T = D.targets[k]; return `<button type="button" class="dl-t${d.t === k ? ' dl-on' : ''}" data-dl-t="${k}"><b>${esc(T[0])}</b><span>${esc(T[1])} · ${esc(T[2])}</span></button>`; }).join('')}</div></div>`;
      }
      if (z && d.t) h += `<div class="lb-card"><h3>3. Action</h3><div class="dl-seg">${actionsFor(d.t).map(a => `<button type="button" class="${d.a === a ? 'dl-on' : ''}" data-dl-a="${a}">${ACT[a]}</button>`).join('')}</div></div>`;
      if (z && d.t && d.a) {
        const stem = stemOf(d.t, d.a);
        h += `<div class="lb-card"><h3>4. Tune the molecule</h3>${SL.map(s => `<label class="dl-sl"><span><b>${s[1]}</b> <i data-dl-v="${s[0]}">${d[s[0]]}${s[0] === 'h' ? ` · ~${HL[d.h - 1]} h` : ''}</i><small>${s[2]}</small></span><input type="range" min="1" max="10" step="1" value="${d[s[0]]}" data-dl-sl="${s[0]}"></label>`).join('')}
          <p class="dl-sub">Cleared by</p><div class="dl-seg sm">${Object.entries(ROUTE).map(([k, v]) => `<button type="button" class="${d.r === k ? 'dl-on' : ''}" data-dl-r="${k}">${v}</button>`).join('')}</div>
          <div class="dl-molw" id="dlMol">${mol(d)}</div><p class="muted small" style="text-align:center">Brain entry: <b id="dlBe">${brain(d.l)}</b> · dosing: <b id="dlDose">${dosing(d.h)}</b></p></div>
          <div class="lb-card"><h3>5. Name it</h3><div class="dl-name"><input type="text" maxlength="24" value="${esc(d.name)}" data-dl-name aria-label="Drug name"><button type="button" class="btn" data-dl-gen>New name</button></div><p class="muted small" style="margin-top:8px">${stem[0] ? `<b>${esc(stem[0])}</b>: ` : ''}${esc(stem[1])}</p></div>
          <div class="lb-btns sticky"><button class="btn pri" data-dl-test type="button" ${d.name.trim() ? '' : 'disabled'}>Start testing</button></div>`;
      }
    } else if (S.mode === 'trial') {
      const d = S.d, z = D.diseases.find(x => x.id === d.dz), R = S.res, cost = S.cost;
      h = head('data-dl-back', `$${cost[0]}M · ${cost[1]} yrs`) + `<h2 class="lb-title">${esc(d.name)}</h2><p class="muted lb-p small">${esc(z.name)} · ${esc(D.targets[d.t][0])} ${esc(d.a)} · P${d.p} S${d.s} L${d.l} H${d.h} B${d.b} · ${esc(ROUTE[d.r])}</p>
        <div class="dl-steps">${['Preclinical', 'Phase 1', 'Phase 2', 'Phase 3', 'Decision'].map((x, i) => `<span class="${S.failAt === i ? 'fail' : i < S.stage && !(S.failAt != null && i >= S.failAt) ? 'done' : i === S.stage && S.failAt == null ? 'on' : ''}">${x}</span>`).join('')}</div>`;
      if (R.pre) h += `<div class="lb-card"><h3>Preclinical (lab + animal models)</h3><p class="dl-v ${R.pre.pass ? 'ok' : 'bad'}">${R.pre.pass ? 'Passed' : 'Failed'}</p>${R.pre.warns.length ? `<ul>${R.pre.warns.map(w => `<li>⚠️ ${esc(w)}</li>`).join('')}</ul>` : ''}<div class="dl-notes"><b>Investigator notes</b><ul>${R.pre.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div></div>`;
      if (R.p1) h += `<div class="lb-card"><h3>Phase 1 · 24 healthy volunteers per level</h3>${['low', 'med', 'high'].map(k => { const v = R.p1.lv[k]; return `<div class="dl-lv"><b>${k === 'med' ? 'Medium' : k[0].toUpperCase() + k.slice(1)} (exposure ${v.E}/10)</b>${v.ser ? ' <span class="dl-v bad">serious AE</span>' : ''}<div class="dl-ae">${v.evs.filter(e => e.k).map(e => `<span class="${e.ser ? 'ser' : ''}">${esc(e.n)} ${e.k}/24</span>`).join('') || '<span>no side effects</span>'}</div></div>`; }).join('')}
        <p class="dl-v ${R.p1.pass ? 'ok' : 'bad'}">${R.p1.pass ? 'Passed' : 'Serious adverse event, trial paused'}</p><div class="dl-notes"><b>Investigator notes</b><ul>${R.p1.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div></div>`;
      if (R.p2) h += `<div class="lb-card"><h3>Phase 2 · 40 patients per arm</h3><p class="muted small">${esc(z.end)}</p>${R.p2.arms.map(a => bar(a.k === 'placebo' ? 'Placebo' : a.k === 'med' ? 'Medium' : a.k[0].toUpperCase() + a.k.slice(1), a.pct, a.k === 'placebo' ? 'pl' : '')).join('')}
        <p class="dl-v ${R.p2.pass ? 'ok' : 'bad'}">${R.p2.pass ? 'Signal of benefit' : 'Stopped for futility'}</p><div class="dl-notes"><b>Investigator notes</b><ul>${R.p2.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>
        ${R.p2.pass && !R.p3 ? `<p class="dl-sub">Pick the exposure level for Phase 3</p><div class="dl-seg">${R.p2.arms.slice(1).map(a => `<button type="button" class="${S.lvl === a.k ? 'dl-on' : ''}" data-dl-lvl="${a.k}">${a.k === 'med' ? 'Medium' : a.k[0].toUpperCase() + a.k.slice(1)}</button>`).join('')}</div>` : ''}</div>`;
      if (R.p3) { const p3 = R.p3; h += `<div class="lb-card"><h3>Phase 3 · 300 patients per arm (${S.lvl === 'med' ? 'medium' : S.lvl} exposure)</h3><p class="muted small">${esc(z.end)}</p>${bar(esc(d.name), p3.dr, '')}${bar('Placebo', p3.pl, 'pl')}${bar('Standard: ' + esc(z.std), z.stdr, 'std')}
        <p class="dl-sub">Side effects (drug vs placebo)</p>${p3.evs.map(e => `<div class="dl-br sm"><span class="dl-bl">${esc(e.n)}</span><span class="dl-bt"><i class="${e.ser && e.pct >= 6 ? 'ser' : 'ae'}" style="width:${clamp(e.pct * 2, 0, 100)}%"></i></span><b>${e.pct}% <small>vs ${e.pl}%</small></b></div>`).join('')}
        <p class="dl-sub">Patient cards</p><div class="dl-pts">${p3.pts.map(p => `<div class="dl-pt ${p.cls}"><b>Patient ${p.i}, ${p.age} y</b><span>Kidneys ${p.kid} · liver ${p.liv}${p.asth ? ' · asthma' : ''}</span><span>Other meds: ${esc(p.med)}</span><span>Exposure ${p.E}/10</span><em>${esc(p.out)}${p.ae && p.cls !== 'bad' ? ' · side effect: ' + esc(p.ae.toLowerCase()) : ''}</em><small>${esc(p.why)}</small></div>`).join('')}</div>
        <div class="dl-notes"><b>Investigator notes</b><ul>${p3.notes.map(n => `<li>${esc(n)}</li>`).join('') || '<li>Clean, convincing trial.</li>'}</ul></div></div>`; }
      if (S.final) h += `<div class="lb-card sim-res"><div class="dl-verd ${S.final.vcls}">${esc(S.final.verdict)}</div><div class="lz-big">${S.final.score}</div><div class="muted small">score: approval ${S.final.parts[0]} · safety ${S.final.parts[1]} · cost/time ${S.final.parts[2]}</div><div class="muted small">Spent $${cost[0]}M over ${cost[1]} year${cost[1] === 1 ? '' : 's'}</div></div>`;
      const nx = S.next;
      h += `<div class="lb-btns sticky">${nx ? `<button class="btn" data-dl-redesign type="button">Redesign</button><button class="btn pri" data-dl-run type="button" ${nx === 'p3' && !S.lvl ? 'disabled' : ''}>${{ pre: 'Run preclinical', p1: 'Start Phase 1', p2: 'Start Phase 2', p3: 'Start Phase 3' }[nx]}</button>` : `<button class="btn" data-dl-redesign type="button">Redesign</button><button class="btn pri" data-dl-menu type="button">My pipeline</button>`}</div>`;
    }
    S.el.innerHTML = `<div class="lb dl">${h}</div>`;
  }
  function genFor(d) { d.name = genName(d.t, d.a, rng(Date.now() & 0xffffffff)); }
  function startTrial() { const d = S.d; d.tries = (d.tries || 0) + 1; S.res = {}; S.stage = 0; S.failAt = null; S.lvl = null; S.final = null; S.next = 'pre'; S.cost = [0, 0]; S.mode = 'trial'; S.seed = hash(JSON.stringify([d.dz, d.t, d.a, d.p, d.s, d.l, d.h, d.b, d.r])) ^ d.seed; paint(); window.scrollTo(0, 0); }
  function addCost(k) { S.cost = [S.cost[0] + COST[k][0], Math.round((S.cost[1] + COST[k][1]) * 10) / 10]; }
  function fail(stageIdx, label) { S.failAt = stageIdx; S.next = null; finish(label, 'bad'); paint(); const cards = S.el.querySelectorAll('.lb-card'); const last = cards[cards.length - 1]; if (last) last.scrollIntoView({ block: 'center' }); }
  function run() {
    const d = S.d, R = S.res, nx = S.next;
    if (nx === 'pre') { addCost('pre'); R.pre = runPre(d); S.stage = 1; if (!R.pre.pass) return fail(0, 'Failed in preclinical'); S.next = 'p1'; }
    else if (nx === 'p1') { addCost('p1'); R.p1 = runP1(d, S.seed); S.stage = 2; if (!R.p1.pass) return fail(1, 'Phase 1: serious adverse event, trial paused'); S.next = 'p2'; }
    else if (nx === 'p2') { addCost('p2'); R.p2 = runP2(d, S.seed, R.p1.mtl); S.stage = 3; if (!R.p2.pass) return fail(2, 'Phase 2: stopped for futility'); S.next = 'p3'; S.lvl = null; }
    else if (nx === 'p3') { addCost('p3'); R.p3 = runP3(d, S.seed, S.lvl); S.stage = 4; S.next = null; finish(R.p3.verdict, R.p3.vcls); }
    paint(); const cards = S.el.querySelectorAll('.lb-card'); const last = cards[cards.length - 1]; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function finish(verdict, vcls) {
    const d = S.d, R = S.res;
    const ap = vcls === 'ok' ? 50 : vcls === 'mid' ? 35 : R.p3 ? 15 : R.p2 ? 10 : R.p1 ? 5 : 0;
    let tot = 0; if (R.p3) tot = R.p3.evs.reduce((s, e) => s + e.pct, 0); else if (R.p1 && R.p1.mtl) tot = R.p1.lv[R.p1.mtl].tot; else tot = 60;
    const saf = R.p1 ? Math.round(clamp(25 * (1 - tot / 60), 0, 25)) : 0;
    const ct = vcls === 'bad' ? Math.max(0, 10 - 3 * (d.tries - 1)) : Math.max(5, 25 - 4 * (d.tries - 1) - (dosing(d.h) === '3–4 times a day' ? 5 : 0));
    S.final = { verdict, vcls, score: ap + saf + ct, parts: [ap, saf, ct] };
    if (S.stage < 4 && !R.p3) S.stage = Math.max(S.stage, 1);
    L.fx(vcls !== 'bad');
    L.result('druglab', d.id, S.final.score);
    if (vcls !== 'bad') L.award('druglab', 10 + Math.round(S.final.score / 10));
    L.mastery({ id: 'DL:' + d.dz + ':' + d.t + ':' + d.a, tags: ['pharmacology'], ok: vcls !== 'bad', choices: 4, label: 'Drug Lab: ' + D.targets[d.t][0] + ' ' + d.a + ' for ' + D.diseases.find(x => x.id === d.dz).name, src: 'druglab' });
    const stage = vcls === 'ok' ? 'Approved' : vcls === 'mid' ? 'Approved*' : verdict.split(':')[0];
    const rec = Object.assign({}, d, { stage, vcls, score: S.final.score, verdict, at: Date.now() });
    P.list = [rec].concat(P.list.filter(x => x.id !== d.id)).slice(0, 60); saveP();
  }
  function onInput(e) {
    if (!S || S.mode !== 'design') return; const t = e.target;
    if (t.matches('[data-dl-sl]')) { const k = t.dataset.dlSl; S.d[k] = +t.value; const v = S.el.querySelector(`[data-dl-v="${k}"]`); if (v) v.textContent = S.d[k] + (k === 'h' ? ` · ~${HL[S.d.h - 1]} h` : ''); const m = S.el.querySelector('#dlMol'); if (m) m.innerHTML = mol(S.d); const be = S.el.querySelector('#dlBe'); if (be) be.textContent = brain(S.d.l); const ds = S.el.querySelector('#dlDose'); if (ds) ds.textContent = dosing(S.d.h); return; }
    if (t.matches('[data-dl-name]')) { S.d.name = t.value.replace(/[<>]/g, '').slice(0, 24); const b = S.el.querySelector('[data-dl-test]'); if (b) b.disabled = !S.d.name.trim(); }
  }
  function keep(f) { const y = window.scrollY; f(); paint(); window.scrollTo(0, y); }
  function onClick(e) {
    if (!S || !D) return; const t = e.target;
    if (t.closest('[data-dl-menu]')) { S.mode = 'menu'; paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-dl-new]')) { S.d = newDesign(); S.topts = null; S.mode = 'design'; paint(); window.scrollTo(0, 0); return; }
    const o = t.closest('[data-dl-open]'); if (o) { const x = P.list.find(y => y.id === o.dataset.dlOpen); if (x) { S.d = Object.assign({}, x); S.topts = null; S.mode = 'design'; paint(); window.scrollTo(0, 0); } return; }
    if (t.closest('[data-dl-back]') || t.closest('[data-dl-redesign]')) { S.mode = 'design'; paint(); window.scrollTo(0, 0); return; }
    if (S.mode === 'design') {
      const z = t.closest('[data-dl-dz]'); if (z) { keep(() => { if (S.d.dz !== z.dataset.dlDz) { S.d.dz = z.dataset.dlDz; S.d.t = null; S.d.a = null; } }); return; }
      const g = t.closest('[data-dl-t]'); if (g) { keep(() => { S.d.t = g.dataset.dlT; const ac = actionsFor(S.d.t); S.d.a = ac.length === 1 ? ac[0] : null; if (S.d.a && !S.d.name) genFor(S.d); }); return; }
      const a = t.closest('[data-dl-a]'); if (a) { keep(() => { S.d.a = a.dataset.dlA; genFor(S.d); }); return; }
      const r = t.closest('[data-dl-r]'); if (r) { keep(() => { S.d.r = r.dataset.dlR; }); return; }
      if (t.closest('[data-dl-gen]')) { keep(() => genFor(S.d)); return; }
      if (t.closest('[data-dl-test]') && S.d.name.trim()) { startTrial(); return; }
    }
    if (S.mode === 'trial') {
      const lv = t.closest('[data-dl-lvl]'); if (lv) { keep(() => { S.lvl = lv.dataset.dlLvl; }); return; }
      if (t.closest('[data-dl-run]')) { run(); return; }
    }
  }
  window.LabMods.druglab = { render, _S: () => S, _P: () => P, core: (d, E) => core(d, E), runPre, runP1, runP2, runP3, fitOf };
})();
