import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';

export interface StatItem {
    id: string | number;
    label: React.ReactNode;
    percentage?: number;
    color: string;
    icon?: React.ReactNode;
    iconAnimation?: 'check' | 'x' | 'none';
}

interface QuestionStatsDisplayProps {
    stats: StatItem[];
    isLoading?: boolean;
}

const iconEnterVariants: Record<'check' | 'x' | 'none', Variants> = {
    check: {
        initial: {
            opacity: 0,
            scale: 0.75,
        },
        animate: {
            opacity: 1,
            scale: [0.75, 1.12, 0.96, 1],
        },
        exit: {
            opacity: 0,
            scale: 0.92,
            transition: { duration: 0.18, ease: 'easeIn' },
        },
    },
    x: {
        initial: {
            opacity: 0,
            scale: 0.75,
        },
        animate: {
            opacity: 1,
            scale: [0.75, 1.14, 0.95, 1],
        },
        exit: {
            opacity: 0,
            scale: 0.92,
            transition: { duration: 0.18, ease: 'easeIn' },
        },
    },
    none: {
        initial: {
            opacity: 0,
            scale: 0.9,
        },
        animate: {
            opacity: 1,
            scale: 1,
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.18, ease: 'easeIn' },
        },
    },
};

const iconTransition = {
    duration: 0.55,
    ease: 'easeOut' as const,
    times: [0, 0.45, 0.75, 1],
};

const AnimatedCheckIcon = ({ color = '#22c55e' }: { color?: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: [0.9, 1.05, 1] }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex items-center justify-center"
        >
            <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <motion.path
                    d="M5 13L9.2 17.2L19 7.5"
                    stroke={color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                        pathLength: { duration: 0.45, ease: 'easeInOut' },
                        opacity: { duration: 0.15 },
                    }}
                />
            </svg>
        </motion.div>
    );
};

const AnimatedXIcon = ({ color = '#ef4444' }: { color?: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: [0.9, 1.05, 1] }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex items-center justify-center"
        >
            <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <motion.path
                    d="M7 7L17 17"
                    stroke={color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                        pathLength: { duration: 0.22, ease: 'easeInOut' },
                        opacity: { duration: 0.1 },
                    }}
                />
                <motion.path
                    d="M17 7L7 17"
                    stroke={color}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    exit={{ pathLength: 0, opacity: 0 }}
                    transition={{
                        pathLength: { duration: 0.22, ease: 'easeInOut', delay: 0.14 },
                        opacity: { duration: 0.1, delay: 0.14 },
                    }}
                />
            </svg>
        </motion.div>
    );
};



const QuestionStatsDisplay: React.FC<QuestionStatsDisplayProps> = ({ stats, isLoading }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(0);
    }, [stats]);

    useEffect(() => {
        if (!stats?.length || isLoading) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % stats.length);
        }, 4000);

        return () => clearInterval(interval);
    }, [stats, isLoading]);


    const renderAnimatedStatusIcon = (
        type: 'check' | 'x' | 'none' | undefined,
        color: string,
        fallbackIcon?: React.ReactNode
    ) => {
        if (type === 'check') return <AnimatedCheckIcon color={color} />;
        if (type === 'x') return <AnimatedXIcon color={color} />;
        return fallbackIcon ?? null;
    };



    if (isLoading || !stats?.length) {
        return (
            <div className="w-full max-w-sm mx-auto">
                <div dir="ltr" className="flex md:hidden items-center justify-between gap-3 animate-pulse">
                    <div className="flex flex-col gap-1 items-center shrink-0">
                        <div className="w-1 h-3 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                    </div>

                    <div className="flex items-center justify-between flex-1 min-w-0 gap-3">
                        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                    </div>
                </div>

                <div className="hidden md:flex items-center gap-3 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                    <div className="flex flex-col gap-2">
                        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                        <div className="h-2 w-10 rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                </div>
            </div>
        );
    }

    const safeIndex = currentIndex < stats.length ? currentIndex : 0;
    const currentStat = stats[safeIndex];

