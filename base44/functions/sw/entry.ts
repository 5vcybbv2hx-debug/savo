const CACHE_NAME = 'barmanager-v3';
const STATIC_CACHE = 'barmanager-static-v3';
const DYNAMIC_CACHE = 'barmanager-dynamic-v3';

Deno.serve((req) => {
    const swCode = `
        const CACHE_NAME = 'barmanager-v3';
        const STATIC_CACHE = 'barmanager-static-v3';
        const DYNAMIC_CACHE = 'barmanager-dynamic-v3';
        
        const urlsToCache = [
            '/',
            '/Dashboard',
            '/Calendar',
            '/Cleaning',
            '/Warehouse',
            '/Reservations',
            '/MyArea'
        ];

        self.addEventListener('install', (event) => {
            console.log('[SW] Installing...');
            event.waitUntil(
                caches.open(STATIC_CACHE)
                    .then((cache) => {
                        console.log('[SW] Caching static assets');
                        return cache.addAll(urlsToCache);
                    })
                    .then(() => self.skipWaiting())
            );
        });

        self.addEventListener('activate', (event) => {
            console.log('[SW] Activating...');
            const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE];
            event.waitUntil(
                caches.keys().then((cacheNames) => {
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            if (cacheWhitelist.indexOf(cacheName) === -1) {
                                console.log('[SW] Deleting old cache:', cacheName);
                                return caches.delete(cacheName);
                            }
                        })
                    );
                }).then(() => {
                    console.log('[SW] Claiming clients');
                    return self.clients.claim();
                })
            );
        });

        self.addEventListener('fetch', (event) => {
            if (event.request.method !== 'GET') return;
            
            const { url } = event.request;
            
            // Niemals Vite-Dev-Pfade cachen — verhindert stale /node_modules/.vite/deps
            // chunks, die einen React/react-dom Dispatcher-Mismatch auslösen.
            if (url.includes('/node_modules/.vite') || url.includes('/@vite') || url.includes('/@react-refresh') || url.includes('/src/')) {
                return;
            }
            
            // Cache-First für statische Assets (JS, CSS, Bilder)
            if (url.includes('/assets/') || url.match(/\\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
                event.respondWith(
                    caches.match(event.request).then((response) => {
                        return response || fetch(event.request).then((fetchResponse) => {
                            return caches.open(STATIC_CACHE).then((cache) => {
                                cache.put(event.request, fetchResponse.clone());
                                return fetchResponse;
                            });
                        }).catch(() => {
                            console.log('[SW] Static asset failed to load:', url);
                        });
                    })
                );
                return;
            }
            
            // Network-First für API-Anfragen
            if (url.includes('/api/')) {
                event.respondWith(
                    fetch(event.request)
                        .then((response) => {
                            if (response.status === 200 && url.includes('/entities/')) {
                                const responseClone = response.clone();
                                caches.open(DYNAMIC_CACHE).then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                            }
                            return response;
                        })
                        .catch(() => {
                            return caches.match(event.request).then((response) => {
                                if (response) {
                                    console.log('[SW] Serving cached API response for:', url);
                                    return response;
                                }
                                return new Response(
                                    JSON.stringify({ 
                                        error: 'Offline', 
                                        message: 'Diese Anfrage ist offline nicht verfügbar',
                                        offline: true
                                    }),
                                    { 
                                        headers: { 'Content-Type': 'application/json' },
                                        status: 503
                                    }
                                );
                            });
                        })
                );
                return;
            }
            
            // Network-First für Seiten/Navigation — neue Publishs sofort aktiv.
            // Cache-First hat stale HTML mit alten Asset-Hashes geliefert, die nach
            // einem Deploy 404ten → React ohne Event-Handler → Buttons nicht klickbar.
            event.respondWith(
                fetch(event.request).then((fetchResponse) => {
                    if (fetchResponse.status === 200) {
                        const responseClone = fetchResponse.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return fetchResponse;
                }).catch(() => {
                    return caches.match(event.request).then((response) => {
                        if (response) return response;
                        return new Response(
                            JSON.stringify({ 
                                error: 'Offline', 
                                message: 'Diese Seite ist offline nicht verfügbar' 
                            }),
                            { 
                                headers: { 'Content-Type': 'application/json' },
                                status: 503
                            }
                        );
                    });
                })
            );
        });

        // Push-Benachrichtigungen
        self.addEventListener('push', (event) => {
            console.log('[SW] Push notification received');
            
            let data = {
                title: 'Neue Benachrichtigung',
                body: 'Sie haben eine neue Nachricht',
                icon: '/icon-192.png'
            };
            
            if (event.data) {
                try {
                    data = event.data.json();
                } catch (e) {
                    data.body = event.data.text();
                }
            }
            
            const options = {
                body: data.body,
                icon: data.icon || '/icon-192.png',
                badge: data.badge || '/icon-192.png',
                vibrate: [200, 100, 200],
                data: data.data || {},
                actions: [
                    { action: 'open', title: 'Öffnen' },
                    { action: 'close', title: 'Schließen' }
                ]
            };
            
            event.waitUntil(
                self.registration.showNotification(data.title, options)
            );
        });

        self.addEventListener('notificationclick', (event) => {
            console.log('[SW] Notification clicked');
            event.notification.close();
            
            if (event.action === 'close') {
                return;
            }
            
            const urlToOpen = event.notification.data?.url || '/Notifications';
            
            event.waitUntil(
                clients.matchAll({ type: 'window', includeUncontrolled: true })
                    .then((clientList) => {
                        for (let client of clientList) {
                            if (client.url.includes(self.location.origin) && 'focus' in client) {
                                return client.focus().then(() => {
                                    client.postMessage({ type: 'NOTIFICATION_CLICKED', url: urlToOpen });
                                });
                            }
                        }
                        if (clients.openWindow) {
                            return clients.openWindow(urlToOpen);
                        }
                    })
            );
        });
    `;

    return new Response(swCode, {
        headers: {
            'Content-Type': 'application/javascript',
            'Service-Worker-Allowed': '/'
        }
    });
});