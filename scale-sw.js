const CACHE = 'hk23-scale-v2';
const ASSETS = ['/scale', '/scale-manifest.webmanifest', '/scale-icon-192.png', '/scale-icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hk23-scale-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate') {
    // network-first so updates land; cached copy keeps the app working offline
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put('/scale', copy));
        return r;
      }).catch(() => caches.match('/scale'))
    );
  } else if (ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(url.pathname).then(hit => hit || fetch(e.request)));
  }
});

// daily reminders, nudges and test pings from /api/scale-push
self.addEventListener('push', e => {
  let d = {};
  if (e.data) {
    try { d = e.data.json() || {}; } catch (_) { d = { body: e.data.text() }; }
  }
  const title = (typeof d.title === 'string' && d.title.trim()) || 'Motivation Scale';
  e.waitUntil(self.registration.showNotification(title, {
    body: typeof d.body === 'string' ? d.body : '',
    icon: '/scale-icon-192.png',
    badge: '/scale-icon-192.png',
    tag: (typeof d.tag === 'string' && d.tag) || 'scale',
    renotify: true, // requires a tag — always set above
    data: { url: typeof d.url === 'string' ? d.url : '/scale' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  let target = new URL('/scale', self.location.origin);
  try {
    const u = new URL((e.notification.data && e.notification.data.url) || '/scale', self.location.origin);
    if (u.origin === self.location.origin) target = u; // never open a foreign URL from a payload
  } catch (_) {}
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        let path = '';
        try { const cu = new URL(c.url); if (cu.origin === self.location.origin) path = cu.pathname; } catch (_) {}
        if (path.startsWith('/scale') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow ? self.clients.openWindow(target.href) : undefined;
    })
  );
});
