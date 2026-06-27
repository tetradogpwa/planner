const CACHE_NAME = 'planificador-v3.7';

const ASSETS = [
  './',
  './index.html',
  './index.css',
  './index.js',
  './context.js',

  // Backend
  './back/main.js',
  './back/baseTarea.js',
  './back/daysOfWeek.js',
  './back/limitedTime.js',
  './back/nDays.js',

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
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Instalación: cachear todos los assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch((err) => {
      console.warn('Algunos recursos no se pudieron cachear:', err);
    })
  );
  self.skipWaiting();
});

// Activación: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: responder desde cache o red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // No cachear respuestas de terceros que fallen
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        // Fallback offline si es una navegación
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
