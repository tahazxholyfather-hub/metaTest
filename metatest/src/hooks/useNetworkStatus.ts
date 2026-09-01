import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    return () => {
        window.removeEventListener('online', callback);
        window.removeEventListener('offline', callback);
    };
};

const getSnapshot = () => navigator.onLine;

const getServerSnapshot = () => true; // Default to true for SSR

export function useNetworkStatus() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
