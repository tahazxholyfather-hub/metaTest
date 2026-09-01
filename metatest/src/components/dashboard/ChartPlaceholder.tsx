// src/components/dashboard/ChartPlaceholder.tsx

import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export const ChartPlaceholder = () => {
    return (
        <div className="relative w-full h-56 md:h-64 bg-[var(--bg-element)]/50 rounded-lg flex flex-col items-center justify-center overflow-hidden border border-dashed border-[var(--border-strong)]">
            <div className="absolute inset-0 grid grid-cols-7 grid-rows-4 gap-x-2 p-4 opacity-10">
                {[...Array(4)].map((_, i) => (
                    <div key={`row-${i}`} className="col-span-7 border-b border-[var(--border-strong)]"></div>
                ))}
                {[...Array(7)].map((_, i) => (
                    <div key={`col-${i}`} className="row-span-4 border-r border-[var(--border-strong)]"></div>
                ))}
            </div>

            <motion.div
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
                className="absolute w-full h-full"
            >
                <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                    <motion.path
                        d="M 10 80 Q 50 20, 100 60 T 200 40 T 290 70"
                        stroke="var(--accent)"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </motion.div>

            <div className="z-10 text-center text-[var(--text-muted)] bg-[var(--bg-card)]/50 backdrop-blur-sm p-4 rounded-lg">
                <TrendingUp className="mx-auto mb-2" size={32} />
                <p className="font-bold">نمودار پیشرفت</p>
                <p className="text-sm">داده‌ها به زودی نمایش داده می‌شوند</p>
            </div>
        </div>
    );
};
