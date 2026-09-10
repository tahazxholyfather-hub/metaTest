/** One shared player so replies never talk over each other; exposes a live 0..1 level for the character. */

type Listener = (playing: boolean, level: number) => void;

let current: HTMLAudioElement | null = null;
let currentOnEnd: (() => void) | null = null;
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;
const listeners = new Set<Listener>();

function notify(playing: boolean, level: number) {
    listeners.forEach((l) => l(playing, level));
}

export function getAudioContextCtor(): typeof AudioContext | undefined {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return w.AudioContext || w.webkitAudioContext;
}

function startMeter(audio: HTMLAudioElement) {
    try {
        const Ctor = getAudioContextCtor();
        if (!Ctor) throw new Error('no AudioContext');
        ctx = ctx || new Ctor();
        const source = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            if (!analyser || current !== audio) return;
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
            }
            notify(true, Math.min(1, Math.sqrt(sum / data.length) * 3.2));
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
    } catch {
        // Cross-origin or unsupported — fall back to a constant "speaking" level.
        notify(true, 0.5);
    }
}

export function stopSharedAudio() {
    cancelAnimationFrame(raf);
    if (current) {
        try {
            current.pause();
        } catch {
            /* ignore */
        }
        current = null;
    }
    if (currentOnEnd) {
        const cb = currentOnEnd;
        currentOnEnd = null;
        cb();
    }
    notify(false, 0);
}

export function playSharedAudio(url: string, onEnd: () => void) {
    stopSharedAudio();
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    current = audio;
    currentOnEnd = onEnd;
    const finish = () => {
        if (current === audio) {
            current = null;
            currentOnEnd = null;
            cancelAnimationFrame(raf);
            notify(false, 0);
        }
        onEnd();
    };
    audio.onended = finish;
    audio.onerror = finish;
    audio
        .play()
        .then(() => startMeter(audio))
        .catch(finish);
}

export function subscribeSharedAudio(listener: Listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
