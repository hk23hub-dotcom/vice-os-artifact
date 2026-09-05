const CACHE = 'hk23-scale-v1';
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
