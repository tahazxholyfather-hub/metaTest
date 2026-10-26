export const EXIT_WINDOW_MS = 2000;
export const EXIT_NOTICE = 'برای خروج، یک بار دیگر بازگشت را بزنید';

export function sameEntry(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'view') return a.view === b.view;
    if (a.kind === 'practice') return a.step === b.step;
    if (a.kind === 'tests') return a.screen === b.screen;
    if (a.kind === 'route') return a.path === b.path;
    return false;
}

export function createHistory(root) {
    return {
        stack: [root],
        guardOnTop: false,
        armedUntil: 0,
    };
}

export function pushEntry(state, entry) {
    const top = state.stack[state.stack.length - 1];
    if (sameEntry(top, entry)) {
        return { ...state, guardOnTop: false };
    }
    return {
        ...state,
        guardOnTop: false,
        stack: [...state.stack, entry],
    };
}

/**
 * Browser or in-app back already moved off the current screen.
 * Root + no in-app history traps the first press and leaves on the second.
 */
export function back(state, now) {
    if (state.stack.length > 1) {
        const popped = state.stack[state.stack.length - 1];
        const stack = state.stack.slice(0, -1);
        return {
            state: {
                ...state,
                stack,
                guardOnTop: false,
            },
            action: 'pop',
            popped,
            top: stack[stack.length - 1],
            needsGuard: stack.length === 1,
        };
    }

    if (now < state.armedUntil) {
        return {
            state: { ...state, armedUntil: 0, guardOnTop: false },
            action: 'leave',
        };
    }

    return {
        state: { ...state, armedUntil: now + EXIT_WINDOW_MS, guardOnTop: true },
        action: 'trap',
        notice: EXIT_NOTICE,
    };
}

/** Mirror a react-router navigation that this module did not already record. */
export function noteRouter(state, entry, type) {
    if (!state || type === 'POP') return state;
    const top = state.stack[state.stack.length - 1];
    if (sameEntry(top, entry)) return state;
    if (type === 'REPLACE') {
        const stack = state.stack.slice();
        stack[stack.length - 1] = entry;
        return { ...state, stack, guardOnTop: false };
    }
    return pushEntry(state, entry);
}

let live = null;
let bootstrapped = false;
let skipNote = false;
const STACK_KEY = 'mt-nav-stack';

function persistLive() {
    if (!live || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(STACK_KEY, JSON.stringify(live.stack));
    } catch {
        /* private mode */
    }
}

function readSavedStack(root) {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const saved = JSON.parse(sessionStorage.getItem(STACK_KEY) || 'null');
        if (!Array.isArray(saved) || saved.length === 0 || !saved[0]?.kind) return null;
        let index = -1;
        for (let i = saved.length - 1; i >= 0; i -= 1) {
            if (sameEntry(saved[i], root)) {
                index = i;
                break;
            }
        }
        if (index < 0) return null;
        return saved.slice(0, index + 1);
    } catch {
        return null;
    }
}

export function getLiveHistory() {
    return live;
}

export function resetLiveHistory() {
    live = null;
    bootstrapped = false;
    skipNote = false;
}

export function entryForPath(pathname) {
    if (
        pathname.startsWith('/lobby/')
        || pathname.startsWith('/quiz/')
        || pathname.startsWith('/result/')
    ) {
        return { kind: 'route', path: pathname };
    }
    const raw = pathname.replace(/^\/+/, '');
    const view = !raw || raw === '/' ? 'dashboard' : (raw === 'ai_teacher' || raw === 'chat' ? 'met' : raw);
    return { kind: 'view', view, path: view === 'dashboard' && !raw ? '/dashboard' : pathname };
}

export function bootstrapHistory(root) {
    if (!live) {
        const canRestore = typeof window !== 'undefined' && Boolean(window.history.state?.mtReady);
        const restored = canRestore ? readSavedStack(root) : null;
        live = restored ? { stack: restored, guardOnTop: false, armedUntil: 0 } : createHistory(root);
        persistLive();
    }
    if (bootstrapped) return live;
    bootstrapped = true;
    if (typeof window === 'undefined') return live;
    const prev = window.history.state || {};
    if (!prev.mtReady) {
        window.history.replaceState({ ...prev, mt: true, mtReady: true }, '', window.location.href);
        window.history.pushState({ mt: true, mtGuard: true, mtReady: true }, '', window.location.href);
        live = { ...live, guardOnTop: true };
    } else if (live.stack.length === 1 && !prev.mtGuard) {
        window.history.pushState({ ...prev, mt: true, mtGuard: true, mtReady: true }, '', window.location.href);
        live = { ...live, guardOnTop: true };
    } else {
        live = { ...live, guardOnTop: Boolean(window.history.state?.mtGuard) };
    }
    return live;
}

