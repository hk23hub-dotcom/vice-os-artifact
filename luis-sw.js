const CACHE = 'hk23-luis-v1';
const ASSETS = ['/luis', '/luis-manifest.webmanifest', '/luis-icon-192.png', '/luis-icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hk23-luis-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.mode === 'navigate') {
    // network-first so updates land; the cached shell opens the app offline (notes and decisions live on the phone)
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('/luis', copy)); }
        return r;
      }).catch(() => caches.match('/luis'))
    );
  } else if (ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(url.pathname).then(hit => hit || fetch(e.request)));
  }
  // /api/run and everything else always go to the network, never cached
});
