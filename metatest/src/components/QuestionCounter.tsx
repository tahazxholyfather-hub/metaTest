import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionCounterProps {
    isLoading?: boolean;
    current: number;
    total: number;
}

export const QuestionCounter: React.FC<QuestionCounterProps> = ({ isLoading, current, total }) => {
    if (isLoading) {
        return <div className="h-6 w-16 bg-[var(--bg-element)] rounded animate-pulse" dir="rtl" />;
    }

    return (
        <div className="flex items-center gap-2 cursor-default" dir="rtl">
            <div className="flex items-center gap-1.5 font-sans font-semibold text-[15px] tabular-nums tracking-tight" dir="ltr">

                {/* Animated Current Number */}
                <div className="relative h-6 flex justify-center items-center overflow-hidden min-w-[24px]">
                    <AnimatePresence mode="popLayout">
                        <motion.span
                            key={current}
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: "0%", opacity: 1 }}
                            exit={{ y: "-100%", opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="absolute inset-0 flex items-center justify-center text-[var(--text-primary)]"
                        >
                            {current}
                        </motion.span>
                    </AnimatePresence>
                </div>

                <span className="text-[var(--text-muted)] font-normal text-sm pb-0.5">/</span>
                <span className="text-[var(--text-secondary)]">{total}</span>
            </div>
        </div>
    );
};
