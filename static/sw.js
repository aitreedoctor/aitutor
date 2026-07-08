const CACHE_NAME = 'ai-tutor-cache-v328';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/index.js',
  '/modules/Config.js',
  '/modules/Utils.js',
  '/modules/IntroManager.js',
  '/modules/CbtManager.js',
  '/modules/FeedbackManager.js',
  '/modules/Dashboard.js',
  '/modules/Chat.js',
  '/modules/Admin.js',
  '/modules/WrongNotesManager.js',
  '/ai_tutor_logo.png'
];

// Install Event - cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Failed to cache some assets during install:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only handle GET requests and local/same-origin assets
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Bypass cache for API endpoints
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      // Save valid responses to cache
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Fallback to cache if network fails
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Return index.html for navigation requests offline
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
