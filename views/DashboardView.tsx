// src/views/DashboardView.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
    Award, Target, BarChart3, UserPlus, Zap, Shield, Clock,
    Users, Check, ArrowUpRight, Activity, BookOpen, Star,
    Layers, PieChart, Send, Inbox, LineChart, HelpCircle,
    Flame, X, ChevronRight, ChevronLeft, Trophy, Search, Share2,
    History, Copy, Smartphone, UserCheck, MessageSquare, Percent, Tag, Calendar,
    Gift, Quote
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { useUser } from '../context/UserContext';
import { ResponsiveModal } from '../components/ResponsiveModal';
import { flowApi } from '../lib/authApi';
import { useTour, type TourStep } from '../context/TourContext';
import { toast } from 'sonner';

// ─── Module-level cache ───────────────────────────────────────────────────────
let isDashboardLoaded = false;
let cachedDashboardData: any = null;

const IconMap: Record<string, any> = {
    UserPlus, Users, Shield, Zap, Award, Star, Trophy, Flame,
    'user-edit': UserCheck, 'lock': Shield, 'image': Activity,
    'check-circle': Check, 'clipboard-list': Layers
};
const smoothTween = { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] };
const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
};
const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: smoothTween }
};

// ─── Theme-aware chart colors (synced with index.css tokens) ─────────────────
// Light: --color-primary-500 (#2F5F9A) / Dark: --color-primary-500 (#8B5CF6).
// SVG presentation attributes can't resolve CSS variables reliably, so we
// watch the <html> class list and pick the concrete hex values ourselves.
const useIsDarkTheme = () => {
    const [isDark, setIsDark] = useState(() =>
        typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
    );
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);
    return isDark;
};

const getChartColors = (isDark: boolean) => ({
    // wave / radar main color follows the app primary token per theme
    primary: isDark ? '#8B5CF6' : '#2F5F9A',
    primaryStrong: isDark ? '#7C3AED' : '#1C4070',
    axis: isDark ? '#a9a9ad' : '#64748B'
});

// ─── Sample data for chart placeholders (shown until real data exists) ───────
const SAMPLE_ACTIVITY_DATA = [
    { date: 'شنبه', time: 12 }, { date: 'یکشنبه', time: 32 }, { date: 'دوشنبه', time: 22 },
    { date: 'سه‌شنبه', time: 48 }, { date: 'چهارشنبه', time: 30 }, { date: 'پنجشنبه', time: 58 },
    { date: 'جمعه', time: 44 }
];

const SAMPLE_PENTAGON_DATA = [
    { subject: 'ریاضیات', score: 65, fullMark: 100 },
    { subject: 'زیست‌شناسی', score: 45, fullMark: 100 },
    { subject: 'شیمی', score: 70, fullMark: 100 },
    { subject: 'فیزیک', score: 40, fullMark: 100 },
    { subject: 'دقت عمومی', score: 55, fullMark: 100 }
];

// ─── Glassy placeholder overlay for empty charts ──────────────────────────────
const ChartGlassPlaceholder = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-3">
        <div className="backdrop-blur-md bg-[var(--bg-card)]/60 border border-[var(--border)]/80 rounded-2xl px-5 py-4 shadow-[var(--shadow-1)] text-center max-w-[270px]">
            <div className="w-9 h-9 mx-auto mb-2 rounded-full bg-[var(--color-primary-500)]/10 text-[var(--color-primary-500)] flex items-center justify-center">
                <Icon size={18} strokeWidth={1.8} />
            </div>
            <h4 className="text-[11px] font-bold text-[var(--text-primary)] mb-1">{title}</h4>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{description}</p>
        </div>
    </div>
);

// ─── Famous Scientists Quote Slider ───────────────────────────────────────────
const SCIENTIST_QUOTES = [
    {
        text: 'دانش، غذای روح است.',
        author: 'ابوعلی سینا',
        role: 'فیلسوف و پزشک',
        image: '/images/photo1.png'
    },
    {
        text: 'حقیقت با خرد و تجربه به دست می‌آید، نه با تقلید.',
        author: 'محمد زکریای رازی',
        role: 'پزشک و فیلسوف',
        image: '/images/photo2.png'
    },
    {
        text: 'اگر دورتر دیده‌ام، به این دلیل است که بر شانه‌های غول‌ها ایستاده‌ام.',
        author: 'آیزاک نیوتن',
        role: 'فیزیک‌دان و ریاضی‌دان',
        image: '/images/photo3.png'
    },
    {
        text: 'قوی‌ترین یا باهوش‌ترین موجودات زنده نمی‌مانند؛ آن‌هایی باقی می‌مانند که بهتر خود را با تغییر سازگار می‌کنند.',
        author: 'چارلز داروین',
        role: 'زیست‌شناس و طبیعت‌شناس',
        image: '/images/photo4.png'
    },
    {
        text: 'تخیل از دانش مهم‌تر است.',
        author: 'آلبرت اینشتین',
        role: 'فیزیک‌دان نظری',
        image: '/images/photo5.png'
    }
];

