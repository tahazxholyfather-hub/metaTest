import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { CheckCircle2, XCircle, HelpCircle, Snowflake, Activity, Flame } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils & Animation (Required for components) ---
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const itemVars: Variants = {
    hidden: { opacity: 0, y: 14 },
    show: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 260, damping: 24 },
    },
};

// --- Components ---

export const Card = ({
                         children,
                         className,
                     }: {
    children: React.ReactNode;
    className?: string;
}) => (
    <motion.div
        variants={itemVars}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-20px" }}
        className={cn(
            'rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-1)]',
            className
        )}
    >
        {children}
    </motion.div>
);

export const SectionHeader = ({
                                  title,
                                  subtitle,
                                  icon: Icon,
                              }: {
    title: string;
    subtitle?: string;
    icon?: React.ElementType;
}) => (
    <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
            {Icon ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
                    <Icon className="h-5 w-5 text-[var(--color-primary-400)]" />
                </div>
            ) : null}
            <div>
                <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">{title}</h3>
                {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
            </div>
        </div>
    </div>
);

export const getStatusConfig = (status: 'correct' | 'wrong' | 'unanswered') => {
    if (status === 'correct') {
        return {
            label: 'درست',
            icon: CheckCircle2,
            soft: 'bg-[color:rgba(21,128,61,0.12)] text-[var(--success)] border-[color:rgba(21,128,61,0.2)]',
        };
    }
    if (status === 'wrong') {
        return {
            label: 'نادرست',
            icon: XCircle,
            soft: 'bg-[color:rgba(185,28,28,0.12)] text-[var(--error)] border-[color:rgba(185,28,28,0.2)]',
        };
    }
    return {
        label: 'بی‌پاسخ',
        icon: HelpCircle,
        soft: 'bg-[color:rgba(180,83,9,0.12)] text-[var(--warning)] border-[color:rgba(180,83,9,0.2)]',
    };
};

export const getLevelConfig = (level: 'آسان' | 'متوسط' | 'سخت') => {
    switch (level) {
        case 'آسان': return { label: 'آسان', icon: Snowflake, color: 'text-blue-500' };
        case 'متوسط': return { label: 'متوسط', icon: Activity, color: 'text-yellow-500' };
        case 'سخت': return { label: 'سخت', icon: Flame, color: 'text-red-500' };
        default: return { label: 'نامشخص', icon: Activity, color: 'text-gray-400' };
    }
};

export const StatCard = ({
                             title,
                             percent,
                             count,
                             tone,
                             icon: Icon,
                         }: {
    title: string;
    percent: string;
    count: string;
    tone: 'success' | 'error' | 'warning' | 'primary';
    icon: React.ElementType;
}) => {
    const toneStyles = {
        success: 'text-[var(--success)] bg-[color:rgba(21,128,61,0.12)]',
        error: 'text-[var(--error)] bg-[color:rgba(185,28,28,0.12)]',
        warning: 'text-[var(--warning)] bg-[color:rgba(180,83,9,0.12)]',
        primary: 'text-[var(--color-primary-400)] bg-[color:rgba(59,130,246,0.12)]',
    };

    return (
        <Card className="p-3.5 md:p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs md:text-sm font-medium text-[var(--text-muted)]">{title}</p>
                    <div className="mt-2 flex items-end gap-2">
                        <span className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-primary)]">
                            {percent}
                        </span>
                    </div>
                    <p className="mt-1 text-[11px] md:text-xs font-medium text-[var(--text-muted)]">{count}</p>
                </div>

                <div
                    className={cn(
                        'flex h-10 w-10 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-2xl',
                        toneStyles[tone]
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </Card>
    );
};

export const CircleProgress = ({
                                   value,
                                   size = 72,
                                   stroke = 8,
                                   color = 'var(--color-primary-500)',
                                   track = 'var(--bg-element)',
                                   textClassName = '',
                                   children,
                               }: {
    value: number;
    size?: number;
    stroke?: number;
    color?: string;
    track?: string;
    textClassName?: string;
    children?: React.ReactNode;
}) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (value / 100) * circumference;
    const dashoffset = circumference - progress;

    return (
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90 absolute">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={track}
                    strokeWidth={stroke}
                    fill="transparent"
                />
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={stroke}
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    whileInView={{ strokeDashoffset: dashoffset }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ duration: 1.1, ease: 'easeOut', delay: 0.1 }}
                />
            </svg>
            <div className={cn('absolute flex flex-col items-center justify-center text-center', textClassName)}>
                {children || <span className="font-black leading-none">{value}%</span>}
            </div>
        </div>
    );
};

