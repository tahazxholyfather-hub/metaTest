declare global {
    interface Window {
        MathJax?: any;
        __mathJaxReady?: Promise<any>;
    }
}

export function loadMathJax(): Promise<any> {
    if (window.__mathJaxReady) return window.__mathJaxReady;

    if (window.MathJax?.startup?.promise) {
        return window.MathJax.startup.promise.then(() => window.MathJax);
    }

    return Promise.reject(new Error('MathJax was not initialized'));
}
