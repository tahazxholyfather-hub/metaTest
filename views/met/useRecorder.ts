import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContextCtor } from './audio';

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'unsupported';

export interface Recording {
    blob: Blob;
    mimeType: string;
    durationSeconds: number;
}

function pickMimeType(): string {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
}

/**
 * Microphone capture with a live 0..1 loudness level (drives Met's `listening` eyes).
 * Resolves the recording on stop; caller sends it to /voice/transcribe.
 */
export function useRecorder(maxSeconds = 120) {
    const [state, setState] = useState<RecorderState>(() =>
        typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'
            ? 'idle'
            : 'unsupported'
    );
    const [level, setLevel] = useState(0);
    const [seconds, setSeconds] = useState(0);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const startedAtRef = useRef(0);
    const rafRef = useRef(0);
    const timerRef = useRef<number | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);
    const resolveRef = useRef<((r: Recording | null) => void) | null>(null);

    const cleanup = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        ctxRef.current?.close().catch(() => {});
        ctxRef.current = null;
        recorderRef.current = null;
        setLevel(0);
    }, []);

    const stop = useCallback((): Promise<Recording | null> => {
        const rec = recorderRef.current;
        if (!rec || rec.state === 'inactive') {
            cleanup();
            setState((s) => (s === 'unsupported' ? s : 'idle'));
            return Promise.resolve(null);
        }
        return new Promise<Recording | null>((resolve) => {
            resolveRef.current = resolve;
            try {
                rec.stop();
            } catch {
                resolve(null);
            }
        });
    }, [cleanup]);

    const cancel = useCallback(() => {
        const rec = recorderRef.current;
        resolveRef.current = null;
        chunksRef.current = [];
        try {
            rec?.stop();
        } catch {
            /* ignore */
        }
        cleanup();
        setState((s) => (s === 'unsupported' ? s : 'idle'));
    }, [cleanup]);

    const start = useCallback(async () => {
        if (state === 'unsupported' || state === 'recording' || state === 'requesting') return false;
        setState('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
            streamRef.current = stream;
            const mimeType = pickMimeType();
            const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];
            rec.ondataavailable = (e) => {
                if (e.data?.size) chunksRef.current.push(e.data);
            };
            rec.onstop = () => {
                const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
                const type = rec.mimeType || mimeType || 'audio/webm';
                const blob = new Blob(chunksRef.current, { type });
                const resolve = resolveRef.current;
                resolveRef.current = null;
                chunksRef.current = [];
                cleanup();
                setState('idle');
                setSeconds(0);
                resolve?.(blob.size > 0 ? { blob, mimeType: type, durationSeconds } : null);
            };
            recorderRef.current = rec;

            // Loudness meter
            try {
                const Ctor = getAudioContextCtor();
                if (!Ctor) throw new Error('no AudioContext');
                const ctx = new Ctor();
                ctxRef.current = ctx;
                const src = ctx.createMediaStreamSource(stream);
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 256;
                src.connect(analyser);
                const data = new Uint8Array(analyser.frequencyBinCount);
                const tick = () => {
                    analyser.getByteTimeDomainData(data);
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const v = (data[i] - 128) / 128;
                        sum += v * v;
                    }
                    setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
                    rafRef.current = requestAnimationFrame(tick);
                };
                rafRef.current = requestAnimationFrame(tick);
            } catch {
                /* meter is optional */
            }

            startedAtRef.current = Date.now();
            setSeconds(0);
            timerRef.current = window.setInterval(() => {
                const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
                setSeconds(s);
                if (s >= maxSeconds) void stop();
            }, 250);

            rec.start(250);
            setState('recording');
            return true;
        } catch (err) {
            cleanup();
            setState('idle');
            throw err;
        }
    }, [state, cleanup, maxSeconds, stop]);

    useEffect(() => () => cleanup(), [cleanup]);

    return { state, level, seconds, start, stop, cancel, supported: state !== 'unsupported' };
}