export function consumeSkipNote() {
    const skip = skipNote;
    skipNote = false;
    return skip;
}

export function recordForward(entry, replaceGuard) {
    if (!live) live = createHistory(entry);
    live = pushEntry({ ...live, guardOnTop: replaceGuard || live.guardOnTop }, entry);
    skipNote = true;
    persistLive();
    return live;
}

export function recordCustom(entry) {
    if (!live) return { replaceGuard: false, state: live };
    const top = live.stack[live.stack.length - 1];
    if (sameEntry(top, entry)) return { replaceGuard: false, state: live, ignored: true };
    const replaceGuard = live.guardOnTop;
    live = pushEntry(live, entry);
    persistLive();
    return { replaceGuard, state: live, ignored: false };
}

export function markSkipNote() {
    skipNote = true;
}

export function applyRouterNote(entry, type) {
    if (!live) return live;
    if (consumeSkipNote()) return live;
    live = noteRouter(live, entry, type);
    persistLive();
    return live;
}

export function applyPop(now) {
    if (!live) return { action: 'trap', notice: EXIT_NOTICE, state: live };
    const result = back(live, now);
    live = result.state;
    persistLive();
    return result;
}

export function armRootBack(now) {
    if (!live) return 'trap';
    if (live.stack.length > 1) return 'pop';
    if (now < live.armedUntil) {
        live = { ...live, armedUntil: 0, guardOnTop: false };
        persistLive();
        return 'leave';
    }
    live = { ...live, armedUntil: now + EXIT_WINDOW_MS };
    persistLive();
    return 'trap';
}

export function markGuard(on) {
    if (!live) return;
    live = { ...live, guardOnTop: on };
}

export function canGoBack() {
    return Boolean(live && live.stack.length > 1);
}

export function bindAppHistory(handlers) {
    const changed = () => handlers.onChange?.();
    let guardTimer = 0;
    const scheduleGuard = () => {
        window.clearTimeout(guardTimer);
        guardTimer = window.setTimeout(() => {
            const prev = window.history.state || {};
            window.history.pushState({ ...prev, mt: true, mtGuard: true, mtReady: true }, '', window.location.href);
            markGuard(true);
            changed();
        }, 0);
    };
    const onPop = () => {
        if (window.location.pathname.startsWith('/quiz')) return;
        const result = applyPop(Date.now());
        if (result.action === 'pop') {
            if (result.popped?.kind === 'practice') handlers.onPracticeBack?.();
            if (result.popped?.kind === 'tests') {
                const screen = result.top?.kind === 'tests' ? result.top.screen : 'main';
                handlers.onTestScreen?.(screen);
            }
            if (result.needsGuard) scheduleGuard();
            changed();
            return;
        }
        if (result.action === 'trap') {
            handlers.onTrap?.(result.notice || EXIT_NOTICE);
            scheduleGuard();
            return;
        }
        window.clearTimeout(guardTimer);
        window.history.back();
    };

    const onPush = (event) => {
        const detail = event.detail;
        if (!detail?.kind) return;
        const entry = detail.kind === 'practice'
            ? { kind: 'practice', step: detail.step }
            : { kind: 'tests', screen: detail.screen };
        const recorded = recordCustom(entry);
        if (!recorded || recorded.ignored) return;
        if (typeof handlers.onCustomNavigate === 'function') {
            markSkipNote();
            handlers.onCustomNavigate({
                replace: Boolean(recorded.replaceGuard),
                kind: detail.kind,
                step: detail.step,
                screen: detail.screen,
            });
            changed();
            return;
        }
        const prev = window.history.state || {};
        const nextState = {
            ...prev,
            mt: true,
            mtReady: true,
            practiceStep: detail.kind === 'practice' ? detail.step : undefined,
            testWorldView: detail.kind === 'tests' ? detail.screen : undefined,
        };
        if (recorded.replaceGuard) window.history.replaceState(nextState, '', window.location.href);
        else window.history.pushState(nextState, '', window.location.href);
        changed();
    };

    window.addEventListener('popstate', onPop);
    window.addEventListener('app-history-push', onPush);
    return () => {
        window.removeEventListener('popstate', onPop);
        window.removeEventListener('app-history-push', onPush);
    };
}
