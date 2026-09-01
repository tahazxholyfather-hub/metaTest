import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionTimerProps {
    seconds: number;
    isLoading?: boolean;
}

export const QuestionTimer: React.FC<QuestionTimerProps> = ({ seconds, isLoading }) => {
    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    if (isLoading && seconds === 0) {
        return <div className="h-6 w-16 bg-[var(--bg-element)] rounded animate-pulse" />;
    }

    return (
        <div className="flex items-center gap-1.5" dir="ltr">
            <div className="flex items-center font-sans font-semibold text-[15px] tabular-nums tracking-tight text-[var(--text-primary)] h-6">
                {formatTime(seconds).split('').map((char, index) => (
                    <div
                        key={`${index}-${char}`}
                        className="relative flex justify-center items-center"
                        style={{ width: char === ':' ? '6px' : '9px' }}
                    >
                        {char === ':' ? (
                            <span className="text-[var(--text-muted)] pb-0.5">:</span>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                <motion.span
                                    key={`${index}-${char}`}
                                    initial={{ y: '100%', opacity: 0 }}
                                    animate={{ y: '0%', opacity: 1 }}
                                    exit={{ y: '-100%', opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    {char}
                                </motion.span>
                            </AnimatePresence>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
