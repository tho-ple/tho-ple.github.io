const CACHE = 'barn-treats-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './sw.js',
    './icon-192.png',
    './icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // For video files, try network first, fall back to cache
    if (url.pathname.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        event.respondWith(
            fetch(request)
                .then((resp) => {
                    const clone = resp.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, clone));
                    return resp;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // For everything else, cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            return cached || fetch(request).then((resp) => {
                const clone = resp.clone();
                caches.open(CACHE).then((cache) => cache.put(request, clone));
                return resp;
            });
        })
    );
});
