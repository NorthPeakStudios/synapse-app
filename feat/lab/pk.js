/* PK sim: a one-compartment pharmacokinetics playground in abstract units (no real drugs, no real doses). Change the dose size, interval, half-life, route and bioavailability and watch the concentration curve, steady state and the therapeutic window. Challenges ask for a regimen that stays in the window. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic; L.css2(); L.css3();
  let S = null;
  const MEC = 1, MTC = 3, DAYS = 5, KA = 1.2;
  const CH = [
    { id: 'c1', t: 'Keep it in the window', d: 'Pick a dose and interval so the drug stays between the two lines for most of days 3–5.', lock: { hl: 8, route: 'oral', F: 80 } },
    { id: 'c2', t: 'Slow clearance', d: 'This patient clears the drug slowly (half-life 24 h). Find a regimen that doesn\'t climb into the toxic zone.', lock: { hl: 24, route: 'oral', F: 80 } },
    { id: 'c3', t: 'Poor absorption', d: 'Only 25% of an oral dose reaches the blood. Get it into the window anyway, or switch route.', lock: { hl: 6, F: 25 } },
    { id: 'c4', t: 'Fast start', d: 'Half-life 30 h: it would take days to reach steady state. Get it into the window by hour 6 and keep it there (a loading dose can help).', lock: { hl: 30, route: 'iv' }, need: 'early' }
  ];
  const DEF = { route: 'oral', dose: 4, tau: 12, hl: 8, F: 80, load: false };
  function render(el) {
    S = { el, p: Object.assign({}, DEF, JSON.parse(localStorage.getItem('pk.p') || '{}')), ch: null, res: null };
    if (!el.__pk) { el.__pk = 1; el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('change', onInput); }
    paint();
  }
  function sim(p) {
    const k = Math.LN2 / p.hl, T = DAYS * 24, dt = 0.1, n = Math.round(T / dt), C = new Float32Array(n + 1), V = 1;
    const doses = []; for (let t = 0; t < T; t += p.tau) doses.push([t, (p.load && t === 0 ? 2 : 1) * p.dose]);
    const F = p.route === 'oral' ? p.F / 100 : 1;
    for (let i = 0; i <= n; i++) {
      const t = i * dt; let c = 0;
      if (p.route === 'inf') { const R = p.dose / p.tau; c = R / (k * V) * (1 - Math.exp(-k * t)); if (p.load) c += (p.dose / V) * Math.exp(-k * t); }
      else for (const [td, D] of doses) { if (td > t) break; const s = t - td; c += p.route === 'iv' ? F * D / V * Math.exp(-k * s) : F * D * KA / (V * (KA - k)) * (Math.exp(-k * s) - Math.exp(-KA * s)); }
      C[i] = c;
    }
    const a = Math.round(48 / dt); let inW = 0, tox = 0, low = 0, pk = 0, tr = Infinity;
    for (let i = a; i <= n; i++) { const c = C[i]; if (c > MTC) tox++; else if (c < MEC) low++; else inW++; pk = Math.max(pk, c); tr = Math.min(tr, c); }
    const m = n - a + 1; let early = 0; for (let i = Math.round(6 / dt); i <= n; i++) if (C[i] >= MEC && C[i] <= MTC) early++;
    return { C, dt, T, k, inW: inW / m, tox: tox / m, low: low / m, peak: pk, trough: tr, early: early / (n - Math.round(6 / dt) + 1), acc: p.route === 'inf' ? null : 1 / (1 - Math.exp(-k * p.tau)), tss: 4.5 * p.hl };
  }
  function slider(key, label, min, max, step, val, fmt, dis) {
    return `<label class="pk-s" style="display:block;margin:10px 0"><span style="display:flex;justify-content:space-between"><span>${label}</span><b>${fmt(val)}</b></span><input type="range" data-pk="${key}" min="${min}" max="${max}" step="${step}" value="${val}" ${dis ? 'disabled' : ''} style="width:100%"></label>`;
  }
  function paint() {
    if (!S || !S.el.isConnected) return; const p = S.p, c = S.ch, lock = c ? c.lock : {};
    const r = sim(p); S.last = r;
    let h = L.top('PK sim', c ? 'Challenge' : '', 'lab');
    if (!c) h += `<p class="muted lb-p">A pretend drug in made-up units. Change how much, how often and how fast the body clears it, and watch the blood level. Stay between the lines: below is too weak, above is toxic.</p>`;
    else h += `<div class="lb-card"><b>${esc(c.t)}</b><p class="muted small" style="margin:4px 0 0">${esc(c.d)}</p></div>`;
    h += `<canvas data-pk-cv style="width:100%;height:210px;display:block;border-radius:12px;background:var(--card,#111)"></canvas>`;
    h += `<div class="pk-read" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0;text-align:center">
      <div class="lb-card" style="padding:8px"><b style="font-size:20px">${Math.round(r.inW * 100)}%</b><div class="muted small">in window (days 3–5)</div></div>
      <div class="lb-card" style="padding:8px"><b style="font-size:20px">${Math.round(r.tss)} h</b><div class="muted small">to steady state (~4–5 half-lives)</div></div>
      <div class="lb-card" style="padding:8px"><b style="font-size:20px">${r.acc ? r.acc.toFixed(1) + '×' : 'n/a'}</b><div class="muted small">build-up (accumulation)</div></div></div>`;
    h += `<p class="muted small" style="margin:0 0 6px">Peak ${r.peak.toFixed(2)} · trough ${r.trough.toFixed(2)} (window ${MEC}–${MTC}) ${r.tox > 0.02 ? '· <b style="color:#e5484d">goes toxic</b>' : ''}${r.low > 0.2 ? ' · <b style="color:#f2c14e">often too low</b>' : ''}</p>`;
    const routes = [['oral', 'By mouth'], ['iv', 'IV push'], ['inf', 'IV drip']];
    h += `<div class="at-tabs">${routes.map(([k, l]) => `<button type="button" data-pk-route="${k}" class="${p.route === k ? 'on' : ''}" ${lock.route && lock.route !== k ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
    h += slider('dose', p.route === 'inf' ? 'Amount per interval (units)' : 'Dose (units)', 1, 10, 0.5, p.dose, v => v + ' u');
    h += slider('tau', p.route === 'inf' ? 'Bag length (h)' : 'Every … hours', 2, 24, 1, p.tau, v => v + ' h');
    h += slider('hl', 'Half-life', 1, 36, 1, p.hl, v => v + ' h', lock.hl != null);
    if (p.route === 'oral') h += slider('F', 'Bioavailability (reaches blood)', 10, 100, 5, p.F, v => v + '%', lock.F != null);
    h += `<label style="display:flex;gap:10px;align-items:center;margin:10px 0"><input type="checkbox" data-pk-load ${p.load ? 'checked' : ''} style="width:22px;height:22px"> Loading dose (double the first one)</label>`;
    if (c) {
      if (S.res) h += `<div class="lb-card sim-res"><div class="lz-big">${S.res.score}%</div><div class="sim-verd ${S.res.pass ? 'ok' : 'bad'}">${S.res.pass ? 'Nailed it' : 'Not quite'}</div><p class="lb-why">${esc(S.res.why)}</p></div>`;
      h += `<div class="lb-btns"><button class="btn" data-pk-free type="button">Free play</button><button class="btn pri" data-pk-check type="button">Check</button></div>`;
    }
    h += `<h3 style="margin:18px 0 8px">Challenges</h3><div class="lb-group">${CH.map(x => { const b = L.bestOf('pk', x.id); return `<button class="lb-row" type="button" data-pk-ch="${x.id}"><span class="lb-rt"><span class="t1">${esc(x.t)}</span><span class="t2">${esc(x.d.slice(0, 70))}…</span></span>${b ? `<span class="lb-best">${b.b}%</span>` : ''}<span class="lb-chev">${ic('chev', 16)}</span></button>`; }).join('')}</div>
      <div class="lb-card"><p class="lb-why"><b>The rules behind it:</b> each half-life, half the drug is gone. Dosing faster than it clears makes it build up until intake = elimination (steady state, after about 4–5 half-lives). Bioavailability is the share of an oral dose that reaches the blood. A loading dose gets you to the target level right away.</p></div>
      <p class="lb-foot">Made-up units for learning. Not real drugs or doses.</p>`;
    S.el.innerHTML = `<div class="lb pk">${h}</div>`;
    draw(r);
  }
  function draw(r) {
    const cv = S.el.querySelector('[data-pk-cv]'); if (!cv) return; const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 340, H = cv.clientHeight || 210;
    cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.scale(dpr, dpr);
    const pad = { l: 30, r: 8, t: 10, b: 22 }, w = W - pad.l - pad.r, hh = H - pad.t - pad.b;
    const ymax = Math.max(4, Math.ceil(Math.min(12, r.peak * 1.15)));
    const X = t => pad.l + t / r.T * w, Y = c => pad.t + hh - Math.min(c, ymax) / ymax * hh;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.dataset.theme !== 'light';
    x.fillStyle = 'rgba(48,164,108,.16)'; x.fillRect(pad.l, Y(MTC), w, Y(MEC) - Y(MTC));
    x.strokeStyle = 'rgba(229,72,77,.8)'; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(pad.l, Y(MTC)); x.lineTo(pad.l + w, Y(MTC)); x.stroke();
    x.strokeStyle = 'rgba(242,193,78,.9)'; x.beginPath(); x.moveTo(pad.l, Y(MEC)); x.lineTo(pad.l + w, Y(MEC)); x.stroke(); x.setLineDash([]);
    x.fillStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'; x.font = '10px -apple-system,system-ui,sans-serif';
    for (let d = 0; d <= DAYS; d++) { x.fillText('d' + d, X(d * 24) - 6, H - 6); }
    x.fillText('toxic', pad.l + 4, Y(MTC) - 3); x.fillText('too low', pad.l + 4, Y(MEC) + 11);
    for (let v = 0; v <= ymax; v += ymax > 6 ? 2 : 1) x.fillText(String(v), 6, Y(v) + 3);
    x.strokeStyle = '#4c9aff'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i < r.C.length; i += 2) { const px = X(i * r.dt), py = Y(r.C[i]); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke();
  }
  function check() {
    const r = S.last, c = S.ch; let score = Math.round(r.inW * 100), why;
    if (c.need === 'early') score = Math.round(Math.min(r.inW, r.early) * 100);
    const pass = score >= 80;
    why = pass ? `In the window ${Math.round(r.inW * 100)}% of days 3–5${c.need === 'early' ? ` and ${Math.round(r.early * 100)}% from hour 6 on` : ''}.` : r.tox > 0.05 ? 'It climbs into the toxic zone: give less, or give it less often.' : r.low > 0.05 ? 'It dips below the line too much: give more, more often, or change route.' : c.need === 'early' ? 'Steady state comes too late: try the loading dose.' : 'Close: smooth out the peaks and troughs with smaller, more frequent doses.';
    S.res = { score, pass, why }; L.result('pk', c.id, score); L.fx(pass); L.award('pk', pass ? 4 : 1); paint();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const rt = t.closest('[data-pk-route]'); if (rt && !rt.disabled) { S.p.route = rt.dataset.pkRoute; S.res = null; save(); paint(); return; }
    const ch = t.closest('[data-pk-ch]'); if (ch) { const c = CH.find(x => x.id === ch.dataset.pkCh); S.ch = c; S.res = null; S.p = Object.assign({}, DEF, { route: c.lock.route || 'oral' }, c.lock, { load: false }); paint(); window.scrollTo(0, 0); return; }
    if (t.closest('[data-pk-check]')) { check(); return; }
    if (t.closest('[data-pk-free]')) { S.ch = null; S.res = null; S.p = Object.assign({}, DEF, JSON.parse(localStorage.getItem('pk.p') || '{}')); paint(); return; }
  }
  let raf = 0;
  function onInput(e) {
    const s = e.target.closest('[data-pk]'), l = e.target.closest('[data-pk-load]'); if (!s && !l) return;
    if (s) { S.p[s.dataset.pk] = +s.value; const b = s.parentElement.querySelector('b'); if (b) b.textContent = s.dataset.pk === 'F' ? s.value + '%' : s.dataset.pk === 'dose' ? s.value + ' u' : s.value + ' h'; }
    if (l) S.p.load = l.checked;
    S.res = null; save();
    if (e.type === 'change' || l) { const y = window.scrollY; paint(); window.scrollTo(0, y); return; }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const r = sim(S.p); S.last = r; draw(r); });
  }
  function save() { if (!S.ch) localStorage.setItem('pk.p', JSON.stringify(S.p)); }
  window.LabMods.pk = { render, sim, _S: () => S };
})();
