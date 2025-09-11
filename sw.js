// sw.js
const STATIC_CACHE = 'famille-static-v1';
const STATIC_ASSETS = [
  '/',               // si ton hébergeur sert index.html à /
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Liste des hôtes à NE PAS mettre en cache (APIs dynamiques)
const NETWORK_FIRST_HOSTS = [
  'family-app.teiki5320.workers.dev',
  'api.open-meteo.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Réseau d'abord pour les hosts dynamiques (chat/docs/calendrier/météo)
  if (NETWORK_FIRST_HOSTS.includes(url.host)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        return fresh;
      } catch {
        // en cas d’offline, tente le cache (s’il existe un match)
        const cached = await caches.match(event.request);
        return cached || new Response('{"offline":true}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
    return;
  }

  // Cache d’abord pour le reste (assets statiques)
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const resp = await fetch(event.request);
      // on ne met en cache que les GET "propres"
      if (event.request.method === 'GET' && resp.ok && resp.type !== 'opaque') {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(event.request, resp.clone());
      }
      return resp;
    } catch {
      // Retour offline simple si vraiment rien
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
      return new Response('Offline', { status: 503 });
    }
  })());
});