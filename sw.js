const CACHE_NAME = 'planificador-v3.8';

const ASSETS = [
  './',
  './index.html',
  './index.css',
  './index.js',
  './context.js',
  // Backend
  './back/baseTarea.js',
  './back/daysOfWeek.js',
  './back/limitedTime.js',
  './back/nDays.js',
  './back/serializer.js',   // ← nuevo (antes en main.js)
  './back/calendar.js',     // ← nuevo (antes en main.js)
  // UI - Data Manager
  './ui/dataManager/dataManager-card.html',
  './ui/dataManager/dataManager-card.css',
  './ui/dataManager/dataManager-card.js',
  // UI - Print
  './ui/print/print-card.html',
  './ui/print/print-card.css',
  './ui/print/print-card.js',
  // UI - Task Manager
  './ui/taskManager/taskManager-card.html',
  './ui/taskManager/taskManager-card.css',
  './ui/taskManager/taskManager-card.js',
  // UI - Add Task
  './ui/taskManager/addTask/addTask-card.html',
  './ui/taskManager/addTask/addTask-card.css',
  './ui/taskManager/addTask/addTask-card.js',
  // UI - Task Item
  './ui/taskManager/taskItem/taskItem-card.html',
  './ui/taskManager/taskItem/taskItem-card.css',
  './ui/taskManager/taskItem/taskItem-card.js',
  // UI - Week
  './ui/week/week-card.html',
  './ui/week/week-card.css',
  './ui/week/week-card.js',
  // UI - Week Task Item
  './ui/week/taskItem/taskItem-card.html',
  './ui/week/taskItem/taskItem-card.css',
  './ui/week/taskItem/taskItem-card.js',
  // Otros
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  // Librerías externas
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err  => console.warn('Algunos recursos no se pudieron cachear:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic')
          return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate')
          return caches.match('./index.html');
      });
    })
  );
});
