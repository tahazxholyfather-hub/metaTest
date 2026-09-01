/**
 * CountdownTimer
 *
 * PREVIOUS API:  initialSeconds: number  (local clock, drifts on tab switch)
 * NEW API:       deadlineEpoch: number   (Unix ms absolute deadline from server)
 *
 * The component re-derives remaining time from Date.now() on every tick so it
 * is immune to:
 *   - Tab switching (browser throttles intervals to ~1 Hz when hidden)
 *   - System clock jumps
 *   - React re-renders that used to reset the old key-based timer
 *
 * Usage:
 *   <CountdownTimer deadlineEpoch={deadlineEpochMs} onTimeUp={handleTimeUp} />
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Timer } from 'lucide-react';

interface CountdownTimerProps {
    /** Absolute Unix millisecond timestamp when the quiz ends (from server). */
    deadlineEpoch: number;
    /** Called once when the countdown reaches zero. */
    onTimeUp?: () => void;
    /** Optional extra className for the root element. */
    className?: string;
}

function formatTime(totalSeconds: number): { minutes: string; seconds: string; isUrgent: boolean } {
    const s = Math.max(0, totalSeconds);
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return {
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0'),
        isUrgent: s <= 60,
    };
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
                                                                  deadlineEpoch,
                                                                  onTimeUp,
                                                                  className = '',
                                                              }) => {
    const [remaining, setRemaining] = useState<number>(() =>
        Math.max(0, Math.ceil((deadlineEpoch - Date.now()) / 1000)),
    );

    const hasCalledTimeUpRef = useRef(false);
    const onTimeUpRef = useRef(onTimeUp);

    useEffect(() => { onTimeUpRef.current = onTimeUp; });

    useEffect(() => {
        hasCalledTimeUpRef.current = false;

        const tick = () => {
            const r = Math.max(0, Math.ceil((deadlineEpoch - Date.now()) / 1000));
            setRemaining(r);

            if (r === 0 && !hasCalledTimeUpRef.current) {
                hasCalledTimeUpRef.current = true;
                onTimeUpRef.current?.();
            }
        };

        // Immediate tick so display is accurate even before the first interval fires
        tick();

        const id = setInterval(tick, 500); // 500ms so we never skip a second
        return () => clearInterval(id);
    }, [deadlineEpoch]);

    const { minutes, seconds, isUrgent } = formatTime(remaining);

    return (
        <div
            className={`flex items-center gap-1.5 tabular-nums font-bold select-none ${
                isUrgent
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-zinc-700 dark:text-zinc-300'
            } ${className}`}
            aria-label={`زمان باقی‌مانده: ${minutes} دقیقه و ${seconds} ثانیه`}
            role="timer"
        >
            <Timer
                size={15}
                strokeWidth={2.5}
                className={isUrgent ? 'animate-pulse' : ''}
            />
            <span className="text-sm md:text-base">
                {minutes}:{seconds}
            </span>
        </div>
    );
};

export default CountdownTimer;