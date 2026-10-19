/* ---- streak reminders (Web Push; feat/push) ---- */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Synapse';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || 'A couple of minutes keeps your streak going.',
    icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'streak', renotify: false,
    data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (new URL(c.url).origin === self.location.origin && !/\/(chess|me)\//.test(new URL(c.url).pathname) && 'focus' in c) return c.focus();
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
