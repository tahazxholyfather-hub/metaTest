function urlBase64ToUint8Array(value: string) {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
    return output;
}

export function registerAppServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const url = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(url, { scope: '/' }).catch(() => {
        navigator.serviceWorker.register(url).catch(() => undefined);
    });
}

export async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const { flowApi } = await import('../lib/authApi');
    const config = await flowApi.dispatch('get_push_config') as { success?: boolean; publicKey?: string };
    if (!config?.publicKey) return false;
    const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) => {
            window.setTimeout(() => reject(new Error('service worker timeout')), 8000);
        }),
    ]);
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
    const json = subscription.toJSON();
    await flowApi.dispatch('save_push_subscription', {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
    });
    return true;
}
