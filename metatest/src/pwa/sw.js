import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
clientsClaim();

function isAppPage(url) {
    let path = '';
    try {
        path = new URL(url).pathname;
    } catch {
        return false;
    }
    if (path.startsWith('/blog') || path.startsWith('/about') || path.startsWith('/api')) return false;
    const base = import.meta.env.BASE_URL || '/';
    if (base !== '/') return path.startsWith(base);
    return true;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The refresh that discovers a deploy is still being answered by the previous
// worker, from its saved copy of the app. navigate() throws while that
// navigation is in progress, so a single try leaves the old page on screen.
// Retry until the open app page actually loads this copy.
async function reloadOpenApp() {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
        if (!isAppPage(client.url) || typeof client.navigate !== 'function') return;
        for (let attempt = 0; attempt < 8; attempt += 1) {
            try {
                const loaded = await client.navigate(client.url);
                if (loaded) return;
            } catch {
                // The installing refresh has not finished yet.
            }
            await wait(400);
        }
    }));
}

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        await self.clients.claim();
        await wait(500);
        await reloadOpenApp();
    })());
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const shell = createHandlerBoundToURL(`${import.meta.env.BASE_URL}index.html`);
// A normal refresh must read the shell from the network. The saved copy is
// only for when the phone is offline; otherwise a deploy stays invisible.
const freshShell = async ({ request, url }) => {
    try {
        const response = await fetch(url.href, { cache: 'no-store', credentials: 'same-origin' });
        const type = response?.headers?.get('content-type') || '';
        if (response && response.ok && type.includes('text/html')) return response;
    } catch {
        // Offline: open the shell saved when this worker was installed.
    }
    return shell({ request });
};
// The worker stays registered at "/" so push still arrives, but only /app
// navigations should open the app shell. "/" , /blog and /about are the landing.
registerRoute(new NavigationRoute(freshShell, {
    allowlist: [/^\/app(?:\/|$|\?)/],
    denylist: [/^\/api\//, /\/socket\.io\//, /^\/avatars\//, /^\/images\//],
}));

const mediaPlugins = [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 240, maxAgeSeconds: 60 * 60 * 24 * 30 }),
];

registerRoute(
    ({ request, url }) => request.destination === 'image'
        || url.pathname.startsWith('/images/')
        || url.pathname.startsWith('/avatars/'),
    new CacheFirst({ cacheName: 'metatest-images', plugins: mediaPlugins })
);

registerRoute(
    ({ request }) => request.destination === 'font' || request.destination === 'style',
    new CacheFirst({
        cacheName: 'metatest-static',
        plugins: [
            new CacheableResponsePlugin({ statuses: [0, 200] }),
            new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 90 }),
        ],
    })
);

const READ_ACTIONS = new Set([
    'get_user_info',
    'get_subjects',
    'get_grades_by_subject',
    'get_chapters_by_subject',
    'get_mabahes_by_chapter',
    'get_quiz_types',
    'get_favorites',
    'get_notes',
    'get_review_later_questions',
    'get_pdfs',
    'get_quiz_history',
    'get_chemball_leaderboard',
    'get_my_wallet',
    'get_payment_history',
    'get_push_config',
]);

async function digest(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 40);
}

async function cacheFlow(request) {
    let bodyText = '';
    try {
        bodyText = await request.clone().text();
    } catch {
        bodyText = '';
    }
    let action = '';
    try {
        action = JSON.parse(bodyText).action || '';
    } catch {
        action = '';
    }
    if (!READ_ACTIONS.has(action)) return fetch(request);

    const token = request.headers.get('x-app-token') || '';
    const hash = await digest(`${action}\n${bodyText}\n${token}`);
    const cache = await caches.open('metatest-api-v1');
    const key = new Request(`${self.location.origin}/__mt_api_cache/${hash}`);
    try {
        const fresh = await fetch(request);
        if (fresh.ok) await cache.put(key, fresh.clone());
        return fresh;
    } catch {
        const cached = await cache.match(key);
        if (cached) return cached;
        return new Response(JSON.stringify({
            success: false,
            offline: true,
            message: 'اتصال نیست و نسخه ذخیره‌شده‌ای از این درخواست موجود نیست.',
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'POST') return;
    const url = new URL(event.request.url);
    if (url.pathname !== '/api/flow') return;
    event.respondWith(cacheFlow(event.request));
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'متاتست';
    const options = {
        body: data.body || '',
        icon: data.icon || new URL(`${import.meta.env.BASE_URL}favicon-192x192.png`, self.location.origin).href,
        image: data.image || undefined,
        data: { url: data.url || data.link || import.meta.env.BASE_URL || '/' },
        dir: 'rtl',
        lang: 'fa',
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || import.meta.env.BASE_URL || '/';
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windows) {
            if ('focus' in client) {
                await client.focus();
                if ('navigate' in client) {
                    try { await client.navigate(target); } catch { /* the open window still comes forward */ }
                }
                return;
            }
        }
        await self.clients.openWindow(target);
    })());
});