const QuoteSlider = () => {
    const [index, setIndex] = useState(0);
    const [imgError, setImgError] = useState<Record<number, boolean>>({});
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        const timer = setInterval(() => {
            setIndex(prev => (prev + 1) % SCIENTIST_QUOTES.length);
        }, 6000);

        return () => clearInterval(timer);
    }, [isPaused]);

    const quote = SCIENTIST_QUOTES[index];

    return (
        <div
            className="group relative overflow-hidden rounded-2xl border border-[var(--border)] h-[150px]  bg-[var(--bg-card)] transition-all duration-500 hover:border-[var(--color-primary-500)]/20 hover:shadow-xl hover:shadow-[var(--color-primary-500)]/5"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Left side - Minimal Image/Illustration */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`img-${index}`}
                    initial={{ clipPath: 'inset(0 100% 0 0)' }}
                    animate={{ clipPath: 'inset(0 0% 0 0)' }}
                    exit={{ clipPath: 'inset(0 0 0 100%)' }}
                    transition={{
                        duration: 0.8,
                        ease: [0.76, 0, 0.24, 1]
                    }}
                    className="absolute left-0 top-0 bottom-0 w-[130px] sm:w-[160px] overflow-hidden"
                >
                    {/* Background accent */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary-500)]/5 via-transparent to-[var(--color-primary-500)]/5" />

                    {!imgError[index] ? (
                        <div className="relative h-full w-full">
                            <img
                                src={quote.image}
                                alt=""
                                aria-hidden
                                className="absolute inset-0 h-50 w-50 object-cover object-center opacity-30 dark:opacity-20 transition-all duration-700 group-hover:opacity-40 dark:group-hover:opacity-25 group-hover:scale-105"
                                onError={() => setImgError(prev => ({ ...prev, [index]: true }))}
                            />
                            {/* Subtle gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[var(--bg-card)]" />
                        </div>
                    ) : (
                        <motion.div
                            className="absolute inset-0 flex items-center justify-center"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--color-primary-500)]/10 flex items-center justify-center">
                                <span className="text-xl sm:text-2xl font-bold text-[var(--color-primary-500)]/40">
                                    {quote.author.charAt(0)}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Decorative vertical line */}
            <div className="absolute left-[130px] sm:left-[160px] top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-[var(--border)]/50 to-transparent" />

            {/* Right side - Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`content-${index}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{
                        duration: 0.4,
                        ease: [0.25, 0.1, 0, 1],
                        opacity: { duration: 0.3 }
                    }}
                    className="relative z-10 h-full ml-[130px] sm:ml-[160px] flex flex-col justify-center px-4 sm:px-6"
                >
                    {/* Quote mark */}
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15, duration: 0.3 }}
                    >
                        <svg
                            width="20"
                            height="16"
                            viewBox="0 0 20 16"
                            className="text-[var(--color-primary-500)]/30 mb-2"
                            fill="currentColor"
                        >
                            <path d="M0 16V9.6C0 5.6 1.6 2.4 4.8 0L7.2 3.2C5.6 4.8 4.8 6.4 4.8 8H9.6V16H0ZM10.4 16V9.6C10.4 5.6 12 2.4 15.2 0L17.6 3.2C16 4.8 15.2 6.4 15.2 8H20V16H10.4Z" />
                        </svg>
                    </motion.div>

                    {/* Quote text */}
                    <motion.p
                        className="text-[11.5px] sm:text-[12.5px] font-medium text-[var(--text-primary)] leading-relaxed tracking-[-0.01em] line-clamp-2 sm:line-clamp-3 mb-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25, duration: 0.4 }}
                    >
                        {quote.text}
                    </motion.p>

                    {/* Author section */}
                    <motion.div
                        className="flex items-center gap-2"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.3 }}
                    >
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] tracking-tight">
                            {quote.author}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]/40" />
                        <span className="text-[10px] text-[var(--text-muted)] tracking-tight font-medium">
                            {quote.role}
                        </span>
                    </motion.div>
                </motion.div>
            </AnimatePresence>

            {/* Bottom progress indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--border)]/20">
                <motion.div
                    key={`progress-${index}`}
                    className="h-full bg-gradient-to-r from-[var(--color-primary-500)]/60 to-[var(--color-primary-500)]/30"
                    initial={{ width: '0%' }}
                    animate={{ width: isPaused ? '0%' : '100%' }}
                    transition={{
                        duration: isPaused ? 0 : 6,
                        ease: 'linear',
                    }}
                />
            </div>

            {/* Navigation dots - minimal */}
            <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
                {SCIENTIST_QUOTES.map((_, i) => (
                    <button
                        key={`dot-${i}`}
                        onClick={() => setIndex(i)}
                        aria-label={`Quote ${i + 1}`}
                        className="relative w-4 h-4 flex items-center justify-center"
                    >
                        <span
                            className={`block rounded-full transition-all duration-400 ease-out
                                ${i === index
                                ? 'w-1.5 h-1.5 bg-[var(--color-primary-500)] scale-100'
                                : 'w-1 h-1 bg-[var(--text-muted)]/20 hover:bg-[var(--text-muted)]/40 scale-75 hover:scale-100'
                            }`}
                        />
                    </button>
                ))}
            </div>

            {/* Pause indicator on hover */}
            <AnimatePresence>
                {isPaused && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute top-3 right-3 flex items-center gap-1.5 text-[9px] text-[var(--text-muted)]"
                    >
                        <div className="w-1 h-1 rounded-full bg-[var(--color-primary-500)]/50" />
                        <span>Paused</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Unified reward icon (synced across task cards, modal & history) ─────────
type RewardKind = 'xp' | 'trophy' | 'discount';

const REWARD_STYLE: Record<RewardKind, { colorClass: string; bgClass: string }> = {
    xp:       { colorClass: 'text-indigo-500', bgClass: 'bg-indigo-500/10' },
    trophy:   { colorClass: 'text-amber-500',  bgClass: 'bg-amber-500/10' },
    discount: { colorClass: 'text-rose-500',   bgClass: 'bg-rose-500/10' }
};

const RewardIcon = ({ kind, size = 12 }: { kind: RewardKind; size?: number }) => {
    if (kind === 'trophy') return <Award size={size} fill="currentColor" />;
    if (kind === 'discount') return <Percent size={size} strokeWidth={2.5} />;
    return <Zap size={size} fill="currentColor" />;
};

const getTaskRewardKind = (task: any): RewardKind => {
    if (task.rewardBadge === 'discount' || task.rewardBadge === 'Gift' || task.id === 5) return 'discount';
    if ((task.rewardTrophy || 0) > 0 || task.id === 7) return 'trophy';
    return 'xp';
};

// ─── Game-style flying rewards (from task card to screen center) ─────────────
interface RewardFlightItem {
    id: string;
    kind: RewardKind;
    startX: number;
    startY: number;
}

const RewardFlightLayer = ({ flights, onFinish }: { flights: RewardFlightItem[]; onFinish: (id: string) => void }) => (
    <div className="fixed inset-0 pointer-events-none z-[9999]" aria-hidden="true">
        <AnimatePresence>
            {flights.map((flight) => {
                const centerX = window.innerWidth / 2;
                const centerY = window.innerHeight / 2;
                const scatterX = (Math.random() - 0.5) * 90;
                const scatterY = (Math.random() - 0.5) * 90;
                const delay = Math.random() * 0.25;
                const style = REWARD_STYLE[flight.kind];

                return (
                    <motion.div
                        key={flight.id}
                        initial={{ x: flight.startX, y: flight.startY, scale: 0.3, opacity: 0, rotate: -20 }}
                        animate={{
                            x: [flight.startX, flight.startX + scatterX, centerX],
                            y: [flight.startY, flight.startY + scatterY - 40, centerY],
                            scale: [0.3, 1, 1.7],
                            opacity: [0, 1, 1, 0],
                            rotate: [-20, 10, 0]
                        }}
                        transition={{ duration: 1.05, delay, ease: 'easeInOut', times: [0, 0.35, 1] }}
                        onAnimationComplete={() => onFinish(flight.id)}
                        style={{ position: 'absolute', top: -20, left: -20 }}
                    >
                        <div className={`w-10 h-10 rounded-full ${style.bgClass} ${style.colorClass} border border-current/20 flex items-center justify-center shadow-lg backdrop-blur-sm`}>
                            <RewardIcon kind={flight.kind} size={20} />
                        </div>
                    </motion.div>
                );
            })}
        </AnimatePresence>
    </div>
);

// Obfuscate phone helper
const encryptPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const cleanPhone = phone.replace(/\D/g, '');
    try {
        const encoded = btoa(cleanPhone);
        return encoded.replace(/=/g, '').slice(-8);
    } catch {
        return cleanPhone.slice(-6);
    }
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Shimmer = ({ className }: { className: string }) => (
    <div className={`relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-[var(--text-muted)]/10 before:to-transparent ${className}`} />
);
const DashboardSkeleton = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 space-y-4 md:space-y-5 pb-20 md:pb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[1,2,3,4].map(i => <Shimmer key={`stat-skel-${i}`} className="h-16 sm:h-[68px] rounded-xl" />)}
            </div>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-3 py-1">
                {[1,2,3,4,5].map(i => <Shimmer key={`short-skel-${i}`} className="h-16 sm:h-[72px] rounded-[14px] sm:rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                <Shimmer className="lg:col-span-2 h-[220px] rounded-xl" />
                <Shimmer className="h-[220px] rounded-xl" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
                <Shimmer className="lg:col-span-2 h-[260px] rounded-xl" />
                <Shimmer className="h-[260px] rounded-xl" />
            </div>
        </div>
    </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ icon: Icon, title, description }: { icon: any, title: string, description?: string }) => (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[140px] bg-[var(--bg-element)]/50 rounded-xl border border-dashed border-[var(--border)] p-4 text-center">
        <div className="w-10 h-10 mb-2.5 rounded-full bg-[var(--bg-card)] shadow-sm flex items-center justify-center text-[var(--text-muted)]">
            <Icon size={20} strokeWidth={1.5} />
        </div>
        <h4 className="text-xs font-bold text-[var(--text-primary)] mb-1">{title}</h4>
        {description && <p className="text-[10px] text-[var(--text-muted)] max-w-[200px] leading-relaxed">{description}</p>}
    </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const ColorfulStatCard = ({ icon: Icon, label, value, colorClass, bgClass, wrapperClass = "" }: any) => (
    <div className={`${wrapperClass} bg-[var(--bg-card)] p-3 rounded-xl border border-[var(--border)] flex items-center gap-3 transition-colors hover:border-[var(--text-muted)] duration-500 cursor-pointer`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${bgClass} ${colorClass}`}>
            <Icon size={20} strokeWidth={2} />
        </div>
        <div>
            <p className="text-[10px] sm:text-xs font-medium text-[var(--text-muted)] mb-0.5">{label}</p>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">{value}</h3>
        </div>
    </div>
);

// ─── Shortcut Button ──────────────────────────────────────────────────────────
const ShortcutBtn = ({ icon: Icon, label, onClick }: any) => (
    <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className="group relative flex flex-col sm:flex-row items-center sm:justify-start gap-1.5 sm:gap-4 h-full p-1 sm:p-3 sm:pl-4 sm:pr-5 rounded-2xl sm:bg-[var(--bg-card)] sm:border border-transparent sm:border-[var(--border)] sm:hover:border-[var(--accent)]/50 sm:hover:bg-[var(--bg-elevated)] transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] overflow-hidden"
    >
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-0 group-hover:h-3/4 bg-[var(--accent)] transition-all duration-300 hidden sm:block rounded-l-full opacity-0 group-hover:opacity-100" />
        <div className="relative flex items-center justify-center shrink-0 w-11 h-11 sm:w-10 sm:h-10 rounded-[16px] sm:rounded-xl bg-[var(--bg-card)] sm:bg-[var(--bg-app)] shadow-[var(--shadow-1)] sm:shadow-none border border-[var(--border)] sm:border-transparent group-hover:bg-[var(--accent)] group-hover:border-[var(--accent)] transition-all duration-300 z-10">
            <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px] text-[var(--icon-color)] sm:text-[var(--text-secondary)] group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
        </div>
        <span className="text-[8.5px] sm:text-[13px] whitespace-nowrap font-bold text-[var(--text-muted)] sm:text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors duration-300 text-center sm:text-right z-10">{label}</span>
    </motion.button>
);

// ─── Task Ring ────────────────────────────────────────────────────────────────
const TaskRing = ({ progress, isDone, icon: Icon }: { progress: number, isDone: boolean, icon: any }) => {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    return (
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="20" cy="20" r={radius} stroke="var(--bg-element)" strokeWidth="3" fill="none" />
                <motion.circle cx="20" cy="20" r={radius} stroke="var(--color-primary-500)" strokeWidth="3" fill="none" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: isDone ? 0 : strokeDashoffset }} transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }} strokeLinecap="round" />
            </svg>
            <div className={`relative z-10 transition-colors duration-500 ${isDone ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-secondary)]'}`}>
                {isDone ? <Check size={16} strokeWidth={3} /> : <Icon size={16} strokeWidth={2} />}
            </div>
        </div>
    );
};

