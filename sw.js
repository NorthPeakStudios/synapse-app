/* offline app shell. never caches the sync api. /me/ has its own service worker (scoped to its folder); this one leaves it alone and never deletes its caches. */
const CACHE = 'cards-v171';
const CORE = ['./', 'index.html', 'host.js', 'native.css', 'native.js', 'prefs.js', 'prefs-ui.js', 'theme.css', 'styles.css', 'app.js', 'learn.js', 'learn.css', 'library.js', 'library.css', 'resources.js', 'resources.css', 'seed.js', 'hub.js', 'home.js', 'home.css', 'weak.js', 'doctordle.js', 'feat/search/search.js', 'feat/search/search.css', 'feat/makecards/makecards.js', 'feat/makecards/makecards.css', 'feat/exam/exam.js', 'feat/exam/exam.css', 'feat/interact/pairs.js', 'feat/interact/interact.js', 'feat/interact/interact.css', 'anat/anatomy.js', 'anat/anatomy.css', 'feat/stats/stats.js', 'feat/stats/stats.css', 'feat/push/push.js', 'feat/push/push.css', 'feat/focus/focus.js', 'feat/focus/focus.css', 'feat/mastery/mastery.js', 'feat/mastery/know.js', 'feat/mastery/know.css', 'feat/settings/settings.js', 'feat/settings/settings-ui.js', 'feat/settings/settings.css', 'feat/imgcards/imgcards.js', 'feat/imgcards/imgcards.css', 'feat/lab/lab.js', 'feat/lab/lab.css', 'feat/polish/polish.css', 'feat/shell/shell.js', 'feat/shell/shell.css', 'feat/about/about.js', 'feat/about/about.css', 'feat/pro/pro-config.js', 'feat/pro/pro.js', 'feat/pro/lockgate.js', 'feat/account/account.js', 'np-email.js', 'feat/account/account.css', 'feat/layout/themes.js', 'feat/layout/layout.js', 'feat/layout/layout.css', 'feat/pro/pro.css', 'xview.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-512-maskable.png'];
const ANAT_CACHE = 'anat-models-v2'; // 3D models + anatomy lessons, kept across app updates
const LEARN_CACHE = 'cards-learn'; // course JSON lives here and survives app updates
const LAZY = ['learn/manifest.json', 'resources.json', 'seed-v2.json', 'vendor/jszip.min.js', 'vendor/sql-wasm.js', 'vendor/sql-wasm.wasm', 'vendor/fzstd.js', 'vendor/qrcode.js', 'doctordle/cases.json', 'anat/data.json', 'anat/viewer3.js', 'anat/v2/parts.json', 'anat/v2/desc.json', 'feat/about/credits.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).then(() => c.addAll(LAZY).catch(() => {}))).then(() => self.skipWaiting())); });
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); }); // v118: the page asks a waiting update to take over
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('cards-') && k !== CACHE && k !== LEARN_CACHE) || (k.startsWith('anat-models-') && k !== ANAT_CACHE)).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || /^\/me(\/|$)/.test(u.pathname)) return; // /me/ has its own worker
  if (/\/anat\/(m2|h|lessons)\//.test(u.pathname)) { e.respondWith(caches.open(ANAT_CACHE).then(c => c.match(req).then(r => r || fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; })))); return; }
  if (u.pathname.includes('/learn/')) { e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(LEARN_CACHE).then(x => x.put(req, c)); } return res; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || Response.error()))); return; }
  if (u.pathname.includes('/vendor/')) { e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; }))); return; }
  if (req.mode === 'navigate' || /\/(index\.html)?$/.test(u.pathname)) { e.respondWith(fetch(req, { cache: 'no-store' }).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))); return; } // v114: the shell page is always network-first, never a stale copy
  e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
/* ---- streak reminders (Web Push; feat/push) ---- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Synapse';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'A couple of minutes keeps your streak going.',
    icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'streak', renotify: false,
    data: { url: d.url || './' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(String((e.notification.data && e.notification.data.url) || './').replace(/^\//, ''), self.registration.scope).href; // relative to where the app lives (works on the GitHub copy too)
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (new URL(c.url).origin === self.location.origin && !/\/me\//.test(new URL(c.url).pathname) && 'focus' in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
