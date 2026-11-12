// Service worker: permite instalar la app y abrirla aunque no haya internet.
// Los datos (Supabase) siempre van directo a la red; aquí solo se guarda la "carcasa" de la app.
const VERSION = 'bosquejos-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Datos de Supabase: nunca desde caché
    if (url.hostname.endsWith('supabase.co')) return;

    // Página de la app: primero la red (para recibir actualizaciones), si falla, la copia guardada
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then((resp) => {
                    const copia = resp.clone();
                    caches.open(VERSION).then((c) => c.put('./index.html', copia));
                    return resp;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Fuentes, íconos y demás: copia guardada al instante y se actualiza en segundo plano
    const esFuente = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
    if (url.origin === self.location.origin || esFuente) {
        event.respondWith(
            caches.open(VERSION).then((cache) =>
                cache.match(req).then((guardada) => {
                    const red = fetch(req)
                        .then((resp) => {
                            if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
                            return resp;
                        })
                        .catch(() => guardada);
                    return guardada || red;
                })
            )
        );
    }
});