// Defensive check just in case
    if (!currentStat) return null;
    const hasPercentage = currentStat.percentage !== undefined;
    const iconAnimation = currentStat.iconAnimation ?? 'none';

    const viewBoxSize = 100;
    const strokeWidth = 10;
    const center = viewBoxSize / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    const safePercent = hasPercentage
        ? Math.max(0, Math.min(100, currentStat.percentage ?? 0))
        : 0;

    const strokeDashoffset = circumference - (safePercent / 100) * circumference;

    return (
        <div className="w-full max-w-sm mx-auto">
            {/* Mobile: [pagination]      [title | icon/progress] */}
            <div dir="ltr" className="flex md:hidden items-center justify-between gap-3 w-full">
                {/* Pagination */}
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                    {stats.map((_, index) => (
                        <div
                            key={index}
                            className={`rounded-full transition-all duration-300 ${
                                index === currentIndex
                                    ? 'w-1 h-3 bg-gray-700 dark:bg-gray-200'
                                    : 'w-1 h-1 bg-gray-300 dark:bg-gray-600'
                            }`}
                        />
                    ))}
                </div>

                {/* Title + Icon */}
                <div className="flex items-center justify-between flex-1 min-w-0 gap-3">
                    <div dir="rtl" className="min-w-0 flex-1 text-right">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`text-mobile-${currentStat.id}`}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className="min-w-0"
                            >
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {currentStat.label}
                                </div>

                                {hasPercentage && (
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                                        از پاسخ‌دهندگان
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
                        {hasPercentage && (
                            <svg
                                viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                                className="absolute inset-0 w-full h-full -rotate-90"
                            >
                                <circle
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth={strokeWidth}
                                    className="text-gray-100 dark:text-gray-800"
                                />
                                <motion.circle
                                    key={`progress-mobile-${currentStat.id}`}
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    fill="transparent"
                                    stroke={currentStat.color}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    initial={{ strokeDashoffset: circumference }}
                                    animate={{ strokeDashoffset }}
                                    transition={{ duration: 0.9, ease: 'easeOut' }}
                                    style={{ strokeDasharray: circumference }}
                                />
                            </svg>
                        )}

                        <div className="absolute inset-0 flex items-center justify-center">
                            <AnimatePresence mode="wait">
                                {hasPercentage ? (
                                    <motion.span
                                        key={`percent-mobile-${currentStat.id}`}
                                        initial={{ opacity: 0, scale: 0.82 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        transition={{ duration: 0.24 }}
                                        className="text-[11px] font-bold font-en leading-none"
                                        style={{ color: currentStat.color }}
                                    >
                                        {safePercent}%
                                    </motion.span>
                                ) : (
                                    <motion.div
                                        key={`icon-mobile-${currentStat.id}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center justify-center"
                                    >
                                        {renderAnimatedStatusIcon(iconAnimation, currentStat.color, currentStat.icon)}
                                    </motion.div>

                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-4">
                <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
                    {hasPercentage && (
                        <svg
                            viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
                            className="absolute inset-0 w-full h-full -rotate-90"
                        >
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth={strokeWidth}
                                className="text-gray-100 dark:text-gray-800"
                            />
                            <motion.circle
                                key={`progress-desktop-${currentStat.id}`}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke={currentStat.color}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.9, ease: 'easeOut' }}
                                style={{ strokeDasharray: circumference }}
                            />
                        </svg>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center">
                        <AnimatePresence mode="wait">
                            {hasPercentage ? (
                                <motion.span
                                    key={`percent-desktop-${currentStat.id}`}
                                    initial={{ opacity: 0, scale: 0.82 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.24 }}
                                    className="text-sm font-bold font-en leading-none"
                                    style={{ color: currentStat.color }}
                                >
                                    {safePercent}%
                                </motion.span>
                            ) : (
                                <motion.div
                                    key={`icon-desktop-${currentStat.id}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center justify-center"
                                >
                                    {renderAnimatedStatusIcon(iconAnimation, currentStat.color, currentStat.icon)}
                                </motion.div>

                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div dir="rtl" className="min-w-0 flex flex-col">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`text-desktop-${currentStat.id}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.24, ease: 'easeOut' }}
                        >
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                {currentStat.label}
                            </div>

                            {hasPercentage && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                                    از پاسخ‌دهندگان
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    <div className="flex gap-1 mt-2">
                        {stats.map((_, index) => (
                            <div
                                key={index}
                                className={`h-1 rounded-full transition-all duration-300 ${
                                    index === currentIndex
                                        ? 'w-3 bg-gray-800 dark:bg-gray-200'
                                        : 'w-1 bg-gray-300 dark:bg-gray-600'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuestionStatsDisplay;