// ─── Task Item ────────────────────────────────────────────────────────────────
const TaskItem = ({ task, onClaimReward, claiming, totalInvitesCount }: { task: any, onClaimReward: (task: any, originRect?: DOMRect) => void, claiming: boolean, totalInvitesCount: number }) => {
    // Dynamic override: Force Task 5 (Invitations) to sync progress with local invites count
    const adjustedCurrent = task.id === 5 ? totalInvitesCount : task.current;

    const progress = Math.min(100, (adjustedCurrent / Math.max(1, task.target)) * 100);
    const isDone = adjustedCurrent >= task.target || !!task.isCompleted;
    // Claim when done/complete in DB and reward not yet claimed (do NOT require !isCompleted)
    const canClaim = isDone && !task.rewardClaimed;
    const TaskIcon = IconMap[task.icon] || Star;

    // Unified reward badge — same icon set used in the claim modal & history
    const rewardKind = getTaskRewardKind(task);
    const rewardStyle = REWARD_STYLE[rewardKind];
    const rewardLabel = rewardKind === 'discount' ? 'تخفیف' : rewardKind === 'trophy' ? (task.rewardTrophy || 5) : task.rewardXp;

    return (
        <div
            onClick={(e) => { if (canClaim && !claiming) onClaimReward(task, e.currentTarget.getBoundingClientRect()); }}
            className={`relative overflow-hidden rounded-xl border p-3 transition-all duration-300 group h-[76px] shrink-0 ${canClaim ? 'hover:scale-[1.01] cursor-pointer' : ''} ${isDone ? 'bg-[var(--color-primary-500)]/5 border-[var(--color-primary-500)]/30' : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-[var(--text-muted)]/50'}`}
        >
            <div className="flex items-center gap-3">
                <TaskRing progress={progress} isDone={isDone} icon={TaskIcon} />
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate pr-2">{task.title}</h4>
                        <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${rewardStyle.colorClass} ${rewardStyle.bgClass}`}>
                            <RewardIcon kind={rewardKind} size={10} /> {rewardLabel}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-[var(--text-muted)] shrink-0">{adjustedCurrent} از {task.target}</span>
                    </div>
                </div>
            </div>

            {/* Simple glassy claim overlay */}
            {canClaim && (
                <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 select-none cursor-pointer bg-white/35 dark:bg-black/35 backdrop-blur-md border border-white/25 dark:border-white/10">
                    <motion.div
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                        className="w-8 h-8 rounded-full bg-white/40 dark:bg-white/10 border border-white/50 dark:border-white/20 flex items-center justify-center text-[var(--color-primary-500)] shadow-sm shrink-0"
                    >
                        <Gift size={15} />
                    </motion.div>
                    <span className="text-[11px] font-extrabold text-[var(--text-primary)] flex items-center gap-1 drop-shadow-sm">
                        {claiming ? 'در حال دریافت...' : 'دریافت پاداش'}
                        {!claiming && <ArrowUpRight size={12} strokeWidth={2.5} className="opacity-70" />}
                    </span>
                </div>
            )}
        </div>
    );
};

// ─── Daily Streak Card ────────────────────────────────────────────────────────
const DailyStreakCard = ({ currentStreak, longestStreak }: { currentStreak: number; longestStreak: number }) => (
    <motion.div variants={itemVariants} className="dashboard-tour-streak card relative overflow-hidden rounded-2xl p-4 sm:p-5 border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent)_12%,transparent)_0%,transparent_40%)]" />
        <div className="relative z-10 flex items-start justify-between">
            <div>
                <h3 className="mb-1 text-xs font-bold text-[color:var(--text-secondary)]">روز متوالی فعالیت</h3>
                <div className="flex items-end gap-2">
                    <span className="text-4xl font-black leading-none text-[color:var(--text-primary)]">{currentStreak}</span>
                    <span className="text-sm font-semibold text-[color:var(--text-muted)]">روز</span>
                </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--bg-elevated))] text-[color:var(--accent)] animate-pulse">
                <Flame size={26} strokeWidth={1.8} />
            </div>
        </div>
        <div className="relative z-10 mt-4 border-t border-[color:var(--border)] pt-3">
            <div className="flex items-center justify-between text-xs">
                <span className="text-[color:var(--text-muted)]">بهترین رکورد شما</span>
                <span className="inline-flex items-center gap-1 font-bold text-[color:var(--text-primary)]">
                    <Star size={12} className="text-[color:var(--accent)]" fill="currentColor" />{longestStreak}
                </span>
            </div>
        </div>
    </motion.div>
);

// ─── Invited User Card Row ────────────────────────────────────────────────────
const InvitedUserRow = ({ invite }: { invite: any }) => {
    const isActive = invite.status === 'active';
    return (
        <div className="flex items-center justify-between p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-element)]/30 transition-all duration-300 group hover:scale-[1.01] hover:bg-[var(--bg-element)]/60">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-500)]/10 border border-[var(--color-primary-500)]/25 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[var(--color-primary-600)]">
                        {invite.name?.charAt(0) || 'U'}
                    </span>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{invite.name || 'کاربر بدون نام'}</span>
                    <span className="text-[9px] text-[var(--text-muted)] truncate tracking-wider" dir="ltr">{invite.invited_phone}</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-[var(--color-primary-500)]/15 text-[var(--color-primary-500)]' : 'bg-amber-500/10 text-amber-500'}`}>
                    {isActive ? 'فعال شده' : 'در انتظار'}
                </span>
                {isActive && (
                    <span className="w-4 h-4 rounded-full bg-[var(--color-primary-500)] text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                    </span>
                )}
            </div>
        </div>
    );
};

