/* 3D Anatomy v2: BodyParts3D body (every structure named and tappable), regions, brain views, quiz. three.js lives in anat/viewer2.js (loaded on open). */
(function () {
  'use strict';
  if (window.Anatomy) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const md = s => (window.Learn && Learn.md ? Learn.md(s) : '<p>' + esc(s) + '</p>');
  const PKEY = 'anat.v1', SKEY = 'anat.ui2';
  const LV = [['kid', '5', "Like I'm 5"], ['hs', 'HS', 'High school'], ['college', 'Col', 'College'], ['phd', 'PhD', 'PhD'], ['expert', 'Dr', 'Doctor / Expert']];
  const PASS = 70;
  const SYS = [['skin', 'Skin', '#d8b49c'], ['muscular', 'Muscles', '#b23a33'], ['skeletal', 'Bones', '#e6dcc4'], ['nervous', 'Nerves & brain', '#e9b949'], ['cardiovascular', 'Heart & vessels', '#d33b3b'], ['respiratory', 'Lungs & airway', '#e594a0'], ['digestive', 'Digestive', '#d4895a'], ['urinary', 'Urinary', '#c7a23a'], ['endocrine', 'Endocrine', '#a86fc9'], ['lymphatic', 'Lymphatic', '#5bb37a']];
  const SYSN = Object.fromEntries(SYS.map(s => [s[0], s])); const sysName = k => (SYSN[k] || [k, k])[1], sysColor = k => (SYSN[k] || [0, 0, '#999'])[2];
  const SYSFULL = { skin: 'Skin', muscular: 'Muscular system', skeletal: 'Skeletal system', nervous: 'Nervous system', cardiovascular: 'Cardiovascular system', respiratory: 'Respiratory system', digestive: 'Digestive system', urinary: 'Urinary system', endocrine: 'Endocrine system', lymphatic: 'Lymphatic system' };
  const REGIONS = [['body', 'Whole body'], ['head', 'Head & neck'], ['skull', 'Skull'], ['brain', 'Brain'], ['thorax', 'Thorax'], ['abdomen', 'Abdomen'], ['pelvis', 'Pelvis'], ['spine', 'Spine'], ['arm-l', 'Left arm'], ['arm-r', 'Right arm'], ['hand-l', 'Left forearm & hand'], ['hand-r', 'Right forearm & hand'], ['leg-l', 'Left leg'], ['leg-r', 'Right leg'], ['foot-l', 'Left foot'], ['foot-r', 'Right foot']];
  const RNAME = Object.fromEntries(REGIONS);
  const RLAYERS = { skull: ['skeletal'], brain: ['nervous'], spine: ['skeletal', 'nervous'] };
  const CHUNK = { frontal: ['Frontal lobe', '#4f86f7'], parietal: ['Parietal lobe', '#f2c230'], temporal: ['Temporal lobe', '#43c07a'], occipital: ['Occipital lobe', '#ef5350'], insula: ['Insula', '#b06ad9'], limbic: ['Limbic structures', '#f39a3d'], deep: ['Deep nuclei & thalamus', '#35c3e8'], white: ['White matter & tracts', '#e8e0d4'], cerebellum: ['Cerebellum', '#8e6ad8'], brainstem: ['Brainstem', '#a98f80'], ventricles: ['Ventricles', '#2f8fe0'] };
  const CORDER = ['frontal', 'parietal', 'temporal', 'occipital', 'insula', 'limbic', 'deep', 'white', 'ventricles', 'cerebellum', 'brainstem'];
  let D = null, DESC = {}, descP = null, dataP = null, V = null, viewerP = null, built = false, root = null;
  const P = load(PKEY, {});
  const U = Object.assign({ sex: 'm', layers: ['skin', 'skeletal', 'muscular'], op: {}, lvl: 'hs', recent: [], qz: { n: 0, ok: 0, best: 0 } }, load(SKEY, {}));
  const S = { sel: null, region: 'body', mode: 'body', lesson: null, test: null, glFail: false, brain: null, quiz: null, prevLayers: null };

  let watchSet = 0;
  function safeInsets() {
    const c = $('#axCanvas'); if (!c) return null; const r = c.getBoundingClientRect(); let top = 0, bot = r.bottom, right = r.right;
    const t = root.querySelector('.ax-top'); if (t) top = t.getBoundingClientRect().bottom - r.top + 8;
    ['#axPanel', '#axBrain'].forEach(s => { const e = $(s); if (e && !e.hidden && e.offsetHeight) bot = Math.min(bot, e.getBoundingClientRect().top - 8); });
    const sd = root.querySelector('.ax-side'); if (sd && sd.offsetWidth) right = Math.min(right, sd.getBoundingClientRect().left - 4);
    return { top, bottom: r.bottom - bot, right: r.right - right, left: Math.min(r.right - right, 40) };
  }
  function anatSettings() { try { if (window.Settings && Settings.anat) return Settings.anat(); } catch (e) {} return { quality: 'high', shadows: true, autoRotate: false, sensitivity: 1, ghostOpacity: 0.12, labels: true }; }
  function labelPrefs() { if (!root) return; const A = anatSettings(); root.classList.toggle('ax-nolabels', A.labels === false); }
  (function () { try { if (localStorage.getItem(SKEY)) return; const raw = JSON.parse(localStorage.getItem('settings.v2') || '{}'); const A = anatSettings(); if ('anat.sex' in raw && A.sex) U.sex = A.sex; if ('anat.layers' in raw && Array.isArray(A.layers) && A.layers.length) U.layers = A.layers.slice(); } catch (e) {} })();
  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  const saveU = () => save(SKEY, U);
  const haptic = () => { try { window.Prefs && Prefs.haptic && Prefs.haptic(); } catch (e) {} };
  const toastMsg = m => { try { if (typeof toast === 'function') toast(m); } catch (e) {} };

  /* ---------- data ---------- */
  function data() {
    return dataP || (dataP = fetch('anat/v2/parts.json').then(r => { if (!r.ok) throw new Error('parts ' + r.status); return r.json(); }).then(d => {
      D = d; D.list = []; D.byKey = {};
      for (const id in d.parts) { const p = d.parts[id]; const o = { id, n: p[0], sys: p[1], tags: p[2], c: p[3], key: p[4], s: p[5], ch: p[6] || null }; d.parts[id] = o; D.list.push(o); (D.byKey[o.key] = D.byKey[o.key] || []).push(o); }
      return d;
    }).catch(e => { dataP = null; throw e; }));
  }
  function desc() { return descP || (descP = fetch('anat/v2/desc.json').then(r => r.ok ? r.json() : {}).then(d => { DESC = d || {}; return DESC; }).catch(() => { descP = null; return {}; })); }
  const part = id => D && D.parts[id];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  function nameOf(p) {
    if (!p) return '';
    if (p.id === 'skin') return 'Skin';
    const d = DESC[p.key];
    if (d && d.name) {
      let n = d.name; const side = p.s;
      if (p.key.startsWith('{S} ')) { const lowFirst = /^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n; return side ? cap(side) + ' ' + lowFirst : n; }
      if (n.includes('{S}')) return cap(n.replace(/\{S\}/g, side || ''));
      return n;
    }
    return cap(p.n.replace(/\bsecondary\b /g, ''));
  }
  const abbrOf = p => (DESC[p.key] && DESC[p.key].abbr) || '';
  function lessonOf(p) { const d = DESC[p.key]; return d && d.lesson && LESSONS.has(d.lesson) ? d.lesson : null; }
  const LESSONS = new Set();
  function done() { return Object.values(P).filter(x => x && x.passed).length; }
  function regionOf(p) { if (!p) return ''; const d = DESC[p.key]; return (d && d.region) || ''; }

  /* ---------- shell ---------- */
  function svg(n, s) {
    const p = { search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v3.8h3.8"/>', info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2M12 7.6v.1"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 5l7 7-7 7"/>', back: '<path d="M15 5l-7 7 7 7"/>', check: '<path d="M5 12.5l4.2 4.2L19 7"/>', layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>', brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7 18a2.8 2.8 0 0 0 5 1.2V5.6A2.6 2.6 0 0 0 9 4.5z"/><path d="M15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3.2 3.2 0 0 1-3 5.3 2.8 2.8 0 0 1-5 1.2"/>', quiz: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 16.6v.1"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>', eyeoff: '<path d="M3 3l18 18"/><path d="M10.6 6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.7M6.3 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9.6 9.6 0 0 0 4.4-1"/>', target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>', book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>' }[n] || '';
    s = s || 20; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }
  function ensureRoot() {
    if (root) return root;
    root = document.createElement('div'); root.id = 'anatRoot'; root.className = 'ax'; root.hidden = true;
    root.innerHTML = `<div class="ax-body" id="axBody">
        <div class="ax-stage" id="axStage"><canvas id="axCanvas" data-pinch aria-label="3D body. Drag to spin, pinch to zoom, tap a structure."></canvas>
          <div class="ax-labels" id="axLabels"></div>
          <div class="ax-top">
            <div class="ax-toprow"><button class="ax-search" data-axfind type="button">${svg('search', 17)}<span>Search structures</span></button>
              <div class="seg ax-sex" role="tablist" aria-label="Body"><button data-axsex="m" role="tab">M</button><button data-axsex="f" role="tab">F</button></div></div>
            <div class="ax-regions" id="axRegions" role="tablist" aria-label="Regions">${REGIONS.map(r => `<button class="ax-rchip" data-axregion="${r[0]}" role="tab">${esc(r[1])}</button>`).join('')}</div>
            <div class="ax-crumb" id="axCrumb"></div>
          </div>
          <div class="ax-side">
            <button class="ax-round" data-axlayers aria-label="Layers">${svg('layers')}</button>
            <button class="ax-round" data-axbrainbtn aria-label="Brain view" hidden>${svg('brain')}</button>
            <button class="ax-round" data-axquiz aria-label="Quiz me">${svg('quiz')}</button>
            <button class="ax-round" data-axreset aria-label="Reset view">${svg('reset')}</button>
          </div>
          <div class="ax-brain" id="axBrain" hidden></div>
          <div class="ax-load" id="axLoad" hidden><span class="ax-spin"></span><span>Loading</span></div>
          <div class="ax-gl" id="axGl" hidden></div>
        </div>
        <div class="ax-panel" id="axPanel"></div>
      </div>
      <div class="ax-page" id="axPage" hidden></div>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    ['touchstart', 'touchmove', 'touchend'].forEach(ev => root.addEventListener(ev, e => { if (e.target.closest && e.target.closest('#axCanvas,.ax-regions,input[type=range]')) e.stopPropagation(); }, { passive: true }));
    new MutationObserver(sync).observe(document.getElementById('v-anat'), { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', place);
    return root;
  }
  function place() { if (!root || root.hidden) return; const h = document.querySelector('header.top'); root.style.top = (h ? Math.max(0, h.getBoundingClientRect().bottom) : 0) + 'px'; if (V) V.render(); }
  function sync() { const sec = document.getElementById('v-anat'); const on = sec && !sec.hidden; if (!root) return; root.hidden = !on; document.body.classList.toggle('ax-on', on); if (on) { place(); if (V) V.render(); } }

  /* ---------- render ---------- */
  async function render() {
    const sec = document.getElementById('v-anat'); sec.innerHTML = '<div class="ax-ph"></div>';
    ensureRoot(); sync();
    try { await data(); await desc(); await lessonIndex(); } catch (e) { $('#axPanel').innerHTML = `<div class="ax-err">Couldn't load the body. Check your connection and try again.<br><button class="btn pri" data-axretry style="margin-top:12px">Try again</button></div>`; return; }
    paintTop(); panel();
    if (!built) { built = true; startViewer(); }
  }
  let lessonP = null;
  function lessonIndex() { return lessonP || (lessonP = fetch('anat/data.json').then(r => r.ok ? r.json() : null).then(d => { if (d) d.systems.forEach(s => s.structs.forEach(x => { if (x.lesson) LESSONS.add(x.id); })); }).catch(() => {})); }
  function startViewer() {
    let gl = null; try { const c = document.createElement('canvas'); gl = c.getContext('webgl2') || c.getContext('webgl'); } catch (e) {}
    if (!gl) return glFail();
    loading(1);
    viewerP = import(new URL('anat/viewer3.js', document.baseURI).href).then(m => {
      const A = anatSettings();
      V = m.create($('#axCanvas'), { sex: U.sex, layers: U.layers, base: 'anat/m2/', files: D.files, hi: D.hi || null, quality: A.quality, shadows: A.shadows, autoRotate: A.autoRotate, sensitivity: A.sensitivity, ghostOpacity: A.ghostOpacity, accent: getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#0a84ff', info: id => { const p = part(id); return p ? { n: p.n, s: p.s, ch: p.ch } : null; }, onLoading: n => loading(n), onPick: pick, onFrame: labels, safe: safeInsets });
      for (const k in U.op) V.setOpacity(k, U.op[k]);
      try { if (window.Settings && !watchSet) { watchSet = 1; Settings.on('anat.*', () => { if (V) V.setQuality(anatSettings()); labelPrefs(); }); } } catch (e) {}
      labelPrefs();
      return V.sync().then(f => { loading(0); if (f) toastMsg("Some layers didn't load. Check your connection."); return V; });
    }).catch(e => { console.warn('anat viewer', e); glFail(); });
  }
  function glFail() { S.glFail = true; loading(0); const g = $('#axGl'); g.hidden = false; g.innerHTML = `<div><b>3D view isn't available here</b><p class="muted small">You can still open every structure from search.</p><button class="btn pri" data-axfind>Search structures</button></div>`; }
  let loadT = 0, loadN = 0;
  function loading(n) { loadN = n; const el = $('#axLoad'); if (!el) return; clearTimeout(loadT); if (n > 0) loadT = setTimeout(() => { el.hidden = false; }, 150); else el.hidden = true; }
  function paintTop() {
    root.querySelectorAll('[data-axsex]').forEach(b => { const on = b.dataset.axsex === U.sex; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    root.querySelectorAll('[data-axregion]').forEach(b => { const on = b.dataset.axregion === S.region; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const bb = root.querySelector('[data-axbrainbtn]'); bb.hidden = !(S.region === 'brain' || S.region === 'head'); bb.classList.toggle('on', !!S.brain);
    const crumbs = [['body', 'Body']]; if (S.region !== 'body') crumbs.push([S.region, RNAME[S.region]]); if (S.sel) crumbs.push(['sel', nameOf(part(S.sel.id))]);
    $('#axCrumb').innerHTML = crumbs.map((c, i) => i < crumbs.length - 1 ? `<button data-axcrumb="${c[0]}">${esc(c[1])}</button><span aria-hidden="true">›</span>` : `<b>${esc(c[1])}</b>`).join('');
    brainPanel();
  }

  /* ---------- bottom panel ---------- */
  function panel() {
    const el = $('#axPanel'); if (!el || !D) return;
    if (S.quiz) return quizPanel();
    if (!S.sel) {
      const rec = U.recent.map(part).filter(Boolean).slice(0, 8);
      el.innerHTML = `<div class="ax-grab"></div>
        <div class="ax-ph1"><div><div class="ax-t">${esc(RNAME[S.region] || 'Whole body')}</div><div class="muted small">Tap any structure · ${D.list.length.toLocaleString()} named parts</div></div><button class="ax-link" data-axlayers>${svg('layers', 16)} Layers</button></div>
        ${rec.length ? `<div class="ax-sub">Recently viewed</div><div class="ax-recent">${rec.map(p => `<button class="ax-rec" data-axopen="${esc(p.id)}" style="--c:${sysColor(p.sys)}"><i></i>${esc(nameOf(p))}</button>`).join('')}</div>` : ''}
        <div class="ax-cta"><button class="btn grow" data-axquiz>${svg('quiz', 18)} Quiz me</button><button class="btn grow" data-axfind>${svg('search', 18)} Search</button></div>`;
      return;
    }
    const p = part(S.sel.id); if (!p) { S.sel = null; return panel(); }
    const d = DESC[p.key] || {}, les = lessonOf(p), pr = les && P[les], ab = abbrOf(p);
    el.innerHTML = `<div class="ax-grab"></div>
      <div class="ax-sh"><div class="ax-sht">
        <div class="ax-name">${esc(nameOf(p))}${ab ? `<span class="ax-abbr">${esc(ab)}</span>` : ''}</div>
        <div class="ax-sys" style="--c:${sysColor(p.sys)}"><i></i>${esc(SYSFULL[p.sys] || p.sys)}${regionOf(p) ? ` · ${esc(regionOf(p))}` : ''}</div></div>
        <button class="ax-x" data-axclear aria-label="Close">${svg('x', 16)}</button></div>
      ${d.desc ? `<p class="ax-job">${esc(d.desc)}</p>` : p.id === 'skin' ? '<p class="ax-job">The skin is the body\'s largest organ: a waterproof, self-repairing barrier that senses touch, pain and temperature and helps control body heat.</p>' : '<p class="ax-job muted">Details for this part are coming soon.</p>'}
      ${(d.clinical || []).length ? `<div class="ax-clin"><div class="ax-clh">${svg('target', 14)} Clinical</div>${d.clinical.map(c => `<p>${esc(c)}</p>`).join('')}</div>` : ''}
      <div class="ax-acts">
        ${les ? `<button class="btn pri grow" data-axlesson="${esc(les)}">${svg('book', 17)} Lesson${pr && pr.best != null ? ` · ${pr.best}%` : ''}</button>` : ''}
        <button class="btn grow" data-axhide="${esc(p.id)}">${svg('eyeoff', 17)} Hide</button>
        <button class="btn grow" data-axfocus="${esc(p.id)}">${svg('target', 17)} Focus</button>
      </div>`;
  }

  /* ---------- selection ---------- */
  function pick(hit) {
    if (S.mode !== 'body') return;
    if (S.quiz) return;
    if (!hit || !hit.id) { if (S.sel) clearSel(); return; }
    haptic(); select(hit.id, false);
  }
  function select(id, fly) {
    const p = part(id); if (!p) return;
    S.sel = { id }; if (V) V.select([id], fly);
    U.recent = [id, ...U.recent.filter(x => x !== id)].slice(0, 12); saveU(); try { if (window.Mastery) Mastery.anatView(p); } catch (e) {}
    paintTop(); panel();
    if (!P['p:' + id]) { P['p:' + id] = 1; save(PKEY, P); try { window.Hub && Hub.award('anat', 1); } catch (e) {} }
  }
  function clearSel() { S.sel = null; if (V) V.select(null); paintTop(); panel(); }
  async function ensureLayers(list) { const add = list.filter(s => !U.layers.includes(s)); if (add.length) { U.layers = [...U.layers, ...add]; saveU(); } if (V) await V.setLayers(U.layers); }
  async function openPart(id) {
    closeSheet(); const p = part(id); if (!p) return;
    S.mode = 'body'; showPage(false);
    if (viewerP) await viewerP;
    if (S.region !== 'body' && !p.tags.includes(S.region)) await setRegion('body', false);
    await ensureLayers([p.sys]);
    select(id, true);
  }

  /* ---------- regions ---------- */
  async function setRegion(r, fly) {
    S.region = r; if (S.brain && r !== 'brain' && r !== 'head') brainOff(true);
    if (S.sel && r !== 'body' && !(part(S.sel.id).tags || []).includes(r)) { S.sel = null; if (V) V.select(null, false); }
    if (r === 'body') { if (S.prevLayers) { U.layers = S.prevLayers; S.prevLayers = null; saveU(); } if (V) { await V.setLayers(U.layers); V.setOnly(null, fly !== false); } }
    else {
      if (RLAYERS[r]) { if (!S.prevLayers) S.prevLayers = U.layers.slice(); U.layers = RLAYERS[r].slice(); }
      else if (S.prevLayers) { U.layers = S.prevLayers; S.prevLayers = null; }
      saveU();
      const ids = D.list.filter(p => p.tags.includes(r)).map(p => p.id);
      if (V) { await V.setLayers(U.layers.filter(s => s !== 'skin')); V.setOnly(ids, fly !== false); }
    }
    paintTop(); panel();
    const chip = root.querySelector(`[data-axregion="${r}"]`); if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  /* ---------- brain view ---------- */
  function brainChunks() { const o = {}; D.list.forEach(p => { if (p.tags.includes('brain') && p.ch) o[p.id] = CHUNK[p.ch] ? CHUNK[p.ch][1] : '#ccc'; }); return o; }
  async function brainOn() {
    if (S.region !== 'brain') await setRegion('brain', false);
    S.brain = { mode: 'assembled', explode: 0.5, hemi: { l: true, r: true }, cut: false };
    if (V) V.brain({ chunks: brainChunks(), order: CORDER, mode: 'assembled', explode: 0, hemi: S.brain.hemi, cut: false, fly: true });
    paintTop();
  }
  function brainOff(quiet) { S.brain = null; if (V) V.brain(null); labels(null); if (!quiet) paintTop(); }
  function brainSet(cfg) { Object.assign(S.brain, cfg); if (V) V.brain({ mode: S.brain.mode, explode: S.brain.mode === 'explode' ? S.brain.explode : 0, hemi: S.brain.hemi, cut: S.brain.cut, fly: 'mode' in cfg }); brainPanel(); }
  function brainPanel() {
    const el = $('#axBrain'); if (!el) return; if (!S.brain) { el.hidden = true; el.innerHTML = ''; return; }
    const B = S.brain; el.hidden = false;
    el.innerHTML = `<div class="seg ax-bseg">${[['assembled', 'Assembled'], ['explode', 'Exploded'], ['spread', 'Spread out']].map(m => `<button class="${B.mode === m[0] ? 'on' : ''}" data-axbmode="${m[0]}">${m[1]}</button>`).join('')}</div>
      ${B.mode === 'explode' ? `<input type="range" class="ax-range" min="0" max="1" step="0.01" value="${B.explode}" data-axbexp aria-label="Explode">` : ''}
      <div class="ax-btog"><button class="ax-tog ${B.hemi.l ? 'on' : ''}" data-axbhemi="l">Left</button><button class="ax-tog ${B.hemi.r ? 'on' : ''}" data-axbhemi="r">Right</button><button class="ax-tog ${B.cut ? 'on' : ''}" data-axbcut>Midline cut</button><button class="ax-tog" data-axbkey>Key</button></div>`;
  }
  function labels(list) {
    const el = $('#axLabels'); if (!el) return;
    if (!list || !S.brain || S.brain.mode !== 'spread') { if (el.childElementCount) el.innerHTML = ''; return; }
    if (el.childElementCount !== list.length) el.innerHTML = list.map(l => { const [c, s] = l.g.split('-'); return `<span class="ax-lab" style="--c:${(CHUNK[c] || [0, '#999'])[1]}">${esc(((CHUNK[c] || [c])[0]).replace(/ lobe| structures| & .*$/, ''))}${s ? ` <em>${s === 'left' ? 'L' : 'R'}</em>` : ''}</span>`; }).join('');
    list.forEach((l, i) => { const n = el.children[i]; if (n) { n.style.transform = `translate(${l.x}px,${l.y}px) translate(-50%,0)`; n.style.opacity = l.on ? 1 : 0; } });
  }

  /* ---------- quiz ---------- */
  function quizPool() {
    const ok = p => p.id !== 'skin' && DESC[p.key] && DESC[p.key].desc && U.layers.includes(p.sys) && V && V.loaded(p.id) && (S.region === 'body' || p.tags.includes(S.region));
    return D.list.filter(ok);
  }
  async function quizStart() {
    if (!V) { toastMsg('The 3D view is still loading'); return; }
    if (S.brain && S.brain.mode !== 'assembled') brainSet({ mode: 'assembled' });
    S.quiz = { n: 0, ok: 0, streak: 0 }; S.sel = null; quizNext();
  }
  function quizNext() {
    const pool = quizPool(); if (pool.length < 4) { S.quiz = null; toastMsg('Turn on a layer with more parts to quiz'); panel(); return; }
    const big = pool.filter(p => !/branch|tributar|segmental|set of/.test(p.n)); const src = big.length >= 4 ? big : pool; { const pk = window.Mastery && Mastery.anatQuiz(src, nameOf, S.region); if (pk) { S.quiz.q = { ans: pk.ans, opts: pk.opts, given: null, at: Date.now() }; V.select([pk.ans.id], true); panel(); paintTop(); return; } }
    const ans = src[Math.floor(Math.random() * src.length)];
    const same = src.filter(p => p.sys === ans.sys && nameOf(p) !== nameOf(ans)); const opts = [ans];
    while (opts.length < 4 && same.length) { const x = same.splice(Math.floor(Math.random() * same.length), 1)[0]; if (!opts.some(o => nameOf(o) === nameOf(x))) opts.push(x); }
    while (opts.length < 4) { const x = src[Math.floor(Math.random() * src.length)]; if (!opts.some(o => nameOf(o) === nameOf(x))) opts.push(x); }
    opts.sort(() => Math.random() - 0.5);
    S.quiz.q = { ans, opts, given: null }; V.select([ans.id], true); panel(); paintTop();
  }
  function quizPanel() {
    const Q = S.quiz, q = Q.q; const el = $('#axPanel');
    el.innerHTML = `<div class="ax-grab"></div><div class="ax-qh"><div><div class="ax-t">Name the highlighted part</div><div class="muted small">${Q.ok} of ${Q.n} right${Q.streak > 1 ? ` · ${Q.streak} in a row` : ''}</div></div><button class="ax-x" data-axquizend aria-label="End quiz">${svg('x', 16)}</button></div>
      <div class="choices ax-qc">${q.opts.map((o, i) => { let c = ''; if (q.given != null) { if (o === q.ans) c = 'right'; else if (i === q.given) c = 'wrong'; } return `<button class="choice ${c}" data-axqa="${i}" ${q.given != null ? 'disabled' : ''}>${esc(nameOf(o))}</button>`; }).join('')}</div>
      ${q.given != null ? `<p class="ax-job small">${esc((DESC[q.ans.key] || {}).desc || '')}</p><div class="ax-acts"><button class="btn pri grow" data-axqnext>Next</button><button class="btn grow" data-axquizend>Done</button></div>` : ''}`;
  }
  function quizAnswer(i) {
    const Q = S.quiz, q = Q.q; if (q.given != null) return; q.given = i; Q.n++;
    const ok = q.opts[i] === q.ans; try { if (window.Mastery) Mastery.anatAnswer(q.ans, ok, q.at ? Date.now() - q.at : 0, nameOf); } catch (e) {}
    if (ok) { Q.ok++; Q.streak++; haptic(); try { window.Hub && Hub.award('anat', 3); } catch (e) {} } else { Q.streak = 0; try { if (window.Weak && Weak.addQuestion) Weak.addQuestion('qz:' + q.ans.key, 'anat', { q: 'Which structure is this? ' + ((DESC[q.ans.key] || {}).desc || ''), type: 'typed', answer: nameOf(q.ans), accept: [q.ans.n], explain: (DESC[q.ans.key] || {}).region || '' }, 'Anatomy quiz'); } catch (e) {} }
    try { window.Prefs && Prefs.sound && Prefs.sound(ok ? 'ok' : 'bad'); } catch (e) {}
    U.qz.n++; if (ok) U.qz.ok++; U.qz.best = Math.max(U.qz.best || 0, Q.streak); saveU();
    panel();
  }
  function quizEnd() { const Q = S.quiz; S.quiz = null; if (V) V.select(null, false); if (Q && Q.n) toastMsg(`${Q.ok} of ${Q.n} right`); paintTop(); panel(); }

  /* ---------- sheets ---------- */
  const mine = () => !!document.querySelector('#sheet .ax-shin');
  function openSheet(html) { const w = document.getElementById('sheetWrap'), s = document.getElementById('sheet'); s.innerHTML = '<div class="ax-shin">' + html + '</div>'; w.hidden = false; document.body.classList.add('sheet-open'); }
  function closeSheet() { if (!mine()) return; const w = document.getElementById('sheetWrap'), s = document.getElementById('sheet'); w.hidden = true; s.innerHTML = ''; document.body.classList.remove('sheet-open'); }
  function searchRows(q) {
    q = (q || '').trim().toLowerCase();
    let list = D.list.filter(p => p.id !== 'skin');
    if (q) { const words = q.split(/\s+/); list = list.filter(p => { const t = (nameOf(p) + ' ' + p.n + ' ' + abbrOf(p)).toLowerCase(); return words.every(w => t.includes(w)); }); list.sort((a, b) => { const an = nameOf(a).toLowerCase(), bn = nameOf(b).toLowerCase(); return (an.startsWith(q) ? 0 : 1) - (bn.startsWith(q) ? 0 : 1) || an.length - bn.length; }); }
    else list.sort((a, b) => SYS.findIndex(s => s[0] === a.sys) - SYS.findIndex(s => s[0] === b.sys) || nameOf(a).localeCompare(nameOf(b)));
    const total = list.length; list = list.slice(0, q ? 120 : 200);
    if (!list.length) return '<p class="muted" style="text-align:center;margin:24px 0">No match</p>';
    return `<div class="ax-list">${list.map(p => `<button class="ax-row" data-axopen="${esc(p.id)}"><i style="--c:${sysColor(p.sys)}"></i><span class="ax-rt">${esc(nameOf(p))}<small>${esc(sysName(p.sys))}${regionOf(p) ? ' · ' + esc(regionOf(p)) : ''}</small></span>${svg('chev', 15)}</button>`).join('')}</div>${total > list.length ? `<p class="muted small" style="text-align:center">${total - list.length} more · keep typing</p>` : ''}`;
  }
  function openFind() {
    openSheet(`<div class="ax-shead"><b>Search</b><button class="ax-x" data-axclose aria-label="Close">${svg('x', 16)}</button></div>
      <input type="search" id="axQ" placeholder="Try “femur”, “LAD”, “hippocampus”" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search">
      <div id="axRows" class="ax-rows">${searchRows('')}</div>${credits(true)}`);
    const q = $('#axQ'); let t = 0; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { $('#axRows').innerHTML = searchRows(q.value); }, 90); });
  }
  function openLayers() {
    openSheet(`<div class="ax-shead"><b>Layers</b><button class="ax-x" data-axclose aria-label="Close">${svg('x', 16)}</button></div>
      <div class="ax-lyr">${SYS.map(([k, n, c]) => { const on = U.layers.includes(k), op = U.op[k] != null ? U.op[k] : 1; return `<div class="ax-ly ${on ? 'on' : ''}"><button class="ax-lyt" data-axlayer="${k}" aria-pressed="${on}"><i style="--c:${c}"></i><span>${esc(n)}</span><span class="ax-sw" aria-hidden="true"></span></button><input type="range" class="ax-range" min="0.08" max="1" step="0.01" value="${op}" data-axop="${k}" aria-label="${esc(n)} opacity" ${on ? '' : 'disabled'}></div>`; }).join('')}</div>
      <div class="ax-cta"><button class="btn grow" data-axunhide>Show hidden parts</button></div>`);
  }
  function credits(small) {
    const body = `3D models from <b>BodyParts3D</b>, © The Database Center for Life Science (DBCLS), licensed under <b>CC BY-SA 2.1 Japan</b>. Simplified, compressed and recoloured for this app; the female form is adapted from the same models. <a href="https://lifesciencedb.jp/bp3d/" target="_blank" rel="noopener">lifesciencedb.jp/bp3d</a> · <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">license</a>. 3D rendering by three.js (MIT).`;
    return small ? `<p class="ax-cred small muted">${body}</p>` : body;
  }
  function openCredits() { openSheet(`<div class="ax-shead"><b>Credits</b><button class="ax-x" data-axclose aria-label="Close">${svg('x', 16)}</button></div><p class="ax-credp">${credits(false)}</p><p class="muted small">Descriptions and lessons are written for this app. They're for learning, not medical advice.</p>`); }
  function openKey() { openSheet(`<div class="ax-shead"><b>Brain colours</b><button class="ax-x" data-axclose aria-label="Close">${svg('x', 16)}</button></div><div class="ax-key">${CORDER.map(k => `<div><i style="--c:${CHUNK[k][1]}"></i>${esc(CHUNK[k][0])}</div>`).join('')}</div>`); }

  /* ---------- lesson + test (114 structure lessons) ---------- */
  const lessonCache = {};
  function getLesson(id) { return lessonCache[id] || (lessonCache[id] = fetch('anat/lessons/' + encodeURIComponent(id) + '.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { delete lessonCache[id]; throw e; })); }
  function showPage(on) { $('#axBody').hidden = on; $('#axPage').hidden = !on; if (!on && V) V.render(); if (on) $('#axPage').scrollTop = 0; }
  function pageBack() { if (S.mode === 'test' || S.mode === 'result') { S.mode = 'lesson'; rLesson(); } else { S.mode = 'body'; showPage(false); panel(); } }
  async function openLesson(id) {
    S.mode = 'lesson'; showPage(true);
    const pg = $('#axPage'); pg.innerHTML = '<div class="ax-pgload"><span class="ax-spin"></span></div>';
    try { S.lesson = await getLesson(id); } catch (e) { pg.innerHTML = `${bar('Body')}<div class="ax-err">Couldn't load this lesson. Check your connection.<br><button class="btn pri" data-axlesson="${esc(id)}" style="margin-top:12px">Try again</button></div>`; return; }
    if (!P[id] || !P[id].read) { P[id] = Object.assign({}, P[id], { read: Date.now() }); save(PKEY, P); try { window.Hub && Hub.award('lesson'); } catch (e) {} }
    rLesson();
  }
  function bar(label) { return `<div class="ax-bar"><button class="ax-back" data-axback>${svg('back')}<span>${esc(label)}</span></button></div>`; }
  function rLesson() {
    const l = S.lesson, lvl = U.lvl, p = P[l.id] || {};
    $('#axPage').innerHTML = `${bar('Body')}<div class="ax-pgin">
      <div class="ax-sys" style="--c:${sysColor(l.system)}"><i></i>${esc(SYSFULL[l.system] || l.system)}</div>
      <h2>${esc(l.name)}</h2>
      <div class="seg" role="tablist" aria-label="Level">${LV.map(v => `<button role="tab" class="${v[0] === lvl ? 'on' : ''}" data-axlv="${v[0]}" aria-selected="${v[0] === lvl}"><i class="lvm">${v[1]}</i></button>`).join('')}</div>
      <div class="ax-lvname">${esc(LV.find(v => v[0] === lvl)[2])} version</div>
      <article class="ltext">${md(l.levels[lvl] || l.levels.hs || '')}</article>
      <h3>Key points</h3><ul class="kp">${(l.keyPoints || []).map(k => `<li>${md(k).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</ul>
      <button class="btn pri wide" data-axtest style="margin-top:16px">Take the test · ${(l.test || []).length} questions</button>
      <p class="muted small" style="text-align:center">Pass mark ${PASS}%. Retakes allowed.${p.best != null ? ' Best so far: ' + p.best + '%.' : ''}</p></div>`;
  }
  function startTest() { S.test = { qs: S.lesson.test || [], i: 0, ans: [] }; S.mode = 'test'; rTest(); }
  function rTest() {
    const T = S.test, q = T.qs[T.i], a = T.ans[T.i], n = T.qs.length; let body;
    if (q.type === 'mc') body = `<div class="choices">${q.choices.map((ch, j) => { let c = ''; if (a) { if (j === q.answer) c = 'right'; else if (j === a.given) c = 'wrong'; } return `<button class="choice ${c}" data-axch="${j}" ${a ? 'disabled' : ''}>${esc(ch)}</button>`; }).join('')}</div>`;
    else body = `<form id="axTyped" class="typed" autocomplete="off"><input type="text" id="axAns" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type your answer" value="${a ? esc(a.given) : ''}" ${a ? 'disabled' : ''} class="${a ? (a.ok ? 'right' : 'wrong') : ''}"><button class="btn pri" ${a ? 'disabled' : ''}>Check</button></form>${a && !a.ok ? `<div class="corr">Answer: <b>${esc(q.answer)}</b></div>` : ''}`;
    $('#axPage').innerHTML = `${bar('Quit test')}<div class="ax-pgin">
      <div class="tprog"><span>Question ${T.i + 1} of ${n}</span><span class="muted">${esc(S.lesson.name)}</span></div><div class="pbar"><b style="width:${(T.i + (a ? 1 : 0)) / n * 100}%"></b></div>
      <div class="qcard"><div class="qtype">${q.type === 'mc' ? 'Multiple choice' : 'Type the answer'}</div><div class="qq">${md(q.q)}</div>${body}
      ${a ? `<div class="expl ${a.ok ? 'ok' : 'bad'}"><b>${a.ok ? 'Correct.' : 'Not quite.'}</b> ${md(q.explain).replace(/^<p>|<\/p>$/g, '')}</div><button class="btn pri wide" data-axnext style="margin-top:14px">${T.i + 1 < n ? 'Next question' : 'See results'}</button>` : ''}</div></div>`;
    if (!a && q.type !== 'mc') { const f = $('#axTyped'); f.onsubmit = e => { e.preventDefault(); const v = $('#axAns').value; if (!v.trim()) return; answer(v, right(q, v)); }; }
  }
  function right(q, v) { if (window.Learn && Learn.isRight) return Learn.isRight(q, v); const n = s => String(s || '').toLowerCase().trim(); return [q.answer, ...(q.accept || [])].map(n).includes(n(v)); }
  function answer(given, ok) { const T = S.test; T.ans[T.i] = { given, ok }; try { window.Prefs && Prefs.sound && Prefs.sound(ok ? 'ok' : 'bad'); } catch (e) {} if (ok) haptic(); rTest(); }
  function hash(s) { return [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36); }
  function finish() {
    const T = S.test, l = S.lesson, ok = T.ans.filter(a => a && a.ok).length, score = Math.round(ok / T.qs.length * 100), passed = score >= PASS;
    const p = P[l.id] || {}; P[l.id] = Object.assign({}, p, { at: Date.now(), last: score, best: Math.max(score, p.best || 0), passed: p.passed || passed ? 1 : 0, tries: (p.tries || 0) + 1 }); save(PKEY, P);
    try { window.Hub && Hub.award('test', 10 + Math.round(score / 10) + (passed ? 10 : 0)); } catch (e) {}
    let miss = 0;
    try { if (window.Weak && Weak.addQuestion) T.qs.forEach((q, i) => { if (!(T.ans[i] && T.ans[i].ok)) { miss++; Weak.addQuestion(l.id + ':' + hash(q.q), 'anat', { q: q.q, type: q.type, choices: q.choices, answer: q.answer, accept: q.accept, explain: q.explain }, 'Anatomy · ' + l.name); } }); } catch (e) { console.warn('weak', e); }
    if (miss) setTimeout(() => toastMsg(`${miss} missed question${miss === 1 ? '' : 's'} → Weak Spots`), 400);
    T.score = score; T.passed = passed; S.mode = 'result'; rResult();
  }
  function rResult() {
    const T = S.test, l = S.lesson, miss = T.qs.map((q, i) => [q, i]).filter(([, i]) => !(T.ans[i] && T.ans[i].ok));
    $('#axPage').innerHTML = `${bar(l.name)}<div class="ax-pgin">
      <div class="result ${T.passed ? 'pass' : 'fail'}"><div class="big">${T.score}%</div><div class="rl">${T.passed ? '✓ Passed' : 'Not passed yet'}</div><div class="muted small">${T.qs.length - miss.length} of ${T.qs.length} correct · pass mark ${PASS}%</div></div>
      <div class="row" style="margin:14px 0;display:flex;gap:10px"><button class="btn grow" data-axtest>↻ Retake</button><button class="btn pri grow" data-axbody>Back to the body</button></div>
      ${miss.length ? `<h3>Missed (${miss.length}) · saved to Weak Spots</h3><div class="misses">${miss.map(([q]) => `<div class="miss"><div class="qq">${md(q.q)}</div><div class="ma">Answer: <b>${esc(q.type === 'mc' ? q.choices[q.answer] : q.answer)}</b></div><div class="muted small">${md(q.explain).replace(/^<p>|<\/p>$/g, '')}</div></div>`).join('')}</div>` : '<div class="empty small">Perfect score.</div>'}</div>`;
  }

  /* ---------- events ---------- */
  function onInput(e) {
    const t = e.target;
    if (t.dataset.axbexp != null && S.brain) { S.brain.explode = +t.value; if (V) V.brain({ explode: S.brain.explode }); }
  }
  document.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.axop && mine()) { U.op[t.dataset.axop] = +t.value; saveU(); if (V) V.setOpacity(t.dataset.axop, +t.value); } });
  async function onClick(e) {
    const t = e.target.closest('button,a'); if (!t || !root.contains(t)) return;
    const d = t.dataset;
    if (d.axsex) { if (U.sex === d.axsex) return; haptic(); U.sex = d.axsex; saveU(); paintTop(); if (V) { await V.setSex(U.sex); if (S.region !== 'body') await setRegion(S.region, false); if (S.sel) V.select([S.sel.id], false); } return; }
    if (d.axregion) { haptic(); if (S.quiz) quizEnd(); await setRegion(d.axregion); return; }
    if (d.axcrumb) { if (d.axcrumb === 'body') { clearSel(); await setRegion('body'); } else { clearSel(); if (V) V.frameVisible(); } return; }
    if ('axlayers' in d) { openLayers(); return; }
    if ('axbrainbtn' in d) { if (S.brain) brainOff(); else await brainOn(); return; }
    if (d.axbmode) { haptic(); brainSet({ mode: d.axbmode }); return; }
    if (d.axbhemi) { const h = Object.assign({}, S.brain.hemi); h[d.axbhemi] = !h[d.axbhemi]; if (!h.l && !h.r) h[d.axbhemi === 'l' ? 'r' : 'l'] = true; brainSet({ hemi: h }); return; }
    if ('axbcut' in d) { brainSet({ cut: !S.brain.cut }); return; }
    if ('axbkey' in d) { openKey(); return; }
    if ('axquiz' in d) { if (S.quiz) quizEnd(); else quizStart(); return; }
    if (d.axqa != null && d.axqa !== '') { quizAnswer(+d.axqa); return; }
    if ('axqnext' in d) { quizNext(); return; }
    if ('axquizend' in d) { quizEnd(); return; }
    if ('axreset' in d) { haptic(); if (S.quiz) quizEnd(); clearSel(); if (V) { V.unhideAll(); if (S.region === 'body') V.resetView(); else V.frameVisible(); } return; }
    if ('axfind' in d) { openFind(); return; }
    if ('axclear' in d) { clearSel(); return; }
    if (d.axhide) { if (V) V.hide(d.axhide, true); toastMsg('Hidden · Layers → Show hidden parts'); clearSel(); return; }
    if (d.axfocus) { if (V) V.focus([d.axfocus], 1.6); return; }
    if (d.axopen) { openPart(d.axopen); return; }
    if (d.axlesson) { openLesson(d.axlesson); return; }
    if ('axback' in d) { if (S.mode === 'test' && S.test && S.test.ans.length && !confirm('Quit the test?')) return; pageBack(); return; }
    if (d.axlv) { U.lvl = d.axlv; saveU(); rLesson(); return; }
    if ('axtest' in d) { startTest(); return; }
    if (d.axch != null && d.axch !== '') { const q = S.test.qs[S.test.i]; answer(+d.axch, +d.axch === q.answer); return; }
    if ('axnext' in d) { const T = S.test; if (T.i + 1 < T.qs.length) { T.i++; rTest(); } else finish(); return; }
    if ('axbody' in d) { S.mode = 'body'; showPage(false); panel(); return; }
    if ('axretry' in d) { render(); return; }
  }
  document.addEventListener('click', async e => {
    if (!mine()) return;
    const o = e.target.closest('[data-axopen]'); if (o) { openPart(o.dataset.axopen); return; }
    const ly = e.target.closest('[data-axlayer]');
    if (ly) { haptic(); const k = ly.dataset.axlayer, on = U.layers.includes(k); U.layers = on ? U.layers.filter(x => x !== k) : [...U.layers, k]; saveU(); const row = ly.closest('.ax-ly'); row.classList.toggle('on', !on); ly.setAttribute('aria-pressed', !on); const r = row.querySelector('input'); if (r) r.disabled = on; if (V) { if (S.region === 'body') await V.setLayers(U.layers); else { await V.setLayers(U.layers.filter(s => s !== 'skin')); } } return; }
    if (e.target.closest('[data-axunhide]')) { if (V) V.unhideAll(); closeSheet(); return; }
    if (e.target.closest('[data-axclose]')) { closeSheet(); return; }
    if (e.target.id === 'sheetWrap') closeSheet();
  });

  /* ---------- side menu (Nav) ---------- */
  function menu() {
    return [
      { label: 'Search structures', icon: 'search', act: () => openFind() },
      { label: 'Layers', icon: 'layers', act: () => openLayers() },
      { label: 'Brain views', icon: 'brain', act: () => brainOn() },
      { label: 'Quiz me', icon: 'quiz', act: () => quizStart() },
      { head: 'Regions' }, ...REGIONS.map(r => ({ label: r[1], act: () => setRegion(r[0]), on: S.region === r[0] })),
      { head: 'More' }, { label: 'Credits', icon: 'info', act: () => openCredits() },
    ];
  }
  function sub() { const n = done(); return n ? `3D body · ${n} lessons passed` : '3D body · 1,600+ parts'; }
  function badge() { return ''; }
  window.Anatomy = { render, sub, badge, menu, svg, _S: S, _U: U, _V: () => V, _D: () => D, nameOf: id => nameOf(part(id)) };
})();
