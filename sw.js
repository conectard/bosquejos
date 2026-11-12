// Service worker: permite instalar la app y usarla sin internet.
// Los datos (Supabase) siempre van directo a la red; aquí solo se guarda la "carcasa" de la app.
const VERSION = 'bosquejos-2026.11.12.0258';   // el script de compilación pone aquí la versión real
const APP_SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './fonts/material-symbols-outlined.woff2',
    './fonts/inter-latin.woff2',
    './fonts/inter-latin-ext.woff2',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    // cache: 'reload' evita copiar archivos viejos guardados por el navegador o por GitHub
    event.waitUntil(caches.open(VERSION).then((cache) =>
        cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' })))
    ));
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

    // Datos de Supabase y archivos de actualización: nunca desde caché
    if (url.hostname.endsWith('supabase.co')) return;
    if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('.zip')) return;

    // Página de la app: primero la red (para recibir actualizaciones), si falla, la copia guardada
    if (req.mode === 'navigate') {
        event.respondWith(
            // Siempre pide la versión más nueva: el parámetro evita la copia que GitHub guarda 10 minutos
            fetch(new URL('./index.html?nc=' + Date.now(), self.registration.scope).href, { cache: 'no-store', credentials: 'same-origin' })
                .then((resp) => {
                    if (resp.ok) {
                        const copia = resp.clone();
                        caches.open(VERSION).then((c) => c.put('./index.html', copia));
                    }
                    return resp;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Fuentes, íconos y demás archivos de la app: desde la copia guardada (rápido y sin internet)
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.open(VERSION).then((cache) =>
                cache.match(req).then((guardada) => guardada || fetch(req).then((resp) => {
                    if (resp.ok) cache.put(req, resp.clone());
                    return resp;
                }))
            )
        );
    }
});
