/* About, Help & feedback, first-launch tour, data controls (export / delete).
   // the chosen Home Screen icon (Settings → Appearance → App icon) applies from the first paint
  try { const k = window.Prefs && Prefs.v.icon; if (k && k !== 'default') document.querySelectorAll('link[rel=apple-touch-icon]').forEach(l => { l.href = 'icons/app-' + k + '.png'; }); } catch (e) {}
  window.About = { tour(force), after(pageId, el), exportAll(), deleteAll(), sendFeedback(form), creditsHTML() }
   Settings pages 'help' and 'credits' call About.after() once they are on screen. */
(function () {
  'use strict';
  if (window.About) return;
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = m => { try { if (typeof toast === 'function') toast(m); } catch (e) {} };
  const API = p => (window.ODIN_API || '') + p;
  const code = () => { try { return typeof meta !== 'undefined' && meta && meta.code || null; } catch (e) { return null; } };
  const TOUR_KEY = 'tour.v1';

  /* ---------- first-launch tour ---------- */
  const SLIDES = [
    { ic: 'cards', h: 'Welcome to Synapse', p: 'Flashcards that space themselves out, so you review each card right before you would forget it. Medicine, pharmacology, neuro and med chem, all in one place.' },
    { ic: 'grid', h: 'Study, Learn, Lab', p: '<b>Study</b> is your decks and reviews. <b>Learn</b> has 200 courses with lessons and tests. <b>Lab</b> has hands-on tools: patient cases, ECGs, scans, heart sounds and more.' },
    { ic: 'cloud', h: 'Keep your work safe', p: 'Turn on sync in More → Sync &amp; backup to get a code that keeps every device the same. You can also export a backup file any time. Everything here is for learning, not medical advice.' }
  ];
  const SVG = {
    cards: '<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11a3 3 0 0 1 3 3v11"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z"/>'
  };
  const svg = (n, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[n]}</svg>`;
  function tour(force) {
    if (!force) { try { if (localStorage.getItem(TOUR_KEY)) return; } catch (e) { return; } }
    if (document.querySelector('.tour')) return;
    const el = document.createElement('div'); el.className = 'tour'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Welcome');
    el.innerHTML = `<button type="button" class="tour-skip" data-tour-skip>Skip</button>
      <div class="tour-track" data-tour-track>${SLIDES.map((s, i) => `<section class="tour-slide" aria-label="${i + 1} of ${SLIDES.length}"><div class="tour-ic">${svg(s.ic, 56)}</div><h2>${E(s.h)}</h2><p>${s.p}</p></section>`).join('')}</div>
      <div class="tour-foot"><div class="tour-dots">${SLIDES.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div><button type="button" class="tour-next" data-tour-next>Next</button></div>`;
    document.body.appendChild(el);
    const track = el.querySelector('[data-tour-track]'), next = el.querySelector('[data-tour-next]');
    const idx = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const paint = () => { const i = idx(); el.querySelectorAll('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); next.textContent = i >= SLIDES.length - 1 ? 'Get started' : 'Next'; };
    const done = () => { try { localStorage.setItem(TOUR_KEY, String(Date.now())); } catch (e) {} el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    track.addEventListener('scroll', () => { clearTimeout(track._t); track._t = setTimeout(paint, 60); }, { passive: true });
    el.addEventListener('click', e => {
      if (e.target.closest('[data-tour-skip]')) return done();
      if (e.target.closest('[data-tour-next]')) { const i = idx(); if (i >= SLIDES.length - 1) return done(); track.scrollTo({ left: (i + 1) * track.clientWidth, behavior: 'smooth' }); setTimeout(paint, 380); }
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') done(); });
    setTimeout(() => { try { next.focus({ preventScroll: true }); } catch (e) {} }, 50);
  }

  /* ---------- credits ---------- */
  let CRED = null;
  function loadCredits() { if (CRED) return Promise.resolve(CRED); return fetch('feat/about/credits.json').then(r => r.json()).then(j => (CRED = j)); }
  function creditsHTML(j) {
    return j.groups.map(g => `<h3 class="st-gh">${E(g.g)} <span class="ab-n">${g.items.length}</span></h3>${g.note ? `<p class="st-gf ab-note">${E(g.note)}</p>` : ''}<div class="pgroup st-g ab-cred">${g.items.map(x => `<div class="prow col st-row ab-ci"><b>${E(x.t)}</b><span>${E(x.a)}${x.a && x.l ? ' · ' : ''}${x.lu ? `<a href="${E(x.lu)}" target="_blank" rel="noopener">${E(x.l)}</a>` : E(x.l)}${x.u ? ` · <a class="ab-src" href="${E(x.u)}" target="_blank" rel="noopener">Source</a>` : ''}</span></div>`).join('')}</div>`).join('');
  }

  /* ---------- feedback ---------- */
  async function sendFeedback(form) {
    const type = (form.querySelector('[name=fbtype]:checked') || {}).value || 'other', msg = form.querySelector('textarea').value.trim(), btn = form.querySelector('button[type=submit]');
    if (msg.length < 3) { T('Write a little more first'); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const r = await fetch(API('/api/feedback'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type, msg: msg.slice(0, 2000), ver: (window.APP_VER || ''), native: !!window.OdinNative }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { form.reset(); form.querySelector('.ab-count').textContent = '0 / 2000'; T('Thanks, feedback sent'); form.classList.add('sent'); }
      else T(j.error === 'slow_down' ? 'That’s a lot of feedback. Try again in a bit.' : 'Couldn’t send. Try again later.');
    } catch (e) { T('You’re offline. Try again later.'); }
    btn.disabled = false; btn.textContent = 'Send feedback';
  }

  /* ---------- data: export + delete ---------- */
  function exportAll() {
    const dump = { app: 'odin-cards', kind: 'my-data', version: 2, at: new Date().toISOString(), data: {}, local: {} };
    try { for (const k of Object.keys(M)) { const m = M[k]; if (m && typeof m.values === 'function') dump.data[k] = [...m.values()]; } } catch (e) {}
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); dump.local[k] = localStorage.getItem(k); } } catch (e) {}
    const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
    const name = 'synapse-my-data-' + new Date().toISOString().slice(0, 10) + '.json';
    if (window.OdinNative && OdinNative.saveFile) { OdinNative.saveFile(name, blob); return; }
    try { const file = new File([blob], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'My data' }).catch(() => {}); return; } } catch (e) {}
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    T('Data exported');
  }
  async function wipeLocal() {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try { if (indexedDB.databases) { const dbs = await indexedDB.databases(); await Promise.all(dbs.map(d => new Promise(r => { const q = indexedDB.deleteDatabase(d.name); q.onsuccess = q.onerror = q.onblocked = () => r(); }))); } } catch (e) {}
    try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) {}
    try { if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } } catch (e) {}
  }
  async function deleteAll() {
    if (!confirm('Delete all your data on this device? Every card, review, course progress, streak and setting will be erased.')) return;
    if (!confirm('Are you sure? This can’t be undone. Export your data first if you might want it back.')) return;
    const c = code();
    if (c && confirm('Also delete the synced copy on the server? Your other devices will stop syncing and that copy will be gone for good.')) {
      try {
        const r = await fetch(API('/api/delete'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-code': c }, body: '{}' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { if (!confirm('Couldn’t reach the server, so the synced copy is still there. Erase this device anyway?')) return; }
      } catch (e) { if (!confirm('You’re offline, so the synced copy is still there. Erase this device anyway?')) return; }
    }
    T('Deleting…');
    await wipeLocal();
    setTimeout(() => location.replace(location.pathname), 400);
  }

  /* ---------- page hooks ---------- */
  function after(id, root) {
    root = root || document;
    if (id === 'credits') { const box = root.querySelector('#abCred'); if (box) loadCredits().then(j => { box.innerHTML = creditsHTML(j); }).catch(() => { box.innerHTML = '<p class="st-gf">Couldn’t load the credits. Open this page again when you’re online.</p>'; }); }
    if (id === 'help') { const f = root.querySelector('#abFb'); if (f && !f._w) { f._w = 1; const ta = f.querySelector('textarea'), n = f.querySelector('.ab-count'); ta.addEventListener('input', () => { n.textContent = ta.value.length + ' / 2000'; f.classList.remove('sent'); }); f.addEventListener('submit', e => { e.preventDefault(); sendFeedback(f); }); } }
  }

  // the chosen Home Screen icon (Settings → Appearance → App icon) applies from the first paint
  try { const k = window.Prefs && Prefs.v.icon; if (k && k !== 'default') document.querySelectorAll('link[rel=apple-touch-icon]').forEach(l => { l.href = 'icons/app-' + k + '.png'; }); } catch (e) {}
  window.About = { tour, after, exportAll, deleteAll, sendFeedback, creditsHTML, loadCredits };
  const boot = () => setTimeout(() => { if (!document.hidden) tour(false); }, 700);
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);
})();
