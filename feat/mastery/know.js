/* Know: the "What I know" screen (feat/mastery/know.js). window.Know = { render(el) }.
   Opens through XView (Mastery registers XView.MODS.know) and from a row it adds to Stats. Reads window.Mastery only. */
(function () {
  'use strict';
  if (window.Know) return;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SVGP = { chev: '<path d="M9 5l7 7-7 7"/>', up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', spark: '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', check: '<path d="M5 12.5l4.2 4.2L19 7"/>', brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7 18a2.8 2.8 0 0 0 5 1.2V5.6A2.6 2.6 0 0 0 9 4.5z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-3 5.3 2.8 2.8 0 0 1-5 1.2"/>' };
  const ic = (n, s = 18, w = 1.8) => `<svg class="kn-ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVGP[n] || ''}</svg>`;
  const SRC = { learn: 'Learn', anat: 'Anatomy', doc: 'Doctordle', card: 'Cards', weak: 'Weak Spots' };
  const GO = { learn: 'learn', anat: 'anat', doc: 'doc', card: 'decks', weak: 'weak' };
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); if (m < 60) return m <= 1 ? 'just now' : m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; };
  const pctOf = th => Math.round(100 / (1 + Math.exp(-1.1 * (th + 0.2))));
  let root = null, off = null, partsCache = null;

  function ring(p, size, stroke, label, sub) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, d = c * (1 - Math.max(0, Math.min(100, p)) / 100);
    return `<span class="kn-ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--acc)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${d.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span class="kn-rl"><span class="kn-num">${label}</span>${sub ? `<small>${sub}</small>` : ''}</span></span>`;
  }
  function chart(g) {
    const W = 340, H = 120, P = 6, n = g.length, pts = g.map((x, i) => x.theta == null ? null : [P + i * (W - 2 * P) / (n - 1), H - 22 - (pctOf(x.theta) / 100) * (H - 34)]);
    const maxN = Math.max(1, ...g.map(x => x.n));
    const bars = g.map((x, i) => x.n ? `<rect x="${(P + i * (W - 2 * P) / (n - 1) - 3).toFixed(1)}" y="${(H - 4 - 14 * x.n / maxN).toFixed(1)}" width="6" height="${(14 * x.n / maxN).toFixed(1)}" rx="1.5" fill="var(--fill2)"/>` : '').join('');
    const line = pts.filter(Boolean); if (line.length < 2) return `<svg class="kn-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg><p class="kn-cap">Your growth line starts after a couple of days of quizzes.</p>`;
    const d = line.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ` L${line[line.length - 1][0].toFixed(1)} ${H - 22} L${line[0][0].toFixed(1)} ${H - 22} Z`;
    const grid = [25, 50, 75].map(v => { const y = (H - 22 - (v / 100) * (H - 34)).toFixed(1); return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width=".5"/>`; }).join('');
    const last = line[line.length - 1];
    return `<svg class="kn-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Knowledge over the last 30 days">${grid}${bars}<path d="${area}" fill="var(--acc-soft)"/><path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="var(--acc)"/></svg>`;
  }
  function trend(t) { if (Math.abs(t) < 0.05) return ''; return `<span class="kn-tr ${t > 0 ? 'up' : 'dn'}">${ic(t > 0 ? 'up' : 'down', 11, 2.4)}</span>`; }
  function tile(x) { return `<div class="kn-tile">${ring(x.pct, 64, 6, x.pct + '<i>%</i>')}<div class="kn-tn">${E(x.name)}${trend(x.trend)}</div><div class="kn-ts">${E(x.level)} · ${x.n} answer${x.n === 1 ? '' : 's'}</div></div>`; }
  function bar(x) { return `<div class="kn-row"><div class="kn-rt"><span>${E(x.name)}</span><small>${E(x.level)}${x.n ? ' · ' + x.acc + '% right' : ''}</small></div><div class="kn-bar"><i style="width:${x.pct}%"></i></div><span class="kn-rv">${x.pct}%</span></div>`; }
  function itemRow(x, kind) {
    const src = SRC[x.src] || '';
    const right = kind === 'fade' ? `<span class="kn-pill ${x.missed ? 'bad' : ''}">${x.missed ? 'Missed' : 'Fading'}</span>` : `<span class="kn-rv">${E(ago(x.at))}</span>`;
    return `<button type="button" class="kn-item" data-kn-go="${E(GO[x.src] || '')}"><span class="kn-it"><span>${E(x.label)}</span><small>${E(src)}${x.topic ? ' · ' + E(Mastery.tname(x.topic)) : ''}</small></span>${right}</button>`;
  }

  function render(el) {
    root = el || root; if (!root || !window.Mastery) return;
    if (!off) off = Mastery.on(() => { if (root && root.isConnected) paint(); });
    paint();
    if (!partsCache) Mastery.anatParts().then(p => { partsCache = p; if (root && root.isConnected) paint(); });
  }
  function paint() {
    const Ms = window.Mastery, sm = Ms.summary(), C = Ms.cfg(), all = Ms.topics(), ch = null;
    const subj = all.filter(x => Ms.TOPIC[x.k] && x.k !== 'cards' && x.n).sort((a, b) => b.n - a.n);
    if (ch) subj.push({ k: 'chess', name: 'Chess', n: ch.n || 0, pct: Math.max(0, Math.min(100, Math.round((ch.r - 400) / 20))), level: ch.r + ' rating', trend: ch.hist && ch.hist.length > 1 ? (ch.hist[ch.hist.length - 1][1] - ch.hist[Math.max(0, ch.hist.length - 8)][1]) / 100 : 0 });
    const sys = all.filter(x => x.k.startsWith('anat.sys.')).sort((a, b) => b.n - a.n || b.pct - a.pct);
    const docs = all.filter(x => x.k.startsWith('doc.') && x.n).sort((a, b) => b.n - a.n);
    const regs = all.filter(x => x.k.startsWith('anat.reg.') && x.n).sort((a, b) => b.n - a.n);
    const g = Ms.growth(30), fade = Ms.fading(6), rec = Ms.recent(6);
    const overall = g.filter(x => x.theta != null).slice(-1)[0], ov = overall ? pctOf(overall.theta) : 0;
    const lvName = overall ? Ms.LEVELS[Math.max(0, Ms.LEVELS.reduce((k, l, i) => overall.theta >= l[2] - 0.35 ? i : k, 0))][1] : 'Just starting';
    const empty = !sm.answers && !sm.viewed;
    // anatomy explored, per region
    let explored = '';
    if (partsCache && partsCache.length) {
      const V = Ms._S().V, per = {}; partsCache.forEach(p => { (p.tags || []).forEach(t => { const o = per[t] || (per[t] = [0, 0]); o[1]++; if (V[p.id]) o[0]++; }); });
      const tot = partsCache.length, seen = partsCache.filter(p => V[p.id]).length;
      const order = ['head', 'brain', 'thorax', 'abdomen', 'pelvis', 'spine', 'arm-l', 'arm-r', 'hand-l', 'hand-r', 'leg-l', 'leg-r', 'foot-l', 'foot-r'];
      explored = `<div class="kn-card"><div class="kn-ch"><b>${seen.toLocaleString()} of ${tot.toLocaleString()}</b> parts explored<span>Quizzes start where you've looked and grow outward.</span></div><div class="kn-regs">${order.filter(k => per[k]).map(k => { const o = per[k], p = Math.round(100 * o[0] / o[1]); return `<div class="kn-reg"><span>${E(Ms.REG[k] || k)}</span><div class="kn-bar sm"><i style="width:${p}%"></i></div><small>${o[0]}/${o[1]}</small></div>`; }).join('')}</div></div>`;
    }
    root.innerHTML = `<div class="kn">
      <div class="kn-hero">
        ${ring(empty ? 0 : ov, 112, 10, empty ? '—' : ov + '<i>%</i>', empty ? '' : 'overall')}
        <div class="kn-hx"><div class="kn-eyebrow">Your level</div><div class="kn-big">${E(empty ? 'Just starting' : lvName)}</div><div class="kn-sub">${empty ? 'Answer a few quizzes anywhere in the app and this fills in.' : `${sm.items.toLocaleString()} things tracked · ${sm.strong} locked in`}</div></div>
      </div>
      <div class="kn-trio"><div><b>${sm.week}</b><span>answers this week</span></div><div><b>${sm.week ? sm.weekAcc + '%' : '—'}</b><span>right this week</span></div><div><b>${sm.fading}</b><span>to review</span></div></div>

      <h3 class="kn-h">Growth</h3>
      <div class="kn-card">${chart(g)}<div class="kn-legend"><span><i class="ln"></i>Knowledge</span><span><i class="bx"></i>Answers per day</span><span class="kn-mut">Last 30 days</span></div></div>

      ${subj.length ? `<h3 class="kn-h">Subjects</h3><div class="kn-grid">${subj.map(tile).join('')}</div>` : ''}

      <h3 class="kn-h">Anatomy</h3>
      ${explored}
      ${sys.length ? `<div class="kn-card kn-list">${sys.map(bar).join('')}</div>` : '<div class="kn-card kn-empty">Tap parts in Anatomy or press Quiz me. Each system gets its own level here.</div>'}
      ${regs.length ? `<div class="kn-sublabel">By region</div><div class="kn-card kn-list">${regs.slice(0, 8).map(bar).join('')}</div>` : ''}

      ${docs.length ? `<h3 class="kn-h">Doctordle by system</h3><div class="kn-card kn-list">${docs.slice(0, 6).map(bar).join('')}</div>${docs.length > 6 ? `<p class="kn-foot">Top 6 of ${docs.length} systems you've played.</p>` : ''}` : ''}

      <h3 class="kn-h">Review these</h3>
      ${fade.length ? `<div class="kn-card kn-list">${fade.map(x => itemRow(x, 'fade')).join('')}</div><p class="kn-foot">These come back on their own inside quizzes, about a quarter of each one.</p>` : '<div class="kn-card kn-empty">Nothing is fading right now.</div>'}

      ${rec.length ? `<h3 class="kn-h">Recently learned</h3><div class="kn-card kn-list">${rec.map(x => itemRow(x, 'rec')).join('')}</div>` : ''}

      <h3 class="kn-h">Adaptive difficulty</h3>
      <div class="kn-card kn-list">
        <div class="kn-row kn-set"><div class="kn-rt"><span>Grow with me</span><small>Every quiz picks questions at your level</small></div><button type="button" class="kn-sw${C.on ? ' on' : ''}" role="switch" aria-checked="${C.on}" aria-label="Adaptive difficulty" data-kn-tog><i></i></button></div>
        <div class="kn-row kn-set col${C.on ? '' : ' dim'}"><div class="kn-rt"><span>Challenge</span><small>Aims for about ${Math.round(C.target * 100)}% right</small></div><div class="kn-seg" role="radiogroup" aria-label="Challenge">${[['gentle', 'Gentle'], ['balanced', 'Balanced'], ['challenge', 'Push me']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${C.strength === k}" class="${C.strength === k ? 'on' : ''}" data-kn-str="${k}">${l}</button>`).join('')}</div></div>
      </div>
    </div>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-kn-tog],[data-kn-str],[data-kn-go],[data-know-open]'); if (!t || !window.Mastery) return;
    if (t.hasAttribute('data-know-open')) { if (window.XView) XView.open('know'); return; }
    if (t.hasAttribute('data-kn-tog')) { Mastery.setCfg('adapt.on', !Mastery.cfg().on); paint(); return; }
    if (t.dataset.knStr) { Mastery.setCfg('adapt.strength', t.dataset.knStr); paint(); return; }
    if (t.dataset.knGo && typeof go === 'function') go(t.dataset.knGo);
  });
  // a "What I know" row at the top of Stats (added after Stats renders; no edit to stats.js needed)
  function statsRow() {
    const v = document.getElementById('v-stats'); if (!v || v.hidden || v.querySelector('[data-know-open]')) return;
    const nav = v.querySelector('.s2-nav'); const sm = window.Mastery ? Mastery.summary() : null;
    const html = `<button type="button" class="s2-row kn-srow" data-know-open><span class="s2-ic">${ic('spark', 22)}</span><span class="s2-rt">What I know</span><span class="s2-rv">${sm && sm.items ? sm.items.toLocaleString() + ' tracked' : ''}</span>${ic('chev', 16, 2.2)}</button>`;
    if (nav) nav.insertAdjacentHTML('afterbegin', html);
    else { const h = document.createElement('div'); h.className = 's2-list s2-nav kn-snav'; h.innerHTML = html; v.prepend(h); }
  }
  let mo = null;
  function watch() { const v = document.getElementById('v-stats'); if (!v || mo) return; mo = new MutationObserver(() => { mo.disconnect(); statsRow(); mo.observe(v, { childList: true, subtree: false, attributes: true, attributeFilter: ['hidden'] }); }); mo.observe(v, { childList: true, attributes: true, attributeFilter: ['hidden'] }); statsRow(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
  window.Know = { render, paint };
})();