// ════════════════════════════════════════════════════════════════════════════════
// ██████████████████████   DASHBOARD VIEW   ██████████████████████████████████████
// ════════════════════════════════════════════════════════════════════════════════

interface DashboardProps {
    onNavigateToQuizHistory: () => void;
    onNavigateToNotes?: () => void;
    onNavigateToFavorites?: () => void;
    onNavigateToReview?: () => void;
    onNavigateToReports?: () => void;
}

export function DashboardView({
                                  onNavigateToQuizHistory,
                                  onNavigateToNotes,
                                  onNavigateToFavorites,
                                  onNavigateToReview,
                                  onNavigateToReports,
                              }: DashboardProps) {
    const { user } = useUser();
    const { startTour } = useTour();

    const [stats, setStats] = useState(cachedDashboardData?.stats || { xp: 0, accuracy: "۰٪", rank: "-", practiceTime: "۰ ساعت", trophies: 0 });
    const [tasks, setTasks] = useState(cachedDashboardData?.tasks || { permanent: [], temporary: [] });
    const [invites, setInvites] = useState(cachedDashboardData?.invites || { list: [], totalInvited: 0, activeInvites: 0 });
    const [topicMastery, setTopicMastery] = useState(cachedDashboardData?.topicMastery || []);
    const [activityData, setActivityData] = useState<any>(cachedDashboardData?.activity || { '7d': [], '1m': [], '1y': [] });
    const [streak, setStreak] = useState(cachedDashboardData?.streak || { current: 0, longest: 0 });
    const [rewardHistory, setRewardHistory] = useState<any[]>(cachedDashboardData?.rewardHistory || []);

    const [isLoading, setIsLoading] = useState(!isDashboardLoaded);
    const [taskTab, setTaskTab] = useState<'missions' | 'rewards'>('missions');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isReferrerModalOpen, setIsReferrerModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [rewardFlights, setRewardFlights] = useState<RewardFlightItem[]>([]);

    const isDarkTheme = useIsDarkTheme();
    const chartColors = useMemo(() => getChartColors(isDarkTheme), [isDarkTheme]);

    const [referrerCode, setReferrerCode] = useState('');
    const [referrerName, setReferrerName] = useState('');
    const [referrerInput, setReferrerInput] = useState('');
    const [referrerError, setReferrerError] = useState('');
    const [submittingReferrer, setSubmittingReferrer] = useState(false);
    const [showVerificationConfirm, setShowVerificationConfirm] = useState(false);
    const [previewInviterData, setPreviewInviterData] = useState<{ name: string; phone: string } | null>(null);

    const [copied, setCopied] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'7d' | '1m' | '1y'>('7d');
    const [renderCharts, setRenderCharts] = useState(false);
    const [claimingRewardId, setClaimingRewardId] = useState<number | null>(null);
    const [rewardModalData, setRewardModalData] = useState<{ isOpen: boolean; rewardType: 'xp' | 'trophy' | 'discount'; rewardValue: string | number; taskTitle: string } | null>(null);
    const [discountCopied, setDiscountCopied] = useState(false);

    // ─── Verification Flow on Mount ───
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const res = await flowApi.getDashboardData();
                if (res.success && res.data) {
                    cachedDashboardData = res.data;
                    isDashboardLoaded = true;
                    setStats(res.data.stats || stats);
                    setTasks(res.data.tasks || tasks);
                    setInvites(res.data.invites || invites);
                    setTopicMastery(res.data.topicMastery || topicMastery);
                    setActivityData(res.data.activity || activityData);
                    setStreak(res.data.streak || streak);
                    setReferrerCode(res.data.referrerCode || '');
                    setReferrerName(res.data.referrerName || '');
                    setRewardHistory(res.data.rewardHistory || []);

                    if (res.data.shouldShowTour) {
                        const isMobileViewport = window.innerWidth < 768;
                        const steps: TourStep[] = [
                            { selector: '.dashboard-tour-stats', title: 'خلاصه آمار عملکرد', description: 'در این بخش امتیاز، درصد دقت پاسخ‌گویی، رتبه لیگ و زمان کل تمرین خود را رصد کنید.' },
                            { selector: '.dashboard-tour-shortcuts', title: 'دسترسی سریع', description: 'میانبرهای ارتباطی، گزارش‌ها، یادداشت‌ها و کارگاه آزمون‌ها.' },
                            { selector: '.dashboard-tour-streak', title: 'استمرار روزانه', description: 'استمرار فعالیت روزانه را جهت کسب رده و پاداش‌های فزاینده حفظ کنید.' },
                            { selector: '.dashboard-tour-mastery', title: 'تحلیل مهارت‌ها', description: 'بررسی راداری ۵ مهارت اساسی به تفکیک مباحث ریاضی، فیزیک، زیست، شیمی و میزان دقت عمومی.' },
                            { selector: '.dashboard-tour-tasks', title: 'ماموریت‌های جاری', description: 'چالش‌های مختلف را به سرانجام برسانید و با دریافت پاداش‌ها، سطح کاربری خود را ارتقا دهید.' },
                            { selector: '.dashboard-tour-invites', title: 'اشتراک‌گذاری و ارجاع', description: 'دعوت از هم‌کلاسی‌ها، مشاهده کاربران دعوت‌شده و ثبت کد معرف.' }
                        ];

                        // Navigation guide: side nav links on desktop, bottom nav on mobile
                        if (isMobileViewport) {
                            steps.push(
                                { selector: '.bottomnav-tour-container', title: 'منوی پایین', description: 'از این منو به همه بخش‌های اصلی اپلیکیشن دسترسی دارید.' },
                                { selector: '.nav-practice', title: 'تمرین', description: 'شروع تمرین سوالات به تفکیک درس، پایه و فصل از همین‌جا.' },
                                { selector: '.nav-tests', title: 'دنیای آزمون', description: 'ساخت آزمون‌های گروهی و رقابت آنلاین با دوستان.' },
                                { selector: '.nav-profile', title: 'پروفایل', description: 'مدیریت اطلاعات کاربری، اشتراک و تنظیمات امنیتی.' }
                            );
                        } else {
                            steps.push(
                                { selector: '.sidenav-tour-practice', title: 'تمرین', description: 'شروع تمرین سوالات به تفکیک درس، پایه و فصل از همین‌جا.' },
                                { selector: '.sidenav-tour-tests', title: 'دنیای آزمون', description: 'ساخت آزمون‌های گروهی و رقابت آنلاین با دوستان.' },
                                { selector: '.sidenav-tour-documents', title: 'نمونه سوالات آماده', description: 'دانلود جزوات، درسنامه‌ها و نمونه سوالات امتحانی.' },
                                { selector: '.sidenav-tour-history', title: 'سوابق آزمون‌ها', description: 'مرور کارنامه و نتایج تمام آزمون‌هایی که شرکت کرده‌اید.' },
                                { selector: '.sidenav-tour-profile', title: 'پروفایل کاربری', description: 'مدیریت اطلاعات کاربری، اشتراک و تنظیمات امنیتی.' }
                            );
                        }

                        setTimeout(() => startTour('dashboard', steps), 800);
                    }
                }
            } catch (error) {
                console.error("Failed loading dashboard payload:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDashboardData();
    }, [startTour]);

    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => setRenderCharts(true), 350);
            return () => clearTimeout(timer);
        }
    }, [isLoading]);

    // Generate simple, shorter encrypted parameters for safety and UX
    const obfuscatedCode = useMemo(() => encryptPhoneNumber(user?.phone || user?.username || ''), [user]);
    const inviteLink = `https://metatest.com/invite/${obfuscatedCode}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success("لینک دعوت با موفقیت کپی شد!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyDiscount = (code: string) => {
        navigator.clipboard.writeText(code);
        setDiscountCopied(true);
        toast.success("کد تخفیف با موفقیت کپی شد!");
        setTimeout(() => setDiscountCopied(false), 2000);
    };

    // Social Sharing parameters with enticing localized copy text
    const shareText = `من از اپلیکیشن آموزشی و رقابتی مِتاتست استفاده می‌کنم تا برای امتحانات آماده بشم. همین الان بیا و با لینک من ثبت‌نام کن تا به هر دو تا مون پاداش امتیاز (XP) تعلق بگیره! 👇\n`;

    const shareLinks = {
        telegram: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`,
        whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + inviteLink)}`,
        sms: `sms:?body=${encodeURIComponent(shareText + ' ' + inviteLink)}`
    };

    // ─── Search & Filtration for Invited List ───
    const filteredInvites = useMemo(() => {
        if (!invites.list) return [];
        return invites.list.filter((inv: any) => {
            const query = searchQuery.trim().toLowerCase();
            if (!query) return true;
            return (
                inv.name?.toLowerCase().includes(query) ||
                inv.invited_phone?.toLowerCase().includes(query)
            );
        });
    }, [invites.list, searchQuery]);

    // ─── Referrer Operations ───
    const handleCheckReferrerInfo = () => {
        if (!referrerInput.trim()) {
            setReferrerError('شماره همراه معرف خود را وارد نمایید.');
            return;
        }
        setReferrerError('');
        setPreviewInviterData({ name: 'معرف پیشنهادی', phone: referrerInput.trim() });
        setShowVerificationConfirm(true);
    };

    const handleConfirmReferrerSubmit = async () => {
        if (!previewInviterData) return;
        setSubmittingReferrer(true);
        try {
            const res = await flowApi.submitReferrerCode({ referrerCode: previewInviterData.phone });
            if (res.success) {
                setReferrerCode(previewInviterData.phone);
                setReferrerName(res.data?.referrerName || 'معرف تاییدشده');
                setReferrerError('');
                setShowVerificationConfirm(false);
                setPreviewInviterData(null);
                toast.success("کد معرف با موفقیت ثبت گردید!");
            } else {
                setReferrerError(res.message || 'ثبت معرف با خطا مواجه شد.');
                setShowVerificationConfirm(false);
            }
        } catch {
            setReferrerError('خطا در برقراری ارتباط با شبکه.');
        } finally {
            setSubmittingReferrer(false);
        }
    };

    // ─── Claim Task Reward (with game-style flying rewards) ───
    const spawnRewardFlights = (kind: RewardKind, originRect?: DOMRect) => {
        const startX = originRect ? originRect.left + originRect.width / 2 : window.innerWidth / 2;
        const startY = originRect ? originRect.top + originRect.height / 2 : window.innerHeight / 2;
        const burst: RewardFlightItem[] = Array.from({ length: 7 }).map(() => ({
            id: Math.random().toString(36).slice(2, 11),
            kind,
            startX: startX + (Math.random() - 0.5) * originRectWidth(originRect),
            startY
        }));
        setRewardFlights(prev => [...prev, ...burst]);
    };

    const originRectWidth = (rect?: DOMRect) => (rect ? Math.min(rect.width * 0.6, 120) : 60);

    const handleClaimReward = async (task: any, originRect?: DOMRect) => {
        setClaimingRewardId(task.id);
        try {
            const res = await flowApi.claimTaskReward({ taskId: task.id });
            if (res.success) {
                setTasks((prev: any) => ({
                    ...prev,
                    permanent: prev.permanent.map((t: any) => t.id === task.id ? { ...t, rewardClaimed: true, isCompleted: true } : t),
                    temporary: prev.temporary.map((t: any) => t.id === task.id ? { ...t, rewardClaimed: true, isCompleted: true } : t)
                }));

                // Determine local modal visual elements based on IDs and custom properties
                let rewardType: RewardKind = 'xp';
                let rewardValue: string | number = res.data?.xpGained || task.rewardXp || 25;

                if (task.id === 5 || task.rewardBadge === 'discount') {
                    rewardType = 'discount';
                    rewardValue = res.data?.discountCode || 'METAGIFT30';
                } else if (task.rewardTrophy > 0 || task.id === 7) {
                    rewardType = 'trophy';
                    rewardValue = task.rewardTrophy || 5;
                }

                // Game-style burst: reward icons fly from the card to screen center
                spawnRewardFlights(rewardType, originRect);

                if (rewardType === 'xp') {
                    setStats((prev: any) => ({ ...prev, xp: prev.xp + Number(rewardValue) }));
                    toast.success(`پاداش دریافت شد! +${rewardValue} امتیاز به حساب شما اضافه شد.`);
                } else if (rewardType === 'trophy') {
                    setStats((prev: any) => ({ ...prev, trophies: prev.trophies + Number(rewardValue) }));
                    toast.success(`پاداش دریافت شد! +${rewardValue} جام طلایی به دارایی‌های شما افزوده شد.`);
                } else if (rewardType === 'discount') {
                    toast.success(`پاداش دریافت شد! یک کد تخفیف با موفقیت برای شما صادر گردید.`);
                }

                // Open the reward modal after the flight animation settles
                setTimeout(() => {
                    setRewardModalData({
                        isOpen: true,
                        rewardType,
                        rewardValue,
                        taskTitle: task.title
                    });
                }, 950);

                // Update reward history state from live dashboard query
                const historyRes = await flowApi.getDashboardData();
                if (historyRes.success && historyRes.data.rewardHistory) {
                    setRewardHistory(historyRes.data.rewardHistory);
                }
            }
        } catch (error) {
            console.error("Claiming failure:", error);
            toast.error("بروز خطا در دریافت پاداش ماموریت.");
        } finally {
            setClaimingRewardId(null);
        }
    };

    // ─── PES 2021 Style Pentagon Mapping ───
    const parseSubjectScore = (subjectName: string) => {
        const found = topicMastery.find((item: any) =>
            item.subject.toLowerCase().includes(subjectName.toLowerCase())
        );
        return found ? found.score : 0;
    };

    // Dynamic radar scale: fits the axis to the user's real level so small
    // values (e.g. 5 out of 100) still draw a clearly visible shape.
    const pentagonMax = useMemo(() => {
        const scores = [
            parseSubjectScore('ریاضی'),
            parseSubjectScore('زیست'),
            parseSubjectScore('شیمی'),
            parseSubjectScore('فیزیک'),
            parseInt(stats.accuracy) || 0
        ];
        const maxScore = Math.max(...scores, 0);
        if (maxScore <= 10) return 10;
        if (maxScore <= 20) return 20;
        if (maxScore <= 40) return 40;
        if (maxScore <= 60) return 60;
        if (maxScore <= 80) return 80;
        return 100;
    }, [topicMastery, stats.accuracy]);

    const pentagonData = useMemo(() => {
        return [
            { subject: 'ریاضیات', score: parseSubjectScore('ریاضی'), fullMark: pentagonMax },
            { subject: 'زیست‌شناسی', score: parseSubjectScore('زیست'), fullMark: pentagonMax },
            { subject: 'شیمی', score: parseSubjectScore('شیمی'), fullMark: pentagonMax },
            { subject: 'فیزیک', score: parseSubjectScore('فیزیک'), fullMark: pentagonMax },
            { subject: 'دقت عمومی', score: parseInt(stats.accuracy) || 0, fullMark: pentagonMax }
        ];
    }, [topicMastery, stats.accuracy, pentagonMax]);

    const hasMasteryData = useMemo(
        () => pentagonData.some(item => item.score > 0),
        [pentagonData]
    );

    const inviteCount = invites.list?.length || 0;
    const sortedTasks = useMemo(() => {
        const list = [...(tasks.permanent || []), ...(tasks.temporary || [])];
        const rank = (task: any) => {
            const current = task.id === 5 ? inviteCount : Number(task.current) || 0;
            const done = current >= (Number(task.target) || 0) || !!task.isCompleted;
            const canClaim = done && !task.rewardClaimed;
            if (canClaim) return 0;
            if (task.rewardClaimed) return 2;
            return 1;
        };
        return list.sort((a, b) => rank(a) - rank(b));
    }, [tasks, inviteCount]);

    if (isLoading) return <DashboardSkeleton />;

    const hasActivityData = (activityData[timeFilter]?.length || 0) > 0;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)] text-right" dir="rtl">
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 space-y-4 md:space-y-5 pb-20 md:pb-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4 md:space-y-5">

                    {/* Quick Stats Grid */}
                    <motion.div variants={itemVariants} className="dashboard-tour-stats grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                        <ColorfulStatCard icon={Award}    value={stats.trophies.toLocaleString('fa-IR')}      label="امتیاز کل "   colorClass="text-[#eab308]" bgClass="bg-[#eab308]/15" />
                        <ColorfulStatCard icon={Target}   value={stats.accuracy}                         label="دقت پاسخ‌گویی"   colorClass="text-[#22c55e]" bgClass="bg-[#22c55e]/15" />
                        <ColorfulStatCard icon={BarChart3} value={stats.rank}                            label="رتبه در لیگ"     colorClass="text-[#3b82f6]" bgClass="bg-[#3b82f6]/15" />
                        <ColorfulStatCard icon={Clock}    value={stats.practiceTime}                     label="زمان تمرین"      colorClass="text-[#a855f7]" bgClass="bg-[#a855f7]/15" />
                    </motion.div>

                    {/* App Shortcuts */}
                    <motion.div variants={itemVariants} className="dashboard-tour-shortcuts grid grid-cols-5 gap-1.5 sm:gap-3 py-1">
                        <ShortcutBtn icon={BookOpen} label="یادداشت‌ها"  onClick={onNavigateToNotes} />
                        <ShortcutBtn icon={Star}     label="علاقه‌مندی"  onClick={onNavigateToFavorites} />
                        <ShortcutBtn icon={Layers}   label="جعبه مرور"   onClick={onNavigateToReview} />
                        <ShortcutBtn icon={PieChart} label="گزارش‌ها"    onClick={onNavigateToReports} />
                        <ShortcutBtn icon={History}  label="آزمون‌ها"    onClick={onNavigateToQuizHistory} />
                    </motion.div>

                    {/* Chart Layout — activity + radar side by side; quote + streak under them */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Activity Chart (taller) */}
                        <motion.div variants={itemVariants} className="dashboard-tour-activity lg:col-span-2 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border)] flex flex-col">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Activity className="text-[var(--color-primary-500)]" size={18} />گزارش فعالیت زمان‌بندی‌شده
                                </h2>
                                <div className="flex bg-[var(--bg-element)] p-1 rounded-lg w-fit">
                                    {(['7d','1m','1y'] as const).map((filter, index) => (
                                        <button key={`time-${filter}-${index}`} onClick={() => setTimeFilter(filter)} className={`relative px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors duration-300 z-10 ${timeFilter === filter ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                            {timeFilter === filter && <motion.div layoutId="activeTimeFilter" className="absolute inset-0 bg-[var(--color-primary-500)] rounded-md shadow-sm -z-10" transition={smoothTween} />}
                                            <span className="relative z-10">{filter === '7d' ? 'هفته' : filter === '1m' ? 'ماه' : 'سال'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="relative flex-1 min-h-[200px] md:min-h-[240px] w-full mt-1" dir="rtl">
                                {renderCharts && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className={`absolute inset-0 ${!hasActivityData ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={hasActivityData ? activityData[timeFilter] : SAMPLE_ACTIVITY_DATA} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <XAxis dataKey="date" stroke={chartColors.axis} fontSize={10} tickLine={false} axisLine={false} />
                                                {hasActivityData && (
                                                    <Tooltip content={({ active, payload }) => {
                                                        if (active && payload?.length) {
                                                            const item = payload[0].payload;
                                                            return (
                                                                <div className="rounded-xl border bg-[var(--bg-card)] border-[var(--border)] p-2.5 shadow-md">
                                                                    <div className="text-xs font-bold text-[var(--text-primary)] mb-0.5">{item.date}</div>
                                                                    <div className="text-[11px] text-[var(--color-primary-500)] font-medium">زمان فعالیت: {item.time} ثانیه</div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }} />
                                                )}
                                                <Area type="monotone" dataKey="time" stroke={chartColors.primary} strokeWidth={2.5} fillOpacity={1} fill="url(#areaColor)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </motion.div>
                                )}
                                {renderCharts && !hasActivityData && (
                                    <ChartGlassPlaceholder
                                        icon={LineChart}
                                        title="این یک نمودار نمونه است"
                                        description="پس از انجام فعالیت و تمرین، داده‌های واقعی شما در اینجا نمایش داده می‌شود."
                                    />
                                )}
                            </div>
                        </motion.div>

                        {/* Skill radar */}
                        <motion.div variants={itemVariants} className="dashboard-tour-mastery bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border)] flex flex-col items-center h-full">
                            <h2 className="text-sm font-bold text-[var(--text-primary)] self-start mb-1 flex items-center gap-2">
                                <Target className="text-[var(--color-primary-500)]" size={16} />سطح توانمندی راداری
                            </h2>
                            <div className="flex-1 w-full relative min-h-[200px] md:min-h-[240px]" dir="ltr">
                                {renderCharts && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className={`absolute inset-0 ${!hasMasteryData ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="62%" data={hasMasteryData ? pentagonData : SAMPLE_PENTAGON_DATA}>
                                                <PolarGrid stroke="var(--border)" gridType="polygon" />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} />
                                                <PolarRadiusAxis angle={90} domain={[0, hasMasteryData ? pentagonMax : 100]} tickCount={6} tick={false} axisLine={false} />
                                                <Radar name="مهارت" dataKey="score" stroke={chartColors.primary} strokeWidth={2.5} fill={chartColors.primary} fillOpacity={0.35} isAnimationActive />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </motion.div>
                                )}
                                {renderCharts && !hasMasteryData && (
                                    <ChartGlassPlaceholder
                                        icon={HelpCircle}
                                        title="این یک نمودار نمونه است"
                                        description="به سوالات پاسخ دهید تا نقاط قوت واقعی شما به‌شکل یک پنج‌ضلعی رسم شود."
                                    />
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Quote under activity column; streak under skill chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <motion.div variants={itemVariants} className="lg:col-span-2">
                            <QuoteSlider />
                        </motion.div>
                        <DailyStreakCard currentStreak={streak.current} longestStreak={streak.longest} />
                    </div>

                    {/* Tasks & Redesigned Invites */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* Tasks Section with missions / rewards-history tabs */}
                        <motion.div variants={itemVariants} className="dashboard-tour-tasks lg:col-span-2 bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border)] min-h-[260px] flex flex-col">
                            <div className="flex items-center justify-between mb-4 gap-2">
                                <h2 className="hidden md:flex text-sm font-bold text-[var(--text-primary)] items-center gap-2 shrink-0">
                                    <Shield className="text-[var(--color-primary-500)]" size={16} />ماموریت‌های جاری
                                </h2>
                                <div className="flex gap-4 border-b border-[var(--border)] pb-0 relative mr-auto md:mr-0">
                                    <button onClick={() => setTaskTab('missions')} className={`relative text-[11px] font-bold pb-2 transition-colors duration-300 ${taskTab === 'missions' ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                        ماموریت‌ها
                                        {taskTab === 'missions' && <motion.div layoutId="activeTaskTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary-500)] rounded-t-full" transition={smoothTween} />}
                                    </button>
                                    <button onClick={() => setTaskTab('rewards')} className={`relative text-[11px] font-bold pb-2 transition-colors duration-300 flex items-center gap-1 ${taskTab === 'rewards' ? 'text-[var(--color-primary-500)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>
                                        <History size={11} /> تاریخچه جوایز
                                        {taskTab === 'rewards' && <motion.div layoutId="activeTaskTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary-500)] rounded-t-full" transition={smoothTween} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col relative w-full">
                                <AnimatePresence mode="wait">
                                    {taskTab === 'missions' ? (
                                        sortedTasks.length > 0 ? (
                                            // Max-height strictly restricted to show exactly 4 items at once before scrolling with hidden bar
                                            <motion.div
                                                key="missions"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.25 }}
                                                className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full overflow-y-auto max-h-[320px] md:max-h-[164px] pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                            >
                                                {sortedTasks.map((task: any, index: number) => (
                                                    <TaskItem
                                                        key={task.id || `task-${index}`}
                                                        task={task}
                                                        onClaimReward={handleClaimReward}
                                                        claiming={claimingRewardId === task.id}
                                                        totalInvitesCount={inviteCount}
                                                    />
                                                ))}
                                            </motion.div>
                                        ) : (
                                            <motion.div key="empty-missions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full h-full flex-1">
                                                <EmptyState icon={Inbox} title="ماموریتی یافت نشد" description="همه ماموریت‌های در دسترس را به انجام رسانده‌اید!" />
                                            </motion.div>
                                        )
                                    ) : (
                                        <motion.div
                                            key="rewards"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="w-full overflow-y-auto max-h-[320px] md:max-h-[164px] space-y-2 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                        >
                                            {rewardHistory && rewardHistory.length > 0 ? (
                                                rewardHistory.map((item: any) => {
                                                    const historyKind: RewardKind = item.rewardCode ? 'discount' : (item.rewardTrophy > 0 ? 'trophy' : 'xp');
                                                    const historyStyle = REWARD_STYLE[historyKind];
                                                    return (
                                                        <div key={`history-item-${item.id}`} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-element)]/30">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--border)] ${historyStyle.bgClass} ${historyStyle.colorClass}`}>
                                                                    <RewardIcon kind={historyKind} size={14} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[11px] font-bold text-[var(--text-primary)]">{item.taskTitle}</span>
                                                                    <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-muted)] mt-0.5">
                                                                        <Calendar size={10} />
                                                                        <span>{item.date ? new Date(item.date).toLocaleDateString('fa-IR') : 'نامشخص'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col items-end gap-1 text-[9px] font-bold">
                                                                {item.rewardXp > 0 && (
                                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${REWARD_STYLE.xp.bgClass} ${REWARD_STYLE.xp.colorClass}`}>
                                                                        <RewardIcon kind="xp" size={9} /> +{item.rewardXp} XP
                                                                    </span>
                                                                )}
                                                                {item.rewardTrophy > 0 && (
                                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded ${REWARD_STYLE.trophy.bgClass} ${REWARD_STYLE.trophy.colorClass}`}>
                                                                        <RewardIcon kind="trophy" size={9} /> +{item.rewardTrophy} جام
                                                                    </span>
                                                                )}
                                                                {item.rewardCode && (
                                                                    <span className={`px-2 py-0.5 rounded ${REWARD_STYLE.discount.bgClass} ${REWARD_STYLE.discount.colorClass}`} dir="ltr">
                                                                        {item.rewardCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="w-full h-full flex-1">
                                                    <EmptyState icon={History} title="تاریخچه‌ای یافت نشد" description="شما هنوز پاداشی از ماموریت‌ها دریافت نکرده‌اید." />
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* Redesigned Invites Section */}
                        <motion.div variants={itemVariants} className="dashboard-tour-invites bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border)] min-h-[220px] flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                    <Users className="text-[var(--color-primary-500)]" size={16} />مدیریت ارجاع و دعوت
                                </h2>
                                <span className="text-[10px] bg-[var(--color-primary-500)]/15 text-[var(--color-primary-500)] font-bold px-2 py-0.5 rounded-full">
                                    {invites.list?.length || 0} دعوت شده
                                </span>
                            </div>

                            {invites.list?.length > 7 && (
                                <div className="relative mb-3">
                                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="جستجوی نام یا تلفن دعوت‌شده..."
                                        className="w-full pl-3 pr-8 py-2 bg-[var(--bg-element)] border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary-500)]"
                                    />
                                </div>
                            )}

                            {/* Scrollable list of invited friends with hidden scroll handles */}
                            <div className="flex-1 max-h-[160px] overflow-y-auto space-y-2 mb-4 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {filteredInvites.length > 0 ? (
                                    filteredInvites.map((invite: any, index: number) => (
                                        <InvitedUserRow key={invite.id || `inv-${index}`} invite={invite} />
                                    ))
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <EmptyState icon={UserPlus} title="کسی هنوز دعوت نشده" description="با ارسال لینک اختصاصی، اولین دوست خود را دعوت کنید." />
                                    </div>
                                )}
                            </div>

                            {/* Double Button CTA */}
                            <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-[var(--border)]">
                                <button
                                    onClick={() => setIsShareModalOpen(true)}
                                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)] transition-colors text-[10.5px] font-bold active:scale-95"
                                >
                                    <Share2 size={13} /> اشتراک لینک
                                </button>
                                <button
                                    onClick={() => setIsReferrerModalOpen(true)}
                                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-element)] text-[var(--text-primary)] hover:bg-[var(--bg-element)]/80 transition-colors text-[10.5px] font-bold active:scale-95"
                                >
                                    <UserCheck size={13} /> {referrerCode ? 'مشاهده معرف' : 'ثبت معرف'}
                                </button>
                            </div>
                        </motion.div>

                    </div>
                </motion.div>
            </main>

            {/* Social Share & Copy Modal */}
            <ResponsiveModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} title="ارسال لینک دعوت اختصاصی">
                <div className="space-y-4 p-2 text-center">
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        با ارسال لینک زیر به دوستان خود، پس از ثبت‌نام آن‌ها پاداش‌های ارائه‌شده را بلافاصله در حساب خود ذخیره کنید.
                    </p>

                    <div className="flex items-center gap-2 bg-[var(--bg-element)] p-1.5 rounded-xl border border-[var(--border)]">
                        <div className="flex-1 truncate px-2 text-xs text-[var(--text-primary)] text-left" dir="ltr">{inviteLink}</div>
                        <button onClick={handleCopy} className={`py-1.5 px-3 rounded-lg transition-all text-[11px] font-bold active:scale-95 ${copied ? 'bg-emerald-500/15 text-emerald-500' : 'bg-[var(--color-primary-500)] text-white hover:bg-[var(--color-primary-600)]'}`}>
                            {copied ? 'کپی شد' : 'کپی لینک'}
                        </button>
                    </div>

                    <div className="pt-2">
                        <span className="text-[10px] font-bold text-[var(--text-muted)] block mb-3">اشتراک مستقیم در شبکه‌های اجتماعی:</span>
                        <div className="grid grid-cols-3 gap-2">
                            <a href={shareLinks.telegram} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-element)] transition-colors text-center text-[10px] font-semibold text-[var(--text-primary)]">
                                <Send size={16} className="text-[#24A1DE]" /> تلگرام
                            </a>
                            <a href={shareLinks.whatsapp} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-element)] transition-colors text-center text-[10px] font-semibold text-[var(--text-primary)]">
                                <MessageSquare size={16} className="text-[#25D366]" /> واتساپ
                            </a>
                            <a href={shareLinks.sms} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-element)] transition-colors text-center text-[10px] font-semibold text-[var(--text-primary)]">
                                <Smartphone size={16} className="text-purple-500" /> پیامک عادی
                            </a>
                        </div>
                    </div>
                </div>
            </ResponsiveModal>

            {/* Referrer & Code Submit Modal */}
            <ResponsiveModal isOpen={isReferrerModalOpen} onClose={() => { setIsReferrerModalOpen(false); setShowVerificationConfirm(false); }} title={referrerCode ? "مشخصات معرف شما" : "ثبت شماره همراه معرف"}>
                <div className="p-2 space-y-4">
                    {referrerCode ? (
                        <div className="space-y-4 text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto">
                                <UserCheck size={28} />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-[var(--text-primary)]">{referrerName || 'معرف شما'}</h3>
                                <p className="text-[11px] text-[var(--text-muted)] tracking-widest" dir="ltr">{referrerCode}</p>
                            </div>
                            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5">
                                <Check size={14} strokeWidth={3} /> شما تحت ارجاع این معرف در سیستم قرار دارید.
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {!showVerificationConfirm ? (
                                <div className="space-y-3">
                                    <p className="text-xs text-[var(--text-muted)] leading-relaxed text-center">
                                        در صورتی که از طرف شخصی به سیستم هدایت شده‌اید، شماره تلفن معرف را جهت اعمال پاداش وارد کنید:
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            dir="ltr"
                                            value={referrerInput}
                                            onChange={(e) => { setReferrerInput(e.target.value); setReferrerError(''); }}
                                            placeholder="مثال: 09123456789"
                                            className="flex-1 px-3 py-2 bg-[var(--bg-element)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] text-left"
                                        />
                                        <button
                                            onClick={handleCheckReferrerInfo}
                                            className="px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-white text-xs font-bold rounded-xl transition-colors shrink-0"
                                        >
                                            بررسی معرف
                                        </button>
                                    </div>
                                    {referrerError && <p className="text-[10px] text-red-500 font-semibold">{referrerError}</p>}
                                </div>
                            ) : (
                                <div className="space-y-4 text-center">
                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                                        <span className="text-[11px] text-[var(--text-muted)] block mb-1">شناسه معرف پیشنهادی:</span>
                                        <strong className="text-xs font-bold text-[var(--text-primary)] block tracking-widest" dir="ltr">{previewInviterData?.phone}</strong>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">آیا از ثبت این کاربر به عنوان معرف دائمی خود اطمینان دارید؟</p>
                                    <div className="grid grid-cols-2 gap-2 pt-2">
                                        <button
                                            onClick={handleConfirmReferrerSubmit}
                                            disabled={submittingReferrer}
                                            className="py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                                        >
                                            {submittingReferrer ? 'در حال ثبت...' : 'بله، تایید نهایی'}
                                        </button>
                                        <button
                                            onClick={() => setShowVerificationConfirm(false)}
                                            disabled={submittingReferrer}
                                            className="py-2.5 bg-[var(--bg-element)] hover:bg-[var(--bg-element)]/80 text-[var(--text-primary)] text-xs font-bold rounded-xl transition-colors border border-[var(--border)]"
                                        >
                                            لغو و اصلاح
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ResponsiveModal>

            {/* Dynamic Reward Claim Confirmation Modal */}
            <ResponsiveModal
                isOpen={rewardModalData?.isOpen || false}
                onClose={() => setRewardModalData(null)}
                title="پاداش دریافت شد"
            >
                <div className="relative overflow-hidden rounded-2xl">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-white/10 to-transparent dark:from-white/10 dark:via-transparent" />
                    <div className="relative flex flex-col items-center text-center space-y-3 p-3 backdrop-blur-sm">
                        {rewardModalData && (
                            <div className={`w-12 h-12 rounded-2xl border border-white/40 dark:border-white/15 shadow-sm flex items-center justify-center ${REWARD_STYLE[rewardModalData.rewardType].bgClass} ${REWARD_STYLE[rewardModalData.rewardType].colorClass}`}>
                                <RewardIcon kind={rewardModalData.rewardType} size={24} />
                            </div>
                        )}

                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-[var(--text-primary)]">تبریک!</h3>
                            <p className="text-[11px] text-[var(--text-muted)] max-w-xs leading-relaxed">
                                پاداش ماموریت «{rewardModalData?.taskTitle}» ثبت شد.
                            </p>
                        </div>

                        {rewardModalData?.rewardType === 'xp' && (
                            <div className="px-3.5 py-2 rounded-xl text-indigo-600 dark:text-indigo-300 font-bold text-xs bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md">
                                +{rewardModalData?.rewardValue} XP
                            </div>
                        )}
                        {rewardModalData?.rewardType === 'trophy' && (
                            <div className="px-3.5 py-2 rounded-xl text-amber-600 dark:text-amber-300 font-bold text-xs bg-amber-500/10 border border-amber-500/20 backdrop-blur-md">
                                +{rewardModalData?.rewardValue} جام
                            </div>
                        )}
                        {rewardModalData?.rewardType === 'discount' && (
                            <div className="w-full space-y-2">
                                <div className="text-[10px] font-bold text-[var(--text-muted)]">کد تخفیف:</div>
                                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-white/30 dark:border-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-md">
                                    <span className="text-xs font-black tracking-widest text-rose-500" dir="ltr">{rewardModalData?.rewardValue}</span>
                                    <button
                                        onClick={() => handleCopyDiscount(String(rewardModalData?.rewardValue))}
                                        className={`p-1.5 rounded-lg transition-all text-[10px] font-bold ${discountCopied ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500 text-white'}`}
                                    >
                                        {discountCopied ? 'کپی شد' : 'کپی'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={() => setRewardModalData(null)}
                            className="w-full py-2.5 bg-[var(--color-primary-500)]/90 hover:bg-[var(--color-primary-500)] text-white font-bold text-xs rounded-xl transition-colors mt-1 backdrop-blur-sm"
                        >
                            باشه
                        </button>
                    </div>
                </div>
            </ResponsiveModal>

            {/* Game-style flying rewards overlay */}
            <RewardFlightLayer
                flights={rewardFlights}
                onFinish={(id) => setRewardFlights(prev => prev.filter(f => f.id !== id))}
            />
        </div>
    );
}