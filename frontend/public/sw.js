const CACHE_NAME = 'timetracker-v1.2';
const PRECACHE_ASSETS = [
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// Install: precache app shell and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: remove old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: never swallow the Authelia forward-auth redirect.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API requests: let the browser handle them natively. Intercepting them would
  // break `redirect: 'manual'` detection in the client (and re-serving an
  // opaque-redirect response from a worker throws).
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Non-GET requests: bypass cache
  if (request.method !== 'GET') {
    return;
  }

  // 3. Document navigation: network-first. If the site is behind Authelia and the
  // proxy redirected us to the (cross-origin) login portal, re-issue a real
  // navigation instead of serving the portal HTML — or the cached shell — here.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse.redirected) {
            try {
              if (new URL(networkResponse.url).origin !== self.location.origin) {
                return Response.redirect(networkResponse.url, 302);
              }
            } catch {
              // Fall through and return the response as-is.
            }
          }
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 4. Static assets: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);
      return cachedResponse || fetchPromise;
    })
  );
});
