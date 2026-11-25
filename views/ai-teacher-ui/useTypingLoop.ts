import { useEffect, useState } from 'react';

type Options = {
    typeMs?: number;
    eraseMs?: number;
    holdMs?: number;
    pauseMs?: number;
    enabled?: boolean;
};

/**
 * Loops through `lines`, typing each one out, holding, erasing, then moving
 * to the next — forever. Used by the Met intro screen's headline.
 */
export function useTypingLoop(lines: string[], opts: Options = {}) {
    const { typeMs = 34, eraseMs = 16, holdMs = 1800, pauseMs = 350, enabled = true } = opts;
    const [lineIndex, setLineIndex] = useState(0);
    const [text, setText] = useState('');
    const [phase, setPhase] = useState<'typing' | 'holding' | 'erasing' | 'pausing'>('typing');
    const linesKey = lines.join('|');

    // Restart cleanly whenever the line set itself changes (e.g. slide change).
    useEffect(() => {
        setLineIndex(0);
        setText('');
        setPhase('typing');
    }, [linesKey]);

    useEffect(() => {
        if (!enabled || !lines.length) return;
        const current = lines[lineIndex % lines.length];
        let timer: ReturnType<typeof setTimeout>;

        if (phase === 'typing') {
            if (text.length < current.length) {
                timer = setTimeout(() => setText(current.slice(0, text.length + 1)), typeMs);
            } else {
                timer = setTimeout(() => setPhase('holding'), 0);
            }
        } else if (phase === 'holding') {
            timer = setTimeout(() => setPhase('erasing'), holdMs);
        } else if (phase === 'erasing') {
            if (text.length > 0) {
                timer = setTimeout(() => setText(text.slice(0, -1)), eraseMs);
            } else {
                timer = setTimeout(() => setPhase('pausing'), 0);
            }
        } else {
            timer = setTimeout(() => {
                setLineIndex((i) => (i + 1) % lines.length);
                setPhase('typing');
            }, pauseMs);
        }

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, phase, lineIndex, enabled, linesKey]);

    return { text, isTyping: phase === 'typing' || phase === 'erasing' };
}
