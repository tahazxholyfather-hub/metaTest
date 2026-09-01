import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizCountdownProps {
    startAt?: number;          // UTC timestamp from server
    serverOffset?: number;     // serverNow - clientNow
    durationMs?: number;       // fallback duration (default 3000)
    onComplete: () => void;
}



export const QuizCountdown: React.FC<QuizCountdownProps> = ({
                                                                startAt,
                                                                serverOffset = 0,
                                                                durationMs = 3000,
                                                                onComplete
                                                            }) => {
    const [step, setStep] = useState<number | string | null>(null);
    const completedRef = useRef(false);

    useEffect(() => {
        completedRef.current = false;

        // ─────────────────────────────────────────────
        // MODE 1: Synced countdown (server-based)
        // ─────────────────────────────────────────────
        if (startAt) {
            const update = () => {
                const now = Date.now() + serverOffset;
                const diff = startAt - now;

                if (diff <= 0) {
                    if (!completedRef.current) {
                        completedRef.current = true;
                        setStep("شروع!");
                        setTimeout(onComplete, 600);
                    }
                    return;
                }

                // ✅ Correct second calculation (no jump numbers)
                const secondsLeft = Math.max(
                    0,
                    Math.floor((diff + 999) / 1000)
                );

                setStep(secondsLeft);
            };

            update();
            const interval = setInterval(update, 250); // 250ms is enough
            return () => clearInterval(interval);
        }

        // ─────────────────────────────────────────────
        // MODE 2: Local fallback countdown
        // ─────────────────────────────────────────────
        let localSeconds = Math.floor(durationMs / 1000);
        setStep(localSeconds);

        const interval = setInterval(() => {
            localSeconds -= 1;

            if (localSeconds <= 0) {
                if (!completedRef.current) {
                    completedRef.current = true;
                    setStep("شروع!");
                    clearInterval(interval);
                    setTimeout(onComplete, 600);
                }
                return;
            }

            setStep(localSeconds);
        }, 1000);

        return () => clearInterval(interval);

    }, [startAt, serverOffset, durationMs, onComplete]);

    if (step === null) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none text-[var(--text-primary)]">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.2 }}
                    className="text-4xl md:text-6xl font-bold"
                >
                    {step}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};
