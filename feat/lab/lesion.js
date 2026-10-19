/* Neuro lesion locator: read the symptoms, tap where the lesion is on 4 diagrams (cortex, deep axial, brainstem + cerebellum, spinal cord). */
(function () {
  'use strict';
  const L = window.Lab, esc = L.esc, ic = L.ic;
  const SIDE = { L: 'Left', R: 'Right' };
  const NAME = {
    pfc: 'prefrontal cortex', mleg: 'motor/sensory strip, leg area (medial)', mfa: 'precentral gyrus, face + arm area', sens: 'postcentral gyrus (sensory cortex)', broca: "inferior frontal gyrus (Broca's area on the left)",
    par: 'parietal lobe (inferior parietal / angular gyrus)', wern: "posterior superior temporal gyrus (Wernicke's area on the left)", temp: 'temporal lobe', occ: 'occipital lobe (visual cortex)', cbh: 'cerebellar hemisphere',
    caud: 'caudate nucleus', put: 'putamen (basal ganglia)', ic: 'internal capsule', thal: 'thalamus',
    mid_m: 'midbrain, medial', mid_l: 'midbrain, lateral', pons_m: 'pons, medial', pons_l: 'pons, lateral', med_m: 'medulla, medial', med_l: 'medulla, lateral'
  };
  const CORD = { c14: 'C1–C4 cord', c58: 'C5–C8 cord', t16: 'T1–T6 cord', t712: 'T7–T12 cord' };
  function rname(id) {
    if (id === 'vermis') return 'Cerebellar vermis (midline)';
    if (id === 'cauda') return 'Cauda equina (nerve roots below the cord)';
    if (id === 'sc_conus') return 'Conus medullaris (end of the cord)';
    let m = /^sc_(\w+)_(L|R)$/.exec(id); if (m) return CORD[m[1]] + ', ' + SIDE[m[2]].toLowerCase() + ' half';
    m = /^(L|R)_(.+)$/.exec(id); if (m) return SIDE[m[1]] + ' ' + (NAME[m[2]] || m[2]);
    return id;
  }
  const VIEWS = [['cortex', 'Cortex'], ['deep', 'Deep'], ['stem', 'Brainstem'], ['cord', 'Spinal cord']];
  const P = (id, pts) => `<polygon class="lz" data-r="${id}" points="${pts}"/>`;
  function cortexSVG(side) {
    const s = side, g = [
      P(s + '_pfc', '60,155 40,150 25,110 40,60 90,25 150,17 128,80 118,108 85,122 80,152'),
      P(s + '_broca', '85,122 118,108 111,141 95,150 80,152'),
      P(s + '_mleg', '150,17 175,16 161,55 138,55'),
      P(s + '_mfa', '138,55 161,55 132,139 111,141 118,108 128,80'),
      P(s + '_sens', '175,16 200,22 158,133 132,139'),
      P(s + '_par', '200,22 230,25 265,45 258,95 225,128 205,120 175,128 158,133'),
      P(s + '_wern', '175,128 205,120 225,128 222,150 185,152'),
      P(s + '_temp', '95,150 175,128 185,152 222,150 240,165 200,185 130,190 95,180 80,160'),
      P(s + '_occ', '265,45 285,60 300,110 285,150 250,170 240,165 222,150 225,128 258,95'),
      `<path class="lz" data-r="${s}_cbh" d="M232 178 C 245 168, 285 160, 296 176 C 302 196, 270 214, 246 206 C 232 200, 226 188, 232 178 Z"/>`,
      '<path class="lz-dec" d="M214 186 L 222 222 L 234 222 L 236 196 Z"/>',
      '<path class="lz-edge" d="M60 155 L40 150 L25 110 L40 60 L90 25 L150 17 L175 16 L200 22 L230 25 L265 45 L285 60 L300 110 L285 150 L250 170 L200 185 L130 190 L95 180 L80 160 Z"/>',
      '<path class="lz-sulc" d="M95 150 L205 120 M175 16 L132 139"/>'
    ].join('');
    const flip = s === 'R' ? ' transform="translate(320,0) scale(-1,1)"' : '';
    const front = s === 'L' ? '<text x="14" y="222" class="lz-t">◀ front</text>' : '<text x="306" y="222" text-anchor="end" class="lz-t">front ▶</text>';
    return `<svg viewBox="0 0 320 232" class="lz-svg" role="img" aria-label="${SIDE[s]} hemisphere, side view"><g${flip}>${g}</g>${front}<text x="160" y="226" text-anchor="middle" class="lz-t b">${SIDE[s]} hemisphere, seen from the ${s === 'L' ? 'left' : 'right'}</text></svg>`;
  }
  function deepSVG() {
    let g = '<ellipse class="lz-dec soft" cx="160" cy="128" rx="128" ry="112"/>';
    for (const s of ['R', 'L']) {
      const x = d => s === 'R' ? 160 - d : 160 + d, pts = a => a.map(([d, y]) => x(d) + ',' + y).join(' ');
      g += `<polygon class="lz" data-r="${s}_occ" points="${pts([[4, 200], [60, 205], [100, 196], [118, 186], [96, 224], [50, 238], [4, 240]])}"/>`;
      g += `<ellipse class="lz" data-r="${s}_caud" cx="${x(24)}" cy="96" rx="11" ry="17"/>`;
      g += `<ellipse class="lz" data-r="${s}_put" cx="${x(70)}" cy="132" rx="15" ry="36"/>`;
      g += `<polygon class="lz" data-r="${s}_ic" points="${pts([[34, 80], [46, 84], [56, 128], [46, 178], [34, 176], [42, 128]])}"/>`;
      g += `<ellipse class="lz" data-r="${s}_thal" cx="${x(19)}" cy="150" rx="14" ry="23"/>`;
    }
    g += '<path class="lz-dec" d="M160 18 V 238" stroke-dasharray="4 4"/><path class="lz-dec soft" d="M150 72 q -8 22 0 46 M170 72 q 8 22 0 46"/>';
    return `<svg viewBox="0 0 320 262" class="lz-svg" role="img" aria-label="Axial slice at the level of the internal capsule"><text x="14" y="20" class="lz-t b">R</text><text x="306" y="20" text-anchor="end" class="lz-t b">L</text>${g}<text x="160" y="258" text-anchor="middle" class="lz-t">Axial slice, scan view: patient's right on your left · front at top</text></svg>`;
  }
  function stemSVG() {
    const lv = [['mid', 22, 76, 92, 228], ['pons', 84, 162, 72, 248], ['med', 170, 228, 100, 220]];
    let g = '';
    for (const [k, y0, y1, xa, xb] of lv) {
      const w = (xb - xa) / 4, h = y1 - y0;
      g += `<rect class="lz" data-r="R_${k}_l" x="${xa}" y="${y0}" width="${w}" height="${h}" rx="10"/><rect class="lz" data-r="R_${k}_m" x="${xa + w}" y="${y0}" width="${w}" height="${h}"/><rect class="lz" data-r="L_${k}_m" x="${xa + 2 * w}" y="${y0}" width="${w}" height="${h}"/><rect class="lz" data-r="L_${k}_l" x="${xb - w}" y="${y0}" width="${w}" height="${h}" rx="10"/>`;
      g += `<text x="160" y="${(y0 + y1) / 2 + 4}" text-anchor="middle" class="lz-t lv">${{ mid: 'Midbrain', pons: 'Pons', med: 'Medulla' }[k]}</text>`;
    }
    g += '<path class="lz-dec" d="M160 20 V 230" stroke-dasharray="3 4"/>';
    g += '<ellipse class="lz" data-r="R_cbh" cx="34" cy="168" rx="30" ry="56"/><ellipse class="lz" data-r="L_cbh" cx="286" cy="168" rx="30" ry="56"/>';
    g += '<rect class="lz" data-r="vermis" x="122" y="240" width="76" height="34" rx="14"/><text x="160" y="262" text-anchor="middle" class="lz-t lv">Vermis</text>';
    g += '<text x="34" y="236" text-anchor="middle" class="lz-t">R cbl</text><text x="286" y="236" text-anchor="middle" class="lz-t">L cbl</text>';
    return `<svg viewBox="0 0 320 300" class="lz-svg" role="img" aria-label="Brainstem from the front with cerebellum"><text x="14" y="18" class="lz-t b">R</text><text x="306" y="18" text-anchor="end" class="lz-t b">L</text><text x="66" y="16" class="lz-t" text-anchor="middle">lateral</text><text x="254" y="16" class="lz-t" text-anchor="middle">lateral</text><text x="160" y="16" class="lz-t" text-anchor="middle">medial</text>${g}<text x="160" y="294" text-anchor="middle" class="lz-t">Front view · patient's right on your left</text></svg>`;
  }
  function cordSVG() {
    const seg = [['c14', 14, 64], ['c58', 64, 116], ['t16', 116, 168], ['t712', 168, 218]];
    let g = '';
    for (const [k, y0, y1] of seg) {
      g += `<rect class="lz" data-r="sc_${k}_R" x="124" y="${y0}" width="36" height="${y1 - y0}"/><rect class="lz" data-r="sc_${k}_L" x="160" y="${y0}" width="36" height="${y1 - y0}"/>`;
      g += `<text x="112" y="${(y0 + y1) / 2 + 4}" text-anchor="end" class="lz-t lv">${{ c14: 'C1–C4', c58: 'C5–C8', t16: 'T1–T6', t712: 'T7–T12' }[k]}</text>`;
    }
    g += '<path class="lz" data-r="sc_conus" d="M124 218 H 196 L 168 246 H 152 Z"/><text x="112" y="236" text-anchor="end" class="lz-t lv">Conus</text>';
    g += '<g class="lz" data-r="cauda"><rect x="128" y="248" width="64" height="40" rx="8" class="lz-hit"/>' + [0, 1, 2, 3, 4, 5, 6].map(i => `<path class="lz-root" d="M${148 + i * 4} 248 L ${136 + i * 8} 286"/>`).join('') + '</g><text x="112" y="272" text-anchor="end" class="lz-t lv">Cauda equina</text>';
    g += '<path class="lz-dec" d="M160 14 V 218" stroke-dasharray="3 4"/>';
    g += '<text x="208" y="90" class="lz-t">← diaphragm C3–5</text><text x="208" y="148" class="lz-t">← nipples T4</text><text x="208" y="200" class="lz-t">← navel T10</text>';
    return `<svg viewBox="0 0 320 300" class="lz-svg" role="img" aria-label="Spinal cord levels"><text x="142" y="10" text-anchor="middle" class="lz-t b">R</text><text x="178" y="10" text-anchor="middle" class="lz-t b">L</text>${g}</svg>`;
  }
  const kind = id => id === 'vermis' ? 'cbh' : id === 'cauda' ? 'sc' : id.startsWith('sc_') ? 'sc' : id.replace(/^(L|R)_/, '').replace(/_(m|l)$/, '');
  const tint = svg => svg.replace(/class="lz" data-r="([^"]+)"/g, (m, id) => `class="lz k-${kind(id)}" data-r="${id}"`);
  let S = null, ITEMS = null;
  function render(el) {
    S = { el, mode: 'menu', view: 'cortex', side: 'L' };
    if (!el.__lz) { el.__lz = 1; el.addEventListener('click', onClick); }
    el.innerHTML = '<div class="lb"><div class="lb-load">Loading…</div></div>';
    L.json('feat/lab/lesions.json').then(d => { ITEMS = d.items; if (S && S.el === el) paint(); }).catch(() => { el.innerHTML = '<div class="lb"><div class="lb-empty">Couldn\'t load. Check your connection.</div></div>'; });
  }
  function paint() {
    if (!S || !S.el.isConnected) return;
    if (S.mode === 'menu') {
      const st = L.stat('lesion');
      S.el.innerHTML = `<div class="lb">${L.top('Lesion locator', st ? `${st.n}/${ITEMS.length} tried` : '', 'lab')}<p class="muted lb-p">Read the symptoms, then tap where the lesion is. Switch between the cortex, deep structures, brainstem and spinal cord. ${ITEMS.length} cases.</p>
        <div class="lb-card lz-intro"><b>Rules of thumb</b><ul><li>Cortex and internal capsule: signs on the <i>opposite</i> side.</li><li>Cerebellum: signs on the <i>same</i> side.</li><li>Brainstem: cranial nerve on the same side + body on the opposite side ("crossed").</li><li>Cord: a sensory level; dorsal columns cross high, pain fibres cross low.</li></ul></div>
        <div class="lb-btns"><button class="btn pri" data-lz-start="10" type="button">Round of 10</button><button class="btn" data-lz-start="all" type="button">All ${ITEMS.length}</button></div></div>`;
      return;
    }
    if (S.mode === 'end') {
      const pct = Math.round(100 * S.ok / S.q.length);
      S.el.innerHTML = `<div class="lb">${L.top('', '', 'lab')}<div class="lb-card sim-res"><div class="lz-big">${S.ok}/${S.q.length}</div><div class="sim-verd ${pct >= 70 ? 'ok' : 'bad'}">${pct >= 70 ? 'Sharp localisation' : 'Keep at it'}</div><div class="muted small">${S.firstTry} right on the first tap</div></div>
        ${S.miss.length ? `<div class="lb-card sim-sec"><h3>Review these</h3><ul>${S.miss.map(m => `<li><b>${esc(rname(m.ans[0]))}</b> ${esc(m.sx)}</li>`).join('')}</ul></div>` : ''}
        <div class="lb-btns"><button class="btn" data-lz-menu type="button">Done</button><button class="btn pri" data-lz-start="10" type="button">Another round</button></div></div>`;
      return;
    }
    const it = S.q[S.i], done = S.state !== 'ask';
    const svg = tint(S.view === 'cortex' ? cortexSVG(S.side) : S.view === 'deep' ? deepSVG() : S.view === 'stem' ? stemSVG() : cordSVG());
    S.el.innerHTML = `<div class="lb">${L.top('', `${S.i + 1} / ${S.q.length} · ${S.ok} right`, 'lab')}
      <div class="rx-bar lb-bar"><i style="width:${100 * S.i / S.q.length}%"></i></div>
      <div class="lb-card lz-sx"><span class="lz-k">Symptoms</span><p>${esc(it.sx)}</p></div>
      <div class="pseg lb-seg lz-views">${VIEWS.map(([k, l]) => `<button type="button" class="${S.view === k ? 'on' : ''}" data-lz-view="${k}">${l}</button>`).join('')}</div>
      ${S.view === 'cortex' ? `<div class="pseg lb-seg sm">${['L', 'R'].map(x => `<button type="button" class="${S.side === x ? 'on' : ''}" data-lz-side="${x}">${SIDE[x]} hemisphere</button>`).join('')}</div>` : ''}
      <div class="lz-wrap${done ? ' done' : ''}">${svg}</div>
      <div class="lz-fb lb-anchor">${S.fb || '<span class="muted small">Tap a region. Wrong taps show what you hit.</span>'}</div>
      ${done ? `<button class="btn pri lb-wide" data-lz-next type="button">${S.i + 1 < S.q.length ? 'Next case →' : 'See results'}</button>` : `<button class="btn lb-wide" data-lz-give type="button">Show me</button>`}</div>`;
    const svgEl = S.el.querySelector('.lz-svg');
    if (svgEl) {
      for (const r of S.tried) { const n = svgEl.querySelector(`[data-r="${r}"]`); if (n) n.classList.add('wrong'); }
      if (done) for (const a of it.ans) { const n = svgEl.querySelector(`[data-r="${a}"]`); if (n) n.classList.add('right'); }
    }
  }
  function start(n) {
    const pool = L.shuffle(ITEMS); S.q = n === 'all' ? pool : pool.slice(0, 10);
    S.i = 0; S.ok = 0; S.firstTry = 0; S.miss = []; S.mode = 'play'; next0();
  }
  function next0() { S.state = 'ask'; S.tried = []; S.fb = ''; S.t0 = Date.now(); paint(); window.scrollTo(0, 0); }
  function finish(right) {
    const it = S.q[S.i]; S.state = right ? 'right' : 'shown';
    const sc = right ? (S.tried.length === 0 ? 1 : S.tried.length === 1 ? 0.6 : 0.3) : 0;
    if (right) S.ok++; if (right && !S.tried.length) S.firstTry++; if (!right || S.tried.length) S.miss.push(it);
    L.mastery({ id: 'LZ:' + it.id, tags: ['neurology'], score: sc, ms: Date.now() - S.t0, choices: 6, label: 'Lesion: ' + it.sx.slice(0, 60), src: 'lesion' });
    L.result('lesion', it.id, sc * 100);
    // jump to the view that holds the answer
    const a = it.ans[0]; S.view = it.v; if (it.v === 'cortex') S.side = a[0] === 'R' ? 'R' : 'L';
    S.fb = `<div class="lz-ans ${right ? 'ok' : 'bad'}">${right ? ic('check', 17) + ' ' + (S.tried.length ? 'Got it' : 'Spot on') : 'Here it is'}: <b>${esc(it.ans.map(rname).join(' / '))}</b></div><p class="lz-why">${esc(it.why)}</p>`;
    L.fx(right); paint();
  }
  function tap(r) {
    if (S.state !== 'ask') return; const it = S.q[S.i];
    if (it.ans.includes(r)) { finish(true); return; }
    if (!S.tried.includes(r)) S.tried.push(r);
    try { Prefs.sound('bad'); } catch (e) {}
    S.fb = `<div class="lz-ans bad">${ic('x', 16)} That's the <b>${esc(rname(r))}</b>. Try again.</div>`;
    if (S.tried.length >= 3) { finish(false); return; }
    paint();
  }
  function onClick(e) {
    if (!S) return; const t = e.target;
    const z = t.closest('[data-r]'); if (z && S.mode === 'play') { tap(z.dataset.r); return; }
    const v = t.closest('[data-lz-view]'); if (v) { S.view = v.dataset.lzView; paint(); return; }
    const sd = t.closest('[data-lz-side]'); if (sd) { S.side = sd.dataset.lzSide; paint(); return; }
    const st = t.closest('[data-lz-start]'); if (st) { start(st.dataset.lzStart); return; }
    if (t.closest('[data-lz-give]')) { finish(false); return; }
    if (t.closest('[data-lz-next]')) { if (S.i + 1 < S.q.length) { S.i++; next0(); } else { L.award('lesion', 3 * S.ok); S.mode = 'end'; paint(); window.scrollTo(0, 0); } return; }
    if (t.closest('[data-lz-menu]')) { S.mode = 'menu'; paint(); return; }
  }
  window.LabMods.lesion = { render, rname, _S: () => S };
})();
