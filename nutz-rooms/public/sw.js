const CACHE_NAME = 'kagan-v2'; // Bumped to force service worker update

// Files to cache for offline use
const CORE_ASSETS = [
  '/',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests entirely - let browser handle POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip ALL API calls - never cache, always fresh
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
    return;
  }

  // Skip external URLs (like Vercel deployments)
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request);
      })
  );
});
