// src/views/testworld/NotFoundView.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface NotFoundViewProps {
    onBack: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({ onBack }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center justify-center w-full h-full min-h-[80vh] px-6 text-center"
        >
            {/* Animated Icon Container */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                className="relative mb-8 flex items-center justify-center w-32 h-32 rounded-full bg-[var(--icon-bg)] shadow-[var(--shadow-2)] ring-1 ring-[var(--border-strong)]"
            >
                {/* Floating Sparkles/Magic SVG */}
                <motion.svg
                    animate={{
                        y: [-4, 4, -4],
                        rotate: [-2, 2, -2]
                    }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="w-16 h-16 text-[var(--icon-color)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                </motion.svg>

                {/* Decorative background glow linked to your accent color */}
                <div
                    className="absolute inset-0 rounded-full blur-xl -z-10 animate-pulse"
                    style={{ backgroundColor: 'var(--accent)', opacity: 0.15 }}
                ></div>
            </motion.div>

            {/* Text Content */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className="max-w-md"
            >
                <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-4 tracking-tight">
                    بـزودی...
                </h1>
                <p className="text-[var(--text-secondary)] leading-relaxed mb-10 text-lg">
                    این بخش در حال توسعه است و به زودی با امکانات شگفت‌انگیزی در دسترس شما قرار خواهد گرفت. منتظر باشید!
                </p>
            </motion.div>

            {/* Back Button */}
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.4 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onBack}
                className="group flex items-center justify-center gap-3 px-8 py-3.5 bg-[var(--accent)] text-[var(--text-inverse)] font-medium rounded-2xl shadow-[var(--shadow-1)] transition-all duration-300 hover:brightness-110 focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2 focus:ring-offset-[var(--bg-app)] focus:outline-none"
            >
                <svg
                    className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                </svg>
                بازگشت به صفحه قبل
            </motion.button>
        </motion.div>
    );
};
