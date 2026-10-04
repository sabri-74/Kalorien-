// Offline-Cache: App-Dateien zuerst aus dem Cache, dann im Hintergrund aktualisieren.
const CACHE = 'kalorien-v9';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js',
  'js/ai.js',
  'js/calc.js',
  'js/charts.js',
  'js/core.js',
  'js/emoji.js',
  'js/fx.js',
  'js/game.js',
  'js/insights.js',
  'js/mealplan.js',
  'js/prefs.js',
  'js/exercises.js',
  'js/foods.js',
  'js/icons.js',
  'js/photos.js',
  'js/store.js',
  'js/views/aitools.js',
  'js/views/dishes.js',
  'js/views/food.js',
  'js/views/fun.js',
  'js/views/plan.js',
  'js/views/prefs.js',
  'js/views/profile.js',
  'js/views/rewards.js',
  'js/views/scan.js',
  'js/views/stats.js',
  'js/views/today.js',
  'js/views/training.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Nur eigene Dateien und Schriften cachen; KI- und Open-Food-Facts-Anfragen gehen direkt ins Netz.
  const cacheable = url.origin === location.origin || url.host.endsWith('fonts.googleapis.com') || url.host.endsWith('fonts.gstatic.com');
  if (e.request.method !== 'GET' || !cacheable) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: url.origin === location.origin });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
