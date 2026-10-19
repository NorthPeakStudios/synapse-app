/* Ambient study sounds (#38): rain, brown noise, pink noise, café murmur, fireplace and ocean waves, all GENERATED in the browser with Web Audio (nothing downloaded). Mix several, set each volume, add a sleep timer. Keeps playing while you study until you stop it. */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc; L.css2(); L.css3();
  const SND = [['rain', '🌧️', 'Rain'], ['brown', '🟤', 'Brown noise'], ['pink', '🌸', 'Pink noise'], ['cafe', '☕', 'Café'], ['fire', '🔥', 'Fireplace'], ['waves', '🌊', 'Ocean waves']];
  const A = window.__amb || (window.__amb = { ctx: null, master: null, on: {}, vol: JSON.parse(localStorage.getItem('amb.vol') || '{}'), timer: 0, until: 0 });
  let S = null;
  function ctx() { if (!A.ctx) { const C = window.AudioContext || window.webkitAudioContext; A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(A.ctx.destination); } if (A.ctx.state === 'suspended') A.ctx.resume(); return A.ctx; }
  function noiseBuf(kind, secs = 4) {
    const c = ctx(), n = c.sampleRate * secs, b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        else d[i] = w; } }
    return b;
  }
  function loop(buf) { const s = ctx().createBufferSource(); s.buffer = buf; s.loop = true; return s; }
  function build(k) {
    const c = ctx(), out = c.createGain(); out.gain.value = 0; out.connect(A.master); const nodes = [], timers = [];
    const add = n => { nodes.push(n); return n; };
    if (k === 'brown' || k === 'pink') { const s = add(loop(noiseBuf(k))); s.connect(out); s.start(); }
    if (k === 'rain') { const s = add(loop(noiseBuf('white'))); const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; const g = c.createGain(); g.gain.value = 0.35; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out); s.start();
      const s2 = add(loop(noiseBuf('brown'))); const g2 = c.createGain(); g2.gain.value = 0.5; s2.connect(g2); g2.connect(out); s2.start();
      const drop = () => { const o = c.createBufferSource(); o.buffer = noiseBuf('white', 0.03); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000 + Math.random() * 3000; const gg = c.createGain(); gg.gain.value = 0.15 * Math.random(); o.connect(f); f.connect(gg); gg.connect(out); o.start(); }; timers.push(setInterval(() => { for (let i = 0; i < 3; i++) setTimeout(drop, Math.random() * 120); }, 120)); }
    if (k === 'cafe') { const s = add(loop(noiseBuf('pink'))); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.8; const g = c.createGain(); g.gain.value = 1.4; s.connect(bp); bp.connect(g); g.connect(out); s.start();
      const lfo = add(c.createOscillator()); lfo.frequency.value = 0.35; const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start();
      const clink = () => { const o = c.createOscillator(), gg = c.createGain(); o.type = 'sine'; o.frequency.value = 2400 + Math.random() * 1800; const t = c.currentTime; gg.gain.setValueAtTime(0.05 + Math.random() * 0.05, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(gg); gg.connect(out); o.start(t); o.stop(t + 0.4); }; timers.push(setInterval(() => { if (Math.random() < 0.35) clink(); }, 1400)); }
    if (k === 'fire') { const s = add(loop(noiseBuf('brown'))); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; const g = c.createGain(); g.gain.value = 0.9; s.connect(lp); lp.connect(g); g.connect(out); s.start();
      const crack = () => { const o = c.createBufferSource(); o.buffer = noiseBuf('white', 0.02); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; const gg = c.createGain(); gg.gain.value = 0.3 + Math.random() * 0.4; o.connect(f); f.connect(gg); gg.connect(out); o.start(); }; timers.push(setInterval(() => { if (Math.random() < 0.5) { crack(); if (Math.random() < 0.4) setTimeout(crack, 40 + Math.random() * 80); } }, 260)); }
    if (k === 'waves') { const s = add(loop(noiseBuf('pink'))); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; const g = c.createGain(); g.gain.value = 0.2; s.connect(lp); lp.connect(g); g.connect(out); s.start();
      const lfo = add(c.createOscillator()); lfo.frequency.value = 0.09; const lg = c.createGain(); lg.gain.value = 0.9; lfo.connect(lg); lg.connect(g.gain); lfo.start(); const lf2 = c.createGain(); lf2.gain.value = 500; lfo.connect(lf2); lf2.connect(lp.frequency); }
    return { out, nodes, timers };
  }
  const vol = k => A.vol[k] == null ? 0.6 : A.vol[k];
  function start(k) { if (A.on[k]) return; const v = build(k); A.on[k] = v; v.out.gain.setTargetAtTime(vol(k), ctx().currentTime, 0.4); }
  function stop(k) { const v = A.on[k]; if (!v) return; delete A.on[k]; try { v.out.gain.setTargetAtTime(0, A.ctx.currentTime, 0.25); } catch (e) {} v.timers.forEach(clearInterval); setTimeout(() => { v.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); try { v.out.disconnect(); } catch (e) {} }, 1200); }
  function stopAll() { Object.keys(A.on).forEach(stop); clearTimeout(A.timer); A.until = 0; }
  function setTimer(min) { clearTimeout(A.timer); A.until = min ? Date.now() + min * 60000 : 0; if (min) A.timer = setTimeout(() => { stopAll(); paint(); }, min * 60000); }
  function render(el) { S = { el }; if (!el.__amb) { el.__amb = 1; el.addEventListener('click', onClick); el.addEventListener('input', onInput); } paint(); }
  function paint() {
    if (!S || !S.el.isConnected) return; const any = Object.keys(A.on).length;
    let h = L.top('Study sounds', any ? '▶ playing' : '', 'tools') + `<p class="muted lb-p">Background sounds made right on your phone. Mix them, then go study: they keep playing until you stop them.</p>`;
    h += `<div class="lb-card">${SND.map(([k, e, n]) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(127,127,127,.15)"><button type="button" class="btn ${A.on[k] ? 'pri' : ''}" data-amb="${k}" style="min-width:150px;justify-content:flex-start">${e} ${esc(n)}</button><input type="range" min="0" max="1" step="0.05" value="${vol(k)}" data-amb-v="${k}" aria-label="${esc(n)} volume" style="flex:1"></div>`).join('')}</div>`;
    const left = A.until ? Math.max(0, Math.round((A.until - Date.now()) / 60000)) : 0;
    h += `<div class="muted small" style="margin:10px 0 6px">Sleep timer${left ? ' · stops in ~' + left + ' min' : ''}</div><div class="at-tabs">${[[0, 'Off'], [25, '25 min'], [45, '45 min'], [60, '1 h']].map(([m, t]) => `<button type="button" data-amb-t="${m}" class="${(m === 0 && !A.until) || (m && A.untilMin === m && A.until) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    h += `<div class="lb-btns"><button class="btn" type="button" data-amb-stop ${any ? '' : 'disabled'}>■ Stop all</button></div><p class="muted small">Tip: brown noise + rain is a classic focus mix. On iPhone, the ring/silent switch can mute web audio.</p>`;
    S.el.innerHTML = `<div class="lb amb">${h}</div>`;
  }
  function onClick(e) {
    const t = e.target, b = t.closest('[data-amb]'); if (b) { const k = b.dataset.amb; try { ctx(); } catch (x) { try { toast('Sound isn\'t supported here'); } catch (y) {} return; } if (A.on[k]) stop(k); else start(k); paint(); return; }
    const tm = t.closest('[data-amb-t]'); if (tm) { const m = +tm.dataset.ambT; A.untilMin = m; setTimer(m); paint(); return; }
    if (t.closest('[data-amb-stop]')) { stopAll(); paint(); }
  }
  function onInput(e) { const r = e.target.closest('[data-amb-v]'); if (!r) return; const k = r.dataset.ambV; A.vol[k] = +r.value; localStorage.setItem('amb.vol', JSON.stringify(A.vol)); const v = A.on[k]; if (v && A.ctx) v.out.gain.setTargetAtTime(+r.value, A.ctx.currentTime, 0.1); }
  window.LabMods.amb = { render, stopAll, _A: () => A };
})();