export const ScoreCard = ({
                              totalScore,
                              maxScore,
                              scorePercentage,
                              topics = [], // Added topics as a prop to replace examTopics mock data
                          }: {
    totalScore: number;
    maxScore: number;
    scorePercentage: number;
    topics?: string[];
}) => (
    <Card className="p-4 md:p-6 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
            {/* Text Score Details (Desktop only) */}
            <div className="hidden sm:block sm:order-1 text-center sm:text-right w-full sm:w-auto">
                <p className="text-sm font-medium text-[var(--text-muted)]">نمره کل</p>
                <div className="mt-2 flex items-end justify-center sm:justify-start gap-2">
                    <span className="text-5xl md:text-6xl font-black tracking-tight text-[var(--text-primary)]">
                        {totalScore}
                    </span>
                    <span className="mb-1 text-sm md:text-base font-medium text-[var(--text-muted)]">
                        / {maxScore}
                    </span>
                </div>
                <div className="mt-3 inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    عملکرد کلی آزمون
                </div>
            </div>

            {/* Circular Progress */}
            <div className="order-1 sm:order-2 flex justify-center">
                <CircleProgress
                    value={scorePercentage}
                    size={130}
                    stroke={10}
                    textClassName="text-[var(--text-primary)]"
                >
                    {/* UI Score in Mobile - Percentage in Desktop */}
                    <div className="flex flex-col items-center sm:hidden">
                        <span className="text-4xl font-black text-white">{totalScore}</span>
                        <span className="text-xs text-[var(--text-muted)] font-medium mt-1">از {maxScore}</span>
                    </div>
                    <div className="hidden sm:flex text-2xl font-black">
                        {scorePercentage}%
                    </div>
                </CircleProgress>
            </div>
        </div>

        {/* Info Badges (Lessons/Topics) */}
        {topics.length > 0 && (
            <div className="mt-6 border-t border-[var(--border)] pt-4 order-3 w-full min-w-0">
                <p className="text-xs text-[var(--text-muted)] mb-3 font-medium">مباحث آزمون</p>
                <div className="flex overflow-x-auto gap-2 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing w-full">
                    {topics.map((topic) => (
                        <span
                            key={topic}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-[color:rgba(59,130,246,0.1)] text-[var(--color-primary-500)] border border-[color:rgba(59,130,246,0.2)] text-[11px] font-bold"
                        >
                            {topic}
                        </span>
                    ))}
                </div>
            </div>
        )}
    </Card>
);

export const LessonCircleCard = ({
                                     title,
                                     progress,
                                     correct,
                                     wrong,
                                     unanswered,
                                 }: {
    title: string;
    progress: number;
    correct: number;
    wrong: number;
    unanswered: number;
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
    >
        <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
                <h4 className="truncate text-sm font-bold text-[var(--text-primary)]">{title}</h4>
                <p className="mt-1 text-xs text-[var(--text-muted)]">عملکرد این درس</p>
            </div>
            <CircleProgress
                value={progress}
                size={74}
                stroke={7}
                color="var(--color-primary-500)"
                textClassName="text-xs text-[var(--text-primary)]"
            />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-[var(--bg-card)] px-2 py-2">
                <div className="text-xs text-[var(--text-muted)]">درست</div>
                <div className="mt-1 text-sm font-black text-[var(--success)]">{correct}</div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-card)] px-2 py-2">
                <div className="text-xs text-[var(--text-muted)]">غلط</div>
                <div className="mt-1 text-sm font-black text-[var(--error)]">{wrong}</div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-card)] px-2 py-2">
                <div className="text-xs text-[var(--text-muted)]">نزده</div>
                <div className="mt-1 text-sm font-black text-[var(--warning)]">{unanswered}</div>
            </div>
        </div>
    </motion.div>
);

export const QuestionSkeleton = () => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 animate-pulse">
        <div className="flex justify-between items-start mb-3">
            <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-card)]" />
                <div className="w-16 h-6 rounded-full bg-[var(--bg-card)]" />
            </div>
            <div className="w-12 h-6 rounded-full bg-[var(--bg-card)]" />
        </div>
        <div className="w-3/4 h-4 bg-[var(--bg-card)] rounded mb-2" />
        <div className="w-1/2 h-4 bg-[var(--bg-card)] rounded mb-4" />
        <div className="flex gap-2 justify-end">
            <div className="w-6 h-6 rounded-full bg-[var(--bg-card)]" />
            <div className="w-6 h-6 rounded-full bg-[var(--bg-card)]" />
            <div className="w-6 h-6 rounded-full bg-[var(--bg-card)]" />
            <div className="w-6 h-6 rounded-full bg-[var(--bg-card)]" />
        </div>
    </div>
);
