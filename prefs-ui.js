/* App Settings screen (gear on home), tab-bar icons, edge-swipe back and settings sync. Loaded after app.js. */
'use strict';
(function () {
  const I = (n, s) => Prefs.icon(n, s);
  const V = () => Prefs.v;
  const LEVELS = [['kid', '5'], ['hs', 'HS'], ['college', 'College'], ['phd', 'PhD'], ['expert', 'Dr']];
  const TILE_NAMES = { cards: 'Cards', doc: 'Doctordle', anat: 'Anatomy', me: 'Me', work: 'Files' };
  const TILE_IC = { cards: 'cards', doc: 'doc', anat: 'anat', me: 'me', work: 'folder' };
  const ICONS = [['default', 'Classic', '#0a84ff'], ['mint', 'Mint', '#30d158'], ['ember', 'Ember', '#ff9f0a'], ['mono', 'Mono', '#e5e5ea']];
  const sw = (on, path) => `<button class="sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-p-tog="${path}" type="button"><i></i></button>`;
  const seg = (path, cur, opts) => `<div class="pseg" role="radiogroup">${opts.map(([v, l]) => `<button type="button" class="${String(cur) === String(v) ? 'on' : ''}" data-p-set="${path}" data-v="${v}" role="radio" aria-checked="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
  const row = (label, ctl, sub) => `<div class="prow"><div class="prow-l"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div><div class="prow-c">${ctl}</div></div>`;
  const block = (label, ctl, sub) => `<div class="prow col"><div class="prow-l"><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>${ctl}</div>`;
  const group = (title, body, foot) => `<h3>${title}</h3><div class="pgroup">${body}</div>${foot ? `<p class="pfoot">${foot}</p>` : ''}`;
  function render() {
    if (window.SettingsUI) return SettingsUI.render();
    const v = V(), el = $('#v-prefs'); if (!el) return;
    const accents = Prefs.ACCENTS.map(([n, c]) => `<button type="button" class="acc-sw${v.accent.toLowerCase() === c ? ' on' : ''}" style="--c:${c}" data-p-set="accent" data-v="${c}" aria-label="${n}"></button>`).join('')
      + `<label class="acc-sw custom${Prefs.ACCENTS.some(a => a[1] === v.accent.toLowerCase()) ? '' : ' on'}" style="--c:${esc(v.accent)}" aria-label="Custom color"><input type="color" value="${esc(v.accent)}" data-p-color="accent"></label>`;
    const tiles = v.home.order.map(k => `<div class="tile-row" data-tk="${k}"><span class="tile-grip" aria-label="Drag to reorder">${I('grip', 18)}</span><span class="tile-ic">${I(TILE_IC[k] || k, 18)}</span><span class="tile-nm">${TILE_NAMES[k] || k}</span><button type="button" class="tile-eye${v.home.hidden.includes(k) ? ' off' : ''}" data-p-hide="${k}" aria-label="${v.home.hidden.includes(k) ? 'Show' : 'Hide'} ${TILE_NAMES[k] || k}">${I(v.home.hidden.includes(k) ? 'eyeoff' : 'eye', 20)}</button></div>`).join('');
    const goal = (window.Hub && Hub.today().goal) || 50;
    const icon = v.icon || 'default';
    el.innerHTML = `<div class="ptitle"><h1>Settings</h1></div>
      ${group('Appearance', block('Theme', seg('theme', v.theme, [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Light'], ['amoled', 'Black']]))
        + block('Accent color', `<div class="acc-row">${accents}</div>`)
        + block('Text size', seg('text', v.text, [['s', 'Small'], ['m', 'Default'], ['l', 'Large'], ['xl', 'Huge']]))
        + block('Reduce motion', seg('reduceMotion', v.reduceMotion, [['auto', 'System'], ['true', 'On'], ['false', 'Off']]))
        + row('Haptics', sw(v.haptics, 'haptics'), 'Light taps on buttons and wins')
        + row('Sounds', sw(v.sounds, 'sounds'), 'Soft chimes for XP and answers'))}
      <h3>Reminders</h3><div id="pushSet" class="push-host"></div>
      ${group('App icon', `<div class="icon-row">${ICONS.map(([k, n]) => `<button type="button" class="icon-pick${icon === k ? ' on' : ''}" data-p-icon="${k}"><img src="icons/app-${k}.png" alt="" width="60" height="60"><span>${n}</span></button>`).join('')}</div>`, 'iOS only changes the icon when the app is added to the Home Screen again: delete it, then open the site in Safari → Share → Add to Home Screen.')}
      ${group('Home', block('Layout', seg('home.style', v.home.style, [['grid', 'Grid'], ['list', 'List']]))
        + block('Apps', `<div class="tile-list" id="tileList">${tiles}</div>`, 'Drag to reorder. Tap the eye to hide.')
        + row('Streak', sw(v.home.stats.streak, 'home.stats.streak'))
        + row('Level', sw(v.home.stats.level, 'home.stats.level'))
        + row('XP progress', sw(v.home.stats.xp, 'home.stats.xp'))
        + row('Daily goal ring', sw(v.home.stats.goal, 'home.stats.goal')))}
      ${group('Cards', block('Daily goal', `<div class="pseg">${[20, 50, 100, 150, 250].map(n => `<button type="button" class="${n === goal ? 'on' : ''}" data-p-goal="${n}">${n} XP</button>`).join('')}</div>`)
        + row('New cards per day', `<div class="stepper"><button type="button" data-p-step="-5" aria-label="Fewer">−</button><b>${v.cards.newPerDay}</b><button type="button" data-p-step="5" aria-label="More">+</button></div>`, 'Decks with their own limit keep it')
        + block('Card font', seg('cards.font', v.cards.font, [['system', 'System'], ['serif', 'Serif'], ['rounded', 'Rounded'], ['mono', 'Mono']]) + `<div class="font-prev" style="font-family:var(--card-font)">Der Hippocampus · l'hippocampe</div>`))}
      ${group('Learn', block('Default level', seg('learn.level', v.learn.level, LEVELS), 'New courses open at this level'))}
      ${group('Doctordle', row('Hard mode', sw(v.doc.hard, 'doc.hard'), 'History and vitals are free. Every other clue costs a guess.') + row('Timed', sw(!!v.doc.timed, 'doc.timed'), 'Solve within 3 minutes'))}
      ${group('Data', `<button type="button" class="prow act" data-p-export><span>Export a backup</span>${I('chev', 16)}</button><button type="button" class="prow act" data-go="settings"><span>Sync between devices</span>${I('chev', 16)}</button>`, 'The backup is one file with every card, review, lesson, test, Doctordle, streak and setting on this device.')}
      <div class="pgroup" style="margin-top:28px"><button type="button" class="prow act danger" data-p-reset><span>Reset settings to defaults</span></button></div>
      <p class="pfoot center">Settings sync to your other devices with your sync code.</p>`;
    wireDrag();
    try { if (window.Push) Push.render($('#pushSet')); else $('#pushSet').remove(); } catch (e) { console.warn('push ui', e); }
  }
  function setIcon(k) {
    Prefs.set('icon', k);
    const href = k === 'default' ? 'apple-touch-icon.png' : 'icons/app-' + k + '.png';
    document.querySelectorAll('link[rel=apple-touch-icon]').forEach(l => { l.href = href; });
  }
  document.addEventListener('click', e => {
    if (typeof view === 'undefined' || view !== 'prefs') return;
    const t = e.target.closest('[data-p-tog],[data-p-set],[data-p-hide],[data-p-goal],[data-p-step],[data-p-export],[data-p-reset],[data-p-icon]'); if (!t) return;
    const d = t.dataset;
    if (d.pTog) { const ks = d.pTog.split('.'); let o = V(); ks.forEach(k => { o = o[k]; }); Prefs.set(d.pTog, !o); }
    else if (d.pSet) { let val = d.v; if (val === 'true') val = true; else if (val === 'false') val = false; Prefs.set(d.pSet, val); }
    else if (d.pHide) { const h = V().home.hidden.slice(), i = h.indexOf(d.pHide); if (i >= 0) h.splice(i, 1); else h.push(d.pHide); Prefs.set('home.hidden', h); }
    else if (d.pGoal) { Hub.setGoal(+d.pGoal); }
    else if (d.pStep) { Prefs.set('cards.newPerDay', Math.max(0, Math.min(200, V().cards.newPerDay + +d.pStep))); }
    else if (d.pIcon) { setIcon(d.pIcon); }
    else if (d.pExport != null) { exportAll(); return; }
    else if (d.pReset != null) { if (confirm('Reset every setting to its default? Your cards and progress stay.')) { Prefs.reset(); toast('Settings reset'); } }
    render();
  });
  document.addEventListener('input', e => {
    const t = e.target; if (!t.dataset || !t.dataset.pColor) return;
    const p = t.dataset.pColor; t.parentElement.style.setProperty('--c', t.value);
    if (p === 'accent') Prefs.set('accent', t.value);
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.pColor) render();
    if (t.dataset && t.dataset.pSel) { Prefs.set(t.dataset.pSel, t.value); }
  });
  // drag to reorder home tiles
  function wireDrag() {
    const list = $('#tileList'); if (!list) return;
    let drag = null, startY = 0, rows = [], h = 0, from = 0;
    list.querySelectorAll('.tile-grip').forEach(g => g.addEventListener('pointerdown', e => {
      const r = g.closest('.tile-row'); drag = r; rows = [...list.children]; from = rows.indexOf(r); h = r.getBoundingClientRect().height; startY = e.clientY;
      r.classList.add('dragging'); g.setPointerCapture(e.pointerId); Prefs.haptic(); e.preventDefault();
    }));
    list.addEventListener('pointermove', e => {
      if (!drag) return; const dy = e.clientY - startY; drag.style.transform = `translateY(${dy}px)`;
      const to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / h)));
      rows.forEach((r, i) => { if (r === drag) return; let off = 0; if (from < to && i > from && i <= to) off = -h; if (from > to && i < from && i >= to) off = h; r.style.transform = off ? `translateY(${off}px)` : ''; });
      drag.dataset.to = to;
    });
    const end = () => {
      if (!drag) return; const to = +(drag.dataset.to || from); const order = rows.map(r => r.dataset.tk); const [k] = order.splice(from, 1); order.splice(to, 0, k);
      rows.forEach(r => { r.style.transform = ''; }); drag.classList.remove('dragging'); drag = null;
      if (to !== from) { Prefs.set('home.order', order); Prefs.haptic(); } render();
    };
    list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
  }
  // one-file backup of everything on this device
  function exportAll() {
    const dump = { app: 'odin-cards', version: 1, at: new Date().toISOString(), data: {}, local: {} };
    for (const k of Object.keys(M)) { const m = M[k]; if (m && typeof m.values === 'function') dump.data[k] = [...m.values()]; }
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^(hub|prefs|doc|res|lrn|learn|weak|anat|lab|conj|hands|focus|speak|stats2|settings|mastery|ms)/.test(k)) dump.local[k] = localStorage.getItem(k); }
    const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const name = 'synapse-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Backup' }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Backup saved');
  }
  // tab bar icons
  const TABI = { decks: 'decks', learn: 'learn', library: 'library', weak: 'weak', add: 'add', browse: 'browse', stats: 'stats', settings: 'settings' };
  function paintTabIcons() { document.querySelectorAll('#tabs button[data-go]').forEach(b => { const ic = b.querySelector('.ic'); if (ic && TABI[b.dataset.go]) ic.innerHTML = I(TABI[b.dataset.go], 24); }); }
  // edge swipe back (no browser chrome in standalone mode, so give the iOS gesture back)
  function backTarget() {
    if (window.Shell) return Shell.canBack() ? 'shell' : null;
    if (view === 'home') return null;
    if (view === 'learn' && window.Learn && Learn._S && Learn._S.route && Learn._S.route.page !== 'home') return 'learn-back';
    if (view === 'study') return 'decks';
    return 'home';
  }
  let sx = 0, sy = 0, swiping = false, dx = 0;
  const main = () => document.getElementById('main');
  document.addEventListener('touchstart', e => { const N = window.Settings && Settings.nav ? Settings.nav() : null; if (window.NavMenu && (!N || N.menu)) return; if (N && !N.back) return; if (e.touches.length !== 1) return; const t = e.touches[0]; if (t.clientX > (N ? N.edge : 24) || !backTarget() || document.querySelector('#sheetWrap:not([hidden])')) return; sx = t.clientX; sy = t.clientY; swiping = true; dx = 0; main().classList.add('swiping'); }, { passive: true });
  document.addEventListener('touchmove', e => { if (!swiping) return; const t = e.touches[0]; dx = Math.max(0, t.clientX - sx); if (Math.abs(t.clientY - sy) > 40 && dx < 30) { cancel(); return; } main().style.transform = `translateX(${dx * .9}px)`; main().style.opacity = String(1 - Math.min(.35, dx / 900)); }, { passive: true });
  function cancel() { swiping = false; const m = main(); m.classList.remove('swiping'); m.classList.add('swipe-release'); m.style.transform = ''; m.style.opacity = ''; setTimeout(() => m.classList.remove('swipe-release'), 240); }
  document.addEventListener('touchend', () => {
    if (!swiping) return; const tgt = backTarget(), far = dx > (window.Settings && Settings.nav ? Settings.nav().threshold : 90); cancel();
    if (far && tgt) { Prefs.haptic(); goBack(tgt); }
  });
  function goBack(tgt) {
    document.body.classList.add('nav-back'); setTimeout(() => document.body.classList.remove('nav-back'), 400);
    if (tgt === 'shell') { Shell.back(); return; }
    if (tgt === 'learn-back') { const b = document.querySelector('#v-learn [data-lback]'); if (b) b.click(); else go('home'); } else go(tgt);
  }
  document.addEventListener('click', e => { if (e.target.closest('#homeBtn,[data-goto-home]')) { document.body.classList.add('nav-back'); setTimeout(() => document.body.classList.remove('nav-back'), 400); } }, true);
  // settings sync through the app's D1 sync (progress record id 'prefs')
  let pushT = 0;
  function pushSoon() { clearTimeout(pushT); pushT = setTimeout(() => { try { write([['progress', { ...(M.progress.get('prefs') || {}), id: 'prefs', t: 'prefs', data: Prefs.v, at: Prefs.v.at, del: 0 }]]); } catch (e) { console.warn('prefs push', e); } }, 1500); }
  function pull() { try { const r = M.progress.get('prefs'); if (r && !r.del && r.data) Prefs.fromRemote(r.data, r.at || 0); } catch (e) {} }
  Prefs.onChange(remote => { if (!remote) pushSoon(); if (typeof view !== 'undefined' && view === 'prefs') render(); paintTabIcons(); });
  try { changeHooks.push(pull); } catch (e) {}
  function boot() { paintTabIcons(); pull(); const k = V().icon; if (k && k !== 'default') document.querySelectorAll('link[rel=apple-touch-icon]').forEach(l => { l.href = 'icons/app-' + k + '.png'; }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.PrefsUI = { render, exportAll, paintTabIcons };
})();
